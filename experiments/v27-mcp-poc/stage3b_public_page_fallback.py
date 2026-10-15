#!/usr/bin/env python3
"""Stage3b extension: independently compare 2 public judgment texts using
alternative official public URLs; no WAF circumvention and no full text saved.
"""
import argparse
import asyncio
import json
import re
import sys
import unicodedata
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

JIDS=(("J01","TPSM,114,台抗,2605,20251231,1"),
      ("J03","TPSM,114,台抗,2657,20251231,1"))
REPORT=Path("v27-mcp-stage3b-public-route.json")
HOST="judgment.judicial.gov.tw"


def normalize(t):
    return re.sub(r"\s+","",unicodedata.normalize("NFKC",str(t or "")))


def safe_url(url):
    p=urlparse(str(url or ""))
    return p.scheme=="https" and p.hostname==HOST


def compare_source(source,mcp):
    a=normalize(source)
    b=normalize(mcp)
    chunks=[]
    if len(b)<120 or len(a)<120:
        return {"sufficient":False,"exact":False,"contains_complete":False,"fragment_hits":0}
    n=42
    for frac in (0.08,0.25,0.5,0.7,0.9):
        k=int(frac*(len(b)-n))
        chunk=b[k:k+n]
        if chunk not in chunks:chunks.append(chunk)
    return {
        "sufficient":len(a)>=len(b)*0.65,
        "exact":a==b,
        "contains_complete":b in a,
        "fragment_hits":sum(chunk in a for chunk in chunks),
        "fragment_samples":len(chunks),
        "mcp_chars":len(b),
        "official_chars":len(a),
    }


async def run_one(session,http,label,jid):
    doc={"id":label,"public_jid":jid,"status":"review",
         "full_text_independently_verified":False,
         "official_current_publication_unconditionally_verified":False,
         "withdrawal_and_appeals_compliance_verified":False,
         "attempts":[]}
    try:
        reply=unpack(await asyncio.wait_for(session.call_tool("get_judgment",{"jid":jid}),timeout=150))
        if reply.get("success") is not True:
            doc["reason"]="mcp_get_unavailable"
            return doc
        text=reply.get("full_text","")
        if len(normalize(text))<120:
            doc["reason"]="mcp_text_empty"
            return doc
        base="https://judgment.judicial.gov.tw/FJUD/"
        candidates=[
          ("printData",base+"printData.aspx",{"id":jid}),
          ("data",base+"data.aspx",{"ty":"JD","id":jid}),
        ]
        for name,url,params in candidates:
            attempt={"name":name,"check":"review"}
            doc["attempts"].append(attempt)
            try:
                r=await asyncio.wait_for(http.get(url,params=params),timeout=28)
                attempt["http_status"]=r.status_code
                if not safe_url(str(r.url)):
                    attempt.update(check="failed",reason="redirect_non_official")
                    doc.update(status="failed",reason="redirect_non_official")
                    return doc
                if r.status_code!=200:
                    attempt["reason"]="http_"+str(r.status_code)
                    continue
                soup=BeautifulSoup(r.content,"lxml")
                area=soup.select_one("#jud")
                attempt["jud_element_present"]=area is not None
                if area is None:
                    area=soup.select_one("body")
                if area is None:
                    attempt["reason"]="empty_official_body"
                    continue
                content=area.get_text(" ",strip=True)
                if len(normalize(content))<400:
                    attempt["reason"]="no_official_substantial_content"
                    continue
                case_no=jid.split(",")[3]
                if (case_no not in normalize(content)) or ("最高法院" not in normalize(content)):
                    attempt["reason"]="official_case_and_court_not_both_identified"
                    continue
                check=compare_source(content,text)
                attempt.update(check)
                if check["exact"] or check["contains_complete"]:
                    attempt["check"]="passed"
                    attempt["reason"]="mcp_full_text_wholly_present_in_official_source"
                    doc["status"]="passed"
                    doc["full_text_independently_verified"]=True
                    doc["reason"]="official_page_mcp_full_text_consistent"
                    break
                elif check["fragment_hits"]>=4:
                    attempt["reason"]="many_segments_match_but_full_text_not_verbatim"
                    doc["reason"]="independent_text_segments_match_full_comparison_pending"
                else:
                    attempt["reason"]="official_page_has_no_substantial_matching_passages"
                    doc["reason"]="official_full_text_still_unverifiable"
            except Exception as e:
                attempt["reason"]="official_request_exception:"+type(e).__name__
                continue
        if not doc.get("reason"):
            doc["reason"]="both_official_routes_lacked_verifiable_full_text"
    except Exception as e:
        doc["reason"]="mcp_request_exception:"+type(e).__name__
    return doc


async def main():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    out={"phase":"v2.7 stage3b independent alternate official court pages",
         "checked_at_utc":datetime.now(timezone.utc).isoformat(),
         "court_text_saved":False,"cases":[],
         "stage3_accepted":False}
    async with httpx.AsyncClient(timeout=29,follow_redirects=True,
            headers={"User-Agent":"Mozilla/5.0","Accept-Encoding":"identity"}) as http:
        async with stdio_client(StdioServerParameters(command=sys.executable,
            args=["-m","mcp_server.server"])) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=40)
                for label,jid in JIDS:
                    result=await run_one(session,http,label,jid)
                    out["cases"].append(result)
                    print(label,result["status"],result.get("reason"),
                          [(x["name"],x.get("http_status"),x.get("reason")) for x in result["attempts"]],flush=True)
    out["counts"]={status:sum(x["status"]==status for x in out["cases"])
                   for status in ("passed","review","failed")}
    return out


def selftest():
    assert all(safe_url("https://judgment.judicial.gov.tw/FJUD/printData.aspx") for _ in [1])
    assert not safe_url("https://judgment.judicial.gov.tw.evil.test/path")
    sample="臺灣最高法院 " + "測試判決內容" * 40
    assert compare_source(sample,sample)["exact"]
    assert compare_source(sample+"（其他）",sample)["contains_complete"]
    assert not compare_source("BLOCKED",sample)["sufficient"]
    print("Court official-route comparison selftest passed")


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=("selftest","live"),required=True)
    x=p.parse_args()
    if x.mode=="selftest":selftest()
    else:
        try:out=asyncio.run(main())
        except Exception as e:
            out={"fatal_error":type(e).__name__+":"+str(e)[:300],"stage3_accepted":False}
        REPORT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:out.get(k) for k in ("counts","fatal_error","stage3_accepted")},ensure_ascii=False),flush=True)
        if out.get("fatal_error") or out.get("counts",{}).get("failed"):
            sys.exit(1)
