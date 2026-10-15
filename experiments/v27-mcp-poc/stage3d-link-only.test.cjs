"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {
  PORTAL_URL,MAX_AGE_MS,MAX_RESULTS,officialUrlFor,isExactOfficialPage,
  freshOfficialProof,makeSyntheticLinkOnlyPilot
}=require("./stage3d-link-only.cjs");
const A="TEST_JID_SYNTHETIC_A",B="TEST_JID_SYNTHETIC_B";
const NOW=new Date("2026-10-16T00:10:00Z");
const SECRET="THIS_COURT_BODY_MUST_NEVER_BE_RETURNED";
const RAW={
  success:true,
  results:[{jid:A,fullText:SECRET,summary:SECRET,parties:SECRET,title:SECRET,
    source_url:"https://evil.example/path",html:SECRET}]
};
const official=(jid=A,extra={})=>({
  status:"public",origin:"independently_checked_official_page",
  jid,officialCourtConfirmed:true,officialBodyVisible:true,
  officialJidConfirmed:true,publicAdultCase:true,
  finalUrl:officialUrlFor(jid),
  checkedAt:new Date(NOW.getTime()-10_000).toISOString(),
  ...extra
});
function setUp({response=RAW,verifier=jid=>official(jid),withdrawn=()=>false,
  witness=()=>true,clock=()=>new Date(NOW)}={}){
  let reads=0,verifies=0,revocations=0,witnessChecks=0;
  const service=makeSyntheticLinkOnlyPilot({
    search:async()=>{reads++;return typeof response==="function"?response():response},
    verifyOfficial:async jid=>{verifies++;return verifier(jid)},
    isRevoked:async jid=>{revocations++;return withdrawn(jid)},
    assertWitness:async()=>{witnessChecks++;return witness()},
    clock
  });
  return {service,counters:()=>({reads,verifies,revocations,witnessChecks})};
}
test("constructor requires independent read, official verification, revocation and witness",()=>{
  for(const missing of ["search","verifyOfficial","isRevoked","assertWitness"]){
    const inputs={search:async()=>RAW,verifyOfficial:async()=>official(),
      isRevoked:async()=>false,assertWitness:async()=>true};
    delete inputs[missing];
    assert.throws(()=>makeSyntheticLinkOnlyPilot(inputs),/Required private service dependency/);
  }
});
test("allowed demo topics only; rejects actual case description or sensitive query",async()=>{
  const {service,counters}=setUp();
  await assert.rejects(service.lookup("合成當事人某甲案情"),/predefined synthetic demo topics/);
  await assert.rejects(service.lookup("竊盜\n"),/predefined synthetic demo topics/);
  assert.equal(counters().reads,0);
});
test("fresh independent official proof releases only an official deep link",async()=>{
  const result=await setUp().service.lookup("竊盜");
  assert.equal(result.status,"limited_results");
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].state,"official_page_confirmed");
  assert.equal(result.items[0].href,officialUrlFor(A));
  assert.equal(result.items[0].fullTextStored,false);
  assert.equal(result.fullTextStored,false);
  assert.equal(result.persistentCacheUsed,false);
});
test("raw third-party body, snippet, parties, title and URLs are NEVER copied",async()=>{
  const result=await setUp().service.lookup("竊盜");
  const rendered=JSON.stringify(result);
  assert.equal(rendered.includes(SECRET),false);
  assert.equal(rendered.includes("evil.example"),false);
  assert.equal(rendered.includes("fullText"),true); // only the false safety flag
  assert.equal(rendered.includes('"title"'),false);
});
test("official URL canonicalizer encodes identifier and fixed ty=JD",()=>{
  const url=new URL(officialUrlFor(A));
  assert.equal(url.hostname,"judgment.judicial.gov.tw");
  assert.equal(url.searchParams.get("ty"),"JD");
  assert.equal(url.searchParams.get("id"),A);
});
test("non-synthetic real-style JID is rejected even with positive fake proof",async()=>{
  const real="TPSM,114,台抗,2605,20251231,1";
  assert.throws(()=>officialUrlFor(real),/synthetic identifiers/);
  const result=await setUp({response:{success:true,results:[{jid:real}]}}).service.lookup("竊盜");
  assert.equal(result.items[0].state,"verification_pending");
  assert.equal(result.items[0].href,PORTAL_URL);
  assert.equal(JSON.stringify(result).includes(real),false);
});
test("invalid or missing JIDs never cause verifier calls",async()=>{
  const {service,counters}=setUp({response:{success:true,results:[null,{}, {jid:"../../../x"}]}});
  const result=await service.lookup("詐欺");
  assert.equal(result.items.length,3);
  assert.equal(result.items.every(x=>x.state==="verification_pending"),true);
  assert.equal(counters().verifies,0);
});
test("official homepage or unverified search hit is not a case-specific link",async()=>{
  const r=await setUp({verifier:()=>({status:"unknown"})}).service.lookup("詐欺");
  assert.equal(r.items[0].href,PORTAL_URL);
  assert.equal(r.items[0].reason,"not_independently_confirmed");
});
test("removed official case never emits case-specific deep link",async()=>{
  const r=await setUp({verifier:()=>({status:"withdrawn"})}).service.lookup("詐欺");
  assert.equal(r.items[0].state,"verification_pending");
  assert.equal(r.items[0].href,PORTAL_URL);
  assert.equal(JSON.stringify(r).includes(A),false);
});
test("non-public official case never emits case-specific deep link",async()=>{
  const r=await setUp({verifier:()=>({status:"not_public"})}).service.lookup("詐欺");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("revoked case blocked BEFORE independent request",async()=>{
  const {service,counters}=setUp({withdrawn:()=>true});
  const r=await service.lookup("偽造文書");
  assert.equal(r.items[0].href,PORTAL_URL);
  assert.equal(counters().verifies,0);
});
test("revocation during official verification blocks link at second ledger check",async()=>{
  let checks=0;
  const r=await setUp({withdrawn:()=>++checks===2}).service.lookup("偽造文書");
  assert.equal(checks,2);
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("revoke ledger error fails closed, without exposing rejected source",async()=>{
  const r=await setUp({withdrawn:()=>{throw Error("secret ledger unavailable")}})
    .service.lookup("詐欺");
  assert.equal(r.items[0].href,PORTAL_URL);
  assert.equal(JSON.stringify(r).includes("secret ledger"),false);
});
test("missing independent witness fails BEFORE any search request",async()=>{
  const {service,counters}=setUp({witness:()=>{throw Error("witness rolled back")}});
  await assert.rejects(service.lookup("竊盜"),/witness rolled back/);
  assert.equal(counters().reads,0);
});
test("witness goes down during a case verification, fail closed",async()=>{
  let ticks=0;
  const r=await setUp({witness:()=>{if(++ticks>2)throw Error("witness failed");return true}})
    .service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("MCP search network failures yield an empty unavailable state",async()=>{
  const r=await setUp({response:()=>{throw Error("PRIVATE_SEARCH_ERROR")}})
    .service.lookup("竊盜");
  assert.equal(r.status,"unavailable");
  assert.deepEqual(r.items,[]);
  assert.equal(JSON.stringify(r).includes("PRIVATE_SEARCH_ERROR"),false);
});
test("MCP search success=false yields no individual links",async()=>{
  const r=await setUp({response:{success:false,results:[{jid:A}]}}).service.lookup("竊盜");
  assert.equal(r.status,"unavailable");
  assert.deepEqual(r.items,[]);
});
test("oversized result lists are rejected",async()=>{
  const rows=Array.from({length:MAX_RESULTS+1},()=>({jid:A}));
  await assert.rejects(setUp({response:{success:true,results:rows}})
    .service.lookup("竊盜"),/result limit exceeded/);
});
test("official verify timeout keeps generic portal fallback",async()=>{
  const r=await setUp({verifier:()=>{throw new Error("TIMEOUT_INTERNAL")}})
    .service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
  assert.equal(JSON.stringify(r).includes("TIMEOUT_INTERNAL"),false);
});
test("link blocked when official proof comes from MCP itself",async()=>{
  const r=await setUp({verifier:()=>official(A,{origin:"mcp_cache"})}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("link blocked if official page has no actual body",async()=>{
  const r=await setUp({verifier:()=>official(A,{officialBodyVisible:false})}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("link blocked for non-adult or non-public-case evidence",async()=>{
  const r=await setUp({verifier:()=>official(A,{publicAdultCase:false})}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("link blocked if official JID or court identity is not verified",async()=>{
  for(const change of [{officialJidConfirmed:false},{officialCourtConfirmed:false},{jid:B}]){
    const r=await setUp({verifier:()=>official(A,change)}).service.lookup("竊盜");
    assert.equal(r.items[0].href,PORTAL_URL);
  }
});
test("rejects non-HTTPS, other hosts, login redirects and extra URL params",()=>{
  for(const bad of [
    "http://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id="+A,
    "https://judgment.judicial.gov.tw.evil.example/FJUD/data.aspx?ty=JD&id="+A,
    "https://user:pass@judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id="+A,
    "https://judgment.judicial.gov.tw/FJUD/login.aspx?ty=JD&id="+A,
    officialUrlFor(A)+"&url=https://evil.example",
    officialUrlFor(A)+"#fragment",
    officialUrlFor(A)+"&id="+A,
    "https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=HTML&id="+A,
    officialUrlFor(B)
  ])assert.equal(isExactOfficialPage(bad,A),false,bad);
});
test("separately confirmed printData page may be accepted for same ID",()=>{
  const url="https://judgment.judicial.gov.tw/FJUD/printData.aspx?id="+A;
  assert.equal(isExactOfficialPage(url,A),true);
  assert.equal(freshOfficialProof(official(A,{finalUrl:url}),A,NOW),true);
});
test("verification older than 5 minutes expires and never shows stale link",async()=>{
  const t=new Date(NOW.getTime()-MAX_AGE_MS-1).toISOString();
  const r=await setUp({verifier:()=>official(A,{checkedAt:t})}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("future-dated verification is rejected",async()=>{
  const r=await setUp({verifier:()=>official(A,{
    checkedAt:new Date(NOW.getTime()+5000).toISOString()
  })}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("exact 5-minute boundary is accepted, 5-minute plus 1 ms isn't",()=>{
  assert.equal(freshOfficialProof(official(A,{
    checkedAt:new Date(NOW.getTime()-MAX_AGE_MS).toISOString()
  }),A,NOW),true);
  assert.equal(freshOfficialProof(official(A,{
    checkedAt:new Date(NOW.getTime()-MAX_AGE_MS-1).toISOString()
  }),A,NOW),false);
});
test("proof fields cannot be coerced with truthy strings",async()=>{
  const r=await setUp({verifier:()=>official(A,{officialBodyVisible:"true"})}).service.lookup("竊盜");
  assert.equal(r.items[0].href,PORTAL_URL);
});
test("new lookup does not cache old public verification",async()=>{
  let call=0;
  const {service,counters}=setUp({
    verifier:jid=>++call===1?official(jid):{status:"unknown"}
  });
  const old=await service.lookup("竊盜");
  const next=await service.lookup("竊盜");
  assert.equal(old.items[0].state,"official_page_confirmed");
  assert.equal(next.items[0].state,"verification_pending");
  assert.equal(counters().verifies,2);
  assert.equal(Object.hasOwn(service,"cache"),false);
});
test("mixed hit outputs use only verified individual URLs; no title, summary or body",async()=>{
  const r=await setUp({
    response:{success:true,results:[{jid:A,fullText:SECRET},{jid:B,fullText:SECRET}]},
    verifier:jid=>jid===A?official(jid):{status:"unknown"}
  }).service.lookup("詐欺");
  assert.equal(r.items.length,2);
  assert.equal(r.items[0].href,officialUrlFor(A));
  assert.equal(r.items[1].href,PORTAL_URL);
  assert.equal(JSON.stringify(r).includes(SECRET),false);
  assert.equal(JSON.stringify(r).includes(B),false);
});
test("returned decisions cannot be overwritten by the caller",async()=>{
  const result=await setUp().service.lookup("竊盜");
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.items),true);
  assert.equal(Object.isFrozen(result.items[0]),true);
  assert.throws(()=>{result.items[0].href="https://evil.example"},TypeError);
});
test("invalid clock throws instead of bypassing freshness tests",async()=>{
  const {service}=setUp({clock:()=>new Date("bad date")});
  await assert.rejects(service.lookup("竊盜"),/Invalid verification clock/);
});
