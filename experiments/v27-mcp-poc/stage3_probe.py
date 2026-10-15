#!/usr/bin/env python3
"""Stage-3a discovery: public judgments, constitutional rulings, legislative history.

A pilot only. Never stores judgment full text, litigant names, case details,
personal data or non-public juvenile court decisions in artifacts/repo.
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
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

REPORT = Path("v27-mcp-stage3a-probe.json")
PINNED_UPSTREAM = "ef677ad63c3206fc211a083fad8b1d9ef5015222"
JID_PATTERN = re.compile(r"^[A-Z]{2,6},\d+,[^,]+,[0-9A-Za-z\-]+,\d{8},\d+$")
JUDGMENT_SUBJECTS = ("竊盜", "詐欺", "偽造文書")
CONSTITUTIONAL_CASES = ("釋字第748號", "釋字第803號", "111年憲判字第1號")
LEGISLATION = (("少年事件處理法", "3-1"), ("保安處分執行法", "74-2"))
LEGAL_DOMAINS = {
    "judgment": {"judgment.judicial.gov.tw"},
    "constitutional": {"cons.judicial.gov.tw"},
    "legislature": {"lis.ly.gov.tw"},
}


def trustworthy(url, category):
    parsed = urlparse(str(url or ""))
    return parsed.scheme == "https" and parsed.hostname in LEGAL_DOMAINS[category]


def flat(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(text or "")))


def mcp_note(data):
    if data.get("success") is True:
        return ""
    return str(data.get("error", "official_source_unavailable"))[:180]


async def request(session, name, parameters, timeout=75):
    result = await asyncio.wait_for(session.call_tool(name, parameters), timeout)
    return unpack(result)


async def check_official_page(http, url, category, expected_token):
    """Site origin + HTTP + identifying text. 200 alone is insufficient."""
    if not trustworthy(url, category):
        return "failed", "non_official_or_insecure_url"
    try:
        r = await asyncio.wait_for(http.get(url), timeout=35)
        if r.status_code in (401, 403, 429, 503):
            return "review", "official_site_access_restricted"
        if r.status_code != 200:
            return "review", f"official_http_{r.status_code}"
        if not trustworthy(str(r.url), category):
            return "failed", "redirect_to_non_official_origin"
        soup = BeautifulSoup(r.text, "html.parser")
        raw = flat(soup.get_text(" ", strip=True))
        if len(raw) < 120:
            return "review", "official_page_no_substantial_text"
        if expected_token and flat(expected_token) not in raw:
            return "review", "official_page_identifier_not_confirmed"
        return "passed", "official_200_and_identifier_present"
    except Exception as e:
        return "review", "official_page_access_exception:" + type(e).__name__


async def verify_judgments(session, http, report):
    # These are general PUBLIC adult-criminal-law themes. No juvenile-specific search.
    # Never fetch a case if the result suggests juvenile-protected content.
    for idx, keyword in enumerate(JUDGMENT_SUBJECTS, start=1):
        item = {
            "test": f"J{idx:02d}", "category": "public_judgment",
            "keyword": keyword, "status": "review",
            "subsequent_appeal_checked": False,
            "withdrawal_lifecycle_checked": False,
        }
        start = time.monotonic()
        try:
            data = await request(session, "search_judgments", {
                "keyword": keyword, "court": "最高法院",
                "case_type": "刑事", "year_from": 113, "year_to": 114,
                "max_results": 8,
            }, 110)
            matches = data.get("results") or []
            item["found_count"] = len(matches)
            if data.get("success") is not True:
                item["reason"] = "search_unavailable:" + mcp_note(data)
            elif not matches:
                item["reason"] = "zero_results_not_proof_of_nonexistence"
            else:
                valid = [x for x in matches if JID_PATTERN.fullmatch(str(x.get("jid", "")))]
                if len(valid) < len(matches):
                    item["status"] = "failed"
                    item["reason"] = "invalid_jid_in_search_results"
                else:
                    candidate = valid[0]
                    jid = candidate["jid"]
                    item["public_jid"] = jid
                    # A result metadata field is not guaranteed to exist across
                    # upstream versions: preserve the actual source field names.
                    item["search_metadata_fields"] = sorted(candidate.keys())
                    source_url = f"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id={jid}"
                    item["official_url"] = source_url
                    fetched = await request(session, "get_judgment", {"jid": jid}, 135)
                    if fetched.get("success") is not True:
                        item["reason"] = "judgment_full_text_unavailable:" + mcp_note(fetched)
                    else:
                        text = fetched.get("full_text") or ""
                        supplied = fetched.get("source_url") or ""
                        if supplied and not trustworthy(supplied, "judgment"):
                            item["status"] = "failed"
                            item["reason"] = "mcp_nonofficial_judgment_source"
                        elif len(flat(text)) < 100:
                            item["reason"] = "judgment_text_missing"
                        else:
                            # Independently check the official HTTP source without
                            # persisting its response or any party names.
                            st, why = await check_official_page(http, source_url, "judgment", jid.split(",")[3])
                            item["official_page_check"] = st
                            item["official_page_reason"] = why
                            item["full_text_received"] = True
                            item["full_text_characters"] = len(text)
                            item["history_response_type"] = type(fetched.get("history")).__name__
                            item["history_error"] = bool(fetched.get("history_error"))
                            # A successful URL check doesn't itself prove full text
                            # identity; subsequent independent text check is required.
                            item["status"] = "review"
                            item["reason"] = "content_identity_and_appeal_status_not_yet_verified"
        except Exception as e:
            item["reason"] = "judgment_exception:" + type(e).__name__
        item["elapsed_s"] = round(time.monotonic()-start, 2)
        report["cases"].append(item)
        print(f'{item["test"]} {item["status"]} {item.get("reason")} {item["elapsed_s"]}s', flush=True)


async def verify_constitutional(session, http, report):
    for idx, case_id in enumerate(CONSTITUTIONAL_CASES, start=1):
        item = {"test": f"C{idx:02d}", "category": "constitutional_case",
                "case_id": case_id, "status": "review"}
        start = time.monotonic()
        try:
            data = await request(session, "get_interpretation", {"case_id": case_id}, 70)
            item["mcp_success"] = data.get("success") is True
            item["mcp_case_id"] = data.get("case_id")
            item["date"] = data.get("date")
            item["official_url"] = data.get("source_url")
            if not item["mcp_success"]:
                item["reason"] = "constitutional_get_unavailable:" + mcp_note(data)
            elif flat(data.get("case_id")) != flat(case_id):
                item["status"] = "failed"
                item["reason"] = "case_id_mismatch"
            elif not trustworthy(data.get("source_url"), "constitutional"):
                item["status"] = "failed"
                item["reason"] = "non_official_constitutional_origin"
            else:
                # For 748/803, official public page typically contains 748/803.
                token = "748" if "748" in case_id else ("803" if "803" in case_id else "111")
                st, reason = await check_official_page(
                    http, data.get("source_url"), "constitutional", token)
                item["official_page_check"] = st
                item["reason"] = reason
                item["status"] = st if st == "passed" else "review"
                item["content_full_text_verified"] = False
        except Exception as e:
            item["reason"] = "constitutional_exception:" + type(e).__name__
        item["elapsed_s"] = round(time.monotonic()-start,2)
        report["cases"].append(item)
        print(f'{item["test"]} {item["status"]} {item.get("reason")}', flush=True)


async def verify_legislation(session, http, report):
    for idx, (law_name, article_no) in enumerate(LEGISLATION, start=1):
        item = {"test": f"L{idx:02d}", "category": "legislative_history",
                "law": law_name, "article_no": article_no, "status": "review"}
        start = time.monotonic()
        try:
            data = await request(session, "get_legislative_history", {
                "law_name": law_name, "article_no": article_no,
            }, 115)
            item["mcp_success"] = data.get("success") is True
            item["official_url"] = data.get("source_url")
            item["versions_count"] = len(data.get("versions") or [])
            if data.get("success") is not True:
                item["reason"] = "legislative_source_unavailable:" + mcp_note(data)
            elif flat(data.get("law")) != flat(law_name):
                item["status"] = "failed"
                item["reason"] = "wrong_law_title"
            elif not trustworthy(data.get("source_url"), "legislature"):
                item["status"] = "failed"
                item["reason"] = "untrusted_legislative_source"
            elif not isinstance(data.get("versions"), list) or not data["versions"]:
                item["reason"] = "legislative_versions_not_found"
            else:
                st, reason = await check_official_page(
                    http, data["source_url"], "legislature", "")
                item["official_page_check"] = st
                item["status"] = "review"
                item["reason"] = "revisions_retrieved_independent_reason_text_validation_needed"
                item["official_page_reason"] = reason
                item["reason_texts_returned"] = sum(bool(v.get("reason")) for v in data["versions"])
                item["version_dates"] = [v.get("date") for v in data["versions"]]
        except Exception as e:
            item["reason"] = "legislative_exception:" + type(e).__name__
        item["elapsed_s"] = round(time.monotonic()-start,2)
        report["cases"].append(item)
        print(f'{item["test"]} {item["status"]} {item.get("reason")}', flush=True)


async def negative_control(session, report):
    item = {"test": "N01", "category": "fabrication_guard",
            "description": "nonexistent constitutional ruling must not be synthesized",
            "status": "review"}
    try:
        result = await request(session, "get_interpretation", {
            "case_id": "釋字第9999號"}, 25)
        if result.get("success") is False:
            item["status"] = "passed"
            item["reason"] = "nonexistent_case_rejected"
        else:
            item["status"] = "failed"
            item["reason"] = "nonexistent_constitutional_case_returned_as_success"
    except Exception as e:
        item["reason"] = "negative_control_exception:"+type(e).__name__
    report["cases"].append(item)
    print(f'N01 {item["status"]} {item.get("reason")}', flush=True)


async def main():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    report = {
        "phase": "v2.7 MCP stage 3a / small pilot",
        "recorded_utc": datetime.now(timezone.utc).isoformat(),
        "upstream_sha": PINNED_UPSTREAM,
        "scope": "public adult judgments and published constitutional/legislative materials only",
        "judgment_text_persisted": False,
        "juvenile_unpublished_materials_queried": False,
        "production_deployment_authorized": False,
        "stage3_accepted": False,
        "cases": [],
    }
    async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as official:
        async with stdio_client(StdioServerParameters(
            command=sys.executable, args=["-m","mcp_server.server"]
        )) as (read, write):
            async with ClientSession(read,write) as session:
                await asyncio.wait_for(session.initialize(), timeout=45)
                tool_names = {t.name for t in (await session.list_tools()).tools}
                required={"search_judgments","get_judgment","get_interpretation",
                          "get_legislative_history"}
                if not required.issubset(tool_names):
                    raise AssertionError("stage3 MCP tools missing: "+str(required-tool_names))
                await verify_constitutional(session, official, report)
                await verify_legislation(session, official, report)
                await negative_control(session,report)
                await verify_judgments(session, official, report)
    report["counts"] = {status:sum(c["status"]==status for c in report["cases"])
                        for status in ("passed","review","failed")}
    report["cases_executed"] = len(report["cases"])
    report["requirements_for_next_round"] = [
        "Independently verify judgment official text and subsequent appeal history",
        "Cross-check constitutional operative text with original official page",
        "Cross-check legislative historical reasons with original official documents",
        "Build at least 10 reproducible, verified public adult judgment fixtures",
        "Test withdrawal/removal behavior before any storage or public deployment",
    ]
    return report


def selftest():
    assert trustworthy("https://judgment.judicial.gov.tw/FJUD/data.aspx?id=AAA","judgment")
    assert not trustworthy("https://judgment.judicial.gov.tw.evil.test/FJUD","judgment")
    assert not trustworthy("http://judgment.judicial.gov.tw/FJUD/data.aspx","judgment")
    assert trustworthy("https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=748","constitutional")
    assert trustworthy("https://lis.ly.gov.tw/lglawc/lglawkm","legislature")
    assert JID_PATTERN.fullmatch("TPSV,104,台上,472,20150326,1")
    assert not JID_PATTERN.fullmatch("FAKE_JID")
    assert len(JUDGMENT_SUBJECTS)==3
    print("Stage 3a isolated offline security and tool-contract checks passed")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("selftest","live"), required=True)
    a = ap.parse_args()
    if a.mode=="selftest":
        selftest()
    else:
        try:
            output=asyncio.run(main())
        except Exception as e:
            output={"stage3_accepted":False,"fatal_error":type(e).__name__+":"+str(e)[:300]}
        REPORT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({key:output.get(key) for key in ("counts","cases_executed","stage3_accepted","fatal_error")},ensure_ascii=False))
        if output.get("fatal_error") or output.get("counts",{}).get("failed",0)>0:
            sys.exit(1)
