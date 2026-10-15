#!/usr/bin/env python3
"""Stage3b independent official-source comparison, constitutional and legislative.

No judgment storage. No personal identifying data or full legal text in CI logs.
"""
import argparse
import asyncio
import json
import re
import ssl
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

REPORT = Path("v27-mcp-stage3b-text-sources.json")
CON_CASES = ("釋字第748號", "釋字第803號", "111年憲判字第1號")
LEG_CASES = (
    ("少年事件處理法", "3-1", "第三條之一"),
    ("保安處分執行法", "74-2", "第七十四條之二"),
)
OFFICIAL_CON = "cons.judicial.gov.tw"
OFFICIAL_LIS = "lis.ly.gov.tw"


def norm(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))


def trusted(url, hostname):
    p=urlparse(str(url or ""))
    return p.scheme=="https" and p.hostname==hostname


def extract_date(stamp):
    text=str(stamp or "").strip()
    if re.fullmatch(r"\d{7}", text):
        return f"{int(text[:3])+1911:04d}-{text[3:5]}-{text[5:7]}"
    if re.fullmatch(r"\d{8}",text):
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    return text


def matching_fragments(source, official, lengths=(36,48,72)):
    """Compare multiple nonadjacent exact portions; never count tiny keywords."""
    x=norm(source)
    y=norm(official)
    if len(x)<90 or len(y)<90:
        return {"sample_size":0,"matched":0,"ratio":0,"article_body_chars":len(x)}
    samples=[]
    span=min(55,max(32,len(x)//5))
    for fraction in (0.1,0.38,0.67,0.83):
        start=int((len(x)-span)*fraction)
        excerpt=x[start:start+span]
        if excerpt not in samples:
            samples.append(excerpt)
    hits=sum(bool(chunk in y) for chunk in samples)
    return {"sample_size":len(samples),"matched":hits,"ratio":round(hits/max(1,len(samples)),3),
            "article_body_chars":len(x)}


async def con_case(session, http, name, no):
    case={"id":no,"category":"constitutional","case_id":name,
          "status":"review","official_text_comparison_passed":False}
    try:
        response=unpack(await asyncio.wait_for(session.call_tool(
            "get_interpretation",{"case_id":name}),timeout=75))
        case["mcp_get_success"]=response.get("success") is True
        if not case["mcp_get_success"]:
            case["reason"]="mcp_unavailable"
            return case
        if norm(response.get("case_id"))!=norm(name):
            case.update(status="failed",reason="incorrect_case_identifier")
            return case
        url=response.get("source_url","")
        case["official_url"]=url
        if not trusted(url,OFFICIAL_CON):
            case.update(status="failed",reason="incorrect_official_origin")
            return case
        resp=await asyncio.wait_for(http.get(url),timeout=35)
        if not trusted(str(resp.url),OFFICIAL_CON):
            case.update(status="failed",reason="unexpected_redirect")
            return case
        if resp.status_code != 200:
            case["reason"]="official_http_"+str(resp.status_code)
            return case
        html=BeautifulSoup(resp.content,"html.parser")
        raw=html.get_text(" ",strip=True)
        if (("748" if "748" in name else "803" if "803" in name else "111") not in raw):
            case["reason"]="official_page_case_identifier_not_confirmed"
            return case
        candidate=str(response.get("main_text") or "")
        case["mcp_main_text_length"]=len(norm(candidate))
        evidence=matching_fragments(candidate,raw)
        case["text_match_evidence"]=evidence
        if evidence["sample_size"]>0 and evidence["matched"]>=3:
            case["status"]="passed"
            case["official_text_comparison_passed"]=True
            case["reason"]="main_text_matched_official_html_fragments"
        else:
            case["reason"]="main_text_substantial_comparison_unconfirmed"
    except Exception as e:
        case["reason"]="source_error:"+type(e).__name__
    return case


async def fetch_legal_origin(http, name, article, label):
    # Locate original legislature page and extract versions independently.
    base="https://lis.ly.gov.tw"
    first=await http.get(base+"/lglawc/lglawkm")
    first.raise_for_status()
    soup=BeautifulSoup(first.content,"html.parser")
    form=soup.select_one("form[name=KM]")
    if form is None:
        raise ValueError("official_lis_search_form_missing")
    fields={x.get("name"):x.get("value","") for x in form.select("input[type=hidden]")
            if x.get("name") and not x["name"].startswith("@R")}
    fields.update({"_1_6_T":name, "_IMG_檢索.x":"1","_IMG_檢索.y":"1"})
    action=form.get("action","")
    if not action or not trusted(urljoin(str(first.url),action),OFFICIAL_LIS):
        raise ValueError("official_lis_untrusted_form_action")
    found=await http.post(urljoin(str(first.url),action),data=fields)
    found.raise_for_status()
    links={
        x.get_text(strip=True):urljoin(str(found.url),x.get("href",""))
        for x in BeautifulSoup(found.content,"html.parser").select("a[href*='/lglawc/lawsingle']")
    }
    if name not in links or not trusted(links[name],OFFICIAL_LIS):
        raise LookupError("official_lis_law_title_unavailable")
    landing=await http.get(links[name])
    landing.raise_for_status()
    a=next((x for x in BeautifulSoup(landing.content,"html.parser").select("a[href*='lawsingle']")
            if x.get_text(strip=True)=="法條沿革"),None)
    if a is None:
        raise ValueError("official_lis_history_link_missing")
    full_link=urljoin(str(landing.url),a.get("href",""))
    if not trusted(full_link,OFFICIAL_LIS):
        raise ValueError("official_lis_untrusted_history_link")
    response=await http.get(full_link)
    response.raise_for_status()
    doc=BeautifulSoup(response.content,"html.parser")
    wanted=norm(label)
    versions=[]
    for block in doc.select("td.row0,td.row1"):
        marker=block.select_one("font.artino")
        if marker is None or norm(marker.get_text())!=wanted:
            continue
        for part in block.select("font.upddate,td.artiupd_TH_2,td.artiupd_RS_2"):
            cls=part.get("class",[])
            if part.name=="font":
                m=re.search(r"(\d{7,8})",part.get_text(" ",strip=True))
                if m:
                    versions.append({"date":extract_date(m.group(1)),"text":"","reason":""})
            elif versions and "artiupd_TH_2" in cls:
                versions[-1]["text"]=part.get_text(" ",strip=True)
            elif versions and "artiupd_RS_2" in cls:
                versions[-1]["reason"]=part.get_text(" ",strip=True)
        break
    return versions,full_link


async def legislative_case(session,name,number,label,case_id):
    record={"id":case_id,"category":"legislative","law":name,"article":number,
            "status":"review","official_reasons_independently_verified":False}
    try:
        response=unpack(await asyncio.wait_for(session.call_tool(
            "get_legislative_history",{"law_name":name,"article_no":number}),timeout=100))
        if response.get("success") is not True:
            record["reason"]="mcp_source_unavailable"
            return record
        if norm(response.get("law"))!=norm(name):
            record.update(status="failed",reason="mcp_law_title_mismatch")
            return record
        versions=response.get("versions") or []
        record["mcp_versions_count"]=len(versions)
        if not versions:
            record["reason"]="mcp_versions_missing"
            return record
        ctx=ssl.create_default_context()
        ctx.options |= getattr(ssl,"OP_LEGACY_SERVER_CONNECT",0x4)
        # The official legislature server may negotiate legacy TLS, and
        # its transfer compression has failed in an ordinary HTTPX client.
        async with httpx.AsyncClient(timeout=38,verify=ctx,follow_redirects=True,
                headers={"Accept-Encoding":"identity","User-Agent":"Mozilla/5.0"}) as official:
            originals,url=await asyncio.wait_for(fetch_legal_origin(
                official,name,number,label),timeout=150)
        record["official_history_url"]=url
        record["official_versions_count"]=len(originals)
        if not originals:
            record["reason"]="official_article_versions_unavailable"
            return record
        if len(originals)!=len(versions):
            record["reason"]="version_count_mismatch"
            record["mcp_dates"]=[x.get("date") for x in versions]
            record["official_dates"]=[x.get("date") for x in originals]
            return record
        pairs=[]
        for m,o in zip(versions,originals):
            checks={
                "date_equal":str(m.get("date"))==str(o["date"]),
                "text_equal":norm(m.get("text"))==norm(o["text"]) and bool(norm(o["text"])),
                "reason_equal":norm(m.get("reason"))==norm(o["reason"]) and bool(norm(o["reason"])),
            }
            pairs.append(checks)
        record["version_checks"]=pairs
        if all(all(x.values()) for x in pairs):
            record["status"]="passed"
            record["reason"]="official_legislative_dates_article_text_and_reasons_exact"
            record["official_reasons_independently_verified"]=True
        else:
            record["reason"]="one_or_more_version_fields_not_identical"
    except Exception as e:
        record["reason"]="source_error:"+type(e).__name__
    return record


async def main():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    report={"phase":"v2.7 stage3b / constitutional text and legislative reasons",
            "run_utc":datetime.now(timezone.utc).isoformat(),
            "scope":"only 3 published constitutional cases and 2 statutory articles",
            "stage3_accepted":False,"cases":[]}
    async with httpx.AsyncClient(timeout=35,follow_redirects=True,
            headers={"Accept-Encoding":"identity","User-Agent":"Mozilla/5.0"}) as official:
        async with stdio_client(StdioServerParameters(command=sys.executable,
                args=["-m","mcp_server.server"])) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for i,name in enumerate(CON_CASES,1):
                    entry=await con_case(session,official,name,f"C{i:02d}")
                    report["cases"].append(entry)
                    print(entry["id"],entry["status"],entry.get("reason"),flush=True)
                for i,(name,number,label) in enumerate(LEG_CASES,1):
                    entry=await legislative_case(session,name,number,label,f"L{i:02d}")
                    report["cases"].append(entry)
                    print(entry["id"],entry["status"],entry.get("reason"),flush=True)
    report["counts"]={k:sum(x["status"]==k for x in report["cases"])
                    for k in ("passed","review","failed")}
    report["stage3_accepted"]=False
    report["legal_scope_note"]="5 samples only; court decision withdrawal and original judgment text not verified"
    return report


def selftest():
    assert trusted("https://lis.ly.gov.tw/lglawc/lglawkm",OFFICIAL_LIS)
    assert not trusted("https://lis.ly.gov.tw.evil.invalid/lglawc",OFFICIAL_LIS)
    assert trusted("https://cons.judicial.gov.tw/docdata.aspx?id=123",OFFICIAL_CON)
    assert extract_date("0861002")=="1997-10-02"
    assert extract_date("1080531")=="2019-05-31"
    assert matching_fragments("abcdef"*25,("abcdef"*25))["matched"]>=3
    assert matching_fragments("abcdef"*25,("uvwxyz"*25))["matched"]==0
    print("Stage 3b text-source selftest passed",flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=["selftest","live"],required=True)
    x=p.parse_args()
    if x.mode=="selftest":
        selftest()
    else:
        try:
            output=asyncio.run(main())
        except Exception as e:
            output={"fatal_error":type(e).__name__+":"+str(e)[:320],"stage3_accepted":False}
        REPORT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:output.get(k) for k in ("counts","fatal_error","stage3_accepted")},ensure_ascii=False),flush=True)
        if output.get("fatal_error") or output.get("counts",{}).get("failed",0):
            sys.exit(1)
