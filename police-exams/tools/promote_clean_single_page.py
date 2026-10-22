#!/usr/bin/env python3
"""Conservative exact-text promotion for single-page official MOEX papers only.

Strict, evidence-based; rejects PDF image content, private-use glyphs, unnumbered
candidates, multi-page boundary ambiguities and any question not in the PDF text.
The AI review provenance is explicit and NEVER misrepresented as a human audit.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import fitz

from collect_originals import CATALOG

OFFICIAL = "official-original"
KEYS = {row["subject"]: row for row in CATALOG["subjects"]}
NUMERALS = list("一二三四五六七八")
ALLOWED_SHORT = {(114, "心理學", "第2題文字太短")}


def compact(text):
    return re.sub(r"\s+", "", text)


def load_existing(path: Path):
    source = path.read_text(encoding="utf-8")
    marker = "window.POLICE_ORIGINAL_QUESTION_BANK = "
    if marker not in source:
        raise ValueError("Approved bank missing expected constant")
    return json.loads(source.split(marker, 1)[1].rsplit(";", 1)[0].strip())


def allowed_review_paper(paper):
    if paper["status"] == "extracted_pending_review" and not paper["errors"]:
        return True
    problems = {(paper["year"], paper["subject"], str(error)) for error in paper["errors"]}
    return problems and problems <= ALLOWED_SHORT


def promote(output_dir: Path, approved_js: Path):
    catalog = json.loads((output_dir / "audit.json").read_text("utf-8"))
    candidates = json.loads((output_dir / "candidates.json").read_text("utf-8"))
    existing = load_existing(approved_js)
    if catalog.get("processedSlots") != 32 or len(catalog["papers"]) != 32:
        raise ValueError("Require complete 108-115 × four subjects audit")
    source_ids = [q["id"] for q in candidates]
    if len(source_ids) != len(set(source_ids)):
        raise ValueError("Duplicate candidate ID")
    approved = {q["id"]: q for q in existing}
    if len(approved) != len(existing):
        raise ValueError("Existing approved bank duplicate")
    added, rejected, unapproved = [], Counter(), []
    for paper in catalog["papers"]:
        year = paper["year"]
        subject = paper["subject"]
        spec = KEYS.get(subject)
        if not spec or not (108 <= year <= 115):
            raise ValueError("Non-approved subject/year")
        records = sorted(
            [q for q in candidates if q["year"] == year and q["officialSubject"] == subject],
            key=lambda q: q["questionNo"]
        )
        if not allowed_review_paper(paper):
            rejected["paper has audit warnings"] += len(records)
            unapproved.extend({"id": q["id"], "reason": "paper has audit warnings"} for q in records)
            continue
        if len(records) != 4:
            rejected["not four numbered questions"] += len(records)
            unapproved.extend({"id": q["id"], "reason": "not four numbered questions"} for q in records)
            continue
        file = output_dir / "official-pdf-for-review" / f"{year}-{spec['key']}.pdf"
        pdf_data = file.read_bytes()
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        if len(doc) != 1:
            rejected["multi-page PDF"] += len(records)
            unapproved.extend({"id": q["id"], "reason": "multi-page PDF"} for q in records)
            doc.close()
            continue
        if doc[0].get_images(full=True):
            rejected["embedded image or glyph"] += len(records)
            unapproved.extend({"id": q["id"], "reason": "embedded image or glyph"} for q in records)
            doc.close()
            continue
        doc_text = doc[0].get_text(sort=True)
        doc.close()
        if not all(s in compact(doc_text) for s in (str(year)+"年",spec["subject"],"犯罪防治人員","預防組")):
            raise ValueError("Official exam header mismatch: " + file.name)
        pdf_sha = hashlib.sha256(pdf_data).hexdigest()
        full_text = compact(doc_text)
        for idx, q in enumerate(records, 1):
            reason = None
            body = q.get("body", "")
            if q["questionNo"] != idx or not body.startswith(NUMERALS[idx-1]+"、"):
                reason = "question numbering not retained"
            elif re.search(r"[\ue000-\uf8ff]", body):
                reason = "PDF private-use glyph requires visual correction"
            elif q.get("sourceKind")!="candidate-original-unreviewed" or q.get("verified") is not False:
                reason = "not original candidate"
            elif q["examName"] != spec["examName"] or q["sourceUrl"] != paper["sourceUrl"]:
                reason = "exam identity mismatch"
            elif q["paperSha256"] != pdf_sha:
                reason = "PDF hash mismatch"
            elif q["textSha256"] != hashlib.sha256(body.encode("utf-8")).hexdigest():
                reason = "text hash mismatch"
            elif compact(body) not in full_text:
                reason = "not literal source PDF text"
            elif any(marker in body for marker in ("代號：","頁次：","座號：")):
                reason = "header/footer contaminated body"
            elif q["id"] in approved:
                prior = approved[q["id"]]
                for field in ("body", "paperSha256", "textSha256", "examName", "officialSubject", "questionNo", "sourceUrl"):
                    if prior[field] != q[field]:
                        raise ValueError(f"Previously approved original changed for {q['id']} field={field}")
                reason = "already approved"
            if reason:
                rejected[reason] += 1
                if reason != "already approved":
                    unapproved.append({"id": q["id"], "reason": reason})
                continue
            # No rewording or reshaping the official text.
            approved[q["id"]] = {
                **q, "sourceKind": OFFICIAL, "verified": True,
                "sourceReview": {
                    "reviewer": "ChatGPT（PDF來源及文字完整性比對；非真人審核）",
                    "checkedAt": "2026-10-23",
                    "reviewMethod": "官方PDF單頁/無附圖/題號連續；整題原文存在於PDF文字層；檢驗雙SHA256；AI檢視逐年試卷縮圖",
                    "basis": "自動嚴格比對與AI視覺檢視；不代表真人核稿或考選部答案",
                },
                "guidanceNote": "考選部官方原題（PDF文字層精確比對，AI檢視、非真人核稿）；答題解析非考選部標準答案。"
            }
            added.append(q["id"])
    if len(added) not in (0, 80):
        raise ValueError(f"Unexpected approval delta: {len(added)}. Rejected: {dict(rejected)}")
    if len(approved) != 96:
        raise ValueError("Total approved expected 96, found "+str(len(approved)))
    if len(unapproved) != 31:
        raise ValueError(f"Expected 31 explicitly unapproved PDF candidates, got {len(unapproved)}")
    ordered = sorted(approved.values(), key=lambda q:(q["year"],q["officialSubject"],q["questionNo"],q["id"]))
    content = ("/* Official original exam text, with explicit PDF source review provenance. */\n"
               "window.POLICE_ORIGINAL_QUESTION_BANK = "+json.dumps(ordered,ensure_ascii=False,indent=2)+";\n")
    approved_js.write_text(content,encoding="utf-8")
    (output_dir/"promotion-report.json").write_text(json.dumps({
        "approvedTotal":len(ordered),"newlyApproved":len(added),
        "newByYear":dict(sorted(Counter(int(id.split("-")[1]) for id in added).items())),
        "rejected":dict(rejected), "currentlyUnapproved":len(unapproved),
        "unapprovedQuestions":sorted(unapproved,key=lambda x:x["id"]),
        "approvalScope":"Single-page, exact-PDF-text, no embedded images, no missing numerals"
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Approved 96 strict-source-matched original questions, newly added {len(added)}, pending {len(unapproved)}; exclusions:",dict(rejected))


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,default=Path("police-exams/output"))
    p.add_argument("--bank",type=Path,default=Path("police-exams/questions.approved.js"))
    args=p.parse_args()
    promote(args.out,args.bank)
