#!/usr/bin/env python3
"""Build searchable question candidates and complete source index from pinned Staresto corpus.

No upstream JS/HTML executed. Source terms: noncommercial educational use with
staresto-create ZZSH attribution; no GPL relicensing of source data.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT=Path(__file__).resolve().parent
CORPUS=ROOT/"library"
OUTPUT=ROOT/"browser"/"data"
YES={"A","B","C","D","E","F","G","H","I","J"}
def dump(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
def text(x):
 if isinstance(x,str):return x.strip()
 if isinstance(x,(int,float)):return str(x)
 if isinstance(x,list):return " ".join(text(a) for a in x if isinstance(a,(str,int,float)))
 return ""
def maybe_options(v):
 val=v.get("options") if isinstance(v,dict) else None
 if not val:val=v.get("o") if isinstance(v,dict) else None
 if isinstance(val,dict):return {str(k).upper():text(y) for k,y in val.items() if str(k).upper() in YES and isinstance(y,(str,int,float))}
 if isinstance(val,list):return {chr(65+i):text(y) for i,y in enumerate(val[:10]) if isinstance(y,(str,int,float))}
 return {}
def candidate_groups(obj):
 """Return source records only for known structured item collections; avoid inventing questions from reference dictionaries."""
 if isinstance(obj,list):
  return [(str(i),v) for i,v in enumerate(obj) if isinstance(v,dict)]
 if not isinstance(obj,dict):return []
 for key in ("items","questions","prompts"):
  if isinstance(obj.get(key),list):return [(str(i),v) for i,v in enumerate(obj[key]) if isinstance(v,dict)]
 if isinstance(obj.get("q"),dict):return [(str(k),v) for k,v in obj["q"].items() if isinstance(v,dict)]
 if isinstance(obj.get("p"),list):return [(str(i),v) for i,v in enumerate(obj["p"]) if isinstance(v,dict)]
 return []
def classify(repo,rel):
 p=rel.lower()
 if "translate/" in p:return "中譯英"
 if "essay-prompts" in repo:return "英文作文"
 if "listening/" in p:return "聽力"
 if "reading-comprehension" in repo:return "閱讀理解"
 if "grammar-cloze-test" in repo or "zhikao-cloze-test" in repo:return "文法與克漏字"
 if "passage-completion" in repo:return "文意選填"
 if "discourse-structure" in repo:return "篇章結構"
 if "mixed-format" in repo:return "混合題"
 if any(z in p for z in ("cards/","lexicon/","wordwheel","roots/","affixes/","gsat/","zhikao/","class/")):return "詞彙與字卡"
 return "其他教材"
def family_type(path):
 ext=Path(path).suffix.lower()
 if ext==".json":return "結構化資料"
 if ext==".html":return "教材頁面"
 if ext==".mp3":return "音訊"
 if ext in (".png",".webp",".jpg",".jpeg",".gif"):return "圖片"
 if ext in (".js",".css",".yml",".xml",".md"):return "網站／支援檔"
 return "其他"
def source_id(v,key):
 for k in ("id","no","number","blankNum","q"):
  if isinstance(v.get(k),(str,int)):return str(v[k])
 return key
def find_prompt(v):
 for k in ("stem","prompt","s","zh","question","instruction","text","title"):
  t=text(v.get(k))
  if t:return t
 return ""
def answer_info(v):
 a=v.get("answer")
 if a is None:a=v.get("a")
 if a is None:a=v.get("answerKey")
 if a is None:a=v.get("answers")
 if isinstance(a,list):return ", ".join(text(y) for y in a)
 return text(a)
def answer_letter(answer,options):
 v=answer.strip().upper()
 if v in options:return v
 if v.isdigit() and len(options)==4:
  n=int(v)
  if 0<=n<4:return chr(65+n)
 return ""
def collect_passages():
 out={}
 for file in CORPUS.glob("data/**/*.json"):
  if "passages" not in file.name.lower():continue
  try:obj=json.loads(file.read_text(encoding="utf-8-sig"))
  except (ValueError,UnicodeError):continue
  rel=file.relative_to(CORPUS/"data")
  repo=rel.parts[0]
  namespace=str(rel.parent)
  if isinstance(obj,dict) and isinstance(obj.get("passages"),(dict,list)):obj=obj["passages"]
  items=[]
  if isinstance(obj,list):items=[(str(v.get("id",i)),v) for i,v in enumerate(obj) if isinstance(v,dict)]
  elif isinstance(obj,dict):items=[(str(k),v) for k,v in obj.items() if isinstance(v,dict)]
  for key,v in items:
   # Some sources encode body as paragraphs/segments.
   body=text(v.get("text")) or text(v.get("passage")) or text(v.get("content"))
   if not body and isinstance(v.get("paras"),list):
    parts=[]
    for para in v["paras"]:
     if isinstance(para,dict) and isinstance(para.get("segs"),list):
      parts.append("".join(str(z[0]) if isinstance(z,list) and z else "" for z in para["segs"]))
     else:parts.append(text(para))
    body="\n\n".join(parts)
   # dict of paragraphs from large reading corpora.
   if not body and isinstance(v.get("paragraphs"),list):
    body="\n\n".join(text(y.get("text") if isinstance(y,dict) else y) for y in v["paragraphs"])
   out[(namespace,key)]={"title":text(v.get("title")),"text":body,
                           "sourcePath":str(rel),"passageId":key}
 return out
def passage_lookup(passages,relative,v):
 pid=text(v.get("passageId")) or text(v.get("passage_id"))
 if not pid:return None
 directory=str(Path(relative).parent)
 matches=[(directory,pid)]
 # e.g. standalone grammar files in different subpath
 for k,p in matches:
  if (k,p) in passages:return passages[(k,p)]
 return None
def main():
 manifest=json.loads((CORPUS/"manifest.json").read_text(encoding="utf-8"))
 if len(manifest["repos"])!=10 or len(manifest["files"])!=2089:raise RuntimeError("Unverified corpus manifest")
 if OUTPUT.exists():shutil.rmtree(OUTPUT)
 OUTPUT.mkdir(parents=True)
 passages=collect_passages()
 records=[];resources=[];shardlist=[];seen=set();possible_dup={};dup_total=0
 issues=Counter();cats=Counter();statuses=Counter();sourceCounts={}
 json_records={x["repo"]+"/"+x["path"]:x for x in manifest["files"] if x["coverage"]=="full-json"}
 for orig in manifest["files"]:
  repo,path=orig["repo"],orig["path"]
  resources.append({"repo":repo,"path":path,"type":family_type(path),"size":orig["size"],
                    "coverage":orig["coverage"],"url":orig["sourceUrl"],
                    "sha256":orig["sha256"],"description":orig.get("title",""),
                    "role":classify(repo,path)})
 for file in sorted((CORPUS/"data").rglob("*.json")):
  relative=str(file.relative_to(CORPUS/"data"))
  if relative not in json_records:raise RuntimeError("JSON not in manifest: "+relative)
  raw=file.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=json_records[relative]["sha256"]:
   raise RuntimeError("Corpus integrity mismatch "+relative)
  obj=json.loads(raw.decode("utf-8-sig"))
  repo,part=relative.split("/",1)
  items=candidate_groups(obj)
  category=classify(repo,part)
  shard=[];kinds=Counter()
  for key,v in items:
   stem=find_prompt(v)
   sourceid=source_id(v,key)
   answer=answer_info(v)
   if category=="中譯英" and not answer:answer=text(v.get("en"))
   options=maybe_options(v)
   letter=answer_letter(answer,options)
   exam=text(v.get("exam")) or text(v.get("t")) or text(v.get("examType"))
   yr=text(v.get("year")) or text(v.get("y")) or text(v.get("yearLabel"))
   examtype=text(v.get("examType")) or ("改編" if "/adapt/" in part else "")
   media=bool(v.get("figure") or v.get("image") or v.get("audio") or v.get("img"))
   passage=passage_lookup(passages,relative,v)
   passage_required=bool(v.get("passageId") or v.get("passage_id"))
   is_article=("passages" in Path(part).stem.lower())
   if passage_required and passage and passage["text"] and not stem:
    stem="依據篇章填入第 "+(text(v.get("blankNum")) or text(v.get("no")) or sourceid)+" 題的正確選項"
   if is_article and not stem:stem=text(v.get("title")) or "篇章素材："+sourceid
   kind="參考教材"
   if options or answer or stem:
    kind="試題候選"
   if category in ("英文作文","中譯英"):kind="非選擇題"
   if is_article:kind="篇章素材"
   if is_article:status="篇章素材"
   elif media:status="需要媒體"
   elif not stem:status="需人工整理"
   elif passage_required and (not passage or not passage["text"]):status="缺少篇章"
   elif options and letter:status="選擇題可核對"
   elif category in ("英文作文","中譯英") and answer:status="非選擇題可核對"
   else:status="需人工整理"
   # Reference exams must be labeled; no claim of unrestricted official-exam rights.
   rights="另需核對授權" if ("參" in yr or "參" in examtype or "試辦" in examtype or "研究" in examtype) else "非商業署名"
   recid="st:"+repo+":"+part+":"+sourceid
   if recid in seen:
    recid=recid+":"+key
   if recid in seen:raise RuntimeError("Duplicate stable ID "+recid)
   seen.add(recid)
   detail={"id":recid,"type":category,"stem":stem,"options":options,
           "answer":letter or answer,"explanation":(text(v.get("explanation")) or (json.dumps(v.get("explanation"),ensure_ascii=False,indent=2) if isinstance(v.get("explanation"),(dict,list)) else "") or text(v.get("note")) or text(v.get("col"))),
           "translation":text(v.get("translation")) or text(v.get("sz")) or text(v.get("zhTranslation")),
           "passage":passage if passage_required else None,
           "sourceUrl":json_records[relative]["sourceUrl"],
           "sourceItemId":sourceid,"year":yr,"exam":exam,
           "examType":examtype,"copyright":"staresto-create ZZSH；非商業教學／學習用途；轉載須註明來源；非 GPL 授權",
           "rights":rights,"status":status,"originalCategory":text(v.get("category"))}
   shard.append(detail)
   ix={"id":recid,"type":category,"kind":kind,"year":yr,"exam":exam,
       "examType":examtype,"rights":rights,"status":status,"source":repo,
       "sourcePath":relative,"shard":relative,"position":len(shard)-1,
       "preview":stem[:165],"sourceItemId":sourceid,
       "hasPassage":passage_required,"hasMedia":media}
   if status in ("選擇題可核對","非選擇題可核對") and len(stem)>15:
    signature=json.dumps([
     re.sub(r"\s+"," ",stem).casefold(),
     sorted((k,re.sub(r"\s+"," ",val).casefold()) for k,val in options.items()),
     letter or answer,yr],ensure_ascii=False,sort_keys=True)
    fingerprint=hashlib.sha256(signature.encode("utf-8")).hexdigest()
    if fingerprint in possible_dup:
     ix["possibleDuplicateOf"]=possible_dup[fingerprint]
     dup_total+=1
    else:
     possible_dup[fingerprint]=recid
   records.append(ix);cats[category]+=1;statuses[status]+=1;kinds[status]+=1
  if shard:
   dest=OUTPUT/"shards"/relative
   dump(dest,{"source":relative,"author":"staresto-create ZZSH","records":shard})
   shardlist.append(relative)
  sourceCounts[relative]={"candidates":len(shard),"statuses":dict(kinds)}
 # Pages without JSON question structure stay searchable from complete resource index.
 meta={"schema":"staresto-normalized-v05","originBranch":"data/staresto-full-catalog-20261016",
       "originalFiles":len(resources),"jsonFiles":len(json_records),"normalizedRecords":len(records),
       "shards":len(shardlist),"possibleDuplicateRecords":dup_total,"statusCounts":dict(statuses),
       "categoryCounts":dict(cats),"rightsNotice":"All quoted Staresto translations and explanations are attributed, noncommercial, and not GPL sublicensed. Some official references need separate rights review.",
       "limitations":"Question candidates can overlap across datasets; not unique exam question counts. No practice scheduling changes.",
       "recordSources":sourceCounts}
 dump(OUTPUT/"index.json",{"meta":{k:v for k,v in meta.items() if k!="recordSources"},"records":records})
 dump(OUTPUT/"resources.json",{"total":len(resources),"records":resources})
 dump(OUTPUT/"report.json",meta)
 # file counts and status are facts only of this particular snapshot
 report=[
 "# Staresto v0.5 題庫標準化驗收報告","",
 "本次僅對已收錄資料標準化、搜尋及來源分類，不修改正式每日英文668題、國文作文、任何舊學習紀錄。",
 "",
 "來源檔案 "+str(len(resources))+" 個；結構化 JSON "+str(len(json_records))+" 份；"
 " 索引紀錄 "+str(len(records))+" 筆（**不是去重後的正式題目數**）；疑似重複 "+str(dup_total)+" 筆。",
 "",
 "## 來源類型","",
 "| 類別 | 紀錄筆數 |","|---|---:|"]
 for category,n in sorted(cats.items(),key=lambda x:-x[1]):report.append("| "+category+" | "+str(n)+" |")
 report.extend(["","## 資料驗證狀況","","| 狀況 | 筆數 |","|---|---:|"])
 for name,n in sorted(statuses.items(),key=lambda x:-x[1]):report.append("| "+name+" | "+str(n)+" |")
 report.extend(["","## 重要限制","",
 "- 所有來源資料分別保留原始出處與作者著作權，不宣稱正式、參考、試辦試題具有相同利用條件。",
 "- 已標記「選擇題可核對」的紀錄只能說答案選項結構可檢查；不代表已人工確認全部解析正確或適合立即加入每日訓練。",
 "- 一個題目可能同時出現在詞彙卡、歷屆考題及改編教材，因此候選紀錄筆數不等於不重複題數。",
 "- 需要篇章、外部圖片或音訊的題目必須保留所需素材及相應使用權利。",
 "- 此分支僅供題庫瀏覽與查核，沒有連結到現行 v0.4 學習紀錄，也沒有對正式站部署。",
 ""])
 (ROOT/"browser"/"REPORT.md").write_text("\n".join(report),encoding="utf-8")
 print("COVERAGE",json.dumps({k:meta[k] for k in ("originalFiles","jsonFiles","normalizedRecords","shards","statusCounts","categoryCounts")},ensure_ascii=False),flush=True)
if __name__=="__main__":main()
