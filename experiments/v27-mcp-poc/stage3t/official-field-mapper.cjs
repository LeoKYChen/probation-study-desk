"use strict";
/* Stage3t documentary field mapping, offline synthetic examples only.
Sources: https://schema.gov.tw/lists/96
 https://data.gov.tw/dataset/18289
 https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&media=print&type=e
Stat* documented STANDARD fields have NOT been independently established as
the literal XML tags in a downloaded official XML response. No live data read.
*/
const DATE8=/^\d{8}$/, LAW_ID=/^[A-Z]\d{7}$/, EX_ID=/^FE\d{6}$/;
const TEST_ID=/^TEST_(?:LAW|INTERP)_SYNTHETIC_[A-Z0-9_]{1,24}$/;
const SOURCES=Object.freeze({
 lawStandard:"https://schema.gov.tw/lists/96",
 lawDataset:"https://data.gov.tw/dataset/18289",
 interpretationPage:"https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&media=print&type=e"
});
function deepFreeze(x) {
 if(x&&typeof x==="object"&&!Object.isFrozen(x)) {
  for(const v of Object.values(x)) deepFreeze(v);
  Object.freeze(x);
 }return x;
}
function review(kind,reason) {
 return deepFreeze({kind,status:"review",reason,
  officialSourceAuthenticated:false,officialCurrentVersionVerified:false,
  currentLegalEffectVerified:false,productionApproved:false,stage3Accepted:false});
}
function validDate8(x) {
 if(typeof x!=="string"||!DATE8.test(x))return false;
 const y=+x.slice(0,4),m=+x.slice(4,6),d=+x.slice(6,8);
 if(y<1900||y>2100)return false;
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function dateValue(x) {
 if(!validDate8(x))return deepFreeze({date:null,exact:false,
  reason:x===null||x===undefined||x===""?"date_absent":"partial_or_invalid_date"});
 return deepFreeze({date:x.slice(0,4)+"-"+x.slice(4,6)+"-"+x.slice(6,8),
  exact:true,reason:"format_only_not_current_version_proof"});
}
function statUrl(x) {
 if(typeof x!=="string"||x.length>240||/[\s\\]/.test(x)||/%2f|%5c|%00/i.test(x))return false;
 try{
  const u=new URL(x);
  if(u.origin!=="https://law.moj.gov.tw"||u.pathname!=="/LawClass/LawAll.aspx"
     ||u.hash||u.username||u.password||u.port||[...u.searchParams].length!==1)return false;
  const p=u.searchParams.get("pcode")||u.searchParams.get("PCode");
  return LAW_ID.test(p||"");
 }catch{return false;}
}
function interpUrl(x,id) {
 if(typeof x!=="string"||!EX_ID.test(id||"")||x.length>290||/[\s\\]/.test(x))return false;
 try{
  const u=new URL(x);
  if(u.origin!=="https://mojlaw.moj.gov.tw"||u.pathname!=="/LawContentExShow.aspx"||
     u.hash||u.username||u.password||u.port)return false;
  const keys=[...u.searchParams.keys()];
  return keys.length>=2&&keys.length<=3&&new Set(keys).size===keys.length&&
   keys.every(k=>["id","type","media"].includes(k))&&
   u.searchParams.get("id")===id&&u.searchParams.get("type")==="e"&&
   (!u.searchParams.has("media")||u.searchParams.get("media")==="print");
 }catch{return false;}
}
function safeString(x,max=1500) {
 if(typeof x!=="string")return null;
 const s=x.trim();
 return s&&s.length<=max&&!/[\u0000-\u0008\u000e-\u001f]/.test(s)?s:null;
}
function common(kind) {
 return {kind,status:"schema_candidate_unverified",
  officialSourceAuthenticated:false,officialCurrentVersionVerified:false,
  currentLegalEffectVerified:false,fromOfficialApi:false,
  fullTextIndependentlyCompared:false,productionApproved:false,stage3Accepted:false};
}
function mapStatStandard(raw,opts={}) {
 if(opts.synthetic!==true||!raw||typeof raw!=="object"||Array.isArray(raw))
  return review("law","no_real_feed_adapter_enabled");
 if(!TEST_ID.test(raw.fixtureId||"")||!safeString(raw.StatName,160)||
    !statUrl(raw.StatURL)||!["01","02"].includes(raw.StatContentType))
  return review("law","stat_standard_or_source_invalid");
 if(raw.StatAbandonNote!==undefined&&!["","廢"].includes(raw.StatAbandonNote))
  return review("law","unrecognized_repeal_note");
 let count=0;
 if(raw.StatContentType==="01"){
  if(!Array.isArray(raw.StatArticles)||raw.StatArticles.length===0||raw.StatArticles.length>12)
   return review("law","article_list_missing_or_out_of_bounds");
  for(const a of raw.StatArticles){
   if(!a||typeof a!=="object"||!["A","C"].includes(a.ArticleType)||
      !safeString(a.ArticleContent))return review("law","article_structure_untrusted");
   if(a.ArticleType==="A"){
    if(!/^\d+(?:-\d+)?$/.test(a.ArticleNo||""))return review("law","article_number_untrusted");
    count++;
   }
  }
  if(count===0)return review("law","no_actual_articles");
 }else if(!safeString(raw.StatContent))
  return review("law","single_content_untrusted");
 const mod=dateValue(raw.StatModifiedDate),eff=dateValue(raw.StatEffectiveDate);
 return deepFreeze({
  ...common("law"),syntheticId:raw.fixtureId,
  title:safeString(raw.StatName,160),
  latestChangeCandidate:mod.date,latestChangeDateExact:mod.exact,
  latestChangeDateReason:mod.reason,
  statuteEffectiveMetadataCandidate:eff.date,
  statuteEffectiveMetadataExact:eff.exact,
  statuteEffectiveDateReason:eff.reason,
  listedRepealed:raw.StatAbandonNote==="廢",
  contentType:raw.StatContentType,articleEntriesCount:count,
  sourceUrlCandidate:raw.StatURL,
  promulgatedOn:null,commencementOn:null,transitionRuleVerified:false,
  effectiveScope:"unknown",officialVersionVerifiedToday:false,
  articleTextStored:false,officialDocumentTextStored:false
 });
}
function lawView(candidate) {
 if(!candidate||candidate.status!=="schema_candidate_unverified"||
    candidate.kind!=="law"||candidate.officialSourceAuthenticated!==false)
  return review("law","untrusted_mapped_candidate");
 return deepFreeze({
  status:"research_structure_preview_only",title:candidate.title,
  latestChangeCandidate:candidate.latestChangeCandidate,
  statuteEffectiveMetadataCandidate:candidate.statuteEffectiveMetadataCandidate,
  promulgationDate:"尚未獨立核對",individualArticleCommencement:"尚未獨立核對",
  transitionRule:"尚未獨立核對",currentLaw:"未驗證現行法",
  sourceUrlForPublicLink:null,actualArticleTextShown:false,
  productionApproved:false,stage3Accepted:false
 });
}
function rocDate(x) {
 if(typeof x!=="string")return null;
 const m=/^民國\s*(\d{1,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/.exec(x.trim());
 if(!m)return null;
 const s=String(+m[1]+1911)+m[2].padStart(2,"0")+m[3].padStart(2,"0");
 return dateValue(s).date;
}
/* Labels are documented on a public MOJ page; exact selectors/content roles
 * and all real HTML response parsing still need independent verification.
 * In particular a page '主旨' or '說明' marker does NOT prove full text. */
function mapInterpLabels(raw,opts={}) {
 if(opts.synthetic!==true||!raw||typeof raw!=="object"||Array.isArray(raw))
  return review("interpretation","no_live_html_extractor_enabled");
 if(!TEST_ID.test(raw.fixtureId||"")||
    !interpUrl(raw.sourceUrl,raw.pageId)||
    !safeString(raw.issuingAgency,120)||!safeString(raw.issueNumber,150))
  return review("interpretation","interpretation_source_or_identity_invalid");
 const date=rocDate(raw.issuedRocDate);
 if(!date)return review("interpretation","issue_date_not_verified");
 if(!safeString(raw.officialAbstractCandidate))
  return review("interpretation","official_abstract_candidate_missing");
 return deepFreeze({
  ...common("interpretation"),syntheticId:raw.fixtureId,
  issuingAgencyCandidate:safeString(raw.issuingAgency,120),
  issueNumberCandidate:safeString(raw.issueNumber,150),
  issuedOnCandidate:date,sourceUrlCandidate:raw.sourceUrl,
  pageIdCandidate:raw.pageId,hasAbstractCandidate:true,
  hasSubjectMarker:raw.hasSubjectMarker===true,
  hasExplanationMarker:raw.hasExplanationMarker===true,
  fullTextTier:"unavailable",officialAbstractTier:"candidate_only",
  officialFullTextVerified:false,interpretationLegalEffect:"unknown",
  siteSummaryPromotedToOfficial:false,originalTextStored:false
 });
}
function interpView(candidate){
 if(!candidate||candidate.status!=="schema_candidate_unverified"||
    candidate.kind!=="interpretation"||candidate.officialSourceAuthenticated!==false)
  return review("interpretation","untrusted_mapped_candidate");
 return deepFreeze({
  status:"research_structure_preview_only",
  issuingAgencyCandidate:candidate.issuingAgencyCandidate,
  issueNumberCandidate:candidate.issueNumberCandidate,
  issuedOnCandidate:candidate.issuedOnCandidate,
  sourceUrlForPublicLink:null,
  officialFullTextShown:false,officialAbstractShown:false,
  siteSummaryIsNotOfficial:true,legalEffect:"待查證",
  publicationAuthenticated:false,productionApproved:false,stage3Accepted:false
 });
}
function summary() {
 return deepFreeze({
  stage:"Stage3t official documented field standard and public HTML labels",
  sources:SOURCES,
  confirmedStatStandardFields:[
   "StatName","StatURL","StatModifiedDate","StatEffectiveDate","StatAbandonNote",
   "StatContentType","StatContent","StatArticles","ArticleType","ArticleNo","ArticleContent"
  ],
  confirmedPublicInterpretationPageLabels:[
   "發文單位","發文字號","發文日期","要旨"
  ],
  exactOfficialXmlTagNamesValidatedFromDownload:false,
  realCurrentLawVersionVerified:false,
  officialFullTextIndependentlyCompared:false,
  productionApproved:false,stage3Accepted:false
 });
}
module.exports=deepFreeze({
 SOURCES,validDate8,dateValue,statUrl,interpUrl,rocDate,
 mapStatStandard,lawView,mapInterpLabels,interpView,summary
});
