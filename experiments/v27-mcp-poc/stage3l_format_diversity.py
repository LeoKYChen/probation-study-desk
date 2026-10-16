#!/usr/bin/env python3
"""Stage 3l: public court format / year diversity POC, WITHOUT storing court text.

Four narrowly-scoped public civil/criminal research searches in four separate
ROC years (111-114), a maximum of 12 direct official court-page GETs and 8
pinned upstream MCP get_judgment calls. No juvenile/family-case queries, no
authenticated Judicial Yuan API, no court body/PDF download saved to reports,
no actual case JID or party details emitted in test result JSON.

PDF-only / unsupported HTML are explicitly REVIEW, not a text-fidelity PASS.
A court page returning HTTP 200 alone is never sufficient.
"""
import argparse
import asyncio
from collections import Counter
from datetime import datetime, timezone
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup

from stage1_accuracy import unpack
from stage3h_diff_diagnostics import norm, strict_source, official_sections
from stage3i_eight_public_samples import official_get, text_capture_evidence
from stage3i_ten_official_dates import find_metadata, roc_date

OUTPUT=Path("v27-mcp-stage3l-format-diversity.json")
PIN="ef677ad63c3206fc211a083fad8b1d9ef5015222"
COHORTS=(
    # Each search is restricted to one case type, one court, one ROC year.
    ("C111","臺灣高等法院","TPHV","民事","損害賠償",111),
    ("K112","臺灣高等法院臺中分院","TCHM","刑事","詐欺",112),
    ("C113","臺灣臺北地方法院","TPDV","民事","租賃",113),
    ("K114","臺灣臺中地方法院","TCDM","刑事","詐欺",114),
)
MAX_SEARCHES=4
MAX_SEARCH_RESULTS=6
MAX_CANDIDATE_PAGES=12
MAX_MCP_DOCS=8
MAX_ATTEMPTS_PER_COHORT=3
MAX_PASSED_PER_COHORT=2
LONG_BODY_CHARS=10000
MIN_HTML_BODY_CHARS=400
SAFE_JID=re.compile(r"^[A-Z]{4},\d{3},[^,]{1,15},[0-9A-Za-z-]{1,15},\d{8},\d+$")
DISALLOWED_CASE_WORDS=("少","家","親","兒","童","收養","扶養","監護")
KNOWN_TEN={
    "TPSM,114,台抗,2605,20251231,1",
    "TPSM,114,台抗,2657,20251231,1",
    "TPHV,114,上易,1030,20251231,2",
    "TPHV,114,再易,110,20251231,1",
    "TPDV,114,司票,26166,20251231,2",
    "TPDV,114,重訴,238,20251231,1",
    "TCHM,114,上易,801,20251231,2",
    "TCHM,114,金上訴,2749,20251231,2",
    "TCDM,114,金訴,2374,20251231,2",
    "TCDM,114,聲,4461,20251231,1",
}

def eligible(jid,court_code,roc_year,seen):
    if not isinstance(jid,str) or not SAFE_JID.fullmatch(jid):
        return False
    if jid in seen or jid in KNOWN_TEN:
        return False
    parts=jid.split(",")
    if parts[0]!=court_code or int(parts[1])!=roc_year:
        return False
    if any(word in parts[2] for word in DISALLOWED_CASE_WORDS):
        return False
    try:
        date=datetime.strptime(parts[4],"%Y%m%d")
    except ValueError:
        return False
    return date.year==roc_year+1911

def shape_of(html):
    """Classify official HTML presentation WITHOUT downloading embedded files."""
    soup=BeautifulSoup(html,"lxml")
    root=soup.select_one("#jud")
    if root is None:
        return {"kind":"no_judgment_container","body":None,"pdf_hint":False,
                "html_selector":None,"body_chars":0}
    pdf_hint=False
    # Only inspect actual tags/attributes: not PDF keyword mentions in prose.
    for el in root.select("a[href], iframe[src], object[data], embed[src]"):
        ref=el.get("href") or el.get("src") or el.get("data") or ""
        mime=(el.get("type") or "").lower()
        if isinstance(ref,str) and (
            ".pdf" in ref.lower().split("?",1)[0] or
            "/jfile/" in ref.lower() or "application/pdf" in mime
        ):
            pdf_hint=True
            break
    selected=None
    selector=None
    for name in (".htmlcontent",".text-pre",".jud_content"):
        item=root.select_one(name)
        if item is not None and len(norm(item.get_text(" ",strip=True)))>=150:
            selected=item
            selector=name[1:]
            break
    if selected is None:
        return {
            "kind":"pdf_link_without_verifiable_html_body" if pdf_hint
                   else "unsupported_or_empty_official_html",
            "body":None,"pdf_hint":pdf_hint,
            "html_selector":None,"body_chars":0
        }
    body=selected.get_text(strip=False)
    return {
        "kind":("html_with_pdf_reference" if pdf_hint else "html_"+selector),
        "body":body,
        "pdf_hint":pdf_hint,
        "html_selector":selector,
        "body_chars":len(norm(body)),
    }

def source_identity(html,jid,court,case_type):
    """Verify independently fetched court, case ID, date and displayed type."""
    info={
        "official_identity_passed":False,
        "official_date_verified":False,
        "adult_subject_matter_independently_confirmed":False,
        "reason":"official_case_metadata_unconfirmed"
    }
    parts=jid.split(",")
    metadata,reason=find_metadata(html)
    if metadata is None:
        info["reason"]=reason
        return info
    title=norm(metadata.get("裁判字號","")).replace("臺","台")
    expected_word=norm(parts[2]).replace("臺","台")
    expected_year=str(parts[1])
    expected_num=str(parts[3])
    is_title=bool(expected_year in title and expected_word in title and
                  expected_num in title)
    official_date=roc_date(metadata.get("裁判日期",""))
    info["official_date_verified"]=bool(official_date==parts[4])
    root=BeautifulSoup(html,"lxml").select_one("#jud")
    root_txt=norm(root.get_text(" ",strip=True)).replace("臺","台") if root else ""
    info["official_identity_passed"]=bool(
        is_title and info["official_date_verified"]
        and norm(court).replace("臺","台") in root_txt and case_type in root_txt
    )
    if not is_title:
        info["reason"]="official_case_number_or_year_unconfirmed"
    elif not info["official_date_verified"]:
        info["reason"]="official_date_missing_or_disagrees"
    elif not info["official_identity_passed"]:
        info["reason"]="official_court_or_case_type_unconfirmed"
    else:
        info["reason"]="official_case_identity_date_type_confirmed"
    # Even ordinary-court civil/criminal labels are NOT sufficient to attest
    # that each judgment body lacks references to minors.
    return info

async def discovery(session,cohort):
    label,court,code,case_type,keyword,year=cohort
    try:
        obj=unpack(await asyncio.wait_for(session.call_tool(
            "search_judgments", {
                "keyword":keyword,
                "court":court,"case_type":case_type,
                "year_from":year,"year_to":year,
                "max_results":MAX_SEARCH_RESULTS
            }),timeout=115))
    except Exception as exc:
        return None,"source_search_unavailable:"+type(exc).__name__
    if obj.get("success") is not True:
        return None,"source_search_unavailable_or_restricted"
    rows=obj.get("results")
    if not isinstance(rows,list) or len(rows)>MAX_SEARCH_RESULTS:
        return None,"source_search_result_out_of_bounds"
    return rows,"source_search_returned"

async def check_candidate(session,client,jid,cohort,mcp_budget):
    label,court,code,case_type,keyword,roc_year=cohort
    out={
        "status":"review",
        "reason":"source_not_confirmed",
        "official_identity_passed":False,
        "official_date_verified":False,
        "format":"undetermined",
        "format_supported_by_mcp":False,
        "fidelity_passed":False,
        "official_body_chars":0,
        "mcp_chars":None,
        "long_body_threshold_reached":False,
        "pdf_bytes_downloaded":False,
        "fulltext_or_jid_persisted":False,
        "mcp_called":False,
    }
    try:
        raw,reason=await asyncio.wait_for(official_get(client,jid),timeout=36)
    except Exception as exc:
        out["reason"]="official_source_timeout_or_error:"+type(exc).__name__
        return out
    if raw is None:
        out["reason"]=reason
        return out
    shape=shape_of(raw)
    out["format"]=shape["kind"]
    out["official_body_chars"]=shape["body_chars"]
    out["long_body_threshold_reached"]=shape["body_chars"]>=LONG_BODY_CHARS
    identity=source_identity(raw,jid,court,case_type)
    out["official_identity_passed"]=identity["official_identity_passed"]
    out["official_date_verified"]=identity["official_date_verified"]
    if not identity["official_identity_passed"]:
        out["reason"]=identity["reason"]
        return out
    out["official_date"]=jid.split(",")[4]
    # These are real publicly discovered cases, NOT a guarantee of continued
    # publication, court finality, safe personally identifiable content, etc.
    if shape["pdf_hint"]:
        out["reason"]="pdf_reference_detected_not_downloaded_or_verified"
        return out
    if not shape["body"] or shape["body_chars"]<MIN_HTML_BODY_CHARS:
        out["reason"]="no_substantial_supported_html_body"
        return out
    # In the classification path, the official #jud selection and body
    # selector are independent of MCP parsing. Only exact normalized
    # body/root captures can be accepted (never fragment-only overlaps).
    sections,why=official_sections(raw)
    if sections is None:
        out["reason"]=why
        return out
    if mcp_budget["remaining"]<=0:
        out["reason"]="mcp_query_budget_exhausted"
        return out
    mcp_budget["remaining"]-=1
    out["mcp_called"]=True
    try:
        obj=unpack(await asyncio.wait_for(
            session.call_tool("get_judgment",{"jid":jid}),timeout=145))
    except Exception as exc:
        out["reason"]="mcp_document_unavailable:"+type(exc).__name__
        return out
    if obj.get("success") is not True:
        out["reason"]="mcp_document_get_failed"
        return out
    if not strict_source(obj.get("source_url"),jid):
        out["reason"]="mcp_document_source_or_identifier_not_approved"
        return out
    fidelity=text_capture_evidence(sections["body"],sections["root"],obj.get("full_text",""))
    out["mcp_chars"]=fidelity["mcp_text_chars"]
    out["fidelity_passed"]=fidelity["capture_passed"]
    out["format_supported_by_mcp"]=fidelity["capture_passed"]
    out["official_container_exact_match"]=fidelity["official_container_exact_match"]
    out["official_body_exact_match"]=fidelity["official_body_exact_match"]
    out["official_body_contiguous_in_mcp"]=fidelity["official_body_contiguous_in_mcp"]
    out["status"]="passed" if fidelity["capture_passed"] else "review"
    out["reason"]=("official_and_mcp_text_capture_identical"
                   if fidelity["capture_passed"]
                   else "mcp_text_not_identical_to_official_body_or_container")
    return out

async def main():
    from mcp import ClientSession,StdioServerParameters
    from mcp.client.stdio import stdio_client
    report={
        "phase":"stage3l 4-ROC-year public court format diversity sampling",
        "checked_utc":datetime.now(timezone.utc).isoformat(),
        "pinned_upstream":PIN,
        "max_searches":MAX_SEARCHES,
        "max_official_get":MAX_CANDIDATE_PAGES,
        "max_mcp_get":MAX_MCP_DOCS,
        "actual_searches":0,
        "actual_official_get":0,
        "actual_mcp_get":0,
        "cohorts":[],
        "no_real_jid_or_party_data_in_report":True,
        "no_judgment_body_or_pdf_saved":True,
        "no_authenticated_judicial_api_used":True,
        "no_unpublished_juvenile_judgment_queries":True,
        "no_bypass_implemented_by_this_probe":True,
        "individual_case_links_approved":False,
        "current_publication_guaranteed":False,
        "judgment_finality_verified":False,
        "stage3_accepted":False,
    }
    seen=set(KNOWN_TEN)
    budget={"remaining":MAX_MCP_DOCS}
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(27,connect=10),
        follow_redirects=False,
        headers={"User-Agent":"v27-limited-public-format-audit/1",
                 "Accept-Encoding":"identity","Cache-Control":"no-store"}
    ) as http:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"]
        )) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for cohort in COHORTS:
                    label,court,code,kind,keyword,year=cohort
                    line={
                        "id":label,"roc_year":year,"kind":kind,
                        "search_status":"review","search_items":0,
                        "eligible_count":0,"official_checks":0,
                        "text_fidelity_passed":0,"cases":[]
                    }
                    report["actual_searches"]+=1
                    hits,reason=await discovery(session,cohort)
                    if hits is None:
                        line["search_reason"]=reason
                        report["cohorts"].append(line)
                        print(label,"search review",reason,flush=True)
                        continue
                    line["search_status"]="passed"
                    line["search_items"]=len(hits)
                    pool=[]
                    for hit in hits:
                        jid=hit.get("jid") if isinstance(hit,dict) else None
                        if eligible(jid,code,year,seen):
                            pool.append(jid)
                            seen.add(jid)
                    line["eligible_count"]=len(pool)
                    for jid in pool:
                        if (line["official_checks"]>=MAX_ATTEMPTS_PER_COHORT or
                            line["text_fidelity_passed"]>=MAX_PASSED_PER_COHORT or
                            report["actual_official_get"]>=MAX_CANDIDATE_PAGES):
                            break
                        report["actual_official_get"]+=1
                        line["official_checks"]+=1
                        prev=budget["remaining"]
                        checked=await check_candidate(session,http,jid,cohort,budget)
                        if budget["remaining"]<prev:
                            report["actual_mcp_get"]+=1
                        if checked["fidelity_passed"]:
                            line["text_fidelity_passed"]+=1
                        # No JID, URL, title, parties, extracts, causes or texts.
                        line["cases"].append(checked)
                        print(label,"candidate",checked["status"],
                              checked["format"],checked["reason"],
                              "body_chars",checked["official_body_chars"],
                              "long",checked["long_body_threshold_reached"],flush=True)
                        await asyncio.sleep(1)
                    report["cohorts"].append(line)
                # Never use a second search/page to compensate for blocked
                # sources, even if insufficient cases passed.
    rows=[r for cohort in report["cohorts"] for r in cohort["cases"]]
    report["format_counts"]=dict(Counter(r["format"] for r in rows))
    report["distinct_official_dates"]=sorted(set(
        r["official_date"] for r in rows if r.get("official_identity_passed")))
    report["distinct_years_officially_checked"]=sorted(set(
        int(d[:4]) for d in report["distinct_official_dates"]))
    report["fidelity_passed_total"]=sum(r["fidelity_passed"] for r in rows)
    report["review_total"]=sum(r["status"]=="review" for r in rows)
    report["long_case_count"]=sum(r["long_body_threshold_reached"] for r in rows)
    report["long_case_fidelity_passed"]=sum(
        r["long_body_threshold_reached"] and r["fidelity_passed"] for r in rows)
    report["pdf_reference_cases"]=sum(r["format"].startswith("pdf_link")
                                       or r["format"]=="html_with_pdf_reference"
                                       for r in rows)
    report["pdf_fulltext_verified"]=0
    report["across_years_subtest_passed"]=len(report["distinct_years_officially_checked"])>=3
    report["html_text_capture_subtest_passed"]=report["fidelity_passed_total"]>=4
    report["long_case_subtest_passed"]=report["long_case_fidelity_passed"]>=1
    report["all_formats_validated"]=False
    report["stage3_accepted"]=False
    return report

def selftest():
    assert len(COHORTS)==MAX_SEARCHES==4
    assert {x[-1] for x in COHORTS}=={111,112,113,114}
    assert len(KNOWN_TEN)==10
    assert eligible("TPHV,111,上,123,20221223,1","TPHV",111,set())
    assert not eligible("TPHV,114,上易,1030,20251231,2","TPHV",114,set())
    assert not eligible("TPHV,111,家上,123,20221223,1","TPHV",111,set())
    assert not eligible("TPHV,111,少上,123,20221223,1","TPHV",111,set())
    assert not eligible("TPHV,111,上,123,20221223,1","TPHV",113,set())
    assert not eligible("TPHV,111,上,123,20220199,1","TPHV",111,set())
    basic=(
        '<div id="jud">'
        '<div class="row"><div class="col-th">裁判字號</div><div class="col-td">111年度上字第123號</div></div>'
        '<div class="row"><div class="col-th">裁判日期</div><div class="col-td">民國111年12月23日</div></div>'
        '<div class="htmlcontent">臺灣高等法院民事判決111年度上字第123號主文理由'
        +('合成測試不是真實裁判'*1400)+'</div></div>'
    ).encode("utf-8")
    jid="TPHV,111,上,123,20221223,1"
    assert source_identity(basic,jid,"臺灣高等法院","民事")["official_identity_passed"]
    assert shape_of(basic)["kind"]=="html_htmlcontent"
    assert shape_of(basic)["body_chars"]>=LONG_BODY_CHARS
    sections,why=official_sections(basic)
    fidelity=text_capture_evidence(sections["body"],sections["root"],sections["root"])
    assert fidelity["capture_passed"]
    bad=text_capture_evidence(sections["body"],sections["root"],
                              sections["root"].replace("理由","不同",1))
    assert not bad["capture_passed"]
    pdf=(
        '<div id="jud"><div class="row"><div class="col-th">裁判字號</div>'
        '<div class="col-td">111年度上字第123號</div></div>'
        '<a href="/jdg/api/JFile/SYNTHETIC_ONLY.pdf">檢視 PDF</a></div>'
    ).encode()
    assert shape_of(pdf)["kind"]=="pdf_link_without_verifiable_html_body"
    assert shape_of(pdf)["pdf_hint"]
    htmlpdf=basic.replace(b"</div></div>",b'<a href="/jdg/api/JFile/SYNTHETIC_ONLY.pdf">PDF</a></div></div>')
    assert shape_of(htmlpdf)["kind"]=="html_with_pdf_reference"
    txt=basic.replace(b'htmlcontent',b'text-pre')
    assert shape_of(txt)["kind"]=="html_text-pre"
    unexpected=b"<html><body>HTTP 200 but no judicial text</body></html>"
    assert shape_of(unexpected)["kind"]=="no_judgment_container"
    assert not source_identity(unexpected,jid,"臺灣高等法院","民事")["official_identity_passed"]
    print("Stage3l four years, text-pre/PDF safety and long-body offline fixtures passed",flush=True)

if __name__=="__main__":
    args=argparse.ArgumentParser()
    args.add_argument("--mode",choices=("selftest","live"),required=True)
    mode=args.parse_args().mode
    if mode=="selftest":
        selftest()
    else:
        try:
            report=asyncio.run(main())
        except Exception as exc:
            report={"fatal_error":type(exc).__name__,
                    "stage3_accepted":False,"all_formats_validated":False}
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({key:report.get(key) for key in
            ("actual_searches","actual_official_get","actual_mcp_get",
             "format_counts","distinct_years_officially_checked",
             "fidelity_passed_total","review_total",
             "long_case_count","long_case_fidelity_passed",
             "pdf_reference_cases","pdf_fulltext_verified",
             "across_years_subtest_passed","html_text_capture_subtest_passed",
             "long_case_subtest_passed","all_formats_validated",
             "stage3_accepted","fatal_error")},ensure_ascii=False),flush=True)
        if report.get("fatal_error"):
            sys.exit(1)
