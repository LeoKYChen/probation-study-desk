"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const m=require("./official-field-mapper.cjs");
const old=require("../stage3s/source-contract.cjs");
const release=require("../stage3q-readiness-ledger.cjs");
const law={
 fixtureId:"TEST_LAW_SYNTHETIC_STANDARD_A",
 StatName:"人工合成法規測試",
 StatURL:"https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030133",
 StatModifiedDate:"20261001",StatEffectiveDate:"20261015",
 StatAbandonNote:"",StatContentType:"01",
 StatArticles:[
  {ArticleType:"C",ArticleNo:"",ArticleContent:"第一章 合成章節"},
  {ArticleType:"A",ArticleNo:"12",ArticleContent:"第十二條 人工合成文字"},
  {ArticleType:"A",ArticleNo:"15-1",ArticleContent:"第十五條之一 合成測試"}
 ]
};
const interp={
 fixtureId:"TEST_INTERP_SYNTHETIC_LABELS_A",
 sourceUrl:"https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&media=print&type=e",
 pageId:"FE315630",issuingAgency:"法務部",
 issueNumber:"法律字第 10703512840 號",
 issuedRocDate:"民國 107 年 08 月 30 日",
 officialAbstractCandidate:"人工合成要旨。不是官方函釋原文。",
 hasSubjectMarker:true,hasExplanationMarker:true
};
const LAW=()=>m.mapStatStandard(law,{synthetic:true});
const INTP=()=>m.mapInterpLabels(interp,{synthetic:true});
test("official government standard URLs are documented, not invented API",()=>{
 const s=m.summary();assert.equal(s.sources.lawStandard,"https://schema.gov.tw/lists/96");
 assert.equal(s.sources.lawDataset,"https://data.gov.tw/dataset/18289");
 assert.equal(s.exactOfficialXmlTagNamesValidatedFromDownload,false);
});
test("recognized Stat* standard fields are specific, source-evidenced",()=>{
 const fields=m.summary().confirmedStatStandardFields;
 for(const key of ["StatName","StatURL","StatModifiedDate","StatEffectiveDate",
                    "StatArticles","ArticleNo","ArticleContent"])assert.ok(fields.includes(key));
});
test("valid mock Stat* article list is only an unverified candidate",()=>{
 const r=LAW();assert.equal(r.status,"schema_candidate_unverified");
 assert.equal(r.articleEntriesCount,2);assert.equal(r.officialSourceAuthenticated,false);
});
test("statute metadata effective date never promoted to article commencement",()=>{
 const r=LAW();
 assert.equal(r.statuteEffectiveMetadataCandidate,"2026-10-15");
 assert.equal(r.commencementOn,null);
 assert.equal(r.promulgatedOn,null);
 assert.equal(r.officialVersionVerifiedToday,false);
});
test("latest modified date is NOT an original promulgation date",()=>{
 const r=LAW();assert.equal(r.latestChangeCandidate,"2026-10-01");
 assert.equal(r.promulgatedOn,null);
 assert.equal(m.lawView(r).promulgationDate,"尚未獨立核對");
});
test("actual law review preview has no official text or direct source link",()=>{
 const v=m.lawView(LAW());
 assert.equal(v.actualArticleTextShown,false);
 assert.equal(v.sourceUrlForPublicLink,null);
 assert.equal(v.currentLaw,"未驗證現行法");
});
test("repeal metadata kept separate from force-of-law determination",()=>{
 const v=m.mapStatStandard({...law,StatAbandonNote:"廢"},{synthetic:true});
 assert.equal(v.listedRepealed,true);assert.equal(v.currentLegalEffectVerified,false);
});
test("bad repeal note blocked",()=>{
 assert.equal(m.mapStatStandard({...law,StatAbandonNote:"valid"},{synthetic:true}).status,"review");
});
test("absent StatModifiedDate stays unknown not filled with observed date",()=>{
 const v=m.mapStatStandard({...law,StatModifiedDate:null},{synthetic:true});
 assert.equal(v.latestChangeCandidate,null);
});
test("partial YYYYMM00 latest change date remains unverified",()=>{
 const v=m.mapStatStandard({...law,StatModifiedDate:"20261000"},{synthetic:true});
 assert.equal(v.latestChangeCandidate,null);assert.equal(v.latestChangeDateExact,false);
});
test("statute effective date invalid remains separate unknown",()=>{
 const v=m.mapStatStandard({...law,StatEffectiveDate:"20260231"},{synthetic:true});
 assert.equal(v.statuteEffectiveMetadataCandidate,null);
 assert.equal(v.commencementOn,null);
});
test("missing effective date never inferred from modified date",()=>{
 const v=m.mapStatStandard({...law,StatEffectiveDate:null},{synthetic:true});
 assert.equal(v.commencementOn,null);assert.equal(v.statuteEffectiveMetadataCandidate,null);
});
test("unknown StatContentType fails",()=>{
 const v=m.mapStatStandard({...law,StatContentType:"other"},{synthetic:true});
 assert.equal(v.status,"review");
});
test("single-article model requires actual StatContent not StatArticles",()=>{
 const v=m.mapStatStandard({...law,StatContentType:"02",StatContent:"人工單篇測試"},{synthetic:true});
 assert.equal(v.status,"schema_candidate_unverified");
 assert.equal(v.articleEntriesCount,0);
});
test("single content type with missing text blocked",()=>{
 assert.equal(m.mapStatStandard({...law,StatContentType:"02"},{synthetic:true}).status,"review");
});
test("article list with no actual A articles blocked",()=>{
 const v=m.mapStatStandard({...law,StatArticles:[law.StatArticles[0]]},{synthetic:true});
 assert.equal(v.reason,"no_actual_articles");
});
test("article number cannot be a URL or malicious HTML",()=>{
 for(const x of ["15a","javascript:alert(1)","<img>","1.2","1--2"]){
  const a={...law.StatArticles[1],ArticleNo:x};
  assert.equal(m.mapStatStandard({...law,StatArticles:[a]},{synthetic:true}).status,"review");
 }
});
test("empty StatArticles is review",()=>{
 assert.equal(m.mapStatStandard({...law,StatArticles:[]},{synthetic:true}).status,"review");
});
test("overlong StatArticles list is review",()=>{
 assert.equal(m.mapStatStandard({...law,StatArticles:Array(13).fill(law.StatArticles[1])},
  {synthetic:true}).status,"review");
});
test("article text missing cannot masquerade as fulltext",()=>{
 const broken={...law.StatArticles[1],ArticleContent:""};
 assert.equal(m.mapStatStandard({...law,StatArticles:[broken]},{synthetic:true}).status,"review");
});
test("numeric Law pcode shape must match official rule",()=>{
 assert.equal(m.statUrl(law.StatURL),true);
 assert.equal(m.statUrl("https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=A0030133"),true);
});
test("wrong domain or HTTP rejected, not trusted by DNS suffix",()=>{
 for(const x of [
  "https://law.moj.gov.tw.evil.invalid/LawClass/LawAll.aspx?pcode=A0030133",
  "http://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030133",
  "https://evil.invalid/LawClass/LawAll.aspx?pcode=A0030133",
  "https://u:p@law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030133"
 ]) assert.equal(m.statUrl(x),false);
});
test("law url with secret, fragment or path traversal blocked",()=>{
 for(const x of [
  law.StatURL+"&token=bad",law.StatURL+"#fragment",
  "https://law.moj.gov.tw/LawClass/../LawAll.aspx?pcode=A0030133",
  "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B@0022000",
  "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030133%2fabc"
 ])assert.equal(m.statUrl(x),false);
});
test("without explicitly opted-in synthetic the mapper rejects real-shaped input",()=>{
 assert.equal(m.mapStatStandard(law).reason,"no_real_feed_adapter_enabled");
});
test("real data IDs are unsupported fixture input",()=>{
 assert.equal(m.mapStatStandard({...law,fixtureId:"A0030133"},{synthetic:true}).status,"review");
});
test("raw source has no current official validity credential",()=>{
 const v=m.mapStatStandard({...law,approved:true,sourceVerified:true,current:true},
  {synthetic:true});
 assert.equal(v.productionApproved,false);assert.equal(v.officialSourceAuthenticated,false);
});
test("StatArticles content not copied into public schema preview",()=>{
 const r=LAW(),v=m.lawView(r),s=JSON.stringify(r)+JSON.stringify(v);
 assert.doesNotMatch(s,/第十五條之一 合成測試/);
});
test("stat data standard object is not a downloaded official XML response",()=>{
 assert.equal(m.summary().exactOfficialXmlTagNamesValidatedFromDownload,false);
 assert.equal(LAW().fromOfficialApi,false);
});
test("valid selected public interpretation label form recognized as candidate",()=>{
 const r=INTP();assert.equal(r.status,"schema_candidate_unverified");
 assert.equal(r.issuedOnCandidate,"2018-08-30");
 assert.equal(r.officialSourceAuthenticated,false);
});
test("page markers 主旨 說明 do not prove full text",()=>{
 const r=INTP();
 assert.equal(r.hasSubjectMarker,true);assert.equal(r.hasExplanationMarker,true);
 assert.equal(r.officialFullTextVerified,false);
 assert.equal(r.fullTextTier,"unavailable");
});
test("public interpretation preview does not release abstract/fulltext",()=>{
 const r=m.interpView(INTP());
 assert.equal(r.officialFullTextShown,false);
 assert.equal(r.officialAbstractShown,false);
 assert.equal(r.sourceUrlForPublicLink,null);
});
test("ROC issue date conversion supports observed public labels without claiming legal effect",()=>{
 assert.equal(m.rocDate("民國 107 年 08 月 30 日"),"2018-08-30");
 assert.equal(INTP().interpretationLegalEffect,"unknown");
});
test("invalid ROC calendar date yields review",()=>{
 const r=m.mapInterpLabels({...interp,issuedRocDate:"民國 115 年 02 月 30 日"},
  {synthetic:true});
 assert.equal(r.reason,"issue_date_not_verified");
});
test("non-ROC wording cannot be inferred from printed page",()=>{
 assert.equal(m.rocDate("107.08.30"),null);
});
test("MOJ interpretation URL must be documented exact host and path",()=>{
 assert.equal(m.interpUrl(interp.sourceUrl,interp.pageId),true);
 assert.equal(m.interpUrl("https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&type=e",
   "FE315630"),true);
});
test("MOJ interpretation query ID and type mismatches blocked",()=>{
 for(const x of [
  "https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315631&type=e",
  "https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&type=d",
  "https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630",
  "https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&type=e&token=secret"
 ])assert.equal(m.interpUrl(x,"FE315630"),false);
});
test("fake MOJ domains and redirecting credential URL blocked",()=>{
 for(const x of [
  "http://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&type=e",
  "https://mojlaw.moj.gov.tw.evil.invalid/LawContentExShow.aspx?id=FE315630&type=e",
  "https://user:pass@mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&type=e"
 ])assert.equal(m.interpUrl(x,"FE315630"),false);
});
test("no interpretation live extraction allowed in the mapper",()=>{
 assert.equal(m.mapInterpLabels(interp).status,"review");
});
test("interpretation candidate requires official abstract marker",()=>{
 assert.equal(m.mapInterpLabels({...interp,officialAbstractCandidate:""},
  {synthetic:true}).status,"review");
});
test("interpretation source issue number cannot be arbitrary long",()=>{
 assert.equal(m.mapInterpLabels({...interp,issueNumber:"X".repeat(151)},
  {synthetic:true}).status,"review");
});
test("interpreted page cannot become current merely because labels present",()=>{
 const r=m.mapInterpLabels({...interp,currentlyEffective:true,verified:true},
  {synthetic:true});
 assert.equal(r.currentLegalEffectVerified,false);
 assert.equal(r.productionApproved,false);
});
test("content of official abstract is never saved in aggregate mapper output",()=>{
 const r=INTP(),v=m.interpView(r),s=JSON.stringify(r)+JSON.stringify(v);
 assert.doesNotMatch(s,/人工合成要旨。不是官方函釋原文/);
});
test("no inferred fulltext from caller supplied page body",()=>{
 const r=m.mapInterpLabels({...interp,fullText:"偽造公文全文",fulltextVerified:true},
  {synthetic:true});
 assert.equal(r.officialFullTextVerified,false);
 assert.doesNotMatch(JSON.stringify(r),/偽造公文全文/);
});
test("actual case number or fake official ID is excluded from mapper",()=>{
 const r=m.mapInterpLabels({...interp,fixtureId:"moj:FE315630"},{synthetic:true});
 assert.equal(r.status,"review");assert.doesNotMatch(JSON.stringify(r),/moj:FE315630/);
});
test("no generic missing value silently promoted",()=>{
 assert.equal(m.mapStatStandard(null,{synthetic:true}).status,"review");
 assert.equal(m.mapInterpLabels([], {synthetic:true}).status,"review");
});
test("all source cards explicitly forbid production release",()=>{
 for(const r of [LAW(),INTP(),m.lawView(LAW()),m.interpView(INTP())]){
  assert.equal(r.productionApproved,false);assert.equal(r.stage3Accepted,false);
 }
});
test("prior Stage3s synthetic contract remains separate from actual government standard",()=>{
 assert.equal(old.schemaReview().realOfficialFieldNamesEndToEndMapped,false);
 assert.equal(m.summary().exactOfficialXmlTagNamesValidatedFromDownload,false);
});
test("Stage3q release authority still denied with user approval",()=>{
 const r=release.planReview({features:["law_lookup","interpretation_lookup"],
  approvals:{sourceMappingsVerified:true,releaseApproved:true}});
 assert.equal(r.canDeploy,false);assert.equal(r.stage3Accepted,false);
});
test("summary is immutable and only contains reference/field indicators",()=>{
 const r=m.summary();assert.ok(Object.isFrozen(r));
 assert.ok(Object.isFrozen(r.confirmedStatStandardFields));
 assert.equal(r.productionApproved,false);
});
