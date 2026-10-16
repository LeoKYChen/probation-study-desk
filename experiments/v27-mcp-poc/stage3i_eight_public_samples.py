#!/usr/bin/env python3
"""Stage 3i: eight ADDITIONAL public court samples, from live search results.

Scope: four small publicly searchable court/type cohorts, at most two validated
cases each. Previously accepted two cases are not retested. No court texts,
party names, legal analysis, snippets, private juvenile judgments or HTML saved
to reports, logs or repository. This is not a court-data API service.
"""
import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from stage1_accuracy import unpack
from stage3h_diff_diagnostics import (
    norm, official_sections, strict_source,
)

PIN="ef677ad63c3206fc211a083fad8b1d9ef5015222"
REPORT=Path("v27-mcp-stage3i-eight-samples.json")
KNOWN={
    "TPSM,114,台抗,2605,20251231,1",
    "TPSM,114,台抗,2657,20251231,1",
}
# Explicit court/type restrictions, ordinary public courts. 115 = 2026.
# No hidden juvenile materials or broad all-court crawling.
COHORTS=(
    ("H-CIV","臺灣高等法院","TPHV","民事","損害賠償"),
    ("D-CIV","臺灣臺北地方法院","TPDV","民事","租賃"),
    ("H-CRM","臺灣高等法院臺中分院","TCHM","刑事","上訴駁回"),
    ("D-CRM","臺灣臺中地方法院","TCDM","刑事","詐欺"),
)
MAX_RESULTS_PER_SEARCH=5
TARGET_PER_COHORT=2
MAX_SEARCHES=4
MAX_OFFICIAL_GET=20
MAX_MCP_GET=8
MAX_BYTES=800_000
_JID=re.compile(r"^[A-Z]{3,6}[VMA],\d{2,3},[^,]{1,15},[0-9A-Za-z-]+,\d{8},\d+$")


def jid_is_eligible(jid,court_code,already):
    if (not isinstance(jid,str) or not _JID.fullmatch(jid) or jid in already
        or jid.startswith("KSY")):
        return False
    parts=jid.split(",")
    return parts[0]==court_code and 113<=int(parts[1])<=114


def official_identity(sections,court,case_word,case_no,roc_year):
    if not sections:return False
    content=norm(sections["body"])
    court=norm(court)
    # Allow orthographic 臺 / 台 variations ONLY for metadata identity,
    # never for text-equivalence acceptance.
    normal=lambda s:s.replace("臺","台")
    return bool(
        len(content)>=350 and normal(court) in normal(content)
        and normal(norm(case_word)) in normal(content)
        and str(case_no) in content and str(roc_year) in content
        and sections["body_has_main_and_reason"]
    )


def text_capture_evidence(body,root,mcp):
    a,b,c=norm(body),norm(root),norm(mcp)
    matches=(len(a)>=350 and a in b and a in c)
    result={
        "official_body_chars":len(a),
        "mcp_text_chars":len(c),
        "official_root_chars":len(b),
        "official_body_contiguous_in_mcp":matches,
        "official_container_exact_match":bool(b and b==c),
        "official_body_exact_match":bool(a and a==c),
        "prefix_extra_chars":max(0,len(c)-len(a)) if matches else None,
    }
    result["capture_passed"]=bool(
        matches and (result["official_container_exact_match"] or
                     result["official_body_exact_match"])
    )
    return result


async def official_get(client,jid):
    url="https://judgment.judicial.gov.tw/FJUD/data.aspx?"+urlencode({"ty":"JD","id":jid})
    assert strict_source(url,jid)
    try:
        async with client.stream("GET",url) as response:
            if response.status_code != 200:
                return None,"official_http_"+str(response.status_code)
            if not strict_source(str(response.url),jid):
                return None,"unexpected_official_redirect"
            fragments=[]
            total=0
            async for block in response.aiter_bytes():
                total+=len(block)
                if total>MAX_BYTES:
                    return None,"official_body_exceeds_max_bytes"
                fragments.append(block)
        return b"".join(fragments),"official_html_retrieved"
    except (httpx.HTTPError,asyncio.TimeoutError) as e:
        return None,"official_unavailable:"+type(e).__name__


async def audited_search(session,court,case_type,keyword):
    # One search/court only. If blocked, mark review. No retry/fallback to WAF tricks.
    try:
        result=unpack(await asyncio.wait_for(session.call_tool(
            "search_judgments",{
                "keyword":keyword,"court":court,"case_type":case_type,
                "year_from":113,"year_to":114,"max_results":MAX_RESULTS_PER_SEARCH
            }),timeout=115))
    except Exception as e:
        return None,"search_unavailable:"+type(e).__name__
    if result.get("success") is not True:
        return None,"search_unavailable_or_restricted"
    items=result.get("results")
    if not isinstance(items,list) or len(items)>MAX_RESULTS_PER_SEARCH:
        return None,"search_result_format_out_of_bounds"
    return items,"search_success"


async def evaluate_one(session,official,jid,court,group):
    """Only a successfully retrieved and identified official source can yield a saved JID."""
    parts=jid.split(",")
    record={
        "status":"review",
        "court":court,
        "type":group["type"],
        "group":group["name"],
        "source_verified":False,
        "text_capture_fidelity":False,
        "current_publication_guaranteed":False,
        "history_complete_verified":False,
        "withdrawal_compliance_verified":False,
        "adult_subject_matter_confirmed":False,
    }
    raw,reason=await asyncio.wait_for(official_get(official,jid),timeout=32)
    if raw is None:
        record["reason"]=reason
        return record
    sections,reason=official_sections(raw)
    if sections is None:
        record["reason"]=reason
        return record
    if not official_identity(sections,court,parts[2],parts[3],parts[1]):
        record["reason"]="official_body_court_and_case_identity_not_confirmed"
        return record
    record["source_verified"]=True
    record["public_jid"]=jid
    record["official_url"]="https://judgment.judicial.gov.tw/FJUD/data.aspx?"+urlencode({"ty":"JD","id":jid})
    record["official_body_selector"]=sections["body_selector"]
    record["official_metadata_rows"]=sections["metadata_rows"]
    try:
        result=unpack(await asyncio.wait_for(session.call_tool(
            "get_judgment",{"jid":jid}),timeout=130))
    except Exception as e:
        record["reason"]="mcp_get_unavailable:"+type(e).__name__
        return record
    if result.get("success") is not True:
        record["reason"]="mcp_get_unavailable"
        return record
    if not strict_source(result.get("source_url"),jid):
        record["status"]="failed"
        record["reason"]="mcp_wrong_or_nonofficial_source_url"
        return record
    evidence=text_capture_evidence(sections["body"],sections["root"],result.get("full_text",""))
    record.update(evidence)
    record["text_capture_fidelity"]=evidence["capture_passed"]
    if not evidence["capture_passed"]:
        record["reason"]="mcp_body_missing_or_container_mismatch"
        return record
    record["status"]="passed"
    record["reason"]="official_dom_body_and_mcp_text_fidelity_verified_only"
    return record


async def main():
    result={
        "phase":"v2.7 Stage 3i / 8 new public source samples",
        "checked_utc":datetime.now(timezone.utc).isoformat(),
        "upstream_revision":PIN,
        "known_prior_passed":2,
        "new_target":8,
        "max_searches":MAX_SEARCHES,
        "max_direct_official_get":MAX_OFFICIAL_GET,
        "max_mcp_get":MAX_MCP_GET,
        "no_private_juvenile_court_queries":True,
        "no_real_judgment_text_saved":True,
        "authenticated_api_used":False,
        "public_case_links_approved":False,
        "stage3_accepted":False,
        "cohorts":[],
        "cases":[],
    }
    seen=set(KNOWN)
    total_official=0
    total_mcp=0
    async with httpx.AsyncClient(timeout=httpx.Timeout(25,connect=10),
        follow_redirects=False, headers={"User-Agent":"v27-small-source-audit/1",
                                         "Accept-Encoding":"identity"}) as http:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"])) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for name,court,code,kind,keyword in COHORTS:
                    info={"name":name,"court":court,"case_type":kind,
                          "search_status":"review","eligible_returned":0,
                          "official_checks":0,"verified_count":0}
                    items,why=await audited_search(session,court,kind,keyword)
                    if items is None:
                        info["reason"]=why
                        result["cohorts"].append(info)
                        print(name,"search review",why,flush=True)
                        continue
                    info["search_status"]="passed"
                    eligible=[]
                    for item in items:
                        jid=item.get("jid") if isinstance(item,dict) else None
                        if jid_is_eligible(jid,code,seen):
                            eligible.append(jid)
                    info["eligible_returned"]=len(eligible)
                    group={"type":kind,"name":name}
                    for jid in eligible:
                        if info["verified_count"]>=TARGET_PER_COHORT:
                            break
                        if total_official>=MAX_OFFICIAL_GET or total_mcp>=MAX_MCP_GET:
                            info["reason"]="bounded_request_budget_reached"
                            break
                        seen.add(jid)
                        total_official+=1
                        info["official_checks"]+=1
                        # Count MCP calls only when official candidate verified;
                        # the helper performs at most one per official-success row.
                        row=await evaluate_one(session,http,jid,court,group)
                        if row.get("source_verified"):
                            total_mcp+=1
                            result["cases"].append(row)
                            info["verified_count"]+=1
                        print(name,"official check",row["status"],row.get("reason"),
                              "identified",row.get("source_verified"),
                              "fidelity",row.get("text_capture_fidelity"),flush=True)
                        await asyncio.sleep(1)
                    result["cohorts"].append(info)
                result["official_get_requests"]=total_official
                result["mcp_get_requests"]=total_mcp
    result["new_identified"]=len(result["cases"])
    result["new_fidelity_passed"]=sum(r["text_capture_fidelity"] for r in result["cases"])
    result["new_review"]=sum(r["status"]=="review" for r in result["cases"])
    result["new_failed"]=sum(r["status"]=="failed" for r in result["cases"])
    result["total_fidelity_passed_including_prior_two"]=2+result["new_fidelity_passed"]
    result["source_sampling_10_complete"]=(result["new_fidelity_passed"]==8)
    result["stage3_accepted"]=False
    result["note"]="Source/text subtest only; case finality, adult-subject-matter review, live publication and withdrawal remain unverified."
    return result


def selftest():
    assert len(COHORTS)==4
    assert all(kind in ("民事","刑事") for _,_,_,kind,_ in COHORTS)
    assert all("少年" not in court+keyword for _,court,_,_,keyword in COHORTS)
    good="TPHV,114,上字,507,20250617,1"
    assert jid_is_eligible(good,"TPHV",set())
    assert not jid_is_eligible(good,"TCDM",set())
    assert not jid_is_eligible(good,"TPHV",{good})
    assert not jid_is_eligible("KSYM,114,少護,1,20250617,1","KSYM",set())
    assert not jid_is_eligible("TPHV,115,上字,1,20260101,1","TPHV",set())
    assert not jid_is_eligible("TPSM,114,台抗,2605,20251231,1","TPSM",KNOWN)
    body="臺灣高等法院民事判決114年度上字第507號主文理由"+"合成"*450
    sections={"body":body,"root":"合成裁判字號："+body,
              "body_has_main_and_reason":True}
    assert official_identity(sections,"臺灣高等法院","上字","507","114")
    assert not official_identity(sections,"臺灣臺北地方法院","上字","507","114")
    ok=text_capture_evidence(body,sections["root"],sections["root"])
    assert ok["capture_passed"]
    bad=text_capture_evidence(body,sections["root"],body.replace("理由","偽造",1))
    assert not bad["capture_passed"]
    assert "合成" not in json.dumps(ok)
    print("Stage 3i source-discovery safety and text fidelity selftest passed",flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",required=True,choices=("selftest","live"))
    args=p.parse_args()
    if args.mode=="selftest":
        selftest()
    else:
        try:
            report=asyncio.run(main())
        except Exception as e:
            report={"fatal_error":type(e).__name__,"stage3_accepted":False,
                    "no_real_judgment_text_saved":True}
        REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",
                          encoding="utf-8")
        print(json.dumps({x:report.get(x) for x in
              ("new_identified","new_fidelity_passed","new_review","new_failed",
               "total_fidelity_passed_including_prior_two",
               "source_sampling_10_complete","stage3_accepted","fatal_error")},
               ensure_ascii=False),flush=True)
        if report.get("fatal_error") or report.get("new_failed",0)>0:
            sys.exit(1)
