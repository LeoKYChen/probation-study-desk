#!/usr/bin/env python3
"""Promote exactly the THREE official 114 criminal-law/procedure questions (50/25/25).

LawPlayer is ONLY a secondary catalogue clue. The questions originate directly
from the two-page official MOEX PDF and are verified against both rendered pages.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path
import fitz
from collect_originals import CATALOG

PDF_SHA256 = "1bb7d66914c10445ef3f95df92d82f36d9b095597e6f6b4420813cc5a795d109"
SPEC = next(s for s in CATALOG["subjects"] if s["key"]=="criminal_law_procedure")
SOURCE_URL = CATALOG["knownPaperUrls"]["114:criminal_law_procedure"]
MARKER = "window.POLICE_ORIGINAL_QUESTION_BANK = "
EXPECTED_NUMERALS = ("一", "二", "三")
EXPECTED_SCORES = (50,25,25)
BACKLOG_PREFIX = "police-114-criminal_law_procedure-"

def compact(s: str) -> str:
    return re.sub(r"\s+","",s)

def load_bank(path: Path) -> list[dict]:
    source = path.read_text("utf-8")
    if MARKER not in source:
        raise ValueError("Approved original data unavailable")
    return json.loads(source.split(MARKER,1)[1].rsplit(";",1)[0])

def extract(pdf: bytes) -> list[dict]:
    if hashlib.sha256(pdf).hexdigest() != PDF_SHA256:
        raise ValueError("Official PDF bytes changed: re-check page images and approval")
    doc = fitz.open(stream=pdf,filetype="pdf")
    if len(doc) != 2 or any(page.get_images(full=True) for page in doc):
        raise ValueError("Official paper page count or embedded images changed")
    pages=[page.get_text(sort=True) for page in doc]
    doc.close()
    assert all(x in compact(pages[0]) for x in ("114年","一般警察人員考試","犯罪防治人員預防組","刑法與刑事訴訟法"))
    groups=[]
    for page_no,raw in enumerate(pages):
        found=list(re.finditer(r"(?m)^([一二三])、",raw))
        for j,m in enumerate(found):
            end=found[j+1].start() if j+1<len(found) else len(raw)
            segment=raw[m.start():end]
            body="\n".join(line.rstrip() for line in segment.splitlines()).strip()
            if any(header in body for header in ("代號：","頁次：","座號：")):
                raise ValueError("Page header got into original question")
            if compact(body) not in compact(raw):
                raise ValueError("Extracted question not literal to same official PDF page")
            groups.append((page_no+1,m.group(1),body))
    if [(x[0],x[1]) for x in groups] != [(1,"一"),(1,"二"),(2,"三")]:
        raise ValueError("Actual PDF has not exactly three correctly numbered questions")
    answer=[]
    for index, (page_no,numeral,body) in enumerate(groups,1):
        score=EXPECTED_SCORES[index-1]
        if not re.search(r"（\s*"+str(score)+r"\s*分\s*）\s*$",body):
            raise ValueError(f"Official question {index} score must be {score}")
        if not body.startswith(numeral+"、") or len(body)<30:
            raise ValueError(f"Question {index} original text malformed")
        qid=BACKLOG_PREFIX+str(index)
        answer.append({
            "id":qid,"year":114,"examName":SPEC["examName"],"examLevel":"三等考試",
            "examType":"犯罪防治人員預防組",
            "examTypes":[SPEC["examName"]+"三等犯罪防治人員預防組"],
            "officialSubject":SPEC["subject"],"subject":SPEC["subject"],"mappedSubjects":SPEC["mappedSubjects"],
            "questionNo":index,"questionType":"申論題","officialPoints":score,
            "title":f"114年｜{SPEC['subject']}｜第{index}題","body":body,
            "points":[],"direction":[],"sourceUrl":SOURCE_URL,"source":"考選部官方考畢試題",
            "sourceKind":"official-original","verified":True,
            "paperSha256":PDF_SHA256,
            "textSha256":hashlib.sha256(body.encode("utf-8")).hexdigest(),
            "sourceReview":{
                "reviewer":"ChatGPT（考選部官方PDF雙頁文字及視覺比對；非真人審核）",
                "checkedAt":"2026-10-23","page":page_no,
                "reviewMethod":"官方PDF第1頁兩題、第2頁一題；核實題號、50/25/25分及整段原文與SHA256",
                "basis":"官方原PDF為唯一文字權威；LawPlayer僅輔助察覺題數不是四題"
            },
            "guidanceNote":"官方原卷第1頁兩題、第2頁一題；題幹依PDF文字層及畫面比對。AI輔助核對，非人工正式審稿。"
        })
    return answer

def promote(out: Path, bank: Path, backlog: Path):
    data=(out/"official-pdf-for-review/114-criminal_law_procedure.pdf").read_bytes()
    additions=extract(data)
    original=load_bank(bank)
    if len(original) not in (96,99):
        raise ValueError(f"Unexpected approved baseline {len(original)}")
    indexed={q["id"]:q for q in original}
    for q in additions:
        prior=indexed.get(q["id"])
        if prior is not None:
            for field in ("body","textSha256","paperSha256","officialPoints"):
                if prior[field]!=q[field]:
                    raise ValueError("Previously reviewed original changed: "+q["id"]+"."+field)
        else:
            indexed[q["id"]]=q
    if len(indexed)!=99:
        raise ValueError("Expected approved total 99")
    ordered=sorted(indexed.values(),key=lambda q:(q["year"],q["officialSubject"],q["questionNo"],q["id"]))
    bank.write_text("/* Only PDF-source-reviewed official exam questions. */\n"+MARKER+
                    json.dumps(ordered,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    ledger=json.loads(backlog.read_text("utf-8"))
    if ledger.get("currentlyUnapproved") not in (31,28):
        raise ValueError("Unapproved ledger count changed: re-audit required")
    oldids={entry["id"] for entry in ledger["unapprovedQuestions"]}
    # Old ledger is never silently replaced with an empty/all-approved list.
    remaining=[entry for entry in ledger["unapprovedQuestions"] if not entry["id"].startswith(BACKLOG_PREFIX)]
    if len(remaining)!=28:
        raise ValueError("Expected precisely three resolved IDs, left "+str(len(remaining)))
    if ledger["currentlyUnapproved"]==31 and not all(q["id"] in oldids for q in additions):
        raise ValueError("Three original pending question IDs are not present in audit")
    ledger.update({
        "approvedTotal":99,
        "currentlyUnapproved":28,
        "unapprovedQuestions":remaining,
        "resolved114CriminalLawProcedure":{
            "questionIds":[q["id"] for q in additions],
            "source":"考選部114年一般警察人員考試刑法與刑事訴訟法官方PDF",
            "officialQuestionCount":3,"officialPointDistribution":[50,25,25],
            "pdfSha256":PDF_SHA256,"review":"AI輔助PDF兩頁版面與原文字校核"
        }
    })
    ledger["rejected"]["not four numbered questions"]=0
    backlog.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PASS: official three-part 114 exam original source 50/25/25; approved 99; pending 28.")

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,default=Path("police-exams/output"))
    parser.add_argument("--bank",type=Path,default=Path("police-exams/questions.approved.js"))
    parser.add_argument("--backlog",type=Path,default=Path("police-exams/review-backlog.json"))
    a=parser.parse_args()
    promote(a.out,a.bank,a.backlog)
