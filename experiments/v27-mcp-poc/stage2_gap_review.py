#!/usr/bin/env python3
"""Focused follow-up for four historical MOJ records with missing full text.

Do not promote an official abstract into 'full_text'.
Outputs metadata and cryptographic hashes only, not body paragraphs.
"""
import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from stage1_accuracy import unpack
from stage2_interpretations import (
    checked_records, normalized, normalized_document, official_page,
    parse_date, require_official_url, sha256,
)

TARGET_IDS = {
    "moj:FE074147", "moj:FE076049", "moj:FE074362", "moj:FE074530"
}
REPORT = Path("v27-mcp-stage2-gaps-report.json")


async def audit():
    from bs4 import BeautifulSoup
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    targets = [x for x in checked_records() if x["id"] in TARGET_IDS]
    assert len(targets) == 4
    report = {"phase": "v2.7 MCP stage 2 targeted historical interpretation gaps",
              "run_at_utc": datetime.now(timezone.utc).isoformat(),
              "total": len(targets), "records": [], "full_text_coverage_passed": False}

    async with httpx.AsyncClient(timeout=40, follow_redirects=True) as official:
        async with stdio_client(StdioServerParameters(command=sys.executable, args=["-m", "mcp_server.server"])) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(), timeout=45)
                for index in targets:
                    rec = {"id": index["id"], "classification": "pending",
                           "official_url": index["sourceUrl"], "current_validity": "UNVERIFIED"}
                    try:
                        m = unpack(await asyncio.wait_for(session.call_tool(
                            "get_agency_interpretation",
                            {"interpretation_id": index["id"]}), timeout=100))
                        response = await official.get(index["sourceUrl"])
                        response.raise_for_status()
                        page = official_page(response.text)
                        soup = BeautifulSoup(response.text, "lxml")
                        original_summary = soup.select_one("#cp_content_EDATAtr pre")
                        official_summary = original_summary.get_text() if original_summary else ""
                        mcp_summary = str(m.get("summary") or "")
                        mcp_full = str(m.get("full_text") or "")
                        visible_page = soup.get_text(" ", strip=True)
                        rec.update({
                            "mcp_get_success": m.get("success") is True,
                            "mcp_doc_no_matches_index": normalized_document(m.get("doc_number")) == normalized_document(index["officialDocumentNo"]),
                            "official_doc_no_matches_index": normalized_document(page["doc_number"]) == normalized_document(index["officialDocumentNo"]),
                            "mcp_date_matches_index": str(m.get("date") or "") == index["issuedAt"],
                            "official_date_matches_index": page["date"] == index["issuedAt"],
                            "mcp_agency_matches_official": normalized_document(m.get("agency")) == normalized_document(page["agency"]),
                            "index_agency_matches_official": normalized_document(index["issuingAgency"]) == normalized_document(page["agency"]),
                            "mcp_source_url_matches_index": m.get("source_url") == index["sourceUrl"],
                            "official_has_full_text": page["has_full_text"],
                            "mcp_has_full_text": bool(normalized(mcp_full)),
                            "official_full_length": len(normalized(page["full_text"])),
                            "mcp_full_length": len(normalized(mcp_full)),
                            "official_has_abstract": bool(normalized(official_summary)),
                            "mcp_has_abstract": bool(normalized(mcp_summary)),
                            "official_abstract_sha256": sha256(official_summary) if official_summary else None,
                            "mcp_abstract_sha256": sha256(mcp_summary) if mcp_summary else None,
                            "abstract_exact_match": bool(official_summary and mcp_summary
                                                        and normalized(official_summary) == normalized(mcp_summary)),
                            "official_stop_label": page["official_stopped_label"],
                            "mcp_stop_label": m.get("status") or "NOT_LABELED",
                            "official_page_visible_text_length": len(normalized(visible_page)),
                        })
                        metadata_good = all(rec[key] for key in (
                            "mcp_get_success", "mcp_doc_no_matches_index",
                            "official_doc_no_matches_index", "mcp_date_matches_index",
                            "official_date_matches_index", "mcp_agency_matches_official",
                            "index_agency_matches_official", "mcp_source_url_matches_index",
                        ))
                        validity_good = (rec["mcp_stop_label"] == "停止適用") if rec["official_stop_label"] else (
                            rec["mcp_stop_label"] == "NOT_LABELED"
                        )
                        if not metadata_good or not validity_good:
                            rec["classification"] = "verified_metadata_discrepancy"
                        elif page["has_full_text"] and mcp_full:
                            rec["classification"] = "needs_fulltext_format_review"
                        elif rec["abstract_exact_match"]:
                            rec["classification"] = "official_abstract_only"
                        else:
                            rec["classification"] = "official_abstract_unavailable_or_mismatch"
                    except Exception as e:
                        rec["classification"] = "retrieval_error"
                        rec["error_type"] = type(e).__name__
                        rec["error_detail"] = str(e)[:250]
                    report["records"].append(rec)
                    print(rec["id"], rec["classification"],
                          "full_original="+str(rec.get("official_full_length")),
                          "abstract_verified="+str(rec.get("abstract_exact_match")), flush=True)
    report["full_text_coverage_passed"] = all(
        x["classification"] == "fully_verified_full_text" for x in report["records"]
    )
    report["gaps_with_verified_official_abstract_only"] = sum(
        x["classification"] == "official_abstract_only" for x in report["records"]
    )
    report["stage2_accepted"] = False
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["selftest", "live"], required=True)
    args = parser.parse_args()
    if args.mode == "selftest":
        assert len([r for r in checked_records() if r["id"] in TARGET_IDS]) == 4
        print("Four-interpretation focus fixtures verified")
    else:
        try:
            report = asyncio.run(audit())
        except Exception as err:
            report = {"fatal_error": type(err).__name__ + ": " + str(err)[:300],
                      "stage2_accepted": False}
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps({"classifications": {r["id"]:r["classification"] for r in report.get("records", [])},
                          "stage2_accepted": report["stage2_accepted"]}, ensure_ascii=False, indent=2))
        if "fatal_error" in report or any(r["classification"] in (
            "verified_metadata_discrepancy", "retrieval_error") for r in report.get("records", [])):
            sys.exit(1)
