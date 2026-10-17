"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  EVIDENCE, FEATURE_MAP, PUBLIC_COURT_FEATURES,
  REVIEWED_AT, UPSTREAM_COMMIT, OFFICIAL_PORTAL,
  featureStatus, planReview, publicCourtPresentation, summary
}=require("./stage3q-readiness-ledger.cjs");

test("version records test date and exact frozen MCP upstream",()=>{
  assert.equal(REVIEWED_AT,"2026-10-16");
  assert.equal(UPSTREAM_COMMIT,"ef677ad63c3206fc211a083fad8b1d9ef5015222");
});
test("all evidence objects and inner arrays immutable",()=>{
  assert.ok(Object.isFrozen(EVIDENCE));
  assert.ok(Object.isFrozen(EVIDENCE.legislation));
  assert.ok(Object.isFrozen(EVIDENCE.legislation.limits));
  assert.ok(Object.isFrozen(FEATURE_MAP));
});
test("law source evidence is 20/20 selected checks, not universal current-law proof",()=>{
  const x=EVIDENCE.legislation;
  assert.deepEqual(x.counts,{sampleVerified:20,sampleTarget:20});
  assert.equal(x.status,"sample_verified");
  assert.ok(x.limits.some(v=>v.includes("施行日")));
  assert.ok(x.limits.some(v=>v.includes("過期")));
});
test("law report is anchored to documented successful run IDs",()=>{
  assert.equal(EVIDENCE.legislation.report,"STAGE1_ACCEPTANCE.md");
  assert.deepEqual(EVIDENCE.legislation.actionRuns,[38705512707,38706127912]);
});
test("interpretations are 17 official full, 4 abstract, 21 metadata",()=>{
  assert.deepEqual(EVIDENCE.interpretations.counts,
    {metadata:21,sourceFullText:17,officialAbstractOnly:4});
});
test("interpretation B limited acceptance not converted to full acceptance",()=>{
  assert.equal(EVIDENCE.interpretations.status,"scope_limited_verified");
  assert.ok(EVIDENCE.interpretations.limits.some(x=>x.includes("現行法律效力")));
  assert.ok(EVIDENCE.interpretations.limits.some(x=>x.includes("官方原始要旨")));
});
test("constitutional interpretation 803 is limited to three out of four fragments",()=>{
  assert.ok(EVIDENCE.constitutional.limits.some(x=>x.includes("3/4")));
  assert.equal(EVIDENCE.constitutional.status,"selected_parts_only");
});
test("two statutory histories do not expand into global legislative database",()=>{
  assert.deepEqual(EVIDENCE.legislative_history.counts,
    {selectedProvisions:2,checkedVersions:3});
});
test("initial 10, cross-year 5 and long 2 remain separate sampled checks",()=>{
  assert.deepEqual(EVIDENCE.court_html.counts,
    {initialVerified:10,crossYearVerified:5,longFormVerified:2});
});
test("history list fidelity is not complete appellate hierarchy",()=>{
  const x=EVIDENCE.court_history;
  assert.deepEqual(x.counts,{parentLists:10,linkedEntriesListed:27,relatedCasesChecked:7});
  assert.ok(x.limits.some(t=>t.includes("不表示裁判確定")));
});
test("real PDF sample count always zero regardless of synthetic pass",()=>{
  assert.deepEqual(EVIDENCE.court_pdf.counts,
    {syntheticPdfChecks:84,realOfficialPdfFulltextsVerified:0});
});
test("real revocation and click-time publication checks always zero",()=>{
  assert.deepEqual(EVIDENCE.court_publication.counts,
    {realClickTimePublicationChecks:0,realPurgeDemonstrations:0});
});
test("case finality not verified by history list result",()=>{
  assert.equal(EVIDENCE.case_finality.status,"not_verified");
  assert.equal(EVIDENCE.case_finality.counts.completeFinalityVerifications,0);
});
test("every sourced feature has an existing evidence category",()=>{
  for(const [id,f] of Object.entries(FEATURE_MAP)){
    assert.ok(f.evidence===null || Object.prototype.hasOwnProperty.call(EVIDENCE,f.evidence),id);
  }
});
test("only official general portal is in outbound URL",()=>{
  assert.equal(OFFICIAL_PORTAL,"https://judgment.judicial.gov.tw/FJUD/");
});
test("source findings cannot mutate between two reads",()=>{
  const before=JSON.stringify(summary());
  try { EVIDENCE.court_pdf.counts.realOfficialPdfFulltextsVerified=100 } catch {}
  assert.equal(JSON.stringify(summary()),before);
});
test("no evidence status calls any sample universal coverage",()=>{
  for(const f of Object.values(EVIDENCE))
    assert.notEqual(f.status,"all_official_data_verified");
});
test("unknown feature never echoed nor approved",()=>{
  const bad=featureStatus("<img src=x onerror=alert(1)>");
  assert.equal(bad.status,"blocked_unknown_feature");
  assert.equal(JSON.stringify(bad).includes("<img"),false);
  assert.equal(bad.allowProduction,false);
  assert.equal(bad.url,OFFICIAL_PORTAL);
});
test("null unknown ID blocked",()=>{
  assert.equal(featureStatus(null).known,false);
});
test("polluted input does not bypass own-key feature check",()=>{
  for(const key of ["constructor","toString","__proto__","prototype"]){
    assert.equal(featureStatus(key).known,false,key);
  }
});
test("every named feature still has production gated",()=>{
  for(const id of Object.keys(FEATURE_MAP)){
    const x=featureStatus(id);
    assert.equal(x.known,true,id);
    assert.equal(x.allowProduction,false,id);
    assert.equal(x.allowMerge,false,id);
    assert.equal(x.allowLiveApi,false,id);
    assert.equal(x.allowPdfDownload,false,id);
  }
});
test("legislation sampling can enter separate review, not deploy",()=>{
  const x=featureStatus("law_lookup");
  assert.equal(x.status,"independent_review_candidate");
  assert.equal(x.evidence.status,"sample_verified");
  assert.equal(x.allowProduction,false);
});
test("interpretation lookup is scope limited even if caller says approved",()=>{
  const x=featureStatus("interpretation_lookup");
  assert.equal(x.status,"limited_scope_review_candidate");
  assert.equal(x.evidence.counts.officialAbstractOnly,4);
  assert.equal(x.allowProduction,false);
});
test("constitution review must say excerpts only",()=>{
  const x=featureStatus("constitutional_reference");
  assert.match(x.userFacingText,/主文及解釋文抽查/);
  assert.notEqual(x.status,"all_reasoning_verified");
});
test("legislative history review limited to two provisions",()=>{
  const x=featureStatus("legislative_history");
  assert.match(x.userFacingText,/兩條/);
});
test("court HTML snapshot does not permit individual public source URL",()=>{
  const x=featureStatus("court_html");
  assert.equal(x.status,"research_snapshot_only");
  assert.equal(x.allowIndividualLink,false);
  assert.equal(x.url,OFFICIAL_PORTAL);
});
test("court history is snapshot not case finality",()=>{
  const x=featureStatus("court_history");
  assert.equal(x.status,"research_snapshot_only");
  assert.equal(x.allowIndividualLink,false);
});
test("PDF cannot gain real source acceptance from 84 offline synthetic checks",()=>{
  const x=featureStatus("court_pdf");
  assert.equal(x.status,"blocked_real_source_unverified");
  assert.equal(x.allowCourtFullText,false);
});
test("publication rechecking stays blocked until authoritative live evidence",()=>{
  const x=featureStatus("court_current_publication");
  assert.equal(x.status,"blocked_live_verification_absent");
  assert.equal(x.allowIndividualLink,false);
});
test("case finality stays blocked",()=>{
  assert.equal(featureStatus("court_finality").status,"blocked_finality_unknown");
});
test("individual case deep links never authorized",()=>{
  const x=featureStatus("individual_court_link");
  assert.equal(x.allowIndividualLink,false);
  assert.equal(x.url,OFFICIAL_PORTAL);
});
test("portal is generic, not case-specific",()=>{
  const x=featureStatus("official_court_portal");
  assert.equal(x.status,"portal_only");
  assert.equal(x.url,OFFICIAL_PORTAL);
  assert.equal(x.allowIndividualLink,false);
});
test("every court-related feature is on explicit release block list",()=>{
  for(const id of PUBLIC_COURT_FEATURES){
    const x=featureStatus(id);
    assert.ok(x.known);
    assert.ok(x.status==="research_snapshot_only"||x.status.startsWith("blocked_"));
  }
});
test("invalid missing features array blocks",()=>{
  assert.equal(planReview().status,"blocked_invalid_scope");
});
test("plain string masquerading as list blocks",()=>{
  assert.equal(planReview({features:"law_lookup"}).status,"blocked_invalid_scope");
});
test("malicious requested feature blocked without echo",()=>{
  const payload="<script>alert('XSS')</script>";
  const x=planReview({features:["law_lookup",payload]});
  assert.equal(x.status,"blocked_invalid_scope");
  assert.equal(JSON.stringify(x).includes(payload),false);
});
test("oversized feature selection blocks",()=>{
  assert.equal(planReview({features:Array(31).fill("law_lookup")}).status,"blocked_invalid_scope");
});
test("empty user selection does not accidentally mean all passed",()=>{
  const x=planReview({features:[]});
  assert.equal(x.status,"no_scope_selected");
  assert.equal(x.allRequestedResearchSubtestsPassed,false);
});
test("selected law and interpretation only candidates for separate review",()=>{
  const x=planReview({features:["law_lookup","interpretation_lookup"]});
  assert.equal(x.status,"research_components_ready_for_separate_review_only");
  assert.deepEqual(x.reviewable,["law_lookup","interpretation_lookup"]);
  assert.deepEqual(x.blocked,[]);
  assert.equal(x.canDeploy,false);
  assert.equal(x.stage3Accepted,false);
});
test("constitutional and legislative selected sources separately reviewable",()=>{
  const x=planReview({features:["constitutional_reference","legislative_history"]});
  assert.equal(x.reviewable.length,2);
  assert.equal(x.canMerge,false);
});
test("mixed law + PDF disallows bundle release, but preserves law as reviewable",()=>{
  const x=planReview({features:["law_lookup","court_pdf"]});
  assert.equal(x.status,"court_features_not_release_ready");
  assert.deepEqual(x.reviewable,["law_lookup"]);
  assert.deepEqual(x.blocked,["court_pdf"]);
  assert.equal(x.canDeploy,false);
});
test("HTML sample pass still blocks combined public court feature rollout",()=>{
  const x=planReview({features:["court_html"]});
  assert.deepEqual(x.blocked,["court_html"]);
  assert.equal(x.canPublishIndividualCaseLinks,false);
});
test("history list no case finality permission",()=>{
  const x=planReview({features:["court_history","court_finality"]});
  assert.equal(x.blocked.length,2);
  assert.equal(x.stage3Accepted,false);
});
test("a pure court portal request cannot activate case API",()=>{
  const x=planReview({features:["official_court_portal"]});
  assert.equal(x.canUseLiveApi,false);
  assert.equal(x.canPublishIndividualCaseLinks,false);
  assert.equal(x.url,OFFICIAL_PORTAL);
});
test("duplicates do not bypass release gate",()=>{
  const x=planReview({features:["law_lookup","law_lookup","court_pdf","court_pdf"]});
  assert.deepEqual(x.features,["law_lookup","court_pdf"]);
  assert.deepEqual(x.blocked,["court_pdf"]);
});
test("fake approval, truthy evidence and fresh clock cannot authorize deployment",()=>{
  const x=planReview({
    features:["law_lookup","court_html","court_pdf"],
    approvals:{releaseApproved:true,stage3Accepted:true},
    evidence:{liveApiVerified:true,officialWithdrawalClean:true,currentLaw:true,
      currentCourtPublication:true,independentPdf:true},
    now:new Date("2026-10-17T02:00:00+08:00"),
    candidateLink:"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=REAL"
  });
  for(const field of ["productionApproved","stage3Accepted","canMerge",
    "canDeploy","canUseLiveApi","canStoreRealJudgments","canPublishIndividualCaseLinks"]){
    assert.equal(x[field],false,field);
  }
  assert.equal(x.url,OFFICIAL_PORTAL);
});
test("untrusted evidence cannot move law stage to approved production",()=>{
  const x=planReview({features:["law_lookup"],evidence:{lawAllUpToDate:true}});
  assert.equal(x.canDeploy,false);
});
test("unknown property names never end up in output",()=>{
  const x=planReview({features:["law_lookup"], evidence:{secret:"TOP_SECRET"}});
  assert.doesNotMatch(JSON.stringify(x),/TOP_SECRET/);
});
test("caller feature list cannot mutate returned report",()=>{
  const a=["law_lookup"];
  const x=planReview({features:a});
  a.push("court_pdf");
  assert.deepEqual(x.features,["law_lookup"]);
  assert.ok(Object.isFrozen(x));
  assert.ok(Object.isFrozen(x.features));
});
test("court PDF fallback message says not independently checked",()=>{
  const x=publicCourtPresentation({format:"pdf"});
  assert.equal(x.contentKind,"pdf_unverified");
  assert.match(x.message,/沒有完成該 PDF 的獨立全文驗證/);
  assert.deepEqual(x.allowedLinks,[OFFICIAL_PORTAL]);
});
test("court HTML snapshot message cannot claim live publication",()=>{
  const x=publicCourtPresentation({format:"html"});
  assert.equal(x.contentKind,"html_prior_sample_only");
  assert.equal(x.currentlyPublishedAsserted,false);
  assert.equal(x.judgmentFinalAsserted,false);
});
test("arbitrary type returns generic review, not fake trusted source",()=>{
  const x=publicCourtPresentation({format:"pdf_with_official_certificate"});
  assert.equal(x.contentKind,"court_source_unverified");
  assert.equal(x.downloadAllowed,false);
});
test("every caller supplied deep link, case number and paragraph is suppressed",()=>{
  const caseUrl="https://judgment.judicial.gov.tw/FJUD/data.aspx?id=REAL_PRIVATE_JID";
  const dangerous="<img src=x onerror=alert(1)>";
  const x=publicCourtPresentation({format:"html",caseUrl,officialId:"REAL_PRIVATE_JID",
    rawText:dangerous,pdfUrl:caseUrl,verified:true,currentStatus:"public"});
  const json=JSON.stringify(x);
  for(const forbidden of ["REAL_PRIVATE_JID",dangerous,"data.aspx","PRIVATE"]){
    assert.equal(json.includes(forbidden),false,forbidden);
  }
  assert.equal(x.caseSpecificUrlReturned,false);
  assert.equal(x.embedCourtText,false);
});
test("fake verified:true on PDF cannot restore download or source trust",()=>{
  const x=publicCourtPresentation({format:"pdf",verified:true,currentStatus:"public"});
  assert.equal(x.stage3Accepted,false);
  assert.equal(x.downloadAllowed,false);
  assert.equal(x.currentlyPublishedAsserted,false);
});
test("injected PDF URL does not become a link",()=>{
  const x=publicCourtPresentation({format:"pdf",pdfUrl:"https://evil.invalid/case.pdf"});
  assert.deepEqual(x.allowedLinks,[OFFICIAL_PORTAL]);
});
test("no PDF info returned can be interpreted as a real official credential",()=>{
  const x=publicCourtPresentation({format:"pdf",verified:true});
  assert.equal(x.judgmentFinalAsserted,false);
  assert.equal(x.caseSpecificUrlReturned,false);
});
test("summary is time-bounded, doesn't call historical material current",()=>{
  const x=summary();
  assert.equal(x.asOf,"2026-10-16");
  assert.equal(x.status,"stage3_not_accepted");
  assert.equal(x.sourceRefreshRequiredBeforeProduction,true);
});
test("summary never claims Cloudflare production was changed",()=>{
  const x=summary();
  assert.equal(x.deploymentPerformed,false);
  assert.equal(x.productionApproved,false);
});
test("every evidence row has a named report and supporting run",()=>{
  for(const [key,value] of Object.entries(EVIDENCE)){
    assert.ok(value.report.endsWith(".md"),key);
    assert.ok(value.actionRuns.length>=1,key);
    assert.ok(value.actionRuns.every(Number.isSafeInteger),key);
  }
});
test("feature selection never permits source HTML embedding",()=>{
  for(const id of Object.keys(FEATURE_MAP)){
    const x=featureStatus(id);
    assert.equal(x.allowCourtFullText,false);
  }
});
test("all summary objects immutable and do not include real case identifiers",()=>{
  const x=summary();
  assert.ok(Object.isFrozen(x));
  assert.ok(Object.isFrozen(x.featureNames));
  assert.doesNotMatch(JSON.stringify(x),/TPSM,114|TPHV,113|TPDV,114/);
});
test("untrusted __proto__ feature array entry cannot pollute decisions",()=>{
  const x=planReview({features:["__proto__"]});
  assert.equal(x.status,"blocked_invalid_scope");
  assert.equal(x.canDeploy,false);
});
test("all stage release decisions independent of time-of-day and forged approval",()=>{
  const q={features:["law_lookup","court_html"],approvals:{stage3Accepted:true},
    evidence:{sourceCorrect:true}};
  const a=planReview({...q,now:new Date("2026-10-17T01:00:00+08:00")});
  const b=planReview({...q,now:new Date("2026-10-17T18:00:00+08:00")});
  assert.equal(a.status,b.status);
  assert.equal(a.canUseLiveApi,false);
});
