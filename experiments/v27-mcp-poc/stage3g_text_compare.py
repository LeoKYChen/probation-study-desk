#!/usr/bin/env python3
"""Two previously observed public adult rulings: official vs pinned MCP.

No court text, party names, HTML, PDFs or judgment summaries are saved/logged.
This is a bounded POC, not authorization for mass or unattended scraping.
"""
import argparse
import asyncio
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

REPORT=Path("v27-mcp-stage3g-text-comparison.json")
SAMPLES=(("J01","TPSM,114,台抗,2605,20251231,1","2605"),
         ("J03","TPSM,114,台抗,2657,20251231,1","2657"))
PIN="ef677ad63c3206fc211a083fad8b1d9ef5015222"

def norm(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC",str(value or "")))

def extract_body(html):
    root=BeautifulSoup(html,"html.parser").select_one("#jud")
    if root is None:return ""
    for selector in (".htmlcontent",".text-pre",".jud_content"):
        child=root.select_one(selector)
        if child is not None and len(norm(child.get_text(" ",strip=True)))>=100:
            return child.get_text(" ",strip=True)
    return root.get_text(" ",strip=True)

def compare(mcp,official):
    a,b=norm(mcp),norm(official)
    evidence={"mcp_length":len(a),"official_length":len(b),
              "exact_normalized":False,"complete_containment":False,
              "fragment_matches":0,"fragment_samples":0,
              "status":"review"}
    if min(len(a),len(b))<500:
        evidence["reason"]="one_text_too_short"
        return evidence
    evidence["exact_normalized"]=a==b
    evidence["complete_containment"]=(a in b or b in a) and (
        min(len(a),len(b))/max(len(a),len(b))>=0.99)
    chunks=[]
    length=min(75,max(50,len(a)//12))
    for frac in (0.03,0.11,0.23,0.36,0.48,0.60,0.72,0.84,0.94):
        i=int((len(a)-length)*frac)
        value=a[i:i+length]
        if value not in chunks:chunks.append(value)
    evidence["fragment_samples"]=len(chunks)
    evidence["fragment_matches"]=sum(x in b for x in chunks)
    if evidence["exact_normalized"] or evidence["complete_containment"]:
        evidence["status"]="passed"
        evidence["reason"]="full_text_normalized_exact_or_nearly_contained"
    elif evidence["fragment_matches"]>=7:
        evidence["reason"]="large_excerpt_overlap_but_not_exact_full_text"
    else:
        evidence["reason"]="text_requires_manual_canonicalization_review"
    return evidence

async def official_get(client,jid,case_no):
    url="https://judgment.judicial.gov.tw/FJUD/data.aspx?"
    url+=urlencode({"ty":"JD","id":jid})
    async with client.stream("GET",url) as res:
        if res.status_code!=200 or urlparse(str(res.url)).hostname!="judgment.judicial.gov.tw":
            return False,"official_http_not_substantive",""
        body=bytearray()
        async for chunk in res.aiter_bytes():
            if len(body)+len(chunk)>750000:
                return False,"official_response_too_large",""
            body.extend(chunk)
    text=extract_body(bytes(body))
    normalized=norm(text)
    good=(len(normalized)>=1000 and "最高法院" in normalized and
          "114" in normalized and "台抗" in normalized and case_no in normalized)
    return good,("official_case_body_substantial" if good else
                 "official_case_body_not_validated"),text if good else ""

async def audit():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    report={"phase":"v2.7 stage3g two-public-judgment independent text check",
            "checked_at_utc":datetime.now(timezone.utc).isoformat(),
            "pinned_upstream":PIN,"samples":2,"cases":[],
            "court_bodies_saved":False,"official_authenticated_api_called":False,
            "current_publication_guaranteed":False,
            "public_case_links_approved":False,"stage3_accepted":False}
    async with httpx.AsyncClient(timeout=30,follow_redirects=False,
        headers={"User-Agent":"v27-independent-readonly-probe/1",
                 "Accept-Encoding":"identity"}) as official:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"])) as (read,write):
            async with ClientSession(read,write) as session:
                await asyncio.wait_for(session.initialize(),timeout=50)
                for label,jid,number in SAMPLES:
                    case={"id":label,"status":"review","real_body_saved":False}
                    try:
                        good,reason,body=await asyncio.wait_for(
                            official_get(official,jid,number),timeout=45)
                        case["official_body_confirmed"]=good
                        if not good:
                            case["reason"]=reason
                        else:
                            parsed=unpack(await asyncio.wait_for(
                                session.call_tool("get_judgment",{"jid":jid}),
                                timeout=140))
                            case["mcp_success"]=parsed.get("success") is True
                            if not case["mcp_success"]:
                                case["reason"]="mcp_get_failed"
                            elif urlparse(str(parsed.get("source_url",""))).hostname != "judgment.judicial.gov.tw":
                                case["status"]="failed"
                                case["reason"]="nonofficial_mcp_source"
                            else:
                                verdict=compare(parsed.get("full_text"),body)
                                case.update(verdict)
                    except Exception as exc:
                        case["reason"]="retrieval_or_comparison_exception:"+type(exc).__name__
                    report["cases"].append(case)
                    print(label,case["status"],case.get("reason"),
                          case.get("fragment_matches"),case.get("fragment_samples"),flush=True)
                    await asyncio.sleep(1)
    report["counts"]={s:sum(x["status"]==s for x in report["cases"])
                      for s in ("passed","review","failed")}
    report["note"]=("Text overlap or equality is not a guarantee of present-day publication "
                    "or case finality. Upstream MCP connection methods require separate review.")
    return report

def selftest():
    txt="最高法院刑事裁定114年度台抗字第2605號主文理由"*42
    assert norm("法\n條")=="法條"
    assert "最高法院" in extract_body(("<div id='jud'><div class='text-pre'>"+txt+
                                      "</div></div>").encode())
    assert compare(txt,txt)["status"]=="passed"
    assert compare(txt,txt[:500])["status"]=="review"
    assert compare(txt,txt+"增補文字"*50)["status"]=="review"
    assert compare("ABC","XYZ")["status"]=="review"
    print("Stage3g offline text-comparison fixtures passed")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=["selftest","live"],required=True)
    x=p.parse_args()
    if x.mode=="selftest":
        selftest()
    else:
        try:result=asyncio.run(audit())
        except Exception as exc:
            result={"fatal_error":type(exc).__name__,"stage3_accepted":False}
        REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"counts":result.get("counts"),"stage3_accepted":result["stage3_accepted"],
                          "fatal_error":result.get("fatal_error")},ensure_ascii=False),flush=True)
        if result.get("fatal_error") or result.get("counts",{}).get("failed",0):
            sys.exit(1)
