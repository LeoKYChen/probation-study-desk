#!/usr/bin/env python3
"""Recover visually confirmed official PDF glyphs; never import LawPlayer prose."""
import argparse,hashlib,json,re
from pathlib import Path
import fitz
PDFS={
(108,"psychology"):("ecbd21789b5a18d83d519e34b1b220333371b4ae7c9d7e8ae00b18095396a6dc",[0,0,0,0]),
(109,"counseling"):("f93f942a4c3794c952d2c139ce506b0090c5f415239c4bd977e3e37bc01725d7",[0,0,0,0]),
(110,"criminal_law_procedure"):("3b2692c10383cb70c55a6949fb2d24bae2dabf92b0b15a204c4f010a51f5d59f",[0,0,0,1]),
(110,"psychology"):("f59cb4559cbb98e111304a772eaaa49dc3009e453ff3bee00caf60b508c6db8d",[0,0,0,0]),
(111,"psychology"):("4b5a3db56716799aa7e120616b3317c325c863646266d1d0ab56e79f2e5bdbc1",[0,0,0,0]),
(112,"criminal_law_procedure"):("4207105c900185670e4f96e6030b5f2611aea438460b326a60a8c5e4045fb28d",[0,0,0,1]),
(113,"criminal_law_procedure"):("b661f39f25cc461c0c4f676e97f508636e83b2842fbcbf1924a0293a88b27f76",[0,0,0,1]),
(114,"counseling"):("47de0823b786a9824c18ea609fae2697915d6f89d1b0256298ac3a5956ef8e7c",[0,0,0,1])}
PENDING={(108,"psychology"):[1,2,3,4],(109,"counseling"):[4],
(110,"criminal_law_procedure"):[1,2,3,4],(110,"psychology"):[1,2,3,4],
(111,"psychology"):[2,3,4],(112,"criminal_law_procedure"):[1,2,3,4],
(113,"criminal_law_procedure"):[1,2,3,4],(114,"counseling"):[1,2,3,4]}
MAIN="一二三四"
ENUM={chr(0xe129+i):"㈠㈡㈢㈣㈤"[i] for i in range(5)}
MARKER="window.POLICE_ORIGINAL_QUESTION_BANK = "
def sha(b):return hashlib.sha256(b).hexdigest()
def compact(s):return re.sub(r"\s+","",s)
def restore(year,key,num,raw):
    extracted=raw
    notes=[]
    if (year,key,num)==(110,"criminal_law_procedure",3):
        extracted,count=re.subn(r"\n{2,}\s*30470－30670\s*$","",extracted)
        if count!=1:raise ValueError("110 criminal third question page-footer not found")
        notes.append("剔除原PDF跨頁頁碼雜訊")
    if year in (112,113) and key=="criminal_law_procedure" and num==4:
        prefix="30470－30670" if year==112 else "30560-30760"
        if not extracted.startswith(prefix):raise ValueError("Second-page PDF header unexpected")
        extracted=extracted[len(prefix):].lstrip("\n")
        notes.append("剔除第四題前方的原卷頁碼")
    updated=extracted
    if (year,key) in ((110,"psychology"),(112,"criminal_law_procedure"),(113,"criminal_law_procedure")):
        if updated.startswith(MAIN[num-1]+"、"):raise ValueError("Main numeral is already in text")
        updated=MAIN[num-1]+"、"+updated
        notes.append("依官方PDF影像補回文字層遺失的題號")
    if year==108 and key=="psychology" and num==1:
        for i,word in enumerate(("鏡像神經元","坎-巴二氏理論","組集作用","社會性散漫","效標效度")):
            pattern=r"(?m)^([ \t]+)("+re.escape(word)+")"
            updated,count=re.subn(pattern,lambda m:m.group(1)+"㈠㈡㈢㈣㈤"[i]+m.group(2),updated)
            if count!=1:raise ValueError("Five image-backed subquestion numerals changed")
        notes.append("依原PDF影像恢復五個圖片形式的小題序號")
    if any(c in updated for c in ENUM):
        updated="".join(ENUM.get(c,c) for c in updated)
        notes.append("依原PDF影像恢復私用字型分項序號")
    if re.search("[\ue000-\uf8ff]",updated):raise ValueError("Remaining undecoded original glyph")
    if not updated.startswith(MAIN[num-1]+"、"):raise ValueError("Original main number missing")
    if "25 分" not in updated and not (year==111 and key=="psychology" and
      (num==3 and "30 分" in updated or num in (2,4) and "10 分" in updated and "15 分" in updated)):
        raise ValueError("Official score not evidenced in source text")
    return extracted,updated,"；".join(notes) or "跨頁官方PDF版面與原題號核對"
def extract(output):
    candidates=json.loads((output/"candidates.json").read_text("utf-8"))
    audit=json.loads((output/"audit.json").read_text("utf-8"))
    byid={q["id"]:q for q in candidates}
    if len(byid)!=len(candidates):raise ValueError("Original candidate ID collision")
    sheets={(q["year"],q["subject"]):q for q in audit["papers"]}
    results,evidence=[],[]
    for (year,key),(expected_hash,pages) in PDFS.items():
        filepath=output/"official-pdf-for-review"/f"{year}-{key}.pdf"
        pdf=filepath.read_bytes()
        if sha(pdf)!=expected_hash:raise ValueError("Source PDF bytes changed: "+filepath.name)
        doc=fitz.open(stream=pdf,filetype="pdf")
        if len(doc)!=max(pages)+1:raise ValueError("Official page count changed")
        original_text=[p.get_text(sort=True) for p in doc]
        doc.close()
        for index in PENDING[(year,key)]:
            qid=f"police-{year}-{key}-{index}"
            q=byid.get(qid)
            if not q:raise ValueError("Original source candidate missing: "+qid)
            sheet=sheets[(year,q["officialSubject"])]
            if sheet["sourceUrl"]!=q["sourceUrl"] or q["paperSha256"]!=expected_hash:
                raise ValueError("Wrong exam/URL/source SHA256: "+qid)
            if sha(q["body"].encode("utf-8"))!=q["textSha256"]:
                raise ValueError("Original candidate hash mismatch: "+qid)
            extracted,body,notes=restore(year,key,index,q["body"])
            page=pages[index-1]
            if compact(extracted) not in compact(original_text[page]):
                raise ValueError("Full question text not located in exact official PDF page: "+qid)
            if len(body)<25:raise ValueError("Truncated original question "+qid)
            points=30 if (year,key,index)==(111,"psychology",3) else 25
            record={**q,"body":body,"sourceKind":"official-original","verified":True,
                "textSha256":sha(body.encode("utf-8")),"officialPoints":points,"questionType":"申論題",
                "sourceReview":{"reviewer":"ChatGPT（考選部PDF版面及文字層來源核對；非真人審稿）",
                  "checkedAt":"2026-10-23","page":page+1,
                  "reviewMethod":notes+"；PDF同頁題幹逐字比對與雙SHA256確認",
                  "basis":"唯考選部原卷為題幹依據；LawPlayer僅為檢索線索"},
                "guidanceNote":"考選部原題：依PDF視覺與文字層恢復缺字、跨頁雜訊。AI輔助核稿，非官方標準答案。"}
            results.append(record)
            evidence.append({"id":qid,"page":page+1,"pdfSha256":expected_hash,
                             "candidateTextSha256":q["textSha256"],"verifiedTextSha256":record["textSha256"],
                             "restoration":notes})
    if len(results)!=28 or len({q["id"] for q in results})!=28:
        raise ValueError("Expected precisely 28 non-overlapping source-confirmed originals")
    return results,evidence
def promote(output,bank,backlog,crosscheck):
    additions,evidence=extract(output)
    data=bank.read_text("utf-8")
    if MARKER not in data:raise ValueError("Approved question data missing")
    originals=json.loads(data.split(MARKER,1)[1].rsplit(";",1)[0])
    old={q["id"]:q for q in originals}
    if len(old)!=len(originals) or len(old) not in (99,127):
        raise ValueError("Unexpected approved original baseline")
    pending=json.loads(backlog.read_text("utf-8"))
    expected={q["id"] for q in additions}
    waiting={q["id"] for q in pending["unapprovedQuestions"]}
    if waiting and waiting!=expected:raise ValueError("Backlog IDs differ from restored official originals")
    for q in additions:
        if q["id"] in old:
            for field in ("body","textSha256","paperSha256","sourceUrl","officialSubject","officialPoints"):
                if old[q["id"]][field]!=q[field]:raise ValueError("Previously published original changed: "+q["id"])
        else:old[q["id"]]=q
    if len(old)!=127:raise ValueError("Expected 127 verified 108-115 police originals")
    ordered=sorted(old.values(),key=lambda q:(q["year"],q["officialSubject"],q["questionNo"],q["id"]))
    bank.write_text("/* Source-verified official MOEX original questions. */\n"+MARKER+
        json.dumps(ordered,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    pending.update({"approvedTotal":127,"currentlyUnapproved":0,"unapprovedQuestions":[],
                    "resolvedByVisualOriginalPdf":evidence,
                    "reviewLimit":"AI source visual/text PDF proof, not a human copy-edit"})
    backlog.write_text(json.dumps(pending,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    if crosscheck:
        cross=json.loads(crosscheck.read_text("utf-8"))
        if cross["officialCandidateBacklogCount"] not in (28,0):raise ValueError("External source ledger drift")
        cross.update({"officialCandidateBacklogCount":0,"questionCrossChecks":[],
                      "resolvedByOfficialPdf":evidence,
                      "referenceUse":"LawPlayer為次級檢索入口，題幹仍由考選部PDF判定"})
        crosscheck.write_text(json.dumps(cross,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (output/"restoration-report.json").write_text(json.dumps({
        "newOriginals":28,"approvedTotal":127,"remaining":0,"officialPapersChecked":8,
        "sourceEvidence":evidence},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PASS: 28 official original PDF visual source repairs; total 127 new originals; none pending.")
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,default=Path("police-exams/output"))
    p.add_argument("--bank",type=Path,default=Path("police-exams/questions.approved.js"))
    p.add_argument("--backlog",type=Path,default=Path("police-exams/review-backlog.json"))
    p.add_argument("--crosscheck",type=Path,default=Path("police-exams/lawplayer-crosscheck.json"))
    a=p.parse_args();promote(a.out,a.bank,a.backlog,a.crosscheck)
