#!/usr/bin/env python3
"""Stage 3k: bounded, official-only audit of appellate HISTORY LINK availability.

Seven already vetted parent judgments and up to 14 distinct child pages.
No repeated MCP text checks; no unrelated search; no PDF; no juvenile/family
case requests; no login; no pagination or retries; no WAF circumvention.
Save aggregate decisions and parent labels ONLY, never child JIDs or court text.
A readable linked document does not prove appeal finality or exhaustive history.
"""
import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlencode, parse_qs

import httpx
from bs4 import BeautifulSoup

from stage3h_diff_diagnostics import strict_source, norm, official_sections
from stage3i_ten_official_dates import roc_date
from stage3j_history_lists import (
    HISTORY_BASE, history_key, official_rows, bounded_get, is_official
)

OUTPUT = Path("v27-mcp-stage3k-linked-history-sample.json")
# The only seven parents that had nonempty independently checked official
# history lists in Stage3j. Three parents with zero entries are not retested.
PARENTS = (
    ("J01", "TPSM,114,台抗,2605,20251231,1", 2),
    ("J03", "TPSM,114,台抗,2657,20251231,1", 2),
    ("H-CIV-1", "TPHV,114,上易,1030,20251231,2", 4),
    ("H-CIV-2", "TPHV,114,再易,110,20251231,1", 9),
    ("H-CRM-1", "TCHM,114,上易,801,20251231,2", 3),
    ("H-CRM-2", "TCHM,114,金上訴,2749,20251231,2", 4),
    ("D-CRM-1", "TCDM,114,金訴,2374,20251231,2", 3),
)
EXPECTED_HISTORY_ITEMS = 27
MAX_PARENTS = 7
MAX_PARENT_GET = 7
MAX_HISTORY_GET = 7
MAX_LINK_GET = 14
LINKS_PER_PARENT = 2
MAX_HTML_BYTES = 800_000
MAX_HISTORY_BYTES = 150_000
JID_RE = re.compile(r"^[A-Z]{3,5},\d{2,3},[^,]{1,20},[^,]{1,20},\d{8},\d+$")
ALLOWED_COURT_CODES = {
    "TPSM": "最高法院",
    "TPSV": "最高法院",
    "TPHV": "臺灣高等法院",
    "TPDV": "臺灣臺北地方法院",
    "TCHM": "臺灣高等法院臺中分院",
    "TCHV": "臺灣高等法院臺中分院",
    "TCDM": "臺灣臺中地方法院",
    "TCDV": "臺灣臺中地方法院",
}
PRIVATE_CASE_WORDS = ("少", "家", "親", "監護", "扶養", "兒", "童", "收養")
PRIVATE_COURT_PREFIXES = ("KSY", "TPY", "TCY", "TNY", "TYJ")
KNOWN_ORIGINALS = {
    "TPSM,114,台抗,2605,20251231,1",
    "TPSM,114,台抗,2657,20251231,1",
    "TPHV,114,上易,1030,20251231,2",
    "TPHV,114,再易,110,20251231,1",
    "TPDV,114,司票,26166,20251231,2",
    "TPDV,114,重訴,238,20251231,1",
    "TCHM,114,上易,801,20251231,2",
    "TCHM,114,金上訴,2749,20251231,2",
    "TCDM,114,金訴,2374,20251231,2",
    "TCDM,114,聲,4461,20251231,1",
}

def classify_link(link):
    """Return a safe JID only, never trust/link to arbitrary JSON URL."""
    if not isinstance(link, dict) or not link.get("has_link"):
        return None, "listed_without_public_document_url"
    jid = link.get("jid")
    u = link.get("url")
    if not isinstance(jid,str) or not JID_RE.fullmatch(jid):
        return None, "unrecognized_linked_case_identifier"
    parts = jid.split(",")
    if (parts[0] not in ALLOWED_COURT_CODES or
        parts[0].startswith(PRIVATE_COURT_PREFIXES)):
        return None, "court_code_outside_approved_sample"
    if any(s in parts[2] for s in PRIVATE_CASE_WORDS):
        return None, "juvenile_family_or_sensitive_case_word"
    if not (95 <= int(parts[1]) <= 115):
        return None, "year_outside_bounded_review"
    if not is_official(u):
        return None, "history_item_origin_untrusted"
    parsed=urlparse(u)
    q=parse_qs(parsed.query)
    if (parsed.path.lower() not in
        ("/fjud/data.aspx", "/fjud/printdata.aspx") or
        q.get("id") != [jid] or
        set(q) not in ({"ty","id"}, {"id"}) or
        ("ty" in q and q["ty"] != ["JD"])):
        return None, "history_item_url_or_identifier_mismatch"
    return jid, "eligible_official_public_link_candidate"

def read_history_metadata(raw):
    try:
        data=json.loads(raw.decode("utf-8-sig"))
    except (UnicodeError,ValueError):
        return None,"invalid_official_history_json"
    return official_rows(data)

def history_source_url_ok(url,key):
    p=urlparse(url)
    q=parse_qs(p.query)
    from urllib.parse import unquote
    return bool(is_official(url) and
                p.path == "/controls/GetJudHistory.ashx" and
                q.get("jid") == [unquote(key)] and
                set(q)=={"jid"})

def source_identity(html,jid):
    """Check court, JID case number/year, date and substantive content.
    Returns flags only; no source text leaves this function.
    """
    parts=jid.split(",")
    court=ALLOWED_COURT_CODES.get(parts[0])
    data={"status":"review","official_body_substantial":False,
          "identity_matches":False,"date_matches":False,
          "official_document_accessible":False}
    if not court:
        data["reason"]="unknown_court_code"
        return data
    sections,why=official_sections(html)
    if sections is None:
        data["reason"]=why
        return data
    text=norm(sections["body"]).replace("臺","台")
    full=norm(sections["root"]).replace("臺","台")
    court_label=norm(court).replace("臺","台")
    substantial=(len(text)>=200 and
                 ("主文" in text or "理由" in text or "裁定" in text))
    data["official_body_substantial"]=substantial
    # Court spelling and year/word/number must match the actual fetched
    # *linked* JID, not the parent record from the history endpoint.
    title=str(parts[1]) in text and norm(parts[2]).replace("臺","台") in text
    title=title and str(parts[3]) in text and court_label in text
    data["identity_matches"]=title
    # Metadata row is independent of JID and body. Never silently accept
    # JID's own date as the official court metadata.
    document=BeautifulSoup(html,"lxml").select_one("#jud")
    found_date=None
    for row in document.select(".row") if document is not None else ():
        label=row.select_one(".col-th")
        value=row.select_one(".col-td")
        if label is not None and value is not None and "裁判日期" in norm(label.get_text()):
            found_date=roc_date(value.get_text(" ",strip=True))
            break
    data["date_matches"]=bool(found_date and found_date==parts[4])
    if not substantial:
        data["reason"]="linked_official_body_missing_or_truncated"
    elif not title:
        data["reason"]="linked_court_or_case_identity_mismatch"
    elif not data["date_matches"]:
        data["reason"]="linked_court_date_missing_or_different"
    else:
        data.update(status="passed",reason="linked_official_case_identity_date_and_body_confirmed",
                    official_document_accessible=True)
    # Important: neither a passed child link nor a parent list proves
    # present-day finality, subsequent withdrawal state or complete appeal chain.
    return data

def choose_candidates(official_items,seen):
    eligible=[]
    counters={"non_linked":0,"sensitive_or_unapproved":0,
              "duplicate_or_previously_checked":0,"eligible":0}
    for item in official_items:
        jid,reason=classify_link(item)
        if not jid:
            if reason=="listed_without_public_document_url":
                counters["non_linked"]+=1
            else:
                counters["sensitive_or_unapproved"]+=1
            continue
        if jid in seen or jid in KNOWN_ORIGINALS:
            counters["duplicate_or_previously_checked"]+=1
            continue
        eligible.append(jid)
    counters["eligible"]=len(eligible)
    # Diverse positions among the parent's listed links, without broad crawling.
    # The selected JIDs stay in process memory and are NOT serialized.
    selected=[]
    if eligible:
        selected.append(eligible[0])
    if len(eligible)>1:
        selected.append(eligible[-1])
    return selected,counters

async def audit():
    report={
        "stage":"v2.7 stage3k bounded linked history availability",
        "utc":datetime.now(timezone.utc).isoformat(),
        "base": "stage3j 7 nonempty public official histories, 27 entries",
        "expected_history_item_count":EXPECTED_HISTORY_ITEMS,
        "maximum_parent_get":MAX_PARENT_GET,
        "maximum_history_get":MAX_HISTORY_GET,
        "maximum_linked_get":MAX_LINK_GET,
        "actual_parent_get":0,
        "actual_history_get":0,
        "actual_linked_get":0,
        "parent_groups":[],
        "no_mcp_fulltext_calls":True,"no_linked_court_text_saved":True,
        "no_new_related_jid_saved":True,"no_juvenile_or_family_court_case_requested":True,
        "authenticated_api_used":False,
        "linked_source_sampling_accepted":False,
        "all_27_links_verified":False,
        "finality_or_exhaustiveness_accepted":False,
        "realtime_publication_verified":False,
        "stage3_accepted":False,
    }
    seen=set()
    total_listed=0
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(25,connect=9),follow_redirects=False,
        headers={"User-Agent":"v27-limited-history-linked-check/1",
                 "Accept-Encoding":"identity","Cache-Control":"no-store"}
    ) as client:
        for name,parent_jid,baseline in PARENTS:
            group={
                "id":name,"prior_official_history_count":baseline,
                "official_history_read":False,
                "official_history_count":None,
                "history_count_unchanged":None,
                "sample_attempts":0,"sample_passed":0,
                "sample_review":0,"sample_items":[],
                "all_links_verified":False,
                "finality_verified":False,
            }
            report["actual_parent_get"]+=1
            parent_url=("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
                        +urlencode({"ty":"JD","id":parent_jid}))
            html,why=await bounded_get(client,parent_url,MAX_HTML_BYTES,
                lambda u:strict_source(u,parent_jid))
            if html is None:
                group["reason"]="parent_"+why
                report["parent_groups"].append(group)
                continue
            key=history_key(html)
            if key is None:
                group["reason"]="official_history_key_missing"
                report["parent_groups"].append(group)
                continue
            report["actual_history_get"]+=1
            history_url=HISTORY_BASE+key
            raw,why=await bounded_get(client,history_url,MAX_HISTORY_BYTES,
                lambda u:history_source_url_ok(u,key))
            if raw is None:
                group["reason"]="history_"+why
                report["parent_groups"].append(group)
                continue
            rows,why=read_history_metadata(raw)
            if rows is None:
                group["reason"]=why
                report["parent_groups"].append(group)
                continue
            group["official_history_read"]=True
            group["official_history_count"]=len(rows)
            group["history_count_unchanged"]=len(rows)==baseline
            total_listed+=len(rows)
            selected,counters=choose_candidates(rows,seen)
            group["candidate_classifications"]=counters
            # At most 2 attempts per parent, no retries, no search expansion.
            for jid in selected[:LINKS_PER_PARENT]:
                if report["actual_linked_get"]>=MAX_LINK_GET:
                    break
                seen.add(jid)
                group["sample_attempts"]+=1
                report["actual_linked_get"]+=1
                url=("https://judgment.judicial.gov.tw/FJUD/data.aspx?"
                     +urlencode({"ty":"JD","id":jid}))
                content,reason=await bounded_get(client,url,MAX_HTML_BYTES,
                    lambda u:strict_source(u,jid))
                if content is None:
                    result={"status":"review","reason":reason}
                else:
                    result=source_identity(content,jid)
                result["existing_prior_text_validation_reused"]=False
                result["related_jid_recorded"]=False
                group["sample_items"].append(result)
                if result["status"]=="passed":
                    group["sample_passed"]+=1
                else:
                    group["sample_review"]+=1
                print(name,"linked sample",result["status"],result["reason"],flush=True)
                await asyncio.sleep(1)
            report["parent_groups"].append(group)
            print(name,"history",len(rows),"baseline",baseline,
                  "eligible",counters["eligible"],
                  "tested",group["sample_attempts"],
                  "passed",group["sample_passed"],flush=True)
            await asyncio.sleep(1)
    report["official_history_items_retrieved"]=total_listed
    report["parent_history_sources_read"]=sum(g["official_history_read"]
                                               for g in report["parent_groups"])
    report["parent_count_unchanged"]=sum(g["history_count_unchanged"] is True
                                         for g in report["parent_groups"])
    report["linked_sample_passed"]=sum(g["sample_passed"] for g in report["parent_groups"])
    report["linked_sample_review"]=sum(g["sample_review"] for g in report["parent_groups"])
    report["linked_source_sampling_accepted"]=(
        report["parent_history_sources_read"]==len(PARENTS)
        and report["actual_linked_get"]>0
        and report["linked_sample_review"]==0
        and report["linked_sample_passed"]==report["actual_linked_get"]
    )
    report["all_27_links_verified"]=False
    report["finality_or_exhaustiveness_accepted"]=False
    report["stage3_accepted"]=False
    return report

def selftest():
    assert len(PARENTS)==MAX_PARENTS==7
    assert sum(x[2] for x in PARENTS)==27
    assert len(KNOWN_ORIGINALS)==10
    assert MAX_LINK_GET==2*MAX_PARENTS
    safe="TPHV,114,上易,123,20251231,1"
    x={"has_link":True,"jid":safe,
       "url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?"
             +urlencode({"ty":"JD","id":safe})}
    assert classify_link(x)==(safe,"eligible_official_public_link_candidate")
    assert classify_link({"has_link":False,"jid":"","url":""})[1]=="listed_without_public_document_url"
    assert classify_link({**x,"jid":"KSYM,114,少護,1,20251231,1"})[0] is None
    assert classify_link({**x,"jid":"TPDV,114,少訴,1,20251231,1"})[0] is None
    assert classify_link({**x,"jid":"TPHV,114,家上,1,20251231,1"})[0] is None
    assert classify_link({**x,"url":"https://judgment.judicial.gov.tw.evil.test/FJUD/data.aspx"})[0] is None
    assert classify_link({**x,"url":x["url"]+"&next=https://evil.test"})[0] is None
    selected,counters=choose_candidates([x,x,{"has_link":False,"jid":"","url":""}],set())
    assert len(selected)==2 and counters["non_linked"]==1
    selected,counters=choose_candidates([x],{safe})
    assert not selected and counters["duplicate_or_previously_checked"]==1
    assert history_source_url_ok(HISTORY_BASE+"ABC%2CDEF","ABC%2CDEF")
    assert not history_source_url_ok("https://evil.test/controls/GetJudHistory.ashx?jid=ABC","ABC")
    # Synthetic HTML with a deliberately mismatching displayed official date.
    ji="TPHV,114,上易,123,20251231,1"
    html=('<div id="jud"><div class="row"><div class="col-th">裁判日期</div>'
          '<div class="col-td">民國114年12月30日</div></div>'
          '<div class="htmlcontent">臺灣高等法院民事裁定114年度上易字第123號'
          '主文理由'+'合成'*350+'</div></div>').encode("utf-8")
    result=source_identity(html,ji)
    assert result["status"]=="review" and result["reason"]=="linked_court_date_missing_or_different"
    html=html.replace("12月30日".encode(),"12月31日".encode())
    result=source_identity(html,ji)
    assert result["status"]=="passed" and result["official_document_accessible"]
    assert "合成" not in json.dumps(result,ensure_ascii=False)
    print("Stage3k limited official linked-history, privacy and date selftests passed",flush=True)

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--mode",choices=("selftest","live"),required=True)
    mode=ap.parse_args().mode
    if mode=="selftest":
        selftest()
    else:
        try:
            output=asyncio.run(audit())
        except Exception as exc:
            output={"fatal_error":type(exc).__name__,
                    "stage3_accepted":False,"linked_source_sampling_accepted":False}
        OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({key:output.get(key) for key in
            ("parent_history_sources_read","official_history_items_retrieved",
             "actual_linked_get","linked_sample_passed","linked_sample_review",
             "linked_source_sampling_accepted","all_27_links_verified",
             "finality_or_exhaustiveness_accepted","stage3_accepted","fatal_error")},
            ensure_ascii=False),flush=True)
        if output.get("fatal_error"):
            raise SystemExit(1)
