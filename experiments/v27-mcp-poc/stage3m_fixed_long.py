#!/usr/bin/env python3
"""v2.7 Stage3m: fixed independently-discovered LONG public-court samples.

All six JIDs originated from public Judicial Yuan printData search results, not
guesses or third-party 'similar cases'. At most six official HTML GETs and three
research MCP get_judgment calls. No PDF download. No real case text, litigant
information, individual JID, summary or URLs in CI JSON reports.
One text-fidelity PASS proves capture of THAT fetched HTML only: not finality,
a permanent publication right, public juvenile-case access or API authorization.
"""
import argparse
import asyncio
import json
import logging
import re
import sys
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
import httpx

from stage1_accuracy import unpack
from stage3h_diff_diagnostics import strict_source, official_sections
from stage3i_eight_public_samples import text_capture_evidence
from stage3l_format_diversity import source_identity, shape_of, LONG_BODY_CHARS

# These exact case identifiers have independently visible official
# printData.aspx URLs and were not part of the earlier ten 2025-12-31 cases.
# No names or party information accompany these sample IDs.
SAMPLES=(
    ("KNOWN-1","臺灣臺北地方法院","民事","TPDV,113,重訴,999,20250814,1"),
    ("KNOWN-2","臺灣高等法院","民事","TPHV,113,重上更一,130,20260519,1"),
    ("KNOWN-3","臺灣臺北地方法院","民事","TPDV,113,重訴,36,20260529,2"),
    ("KNOWN-4","臺灣桃園地方法院","民事","TYDV,113,重訴更一,5,20250925,1"),
    ("KNOWN-5","臺灣臺北地方法院","民事","TPDV,114,重訴,1137,20260702,1"),
    ("KNOWN-6","臺灣臺北地方法院","民事","TPDV,114,重訴,1191,20260331,1"),
)
MAX_OFFICIAL_GET=6
MAX_MCP_GET=3
MAX_BYTES=1_500_000
MIN_LONG_BODY_CHARS=LONG_BODY_CHARS  # 10,000 normalized chars
MAX_ACCEPTED_LONG=2
PIN="ef677ad63c3206fc211a083fad8b1d9ef5015222"
OUT=Path("v27-mcp-stage3m-known-long.json")

# Avoid verbose request URLs in this script's application logs.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

def official_url(jid):
    return ("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
            +urlencode({"ty":"JD","id":jid}))

async def official_get(client,jid):
    url=official_url(jid)
    if not strict_source(url,jid):
        return None,"invalid_official_jid"
    try:
        async with client.stream("GET",url) as response:
            if response.status_code!=200:
                return None,"official_http_"+str(response.status_code)
            if not strict_source(str(response.url),jid):
                return None,"official_source_or_identifier_redirected"
            result=bytearray()
            async for chunk in response.aiter_bytes():
                if len(result)+len(chunk)>MAX_BYTES:
                    return None,"official_html_exceeded_1500000_bytes"
                result.extend(chunk)
            return bytes(result),"official_html_available"
    except (httpx.HTTPError,asyncio.TimeoutError) as exc:
        return None,"official_source_unavailable:"+type(exc).__name__

def classify_official(raw,jid,court,case_type):
    result={
        "status":"review",
        "format":"unknown",
        "body_chars":0,
        "identity_passed":False,
        "date_passed":False,
        "official_substantial_long":False,
        "pdf_bytes_downloaded":False,
        "pdf_text_verified":False,
        "official_text_saved":False,
    }
    shape=shape_of(raw)
    result["format"]=shape["kind"]
    result["body_chars"]=shape["body_chars"]
    metadata=source_identity(raw,jid,court,case_type)
    result["identity_passed"]=metadata["official_identity_passed"]
    result["date_passed"]=metadata["official_date_verified"]
    if not result["identity_passed"]:
        result["reason"]=metadata["reason"]
    elif shape["pdf_hint"]:
        result["reason"]="official_pdf_reference_no_pdf_fulltext_comparison"
    elif shape["body_chars"]<MIN_LONG_BODY_CHARS:
        result["reason"]="official_full_body_below_10000_char_threshold"
    else:
        sections,why=official_sections(raw)
        if sections is None:
            result["reason"]=why
        else:
            result["official_substantial_long"]=True
            result["reason"]="official_long_text_ready_for_mcp_fidelity_comparison"
    return result

async def audit():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    report={
        "phase":"Stage 3m fixed official public long-judgment source audit",
        "checked_utc":datetime.now(timezone.utc).isoformat(),
        "sample_ids_provenance":"official_public_printData_search_results",
        "pinned_mcp":PIN,
        "maximum_official_get":MAX_OFFICIAL_GET,
        "maximum_mcp_get":MAX_MCP_GET,
        "official_get_attempted":0,
        "mcp_get_attempted":0,
        "results":[],
        "no_real_court_body_saved":True,
        "no_litigants_saved":True,
        "no_individual_case_jids_or_urls_saved_to_report":True,
        "no_pdf_content_fetched_or_saved":True,
        "no_juvenile_court_cases_queried":True,
        "no_official_member_api_called":True,
        "case_currently_public_at_user_click_proven":False,
        "case_finality_proven":False,
        "all_formats_validated":False,
        "stage3_accepted":False,
    }
    long_passes=0
    async with httpx.AsyncClient(timeout=httpx.Timeout(36,connect=11),
        follow_redirects=False,
        headers={"User-Agent":"v27-fixed-public-long-audit/1",
                 "Accept-Encoding":"identity","Cache-Control":"no-store"}) as http:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"]
        )) as (reader,writer):
            async with ClientSession(reader,writer) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for label,court,case_type,jid in SAMPLES:
                    if long_passes>=MAX_ACCEPTED_LONG or report["mcp_get_attempted"]>=MAX_MCP_GET:
                        break
                    report["official_get_attempted"]+=1
                    result={"id":label,"status":"review","reason":"official_not_confirmed",
                            "official_body_chars":0,"format":"unknown",
                            "mcp_fidelity_passed":False,"real_jid_saved":False,
                            "official_text_or_litigant_saved":False}
                    raw,why=await asyncio.wait_for(official_get(http,jid),timeout=50)
                    if raw is None:
                        result["reason"]=why
                    else:
                        checked=classify_official(raw,jid,court,case_type)
                        result.update({
                            "status":checked["status"],"reason":checked["reason"],
                            "format":checked["format"],
                            "official_body_chars":checked["body_chars"],
                            "court_date_identity_passed":checked["identity_passed"],
                            "official_date_passed":checked["date_passed"],
                            "official_substantial_long":checked["official_substantial_long"],
                        })
                        if checked["official_substantial_long"]:
                            sections,_=official_sections(raw)
                            report["mcp_get_attempted"]+=1
                            try:
                                mcp=unpack(await asyncio.wait_for(
                                    session.call_tool("get_judgment",{"jid":jid}),
                                    timeout=155))
                                if mcp.get("success") is not True:
                                    result["reason"]="mcp_get_failed_or_unavailable"
                                elif not strict_source(mcp.get("source_url"),jid):
                                    result["reason"]="mcp_source_url_or_jid_not_approved"
                                else:
                                    fidelity=text_capture_evidence(
                                        sections["body"],sections["root"],mcp.get("full_text",""))
                                    result.update({
                                        "mcp_normalized_chars":fidelity["mcp_text_chars"],
                                        "official_container_exact":fidelity["official_container_exact_match"],
                                        "official_body_exact":fidelity["official_body_exact_match"],
                                        "official_body_contiguous":fidelity["official_body_contiguous_in_mcp"],
                                        "mcp_fidelity_passed":fidelity["capture_passed"],
                                    })
                                    if fidelity["capture_passed"]:
                                        long_passes+=1
                                        result.update(status="passed",
                                            reason="long_official_fullbody_equal_to_mcp_capture")
                                    else:
                                        result["reason"]="long_official_mcp_text_not_identical"
                            except Exception as exc:
                                result["reason"]="mcp_comparison_unavailable:"+type(exc).__name__
                    report["results"].append(result)
                    print(label,result["status"],result["reason"],
                          "length",result["official_body_chars"],
                          "format",result["format"],flush=True)
                    await asyncio.sleep(1)
    report["long_source_identified"]=sum(
        row.get("official_substantial_long",False) for row in report["results"])
    report["long_fidelity_passed"]=long_passes
    report["long_text_subtest_accepted"]=long_passes>=1
    report["long_text_diverse_sample_target"]=long_passes>=2
    report["pdf_fulltext_verified"]=0
    report["stage3_accepted"]=False
    return report

def selftest():
    assert len(SAMPLES)==MAX_OFFICIAL_GET==6
    assert len({sample[-1] for sample in SAMPLES})==6
    for label,court,case_type,jid in SAMPLES:
        assert case_type=="民事" and "少年" not in court
        assert "少" not in jid.split(",")[2] and "家" not in jid.split(",")[2]
        assert strict_source(official_url(jid),jid)
    jid=SAMPLES[0][-1]
    html=('<div id="jud">'
          '<div class="row"><div class="col-th">裁判字號</div>'
          '<div class="col-td">113年度重訴字第999號</div></div>'
          '<div class="row"><div class="col-th">裁判日期</div>'
          '<div class="col-td">民國114年8月14日</div></div>'
          '<div class="htmlcontent">'
          '臺灣臺北地方法院民事判決113年度重訴字第999號主文事實及理由'
          +("合成測試文字不是真實裁判"*1500)+'</div></div>').encode("utf-8")
    test=classify_official(html,jid,"臺灣臺北地方法院","民事")
    assert test["official_substantial_long"],test
    assert test["body_chars"]>=10000
    assert test["identity_passed"] and test["date_passed"]
    edited=html.replace("8月14日".encode(),"8月13日".encode())
    changed=classify_official(edited,jid,"臺灣臺北地方法院","民事")
    assert not changed["official_substantial_long"] and not changed["date_passed"]
    short=html.replace(("合成測試文字不是真實裁判"*1500).encode(),"短本文".encode())
    assert not classify_official(short,jid,"臺灣臺北地方法院","民事")["official_substantial_long"]
    pdf=html.replace("</div></div>".encode(),'<a href="synthetic.pdf">PDF</a></div></div>'.encode())
    assert classify_official(pdf,jid,"臺灣臺北地方法院","民事")["reason"]==(
        "official_pdf_reference_no_pdf_fulltext_comparison")
    print("Stage3m fixed public JIDs, identity/date, 10000-char gate and PDF fail-closed passed")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--mode",choices=("selftest","live"),required=True)
    op=parser.parse_args()
    if op.mode=="selftest":
        selftest()
    else:
        try:report=asyncio.run(audit())
        except Exception as exc:
            report={"fatal_error":type(exc).__name__,
                    "long_text_subtest_accepted":False,"stage3_accepted":False}
        OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:report.get(k) for k in (
            "official_get_attempted","mcp_get_attempted","long_source_identified",
            "long_fidelity_passed","long_text_subtest_accepted",
            "long_text_diverse_sample_target","pdf_fulltext_verified",
            "all_formats_validated","stage3_accepted","fatal_error")},
            ensure_ascii=False),flush=True)
        if report.get("fatal_error"):
            raise SystemExit(1)
