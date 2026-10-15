#!/usr/bin/env python3
"""v2.7 stage-1 read-only MCP legal accuracy pilot.

20 independently reported checks. A passing CI run alone does NOT authorize
production integration; a 2026-10-02 MOJ snapshot is a dated baseline, not
proof that all provisions remain current.
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
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BASELINE_PATH = PROJECT_ROOT / "development/v2.7/laws.json"
REPORT_PATH = Path("v27-mcp-stage1-report.json")
EXPECTED_CASES = 20
UPSTREAM_COMMIT = "ef677ad63c3206fc211a083fad8b1d9ef5015222"
SNAPSHOT_CHECKS = [
    ("C0010011", "少年事件處理法", "1"),
    ("C0010011", "少年事件處理法", "2"),
    ("C0010011", "少年事件處理法", "3"),
    ("C0010011", "少年事件處理法", "3-1"),
    ("C0010011", "少年事件處理法", "3-2"),
    ("C0010011", "少年事件處理法", "3-3"),
    ("C0010011", "少年事件處理法", "3-4"),
    ("C0010011", "少年事件處理法", "29"),
    ("I0030002", "保安處分執行法", "1"),
    ("I0030002", "保安處分執行法", "2"),
    ("I0030002", "保安處分執行法", "10"),
    ("I0030002", "保安處分執行法", "11"),
]


def normalized(text):
    """Ignore spaces and presentational full-width variations, not words."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(text or "")))


def unpack(response):
    """MCP responses can put JSON in structuredContent or text content."""
    if bool(getattr(response, "is_error", getattr(response, "isError", False))):
        return {"success": False, "error": "MCP transport returned is_error"}
    candidates = [getattr(response, "structuredContent", None)]
    candidates.extend(getattr(x, "text", "") for x in (response.content or []))
    for obj in candidates:
        if not obj:
            continue
        if isinstance(obj, str):
            try:
                obj = json.loads(obj)
            except (ValueError, TypeError):
                continue
        if isinstance(obj, dict):
            for key in ("result", "data"):
                if isinstance(obj.get(key), dict) and "success" in obj[key]:
                    obj = obj[key]
                    break
            if "success" in obj:
                return obj
    raise ValueError("MCP 回應沒有可判讀的 success 欄位，不能當成成功")


def article_of(payload, number):
    wanted = str(number).replace("之", "-")
    for a in payload.get("articles", []):
        no = str(a.get("number", "")).strip().replace("之", "-")
        if no == wanted:
            return a
    return None


def official_source(payload):
    url = payload.get("source_url", "")
    parsed = urlparse(url)
    return bool(parsed.scheme == "https" and parsed.hostname == "law.moj.gov.tw"), url


def validate_article(payload, pcode, number):
    law = payload.get("law") or {}
    if payload.get("success") is not True:
        raise AssertionError("MCP 未成功取得條文（可能為來源連線失敗）")
    if law.get("pcode") != pcode:
        raise AssertionError("法律識別碼不符：" + str(law.get("pcode")))
    art = article_of(payload, number)
    if not art:
        raise AssertionError("缺少指定條號：" + number)
    if len(normalized(art.get("content"))) < 6:
        raise AssertionError("條文空白或疑似截斷")
    ok, url = official_source(payload)
    if not ok:
        raise AssertionError("來源網址不是法務部官方 HTTPS 網站：" + str(url))
    return art, url


def load_baseline():
    dataset = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    if dataset.get("schemaVersion") != 1 or len(dataset.get("articles", [])) != 223:
        raise ValueError("v2.7 對照資料版本或數量與先前驗證基準不符")
    lookup = {(x["id"], x["articleKey"]): x for x in dataset["articles"]}
    if len(lookup) != len(dataset["articles"]):
        raise ValueError("舊版快照有重複法規條號")
    return dataset, lookup


async def run_live():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    snapshot, baseline = load_baseline()
    report = {
        "phase": "v2.7 × MCP stage 1 / legal accuracy",
        "upstream_commit": UPSTREAM_COMMIT,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "baseline_source": snapshot.get("source"),
        "baseline_date": snapshot.get("sourceUpdateDate"),
        "baseline_is_current_official_version": "NOT_VERIFIED",
        "total_planned": EXPECTED_CASES,
        "cases": [],
        "stage1_accepted": False,
    }

    async with stdio_client(StdioServerParameters(command=sys.executable, args=["-m", "mcp_server.server"])) as (read, write):
        async with ClientSession(read, write) as session:
            await asyncio.wait_for(session.initialize(), timeout=45)

            async def run_case(case_id, category, description, tool, args, verify):
                started = time.monotonic()
                item = {"id": case_id, "category": category, "description": description,
                        "tool": tool, "status": "failed", "official_link": None}
                try:
                    response = await asyncio.wait_for(session.call_tool(tool, args), timeout=110)
                    data = unpack(response)
                    result = verify(data)
                    if result:
                        item.update(result)
                    if item["status"] == "failed":
                        item["status"] = "passed"
                except (Exception, AssertionError) as exc:
                    item["status"] = "failed"
                    item["reason"] = f"{type(exc).__name__}: {str(exc)[:400]}"
                item["elapsed_s"] = round(time.monotonic() - started, 2)
                report["cases"].append(item)
                print(f'[{len(report["cases"]):02d}/{EXPECTED_CASES}] {item["id"]} {item["status"]} ({item["elapsed_s"]}s) {item.get("reason", "")}', flush=True)

            for idx, (pcode, name, number) in enumerate(SNAPSHOT_CHECKS, 1):
                def verify_snapshot(data, pcode=pcode, number=number):
                    art, link = validate_article(data, pcode, number)
                    baseline_row = baseline[(pcode, number)]
                    if normalized(art["content"]) != normalized(baseline_row["body"]):
                        raise AssertionError("與2026-10-02官方法規快照條文不一致；可能是修法或擷取問題，必須人工核對")
                    return {"official_link": link, "comparison": "dated_official_snapshot_exact_text"}
                await run_case(
                    f"S{idx:02d}", "snapshot",
                    f"{name}第{number}條與既有官方快照逐字比較",
                    "query_regulation",
                    {"pcode": pcode, "article_no": number},
                    verify_snapshot,
                )

            def verify_external(pcode, number, keyword):
                def _inner(data):
                    art, link = validate_article(data, pcode, number)
                    if keyword not in normalized(art.get("content")):
                        raise AssertionError("缺少法條識別關鍵字（仍需獨立官方原文核對）")
                    return {"official_link": link, "comparison": "live_source_and_keyword_only",
                            "status": "review"}
                return _inner

            await run_case("E13", "expanded_law", "中華民國刑法第320條（原站未收錄）",
                           "query_regulation", {"law_name": "中華民國刑法", "article_no": "320"},
                           verify_external("C0000001", "320", "竊盜"))
            await run_case("E14", "expanded_law", "刑事訴訟法第95條（原站未收錄）",
                           "query_regulation", {"law_name": "刑事訴訟法", "article_no": "95"},
                           verify_external("C0010001", "95", "告知"))

            def verify_pcode(expected):
                def _inner(data):
                    if data.get("success") is not True or data.get("pcode") != expected:
                        raise AssertionError("法規簡稱解析的 pcode 不正確")
                    return {"comparison": "bundled_pcode_mapping"}
                return _inner

            await run_case("A15", "alias", "少事法簡稱應解析為少年事件處理法",
                           "get_pcode", {"law_name": "少事法"}, verify_pcode("C0010011"))
            await run_case("A16", "alias", "刑法簡稱應解析為中華民國刑法",
                           "get_pcode", {"law_name": "刑法"}, verify_pcode("C0000001"))

            def verify_range(data):
                if data.get("success") is not True:
                    raise AssertionError("條文區間檢索失敗")
                if (data.get("law") or {}).get("pcode") != "C0010011":
                    raise AssertionError("區間法規不正確")
                for number in ["3-1", "3-2", "3-3", "3-4"]:
                    art = article_of(data, number)
                    if not art or normalized(art.get("content")) != normalized(baseline[("C0010011", number)]["body"]):
                        raise AssertionError("區間缺漏或內容不符：" + number)
                link_ok, link = official_source(data)
                if not link_ok:
                    raise AssertionError("區間來源非官方")
                return {"official_link": link, "comparison": "range_vs_four_snapshot_articles"}

            await run_case("R17", "range", "查詢少事法第3條之1至第3條之4",
                           "query_regulation", {"pcode": "C0010011", "article_no": "3-1~3-4"},
                           verify_range)

            def verify_missing(data):
                if data.get("success") is not False:
                    raise AssertionError("不存在的法規不應回傳成功或猜測相似法規")
                return {"comparison": "known_nonexistent_law"}
            await run_case("N18", "negative", "不存在的法規不得自行捏造",
                           "query_regulation", {"law_name": "不存在的法規測試名稱XYZ_202610", "article_no": "1"},
                           verify_missing)

            def verify_outline(data):
                if data.get("success") is not True or (data.get("law") or {}).get("pcode") != "C0010011":
                    raise AssertionError("法規目錄查詢失敗")
                if len(data.get("articles", [])) != 0:
                    raise AssertionError("沒有指定條文卻輸出條文全文")
                if not isinstance(data.get("article_count"), int) or data["article_count"] < 100:
                    raise AssertionError("未回傳正確的條文數量")
                ok, link = official_source(data)
                if not ok:
                    raise AssertionError("目錄未指向法務部官方網站")
                return {"official_link": link, "comparison": "outline_metadata_only"}
            await run_case("O19", "outline", "查詢少年事件處理法目錄不應冒充單條全文",
                           "query_regulation", {"pcode": "C0010011"}, verify_outline)

            def verify_history(data):
                art, link = validate_article(data, "C0010011", "3-1")
                if normalized(art["content"]) != normalized(baseline[("C0010011", "3-1")]["body"]):
                    raise AssertionError("帶歷史資訊查詢時，現行法條被更動")
                history = data.get("history")
                article_history = data.get("article_history")
                if not history:
                    raise AssertionError("未附法規歷次修正沿革")
                # Article history may be unavailable if the official old-version endpoint
                # failed; do not silently mark historical comparison as passed.
                if not article_history or (isinstance(article_history, dict) and article_history.get("available") is False):
                    return {"official_link": link, "status": "review",
                            "comparison": "law_history_available_article_history_unverified",
                            "reason": "有修法沿革，但條文歷史版本尚未完整取得／核對"}
                return {"official_link": link, "status": "review",
                        "comparison": "history_returned_not_yet_independently_verified",
                        "reason": "取得歷史資料；本輪尚未對官方歷次原文逐版本核對"}
            await run_case("H20", "history", "少事法第3條之1：現行條文與歷次沿革應區隔",
                           "query_regulation",
                           {"pcode": "C0010011", "article_no": "3-1", "include_history": True},
                           verify_history)

    report["counts"] = {key: sum(x["status"] == key for x in report["cases"])
                        for key in ("passed", "review", "failed")}
    report["checks_completed"] = len(report["cases"]) == EXPECTED_CASES
    report["critical_legal_discrepancies"] = [
        x["id"] for x in report["cases"]
        if x["status"] == "failed" and x["category"] in ("snapshot", "range", "expanded_law", "history")]
    report["stage1_accepted"] = (
        report["checks_completed"]
        and report["counts"]["passed"] >= 18
        and report["counts"]["failed"] == 0
        and report["counts"]["review"] == 0
        and report["baseline_is_current_official_version"] == "VERIFIED"
    )
    report["decision_note"] = (
        "Only 2026-10-02 official snapshot is independently compared. "
        "Extra-law keywords and old-law histories require separate verification; "
        "this pilot cannot alone approve production integration."
    )
    return report


def selftest():
    assert normalized("第 ３ 條之１\n通譯") == normalized("第3條之1通譯")
    assert article_of({"articles": [{"number": "3-1", "content": "通譯"}]}, "3-1") is not None
    assert article_of({"articles": [{"number": "3", "content": "A"}]}, "3-1") is None
    assert official_source({"source_url": "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=C0010011"})[0]
    assert not official_source({"source_url": "https://law.moj.gov.tw.evil.example/"} )[0]
    assert unpack(type("R", (), {"is_error": False, "structuredContent": {"success": True}, "content": []})())["success"]
    load_baseline()
    print("Offline validation checks passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("selftest", "live"))
    args = parser.parse_args()
    if args.mode == "selftest":
        selftest()
        sys.exit(0)
    try:
        results = asyncio.run(run_live())
        REPORT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"counts": results["counts"], "checks_completed": results["checks_completed"],
                          "stage1_accepted": results["stage1_accepted"],
                          "decision_note": results["decision_note"]}, ensure_ascii=False, indent=2))
        if not results["checks_completed"] or results["counts"]["failed"]:
            sys.exit(1)
    except Exception as exc:
        REPORT_PATH.write_text(json.dumps({"fatal_error": f"{type(exc).__name__}: {str(exc)[:500]}",
                                           "stage1_accepted": False}, ensure_ascii=False, indent=2), encoding="utf-8")
        raise
