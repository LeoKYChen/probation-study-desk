#!/usr/bin/env python3
"""Stage3l targeted LONG public-civil-judgment check; one-pass, no PDF fetch.

Two court/year/case-word-specific searches; max 8 direct official pages and
only up to 2 pinned MCP get_judgment calls, exclusively when an independently
confirmed HTML body >= 10,000 normalized characters is present.
No body/party/JID/URLs are output to report; existing accepted 10 excluded.
"""
import argparse
import asyncio
import json
import logging
from datetime import datetime,timezone
from pathlib import Path

import httpx
from stage1_accuracy import unpack
from stage3h_diff_diagnostics import strict_source,official_sections
from stage3i_eight_public_samples import official_get,text_capture_evidence
from stage3l_format_diversity import (
    PIN,KNOWN_TEN,LONG_BODY_CHARS,eligible,shape_of,source_identity
)

# Do not echo real court query URLs/JIDs through this script's httpx logger.
logging.getLogger("httpx").setLevel(logging.WARNING)

OUTPUT=Path("v27-mcp-stage3l-long-form-targeted.json")
COHORTS=(
    ("LONG-D113","臺灣臺北地方法院","TPDV","民事",113,"重訴","損害賠償"),
    ("LONG-H113","臺灣高等法院","TPHV","民事",113,"重上","不當得利"),
)
MAX_SEARCHES=2
MAX_RESULTS_PER_SEARCH=8
MAX_DIRECT_GET=8
MAX_MCP_GET=2
MAX_CANDIDATES_PER_COHORT=4
MAX_BYTES=800_000

async def search(session,cohort):
    label,court,code,kind,year,caseword,keyword=cohort
    try:
        value=unpack(await asyncio.wait_for(session.call_tool(
            "search_judgments",{
                "court":court,"case_type":kind,"year_from":year,"year_to":year,
                "case_word":caseword,"keyword":keyword,
                "max_results":MAX_RESULTS_PER_SEARCH,
            }),timeout=115))
    except Exception as exc:
        return None,"search_unavailable:"+type(exc).__name__
    if value.get("success") is not True:
        return None,"source_search_not_available"
    results=value.get("results")
    if not isinstance(results,list) or len(results)>MAX_RESULTS_PER_SEARCH:
        return None,"source_search_result_limit_or_shape_invalid"
    return results,"search_succeeded"

async def audit():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    out={
        "phase":"v2.7 stage3l long-case targeted gap",
        "utc":datetime.now(timezone.utc).isoformat(),
        "upstream_revision":PIN,
        "max_searches":MAX_SEARCHES,"max_official_get":MAX_DIRECT_GET,
        "max_mcp_get":MAX_MCP_GET,
        "searches":0,"official_get":0,"mcp_get":0,
        "groups":[],
        "long_text_fidelity_passed":0,
        "live_pdf_text_verified":False,
        "no_real_judgment_text_saved":True,
        "no_case_identifier_saved_to_report":True,
        "no_authenticated_api_used":True,
        "case_finality_or_current_publication_proven":False,
        "stage3_accepted":False,
    }
    seen=set(KNOWN_TEN)
    async with httpx.AsyncClient(timeout=httpx.Timeout(28,connect=10),
        follow_redirects=False,
        headers={"User-Agent":"v27-limited-long-civil-fidelity/1",
                 "Accept-Encoding":"identity"}) as http:
        async with stdio_client(StdioServerParameters(
            command=__import__("sys").executable,
            args=["-m","mcp_server.server"]
        )) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for cohort in COHORTS:
                    label,court,code,kind,year,caseword,keyword=cohort
                    g={"id":label,"roc_year":year,"court_type":kind,
                       "official_checked":0,"long_detected":0,
                       "long_fidelity_passed":0,"cases":[]}
                    out["searches"]+=1
                    candidates,reason=await search(session,cohort)
                    if candidates is None:
                        g["search_status"]="review"
                        g["reason"]=reason
                        out["groups"].append(g)
                        continue
                    g["search_status"]="passed"
                    g["reported_results"]=len(candidates)
                    for item in candidates:
                        if (g["official_checked"]>=MAX_CANDIDATES_PER_COHORT
                            or out["official_get"]>=MAX_DIRECT_GET
                            or out["mcp_get"]>=MAX_MCP_GET):
                            break
                        jid=item.get("jid") if isinstance(item,dict) else None
                        if not eligible(jid,code,year,seen):
                            continue
                        seen.add(jid)
                        if jid.split(",")[2]!=caseword:
                            continue
                        out["official_get"]+=1
                        g["official_checked"]+=1
                        record={
                            "status":"review","reason":"not_verified",
                            "official_date_verified":False,
                            "official_identity_passed":False,
                            "format":"unknown",
                            "long_html_body":False,
                            "html_body_chars":0,
                            "text_capture_fidelity":False,
                            "source_pdf_not_downloaded":True,
                        }
                        try:
                            raw,why=await asyncio.wait_for(official_get(http,jid),
                                                           timeout=40)
                        except Exception as exc:
                            raw=None
                            why="official_request_unavailable:"+type(exc).__name__
                        if raw is None:
                            record["reason"]=why
                        else:
                            shape=shape_of(raw)
                            record["format"]=shape["kind"]
                            record["html_body_chars"]=shape["body_chars"]
                            identity=source_identity(raw,jid,court,kind)
                            record["official_identity_passed"]=identity["official_identity_passed"]
                            record["official_date_verified"]=identity["official_date_verified"]
                            if not identity["official_identity_passed"]:
                                record["reason"]=identity["reason"]
                            elif shape["pdf_hint"]:
                                record["reason"]="pdf_format_not_html_text_verified"
                            elif shape["body_chars"]<LONG_BODY_CHARS:
                                record["reason"]="body_under_10000_chars"
                            else:
                                g["long_detected"]+=1
                                record["long_html_body"]=True
                                sections,why=official_sections(raw)
                                if sections is None:
                                    record["reason"]=why
                                else:
                                    out["mcp_get"]+=1
                                    try:
                                        parsed=unpack(await asyncio.wait_for(
                                            session.call_tool("get_judgment",{"jid":jid}),
                                            timeout=140))
                                        if parsed.get("success") is not True:
                                            record["reason"]="mcp_document_unavailable"
                                        elif not strict_source(parsed.get("source_url"),jid):
                                            record["reason"]="mcp_document_origin_or_id_invalid"
                                        else:
                                            verdict=text_capture_evidence(
                                                sections["body"],sections["root"],
                                                parsed.get("full_text",""))
                                            record["text_capture_fidelity"]=bool(
                                                verdict["capture_passed"])
                                            record["mcp_normalized_chars"]=verdict["mcp_text_chars"]
                                            record["official_container_exact_match"]=verdict[
                                                "official_container_exact_match"]
                                            if verdict["capture_passed"]:
                                                record.update(
                                                    status="passed",
                                                    reason="long_official_html_and_mcp_capture_match")
                                                g["long_fidelity_passed"]+=1
                                            else:
                                                record["reason"]="long_mcp_full_text_mismatch"
                                    except Exception as exc:
                                        record["reason"]="mcp_unavailable:"+type(exc).__name__
                        g["cases"].append(record)
                        print(label,"official long candidate",record["status"],
                              record["reason"],"body_chars",record["html_body_chars"],flush=True)
                        await asyncio.sleep(1)
                    out["groups"].append(g)
                    print(label,"official_checked",g["official_checked"],
                          "long_found",g["long_detected"],"passed",g["long_fidelity_passed"],
                          flush=True)
                    if g["long_fidelity_passed"]:
                        # Limit requests and stop once the specific acceptance gap
                        # is actually filled; no further research crawl.
                        break
    out["long_text_fidelity_passed"]=sum(g["long_fidelity_passed"] for g in out["groups"])
    out["long_text_subtest_accepted"]=out["long_text_fidelity_passed"]>=1
    out["stage3_accepted"]=False
    return out

def selftest():
    assert len(COHORTS)==2
    assert all(g[5] in ("重訴","重上") for g in COHORTS)
    assert MAX_SEARCHES==2 and MAX_DIRECT_GET==8 and MAX_MCP_GET==2
    assert eligible("TPDV,113,重訴,100,20241001,1","TPDV",113,set())
    assert not eligible("TPDV,113,少護,1,20241001,1","TPDV",113,set())
    assert not eligible("TPDV,114,重訴,100,20241001,1","TPDV",113,set())
    print("Stage3l targeted long judgment safety checks passed")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--mode",choices=("selftest","live"),required=True)
    opt=parser.parse_args()
    if opt.mode=="selftest":
        selftest()
    else:
        try:
            report=asyncio.run(audit())
        except Exception as exc:
            report={"fatal_error":type(exc).__name__,
                    "long_text_subtest_accepted":False,
                    "stage3_accepted":False}
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",
                          encoding="utf-8")
        print(json.dumps({k:report.get(k) for k in
            ("searches","official_get","mcp_get","long_text_fidelity_passed",
             "long_text_subtest_accepted","live_pdf_text_verified",
             "stage3_accepted","fatal_error")},ensure_ascii=False),flush=True)
        if report.get("fatal_error"):
            raise SystemExit(1)
