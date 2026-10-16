#!/usr/bin/env python3
"""v0.6 first-stage audit: conservative admission, source identity and legacy crosswalk.

This produces *candidates*, never automatically publishes unreviewed questions.
Read-only with respect to v0.4 localStorage and v0.5 catalog.
"""
from collections import Counter,defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json,re,unicodedata

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
CAT=ROOT/"common-subjects/catalog/data"
OLD=ROOT/"common-subjects/daily"
UPSTREAM=ROOT/"staresto-intake/library"
OUTPUT=HERE/"output"
LEGACY=["vocab.json","grammar-1.json","grammar-2.json","grammar-3.json","reading.json","completion.json"]
EXAMS=("學測","指考","聯考")
MEDIAS=("figure","figures","image","images","img","audio","audioUrl","media","picture","diagram")
REFERENCES=("參考","參試","試辦","研究用","參考試卷","試題示例")
def obj(path):
 return json.loads(path.read_text(encoding="utf-8-sig"))
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def simpl(x):
 return re.sub(r"\s+"," ",unicodedata.normalize("NFKC",str(x or "")).casefold()).strip()
def norm_options(x):
 if isinstance(x,dict):return {str(k).upper():simpl(v) for k,v in x.items()}
 if isinstance(x,list):return {chr(65+i):simpl(v) for i,v in enumerate(x)}
 return {}
def item_collection(blob):
 if isinstance(blob,list):return [q for q in blob if isinstance(q,dict)]
 if not isinstance(blob,dict):return []
 for name in ("items","questions","prompts"):
  if isinstance(blob.get(name),list):return [q for q in blob[name] if isinstance(q,dict)]
 if isinstance(blob.get("q"),dict):return [q for q in blob["q"].values() if isinstance(q,dict)]
 if isinstance(blob.get("p"),list):return [q for q in blob["p"] if isinstance(q,dict)]
 return []
def check_exam(row,raw,source_path):
 # Independent affirmative designation is required for an official-exam pool.
 attrs=" ".join(str(raw.get(k,"")) for k in ("exam","examType","t","year","y","yearLabel","session"))+" "+str(row.get("exam",""))+" "+str(row.get("examType",""))+" "+str(row.get("year",""))
 if "/adapt/" in source_path or "改編" in attrs:return "改編題（另行核對）"
 if any(word in attrs for word in REFERENCES) or re.search(r"\d{2,3}參",attrs):return "參考／試辦（另行核對）"
 if ("正式考試" in attrs or raw.get("t") in ("學測","指考","大學聯考") or raw.get("exam") in ("學測","指考","大學聯考") or source_path=="grammar-cloze-test/grammar_items.json" or source_path=="zhikao-cloze-test/zhikao_grammar_items.json"):
  return "正式題候選（來源待逐筆確認）"
 return "考試來源未確認"
def record_problem(row,full,raw,source_path):
 errors=[]
 if row["status"]=="篇章素材":return ["篇章素材（非獨立試題）"]
 if not full.get("stem") or len(simpl(full["stem"]))<9:errors.append("題幹不足")
 opts=full.get("options") or {}
 if not isinstance(opts,dict) or not (4<=len(opts)<=10):errors.append("選項不足或數量異常")
 if isinstance(opts,dict):
  if any(not simpl(v) for v in opts.values()):errors.append("空白選項")
  if len(set(simpl(v) for v in opts.values()))!=len(opts):errors.append("相同選項")
 if full.get("answer") not in opts:errors.append("答案不在選項")
 if row["status"] in ("需要媒體","缺少篇章","需人工整理"):errors.append(row["status"])
 if any(raw.get(k) for k in MEDIAS):errors.append("原始試題依賴媒體")
 if row.get("hasPassage"):
  passage=full.get("passage")
  if not isinstance(passage,dict) or len(simpl(passage.get("text")))<80:errors.append("題組篇章未完整連結")
  elif passage.get("text") and any(z in passage["text"] for z in ("<img","![](","[image]")):errors.append("篇章疑似含圖像")
 if row["type"] in ("英文作文","中譯英","混合題"):
  errors.append("非標準四選一題型，先獨立審查")
 # Don't allow known reference or adapt materials into first official learning pool
 category=check_exam(row,raw,source_path)
 if category!="正式題候選（來源待逐筆確認）":errors.append(category)
 if row.get("rights")=="另需核對授權":errors.append("來源權利待確認")
 if not full.get("sourceUrl","").startswith("https://github.com/staresto-create/"):errors.append("來源連結不在權利人儲存庫")
 return sorted(set(errors))
def signature(q):
 prompt=simpl(q.get("stem"))
 opts=q.get("options") or {}
 # Strict byte-equivalent question content can have multiple source entries.
 return sha256(json.dumps([prompt,sorted([(simpl(k),simpl(v)) for k,v in opts.items()]),simpl(q.get("answer"))],ensure_ascii=False).encode("utf-8")).hexdigest()
def legacy_signature(q):
 return sha256(json.dumps([simpl(q.get("prompt")),sorted([(simpl(k),simpl(v)) for k,v in (q.get("options") or {}).items()]),simpl(q.get("answer"))],ensure_ascii=False).encode("utf-8")).hexdigest()
def main():
 manifest=obj(UPSTREAM/"manifest.json")
 assert len(manifest["files"])==2089 and len(manifest["repos"])==10
 index=obj(CAT/"index.json")
 assert index["meta"]["normalizedRecords"]==4733
 repo_file={(x["repo"],x["path"]):x for x in manifest["files"]}
 shard_cache={};upstream_cache={};audited=[];block_counts=Counter();source_counts=Counter()
 fp=defaultdict(list);fp_all=defaultdict(list)
 audit_data=[]
 for row in index["records"]:
  rel=row["shard"];source_rel=row["sourcePath"]
  if rel not in shard_cache:
   shard_cache[rel]=obj(CAT/"shards"/rel)["records"]
  r=shard_cache[rel][row["position"]]
  if r["id"]!=row["id"]:raise AssertionError("Shard ID mismatch: "+row["id"])
  if source_rel not in upstream_cache:
   data_path=UPSTREAM/"data"/source_rel
   file_entry=repo_file.get(tuple(source_rel.split("/",1)))
   if not file_entry or sha256(data_path.read_bytes()).hexdigest()!=file_entry["sha256"]:
    raise AssertionError("Source hash mismatch: "+source_rel)
   upstream_cache[source_rel]=item_collection(obj(data_path))
  all_src=upstream_cache[source_rel]
  if row["position"]>=len(all_src):raise AssertionError("Index beyond original source "+source_rel)
  raw=all_src[row["position"]]
  issues=record_problem(row,r,raw,source_rel)
  exam_status=check_exam(row,raw,source_rel)
  source_counts[exam_status]+=1
  if issues:
   for reason in issues:block_counts[reason]+=1
  state="結構驗證通過・待內容及權利審核" if not issues else "暫緩納入"
  record={
   "id":row["id"],"category":row["type"],"source":row["source"],
   "sourcePath":source_rel,"sourceItemId":row["sourceItemId"],
   "year":row.get("year"),"exam":row.get("exam"),
   "examDesignation":exam_status,
   "sourceUrl":r["sourceUrl"],"sourceCommit":r["sourceUrl"].split("/blob/")[-1].split("/")[0],
   "status":state,"blocks":issues,
   "canonicalFingerprint":signature(r),"passageId":raw.get("passageId"),
   "sourceConfidence":"automated","licenseStatus":"逐題內容／權利待人工審核",
   "published":False
  }
  audited.append(record)
  if row["status"] not in ("篇章素材",) and (r.get("options") or {}) and r.get("answer") in (r.get("options") or {}) and len(simpl(r.get("stem")))>15:
   fp_all[record["canonicalFingerprint"]].append(row["id"])
  if not issues:fp[record["canonicalFingerprint"]].append(row["id"])
 duplicates={sig:ids for sig,ids in fp.items() if len(ids)>1}
 all_duplicates={sig:ids for sig,ids in fp_all.items() if len(ids)>1}
 dup_candidates=sum(len(ids)-1 for ids in duplicates.values())
 for record in audited:
  sig=record["canonicalFingerprint"]
  if sig in duplicates:
   record["potentialDuplicateOf"]=duplicates[sig][0] if record["id"]!=duplicates[sig][0] else None
   if record["id"]!=duplicates[sig][0]:
    record["blocks"].append("高度相似／完全相同題目，需人工確認來源別名")
    record["status"]="暫緩納入"
 accepted=[r for r in audited if not r["blocks"]]
 gatecount=Counter(r["status"] for r in audited)
 categories=Counter(r["category"] for r in accepted)
 # Safely map previous 668 IDs using strongest available evidence.
 # Never match solely by number, choices or source key. Each verified mapping
 # must share the same answer and complete option set; year when applicable.
 by_exact=defaultdict(list);by_source=defaultdict(list);by_year=defaultdict(list)
 row_index={row["id"]:row for row in index["records"]}
 for row in index["records"]:
  det=shard_cache[row["shard"]][row["position"]]
  by_exact[signature(det)].append(row["id"])
  by_source[simpl(row.get("sourceItemId"))].append(row["id"])
  yr=re.search(r"\d{2,3}",str(row.get("year") or ""))
  if yr:by_year[(row["type"],int(yr.group()))].append(row["id"])
 def similar_answer_choices(q,key):
  det=shard_cache[row_index[key]["shard"]][row_index[key]["position"]]
  if simpl(q.get("answer"))!=simpl(det.get("answer")):return False
  return norm_options(q.get("options"))==norm_options(det.get("options"))
 def same_year(q,key):
  exp=str(q.get("year","")); actual=str(row_index[key].get("year",""))
  x=re.search(r"\d{2,3}",exp);y=re.search(r"\d{2,3}",actual)
  return bool(x and y and int(x.group())==int(y.group()))
 legacy=[];match_stats=Counter()
 for filename in LEGACY:
  sheet=obj(OLD/filename)
  for q in sheet["questions"]:
   desired=legacy_signature(q)
   ids=sorted(set(by_exact.get(desired,[])))
   raw_id=simpl(q.get("sourceId"))
   strong=sorted(set(k for k in by_source.get(raw_id,[]) if similar_answer_choices(q,k) and same_year(q,k)))
   if len(ids)==1:
    match="EXACT";selected=ids[0];evidence=ids
   elif len(strong)==1:
    match="VERIFIED_SOURCE";selected=strong[0];evidence=strong
   elif len(ids)>1:
    match="AMBIGUOUS";selected=None;evidence=ids
   elif len(strong)>1:
    match="AMBIGUOUS";selected=None;evidence=strong
   else:
    expected= "文法與克漏字" if filename.startswith("grammar") else ""
    poss=by_year.get((expected,int(q["year"])),[]) if expected and str(q.get("year","")).isdigit() else []
    choices=[k for k in poss if similar_answer_choices(q,k)]
    if len(choices)==1:
     match="VERIFIED_YEAR_OPTIONS";selected=choices[0];evidence=choices
    else:
     match="AMBIGUOUS" if len(choices)>1 else "UNMATCHED"
     selected=None
     evidence=choices if choices else sorted(set(by_source.get(raw_id,[])))[:8]
   legacy.append({"legacyId":q["id"],"legacyFile":filename,"sourceId":q.get("sourceId"),
                  "matchType":match,"newId":selected,"candidates":evidence if not selected else [],
                  "evidence":"same answer and four/ten options plus matching source ID and year" if match=="VERIFIED_SOURCE" else "same answer, choices and year: identity requires review" if match=="VERIFIED_YEAR_OPTIONS" else "full stem/options/answer match" if match=="EXACT" else "not verified"})
   match_stats[match]+=1
 assert len(legacy)==668,len(legacy)
 assert len(set(x["legacyId"] for x in legacy))==668
 overview={
  "schema":"staresto-v06-phase1-v1","upstreamSnapshot":"2026-10-16",
  "sourceFiles":2089,"jsonDatasets":45,"sourceCandidateRows":len(audited),
  "structurallyPrequalified":len(accepted),"notYetCleared":len(audited)-len(accepted),
  "allowedForProduction":0,
  "duplicateCandidateGroups":len(duplicates),"duplicateExtraRows":dup_candidates,
  "crossSourceDuplicateGroups":len(all_duplicates),
  "status":dict(gatecount),"prequalifiedByCategory":dict(categories),
  "examSourceTypes":dict(source_counts),
  "blockingReasons":dict(block_counts),"legacyMapping":dict(match_stats),
  "warning":"All prequalified rows remain unpublished pending human quality and rights review. No daily plans or localStorage modified."
 }
 write(OUTPUT/"summary.json",overview)
 write(OUTPUT/"candidates.json",audited)
 write(OUTPUT/"legacy-crosswalk.json",{"schema":"v04-to-v06-candidates","rows":legacy,"count":dict(match_stats),
      "notice":"All mappings are candidates; EXACT is equal stem/options/answer, VERIFIED_SOURCE matches source ID/year/answer/options, VERIFIED_YEAR_OPTIONS is provisional and must be reviewed. No records transferred."})
 write(OUTPUT/"duplicate-review.json",{"groups":duplicates,"totalGroups":len(duplicates),"extraRows":dup_candidates,
      "crossSourceGroups":all_duplicates,"crossSourceGroupCount":len(all_duplicates)})
 report=[
 "# Staresto v0.6｜第一階段題庫品質驗收報告","",
 "> 此報告僅分析來源資料。沒有建立正式 v0.6 作答題庫，也沒有讀取或修改任何使用者瀏覽器紀錄。","",
 "## 題庫準入結果","",
 "| 指標 | 筆數 |","|---|---:|",
 f"| v0.5 候選紀錄 | {len(audited):,} |",
 f"| 自動結構檢查通過、待人工內容及權利審核 | {len(accepted):,} |",
 f"| 自動檢查暫緩納入 | {len(audited)-len(accepted):,} |",
 f"| 正式發布題目 | 0 |","",
 "以上是來源候選*紀錄*數，不代表互不重複的考題數；內容正確性與使用權利尚未人工逐題驗收。",
 "即使結構完整，沒有經審定的題目仍不進入每日課表。","",
 "## 結構候選類型","",
 "| 類型 | 筆數 |","|---|---:|"]
 for k,v in categories.most_common():report.append(f"| {k} | {v:,} |")
 report.extend(["","## 暫緩原因（同筆可能重複計數）","","| 原因 | 影響紀錄 |","|---|---:|"])
 for k,v in block_counts.most_common():report.append(f"| {k} | {v:,} |")
 report.extend(["","## 原 v0.4 學習進度相容性","",
 "| 對照狀態 | 題數 |","|---|---:|"])
 for k in ("EXACT","VERIFIED_SOURCE","VERIFIED_YEAR_OPTIONS","AMBIGUOUS","UNMATCHED"):report.append(f"| {k} | {match_stats[k]} |")
 report.extend(["",f"原 v0.4 668 題全部保留在原資料檔；目前僅建立 ID 對照候選，未執行學習紀錄移轉。",
 f"初步準入資料內的完全相同題目群：{len(duplicates)} 組、額外紀錄 {dup_candidates} 筆；全資料跨來源相同題幹與選項群：{len(all_duplicates)} 組（包含參考與試辦來源），須逐項核對。","",
 "## 下一輪待處理","",
 "1. 檢查篩選規則的誤判，特別是篇章題組、來源未明試題、參考／試辦、帶圖題。",
 "2. 人工核對來源權利、答案與解析，標記可發布題目，不能直接以機器通過取代人工複核。",
 "3. 補齊 v0.4 穩定題號對照、去重與題組完整性；不覆寫舊進度。",
 "4. 完成驗收後，才建置 v0.6 每日任務與自由練習引擎。",""])
 (OUTPUT/"REPORT.md").write_text("\n".join(report),encoding="utf-8")
 print("AUDIT_SUMMARY",json.dumps(overview,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
