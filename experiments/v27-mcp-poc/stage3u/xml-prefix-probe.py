#!/usr/bin/env python3
"""Stage 3u: one allowlisted official public RAW_XML download metadata probe.

This script MUST NOT download a dataset. HEAD is mandatory before GET, GET is
sent only if Content-Length is known and <= 8 MiB, requests only the first
12 KiB, and reads no more than 12,289 bytes. If Range is ignored, it closes
the connection without reading the remainder. It never saves legal text or
identifiers; reports only XML ELEMENT NAMES at first few levels. HTML errors,
ZIP/GZIP, redirects, DTD and entities all fail closed. Even a successful
prefix probe is NOT a complete XML/schema/official-current-law verification.

Source: https://data.gov.tw/dataset/18289 (XML link: DType=RAW_XML).
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import (
    HTTPSHandler, HTTPRedirectHandler, Request, build_opener
)
from xml.parsers import expat

SOURCE = "https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData=CF&DType=RAW_XML"
SOURCE_HOST = "sendlaw.moj.gov.tw"
MAX_WHOLE_BYTES = 8 * 1024 * 1024
PREFIX_BYTES = 12 * 1024
TIMEOUT_SECONDS = 9
LIMIT_TAGS = 20
OUTPUT = Path("stage3u-xml-source-structure-summary.json")
TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_.-]{0,49}\Z")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def approved_url(url: str) -> bool:
    if url != SOURCE:
        return False
    p = urlsplit(url)
    return (
        p.scheme == "https" and p.hostname == SOURCE_HOST
        and p.username is None and p.password is None
        and p.port is None and not p.fragment
        and p.path == "/PublicData/GetFile.ashx"
        and p.query == "AuData=CF&DType=RAW_XML"
    )


def base():
    return {
        "status": "review",
        "reason": "not_started",
        "head_code": None,
        "head_content_length": None,
        "range_get_code": None,
        "range_honored": None,
        "bytes_inspected": 0,
        "root_tag": None,
        "first_child_tag": None,
        "shallow_tag_names": [],
        "xml_prefix_structure_observed": False,
        "xml_document_complete": False,
        "actual_xml_field_values_verified": False,
        "official_xml_schema_verified": False,
        "law_current_effect_verified": False,
        "stat_modified_equals_promulgation": False,
        "article_commencement_inferred": False,
        "full_dataset_downloaded": False,
        "pdf_downloaded": False,
        "nonpublic_juvenile_data_accessed": False,
        "member_api_used": False,
        "stage3_accepted": False
    }


def inspect_prefix(blob: bytes) -> dict:
    """Parse XML *prefix only*. Never read element text or attribute values."""
    report = base()
    report["bytes_inspected"] = len(blob)
    if not blob or len(blob) > PREFIX_BYTES:
        report["reason"] = "empty_or_above_prefix_limit"
        return report
    start = blob.lstrip(b"\xef\xbb\xbf \t\r\n")
    if start.startswith(b"PK\x03\x04"):
        report["reason"] = "zip_content_not_xml_no_extraction"
        return report
    if start.startswith(b"\x1f\x8b"):
        report["reason"] = "gzip_content_not_xml_no_extraction"
        return report
    if not start.startswith(b"<"):
        report["reason"] = "not_xml_start"
        return report
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", start, flags=re.IGNORECASE):
        report["reason"] = "dtd_or_entity_declaration_forbidden"
        return report
    if re.search(br"<html\b|<!doctype\s+html\b", start[:256], re.IGNORECASE):
        report["reason"] = "html_not_xml_dataset"
        return report

    tags = []
    depth = [0]
    seen = set()

    def open_tag(name, attrs):
        if depth[0] < 3 and len(tags) < LIMIT_TAGS:
            local = name.split(":")[-1]
            if TOKEN_RE.fullmatch(local) and local not in seen:
                tags.append(local)
                seen.add(local)
        depth[0] += 1

    def close_tag(name):
        depth[0] = max(0, depth[0] - 1)

    def doctype(*args):
        raise ValueError("doctype_forbidden")

    def entity(*args):
        raise ValueError("entity_forbidden")

    parser = expat.ParserCreate()
    parser.StartElementHandler = open_tag
    parser.EndElementHandler = close_tag
    parser.StartDoctypeDeclHandler = doctype
    parser.EntityDeclHandler = entity
    parser.ExternalEntityRefHandler = lambda *a: 0
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    try:
        # False explicitly means a partial stream; do NOT mark whole XML valid.
        parser.Parse(blob, False)
    except (expat.ExpatError, ValueError) as exc:
        report["reason"] = "partial_xml_parse_error"
        return report
    report["shallow_tag_names"] = tags[:LIMIT_TAGS]
    report["root_tag"] = tags[0] if tags else None
    report["first_child_tag"] = tags[1] if len(tags) > 1 else None
    if len(tags) >= 2:
        report["status"] = "xml_prefix_structure_observed_only"
        report["reason"] = "root_and_child_tags_seen_not_full_document"
        report["xml_prefix_structure_observed"] = True
    else:
        report["reason"] = "insufficient_prefix_elements"
    return report


def _opener():
    return build_opener(
        HTTPSHandler(context=ssl.create_default_context()),
        NoRedirect()
    )


def request_metadata(method: str, opener):
    r = Request(
        SOURCE, method=method,
        headers={
            "Accept": "application/xml, text/xml, application/octet-stream",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-store",
            "User-Agent": "Stage3u-PublicOpenDataStructureProbe/1.0",
            **({"Range": f"bytes=0-{PREFIX_BYTES-1}"} if method == "GET" else {})
        }
    )
    return opener.open(r, timeout=TIMEOUT_SECONDS)


def live():
    report = base()
    report["checked_utc"] = datetime.now(timezone.utc).isoformat()
    if not approved_url(SOURCE):
        report["reason"] = "source_not_allowlisted"
        return report
    opener = _opener()
    try:
        with request_metadata("HEAD", opener) as response:
            report["head_code"] = response.status
            if response.status != 200 or not approved_url(response.geturl()):
                report["reason"] = "head_not_official_200"
                return report
            raw_length = response.headers.get("Content-Length")
            if not raw_length or not raw_length.isdecimal():
                report["reason"] = "head_size_not_disclosed_no_get"
                return report
            length = int(raw_length)
            report["head_content_length"] = length
            if not 100 <= length <= MAX_WHOLE_BYTES:
                report["reason"] = "official_dataset_too_large_or_empty"
                return report
    except HTTPError as e:
        report["head_code"] = e.code
        report["reason"] = "official_head_http_error_no_get"
        return report
    except (URLError, OSError, TimeoutError) as e:
        report["reason"] = "official_head_unavailable_no_get"
        return report

    try:
        with request_metadata("GET", opener) as response:
            report["range_get_code"] = response.status
            report["range_honored"] = response.status == 206
            if response.status not in (200, 206) or not approved_url(response.geturl()):
                report["reason"] = "get_redirect_or_unexpected_status"
                return report
            reported = response.headers.get("Content-Length")
            if reported and reported.isdecimal() and int(reported) > MAX_WHOLE_BYTES:
                report["reason"] = "get_response_too_large"
                return report
            prefix = response.read(PREFIX_BYTES)
            inspected = inspect_prefix(prefix)
            for k in ("status", "reason", "bytes_inspected",
                      "root_tag", "first_child_tag",
                      "shallow_tag_names", "xml_prefix_structure_observed"):
                report[k] = inspected[k]
    except HTTPError as e:
        report["range_get_code"] = e.code
        report["reason"] = "get_http_error"
    except (URLError, OSError, TimeoutError, ValueError):
        report["reason"] = "get_unavailable"
    return report


def selftest():
    assert approved_url(SOURCE)
    assert not approved_url(SOURCE + "&token=secret")
    xml = (b'<?xml version="1.0" encoding="UTF-8"?>'
           b'<SyntheticRoot><SyntheticLaw>'
           b'<SyntheticLawName>none</SyntheticLawName></SyntheticLaw>'
           b'</SyntheticRoot>')
    parsed = inspect_prefix(xml[:100])
    assert parsed["root_tag"] == "SyntheticRoot"
    assert parsed["xml_prefix_structure_observed"]
    assert not parsed["xml_document_complete"]
    assert not parsed["actual_xml_field_values_verified"]
    assert inspect_prefix(b"PK\x03\x04stuff")["status"] == "review"
    assert inspect_prefix(b"<!DOCTYPE x><x/>")["status"] == "review"
    assert inspect_prefix(b"<html><body>not xml</body></html>")["status"] == "review"
    print("Stage3u local synthetic prefix parser safeguards PASS")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("selftest", "live"), required=True)
    args = parser.parse_args()
    if args.mode == "selftest":
        selftest()
        return
    report = live()
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    # No raw legal text, IDs, URLs or actual field values printed.
    print(json.dumps({
        k: report[k] for k in (
            "status", "reason", "head_code", "head_content_length",
            "range_get_code", "range_honored", "bytes_inspected",
            "root_tag", "first_child_tag", "shallow_tag_names",
            "xml_prefix_structure_observed", "xml_document_complete",
            "stage3_accepted"
        )
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
