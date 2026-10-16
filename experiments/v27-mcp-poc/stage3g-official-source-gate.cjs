"use strict";
/**
 * Stage3g OFFLINE-ONLY official-source planning gate, not a real verifier.
 * Never authenticates to, downloads from, or stores content from any court.
 */
const OFFICIAL_PORTAL="https://judgment.judicial.gov.tw/FJUD/";
const API_SPEC="https://opendata.judicial.gov.tw/api/Newses/42/file";
const API_HOURS=Object.freeze({start:0,endExclusive:6,timeZone:"Asia/Taipei"});
function taipeiHour(date){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
    throw Error("Invalid access-planning clock");
  return Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Taipei",hour:"2-digit",
    hourCycle:"h23"}).formatToParts(date).find(x=>x.type==="hour")?.value);
}
function inOfficialApiWindow(date){
  const hour=taipeiHour(date);
  return hour>=API_HOURS.start&&hour<API_HOURS.endExclusive;
}
function planAccess({date,activity,accountAuthorized=false,termsReviewed=false,
  liveApiExplicitlyEnabled=false,independentRealtimeSourceAvailable=false}={}){
  const within=inOfficialApiWindow(date);
  if(!["nightly_update","click_recheck","research_lookup"].includes(activity))
    throw Error("Unexpected official-source activity");
  let status="blocked",reason="no_approved_source";
  if(activity==="click_recheck"&&!within){
    status="portal_only";
    reason="official_api_outside_service_hours_no_independent_realtime_source";
  }else if(!accountAuthorized||!termsReviewed||!liveApiExplicitlyEnabled){
    status="portal_only";
    reason="official_api_access_not_authorized_or_not_enabled";
  }else if(!within){
    status="portal_only";
    reason="outside_official_api_service_hours";
  }else{
    status="auth_test_possible";
    reason="within_hours_with_prior_separate_user_authorization";
  }
  // An unimplemented alternate source cannot grant trust through a flag.
  void independentRealtimeSourceAvailable;
  return Object.freeze({status,reason,portalsOnly:status!=="auth_test_possible",
    allowIndividualCaseLinks:false,allowStoreCaseText:false,
    liveCallsPerformed:0,portalUrl:OFFICIAL_PORTAL,
    apiTimeWindow:API_HOURS,apiSpecification:API_SPEC,
    sevenDayLaggedChangesNotLiveCaseStatus:true});
}
function classifyOfficialHtml({httpStatus,originMatches,hasCaseBody,hasMatchingCourt,
  hasMatchingCaseNumber,independentTextCompared}={}){
  if(typeof originMatches!=="boolean"||typeof hasCaseBody!=="boolean"||
    typeof hasMatchingCourt!=="boolean"||typeof hasMatchingCaseNumber!=="boolean"||
    typeof independentTextCompared!=="boolean")
    throw Error("Official-site HTML evidence must be explicit booleans");
  let code="needs_review";
  if(!originMatches)code="origin_not_authorized";
  else if(httpStatus!==200)code="official_content_unavailable";
  else if(!hasCaseBody)code="http200_without_judgment_body";
  else if(!hasMatchingCourt||!hasMatchingCaseNumber)code="case_identity_unconfirmed";
  else if(!independentTextCompared)code="text_not_independently_compared";
  else code="content_candidate_needs_current_publication_validation";
  return Object.freeze({status:code,individualCaseLinkAllowed:false,
    courtTextStored:false,officialApiUsed:false});
}
module.exports={OFFICIAL_PORTAL,API_HOURS,taipeiHour,inOfficialApiWindow,
  planAccess,classifyOfficialHtml};
