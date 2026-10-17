"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const model=require("./model.js");
const {EVIDENCE,planReview}=require("../stage3q-readiness-ledger.cjs");
const law={kind:"law",id:"TEST_LAW_SYNTHETIC_A",title:"示範法 A",
  snapshotOn:"2026-10-02",promulgatedOn:"2026-09-01",effectiveOn:null,
  sampleExcerpt:"合成條文，不是真實法規。"};
const full={kind:"interpretation",id:"TEST_INTERP_SYNTHETIC_FULL",
  title:"函釋甲",issuingAgency:"合成 A",issuedOn:"2025-01-17",observedOn:"2026-10-15",
  contentLevel:"official_full_text_verified",sampleFullText:"合成全文",
  sampleOfficialAbstract:"合成官方要旨",siteSummary:"本站摘要"};
const abstract={...full,id:"TEST_INTERP_SYNTHETIC_ABSTRACT",
  contentLevel:"official_abstract_only",sampleFullText:"不得冒充官方全文",
  sampleOfficialAbstract:"合成官方要旨"};
const missing={...full,id:"TEST_INTERP_SYNTHETIC_MISSING",contentLevel:"unavailable"};

test("fixed review date",()=>assert.equal(model.AS_OF,"2026-10-17"));
test("law historic count matches Stage3q",()=>assert.equal(
  model.LIMITS.legislationSamplePassed,EVIDENCE.legislation.counts.sampleVerified));
test("interpretation full count matches Stage3q",()=>assert.equal(
  model.LIMITS.interpretationFullTextChecked,EVIDENCE.interpretations.counts.sourceFullText));
test("interpretation abstract count matches Stage3q",()=>assert.equal(
  model.LIMITS.interpretationAbstractOnly,EVIDENCE.interpretations.counts.officialAbstractOnly));
test("interpretation metadata count matches Stage3q",()=>assert.equal(
  model.LIMITS.interpretationMetadataChecked,EVIDENCE.interpretations.counts.metadata));
test("previous full and abstract counts are not 21 full",()=>{
  assert.equal(model.LIMITS.interpretationFullTextChecked,17);
  assert.equal(model.LIMITS.interpretationAbstractOnly,4);
  assert.notEqual(model.LIMITS.interpretationFullTextChecked,21);
});
test("global historical data not fresh current law",()=>{
  assert.equal(model.LIMITS.sourceCurrentValidityIndependentlyVerified,false);
  assert.equal(model.LIMITS.productionApproved,false);
});
test("three immutable content levels",()=>{
  assert.deepEqual(Object.keys(model.LEGAL_CONTENT),
    ["official_full_text_verified","official_abstract_only","unavailable"]);
  assert.ok(Object.isFrozen(model.LEGAL_CONTENT));
});
test("law three date fields remain distinct",()=>{
  const x=model.lawCard(law);
  assert.equal(x.snapshot.value,"2026-10-02");
  assert.equal(x.promulgated.value,"2026-09-01");
  assert.equal(x.effective.value,null);
});
test("no commencement must not be inferred from promulgation",()=>{
  const x=model.lawCard(law);
  assert.match(x.effective.display,/未核對/);
  assert.equal(x.currentlyEffectiveProven,false);
});
test("synthetic commencement still does not prove effective current law",()=>{
  const x=model.lawCard({...law,effectiveOn:"2026-09-10"});
  assert.equal(x.effective.value,"2026-09-10");
  assert.equal(x.currentlyApplicableProven,false);
});
test("old snapshot never automatically becomes current",()=>{
  const x=model.lawCard({...law,snapshotOn:"2020-01-01"});
  assert.equal(x.snapshot.value,"2020-01-01");
  assert.equal(x.fromOfficialData,false);
});
test("law model retains sample-only caveat",()=>{
  const x=model.lawCard(law);
  assert.match(x.caveat,/修正公布日不等於施行日/);
  assert.match(x.historicalSampleContext,/20\/20/);
});
test("law sample not alleged to be actual original record",()=>{
  const x=model.lawCard(law);
  assert.equal(x.isActualHistoricalLawSample,false);
  assert.equal(x.publicTextVerifiedForThisDemo,false);
});
test("fake current-law user claims ignored",()=>{
  const x=model.lawCard({...law,verified:true,currentlyEffectiveProven:true,live:true});
  assert.equal(x.currentlyEffectiveProven,false);
  assert.equal(x.productionApproved,false);
});
test("fake law URL never retained",()=>{
  assert.doesNotMatch(JSON.stringify(model.lawCard({...law,
    officialArticleUrl:"https://evil.invalid/data"})),/evil\.invalid/);
});
for(const value of [null,{},[],{...law,id:"C001"},{...law,kind:"interpretation"}]) {
  test("unsupported law record safely blocked "+String(value?.id??typeof value),()=>{
    assert.equal(model.lawCard(value).status,"blocked");
  });
}
test("full tier displays only supplied synthetic full sample",()=>{
  const x=model.interpretationCard(full);
  assert.equal(x.contentLevel,"official_full_text_verified");
  assert.equal(x.officialTextPreview,"合成全文");
  assert.equal(x.canClaimOriginalFullText,true);
  assert.equal(x.fromOfficialData,false);
});
test("abstract tier does not expose full text even if caller adds it",()=>{
  const x=model.interpretationCard(abstract);
  assert.equal(x.contentLevel,"official_abstract_only");
  assert.equal(x.officialTextPreview,"合成官方要旨");
  assert.equal(x.canClaimOriginalFullText,false);
  assert.doesNotMatch(JSON.stringify(x),/不得冒充官方全文/);
});
test("unknown content tier downgraded to unavailable",()=>{
  const x=model.interpretationCard({...full,contentLevel:"current_valid_full"});
  assert.equal(x.contentLevel,"unavailable");
  assert.equal(x.officialTextPreview,null);
});
test("no official available field must hide synthetic full and abstract",()=>{
  const x=model.interpretationCard(missing);
  assert.equal(x.officialTextPreview,null);
  assert.equal(x.canClaimOriginalFullText,false);
});
test("claimed full tier with missing body downgraded",()=>{
  const x=model.interpretationCard({...full,sampleFullText:null});
  assert.equal(x.contentLevel,"unavailable");
});
test("claimed abstract tier with missing abstract downgraded",()=>{
  const x=model.interpretationCard({...abstract,sampleOfficialAbstract:""});
  assert.equal(x.contentLevel,"unavailable");
});
test("site summary is always visibly independent",()=>{
  const x=model.interpretationCard(abstract);
  assert.match(x.siteSummaryLabel,/非官方要旨/);
  assert.equal(x.canPromoteSiteSummaryToOfficialAbstract,false);
});
test("site summary never substitutes missing original",()=>{
  const x=model.interpretationCard({...missing,siteSummary:"本站已自行推論全文"});
  assert.equal(x.officialTextPreview,null);
  assert.match(x.siteSummary,/本站已自行/);
});
test("all tiers keep validity as unverified",()=>{
  for(const x of [full,abstract,missing]) {
    const v=model.interpretationCard(x);
    assert.equal(v.isCurrentValidityVerified,false);
    assert.match(v.validityText,/尚待查證/);
    assert.equal(v.productionApproved,false);
  }
});
test("issue date does not mean observation date",()=>{
  const x=model.interpretationCard(full);
  assert.equal(x.issuedOn.value,"2025-01-17");
  assert.equal(x.observedOn.value,"2026-10-15");
});
test("unavailable observation date remains unknown",()=>{
  assert.equal(model.interpretationCard({...missing,observedOn:null}).observedOn.value,null);
});
test("official record URL and validity self-claims ignored",()=>{
  const x=model.interpretationCard({...full,sourceUrl:"https://evil.invalid/",validity:"valid"});
  assert.equal(x.officialRecordLink,null);
  assert.equal(x.isCurrentValidityVerified,false);
});
for(const value of [null,{},[],{...full,id:"moj:FE074147"},{...full,kind:"law"}]) {
  test("unsupported interpretation record blocked "+String(value?.id??typeof value),()=>{
    assert.equal(model.interpretationCard(value).status,"blocked");
  });
}
test("all list has three tiered interp plus sample law",()=>{
  const x=model.listView([law,full,abstract,missing],"all");
  assert.equal(x.count,4);
  assert.equal(x.status,"synthetic_display_only");
});
test("law filter only shows law entries",()=>{
  const x=model.listView([law,full],"law");
  assert.equal(x.count,1);
  assert.equal(x.items[0].kind,"law");
});
test("interpretation filter only shows interpretation entries",()=>{
  const x=model.listView([law,full],"interpretation");
  assert.equal(x.count,1);
  assert.equal(x.items[0].kind,"interpretation");
});
test("unknown filter blocks without echoing input",()=>{
  const x=model.listView([law,full],"<script>");
  assert.equal(x.status,"blocked");
  assert.deepEqual(x.items,[]);
});
test("non-array list fails closed",()=>assert.equal(model.listView("bad").status,"blocked"));
test("more than twelve inputs fail closed",()=>assert.equal(
  model.listView(Array(13).fill(law)).status,"blocked"));
test("list model data is immutable",()=>{
  const x=model.listView([law,full]);
  assert.ok(Object.isFrozen(x));
  assert.ok(Object.isFrozen(x.items));
  assert.ok(Object.isFrozen(x.items[0]));
});
test("every record is synthetic and not official",()=>{
  for(const entry of [law,full,abstract,missing]) {
    const x=model.normalizeRecord(entry);
    assert.equal(x.fromOfficialData,false);
    assert.equal(x.stage3Accepted,false);
  }
});
test("unsupported record type blocked and not echoed",()=>{
  const x=model.normalizeRecord({kind:"<script>alert(1)</script>",secret:"TOP_SECRET"});
  assert.equal(x.status,"blocked");
  assert.doesNotMatch(JSON.stringify(x),/TOP_SECRET|<script>/);
});
for(const value of ["2026-02-29","2026-13-01","2026-04-31","2026-1-01",
                     "2026/10/17","2026-10-17Z",""]) {
  test("impossible or malformed date rejected "+value,()=>assert.equal(model.validDate(value),false));
}
test("leap date can be represented without inferring validity",()=>{
  assert.equal(model.validDate("2024-02-29"),true);
  assert.equal(model.lawCard({...law,effectiveOn:"2024-02-29"}).currentlyEffectiveProven,false);
});
test("overlong text is bounded",()=>assert.equal(
  model.lawCard({...law,title:"Z".repeat(2000)}).title.length,900));
test("browser UMD export works without Node module",()=>{
  const source=fs.readFileSync(path.join(__dirname,"model.js"),"utf8");
  const context={};vm.createContext(context);vm.runInContext(source,context,{timeout:1200});
  assert.equal(context.Stage3rModel.LIMITS.interpretationAbstractOnly,4);
});
test("potential XSS rendered as text only",()=>{
  const x=model.interpretationCard({...abstract,siteSummary:"<img onerror=alert(1)>"});
  assert.equal(x.siteSummary,"<img onerror=alert(1)>");
  const app=fs.readFileSync(path.join(__dirname,"app.js"),"utf8");
  assert.match(app,/textContent/);
  assert.doesNotMatch(app,/\.innerHTML\s*=|insertAdjacentHTML\s*\(/);
});
test("UI has restrictive offline content security policy",()=>{
  const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  for(const token of ["connect-src 'none'","frame-src 'none'","script-src 'self'"])
    assert.ok(html.includes(token));
});
test("UI explains synthetic source levels and commencement",()=>{
  const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  for(const text of ["人工合成","官方全文","官方要旨","本站摘要","修正公布日","施行日","現行效力"])
    assert.ok(html.includes(text),text);
});
test("offline UI has no PDFs, fake real case IDs, network request or private API",()=>{
  const files=["index.html","app.js","model.js"].map(x=>
    fs.readFileSync(path.join(__dirname,x),"utf8")).join("\n");
  assert.doesNotMatch(files,/moj:FE\d+|TPSM,114|TPHV,113|fetch\s*\(|XMLHttpRequest|WebSocket|jspdf|pdfmake/gi);
});
test("UI has no inline scripts, forms or user file input",()=>{
  const html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  assert.doesNotMatch(html,/<form\b|<input\b|<iframe\b|<script(?![^>]*src=)[^>]*>/i);
});
test("stage3q still refuses fake release approvals",()=>{
  const x=planReview({features:["law_lookup","interpretation_lookup"],
    approvals:{production:true,releaseApproved:true},evidence:{sourceFresh:true}});
  assert.equal(x.canMerge,false);
  assert.equal(x.canDeploy,false);
  assert.equal(x.stage3Accepted,false);
});