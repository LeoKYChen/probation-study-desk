#!/usr/bin/env python3
"""Draft ONLY: locate official papers and extract candidates. Never auto-publish OCR/text."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs
from bs4 import BeautifulSoup, NavigableString, Tag
import fitz
import requests

HERE = Path(__file__).resolve().parents[1]
CATALOG = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
NUMERALS = "一二三四五六七八九十"
QUESTION_START = re.compile(r"(?m)^[ \t]*([一二三四五六七八九十]{1,2})[、．.][ \t]*")
HEADER_LINE = re.compile(r"^(?:代號[:：]|頁次[:：]|第\s*\d+\s*頁\s*共|考試時間[:：]|座號[:：])")
ALLOW_HOSTS = {"wwwq.moex.gov.tw", "www.moex.gov.tw"}
PDF_ENDPOINT = "wHandExamQandA_File.ashx"

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def squish(text: str) -> str:
    """Metadata comparison only; DO NOT alter question body by calling this."""
    return re.sub(r"\s+", "", text).replace("（", "(").replace("）", ")")

def valid_url(raw: str, base: str, exam_code: str) -> str | None:
    u = urljoin(base, raw)
    parsed = urlparse(u)
    if parsed.scheme != "https" or parsed.hostname not in ALLOW_HOSTS:
        return None
    if PDF_ENDPOINT.lower() not in parsed.path.lower():
        return None
    parts = parse_qs(parsed.query)
    if parts.get("t", [""])[0].upper() != "Q":
        return None
    if parts.get("code", [""])[0] != exam_code:
        return None
    return u

def group_of(text: str) -> str | None:
    s = squish(text)
    if "犯罪防治人員" not in s or "預防組" not in s:
        return None
    if "一般警察" in s and "三等" in s:
        return "general"
    if ("警察人員" in s or "警察三等" in s) and "三等" in s:
        return "police"
    return None

def discover(html: str, base: str, exam_code: str) -> dict[str, str]:
    """Conservative catalogue traversal: never guess URLs or cross exam kinds."""
    soup = BeautifulSoup(html, "html.parser")
    selected = {}
    current_group = None
    current_subject = None
    subjects = {s["subject"]: s for s in CATALOG["subjects"]}
    for node in soup.descendants:
        if isinstance(node, NavigableString):
            t = str(node).strip()
            if not t:
                continue
            normalized = squish(t)
            if "考試" in normalized and "三等" in normalized and ("_" in normalized or "類科" in normalized):
                # Reset whenever a new category begins, including excluded categories.
                current_group = group_of(normalized)
                current_subject = None
            elif normalized in subjects:
                current_subject = normalized
        elif isinstance(node, Tag) and node.name == "a":
            url = valid_url(node.get("href", ""), base, exam_code)
            if not url or "試題" not in node.get_text(" ", strip=True):
                continue
            if not current_group or current_subject not in subjects:
                continue
            info = subjects[current_subject]
            if info["examKind"] != current_group:
                continue
            key = info["key"]
            # Shared papers may be linked in multiple groups. Probe PDF headers later.
            links = selected.setdefault(key, [])
            if url not in links:
                links.append(url)
    return selected

def fetch(session: requests.Session, url: str, binary: bool = False):
    response = session.get(url, timeout=50, allow_redirects=True)
    response.raise_for_status()
    target = urlparse(response.url)
    if target.scheme != "https" or target.hostname not in ALLOW_HOSTS:
        raise ValueError("非考選部來源：" + response.url)
    if binary:
        data = response.content
        if not data.startswith(b"%PDF"):
            raise ValueError("考選部試卷回應非PDF：" + url)
        return data
    response.encoding = response.apparent_encoding or "utf-8"
    return response.text

def paper_text(pdf: bytes) -> str:
    doc = fitz.open(stream=pdf, filetype="pdf")
    result = "\n\f\n".join(page.get_text(sort=True).strip() for page in doc)
    doc.close()
    return result

def validate_header(text: str, year: int, spec: dict) -> list[str]:
    flat = squish(text)
    errors = []
    if str(year) + "年" not in flat:
        errors.append("年份不符")
    if "三等" not in flat:
        errors.append("等別未核對")
    if "犯罪防治人員" not in flat or "預防組" not in flat:
        errors.append("類科未核對")
    if squish(spec["examName"]) not in flat:
        errors.append("警察考試別未核對")
    if spec["subject"] not in flat:
        errors.append("官方科目未核對")
    if len(text.strip()) < 150:
        errors.append("PDF文字過少，疑似影像試卷")
    return errors

def extract_questions(text: str, year: int, spec: dict, url: str, pdf_hash: str):
    matches = list(QUESTION_START.finditer(text))
    questions = []
    warnings = []
    for i, match in enumerate(matches):
        n = match.group(1)
        # Examine all following content until the next top-level question.
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        segment = text[match.start():end]
        lines = []
        for line in segment.splitlines():
            if line == "\f" or HEADER_LINE.search(line.strip()):
                continue
            lines.append(line.rstrip())
        body = "\n".join(lines).strip()
        number = i + 1
        expected = NUMERALS[i:i + 1]
        if n != expected:
            warnings.append(f"題序不連續：第{number}筆為{n}")
        if len(body) < 25:
            warnings.append(f"第{number}題文字太短")
        if "（" not in body and "分" not in body:
            warnings.append(f"第{number}題未確認配分")
        key = f"police-{year}-{spec['key']}-{number}"
        # Candidate body is extracted source text, not AI-rephrased content.
        questions.append({
            "id": key, "year": year, "examName": spec["examName"],
            "examLevel": "三等考試", "examType": "犯罪防治人員預防組",
            "examTypes": [spec["examName"] + "三等犯罪防治人員預防組"],
            "officialSubject": spec["subject"], "subject": spec["subject"],
            "mappedSubjects": spec["mappedSubjects"], "questionNo": number,
            "title": f"{year}年｜{spec['subject']}｜第{number}題",
            "body": body, "points": [], "direction": [],
            "sourceUrl": url, "source": "考選部官方考畢試題",
            "sourceKind": "candidate-original-unreviewed",
            "verified": False, "paperSha256": pdf_hash,
            "textSha256": sha256(body.encode("utf-8")),
            "guidanceNote": "官方原卷文字擷取候選，尚待人工逐字核對，禁止上線為原題。",
        })
    if not (2 <= len(questions) <= 8):
        warnings.append(f"辨識到{len(questions)}題（預期一般申論題2至8題）")
    return questions, warnings

def collect(output: Path, only_year: int | None = None):
    output.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "probation-study-desk/official-paper-index (educational source check)"})
    all_questions, report = [], []
    for entry in CATALOG["years"]:
        year = entry["year"]
        if only_year and year != only_year:
            continue
        try:
            html = fetch(session, entry["catalogUrl"])
            discovered = discover(html, entry["catalogUrl"], entry["examCode"])
        except Exception as exc:
            discovered = {}
            catalogue_error = str(exc)
        else:
            catalogue_error = None
        for spec in CATALOG["subjects"]:
            key = spec["key"]
            seed = CATALOG["knownPaperUrls"].get(f"{year}:{key}")
            # Never guess a PDF URL; look up explicitly verified URL or catalogue links.
            sources = ([seed] if seed else []) + discovered.get(key, [])
            sources = list(dict.fromkeys(x for x in sources if x))
            row = {"year": year, "subject": spec["subject"],
                   "examName": spec["examName"], "catalogUrl": entry["catalogUrl"],
                   "sourceUrl": None, "status": "unresolved", "questionCount": 0,
                   "errors": [], "catalogueError": catalogue_error,
                   "candidateUrls": len(sources)}
            if not sources:
                row["errors"].append("官方目錄尚未辨識該類科原卷（不是確認未設考科）")
                report.append(row)
                continue
            attempted = []
            for url in sources:
                try:
                    pdf = fetch(session, url, binary=True)
                    extracted = paper_text(pdf)
                    problems = validate_header(extracted, year, spec)
                    if problems:
                        attempted.append(";".join(problems) + ":" + url)
                        continue  # wrong category, shared exam, or wrong PDF
                    paperhash = sha256(pdf)
                    qs, warnings = extract_questions(extracted, year, spec, url, paperhash)
                    row["sourceUrl"] = url
                    row["errors"] = warnings
                    row["pdfSha256"] = paperhash
                    row["questionCount"] = len(qs)
                    row["status"] = "extracted_pending_review" if not warnings else "manual_resolution_required"
                    if qs:
                        all_questions.extend(qs)
                    break
                except Exception as exc:
                    attempted.append(str(exc) + ":" + url)
            if row["sourceUrl"] is None:
                row["status"] = "fetch_or_extract_failed"
                row["errors"] = attempted[:8] or ["所有官方原卷候選均不符"]
            report.append(row)
    # Machine extracted text never ships to production bank without review.
    (output / "candidates.json").write_text(json.dumps(all_questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "audit.json").write_text(json.dumps({
        "schemaVersion": 1, "expectedPaperSlots": 32, "processedSlots": len(report),
        "candidateQuestionCount": len(all_questions), "publishedQuestionCount": 0,
        "manualVerificationRequired": True, "papers": report
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"年度科目{len(report)}格；擷取候選{len(all_questions)}題；正式上線0題（須逐題核對）。")
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("police-exams/output"))
    parser.add_argument("--year", type=int, choices=range(108,116))
    args = parser.parse_args()
    collect(args.out, args.year)
