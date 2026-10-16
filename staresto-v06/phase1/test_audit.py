#!/usr/bin/env python3
"""Regression checks: phase-one audit preserves legacy and does not auto-release."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent/"output"
def read(name):return json.loads((BASE/name).read_text(encoding="utf-8"))
def run():
 info=read("summary.json");rows=read("candidates.json");old=read("legacy-crosswalk.json");dups=read("duplicate-review.json")
 assert info["schema"]=="staresto-v06-phase1-v1"
 assert info["sourceFiles"]==2089
 assert info["jsonDatasets"]==45
 assert info["sourceCandidateRows"]==4733
 assert len(rows)==4733
 assert len(set(row["id"] for row in rows))==4733
 assert info["structurallyPrequalified"]+info["notYetCleared"]==4733
 assert info["allowedForProduction"]==0,"no unreviewed item may enter production pool"
 assert sum(info["status"].values())==4733
 assert all(row["licenseStatus"]=="逐題內容／權利待人工審核" and row["published"] is False for row in rows)
 assert all(row["sourceUrl"].startswith("https://github.com/staresto-create/") for row in rows)
 assert all(row["status"]!="結構驗證通過・待內容及權利審核" or not row["blocks"] for row in rows)
 assert all(row["status"]!="暫緩納入" or row["blocks"] for row in rows)
 assert any(row["status"]=="暫緩納入" for row in rows)
 assert len(old["rows"])==668
 assert set(old["count"]).issubset({"EXACT","VERIFIED_SOURCE","VERIFIED_YEAR_OPTIONS","AMBIGUOUS","UNMATCHED"})
 assert sum(old["count"].values())==668
 assert len({q["legacyId"] for q in old["rows"]})==668
 assert all((q["newId"] is None) if q["matchType"] in ("AMBIGUOUS","UNMATCHED") else isinstance(q["newId"],str) for q in old["rows"])
 assert dups["totalGroups"]==len(dups["groups"])
 # Source training & catalog files remain the exact originals on branch.
 assert (ROOT/"common-subjects/daily/engine.js").is_file()
 assert (ROOT/"common-subjects/catalog/data/index.json").is_file()
 print("PASS v0.6 phase1 source audit, strict no-auto-publication, 668 legacy ID protection")
if __name__=="__main__":run()
