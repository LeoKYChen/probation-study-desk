#!/usr/bin/env python3
"""Stage 3g: tiny read-only official-court provenance probe.

At most four GET requests in total, strictly official origins, no redirects,
no credentials, no API POST, no cookies, no retries, no scraping loops.
Never logs/saves court documents, party names, raw HTML or API PDF bytes.
GitHub Actions success only means the probe executed, not legal verification.
"""
import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx
from bs4 import BeautifulSoup

COURT_HOST = "judgment.judicial.gov.tw"
OPEN_DATA_HOST = "opendata.judicial.gov.tw"
HELP_URL = "https://judgment.judicial.gov.tw/readme.aspx"
SPEC_URL = "https://opendata.judicial.gov.tw/api/Newses/42/file"
# Previously observed publicly searchable *adult* Supreme Court cases from stage3a.
# These are bounded availability checks, NOT indexed or saved court documents.
FIXTURES = (
    ("J01", "TPSM,114,台抗,2605,20251231,1", "2605"),
    ("J03", "TPSM,114,台抗,2657,20251231,1", "2657"),
)
MAX_REQUESTS = 4
MAX_BYTES = 400000
REPORT = Path("v27-mcp-stage3g-origin-report.json")


def official_origin(url, host):
    p = urlparse(str(url or ""))
    return (p.scheme == "https" and p.hostname == host
            and not p.username and not p.password and not p.port)


def requests_to_check():
    routes = [
        {"id": "P01", "kind": "court_help", "url": HELP_URL},
        {"id": "P02", "kind": "api_document", "url": SPEC_URL},
    ]
    for label, jid, no in FIXTURES:
        path = "https://judgment.judicial.gov.tw/FJUD/data.aspx?"
        path += urlencode({"ty": "JD", "id": jid})
        routes.append({"id": label, "kind": "adult_public_case_page",
                       "url": path, "expected_case_no": no})
    assert len(routes) == MAX_REQUESTS
    return routes


def html_judgment_evidence(body, expected_case_no):
    dom = BeautifulSoup(body, "html.parser")
    section = dom.select_one("#jud")
    if section is None:
        return {"body_node_found": False,
                "case_text_candidate": False,
                "reason": "case_document_node_missing"}
    text = re.sub(r"\s+", "", section.get_text(" ", strip=True))
    identity = ("最高法院" in text and "114" in text
                and "台抗" in text and expected_case_no in text)
    candidate = (identity and len(text) >= 1000
                 and "主文" in text and "理由" in text)
    return {"body_node_found": bool(text), "case_identity_in_body": identity,
            "case_text_candidate": candidate,
            "reason": "case_body_detected_needs_independent_text_comparison"
            if candidate else "case_body_incomplete_or_identity_not_confirmed"}


def classify(route, status, actual_url, data, truncated=False):
    kind = route["kind"]
    host = OPEN_DATA_HOST if kind == "api_document" else COURT_HOST
    record = {"id": route["id"], "kind": kind,
              "status": "review", "http_status": status,
              "source_origin_official": official_origin(actual_url, host),
              "individual_judgment_verified": False,
              "original_document_stored": False,
              "actual_judicial_api_invoked": False}
    if not record["source_origin_official"]:
        record.update(status="failed", reason="non_official_origin")
    elif status in (301, 302, 303, 307, 308):
        record["reason"] = "redirect_not_followed"
    elif status in (401, 403, 429, 503):
        record["reason"] = "official_site_unavailable_or_access_restricted"
    elif status != 200:
        record["reason"] = "official_http_non200"
    elif truncated:
        record["reason"] = "body_larger_than_safety_cap"
    elif kind == "api_document":
        correct = data.startswith(b"%PDF-") and len(data) > 1000
        record.update(status="passed" if correct else "review",
                      reason="official_api_spec_pdf_accessible"
                      if correct else "api_spec_not_confirmed")
    elif kind == "court_help":
        words = BeautifulSoup(data, "html.parser").get_text(" ", strip=True)
        correct = ("裁判書" in words and "系統說明" in words and len(words) > 400)
        record.update(status="passed" if correct else "review",
                      reason="official_court_help_accessible"
                      if correct else "court_help_content_not_confirmed")
    else:
        parsed = html_judgment_evidence(data, route["expected_case_no"])
        record.update(parsed)
        # Even if a candidate case body is visible, without an independent
        # full text match and live withdrawal check this must remain REVIEW.
        record["status"] = "review"
    return record


async def get_once(client, route):
    host = OPEN_DATA_HOST if route["kind"] == "api_document" else COURT_HOST
    assert official_origin(route["url"], host)
    try:
        async with client.stream("GET", route["url"]) as response:
            contents = bytearray()
            truncated = False
            async for piece in response.aiter_bytes():
                if len(contents) + len(piece) > MAX_BYTES:
                    contents.extend(piece[:max(0, MAX_BYTES-len(contents))])
                    truncated = True
                    break
                contents.extend(piece)
            return classify(route, response.status_code,
                            str(response.url), bytes(contents), truncated)
    except Exception as exc:
        return {"id": route["id"], "kind": route["kind"],
                "status": "review",
                "reason": "transport_exception:" + type(exc).__name__,
                "individual_judgment_verified": False,
                "actual_judicial_api_invoked": False}


async def live():
    out = {"phase": "Stage 3g / judicial official-source route assessment",
           "run_at_utc": datetime.now(timezone.utc).isoformat(),
           "max_requests": MAX_REQUESTS,
           "no_api_credentials": True,
           "no_real_judgment_text_saved": True,
           "no_juvenile_documents_requested": True,
           "official_api_auth_not_attempted": True,
           "individual_case_links_approved": False,
           "stage3_accepted": False,
           "cases": []}
    async with httpx.AsyncClient(timeout=httpx.Timeout(20, connect=9),
                                 follow_redirects=False, max_redirects=0,
                                 headers={"User-Agent": "v27-readonly-official-source-probe/1",
                                          "Accept-Encoding": "identity",
                                          "Cache-Control": "no-store"}) as client:
        for item in requests_to_check():
            response = await get_once(client, item)
            out["cases"].append(response)
            print(response["id"], response["status"], response["reason"], flush=True)
            await asyncio.sleep(1)
    out["counts"] = {s: sum(x["status"] == s for x in out["cases"])
                     for s in ("passed", "review", "failed")}
    out["portal_document_accessible"] = any(
        r["id"] == "P01" and r["status"] == "passed" for r in out["cases"])
    out["api_spec_accessible"] = any(
        r["id"] == "P02" and r["status"] == "passed" for r in out["cases"])
    out["court_case_body_candidates"] = sum(
        bool(r.get("case_text_candidate")) for r in out["cases"])
    out["individual_case_links_approved"] = False
    out["stage3_accepted"] = False
    out["note"] = ("HTTP 200 and case text candidates never constitute current "
                   "publication, withdrawal or exact full-text verification")
    return out


def offline_test():
    checks = requests_to_check()
    assert len(checks) == 4
    assert all("/jdg/api/" not in x["url"] for x in checks)
    case = checks[2]
    a = classify(case, 200, case["url"], b"<html><body>HTTP 200</body></html>")
    assert a["status"] == "review"
    assert not a["individual_judgment_verified"]
    assert a["reason"] == "case_document_node_missing"
    a = classify(case, 403, case["url"], b"")
    assert a["reason"] == "official_site_unavailable_or_access_restricted"
    a = classify(case, 302, case["url"], b"")
    assert a["reason"] == "redirect_not_followed"
    a = classify(case, 200, "https://evil.example/path", b"")
    assert a["status"] == "failed"
    a = classify(checks[1], 200, SPEC_URL, b"%PDF-1.7\n"+b"0"*1200)
    assert a["status"] == "passed"
    a = classify(checks[1], 200, SPEC_URL, b"<html>login</html>")
    assert a["status"] == "review"
    assert not official_origin(
        "https://judgment.judicial.gov.tw.evil.invalid/readme.aspx", COURT_HOST)
    fake = ("最高法院刑事裁定114年度台抗字第2605號主文理由"*40).encode("utf-8")
    a = classify(case, 200, case["url"], b"<div id='jud'>"+fake+b"</div>")
    assert a["status"] == "review" and not a["individual_judgment_verified"]
    assert a["case_text_candidate"] is True
    print("Stage3g official-source offline controls passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("selftest", "live"), required=True)
    args = parser.parse_args()
    if args.mode == "selftest":
        offline_test()
    else:
        try:
            result = asyncio.run(live())
        except Exception as exc:
            result = {"fatal_error": type(exc).__name__, "stage3_accepted": False,
                      "individual_case_links_approved": False}
        REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps({k: result.get(k) for k in
            ("counts", "portal_document_accessible", "api_spec_accessible",
             "court_case_body_candidates", "individual_case_links_approved",
             "stage3_accepted", "fatal_error")}, ensure_ascii=False), flush=True)
        if result.get("fatal_error") or result.get("counts", {}).get("failed", 0) > 0:
            sys.exit(1)
