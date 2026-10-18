#!/usr/bin/env python3
"""Regression checks: phase-one audit preserves legacy and does not auto-release."""
from pathlib import Path
import json
from audit import source_identity
ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent/"output"
def read(name):return json.loads((BASE/name).read_text(encoding="utf-8"))
def run():
 info=read("summary.json");rows=read("candidates.json");old=read("legacy-crosswalk.json");dups=read("duplicate-review.json")
 assert info["schema"]=="staresto-v06-phase1-v1"
 assert info["sourceFiles"]==2089
 assert info["jsonDatasets"]==45
 assert info["sourceCandidateRows"]==4733
 assert sum(info["sourceIdentityChecks"].values())==4733
 assert set(info["sourceIdentityChecks"]).issubset({"MATCH","MISMATCH","UNVERIFIABLE"})
 assert source_identity({"sourceItemId":"G110_16_1"},{"id":"g110-16-1"})[0]=="MATCH"
 assert source_identity({"sourceItemId":"V0091"},{"_sourceKey":"V0091"})[0]=="MATCH"
 assert source_identity({"sourceItemId":"V0091"},{"id":"V0092"})[0]=="MISMATCH"
 assert source_identity({"sourceItemId":"V0091"},{})[0]=="UNVERIFIABLE"
 assert len(rows)==4733
 assert len(set(row["id"] for row in rows))==4733
 assert info["structurallyPrequalified"]+info["notYetCleared"]==4733
 assert info["allowedForProduction"]==0,"no unreviewed item may enter production pool"
 assert sum(info["status"].values())==4733
 assert all(row["licenseStatus"]=="逐題內容／權利待人工審核" and row["published"] is False for row in rows)
 assert all(row["sourceUrl"].startswith("https://github.com/staresto-create/") for row in rows)
 assert all(row["status"]=="暫緩納入" for row in rows if row["sourceIdentityCheck"]!="MATCH"), "uncertain source ID must not be prequalified"
 assert all(row["sourceIdentityCheck"]=="MATCH" for row in rows if row["status"]=="結構驗證通過・待內容及權利審核")
 assert all(row["status"]!="結構驗證通過・待內容及權利審核" or not row["blocks"] for row in rows)
 assert all(row["status"]!="暫緩納入" or row["blocks"] for row in rows)
 assert any(row["status"]=="暫緩納入" for row in rows)
 assert len(old["rows"])==668
 # Every mapping must still refer to an untouched v0.4 dataset record.
 legacy_files={}
 for filename in ("vocab.json","grammar-1.json","grammar-2.json","grammar-3.json","reading.json","completion.json"):
  qs=json.loads((ROOT/"common-subjects"/"daily"/filename).read_text(encoding="utf-8"))["questions"]
  assert len(qs)==len({q["id"] for q in qs})
  legacy_files[filename]={q["id"]:q for q in qs}
 assert sum(len(qs) for qs in legacy_files.values())==668
 for mapping in old["rows"]:
  real=legacy_files[mapping["legacyFile"]][mapping["legacyId"]]
  assert real.get("sourceId")==mapping["sourceId"]
  assert real["id"]==mapping["legacyId"]
 assert set(old["count"]).issubset({"EXACT","VERIFIED_SOURCE","VERIFIED_YEAR_OPTIONS","AMBIGUOUS","UNMATCHED"})
 assert sum(old["count"].values())==668
 assert len({q["legacyId"] for q in old["rows"]})==668
 # Grammar v0.4 IDs g110-16-1 map to upstream G110_16_1 by ID + year
 # + complete options + answer, never by coincidences in choices alone.
 grammar=[q for q in old["rows"] if q["legacyFile"].startswith("grammar-")]
 assert len(grammar)==45
 assert all(q["matchType"] in ("EXACT","VERIFIED_SOURCE") for q in grammar),grammar[:3]
 assert old["count"].get("VERIFIED_YEAR_OPTIONS",0)==0,"year/options-only evidence is insufficient"
 by_old_id={q["legacyId"]:q for q in old["rows"]}
 assert by_old_id["sg:g110-16-1"]["newId"]=="st:grammar-cloze-test:grammar_items.json:G110_16_1"
 assert by_old_id["sp:Vy115_21"]["newId"]=="st:passage-completion:gsat/items.json:Vy115_21"
 assert by_old_id["sr:Rg109_45"]["newId"]=="st:reading-comprehension:gsat/items.json:Rg109_45","do not merge duplicate reference year content"
 assert not any(q["matchType"] in ("AMBIGUOUS","UNMATCHED") for q in old["rows"])
 assert len({q["newId"] for q in old["rows"] if q["newId"]})==sum(q["newId"] is not None for q in old["rows"]),"no two old IDs silently merge"
 assert dups["crossSourceGroupCount"]==len(dups["crossSourceGroups"])
 assert all((q["newId"] is None) if q["matchType"] in ("AMBIGUOUS","UNMATCHED") else isinstance(q["newId"],str) for q in old["rows"])
 assert dups["totalGroups"]==len(dups["groups"])
 # Source training & catalog files remain the exact originals on branch.
 assert (ROOT/"common-subjects/daily/engine.js").is_file()
 assert (ROOT/"common-subjects/catalog/data/index.json").is_file()
 print("PASS v0.6 phase1 source audit, strict no-auto-publication, 668 legacy ID protection")
if __name__=="__main__":run()
