#!/usr/bin/env python3
"""Stage3b targeted public judgment validation; two stage3a-grounded JIDs only.

Never persist party names, main text, case facts, decision text, or summaries.
"""
import argparse
import asyncio
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

REPORT=Path("v27-mcp-stage3b-judgments.json")
CASES=(
    ("J01","TPSM,114,台抗,2605,20251231,1"),
    ("J03","TPSM,114,台抗,2657,20251231,1"),
)
HOST="judgment.judicial.gov.tw"


def clean(text):
    return re.sub(r"\s+","",unicodedata.normalize("NFKC",str(text or "")))


def trusted(url):
    p=urlparse(str(url or ""))
    return p.scheme=="https" and p.hostname==HOST


def valid_jid(jid):
    return bool(re.fullmatch(r"[A-Z]{2,6},\d+,[^,]+,[0-9A-Za-z\-]+,\d{8},\d+",str(jid or "")))


def check_history(doc):
    histories=doc.get("history")
    note=doc.get("history_note")
    if doc.get("history_error"):
        return "review","history_source_error"
    if not isinstance(histories,list):
        return "review","history_not_provided"
    for item in histories:
        if not isinstance(item,dict):
            return "failed","history_item_format_invalid"
        url=item.get("url","")
        if url and not trusted(url):
            return "failed","history_source_non_official"
        j=item.get("jid","")
        if j and not valid_jid(j):
            return "failed","history_jid_invalid"
        if not isinstance(item.get("pending_supreme_court"),bool):
            return "review","history_pending_flag_missing"
    if not note:
        return "review","history_note_absent"
    return "passed","history_list_parsed_not_proof_of_finality"


async def run_one(session,http,index,jid):
    item={"id":index, "category":"public_judgment",
          "public_jid":jid, "status":"review",
          "original_text_verified":False,
          "judgment_currently_public_confirmed":False,
          "withdrawal_mechanism_verified":False,
          "history_is_finality_proof":False}
    start=time.monotonic()
    try:
        res=await asyncio.wait_for(session.call_tool("get_judgment",{"jid":jid}),timeout=145)
        mcp=unpack(res)
        item["mcp_success"]=mcp.get("success") is True
        if not item["mcp_success"]:
            item["reason"]="mcp_unavailable:"+str(mcp.get("error",""))[:160]
            return item
        official=mcp.get("source_url","")
        item["mcp_source_url"]=official
        if not trusted(official):
            item.update(status="failed",reason="source_host_not_official")
            return item
        if not clean(mcp.get("full_text")) or len(clean(mcp["full_text"]))<120:
            item["reason"]="mcp_missing_substantial_full_text"
            return item
        item["mcp_text_chars"]=len(clean(mcp["full_text"]))
        item["court_label_present"]=bool(clean(mcp.get("court")))
        item["date_label_present"]=bool(clean(mcp.get("date")))
        hstatus,why=check_history(mcp)
        item["history_check"]=hstatus
        item["history_note"]=why
        if hstatus=="failed":
            item.update(status="failed",reason=why)
            return item
        path="https://judgment.judicial.gov.tw/FJUD/data.aspx"
        try:
            resp=await asyncio.wait_for(http.get(path,params={"ty":"JD","id":jid}),timeout=40)
        except (httpx.HTTPError,asyncio.TimeoutError) as e:
            item["reason"]="independent_official_http_unavailable:"+type(e).__name__
            return item
        if not trusted(str(resp.url)):
            item.update(status="failed",reason="official_redirect_wrong_host")
            return item
        item["official_http_status"]=resp.status_code
        if resp.status_code!=200:
            item["reason"]="official_http_"+str(resp.status_code)
            return item
        soup=BeautifulSoup(resp.content,"lxml")
        official_text=soup.select_one("#jud")
        if official_text is None:
            item["reason"]="official_html_missing_judgment"
            return item
        direct=clean(official_text.get_text())
        derived=clean(mcp["full_text"])
        item["official_text_chars"]=len(direct)
        item["official_text_exact_match"]=bool(direct and derived==direct)
        item["official_text_contained"]=bool(direct and
            (derived in direct or direct in derived))
        item["judgment_currently_public_confirmed"]=len(direct)>=120
        item["original_text_verified"]=item["official_text_exact_match"]
        if not item["judgment_currently_public_confirmed"]:
            item["reason"]="official_judgment_empty_or_removed"
        elif not item["official_text_exact_match"]:
            item["reason"]="judgment_fulltext_exact_comparison_mismatch"
        elif hstatus!="passed":
            item["reason"]="independent_official_text_matches_but_history_needs_review"
        else:
            item["status"]="passed"
            item["reason"]="public_official_judgment_text_exact_and_history_structurally_checked"
    except Exception as e:
        item["reason"]="mcp_exception:"+type(e).__name__
    finally:
        item["elapsed_s"]=round(time.monotonic()-start,2)
    return item


async def run_search(session):
    # Fixed public judgment from stage 3a, no broad keyword search.
    item={"id":"JX01","category":"exact_judgment_lookup",
          "target_public_jid":CASES[0][1],"status":"review"}
    try:
        data=unpack(await asyncio.wait_for(session.call_tool("search_judgments",{
            "court":"最高法院","case_type":"刑事","year_from":114,"year_to":114,
            "case_word":"台抗","case_number":"2605","max_results":10,
        }),timeout=110))
        if data.get("success") is not True:
            item["reason"]="exact_search_site_unavailable"
            return item
        matches=data.get("results") or []
        item["total_returned"]=len(matches)
        invalid=[x for x in matches if not valid_jid(x.get("jid",""))]
        if invalid:
            item.update(status="failed",reason="invalid_jid_emitted")
        elif any(x.get("jid")==CASES[0][1] for x in matches):
            item.update(status="passed",reason="exact_public_jid_retrieved")
        else:
            item["reason"]="exact_search_did_not_return_previously_observed_jid"
    except Exception as e:
        item["reason"]="exact_search_exception:"+type(e).__name__
    return item


async def main():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    report={"phase":"stage3b public judgment exact follow-up",
            "created_utc":datetime.now(timezone.utc).isoformat(),
            "source_fixture":"stage3a report, GitHub run 38729085101",
            "no_judgment_text_saved":True,"non_public_juvenile_records_requested":False,
            "public_deployment_allowed":False,"stage3_accepted":False,"cases":[]}
    async with stdio_client(StdioServerParameters(command=sys.executable,
        args=["-m","mcp_server.server"])) as (rd,wr):
        async with ClientSession(rd,wr) as session:
            await asyncio.wait_for(session.initialize(),timeout=45)
            async with httpx.AsyncClient(timeout=40,follow_redirects=True,
                headers={"Accept-Encoding":"identity","User-Agent":"Mozilla/5.0"}) as official:
                for name,jid in CASES:
                    entry=await run_one(session,official,name,jid)
                    report["cases"].append(entry)
                    print(name,entry["status"],entry.get("reason"),flush=True)
                item=await run_search(session)
                report["cases"].append(item)
                print("JX01",item["status"],item.get("reason"),flush=True)
    report["counts"]={k:sum(c["status"]==k for c in report["cases"])
                      for k in ("passed","review","failed")}
    report["stage3_accepted"]=False
    report["reminder"]="Substantive finality, withdrawal handling and 10 documented cases still unverified"
    return report


def selftest():
    assert all(valid_jid(j) for _,j in CASES)
    assert not valid_jid("TEST_JID_SYNTHETIC")
    assert trusted("https://judgment.judicial.gov.tw/FJUD/data.aspx")
    assert not trusted("https://judgment.judicial.gov.tw.evil.invalid")
    assert check_history({"history":[{"url":"","jid":"","pending_supreme_court":False}],
                          "history_note":"not finality proof"})[0]=="passed"
    assert check_history({"history":[{"url":"https://evil.invalid","pending_supreme_court":False}],
                          "history_note":"x"})[0]=="failed"
    print("Stage3b judgment security and history sanity tests passed",flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=["selftest","live"],required=True)
    a=p.parse_args()
    if a.mode=="selftest":
        selftest()
    else:
        try: out=asyncio.run(main())
        except Exception as e:
            out={"fatal_error":type(e).__name__+":"+str(e)[:300],"stage3_accepted":False}
        REPORT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({x:out.get(x) for x in ("counts","fatal_error","stage3_accepted")},ensure_ascii=False),flush=True)
        if out.get("fatal_error") or out.get("counts",{}).get("failed",0):
            sys.exit(1)
