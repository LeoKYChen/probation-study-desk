#!/usr/bin/env python3
"""Stage3k gap: check ONE middle linked decision from H-CIV-2 only.

Reuses official history list from 114再易110 parent (not previous child docs);
never queries the six linked decisions already sampled and passed. The JID of
the new child remains process-local, absent from logs/artifacts/repository.
"""
import argparse
import asyncio
import json
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx

from stage3h_diff_diagnostics import strict_source
from stage3j_history_lists import history_key,bounded_get,HISTORY_BASE
from stage3k_linked_history import (
    PARENTS,MAX_HTML_BYTES,MAX_HISTORY_BYTES,
    read_history_metadata,choose_candidates,
    history_source_url_ok,source_identity
)

OUT=Path("v27-mcp-stage3k-one-link-gap.json")
LABEL="H-CIV-2"
PARENT=next((p for p in PARENTS if p[0]==LABEL),None)

async def audit():
    report={
        "phase":"stage3k linked history gap, middle linked case only",
        "utc":datetime.now(timezone.utc).isoformat(),
        "parent":LABEL,"status":"review",
        "parent_get":0,"history_get":0,"linked_get":0,
        "prior_six_requeried":False,
        "new_related_jid_saved":False,"court_text_saved":False,
        "juvenile_case_queried":False,
        "stage3_accepted":False,
        "all_27_items_verified":False,
        "court_link_finality_proven":False
    }
    if PARENT is None:
        report["reason"]="approved_parent_fixture_missing"
        return report
    label,parent,baseline=PARENT
    async with httpx.AsyncClient(timeout=httpx.Timeout(25,connect=9),
        follow_redirects=False,headers={"User-Agent":"v27-bounded-one-link-gap/1",
                                        "Accept-Encoding":"identity"}) as http:
        url=("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
             +urlencode({"ty":"JD","id":parent}))
        report["parent_get"]+=1
        html,reason=await bounded_get(http,url,MAX_HTML_BYTES,
                                      lambda u:strict_source(u,parent))
        if html is None:
            report["reason"]="parent_"+reason
            return report
        key=history_key(html)
        if key is None:
            report["reason"]="parent_history_key_missing"
            return report
        report["history_get"]+=1
        raw,reason=await bounded_get(http,HISTORY_BASE+key,MAX_HISTORY_BYTES,
                                     lambda u:history_source_url_ok(u,key))
        if raw is None:
            report["reason"]="history_"+reason
            return report
        rows,reason=read_history_metadata(raw)
        if rows is None:
            report["reason"]=reason
            return report
        report["official_history_entry_count"]=len(rows)
        report["baseline_count_unchanged"]=len(rows)==baseline
        if len(rows)!=baseline:
            report["reason"]="history_count_changed_since_prior_pass"
            return report
        # The earlier Stage3k run checked ONLY first and last eligible JIDs
        # from this parent. Require exactly the original three eligible JIDs
        # before checking the one missing middle child.
        eligible=[]
        seen=set()
        for item in rows:
            from stage3k_linked_history import classify_link,KNOWN_ORIGINALS
            jid,why=classify_link(item)
            if not jid or jid in KNOWN_ORIGINALS or jid in seen:
                continue
            seen.add(jid)
            eligible.append(jid)
        report["eligible_related_link_count"]=len(eligible)
        if len(eligible)!=3:
            report["reason"]="eligible_link_set_changed_no_safe_gap_inference"
            return report
        selected,counters=choose_candidates(rows,set())
        if selected!=[eligible[0],eligible[-1]]:
            report["reason"]="original_sample_position_mismatch"
            return report
        # Do NOT get the previously sampled first and last case pages.
        missing=eligible[1]
        report["linked_get"]+=1
        child=("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
               +urlencode({"ty":"JD","id":missing}))
        body,why=await bounded_get(http,child,MAX_HTML_BYTES,
                                   lambda u:strict_source(u,missing))
        if body is None:
            report["reason"]="linked_"+why
            return report
        checked=source_identity(body,missing)
        # Do not write any source content or JID.
        for key in ("official_body_substantial","identity_matches",
                    "date_matches","official_document_accessible"):
            report[key]=checked.get(key,False)
        report["status"]=checked["status"]
        report["reason"]=checked["reason"]
        report["new_link_check_passed"]=checked["status"]=="passed"
    report["stage3_accepted"]=False
    return report

def selftest():
    assert PARENT is not None and PARENT[2]==9
    assert LABEL=="H-CIV-2"
    assert "再易" in PARENT[1]
    assert len(PARENTS)==7
    print("One middle-link gap check isolated from prior six",flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=("selftest","live"),required=True)
    arg=p.parse_args()
    if arg.mode=="selftest":
        selftest()
    else:
        try:report=asyncio.run(audit())
        except Exception as exc:
            report={"fatal_error":type(exc).__name__,"stage3_accepted":False}
        OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:report.get(k) for k in
            ("status","reason","eligible_related_link_count","new_link_check_passed",
             "prior_six_requeried","stage3_accepted","fatal_error")},
            ensure_ascii=False),flush=True)
        if report.get("fatal_error"):
            raise SystemExit(1)
