#!/usr/bin/env python3
"""Stage3t tightly bounded public OFFICIAL HTML PAGE LABEL presence probe.

Two ordinary public, previously non-sampled records only:
- national law database: Central Regulation Standards Act HTML page
- MOJ published administrative interpretation FE315630 HTML metadata page
No document content, summaries, issue numbers or dates are retained in output.
No statute effective-date/current-validity/exhaustive fulltext claims.
No juvenile cases, court database, login, API credentials, redirects or PDF.
"""
import argparse
import json
import re
import ssl
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import (
    build_opener, HTTPSHandler, HTTPRedirectHandler, Request,
)
from socket import timeout as SocketTimeout

RECORDS = (
    ("STATUTE_GENERIC", "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030133",
     ("法規名稱", "修正日期", "第 1 條")),
    ("INTERPRETATION_GENERIC",
     "https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&media=print&type=e",
     ("發文單位", "發文字號", "發文日期", "要")),
)
MAX_BYTES = 280_000
TIMEOUT_SECONDS = 15
OUTPUT = Path("stage3t-public-page-labels-summary.json")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pieces = []
        self.n = 0
        self.suppress = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.suppress += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.suppress = max(0, self.suppress - 1)

    def handle_data(self, data):
        if self.suppress:
            return
        if self.n + len(data) > MAX_BYTES:
            raise ValueError("text_budget_exceeded")
        self.n += len(data)
        self.pieces.append(data)


def allowed_public_page(url: str) -> bool:
    p = urlsplit(url)
    return p.scheme == "https" and p.username is None and p.password is None \
        and p.port is None and not p.fragment and \
        url in [row[1] for row in RECORDS]


def check_html(body: bytes, labels: tuple[str, ...]) -> dict:
    # Do not preserve extracted text, raw URL, specific legal title or document.
    if len(body) > MAX_BYTES:
        return {"status": "review", "reason": "response_too_large"}
    try:
        parser = VisibleText()
        parser.feed(body.decode("utf-8", errors="replace"))
        merged = re.sub(r"\s+", "", "".join(parser.pieces))
        markers = [re.sub(r"\s+", "", marker) in merged for marker in labels]
    except (ValueError, UnicodeError):
        return {"status": "review", "reason": "html_parse_failed"}
    if not all(markers):
        return {
            "status": "review",
            "reason": "public_page_labels_missing",
            "required_markers": len(labels),
            "present_markers": sum(markers),
        }
    return {
        "status": "labels_visible_only",
        "reason": "documented_visible_metadata_labels_found",
        "required_markers": len(labels),
        "present_markers": sum(markers),
    }


def probe(label: str, url: str, fields: tuple[str, ...]) -> dict:
    entry = {
        "cohort": label, "checked": True, "http_code": None,
        "status": "review", "reason": "not_fetched",
        "official_fulltext_verified": False,
        "official_current_effect_verified": False,
        "actual_field_values_saved": False,
        "pdf_downloaded": False,
    }
    if not allowed_public_page(url):
        entry["reason"] = "not_exact_allowlisted_public_url"
        return entry
    opener = build_opener(
        HTTPSHandler(context=ssl.create_default_context()),
        NoRedirect,
    )
    request = Request(
        url,
        headers={
            "User-Agent": "Stage3t-PublicLabel-Research/1.0",
            "Accept": "text/html",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-store",
        },
        method="GET",
    )
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            entry["http_code"] = response.status
            if response.status != 200 or not allowed_public_page(response.geturl()):
                entry["reason"] = "http_status_or_redirect"
                return entry
            content_type = response.headers.get("Content-Type", "")
            if not content_type.lower().startswith("text/html"):
                entry["reason"] = "unexpected_response_media_type"
                return entry
            data = response.read(MAX_BYTES + 1)
            entry.update(check_html(data, fields))
    except HTTPError as exc:
        entry["http_code"] = exc.code
        entry["reason"] = "http_error_or_redirect"
    except (URLError, SocketTimeout, TimeoutError, OSError, ValueError) as exc:
        entry["reason"] = "request_unavailable_" + type(exc).__name__
    return entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("selftest", "live"), required=True)
    args = parser.parse_args()
    if args.mode == "selftest":
        assert len(RECORDS) == 2
        assert all(allowed_public_page(r[1]) for r in RECORDS)
        assert not allowed_public_page(
            "https://law.moj.gov.tw.evil.invalid/LawClass/LawAll.aspx?pcode=A0030133"
        )
        assert not allowed_public_page(RECORDS[0][1] + "&token=bad")
        good = b"<html><body>Law names:</body></html>"
        assert check_html(good, ("this_marker_is_missing",))["status"] == "review"
        candidate = ("<html><body>法規名稱 修正日期 第 1 條</body></html>").encode("utf-8")
        assert check_html(candidate, RECORDS[0][2])["status"] == "labels_visible_only"
        assert check_html(b"<html>bad</html>"*(MAX_BYTES//8), ("法規名稱",))["status"] == "review"
        print("Stage3t bounded public label offline fixture checks PASS")
        return
    report = {
        "phase": "Stage3t limited independently fetched ordinary official page metadata",
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "public_pages_attempted": len(RECORDS),
        "records": [probe(*r) for r in RECORDS],
        "any_real_statute_xml_downloaded": False,
        "official_xml_tag_name_structure_verified": False,
        "any_real_pdf_downloaded": False,
        "any_nonpublic_juvenile_records_accessed": False,
        "any_official_member_api_used": False,
        "original_law_and_interpretation_samples_retested": False,
        "public_label_presence_does_not_verify_entire_fulltext": True,
        "law_current_effect_verified": False,
        "interpretation_current_effect_verified": False,
        "release_authorized": False,
        "stage3_accepted": False,
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n",
                      encoding="utf-8")
    print(json.dumps({
        "public_pages_attempted": report["public_pages_attempted"],
        "records": [
            {"cohort": record["cohort"], "http_code": record["http_code"],
             "status": record["status"], "reason": record["reason"],
             "present_markers": record.get("present_markers", 0)}
            for record in report["records"]
        ],
        "stage3_accepted": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
