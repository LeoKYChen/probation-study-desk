#!/usr/bin/env python3
"""Isolated stage-0 MCP smoke check; no repo production data or credentials."""

import argparse
import asyncio
import json
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

EXPECTED_TOOLS = {
    "query_regulation",
    "get_pcode",
    "search_agency_interpretations",
    "search_judgments",
    "get_judgment",
    "get_legislative_history",
}
TOOL_BASELINE = 26
REPORT_PATH = Path("mcp-stage0-report.json")


def save(report: dict) -> None:
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


async def main(mode: str) -> dict:
    from mcp_server.server import mcp

    available = {tool.name for tool in await mcp.list_tools()}
    missing = sorted(EXPECTED_TOOLS - available)
    report = {
        "phase": "v2.7 MCP stage 0",
        "mode": mode,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "server_name": str(mcp.name),
        "tool_count": len(available),
        "missing_required_tools": missing,
        "introspection_passed": len(available) == TOOL_BASELINE and not missing,
        "official_query": "not_run",
        "approved_for_v27_integration": False,
    }
    if not report["introspection_passed"]:
        raise RuntimeError(f"工具數目或必要功能未符合基準：{report}")
    if mode == "inspect":
        return report

    # Verify a real round-trip via MCP stdio (not a direct Python function call).
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    server_params = StdioServerParameters(command=sys.executable, args=["-m", "mcp_server.server"])
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await asyncio.wait_for(session.initialize(), timeout=35)
            offered = await asyncio.wait_for(session.list_tools(), timeout=20)
            offered_names = {tool.name for tool in offered.tools}
            if "query_regulation" not in offered_names:
                raise RuntimeError("MCP 客戶端未找到 query_regulation")
            response = await asyncio.wait_for(
                session.call_tool(
                    "query_regulation",
                    {"law_name": "少年事件處理法", "article_no": "3-1"},
                ),
                timeout=90,
            )
            text_parts = [getattr(block, "text", "") for block in response.content]
            # MCP may return structuredContent or JSON embedded in text blocks.
            content = json.dumps(getattr(response, "structuredContent", None), ensure_ascii=False) + "\n" + "\n".join(text_parts)
            # MCP SDK exposes the field as is_error on this runtime; some
            # response formats use the wire alias isError. Handle both safely.
            mcp_error = bool(getattr(response, "is_error", getattr(response, "isError", False)))
            report["official_query"] = "passed" if (not mcp_error and "通譯" in content and "少年事件處理法" in content) else "failed"
            report["official_query_verified_terms"] = {
                "law_name": "少年事件處理法" in content,
                "article_keyword": "通譯" in content,
                "mcp_error": mcp_error,
            }
            if report["official_query"] != "passed":
                raise RuntimeError("法條查詢未回傳預期的官方條文要素；需人工核對查詢原文及失敗原因")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("inspect", "live"), required=True)
    args = parser.parse_args()
    outcome = {"phase": "v2.7 MCP stage 0", "mode": args.mode, "approved_for_v27_integration": False}
    try:
        outcome = asyncio.run(main(args.mode))
        save(outcome)
    except Exception as exc:
        outcome["status"] = "failed"
        outcome["error_type"] = type(exc).__name__
        outcome["error_message"] = str(exc)[:500]
        save(outcome)
        traceback.print_exc()
        sys.exit(1)
