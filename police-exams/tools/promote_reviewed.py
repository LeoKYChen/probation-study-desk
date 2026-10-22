#!/usr/bin/env python3
"""Explicit human review receipts -> approved browser bank. No implicit approval."""
import argparse
import hashlib
import json
from pathlib import Path
from collect_originals import CATALOG, sha256

def approve(candidate_path, receipt_path, destination):
    data=json.loads(Path(candidate_path).read_text(encoding="utf-8"))
    receipts=json.loads(Path(receipt_path).read_text(encoding="utf-8"))
    if not isinstance(data,list) or not isinstance(receipts,dict):
        raise ValueError("candidate list and approval object required")
    allowed={(s["examName"],s["subject"]) for s in CATALOG["subjects"]}
    candidates={q["id"]:q for q in data if isinstance(q,dict) and isinstance(q.get("id"),str)}
    if len(candidates)!=len(data):
        raise ValueError("Duplicate candidate IDs")
    selected=[]
    for qid,proof in receipts.items():
        if qid not in candidates:
            raise ValueError("Unknown question: "+qid)
        q=candidates[qid]
        if proof.get("reviewedAgainstOfficialPdf") is not True or not proof.get("reviewer") or not proof.get("checkedAt"):
            raise ValueError("Manual PDF comparison evidence missing for "+qid)
        if proof.get("pdfSha256")!=q["paperSha256"] or proof.get("textSha256")!=q["textSha256"]:
            raise ValueError("Source changed after approval: "+qid)
        if sha256(q["body"].encode("utf-8"))!=q["textSha256"]:
            raise ValueError("Question body changed after source extraction: "+qid)
        if (q["examName"],q["officialSubject"]) not in allowed or not (108<=q["year"]<=115):
            raise ValueError("Outside exact user-approved scope: "+qid)
        if q["sourceKind"]!="candidate-original-unreviewed" or q["verified"] is not False:
            raise ValueError("Unexpected candidate verification state")
        approved={**q,"sourceKind":"official-original","verified":True,
                 "humanReview":{"reviewer":proof["reviewer"],"checkedAt":proof["checkedAt"],
                               "basis":"逐字核對考選部官方PDF"}}
        approved["guidanceNote"]="原題依考選部PDF人工核對；本站解析及AI批改均非考選部標準答案。"
        selected.append(approved)
    selected.sort(key=lambda q:(q["year"],q["officialSubject"],q["questionNo"]))
    # JS JSON serialization preserves the text, including original line breaks.
    body=("/* Only manual-PDF-verified official past paper questions. */\n"
          "window.POLICE_ORIGINAL_QUESTION_BANK = "+json.dumps(selected,ensure_ascii=False,indent=2)+";\n")
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    Path(destination).write_text(body,encoding="utf-8")
    print(f"Approved {len(selected)} of {len(candidates)} candidates.")
    return len(selected)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--candidates",required=True)
    p.add_argument("--receipts",required=True)
    p.add_argument("--out",default="police-exams/questions.approved.js")
    a=p.parse_args()
    approve(a.candidates,a.receipts,a.out)
