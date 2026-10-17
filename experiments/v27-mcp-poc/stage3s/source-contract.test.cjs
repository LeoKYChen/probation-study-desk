"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("./source-contract.cjs");
const ui = require("../stage3r-demo/model.js");
const stage3q = require("../stage3q-readiness-ledger.cjs");

const law1=c.FIXTURES.TEST_LAW_SYNTHETIC_V1;
const law2=c.FIXTURES.TEST_LAW_SYNTHETIC_V2;
const full=c.FIXTURES.TEST_INTERP_SYNTHETIC_FULL;
const abr=c.FIXTURES.TEST_INTERP_SYNTHETIC_ABSTRACT;

test("source contract version is explicit and frozen", () => {
  assert.equal(c.CONTRACT_VERSION,"stage3s-source-ui-v1");
  assert.ok(Object.isFrozen(c.FIXTURES));
  assert.ok(Object.isFrozen(c.ACCEPTED_IDS));
  assert.ok(Object.isFrozen(c.FIXTURES.TEST_LAW_SYNTHETIC_V1));
});
test("only four explicit synthetic oracle IDs",()=>{
  assert.equal(c.ACCEPTED_IDS.length,4);
  assert.ok(c.ACCEPTED_IDS.every(id=>id.startsWith("TEST_")));
});
test("supported data kinds are only law and interpretation",()=>{
  assert.deepEqual(c.SOURCE_KINDS,["law","interpretation"]);
});
test("source fulltext tiers preserve the historical Stage 2 boundary",()=>{
  assert.deepEqual(c.CONTENT_TIERS,["official_full_text_verified","official_abstract_only","unavailable"]);
  assert.equal(stage3q.EVIDENCE.interpretations.counts.sourceFullText,17);
  assert.equal(stage3q.EVIDENCE.interpretations.counts.officialAbstractOnly,4);
});
test("Stage 1 acceptance remains a 20-sample historical check",()=>{
  assert.equal(stage3q.EVIDENCE.legislation.counts.sampleVerified,20);
});
test("valid synthetic law one maps to immutable proof",()=>{
  const x=c.inspectRecord(law1);
  assert.equal(x.status,"synthetic_fixture_checked");
  assert.equal(x.evidence.type,"synthetic_fixture_digest_match");
  assert.equal(x.evidence.realOfficialSourceAuthenticated,false);
  assert.equal(x.canServeProduction,false);
});
test("valid synthetic law two maps to correct version",()=>{
  const x=c.inspectRecord(law2);
  assert.equal(x.evidence.sourceVersion,"TEST_VERSION_20261001");
  assert.equal(x.currentLawVerified,false);
});
test("different versions cannot be interchanged despite same title-like data",()=>{
  const wrong={...law1,sourceVersion:law2.sourceVersion};
  assert.equal(c.inspectRecord(wrong).status,"review");
});
test("promulgation date distinct from commencement",()=>{
  const x=c.toReviewCard(law2);
  assert.equal(x.promulgatedOn,"2026-10-01");
  assert.equal(x.commencementOn,"2026-10-15");
  assert.equal(x.effectiveDateInferred,false);
});
test("missing law commencement stays missing",()=>{
  const x=c.toReviewCard(law1);
  assert.equal(x.commencementOn,null);
  assert.equal(x.effectiveScope,"unknown");
});
test("law transition clause is separate and does not prove applicability",()=>{
  const x=c.toReviewCard(law2);
  assert.match(x.transitionalRule,/過渡/);
  assert.equal(x.presentAsCurrentLaw,false);
});
test("raw mutation of law text fails digest",()=>{
  assert.equal(c.inspectRecord({...law1,text:"變更法條內容"}).reason,
    "synthetic_fixture_content_or_version_changed");
});
test("raw mutation of official promulgation fails digest",()=>{
  assert.equal(c.inspectRecord({...law1,promulgatedOn:"2026-09-02"}).status,"review");
});
test("raw mutation of effective date cannot mint accepted law",()=>{
  assert.equal(c.inspectRecord({...law1,commencementOn:"2026-09-01"}).status,"review");
});
test("fake valid-from-date in unknown effective scope denied",()=>{
  const x=c.inspectRecord({...law1,effectiveScope:"applicable"});
  assert.equal(x.reason,"effective_scope_requires_independent_proof");
});
test("undefined commencement is invalid and not inferred",()=>{
  const x=c.inspectRecord({...law1,commencementOn:undefined});
  assert.equal(x.status,"review");
});
test("bad law date rejected before cryptographic comparison",()=>{
  assert.equal(c.inspectRecord({...law1,promulgatedOn:"2026-02-30"}).reason,
    "legal_date_invalid");
});
test("malformed observation time denied",()=>{
  assert.equal(c.inspectRecord({...law1,observedAt:"2026-10-02"}).reason,
    "observation_time_invalid");
});
test("timestamp UTC Z accepted by grammar, not automatically trusted",()=>{
  const x=c.inspectRecord({...law1,observedAt:"2026-10-02T04:15:00Z"});
  assert.equal(x.reason,"synthetic_fixture_content_or_version_changed");
});
test("time without timezone never passes",()=>{
  assert.equal(c.isoTime("2026-10-02T12:15:00"),false);
});
for(const invalid of ["2026-02-30","2026-11-31","2026-13-01","2026-10-1","2026/10/01",null]){
  test("invalid legal calendar date is not canonical "+String(invalid),()=>{
    assert.equal(c.isoDate(invalid),false);
  });
}
test("leap day correctly validated",()=>{
  assert.equal(c.isoDate("2024-02-29"),true);
  assert.equal(c.isoDate("2025-02-29"),false);
});
test("invalid offset hour denied",()=>{
  assert.equal(c.isoTime("2026-10-02T12:15:00+15:00"),false);
});
test("invalid offset minute denied",()=>{
  assert.equal(c.isoTime("2026-10-02T12:15:00+08:77"),false);
});
test("only HTTPS synthetic fixture URL accepted, not a mere official-looking URL",()=>{
  const x=c.inspectRecord({...law1,sourceUrl:"https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=XYZ"});
  assert.equal(x.reason,"source_origin_or_path_untrusted");
});
test("host deception blocked",()=>{
  assert.equal(c.inspectRecord({...law1,sourceUrl:
    "https://fixtures.stage3s.invalid.evil.invalid/law/TEST_LAW_SYNTHETIC_V1"}).status,"review");
});
test("query-string injection denied",()=>{
  assert.equal(c.inspectRecord({...law1,sourceUrl:law1.sourceUrl+"?token=FAKE"}).status,"review");
});
test("redirect userinfo spoof denied",()=>{
  assert.equal(c.inspectRecord({...law1,sourceUrl:
    "https://u:p@fixtures.stage3s.invalid/law/TEST_LAW_SYNTHETIC_V1"}).status,"review");
});
test("source wrong version path blocked",()=>{
  assert.equal(c.inspectRecord({...law1,sourceUrl:law2.sourceUrl}).status,"review");
});
test("unknown actual-looking ID denied without echo",()=>{
  const x=c.inspectRecord({...full,id:"moj:FE074147"});
  assert.equal(x.status,"review");
  assert.doesNotMatch(JSON.stringify(x),/FE074147/);
});
test("prototype property never matches fixture ID",()=>{
  assert.equal(c.inspectRecord({...full,id:"constructor"}).status,"review");
});
test("null and array rejected",()=>{
  assert.equal(c.inspectRecord(null).status,"review");
  assert.equal(c.inspectRecord([]).status,"review");
});
test("unexpected record kind denied",()=>{
  assert.equal(c.inspectRecord({...law1,kind:"court"}).reason,"record_kind_mismatch");
});
test("full interpretation contains synthetic full text only",()=>{
  const x=c.toReviewCard(full);
  assert.equal(x.contentLevel,"official_full_text_verified");
  assert.match(x.sampleFullText,/人工合成/);
  assert.equal(x.originalDocumentComplete,true);
  assert.equal(x.fromRealOfficialResponse,false);
});
test("abstract-only interpretation never produces full text",()=>{
  const x=c.toReviewCard(abr);
  assert.equal(x.contentLevel,"official_abstract_only");
  assert.equal(x.sampleFullText,null);
  assert.equal(x.originalDocumentComplete,false);
  assert.match(x.sampleOfficialAbstract,/人工合成/);
});
test("abstract-only incoming fake full text is denied",()=>{
  const x=c.inspectRecord({...abr,fullText:"我自行填入公文全文"});
  assert.equal(x.reason,"abstract_only_cannot_contain_full_text");
});
test("changing abstract-only tier to fulltext denied",()=>{
  assert.equal(c.inspectRecord({...abr,contentTier:"official_full_text_verified"}).status,"review");
});
test("removing official abstract cannot become site summary",()=>{
  const x=c.inspectRecord({...abr,officialAbstract:null});
  assert.equal(x.status,"review");
});
test("fulltext body replaced by abstract denied",()=>{
  assert.equal(c.inspectRecord({...full,fullText:full.officialAbstract}).status,"review");
});
test("fake official validity field never changes computed validity",()=>{
  const x=c.toReviewCard({...full,validity:"valid_now",official:true,permission:true});
  assert.equal(x.currentValidityDetermined,false);
  assert.equal(x.legalEffect,"unverified");
  assert.equal(x.canServeProduction,false);
});
test("legal effect field cannot be set applicable",()=>{
  const x=c.inspectRecord({...full,legalEffectLabel:"active"});
  assert.equal(x.reason,"legal_effect_requires_independent_proof");
});
test("interpretation agency or issueNumber change breaks source proof",()=>{
  assert.equal(c.inspectRecord({...full,issuingAgency:"合成新機關"}).status,"review");
  assert.equal(c.inspectRecord({...full,issueNumber:"不同文號"}).status,"review");
});
test("official issue date cannot change without new comparison",()=>{
  assert.equal(c.inspectRecord({...full,issuedOn:"2024-08-08"}).status,"review");
});
test("official issue date isn't source observation date",()=>{
  const x=c.toReviewCard(full);
  assert.equal(x.issuedOn,"2024-08-07");
  assert.equal(x.observedOn,"2026-10-15");
  assert.notEqual(x.issuedOn,x.observedOn);
});
test("raw fake article URL and arbitrary extra fields are never echoed",()=>{
  const x=c.toReviewCard({...law1,unsafeUrl:"https://evil.invalid/LEAK",
    officialSourceVerified:true,summary:"TOP_SECRET"});
  const rendered=JSON.stringify(x);
  assert.doesNotMatch(rendered,/LEAK|TOP_SECRET|evil\.invalid/);
  assert.equal(x.fromRealOfficialResponse,false);
});
test("caller supplied siteSummary deliberately ignored",()=>{
  const x=c.toReviewCard(full,"FAKE_OFFICIAL_ORIGINAL");
  assert.equal(x.canPromoteSummaryToOfficialOriginal,false);
  assert.doesNotMatch(JSON.stringify(x),/FAKE_OFFICIAL_ORIGINAL/);
});
test("untrusted record cannot cross UI mapping boundary",()=>{
  assert.equal(c.toStage3rModelInput({...law1,text:"FAKE"}),null);
});
test("synthetic law is accepted by prior Stage3r model as synthetic only",()=>{
  const x=ui.lawCard(c.toStage3rModelInput(law2));
  assert.equal(x.status,"synthetic_display_only");
  assert.equal(x.fromOfficialData,false);
  assert.equal(x.currentlyEffectiveProven,false);
  assert.equal(x.productionApproved,false);
});
test("synthetic full interpretation accepted by prior UI but no real proof",()=>{
  const x=ui.interpretationCard(c.toStage3rModelInput(full));
  assert.equal(x.contentLevel,"official_full_text_verified");
  assert.equal(x.fromOfficialData,false);
  assert.equal(x.isCurrentValidityVerified,false);
  assert.equal(x.productionApproved,false);
});
test("synthetic abstract-only flows to prior UI without accidental fulltext",()=>{
  const x=ui.interpretationCard(c.toStage3rModelInput(abr));
  assert.equal(x.contentLevel,"official_abstract_only");
  assert.equal(x.officialTextPreview,abr.officialAbstract);
  assert.equal(x.canClaimOriginalFullText,false);
});
test("prior UI not fed live-source identifiers",()=>{
  for(const id of c.ACCEPTED_IDS) {
    const x=c.toStage3rModelInput(c.FIXTURES[id]);
    assert.equal(x.id.startsWith("TEST_"),true);
  }
});
test("expired historical snapshot is not refreshed by checking present date",()=>{
  const x=c.toReviewCard({...law1,now:"2026-10-17"});
  assert.equal(x.officialVersionCheckedToday,false);
  assert.equal(x.currentLawVerified,false);
});
test("no source proof from untrusted get-provenance flags",()=>{
  const x=c.inspectRecord({...law1,
    officialSignatureVerified:true,authorizedToRepublish:true,
    currentVersion:true,evidence:{signature:"FAKE"}});
  assert.equal(x.authorizedOfficialSource,false);
  assert.equal(x.canServeProduction,false);
});
test("record version text and dates digest uses all source-facing fields",()=>{
  for(const name of ["sourceVersion","observedAt","text","commencementRule"]) {
    const changed={...law1,[name]:"TAMPERED"};
    assert.notEqual(c.fingerprint(changed),c.DIGESTS[law1.id],name);
  }
});
test("source fixture is read-only and cannot be altered from outside",()=>{
  const digest=c.fingerprint(law1);
  try {law1.text="BROKEN"} catch{}
  assert.equal(c.fingerprint(law1),digest);
});
test("record never approves production even when all fixture assertions match",()=>{
  for(const id of c.ACCEPTED_IDS) {
    const x=c.inspectRecord(c.FIXTURES[id]);
    assert.equal(x.canServeProduction,false);
    assert.equal(x.authorizedOfficialSource,false);
    assert.equal(x.stage3Accepted,false);
  }
});
test("all accepted synthetic fixture digests are 64 hex characters",()=>{
  for(const val of Object.values(c.DIGESTS)) assert.match(val,/^[0-9a-f]{64}$/);
});
test("summary reports genuine official field mapping not performed",()=>{
  const s=c.schemaReview();
  assert.equal(s.realOfficialFieldNamesEndToEndMapped,false);
  assert.equal(s.realOfficialRetrievalValidated,false);
  assert.equal(s.releasesAuthorized,false);
  assert.equal(s.stage3Accepted,false);
});
test("Stage 3q still blocks releases regardless of synthetic source mapping",()=>{
  const s=stage3q.planReview({features:["law_lookup","interpretation_lookup"],
    approvals:{stage3sValidated:true,allSourceMetadata:true}});
  assert.equal(s.canDeploy,false);
  assert.equal(s.canMerge,false);
  assert.equal(s.stage3Accepted,false);
});
test("no case PDFs or real source content exposed by schema summary",()=>{
  const summary=JSON.stringify(c.schemaReview());
  assert.doesNotMatch(summary,/moj:FE|TPSM,114|JDoc|data.aspx/);
  assert.equal(c.schemaReview().actualPdfDownloads,0);
});
test("fixtures never masquerade as real official source URL",()=>{
  for(const row of Object.values(c.FIXTURES)) {
    assert.ok(row.sourceUrl.startsWith("https://fixtures.stage3s.invalid/"));
    assert.ok(row.id.startsWith("TEST_"));
  }
});
