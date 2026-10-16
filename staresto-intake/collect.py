#!/usr/bin/env python3
"""Source-pinned corpus index. Never execute or republish upstream site code."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import quote
import hashlib, json, re, subprocess, tempfile, shutil
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"library"
SOURCES={
"JCEE-vocab-questions":("7342ffeafc4870943b9531ec57e0c5b0c39acbe8",511),
"gsat-passage-completion":("d9bd801d1780210a15a2e524db68b4a663b99f35",1),
"essay-prompts":("b3a3e6b0f8e6e4c387edc5ecb0e0c26f615854d2",63),
"grammar-cloze-test":("558329c05a567d2ba3b0b446b3c2e247b87f2d9c",617),
"mixed-format":("2753fe370cca8510589ffa4d2471103e46e705a0",4),
"reading-comprehension":("80ab2474f58fde2e11a4804b84d2ee566e8ddd47",289),
"passage-completion":("9ddc8ead0225730a61506b7d0413f485c0df2e3a",11),
"zhikao-cloze-test":("9e28e42ed3645273e544b95e5517e1fc63182f76",416),
"summer-task":("7c742f1a2cd6d6e68580711693fcb8e9cc71ce76",1),
"discourse-structure":("cecde1d171d5bb9e2cc05964aef1f6d0819102e8",176)
}
BREAKS=set("p div section article main h1 h2 h3 h4 h5 h6 br li td tr th pre summary".split())
SKIP=set("script style svg noscript canvas head iframe".split())
class TextOnly(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.skip=[];self.text=[];self.title=[];self.intitle=False
 def handle_starttag(self,tag,attrs):
  if tag=="title":self.intitle=True
  if tag in SKIP:self.skip.append(tag)
  if not self.skip and tag in BREAKS:self.text.append("\n")
 def handle_endtag(self,tag):
  if tag=="title":self.intitle=False
  if self.skip and self.skip[-1]==tag:self.skip.pop()
  if not self.skip and tag in BREAKS:self.text.append("\n")
 def handle_data(self,data):
  if self.intitle:self.title.append(data)
  if not self.skip:self.text.append(data)
def safe_text(blob):
 p=TextOnly();p.feed(blob.decode("utf-8","replace"))
 lines=[re.sub(r"\s+"," ",x).strip() for x in "".join(p.text).splitlines()]
 return "".join(p.title).strip(),"\n".join(x for x in lines if x)+"\n"
def cmd(*args,cwd=None):
 return subprocess.check_output(["git",*args],cwd=cwd,stderr=subprocess.DEVNULL).decode().strip()
def main():
 if OUT.exists():shutil.rmtree(OUT)
 OUT.mkdir(parents=True)
 manifest={"schema":"staresto-complete-catalog-v1","snapshotDate":"2026-10-16","author":"staresto-create ZZSH","repos":{},"files":[]}
 with tempfile.TemporaryDirectory(prefix="staresto-snapshot-") as temp:
  for name,(pinned,expected) in SOURCES.items():
   src=Path(temp)/name
   cmd("clone","--quiet","--depth","1","https://github.com/staresto-create/"+name+".git",str(src))
   current=cmd("rev-parse","HEAD",cwd=src)
   if current!=pinned:raise RuntimeError(name+" source commit changed; refuse unverified import")
   entries=[x for x in subprocess.check_output(["git","ls-files","-z"],cwd=src).decode().split("\0") if x]
   if len(entries)!=expected:raise RuntimeError(name+" source file count mismatch")
   row={"commit":pinned,"files":0,"bytes":0,"json":0,"htmlText":0,"linkedOnly":0}
   for relative in sorted(entries):
    path=src/relative
    if path.is_symlink() or not path.is_file():raise RuntimeError(name+"/"+relative+" invalid source")
    blob=path.read_bytes()
    url="https://github.com/staresto-create/"+name+"/blob/"+pinned+"/"+quote(relative,safe="/")
    ext=path.suffix.lower()
    record={"repo":name,"path":relative,"size":len(blob),"sha256":hashlib.sha256(blob).hexdigest(),"sourceUrl":url}
    row["files"]+=1;row["bytes"]+=len(blob)
    if ext==".json":
     json.loads(blob.decode("utf-8-sig"))
     dest=OUT/"data"/name/relative
     dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(blob)
     record["coverage"]="full-json";record["local"]="data/"+name+"/"+relative
     row["json"]+=1
    elif ext in (".html",".htm"):
     title,plain=safe_text(blob)
     dest=OUT/"pages"/name/(relative+".txt")
     dest.parent.mkdir(parents=True,exist_ok=True)
     dest.write_text("Source: "+url+"\nAuthor: staresto-create ZZSH\nTitle: "+title+"\nNoncommercial educational text only\n\n"+plain,encoding="utf-8")
     record["coverage"]="safe-visible-text";record["title"]=title
     record["local"]="pages/"+name+"/"+relative+".txt"
     row["htmlText"]+=1
    else:
     record["coverage"]="indexed-only";row["linkedOnly"]+=1
    manifest["files"].append(record)
   manifest["repos"][name]=row
   print(name, row,flush=True)
 count=sum(x["files"] for x in manifest["repos"].values())
 if count!=sum(x[1] for x in SOURCES.values()) or len(manifest["files"])!=count:raise RuntimeError("Incomplete index")
 (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 pages=sum(x["htmlText"] for x in manifest["repos"].values())
 data=sum(x["json"] for x in manifest["repos"].values())
 links=sum(x["linkedOnly"] for x in manifest["repos"].values())
 total=sum(x["bytes"] for x in manifest["repos"].values())
 lines=["# Staresto 全站資源收錄索引","",
 "涵蓋全部10個公開儲存庫與其於2026-10-16鎖定版本的每個檔案。",
 "來源共 "+str(count)+" 個檔案（約 "+str(round(total/1e6,2))+" MB）。",
 "已收錄全部 "+str(data)+" 份 JSON 原始資料與 "+str(pages)+" 頁不可執行的網頁文字。",
 "其餘 "+str(links)+" 個圖片、音檔、程式等僅保留完整來源連結、大小與 SHA256，因其重製授權尚未確認。",
 "",
 "## 來源清單","",
 "| 專案 | 來源檔 | MB | JSON | 頁面文字 | 僅索引 |",
 "|---|---:|---:|---:|---:|---:|"]
 for name,row in manifest["repos"].items():
  lines.append("| ["+name+"](https://github.com/staresto-create/"+name+") | "+str(row["files"])+" | "+str(round(row["bytes"]/1e6,2))+" | "+str(row["json"])+" | "+str(row["htmlText"])+" | "+str(row["linkedOnly"])+" |")
 lines+=["","## 使用界線","",
 "- Staresto 作者：staresto-create ZZSH。原創解析、中譯、編排僅供非商業學習與教學，轉載應保留作者和來源。",
 "- 正式考題及參考／試辦／研究試題的法律性質不同；參考與試辦題仍須遵守大考中心相關使用條件。",
 "- 本索引資料非本專案 GPL 程式碼授權的一部分，不得擅自視為商業利用授權。",
 "- 網站 JS/CSS、第三方圖檔及 MP3 的重製許可未明，未直接複製；每檔有來源網址、雜湊可供日後核對。",
 "- 不將來源的可執行 HTML/JS 直接部署到同源 GitHub Pages，以免讀取使用者 localStorage。",
 "- 此資料僅存在獨立資料分支，正式668題每日英文練習站、作文及舊題紀錄均不受影響。",
 "",
 "## 下一步","",
 "依此索引對題型／難度／參考試卷／圖像依賴進行驗收後，再和使用者討論練習安排。",
 "詳細逐檔 provenance 與覆蓋狀態：manifest.json。"]
 (OUT/"CATALOG.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 (OUT/"NOTICE.txt").write_text("Source owner: staresto-create ZZSH\nNoncommercial study and teaching with attribution. Not GPL relicensed.\nSource code/audio/images are linked only pending rights checks.\n",encoding="utf-8")
 print("COMPLETE:",count,"source files,",data,"JSON,",pages,"HTML text,",links,"linked-only",flush=True)
if __name__=="__main__":main()
