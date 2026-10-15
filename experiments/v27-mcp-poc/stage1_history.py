#!/usr/bin/env python3
"""Targeted independent verification for v2.7 stage-1 H20 only.

Checks historical revision text against the official old-version HTML pages
without importing the third-party legal HTML parser or changing v2.7 assets.
"""
import argparse
import asyncio
import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from stage1_accuracy import article_of, load_baseline, normalized, unpack, validate_article

ROOT_URL = "https://law.moj.gov.tw/LawClass/"
LAW_PCODE = "C0010011"
LAW_ARTICLE = "3-1"
REPORT = Path("v27-mcp-stage1-history-report.json")


def get_old_article(html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    # Independently walk the public historical page, not upstream parse_law_all.
    for row in soup.select(".law-reg-content .row, div.row"):
        number_el = row.select_one(".col-no")
        body_el = row.select_one(".col-data")
        if not number_el or not body_el:
            continue
        m = re.search(r"第\s*(\d+(?:[-之]\d+)?)\s*條", number_el.get_text(" ", strip=True))
        if m and m.group(1).replace("之", "-") == LAW_ARTICLE:
            return body_el.get_text("", strip=True)
    for row in soup.select("tr"):
        cells = row.select("td")
        if len(cells) < 2:
            continue
        m = re.search(r"第\s*(\d+(?:[-之]\d+)?)\s*條", cells[0].get_text(" ", strip=True))
        if m and m.group(1).replace("之", "-") == LAW_ARTICLE:
            return cells[1].get_text("", strip=True)
    return None


def version_refs(html):
    return sorted(set(re.findall(r"lnndate=(\d{8})&(?:amp;)?lser=(\d+)", html)))


def hash_text(text):
    return hashlib.sha256(normalized(text).encode("utf-8")).hexdigest()


async def verify():
    import httpx
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    baseline_doc, baseline = load_baseline()
    expected_current = baseline[(LAW_PCODE, LAW_ARTICLE)]["body"]
    report = {
        "phase": "v2.7 stage 1 historical accuracy / H20",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "official_source": "https://law.moj.gov.tw/LawClass/LawOldVerList.aspx?pcode=C0010011",
        "baseline_date": baseline_doc["sourceUpdateDate"],
        "status": "review",
        "stage1_history_accepted": False,
        "revision_checks": [],
    }

    async with stdio_client(StdioServerParameters(command=sys.executable, args=["-m", "mcp_server.server"])) as (read, write):
        async with ClientSession(read, write) as session:
            await asyncio.wait_for(session.initialize(), timeout=45)
            reply = await asyncio.wait_for(session.call_tool("query_regulation", {
                "pcode": LAW_PCODE,
                "article_no": LAW_ARTICLE,
                "include_history": True,
            }), timeout=150)
            payload = unpack(reply)
            article, link = validate_article(payload, LAW_PCODE, LAW_ARTICLE)
            if normalized(article["content"]) != normalized(expected_current):
                report["reason"] = "現行條文與既有官方快照不一致"
                return report
            result = payload.get("article_history") or {}
            report["history_available"] = result.get("available")
            report["history_partial"] = result.get("partial", False)
            report["reported_revision_count"] = result.get("revision_count")
            report["failed_versions"] = result.get("failed_versions", [])
            revisions = result.get("revisions") or []
            report["history_revision_dates"] = [x.get("lnndate") for x in revisions]
            if not result.get("available") or result.get("partial") or result.get("failed_versions") or not revisions:
                report["reason"] = "上游歷次條文結果標示不完整，尚不能通過完整驗收"
                return report
            if result.get("revision_count") != len(revisions):
                report["reason"] = "上游回報的修正筆數與實際版本數不同"
                return report

            async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as http:
                listing = await http.get(ROOT_URL + "LawOldVerList.aspx", params={"pcode": LAW_PCODE})
                listing.raise_for_status()
                refs = version_refs(listing.text)
                report["official_archive_version_count"] = len(refs)
                if not refs:
                    report["reason"] = "官方歷史清單未取得版本識別碼（可能官方更動頁面）"
                    return report
                dates = [x.get("lnndate", "") for x in revisions]
                if any(not re.fullmatch(r"\d{8}", str(d)) for d in dates) or dates != sorted(dates):
                    report["reason"] = "修正版本日期缺漏或先後順序不正確"
                    return report

                for idx, rev in enumerate(revisions):
                    date = rev["lnndate"]
                    content = rev.get("content")
                    if not isinstance(content, str) or not content.strip():
                        report["reason"] = "版本缺少條文內容：" + date
                        return report
                    entry = {"date": date, "action": rev.get("action"),
                             "mcp_text_sha256": hash_text(content),
                             "verified": False}
                    pairs = [pair for pair in refs if pair[0] == date]
                    if pairs:
                        # There may be multiple serial numbers per publication day.
                        for lnndate, lser in pairs[:3]:
                            response = await http.get(ROOT_URL + "LawOldVer.aspx",
                                                      params={"pcode": LAW_PCODE, "lnndate": lnndate, "lser": lser})
                            response.raise_for_status()
                            actual = get_old_article(response.text)
                            if actual and normalized(actual) == normalized(content):
                                entry["verified"] = True
                                entry["source_kind"] = "official_old_version_html"
                                entry["source_url"] = str(response.url)
                                break
                    elif idx == len(revisions) - 1 and normalized(content) == normalized(expected_current):
                        # The official old-version list excludes the current revision.
                        live = await http.get(ROOT_URL + "LawSingle.aspx",
                                              params={"pcode": LAW_PCODE, "flno": LAW_ARTICLE})
                        live.raise_for_status()
                        # Independent current-text control already checked against the
                        # dated official bulk snapshot; require official HTML to exist.
                        entry["verified"] = "通譯" in live.text and "少年事件處理法" in live.text
                        entry["source_kind"] = "current_official_html_plus_snapshot"
                        entry["source_url"] = str(live.url)
                    report["revision_checks"].append(entry)
                    print(f'H20 revision {date}: {"verified" if entry["verified"] else "needs_review"}', flush=True)
                    if not entry["verified"]:
                        report["reason"] = "歷史版本無法逐字核對官方頁面：" + date
                        return report

    report["status"] = "passed"
    report["stage1_history_accepted"] = True
    report["reason"] = "所有回傳的變更版本均與對應官方歷史頁面或官方現行頁面核對"
    return report


def selftest():
    test_html = '<div class="law-reg-content"><div class="row"><div class="col-no">第 3-1 條</div><div class="col-data">測試內容。</div></div></div>'
    assert get_old_article(test_html) == "測試內容。"
    assert version_refs('<a href="LawOldVer.aspx?lnndate=20190619&amp;lser=001">歷史</a>') == [("20190619", "001")]
    assert hash_text("通\n譯") == hash_text("通譯")
    print("History verifier offline checks passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("selftest", "live"), required=True)
    args = parser.parse_args()
    if args.mode == "selftest":
        selftest()
        sys.exit(0)
    try:
        output = asyncio.run(verify())
    except Exception as exc:
        output = {"status": "failed", "stage1_history_accepted": False,
                  "reason": type(exc).__name__ + ": " + str(exc)[:500]}
    REPORT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": output["status"], "reason": output.get("reason"),
                      "revision_checks": len(output.get("revision_checks", []))}, ensure_ascii=False))
    if output["status"] != "passed":
        sys.exit(1)
