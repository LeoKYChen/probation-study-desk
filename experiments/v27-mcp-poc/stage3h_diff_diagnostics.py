#!/usr/bin/env python3
"""Stage3h: diagnose two already-known public adult judgments' extraction deltas.

No court text, html, names, party data, or content excerpts leave process memory.
Only lengths, HTML section presence, numeric edit ranges and bounded booleans
are included in logs and JSON. One official GET + one MCP GET per case.
"""
import argparse
import asyncio
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from bs4 import BeautifulSoup
from stage1_accuracy import unpack

SAMPLES = (
    ("J01", "TPSM,114,台抗,2605,20251231,1", "2605"),
    ("J03", "TPSM,114,台抗,2657,20251231,1", "2657"),
)
MAX_HTML_BYTES = 800_000
REPORT = Path("v27-mcp-stage3h-difference-diagnostics.json")
PIN = "ef677ad63c3206fc211a083fad8b1d9ef5015222"
OFFICIAL_HOST = "judgment.judicial.gov.tw"
BODY_CLASSES = (".htmlcontent", ".text-pre", ".jud_content")


def norm(value):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value or "")))


def strict_source(url, jid):
    parsed = urlparse(str(url or ""))
    qs = parse_qs(parsed.query)
    return bool(
        parsed.scheme == "https" and parsed.hostname == OFFICIAL_HOST
        and parsed.path.lower() == "/fjud/data.aspx"
        and not parsed.username and not parsed.password and not parsed.port
        and qs.get("ty") == ["JD"] and qs.get("id") == [jid]
        and set(qs) == {"ty", "id"}
    )


def official_sections(html):
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one("#jud")
    if root is None:
        return None, "official_jud_node_missing"
    body, name = None, None
    for selector in BODY_CLASSES:
        section = root.select_one(selector)
        if section is not None and len(norm(section.get_text(" ", strip=True))) >= 150:
            body, name = section, selector.lstrip(".")
            break
    if body is None:
        return None, "official_substantial_body_block_missing"
    return {
        "root": root.get_text(strip=False),
        "body": body.get_text(strip=False),
        "body_selector": name,
        "root_children_count": len(root.find_all(recursive=False)),
        "metadata_rows": len(root.select(".row")),
        "body_contains_court": "最高法院" in norm(body.get_text(strip=False)),
        "body_has_main_and_reason": all(
            token in norm(body.get_text(strip=False)) for token in ("主文", "理由")
        ),
    }, "official_source_sections_retrieved"


def diff_outline(first, second):
    """Whole-text edit coordinates ONLY, never substring values or hashes."""
    a, b = norm(first), norm(second)
    prefix = 0
    while prefix < min(len(a), len(b)) and a[prefix] == b[prefix]:
        prefix += 1
    suffix = 0
    while (suffix < min(len(a), len(b))-prefix and
           a[len(a)-suffix-1] == b[len(b)-suffix-1]):
        suffix += 1
    operations = []
    for op, i, j, k, l in SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        operations.append({"kind": op, "mcp_start": i, "mcp_chars": j-i,
                           "official_start": k, "official_chars": l-k})
    return {
        "mcp_chars": len(a), "official_chars": len(b),
        "exact_normalized": a == b,
        "common_prefix_chars": prefix,
        "common_suffix_chars": suffix,
        "edit_regions": len(operations),
        "first_edits": operations[:8], # bounded, positions and lengths only
        "total_mcp_chars_changed": sum(x["mcp_chars"] for x in operations),
        "total_official_chars_changed": sum(x["official_chars"] for x in operations),
    }


def diagnostic(mcp_full, sections, official_case_number):
    root = norm(sections["root"])
    body = norm(sections["body"])
    mcp = norm(mcp_full)
    # Separate the DOM's body from its metadata/header without trusting the
    # third-party extractor to identify the correct content boundary.
    body_identified = (
        sections["body_contains_court"]
        and sections["body_has_main_and_reason"]
        and "114" in body and "台抗" in body and official_case_number in body
    )
    evidence = {
        "body_selector": sections["body_selector"],
        "official_metadata_rows": sections["metadata_rows"],
        "official_root_chars": len(root),
        "official_body_chars": len(body),
        "mcp_chars": len(mcp),
        "body_identity_confirmed": body_identified,
        "body_contiguous_in_dom": bool(body and body in root),
        "body_contiguous_in_mcp": bool(body and body in mcp),
        "root_normalized_exact": bool(root and mcp == root),
        "body_normalized_exact": bool(body and mcp == body),
        "root_mcp_outline": diff_outline(mcp, root),
        "body_mcp_outline": diff_outline(mcp, body),
    }
    # A normalized exact root capture PLUS an exactly included independently
    # selected original body can pass a *text-capture fidelity* subtest only.
    # It does not establish a legal full-text version, appeal status, or
    # current public accessibility at user click time.
    if not body_identified or len(body) < 500:
        evidence["status"] = "review"
        evidence["reason"] = "official_body_identity_unconfirmed"
    elif evidence["root_normalized_exact"] and evidence["body_contiguous_in_mcp"]:
        evidence["status"] = "passed"
        evidence["reason"] = "mcp_captures_exact_dom_text_including_document_body"
        evidence["court_body_fidelity_verified"] = True
    elif evidence["body_normalized_exact"]:
        evidence["status"] = "passed"
        evidence["reason"] = "mcp_captures_exact_official_body_text"
        evidence["court_body_fidelity_verified"] = True
    elif evidence["body_contiguous_in_mcp"] and evidence["body_contiguous_in_dom"]:
        evidence["status"] = "review"
        evidence["reason"] = "body_contiguous_but_extra_noncanonical_text_unclassified"
        evidence["court_body_fidelity_verified"] = False
    else:
        evidence["status"] = "review"
        evidence["reason"] = "text_difference_within_body_or_noncontiguous"
        evidence["court_body_fidelity_verified"] = False
    return evidence


async def direct_official_html(client, jid):
    url = ("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
           + urlencode({"ty": "JD", "id": jid}))
    assert strict_source(url, jid)
    async with client.stream("GET", url) as response:
        if not strict_source(str(response.url), jid):
            return None, "official_origin_or_identifier_redirect"
        if response.status_code != 200:
            return None, f"official_http_{response.status_code}"
        parts, total = [], 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > MAX_HTML_BYTES:
                return None, "official_response_over_size_cap"
            parts.append(chunk)
        return b"".join(parts), "official_html_available"


async def audit():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    report = {
        "phase": "v2.7 stage3h bounded public adult judgment body difference diagnosis",
        "utc": datetime.now(timezone.utc).isoformat(),
        "pinned_mcp": PIN, "cases": [],
        "individual_links_approved": False,
        "stage3_accepted": False,
        "actual_api_auth_attempted": False,
        "court_text_saved": False,
        "juvenile_records_requested": False,
        "scope": "original two known samples only, one direct official GET each",
    }
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(40, connect=12), follow_redirects=False,
        headers={"User-Agent": "v27-independent-readonly-diagnostics/1",
                 "Accept-Encoding": "identity"}
    ) as official:
        async with stdio_client(StdioServerParameters(
            command=sys.executable, args=["-m", "mcp_server.server"]
        )) as (rd, wr):
            async with ClientSession(rd, wr) as session:
                await asyncio.wait_for(session.initialize(), timeout=45)
                for label, jid, case_no in SAMPLES:
                    row = {"id": label, "status": "review",
                           "individual_publication_status_verified": False}
                    try:
                        html, reason = await asyncio.wait_for(
                            direct_official_html(official, jid), timeout=55)
                        if not html:
                            row["reason"] = reason
                        else:
                            sections, why = official_sections(html)
                            if sections is None:
                                row["reason"] = why
                            else:
                                answer = unpack(await asyncio.wait_for(
                                    session.call_tool("get_judgment", {"jid": jid}),
                                    timeout=155))
                                row["mcp_success"] = answer.get("success") is True
                                row["mcp_was_cached"] = answer.get("cached")
                                if not row["mcp_success"]:
                                    row["reason"] = "mcp_unavailable"
                                elif not strict_source(answer.get("source_url"), jid):
                                    row.update(status="failed",
                                               reason="mcp_source_url_untrusted_or_wrong_jid")
                                else:
                                    delta = diagnostic(answer.get("full_text", ""),
                                                       sections, case_no)
                                    row.update(delta)
                    except Exception as exc:
                        row["status"] = "review"
                        row["reason"] = "diagnostic_exception:" + type(exc).__name__
                    report["cases"].append(row)
                    print(label, row["status"], row.get("reason"),
                          "mcp",row.get("mcp_chars"),
                          "dom",row.get("official_root_chars"),
                          "body",row.get("official_body_chars"),
                          "dom_equal", row.get("root_normalized_exact"),
                          "body_contiguous", row.get("body_contiguous_in_mcp"),
                          flush=True)
                    await asyncio.sleep(1)
    report["counts"] = {s: sum(x["status"] == s for x in report["cases"])
                        for s in ("passed", "review", "failed")}
    report["stage3_accepted"] = False
    report["individual_links_approved"] = False
    report["note"] = ("Passing text capture is not a guarantee of appeal finality, "
                      "real-time publication or withdrawal compliance.")
    return report


def selftest():
    title = "最高法院刑事裁定114年度台抗字第2605號"
    text = title + ("合成主文內容合成理由內容合成裁判內容" * 45)
    html = ("<div id='jud'><div class='row'><div class='col-th'>裁判字號</div>"
            "<div class='col-td'>合成字號</div></div>"
            "<div class='text-pre'>" + text + "</div></div>").encode("utf-8")
    sections, reason = official_sections(html)
    assert reason == "official_source_sections_retrieved"
    assert sections["body_selector"] == "text-pre"
    assert diff_outline(sections["root"], sections["root"])["edit_regions"] == 0
    assert diff_outline("AAA" + text, text)["edit_regions"] == 1
    good = diagnostic(sections["root"], sections, "2605")
    assert good["status"] == "passed" and good["body_contiguous_in_mcp"]
    other = diagnostic(text.replace("理由", "XXX", 1), sections, "2605")
    assert other["status"] == "review" and not other["court_body_fidelity_verified"]
    extra = diagnostic("FAKE_EXTRA" + sections["root"], sections, "2605")
    assert extra["status"] == "review"
    assert "FAKE_EXTRA" not in json.dumps(extra)
    assert not strict_source("https://judgment.judicial.gov.tw.evil.test/FJUD/data.aspx"
                             "?ty=JD&id=" + SAMPLES[0][1], SAMPLES[0][1])
    assert strict_source("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
                         + urlencode({"ty": "JD", "id": SAMPLES[0][1]}),
                         SAMPLES[0][1])
    print("Stage3h official-structure and content-free diff fixtures passed", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("selftest","live"),required=True)
    mode = ap.parse_args().mode
    if mode == "selftest":
        selftest()
    else:
        try:
            result = asyncio.run(audit())
        except Exception as exc:
            result = {"fatal_error": type(exc).__name__, "stage3_accepted": False,
                      "individual_links_approved": False}
        REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n",
                          encoding="utf-8")
        print(json.dumps({key:result.get(key) for key in
                         ("counts","stage3_accepted","fatal_error")},ensure_ascii=False),
              flush=True)
        if result.get("fatal_error") or result.get("counts",{}).get("failed",0):
            sys.exit(1)
