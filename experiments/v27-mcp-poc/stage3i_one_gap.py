#!/usr/bin/env python3
"""Stage 3i gap: ONE additional public ordinary district criminal judgment.

Two small subject searches at most. Never retest the nine already checked
court documents. No judgment bodies, names, parties or snippets saved/logged.
"""
import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from stage3i_eight_public_samples import audited_search, evaluate_one, jid_is_eligible

REPORT=Path("v27-mcp-stage3i-one-gap.json")
COURT="臺灣臺中地方法院"
CODE="TCDM"
PRIOR={
    "TPSM,114,台抗,2605,20251231,1",
    "TPSM,114,台抗,2657,20251231,1",
    "TPHV,114,上易,1030,20251231,2",
    "TPHV,114,再易,110,20251231,1",
    "TPDV,114,司票,26166,20251231,2",
    "TPDV,114,重訴,238,20251231,1",
    "TCHM,114,上易,801,20251231,2",
    "TCHM,114,金上訴,2749,20251231,2",
    "TCDM,114,金訴,2374,20251231,2",
}
KEYWORDS=("竊盜","妨害自由")
MAX_NEW_SEARCHES=2
MAX_NEW_OFFICIAL_GET=10


async def main():
    report={
        "phase":"stage3i gap: seek tenth distinct publicly listed ordinary adult-court sample",
        "utc":datetime.now(timezone.utc).isoformat(),
        "already_passed_from_previous_runs":len(PRIOR),
        "new_target":1,
        "max_searches":MAX_NEW_SEARCHES,
        "max_direct_official_get":MAX_NEW_OFFICIAL_GET,
        "new_fidelity_passed":0,
        "cases":[],
        "search_status":[],
        "court_body_persisted":False,
        "court_personal_details_persisted":False,
        "official_authenticated_api_used":False,
        "case_publication_at_future_time_guaranteed":False,
        "stage3_accepted":False,
    }
    seen=set(PRIOR)
    fetched=0
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(25,connect=10),follow_redirects=False,
        headers={"User-Agent":"v27-small-source-gap-audit/1","Accept-Encoding":"identity"}
    ) as official:
        async with stdio_client(StdioServerParameters(
            command=sys.executable,args=["-m","mcp_server.server"]
        )) as (rd,wr):
            async with ClientSession(rd,wr) as session:
                await asyncio.wait_for(session.initialize(),timeout=45)
                for keyword in KEYWORDS:
                    items,reason=await audited_search(session,COURT,"刑事",keyword)
                    search={"topic":"bounded_public_criminal","result":reason,
                            "candidates":len(items) if items is not None else 0}
                    report["search_status"].append(search)
                    if items is None:
                        print("gap search review",reason,flush=True)
                        continue
                    for item in items:
                        jid=item.get("jid") if isinstance(item,dict) else None
                        if not jid_is_eligible(jid,CODE,seen):
                            continue
                        if fetched>=MAX_NEW_OFFICIAL_GET:
                            break
                        seen.add(jid)
                        fetched+=1
                        result=await evaluate_one(session,official,jid,COURT,
                            {"name":"D-CRM-GAP","type":"刑事"})
                        print("gap official check",result["status"],result.get("reason"),
                              "source_verified",result.get("source_verified"),flush=True)
                        # Persist a JID only after the independent official page
                        # has confirmed its court/number/year/body.
                        if result.get("source_verified"):
                            report["cases"].append(result)
                        if result.get("text_capture_fidelity"):
                            report["new_fidelity_passed"]=1
                            break
                        await asyncio.sleep(1)
                    if report["new_fidelity_passed"]:
                        break
    report["new_official_get"]=fetched
    report["total_fidelity_passed_including_prior_nine"]=len(PRIOR)+report["new_fidelity_passed"]
    report["text_sampling_ten_complete"]=report["new_fidelity_passed"]==1
    report["stage3_accepted"]=False
    report["note"]="Text fidelity is separate from judgment date, appeal finality, current publication, withdrawal and API authority."
    return report


def selftest():
    assert len(PRIOR)==9 and len(KEYWORDS)==2
    assert "少年" not in COURT and "少年" not in " ".join(KEYWORDS)
    assert jid_is_eligible("TCDM,114,易,678,20251202,1",CODE,PRIOR)
    assert not jid_is_eligible("TCDM,114,金訴,2374,20251231,2",CODE,PRIOR)
    assert not jid_is_eligible("KSYM,114,少護,1,20251231,1","KSYM",PRIOR)
    print("Stage3i gap safeguards: nine preserved, two queries max, no juvenile special court",flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",required=True,choices=("selftest","live"))
    a=p.parse_args()
    if a.mode=="selftest":
        selftest()
    else:
        try:
            result=asyncio.run(main())
        except Exception as exc:
            result={"fatal_error":type(exc).__name__,
                    "new_fidelity_passed":0,"stage3_accepted":False}
        REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({x:result.get(x) for x in
            ("new_fidelity_passed","new_official_get",
             "total_fidelity_passed_including_prior_nine",
             "text_sampling_ten_complete","stage3_accepted","fatal_error")},
            ensure_ascii=False),flush=True)
        if result.get("fatal_error") or any(x["status"]=="failed" for x in result.get("cases",[])):
            sys.exit(1)
