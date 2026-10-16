#!/usr/bin/env python3
"""Independent official history-list audit for ten previously checked public decisions.

Does not recheck verdict text. No case bodies, persons, history descriptions
or linked case content are persisted. A matching list DOES NOT prove finality,
exhaustiveness, or future publication status.
"""
import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urljoin, urlencode, parse_qs

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack
from stage3h_diff_diagnostics import strict_source, norm

CASES=(
    ("J01","TPSM,114,台抗,2605,20251231,1"),
    ("J03","TPSM,114,台抗,2657,20251231,1"),
    ("H-CIV-1","TPHV,114,上易,1030,20251231,2"),
    ("H-CIV-2","TPHV,114,再易,110,20251231,1"),
    ("D-CIV-1","TPDV,114,司票,26166,20251231,2"),
    ("D-CIV-2","TPDV,114,重訴,238,20251231,1"),
    ("H-CRM-1","TCHM,114,上易,801,20251231,2"),
    ("H-CRM-2","TCHM,114,金上訴,2749,20251231,2"),
    ("D-CRM-1","TCDM,114,金訴,2374,20251231,2"),
    ("D-CRM-2","TCDM,114,聲,4461,20251231,1"),
)
PIN="ef677ad63c3206fc211a083fad8b1d9ef5015222"
HOST="judgment.judicial.gov.tw"
HISTORY_BASE="https://judgment.judicial.gov.tw/controls/GetJudHistory.ashx?jid="
KEY_RE=re.compile(r"GetJudHistory\.ashx\?jid=([0-9A-Za-z%.,_-]+)")
JID_RE=re.compile(r"^[A-Z]{2,6},\d{2,3},[^,]{1,20},[^,]{1,20},\d{8},\d+$")
OUTPUT=Path("v27-mcp-stage3j-history-list-audit.json")
MAX_HTML=800_000
MAX_JSON=150_000
MAX_HISTORY_ENTRIES=70

def is_official(url):
    p=urlparse(str(url or ""))
    return bool(p.scheme=="https" and p.hostname==HOST and not p.username
                and not p.password and not p.port and not p.fragment)

def history_key(html):
    match=KEY_RE.search(html.decode("utf-8","replace"))
    key=match.group(1) if match else ""
    if not 4<=len(key)<=120 or any(x in key.lower() for x in ("%0a","%0d","%2f","%5c")):
        return None
    return key

def href_info(href):
    if not href:
        return {"safe":True,"jid":"","url":""}
    if not isinstance(href,str) or href.startswith(("http:","https:","/","\\","#")) or ".." in href:
        return {"safe":False}
    full=urljoin("https://judgment.judicial.gov.tw/FJUD/",href)
    p=urlparse(full)
    vals=parse_qs(p.query).get("id",[])
    if (not is_official(full) or p.path.lower() not in
        ("/fjud/data.aspx","/fjud/printdata.aspx")
        or len(vals)!=1 or not JID_RE.fullmatch(vals[0])):
        return {"safe":False}
    return {"safe":True,"jid":vals[0],"url":full}

def official_rows(data):
    if not isinstance(data,dict) or not isinstance(data.get("list"),list):
        return None,"history_json_missing_list"
    if len(data["list"])>MAX_HISTORY_ENTRIES:
        return None,"history_list_too_large"
    results=[]
    for item in data["list"]:
        if not isinstance(item,dict):
            return None,"history_item_not_object"
        h=href_info(item.get("href"))
        if not h["safe"]:
            return None,"history_link_unsafe"
        if item.get("red") not in (0,1,None):
            return None,"history_pending_flag_invalid"
        results.append({
            "jid":h["jid"],"url":h["url"],
            "desc":norm(item.get("desc","")),
            "pending":item.get("red")==1,
            "has_link":bool(h["url"]),
        })
    return results,"official_history_list_read"

def compare_rows(official,mcp):
    stats={"official_entries":len(official),"mcp_entries":len(mcp),
           "matching_ids":0,"matching_urls":0,
           "matching_descriptions":0,"matching_pending_flags":0,
           "contains_pending_marker":any(x["pending"] for x in official),
           "official_list_empty":len(official)==0,
           "official_list_contains_unlinked_items":sum(not x["has_link"] for x in official),
           "lists_match":False,"appeal_finality_proven":False,
           "all_appeals_exhaustively_found":False}
    if len(official)!=len(mcp):
        return stats,"history_list_count_mismatch"
    for a,b in zip(official,mcp):
        if not isinstance(b,dict):
            return stats,"mcp_history_item_invalid"
        stats["matching_ids"]+=int(str(b.get("jid",""))==a["jid"])
        stats["matching_urls"]+=int(str(b.get("url",""))==a["url"])
        stats["matching_descriptions"]+=int(norm(b.get("desc",""))==a["desc"])
        stats["matching_pending_flags"]+=int(b.get("pending_supreme_court") is a["pending"])
    stats["lists_match"]=all(stats[name]==len(official) for name in
        ("matching_ids","matching_urls","matching_descriptions","matching_pending_flags"))
    return stats,("mcp_matches_independent_official_history_list"
                  if stats["lists_match"] else "history_fields_disagree")

async def bounded_get(client,url,limit,allow):
    if not allow(url):
        return None,"origin_or_identifier_invalid"
    try:
        async with client.stream("GET",url) as r:
            if not allow(str(r.url)):
                return None,"unapproved_redirect"
            if r.status_code!=200:
                return None,"official_http_"+str(r.status_code)
            result=bytearray()
            async for chunk in r.aiter_bytes():
                if len(result)+len(chunk)>limit:
                    return None,"official_source_too_large"
                result.extend(chunk)
            return bytes(result),"ok"
    except (httpx.HTTPError,asyncio.TimeoutError) as exc:
        return None,"official_unavailable:"+type(exc).__name__

async def one_case(label,jid,http,session):
    row={"id":label,"public_jid":jid,"status":"review",
         "official_history_checked":False,"mcp_history_checked":False,
         "history_list_fidelity_verified":False,
         "linked_decisions_independently_opened":False,
         "history_finality_confirmed":False,
         "history_exhaustive_confirmed":False,
         "currently_public_at_click_confirmed":False,
         "full_text_rechecked":False,"full_text_saved":False}
    url="https://judgment.judicial.gov.tw/FJUD/data.aspx?"+urlencode({"ty":"JD","id":jid})
    raw,reason=await bounded_get(http,url,MAX_HTML,lambda x:strict_source(x,jid))
    if raw is None:
        row["reason"]=reason
        return row
    jud=BeautifulSoup(raw,"lxml").select_one("#jud")
    if jud is None or len(norm(jud.get_text(" ",strip=True)))<300:
        row["reason"]="official_case_document_not_found"
        return row
    key=history_key(raw)
    if not key:
        row["reason"]="official_history_key_absent"
        return row
    history_url=HISTORY_BASE+key
    def official_history_origin(u):
        p=urlparse(u)
        return bool(is_official(u) and p.path=="/controls/GetJudHistory.ashx"
                    and parse_qs(p.query).get("jid")==[key]
                    and set(parse_qs(p.query))=={"jid"})
    raw,reason=await bounded_get(http,history_url,MAX_JSON,official_history_origin)
    if raw is None:
        row["reason"]=reason
        return row
    try:
        data=json.loads(raw.decode("utf-8-sig"))
    except (UnicodeError,ValueError):
        row["reason"]="official_history_invalid_json"
        return row
    hist,reason=official_rows(data)
    if hist is None:
        row["reason"]=reason
        return row
    row["official_history_checked"]=True
    row["official_history_count"]=len(hist)
    try:
        obj=unpack(await asyncio.wait_for(session.call_tool("get_judgment",
                     {"jid":jid}),timeout=120))
    except Exception as exc:
        row["reason"]="mcp_history_unavailable:"+type(exc).__name__
        return row
    if obj.get("success") is not True:
        row["reason"]="mcp_get_failed"
        return row
    row["mcp_history_checked"]=True
    row["mcp_cached"]=obj.get("cached") is True
    if obj.get("history_error"):
        row["reason"]="mcp_history_source_error"
        return row
    items=obj.get("history")
    if not isinstance(items,list):
        row["reason"]="mcp_history_missing"
        return row
    row["has_warning_history_not_finality"]=(
        isinstance(obj.get("history_note"),str) and
        "不等於已經確定" in obj["history_note"])
    comparison,reason=compare_rows(hist,items)
    row.update(comparison)
    if comparison["lists_match"] and row["has_warning_history_not_finality"]:
        row["status"]="passed"
        row["history_list_fidelity_verified"]=True
        row["reason"]="official_and_mcp_history_list_consistent"
    else:
        row["reason"]=reason if not comparison["lists_match"] else "history_finality_caveat_missing"
    return row

async def live():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    out={"phase":"v2.7 stage3j ten public court official history-list comparisons",
         "checked_utc":datetime.now(timezone.utc).isoformat(),
         "upstream_revision":PIN,"count":len(CASES),
         "max_official_case_get":10,"max_official_history_get":10,
         "max_mcp_get":10,"no_judgment_text_saved":True,
         "no_history_descriptions_saved":True,
         "no_linked_court_documents_downloaded":True,
         "no_authenticated_api_used":True,
         "stage3_accepted":False,"cases":[]}
    async with httpx.AsyncClient(timeout=httpx.Timeout(28,connect=10),
        follow_redirects=False,headers={"User-Agent":"v27-judicial-history-list-audit/1",
                                        "Accept-Encoding":"identity"}) as http:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"])) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for label,jid in CASES:
                    row=await one_case(label,jid,http,session)
                    out["cases"].append(row)
                    print(label,row["status"],row.get("reason"),
                          "official_count",row.get("official_history_count"),
                          "same_list",row.get("lists_match"),flush=True)
                    await asyncio.sleep(1)
    out["counts"]={k:sum(r["status"]==k for r in out["cases"])
                   for k in ("passed","review","failed")}
    out["independent_official_history_available"]=sum(r["official_history_checked"]
                                                       for r in out["cases"])
    out["matched_official_history_list_count"]=sum(r["history_list_fidelity_verified"]
                                                   for r in out["cases"])
    out["history_finality_accepted"]=False
    out["stage3_accepted"]=False
    return out

def selftest():
    assert len(CASES)==10 and len({id for _,id in CASES})==10
    assert history_key(b"<script>GetJudHistory.ashx?jid=ABCDE12345</script>")=="ABCDE12345"
    assert history_key(b"<script>no_history_here</script>") is None
    assert history_key(b"GetJudHistory.ashx?jid=%2fetc") is None
    data={"list":[{"desc":"民事第二審",
                   "href":"data.aspx?ty=JD&id=TPHV,114,上易,1030,20251231,2",
                   "red":0}]}
    rows,reason=official_rows(data)
    assert rows and reason=="official_history_list_read"
    mcp=[{"desc":"民事第二審","jid":rows[0]["jid"],"url":rows[0]["url"],
          "pending_supreme_court":False}]
    assert compare_rows(rows,mcp)[0]["lists_match"]
    assert not compare_rows(rows,[{**mcp[0],"pending_supreme_court":True}])[0]["lists_match"]
    assert compare_rows([],[])[0]["official_list_empty"]
    assert not compare_rows([],[])[0]["appeal_finality_proven"]
    bad,why=official_rows({"list":[{"href":"https://evil.test/out","desc":"X"}]})
    assert bad is None and why=="history_link_unsafe"
    assert not is_official("https://judgment.judicial.gov.tw.evil.test/")
    print("Stage3j history-list parsing, source trust and no-finality selftest passed",flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=("selftest","live"),required=True)
    a=p.parse_args()
    if a.mode=="selftest":
        selftest()
    else:
        try:report=asyncio.run(live())
        except Exception as exc:
            report={"fatal_error":type(exc).__name__,"stage3_accepted":False}
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:report.get(k) for k in
            ("counts","independent_official_history_available",
             "matched_official_history_list_count","history_finality_accepted",
             "stage3_accepted","fatal_error")},ensure_ascii=False),flush=True)
        if report.get("fatal_error") or report.get("counts",{}).get("failed",0):
            sys.exit(1)
