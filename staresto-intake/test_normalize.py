#!/usr/bin/env python3
"""Check provenance integrity and browser index consistency."""
import json
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parent
D=ROOT/"browser"/"data"
def read(n):return json.loads((D/n).read_text(encoding="utf-8"))
def main():
 manifest=json.loads((ROOT/"library"/"manifest.json").read_text(encoding="utf-8"))
 ix=read("index.json");resources=read("resources.json");meta=read("report.json")
 assert len(manifest["repos"])==10
 assert len(manifest["files"])==2089
 assert resources["total"]==2089
 assert len(ix["records"])==meta["normalizedRecords"]
 assert meta["jsonFiles"]==45
 assert len(ix["records"])>1000,"Expected substantial indexed content"
 assert set(meta["categoryCounts"])>=set(("閱讀理解","詞彙與字卡","文法與克漏字","文意選填","篇章結構","混合題","中譯英","英文作文"))
 indexed={(r["repo"],r["path"],r["sha256"]) for r in resources["records"]}
 assert indexed=={(r["repo"],r["path"],r["sha256"]) for r in manifest["files"]}
 valid={}
 for row in ix["records"]:
  shard=row["shard"]
  assert not shard.startswith("/") and ".." not in shard
  if shard not in valid:valid[shard]=read("shards/"+shard)
  data=valid[shard]
  assert data["source"]==shard
  item=data["records"][row["position"]]
  assert item["id"]==row["id"],row["id"]
  assert item["sourceItemId"]==row["sourceItemId"]
  assert item["copyright"].startswith("staresto-create ZZSH")
  assert item["status"]==row["status"]
  assert item["sourceUrl"].startswith("https://github.com/staresto-create/")
  assert item["answer"] is not None
  if item["status"]=="選擇題可核對":
   assert item["answer"] in item["options"],item["id"]
   assert item["stem"],item["id"]
  if item["status"]=="缺少篇章":assert row["hasPassage"]
  if item["status"]=="需要媒體":assert row["hasMedia"]
 assert len(set(r["id"] for r in ix["records"]))==len(ix["records"]),"Every candidate has stable unique ID"
 assert len(valid)==meta["shards"]
 counts=Counter(r["status"] for r in ix["records"])
 assert dict(counts)==meta["statusCounts"]
 assert not any("file:///" in str(row) for row in ix["records"])
 print("PASS v0.5: 2089 provenance files, 45 JSON datasets,",
       len(ix["records"]),"normalized records,",
       len(valid),"shards; statuses",dict(counts),flush=True)
if __name__=="__main__":main()
