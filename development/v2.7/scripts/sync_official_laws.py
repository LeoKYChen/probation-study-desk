#!/usr/bin/env python3
"""Fetch official MOJ Chinese-law JSON ZIP and export two specified current laws.

Public source: https://law.moj.gov.tw/api/ch/law/json
No artificial content or historic-law inference. Fails closed on malformed data.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse, parse_qs

SOURCE = "https://law.moj.gov.tw/api/ch/law/json"
LAWS = {
    "少年事件處理法": "C0010011",
    "保安處分執行法": "I0030002",
}

def article_number(s: str) -> str:
    """Canonical '1-1' from '第 1-1 條' or '第3條之1'."""
    s = (s or "").strip()
    s = s.replace("第", "").replace("條", "").replace("之", "-")
    s = re.sub(r"\s+", "", s)
    return s

def parse(data: bytes) -> dict:
    src = json.loads(data.decode("utf-8-sig"))
    if not isinstance(src, dict) or not isinstance(src.get("Laws"), list):
        raise ValueError("MOJ payload missing Laws array")
    version = str(src.get("UpdateDate", "")).strip()
    if not version:
        raise ValueError("MOJ payload missing UpdateDate")
    result = []
    for lawname, pcode in LAWS.items():
        matches = [x for x in src["Laws"] if x.get("LawName") == lawname]
        if len(matches) != 1:
            raise ValueError(f"Expected exactly one {lawname}, found {len(matches)}")
        law = matches[0]
        if law.get("LawAbandonNote") in ("廢", "Y", True):
            raise ValueError(f"{lawname} marked abolished")
        orig_url = str(law.get("LawURL", ""))
        querycode = parse_qs(urlparse(orig_url).query).get("pcode", [""])[0].upper()
        if querycode != pcode:
            raise ValueError(f"{lawname} pcode mismatch: {orig_url}")
        if not isinstance(law.get("LawArticles"), list):
            raise ValueError(f"{lawname} lacks article array")
        seen = set()
        count = 0
        for a in law["LawArticles"]:
            if str(a.get("ArticleType", "")).upper() == "C":
                continue
            number = article_number(str(a.get("ArticleNo", "")))
            body = str(a.get("ArticleContent", "")).replace("\r\n", "\n").strip()
            if not re.fullmatch(r"\d+(?:-\d+)?", number):
                continue
            if not body:
                raise ValueError(f"Empty content in {lawname} {number}")
            if number in seen:
                raise ValueError(f"Duplicate article number {lawname} {number}")
            seen.add(number)
            count += 1
            result.append({
                "id": pcode,
                "law": lawname,
                "article": f"第{number}條" if "-" not in number else f"第{number.split('-')[0]}條之{number.split('-')[1]}",
                "articleKey": number,
                "body": body,
                "modified": str(law.get("LawModifiedDate", "")),
                "url": f"https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode={pcode}",
                "sourceType": "MOJ-official-current",
            })
        if count < (60 if pcode == "C0010011" else 20):
            raise ValueError(f"Suspiciously small law {lawname}: {count} articles")
    if not any(x["id"] == "C0010011" and x["articleKey"] == "3-1" and "通譯" in x["body"] for x in result):
        raise ValueError("3-1 interpreter safeguard not found")
    if not any(x["id"] == "I0030002" and x["articleKey"] == "1" for x in result):
        raise ValueError("Missing security measures law first article")
    return {
        "schemaVersion": 1,
        "source": SOURCE,
        "sourceUpdateDate": version,
        "scope": list(LAWS.keys()),
        "scopeType": "two-current-laws-only",
        "articles": result,
    }

def download(url: str = SOURCE) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent":"ProbationStudyDeskLegalIndexer/0.1 (source compliance)"})
    with urllib.request.urlopen(req, timeout=160) as r:
        content = r.read(90 * 1024 * 1024)
    if not content.startswith(b"PK"):
        raise ValueError(f"Official download is not ZIP: {content[:50]!r}")
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".json") and not n.endswith("/")]
        if len(names) != 1:
            raise ValueError(f"Expected one JSON in ZIP, found {len(names)}")
        if z.getinfo(names[0]).file_size > 100 * 1024 * 1024:
            raise ValueError("Decompressed file too large")
        return z.read(names[0])

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-file", help="Offline test fixture (JSON bytes)")
    ap.add_argument("--output", default="development/v2.7/laws.json")
    args = ap.parse_args()
    raw = Path(args.source_file).read_bytes() if args.source_file else download()
    obj = parse(raw)
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(obj['articles'])} current articles; source update {obj['sourceUpdateDate']}; output {dest}")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
