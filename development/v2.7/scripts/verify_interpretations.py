#!/usr/bin/env python3
"""Validate hand-curated, official-link-only administrative interpretation metadata.

Fails closed: no unknown authorities, no fake document identifiers, no raw full text,
no assertions that old interpretations remain legally effective.
"""
import datetime
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"interpretations.json"
ALLOWED_LAWS={"少年事件處理法", "保安處分執行法"}
ID_RE=re.compile(r"moj:(FE\d+)$")

def validate(payload):
    if payload.get("schemaVersion")!=1 or payload.get("claimsOfCurrentValidity") is not False:
        raise ValueError("Index must be schema 1 and reject claims of current validity")
    if payload.get("coverage","").lower().find("not comprehensive")<0:
        raise ValueError("Index must state that coverage is non-comprehensive")
    data=payload.get("records")
    if not isinstance(data,list) or len(data)<10:
        raise ValueError("Missing/too-small index")
    seen=set()
    for d in data:
        ident=ID_RE.fullmatch(str(d.get("id","")))
        if not ident or d["id"] in seen: raise ValueError("Invalid or duplicated doc id")
        seen.add(d["id"])
        if d.get("kind")!="interpretation" or d.get("validityReview")!="unverified":
            raise ValueError("Invalid classification or ungrounded legal-validity claim")
        if d.get("originalTextIncluded") is not False:
            raise ValueError("Only metadata and written summary are allowed in pilot")
        for key in ("title","summary","issuedAt","issuingAgency","officialDocumentNo","sourceUrl"):
            if not isinstance(d.get(key),str) or not d[key].strip(): raise ValueError("Missing "+key)
        datetime.date.fromisoformat(d["issuedAt"])
        if d.get("relatedLaw") not in ALLOWED_LAWS: raise ValueError("Out-of-scope legal index")
        source=urlparse(d["sourceUrl"])
        if source.scheme!="https" or source.hostname!="mojlaw.moj.gov.tw" or source.path!="/LawContentExShow.aspx":
            raise ValueError("Non-MOJ source URL")
        query=parse_qs(source.query)
        if query.get("id")!=[ident.group(1)] or query.get("type")!=["E"]:
            raise ValueError("Source URL and recorded id do not match")
        if not re.fullmatch(r"FE\d+",str(d.get("sourceRecordId",""))):
            raise ValueError("Unrecognized sourceRecordId")
        if d["sourceRecordId"]!=ident.group(1): raise ValueError("Disagreeing identifiers")
    return {"total":len(seen),"unique":len(seen),"source":"mojlaw.moj.gov.tw"}

if __name__=="__main__":
    print(validate(json.loads(PATH.read_text(encoding="utf-8"))))
