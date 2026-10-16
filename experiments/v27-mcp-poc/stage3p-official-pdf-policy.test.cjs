"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  OFFICIAL_API_DOCUMENTATION, OFFICIAL_USAGE_NORMS, COURT_SITE_HELP,
  OFFICIAL_PORTAL, SOURCE_CATEGORIES, REPLICA_TARGETS, READINESS_CHECKS,
  classifyPdfSource, assessPilotReadiness, simulateLifecycle
} = require("./stage3p-official-pdf-policy.cjs");

const FULL = "https://data.judicial.gov.tw/jdg/api/JDocFile/TPHM/SYNTHETIC_ONLY.pdf";
const ATTACHMENT = "https://data.judicial.gov.tw/jdg/api/JAttFile/TPHM/SYNTHETIC_ATTACHMENT.pdf";
const LEGACY_ATTACHMENT = "https://data.judicial.gov.tw/jdg/api/JFile/TPHM/SYNTHETIC_ATTACHMENT.pdf";
const SOURCE = Object.freeze({kind:"jdoc_primary_file",jfulltype:"file",jfullpdf:FULL});
const OPEN_TIME = new Date("2026-10-16T18:30:00Z"); // Taipei 2026-10-17 02:30
const CLOSED_TIME = new Date("2026-10-16T11:00:00Z"); // Taipei 19:00
const FULL_ASSERTIONS = Object.freeze(Object.fromEntries(READINESS_CHECKS.map(k => [k,true])));
const ALL_ACK = Object.freeze(Object.fromEntries(REPLICA_TARGETS.map(k => [k,true])));

test("official API spec and usage norms use permanent official hosts",()=>{
  assert.match(OFFICIAL_API_DOCUMENTATION,/^https:\/\/opendata\.judicial\.gov\.tw\/api\/Newses\/42\/file$/);
  assert.match(OFFICIAL_USAGE_NORMS,/^https:\/\/www\.judicial\.gov\.tw\//);
  assert.match(COURT_SITE_HELP,/^https:\/\/judgment\.judicial\.gov\.tw\/readme\.aspx$/);
  assert.equal(OFFICIAL_PORTAL,"https://judgment.judicial.gov.tw/FJUD/");
});
test("source categories are fixed and immutable",()=>{
  assert.ok(Object.isFrozen(SOURCE_CATEGORIES));
  assert.equal(SOURCE_CATEGORIES.length,5);
});
test("JDoc file endpoint URL recognized solely as documented shape",()=>{
  const r=classifyPdfSource(SOURCE);
  assert.equal(r.classification,"documented_primary_pdf_url_shape");
  assert.equal(r.matchesDocumentedOfficialEndpointShape,true);
  assert.equal(r.actualOfficialResponseIndependentlyVerified,false);
  assert.equal(r.permissionToDownloadRealPdf,false);
  assert.equal(r.publicIndividualCaseUrlAllowed,false);
});
test("JDoc JFULLTYPE=text cannot declare a PDF",()=>{
  const r=classifyPdfSource({...SOURCE,jfulltype:"text"});
  assert.equal(r.classification,"blocked");
  assert.equal(r.reason,"jfulltype_not_file");
});
test("undefined JFULLTYPE cannot declare PDF",()=>{
  assert.equal(classifyPdfSource({kind:"jdoc_primary_file",jfullpdf:FULL}).classification,"blocked");
});
test("ATTACHMENTS is NOT the full judgment PDF",()=>{
  const r=classifyPdfSource({kind:"jdoc_attachment",attachmentUrl:ATTACHMENT});
  assert.equal(r.classification,"attachment_only");
  assert.equal(r.realPdfFullTextVerified,false);
  assert.equal(r.permissionToDownloadRealPdf,false);
});
test("legacy JFile attachment shape is still attachment not JFULLPDF",()=>{
  assert.equal(classifyPdfSource({kind:"jdoc_attachment",attachmentUrl:LEGACY_ATTACHMENT}).classification,
    "attachment_only");
});
test("passing JDocFile URL as an attachment is rejected",()=>{
  assert.equal(classifyPdfSource({kind:"jdoc_attachment",attachmentUrl:FULL}).classification,"blocked");
});
test("passing attachment URL as main JDoc PDF is rejected",()=>{
  assert.equal(classifyPdfSource({...SOURCE,jfullpdf:ATTACHMENT}).classification,"blocked");
});
test("website's generated PDF export cannot be independent full-text reference",()=>{
  const r=classifyPdfSource({kind:"website_export_pdf",url:"https://judgment.judicial.gov.tw/FJUD/printData.aspx"});
  assert.equal(r.classification,"generated_export_not_independent");
  assert.equal(r.actualOfficialResponseIndependentlyVerified,false);
});
test("unattributed direct PDF link cannot be treated as official JDoc file",()=>{
  const r=classifyPdfSource({kind:"unattributed_pdf",url:FULL});
  assert.equal(r.classification,"source_not_established");
});
test("JDoc text case is not a PDF even if linked to one",()=>{
  assert.equal(classifyPdfSource({kind:"jdoc_text",jfulltype:"text",jfullpdf:FULL}).classification,
    "text_is_not_pdf");
});
test("JDoc unsupported kind always blocked",()=>{
  assert.equal(classifyPdfSource({kind:"invented_kind",jfullpdf:FULL}).classification,"blocked");
});
test("string and null source are blocked",()=>{
  assert.equal(classifyPdfSource(null).classification,"blocked");
  assert.equal(classifyPdfSource("file").classification,"blocked");
});
test("array masquerading as a source is blocked",()=>{
  assert.equal(classifyPdfSource([SOURCE]).classification,"blocked");
});
test("source decision is immutable",()=>{
  assert.equal(Object.isFrozen(classifyPdfSource(SOURCE)),true);
});
test("documented URL shape can contain encoded commas from official API examples",()=>{
  const url="https://data.judicial.gov.tw/jdg/api/JDocFile/TPHM/110%2cSYNTHETIC%2c1.pdf";
  assert.equal(classifyPdfSource({...SOURCE,jfullpdf:url}).matchesDocumentedOfficialEndpointShape,true);
});
test("fake judicial username or password in URL rejected",()=>{
  assert.equal(classifyPdfSource({...SOURCE,
    jfullpdf:"https://user:secret@data.judicial.gov.tw/jdg/api/JDocFile/S.pdf"}).classification,"blocked");
});

const FAKE_URLS=[
 "http://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf",
 "https://data.judicial.gov.tw.evil.invalid/jdg/api/JDocFile/S.pdf",
 "https://evil.invalid/jdg/api/JDocFile/S.pdf",
 "https://data.judicial.gov.tw:8443/jdg/api/JDocFile/S.pdf",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf?token=secret",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf#fragment",
 "https://data.judicial.gov.tw/jdg/api/JAttFile/S.pdf",
 "https://data.judicial.gov.tw/jdg/api/JFile/S.pdf",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.txt",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf%2fother.pdf",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/%2e%2e/S.pdf",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf\nmalformed",
 "https://data.judicial.gov.tw/jdg/api/JDocFile/S.pdf\\m",
 "javascript:alert(1)",
 "data:application/pdf;base64,AAE=",
 "https://judgment.judicial.gov.tw/FJUD/printData.aspx?id=TEST",
];
for(const [i,url] of FAKE_URLS.entries()){
  test("host,path,token and injected-URL safety case "+(i+1),()=>{
    const r=classifyPdfSource({...SOURCE,jfullpdf:url});
    assert.equal(r.classification,"blocked");
    assert.equal(r.permissionToDownloadRealPdf,false);
    assert.equal(r.publicIndividualCaseUrlAllowed,false);
  });
}

test("full checklist but no independent trust has only paper readiness",()=>{
  const r=assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"paper_requirements_only_real_evidence_still_required");
  assert.equal(r.missingAssertions.length,0);
  assert.equal(r.checkCount,13);
  assert.equal(r.actualAuthorizationAuthenticated,false);
  assert.equal(r.permissionToCallRealApi,false);
  assert.equal(r.permissionToFetchPdf,false);
  assert.equal(r.stage3Accepted,false);
});
test("no source input fail closed",()=>{
  const r=assessPilotReadiness({planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"source_blocked");
});
test("direct site export never becomes intake-ready even if every box checked",()=>{
  const r=assessPilotReadiness({source:{kind:"website_export_pdf"},planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"source_blocked");
});
test("an attachment cannot become intake-ready if every box is true",()=>{
  const r=assessPilotReadiness({source:{kind:"jdoc_attachment",attachmentUrl:ATTACHMENT},
    planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"source_blocked");
});
test("outside Taipei 0-6 hours rejects even a fully ticked paper file",()=>{
  const r=assessPilotReadiness({source:SOURCE,planningDate:CLOSED_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"outside_api_service_window");
  assert.equal(r.officialApiWindowTaipei00To06,false);
  assert.equal(r.permissionToFetchPdf,false);
});
test("missing planning clock never implies service is running",()=>{
  const r=assessPilotReadiness({source:SOURCE,assertions:FULL_ASSERTIONS});
  assert.equal(r.status,"outside_api_service_window");
});
test("missing all proof assertions rejects, not auto-demonstrated",()=>{
  const r=assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME});
  assert.equal(r.status,"requirements_not_documented");
  assert.equal(r.missingAssertions.length,READINESS_CHECKS.length);
});
for (const key of READINESS_CHECKS) {
  test("paper-checklist missing "+key+" blocks readiness",()=>{
    const o={...FULL_ASSERTIONS,[key]:false};
    const r=assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,assertions:o});
    assert.equal(r.status,"requirements_not_documented");
    assert.ok(r.missingAssertions.includes(key));
    assert.equal(r.permissionToCallRealApi,false);
  });
}
test("unverified strings \"true\" don't count as independent evidence",()=>{
  const o={...FULL_ASSERTIONS,registered_membership:"true"};
  assert.ok(assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,
    assertions:o}).missingAssertions.includes("registered_membership"));
});
test("untrusted assertions are never marked evidence-authenticated",()=>{
  const r=assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.ok(r.requirements.every(x=>x.authenticatedEvidenceProvided===false));
  assert.ok(Object.isFrozen(r.requirements));
});
test("paper gate never authorizes production merge or real PDF uploads",()=>{
  const r=assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,assertions:FULL_ASSERTIONS});
  assert.equal(r.allowMergeOrDeployment,false);
  assert.equal(r.permitUserProvidedFileUpload,false);
  assert.equal(r.permitPublicIndividualLink,false);
  assert.equal(r.permissionToStorePdf,false);
});
test("paper outputs must not echo credentials, JIDs or PDF URLs",()=>{
  const s=JSON.stringify(assessPilotReadiness({source:SOURCE,planningDate:OPEN_TIME,
    assertions:FULL_ASSERTIONS}));
  assert.doesNotMatch(s,/SYNTHETIC_ONLY\.pdf|token=|password=|JID|JFULLPDF/);
});
test("purge inventory includes primary, cache, index, CDN, derivations, exports, backup and logs",()=>{
  assert.deepEqual(REPLICA_TARGETS,[
    "primary","cache","search_index","cdn","derived_text","exports","backups","logs"
  ]);
});
test("official withdrawal with no acknowledgments begins purge-pending",()=>{
  const r=simulateLifecycle({event:"withdrawn"});
  assert.equal(r.status,"synthetic_purge_pending");
  assert.equal(r.targetsPending.length,REPLICA_TARGETS.length);
  assert.equal(r.suppressCase,true);
  assert.equal(r.actualPurgeProven,false);
});
test("withdrawal with all simulated deletion acknowledgments stays synthetic",()=>{
  const r=simulateLifecycle({event:"withdrawn",acknowledgments:ALL_ACK});
  assert.equal(r.status,"synthetic_purge_complete");
  assert.equal(r.realOldContentDeleted,false);
  assert.equal(r.caseCanBeServedAgain,false);
  assert.equal(r.actualPurgeProven,false);
});
for(const target of REPLICA_TARGETS){
  test("withdrawal cannot be counted as complete while "+target+" copy remains",()=>{
    const ack={...ALL_ACK,[target]:false};
    const r=simulateLifecycle({event:"withdrawn",acknowledgments:ack});
    assert.equal(r.status,"synthetic_purge_pending");
    assert.ok(r.targetsPending.includes(target));
    assert.equal(r.suppressCase,true);
  });
}
test("same-JID update requires replacing old version",()=>{
  const r=simulateLifecycle({event:"same_jid_updated"});
  assert.equal(r.status,"synthetic_update_pending");
  assert.equal(r.replacementMustBeIndependentlyChecked,true);
  assert.equal(r.caseCanBeServedAgain,false);
});
test("update requires independent new revision, even after all copies invalidated",()=>{
  const r=simulateLifecycle({event:"same_jid_updated",acknowledgments:ALL_ACK});
  assert.equal(r.status,"synthetic_update_pending");
  assert.equal(r.replacementIndependentlyProven,false);
});
test("pretend update and all acknowledgments never authorize new case link",()=>{
  const r=simulateLifecycle({event:"same_jid_updated",acknowledgments:ALL_ACK,
    verifiedReplacement:true});
  assert.equal(r.status,"synthetic_update_invalidation_complete");
  assert.equal(r.caseCanBeServedAgain,false);
  assert.equal(r.realOldContentDeleted,false);
});
for(const event of ["http403","http404","timeout","no_new_signal"]){
  test(event+" is NOT sufficient evidence of formal court withdrawal",()=>{
    const r=simulateLifecycle({event});
    assert.equal(r.status,"publication_status_unknown");
    assert.equal(r.withdrawnOfficiallyProven,false);
    assert.equal(r.suppressCase,true);
    assert.equal(r.actualPurgeProven,false);
  });
}
test("unknown fake event is fail closed",()=>{
  const r=simulateLifecycle({event:"unwithdraw_case"});
  assert.equal(r.status,"blocked_invalid_event");
  assert.equal(r.suppressCase,true);
});
test("lifecycle never reveals actual storage deletion as performed",()=>{
  const x=simulateLifecycle({event:"withdrawn",acknowledgments:ALL_ACK});
  assert.equal(x.syntheticAcknowledgmentsOnly,true);
  assert.equal(x.stage3Accepted,false);
});
test("every lifecycle event denies real case serving",()=>{
  for(const event of ["withdrawn","same_jid_updated","http403","http404","timeout","no_new_signal"]){
    const outcome=simulateLifecycle({event,acknowledgments:ALL_ACK,verifiedReplacement:true});
    assert.equal(outcome.suppressCase,true);
    assert.equal(outcome.stage3Accepted,false);
  }
});
