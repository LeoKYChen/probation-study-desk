#!/usr/bin/env python3
"""Second-round checks: v0.4 source identity, original mixed passages and duplicate categories."""
from collections import Counter
from pathlib import Path
import json,re
BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[1]
SNAP=ROOT/"staresto-intake"/"library"
OLD=ROOT/"common-subjects"/"daily"
OUTPUT=BASE/"output"
def read(file):return json.loads(Path(file).read_text(encoding="utf-8-sig"))
def dump(file,value):Path(file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def main():
 mapped=read(OUTPUT/"legacy-crosswalk.json")["rows"]
 summary=read(OUTPUT/"summary.json")
 assert len(mapped)==668
 cards=read(SNAP/"data"/"JCEE-vocab-questions"/"cards"/"cards_data.json")["q"]
 reading={q["id"]:q for q in read(SNAP/"data"/"reading-comprehension"/"gsat"/"items.json")}
 completions={q["id"]:q for q in read(SNAP/"data"/"passage-completion"/"gsat"/"items.json")}
 by_id={q["legacyId"]:q for q in mapped}
 checked=Counter();problems=[]
 for file in ("vocab.json","grammar-1.json","grammar-2.json","grammar-3.json","reading.json","completion.json"):
  data=read(OLD/file)
  for legacy in data["questions"]:
   old_id=legacy["id"];entry=by_id[old_id]
   new_id=entry.get("newId")
   if not new_id:
    problems.append([old_id,"no unique v0.5 source identity"])
    continue
   srcid=str(legacy.get("sourceId",""))
   if file=="vocab.json":
    source=cards.get(srcid)
    if not source or source.get("a")!=legacy.get("answer"):
     problems.append([old_id,"vocabulary source ID or answer differs"])
    else:checked["單字來源與答案"]+=1
   elif file.startswith("grammar"):
    page=SNAP/"pages"/"grammar-cloze-test"/"q"/srcid/"index.html.txt"
    official=re.sub(r"[^a-zA-Z0-9]","",srcid).upper()
    new_code=new_id.split(":")[-1].replace("_","").upper()
    if not page.is_file():
     problems.append([old_id,"original grammar explanation page not indexed"])
     continue
    body=page.read_text(encoding="utf-8")
    match=re.search(r"答案：\(([A-J])\)",body)
    if new_code!=official or official not in re.sub(r"[^a-zA-Z0-9]","",body).upper() or not match or match.group(1)!=legacy.get("answer"):
     problems.append([old_id,"grammar page ID or answer mismatch"])
    else:checked["文法原站頁面、題號與答案"]+=1
   elif file=="completion.json":
    source=completions.get(srcid)
    if not source or not new_id.endswith(":"+srcid) or source.get("answer")!=legacy.get("answer") or source.get("options")!=legacy.get("options"):
     problems.append([old_id,"completion source ID/options/answer mismatch"])
    else:checked["文意選填原題號、選項與答案"]+=1
   elif file=="reading.json":
    source=reading.get(srcid)
    if not source or not new_id.endswith(":"+srcid) or source.get("answer")!=legacy.get("answer") or source.get("options")!=legacy.get("options"):
     problems.append([old_id,"reading source ID/options/answer mismatch"])
    else:checked["閱讀原題號、選項與答案"]+=1
 mf_path=SNAP/"data"/"mixed-format"
 mixed_items=read(mf_path/"items.json")["items"]
 mixed_passages=read(mf_path/"passages.json")["passages"]
 assert isinstance(mixed_passages,list)
 passage_map={str(p["id"]):p for p in mixed_passages}
 links=Counter();by_session=Counter();missing=[]
 for item in mixed_items:
  pid=str(item.get("passageId") or "")
  p=passage_map.get(pid)
  if not p:
   links["unmatchedOriginalPassage"]+=1
   missing.append(str(item.get("id")))
   continue
  links["linkedToOriginalPassage"]+=1
  if any(isinstance(b,dict) and isinstance(b.get("text"),str) and len(b["text"])>50 for b in p.get("blocks",[])):
   links["hasOriginalTextBlock"]+=1
  else:links["passageNeedsManualContent"]+=1
  by_session[str(p.get("examLabel") or p.get("sessionName") or "unlabeled")]+=1
 duplicate=read(OUTPUT/"duplicate-review.json")
 candidates=read(OUTPUT/"candidates.json")
 by_qid={q["id"]:q for q in candidates}
 dups=Counter()
 for related in duplicate["crossSourceGroups"].values():
  types=tuple(sorted(set(by_qid[x]["examDesignation"] for x in related)))
  dups[" + ".join(types)]+=1
 proof={
  "schema":"staresto-v06-phase1-deep-v1",
  "checkedLegacyByType":dict(checked),"totalChecked":sum(checked.values()),
  "legacyCount":len(mapped),"unverifiedLegacyExamples":problems[:50],"legacyIssues":len(problems),
  "mixedFormat":{"records":len(mixed_items),"passageCount":len(mixed_passages),
      "association":dict(links),"byExamLabel":dict(by_session),"missingExamples":missing[:20]},
  "duplicateGroups":duplicate["crossSourceGroupCount"],
  "duplicateGroupExamTypes":dict(dups),"publishedAutomatically":False
 }
 dump(OUTPUT/"deep-review.json",proof)
 lines=[
 "# Staresto v0.6｜第二輪來源與題組核對","",
 "此輪僅核對原始來源、題目識別與題組關聯；不移轉個人作答紀錄，也不自動核准權利或內容。",
 "","## v0.4 668題的來源證據","","| 校驗內容 | 題數 |","|---|---:|"]
 for k,v in checked.items():lines.append(f"| {k} | {v} |")
 lines.extend([
 f"| 合計有來源證據 | {sum(checked.values())} |",
 "",f"待核查的來源不一致：{len(problems)}筆（見 deep-review.json）。",
 "文法以原作者網頁題號、年份、選項及答案交叉比對；程式比對不代表逐題人工審查。",
 "同一閱讀文章可能於正式及參考試題重現，對照以原題來源 ID 為準，不直接合併。",
 "","## 混合題來源篇章","",
 f"原始混合題 {len(mixed_items)} 筆，文章 {len(mixed_passages)} 篇。",
 f"成功關聯原始文章 {links['linkedToOriginalPassage']} 筆；有文章文字區塊 {links['hasOriginalTextBlock']} 筆；無法關聯 {links['unmatchedOriginalPassage']} 筆。",
 "v0.5 顯示的缺少篇章，可能是多區塊文章資料格式未辨識，而非原站缺少原文。",
 "混合題含填充、多選、短答及不同計分方式，後續須另行核對使用權利與呈現方式。",
 "","## 跨來源重複風險","",
 f"有 {duplicate['crossSourceGroupCount']} 組相同題幹／選項／答案候選，可能涉及正式與參考、試辦來源。",
 "不得因文字重複，就刪掉不同來源及評分資料；既有作答紀錄保持不動。",
 "","## 發布限制","",
 f"本輪沒有核准任何新題，正式放行數仍是 {summary['allowedForProduction']}。"])
 (OUTPUT/"DEEP_REVIEW.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 if problems:raise AssertionError(str(len(problems))+" legacy provenance mismatches")
 if links["linkedToOriginalPassage"]!=len(mixed_items) or links["hasOriginalTextBlock"]!=len(mixed_items):
  raise AssertionError("Mixed-format source passage needs further reconciliation")
 print("PASS second-round provenance",json.dumps({k:proof[k] for k in ("totalChecked","legacyIssues","mixedFormat","duplicateGroups")},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
