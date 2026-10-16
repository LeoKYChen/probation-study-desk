"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {API_HOURS,taipeiHour,inOfficialApiWindow,planAccess,classifyOfficialHtml,
  OFFICIAL_PORTAL}=require("./stage3g-official-source-gate.cjs");
const taipei=(hour,minute=0)=>new Date(Date.UTC(2026,9,15,hour-8,minute));
function plan(activity,date,opts={}){
  return planAccess({activity,date,accountAuthorized:false,termsReviewed:false,
    liveApiExplicitlyEnabled:false,...opts});
}
for(const h of [0,1,2,3,4,5])test(`official API test window includes Taipei ${h}:00`,()=>{
  assert.equal(inOfficialApiWindow(taipei(h)),true);
});
for(const h of [6,7,8,12,17,23])test(`official API window excludes Taipei ${h}:00`,()=>{
  assert.equal(inOfficialApiWindow(taipei(h)),false);
});
test("05:59 inclusive and 06:00 exclusive",()=>{
  assert.equal(inOfficialApiWindow(taipei(5,59)),true);
  assert.equal(inOfficialApiWindow(taipei(6)),false);
});
test("Taipei hour is not confused with UTC",()=>{
  assert.equal(taipeiHour(new Date("2026-10-15T18:00:00Z")),2);
});
test("invalid date always throws",()=>{
  assert.throws(()=>inOfficialApiWindow(new Date("invalid")),/Invalid/);
});
test("daytime click cannot use API as an always-on verifier",()=>{
  const p=plan("click_recheck",taipei(11));
  assert.equal(p.status,"portal_only");assert.equal(p.allowIndividualCaseLinks,false);
  assert.match(p.reason,/outside_service_hours/);
});
test("nighttime click without official membership remains portal-only",()=>{
  assert.equal(plan("click_recheck",taipei(2)).status,"portal_only");
});
test("unimplemented alternate source flag cannot grant access",()=>{
  assert.equal(plan("click_recheck",taipei(11),{
    independentRealtimeSourceAvailable:true
  }).allowIndividualCaseLinks,false);
});
test("nightly sync without explicit enabled flag stays blocked",()=>{
  assert.equal(plan("nightly_update",taipei(2),{
    accountAuthorized:true,termsReviewed:true
  }).status,"portal_only");
});
test("nightly sync with enabled flag but terms not reviewed stays blocked",()=>{
  assert.equal(plan("nightly_update",taipei(2),{
    accountAuthorized:true,liveApiExplicitlyEnabled:true
  }).status,"portal_only");
});
test("authenticated planned test only possible with all gates and correct hours",()=>{
  const p=plan("nightly_update",taipei(2),{
    accountAuthorized:true,termsReviewed:true,liveApiExplicitlyEnabled:true
  });
  assert.equal(p.status,"auth_test_possible");assert.equal(p.allowIndividualCaseLinks,false);
  assert.equal(p.liveCallsPerformed,0);
});
test("API inaccessible after 06:00 even with approval",()=>{
  const p=plan("nightly_update",taipei(10),{
    accountAuthorized:true,termsReviewed:true,liveApiExplicitlyEnabled:true
  });
  assert.equal(p.status,"portal_only");assert.equal(p.allowIndividualCaseLinks,false);
});
test("seven day delayed JList is NOT real time status",()=>{
  assert.equal(plan("nightly_update",taipei(2)).sevenDayLaggedChangesNotLiveCaseStatus,true);
});
test("generic official portal URL fixed",()=>{
  assert.equal(OFFICIAL_PORTAL,"https://judgment.judicial.gov.tw/FJUD/");
});
test("unknown data activity forbidden",()=>{
  assert.throws(()=>plan("all_juvenile_court_files",taipei(2)),/Unexpected/);
});
const good={httpStatus:200,originMatches:true,hasCaseBody:true,
  hasMatchingCourt:true,hasMatchingCaseNumber:true,independentTextCompared:true};
test("HTTP 200 without court text never approves a case",()=>{
  const r=classifyOfficialHtml({...good,hasCaseBody:false});
  assert.equal(r.status,"http200_without_judgment_body");
  assert.equal(r.individualCaseLinkAllowed,false);
});
test("HTTP 403 is not a withdrawal determination",()=>{
  assert.equal(classifyOfficialHtml({...good,httpStatus:403}).status,
    "official_content_unavailable");
});
test("off-domain evidence is refused",()=>{
  assert.equal(classifyOfficialHtml({...good,originMatches:false}).status,
    "origin_not_authorized");
});
test("court mismatch refused",()=>{
  assert.equal(classifyOfficialHtml({...good,hasMatchingCourt:false}).status,
    "case_identity_unconfirmed");
});
test("case number mismatch refused",()=>{
  assert.equal(classifyOfficialHtml({...good,hasMatchingCaseNumber:false}).status,
    "case_identity_unconfirmed");
});
test("text lacking independent comparison remains incomplete",()=>{
  assert.equal(classifyOfficialHtml({...good,independentTextCompared:false}).status,
    "text_not_independently_compared");
});
test("even compared content requires separate current publication check",()=>{
  const r=classifyOfficialHtml(good);
  assert.equal(r.status,"content_candidate_needs_current_publication_validation");
  assert.equal(r.individualCaseLinkAllowed,false);
});
test("coercible strings cannot act as verified booleans",()=>{
  assert.throws(()=>classifyOfficialHtml({...good,hasCaseBody:"true"}),/explicit booleans/);
});
test("source classification immutable and never stores fulltext",()=>{
  const r=classifyOfficialHtml(good);
  assert.equal(Object.isFrozen(r),true);
  assert.equal(r.courtTextStored,false);
  assert.equal(r.officialApiUsed,false);
});
