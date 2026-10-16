#!/usr/bin/env python3
"""Stage3i date/identity metadata audit of ten known public court documents.

This does NOT rerun the already-passed MCP full-text comparisons. Only ten
single official GET requests, with strict source checks. No full text, party
names or personally identifying content is persisted or logged.
"""
import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup
from stage3h_diff_diagnostics import strict_source, norm

REPORT=Path("v27-stage3i-official-dates.json")
SAMPLES=(
    ("J01","TPSM,114,台抗,2605,20251231,1","最高法院","刑事"),
    ("J03","TPSM,114,台抗,2657,20251231,1","最高法院","刑事"),
    ("H-CIV-1","TPHV,114,上易,1030,20251231,2","臺灣高等法院","民事"),
    ("H-CIV-2","TPHV,114,再易,110,20251231,1","臺灣高等法院","民事"),
    ("D-CIV-1","TPDV,114,司票,26166,20251231,2","臺灣臺北地方法院","民事"),
    ("D-CIV-2","TPDV,114,重訴,238,20251231,1","臺灣臺北地方法院","民事"),
    ("H-CRM-1","TCHM,114,上易,801,20251231,2","臺灣高等法院臺中分院","刑事"),
    ("H-CRM-2","TCHM,114,金上訴,2749,20251231,2","臺灣高等法院臺中分院","刑事"),
    ("D-CRM-1","TCDM,114,金訴,2374,20251231,2","臺灣臺中地方法院","刑事"),
    ("D-CRM-2","TCDM,114,聲,4461,20251231,1","臺灣臺中地方法院","刑事"),
)
MAX_BYTES=800_000
MAX_HTTP_GET=10


def normalized_identity(value):
    return norm(value).replace("臺","台")


def roc_date(value):
    """Parse only a substantial official ROC/Gregorian date label."""
    s=norm(value)
    m=re.search(r"(?:民國)?(\d{2,3})年(\d{1,2})月(\d{1,2})日",s)
    if m:
        y=int(m.group(1))+1911
        mo=int(m.group(2))
        d=int(m.group(3))
    else:
        m=re.search(r"(?<!\d)(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?!\d)",s)
        if not m:
            return None
        y,mo,d=map(int,m.groups())
    try:
        return datetime(y,mo,d).strftime("%Y%m%d")
    except ValueError:
        return None


def find_metadata(raw):
    doc=BeautifulSoup(raw,"lxml")
    root=doc.select_one("#jud")
    if root is None:
        return None,"official_jud_node_missing"
    values={}
    for row in root.select(".row"):
        name=row.select_one(".col-th")
        value=row.select_one(".col-td:not(.jud_content)")
        if name is None or value is None:
            continue
        label=norm(name.get_text(" ",strip=True))
        cell=norm(value.get_text(" ",strip=True))
        for kind in ("裁判字號","裁判日期","裁判案由"):
            if kind in label and cell and kind not in values:
                values[kind]=cell
    if not values:
        return None,"structured_metadata_rows_not_found"
    # Only normalized metadata retained transiently; never printed/saved.
    return values,"metadata_read"


def verify_metadata(raw, jid, court, civil_or_criminal):
    values,reason=find_metadata(raw)
    record={
        "status":"review","reason":reason,
        "official_identity_confirmed":False,
        "official_date_matched_jid":False,
        "court_and_type_text_confirmed":False,
        "fulltext_rechecked":False,"date_source_kind":"official_structured_metadata_only",
    }
    if values is None:
        return record
    parts=jid.split(",")
    number=values.get("裁判字號","")
    date=roc_date(values.get("裁判日期",""))
    has_case=bool(
        number and normalized_identity(parts[2]) in normalized_identity(number)
        and parts[3] in number and parts[1] in number
    )
    body=BeautifulSoup(raw,"lxml").select_one("#jud")
    content=normalized_identity(body.get_text(" ",strip=True)) if body else ""
    has_court_and_type=(
        normalized_identity(court) in content
        and civil_or_criminal in content
    )
    date_ok=date==parts[4]
    record.update({
        "official_identity_confirmed":has_case,
        "official_date_matched_jid":date_ok,
        "court_and_type_text_confirmed":has_court_and_type,
        "date_label_present":bool(values.get("裁判日期")),
        "official_date_parsed":bool(date),
    })
    # Deliberately do not persist court names or actual document metadata text;
    # public identifier already known from the prior stage is sufficient.
    if date_ok and has_case and has_court_and_type:
        record.update(status="passed",reason="official_case_type_court_and_date_verified")
    elif not date:
        record["reason"]="official_date_metadata_missing_or_unparseable"
    elif not date_ok:
        record["reason"]="official_date_disagrees_with_jid"
    elif not has_case:
        record["reason"]="official_case_number_identity_unconfirmed"
    else:
        record["reason"]="court_or_case_type_unconfirmed"
    return record


async def get_page(client,jid):
    url="https://judgment.judicial.gov.tw/FJUD/data.aspx?"+urlencode({"ty":"JD","id":jid})
    assert strict_source(url,jid)
    try:
        async with client.stream("GET",url) as reply:
            if not strict_source(str(reply.url),jid):
                return None,"wrong_source"
            if reply.status_code!=200:
                return None,"official_http_"+str(reply.status_code)
            chunks=[]
            total=0
            async for chunk in reply.aiter_bytes():
                total+=len(chunk)
                if total>MAX_BYTES:
                    return None,"official_http_over_size_cap"
                chunks.append(chunk)
            return b"".join(chunks),"official_html_received"
    except (httpx.HTTPError,asyncio.TimeoutError) as e:
        return None,"official_unavailable:"+type(e).__name__


async def audit():
    report={
        "phase":"v2.7 stage3i dates/identity, ten previously examined published courts",
        "utc":datetime.now(timezone.utc).isoformat(),
        "sample_count":len(SAMPLES),
        "max_http_get":MAX_HTTP_GET,
        "mcp_fulltext_rerun":False,
        "court_html_saved":False,
        "stage3_accepted":False,
        "historical_appeals_verified":False,
        "current_publication_future_guaranteed":False,
        "cases":[],
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(24,connect=9),
        follow_redirects=False, headers={"User-Agent":"v27-readonly-metadata-audit/1",
                                         "Accept-Encoding":"identity"}) as session:
        for label,jid,court,case_type in SAMPLES:
            row={"id":label,"public_jid":jid,"status":"review"}
            raw,reason=await get_page(session,jid)
            if raw is None:
                row["reason"]=reason
            else:
                row.update(verify_metadata(raw,jid,court,case_type))
            report["cases"].append(row)
            print(label,row["status"],row.get("reason"),
                  "date_equals_jid",row.get("official_date_matched_jid"),flush=True)
            await asyncio.sleep(1)
    report["counts"]={k:sum(x["status"]==k for x in report["cases"])
                      for k in ("passed","review","failed")}
    report["all_ten_date_and_identity_passed"]=report["counts"]["passed"]==10
    report["stage3_accepted"]=False
    return report


def selftest():
    assert len(SAMPLES)==10 and len(set(x[1] for x in SAMPLES))==10
    assert roc_date("民國114年12月31日")=="20251231"
    assert roc_date("114 年 12 月 31 日")=="20251231"
    assert roc_date("2025-12-31")=="20251231"
    assert roc_date("民國114年13月32日") is None
    markup=b'<div id="jud"><div class="row"><div class="col-th">\xe8\xa3\x81\xe5\x88\xa4\xe5\xad\x97\xe8\x99\x9f</div><div class="col-td">114\xe5\xb9\xb4\xe5\xba\xa6\xe5\x8f\xb0\xe6\x8a\x97\xe5\xad\x97\xe7\xac\xac2605\xe8\x99\x9f</div></div><div class="row"><div class="col-th">\xe8\xa3\x81\xe5\x88\xa4\xe6\x97\xa5\xe6\x9c\x9f</div><div class="col-td">\xe6\xb0\x91\xe5\x9c\x8b114\xe5\xb9\xb412\xe6\x9c\x8831\xe6\x97\xa5</div></div><div>\xe6\x9c\x80\xe9\xab\x98\xe6\xb3\x95\xe9\x99\xa2\xe5\x88\x91\xe4\xba\x8b\xe8\xa3\x81\xe5\xae\x9a</div></div>'
    sample=verify_metadata(markup,SAMPLES[0][1],"最高法院","刑事")
    assert sample["status"]=="passed",sample
    fake=verify_metadata(markup,SAMPLES[0][1].replace("20251231","20251230"),"最高法院","刑事")
    assert fake["status"]=="review" and fake["reason"]=="official_date_disagrees_with_jid"
    assert "最高法院" not in json.dumps(sample)
    print("Stage3i date, source and no-content metadata tests passed")


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--mode",choices=("selftest","live"),required=True)
    mode=p.parse_args().mode
    if mode=="selftest":
        selftest()
    else:
        try:
            result=asyncio.run(audit())
        except Exception as e:
            result={"fatal_error":type(e).__name__,"stage3_accepted":False}
        REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({key:result.get(key) for key in
            ("counts","all_ten_date_and_identity_passed","stage3_accepted","fatal_error")},
            ensure_ascii=False),flush=True)
        if result.get("fatal_error") or result.get("counts",{}).get("failed",0):
            sys.exit(1)
