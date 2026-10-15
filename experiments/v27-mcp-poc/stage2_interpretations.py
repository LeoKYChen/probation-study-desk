#!/usr/bin/env python3
"""v2.7 stage 2: audit 21 curated administrative interpretations.

Do not export source full text, change v2.7 metadata, or imply validity.
The official-page comparison uses independent BeautifulSoup selectors rather
than the mcp-taiwan-legal-db agency interpretation parser.
"""
import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from stage1_accuracy import unpack

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = PROJECT_ROOT / "development/v2.7/interpretations.json"
REPORT_PATH = Path("v27-mcp-stage2-report.json")
STAGE2_EXPECTED = 21
UPSTREAM_SHA = "ef677ad63c3206fc211a083fad8b1d9ef5015222"
SEARCH_SAMPLES = (0, 8, 14, 15, 19)


def normalized(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))


def normalized_document(value):
    return normalized(value).replace("臺", "台")


def sha256(value):
    return hashlib.sha256(normalized(value).encode("utf-8")).hexdigest()


def parse_date(text):
    value = normalized(text)
    match = re.search(r"(\d{2,4})[年./-](\d{1,2})[月./-](\d{1,2})", value)
    if not match:
        return ""
    year, month, day = map(int, match.groups())
    if year < 1911:
        year += 1911
    return f"{year:04d}-{month:02d}-{day:02d}"


def require_official_url(url, record_id):
    parsed = urlparse(str(url))
    query = parse_qs(parsed.query)
    return bool(
        parsed.scheme == "https"
        and parsed.hostname == "mojlaw.moj.gov.tw"
        and parsed.path.lower() == "/lawcontentexshow.aspx"
        and query.get("id") == [record_id]
        and query.get("type") == ["E"]
    )


def checked_records():
    payload = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != 1 or payload.get("claimsOfCurrentValidity") is not False:
        raise AssertionError("Index schema / current validity guard failed")
    rows = payload.get("records")
    if not isinstance(rows, list) or len(rows) != STAGE2_EXPECTED:
        raise AssertionError(f"Expected exactly {STAGE2_EXPECTED} indexed sources")
    ids = [r.get("id") for r in rows]
    if len(set(ids)) != STAGE2_EXPECTED:
        raise AssertionError("Index contains duplicate interpretation IDs")
    for item in rows:
        if not re.fullmatch(r"moj:FE\d+", str(item.get("id"))):
            raise AssertionError("Non-MOJ interpretation ID")
        if not require_official_url(item.get("sourceUrl"), item["sourceRecordId"]):
            raise AssertionError("Invalid official URL: " + str(item["id"]))
        if item.get("validityReview") != "unverified" or item.get("originalTextIncluded") is not False:
            raise AssertionError("Index wrongly claims current validity or complete official text")
    return rows


def official_page(html):
    soup = BeautifulSoup(html, "lxml")
    fields = {}
    for row in soup.select(".div-extent > .col-row"):
        head = row.select_one(".col-th")
        data = row.select_one(".col-td")
        if head is not None and data is not None:
            label = head.get_text(" ", strip=True).rstrip(" ：:")
            fields[label] = data.get_text(" ", strip=True)
    orig = soup.select_one("#cp_content_EFULLtr pre")
    summary = soup.select_one("#cp_content_EDATAtr pre")
    full_text = orig.get_text() if orig else ""
    # The MCP implementation intentionally strips recipients following 正本/副本.
    full_text = re.sub(r"\n(?:正[\s　]*本|副[\s　]*本)[\s　]*[：:].*", "", full_text, flags=re.S)
    return {
        "agency": fields.get("發文單位", ""),
        "doc_number": fields.get("發文字號", ""),
        "date": parse_date(fields.get("發文日期", "")),
        "has_form": bool(fields),
        "full_text": full_text,
        "has_full_text": bool(normalized(full_text)),
        "has_summary": bool(summary and normalized(summary.get_text())),
        "official_stopped_label": bool(soup.select_one(".label-fei")),
    }


def case_status(index, mcp, source):
    reasons = []
    errors = []
    source_type = "MOJ official HTML"
    if mcp.get("success") is not True:
        return "review", ["MCP_get_failed_or_source_unavailable"], source_type
    if mcp.get("id") != index["id"]:
        errors.append("mcp_id_mismatch")
    if not require_official_url(mcp.get("source_url", ""), index["sourceRecordId"]):
        errors.append("mcp_source_url_not_official_or_wrong_id")
    if not source["has_form"]:
        return "review", ["official_page_unparsable"], source_type
    for label, actual, expected in (
        ("index_doc_number", source["doc_number"], index["officialDocumentNo"]),
        ("mcp_doc_number", mcp.get("doc_number"), source["doc_number"]),
        ("index_date", source["date"], index["issuedAt"]),
        ("mcp_date", mcp.get("date"), source["date"]),
    ):
        if not normalized(actual) or normalized_document(actual) != normalized_document(expected):
            errors.append(label + "_mismatch")
    mcp_agency = normalized_document(mcp.get("agency"))
    official_agency = normalized_document(source["agency"])
    if not official_agency or not mcp_agency or mcp_agency != official_agency:
        errors.append("mcp_issuing_agency_mismatch")
    if normalized_document(index.get("issuingAgency")) != official_agency:
        errors.append("index_issuing_agency_mismatch")
    if not source["has_full_text"] or not normalized(mcp.get("full_text")):
        reasons.append("official_or_mcp_full_text_missing")
    elif normalized(source["full_text"]) != normalized(mcp["full_text"]):
        # Upstream does some line unwrapping; treat as review rather than pass.
        reasons.append("full_text_nonidentical_requires_manual_review")
    stopped = source["official_stopped_label"]
    shown = mcp.get("status")
    if stopped and shown != "停止適用":
        errors.append("official_stopped_but_mcp_did_not_flag")
    if not stopped and shown in ("適用中", "停止適用"):
        errors.append("mcp_validity_assertion_not_supported_by_visible_official_label")
    if shown not in (None, "", "停止適用"):
        errors.append("unexpected_mcp_validity_label")
    # No 'stopped' label does not imply a currently effective letter.
    if errors:
        return "failed", errors + reasons, source_type
    if reasons:
        return "review", reasons, source_type
    return "passed", [], source_type


async def run_audit(search: bool):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    rows = checked_records()
    report = {
        "phase": "v2.7 × MCP stage 2 administrative interpretations",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_index": "development/v2.7/interpretations.json",
        "index_date": "2026-10-15",
        "upstream_commit": UPSTREAM_SHA,
        "total_indexed": len(rows),
        "current_validity_of_all_records": "NOT_VERIFIED",
        "official_not_stopped_does_not_mean_effective": True,
        "cases": [],
        "search_samples": [],
        "stage2_accepted": False,
    }
    params = StdioServerParameters(command=sys.executable, args=["-m", "mcp_server.server"])
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as official_http:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await asyncio.wait_for(session.initialize(), timeout=45)
                tools = {t.name for t in (await session.list_tools()).tools}
                if "get_agency_interpretation" not in tools or "search_agency_interpretations" not in tools:
                    raise AssertionError("MCP administrative tools not registered")
                for i, index in enumerate(rows, start=1):
                    started = time.monotonic()
                    item = {
                        "case": f"I{i:02d}", "id": index["id"],
                        "index_doc_number": index["officialDocumentNo"],
                        "index_issued_at": index["issuedAt"],
                        "status": "review", "issues": [],
                        "mcp_get_success": False,
                        "official_url": index["sourceUrl"],
                        "current_validity_conclusion": "NOT_DETERMINED",
                    }
                    try:
                        answer = await asyncio.wait_for(
                            session.call_tool("get_agency_interpretation",
                                              {"interpretation_id": index["id"]}), timeout=80)
                        mcp = unpack(answer)
                        item["mcp_get_success"] = mcp.get("success") is True
                        item["mcp_document_number"] = mcp.get("doc_number")
                        item["mcp_date"] = mcp.get("date")
                        item["mcp_status_label"] = mcp.get("status") or "UNLABELED"
                        item["mcp_full_text_sha256"] = sha256(mcp.get("full_text")) if mcp.get("full_text") else None
                        if not item["mcp_get_success"]:
                            item["issues"].append("MCP_get_failed")
                            item["mcp_error_category"] = str(mcp.get("error", ""))[:200]
                        else:
                            resp = await official_http.get(index["sourceUrl"])
                            resp.raise_for_status()
                            if not require_official_url(str(resp.url), index["sourceRecordId"]):
                                raise ValueError("Official page redirected to unexpected URL")
                            official = official_page(resp.text)
                            item["official_doc_number"] = official["doc_number"]
                            item["official_date"] = official["date"]
                            item["official_stopped_label"] = official["official_stopped_label"]
                            item["official_full_text_sha256"] = sha256(official["full_text"]) if official["has_full_text"] else None
                            item["status"], item["issues"], _ = case_status(index, mcp, official)
                    except (Exception, AssertionError) as e:
                        item["status"] = "review"
                        item["issues"].append(f"retrieval_or_parse_error:{type(e).__name__}")
                        item["exception_message"] = str(e)[:240]
                    item["elapsed_s"] = round(time.monotonic() - started, 2)
                    report["cases"].append(item)
                    print(f'[I{i:02d}/I21] {index["id"]} {item["status"]} '
                          f'{item["elapsed_s"]}s {",".join(item["issues"])}', flush=True)

                if search:
                    for position in SEARCH_SAMPLES:
                        index = rows[position]
                        number = index["officialDocumentNo"]
                        start = time.monotonic()
                        check = {"id": index["id"], "doc_number": number, "status": "review"}
                        try:
                            reply = await asyncio.wait_for(
                                session.call_tool("search_agency_interpretations", {
                                    "agency": "moj", "doc_number": number, "page": 1,
                                }), timeout=90)
                            response = unpack(reply)
                            groups = response.get("categories", [])
                            errs = [x.get("error") for x in groups if x.get("error")]
                            hits = [x for x in response.get("results", []) if x.get("id") == index["id"]]
                            if errs:
                                check["status"] = "review"
                                check["reason"] = "source_search_error"
                                check["source_error_count"] = len(errs)
                            elif not response.get("success"):
                                check["status"] = "review"
                                check["reason"] = "search_failed"
                            elif len(hits) == 1 and normalized_document(hits[0].get("doc_number")) == normalized_document(number):
                                check["status"] = "passed"
                                check["reason"] = "exact_id_and_document_number_found"
                            else:
                                check["status"] = "failed"
                                check["reason"] = "exact_document_not_found_or_mismatched"
                                check["matching_ids"] = [x.get("id") for x in response.get("results", [])][:10]
                        except Exception as e:
                            check["status"] = "review"
                            check["reason"] = f"search_exception:{type(e).__name__}"
                        check["elapsed_s"] = round(time.monotonic() - start, 2)
                        report["search_samples"].append(check)
                        print(f'[SEARCH] {check["id"]} {check["status"]} {check.get("reason")}', flush=True)

    report["counts"] = dict(Counter(x["status"] for x in report["cases"]))
    report["search_counts"] = dict(Counter(x["status"] for x in report["search_samples"]))
    report["coverage"] = {
        "independent_page_checks": len(report["cases"]),
        "successful_get": sum(x["mcp_get_success"] for x in report["cases"]),
        "fully_verified": report["counts"].get("passed", 0),
        "search_examples": len(report["search_samples"]),
    }
    report["stage2_accepted"] = (
        len(report["cases"]) == STAGE2_EXPECTED
        and report["counts"].get("failed", 0) == 0
        and report["counts"].get("review", 0) == 0
        and len(report["search_samples"]) == len(SEARCH_SAMPLES)
        and all(x["status"] == "passed" for x in report["search_samples"])
        and report["counts"].get("passed", 0) == STAGE2_EXPECTED
    )
    report["decision_note"] = (
        "This tests document existence/metadata/full-text extraction and source status labels; "
        "it does not establish that an interpretation remains legally effective, "
        "or that the curated interpretive summaries are legally correct."
    )
    return report


def selftest():
    assert len(checked_records()) == 21
    assert parse_date("民國 76 年 05 月 20 日") == "1987-05-20"
    assert normalized_document("（76）法保字第8432號") == normalized_document("(76)法保字第8432號")
    assert not require_official_url("https://mojlaw.moj.gov.tw.evil.test/LawContentExShow.aspx?id=FE075557&type=E", "FE075557")
    assert require_official_url("https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE075557&type=E", "FE075557")
    sample = '<div class="div-extent"><div class="col-row"><div class="col-th">發文字號</div><div class="col-td">測試字第123號</div></div></div>'
    assert official_page(sample)["doc_number"] == "測試字第123號"
    assert case_status(
        {"id":"moj:FE1","sourceRecordId":"FE1","sourceUrl":"https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE1&type=E",
         "officialDocumentNo":"測試字第123號","issuedAt":"2020-01-01","issuingAgency":"法務部"},
        {"success":True,"id":"moj:FE1","source_url":"https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE1&type=E",
         "doc_number":"測試字第123號","date":"2020-01-01","agency":"法務部","full_text":"測試全文"},
        {"has_form":True,"doc_number":"測試字第123號","date":"2020-01-01","agency":"法務部",
         "has_full_text":True,"full_text":"測試全文","official_stopped_label":False},
    )[0] == "passed"
    print("Stage-2 offline metadata, source and validity safeguards passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("selftest", "live"))
    parser.add_argument("--no-search", action="store_true", help="Skip search examples; still audit 21 direct IDs")
    args = parser.parse_args()
    if args.mode == "selftest":
        selftest()
        sys.exit(0)
    try:
        results = asyncio.run(run_audit(search=not args.no_search))
    except Exception as exc:
        results = {"stage2_accepted": False, "fatal_error": type(exc).__name__ + ": " + str(exc)[:300]}
        REPORT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise
    REPORT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"counts": results["counts"], "search_counts": results["search_counts"],
                      "stage2_accepted": results["stage2_accepted"]}, ensure_ascii=False, indent=2))
    if results["counts"].get("failed", 0):
        sys.exit(1)
