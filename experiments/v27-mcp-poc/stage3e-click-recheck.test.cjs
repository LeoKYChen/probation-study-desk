"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {PORTAL_URL,officialUrlFor}=require("./stage3d-link-only.cjs");
const {
  makeSyntheticClickRecheck,TICKET_LIFETIME_MS,MAX_OUTSTANDING,
  sessionDigest,syntheticJid
}=require("./stage3e-click-recheck.cjs");

const A="TEST_JID_SYNTHETIC_CLICK_A";
const B="TEST_JID_SYNTHETIC_CLICK_B";
const SESSION="TEST_SESSION_SYNTHETIC_USER_ONE";
const OTHER="TEST_SESSION_SYNTHETIC_USER_TWO";
const START=new Date("2026-10-16T02:00:00.000Z");
const PRIVATE="SYNTHETIC_SECRET_PARTY_AND_JUDGMENT_TEXT_NOT_ALLOWED";
function source(jid=A){
  return {success:true,results:[{jid,fullText:PRIVATE,summary:PRIVATE,
    title:PRIVATE,partyNames:PRIVATE,url:"https://unsafe.test/"+PRIVATE}]};
}
function proof(jid,time,overrides={}){
  return {
    status:"public",
    origin:"independently_checked_official_page",
    jid,publicAdultCase:true,officialCourtConfirmed:true,
    officialBodyVisible:true,officialJidConfirmed:true,
    checkedAt:new Date(time).toISOString(),
    finalUrl:officialUrlFor(jid),...overrides
  };
}
function fixture(overrides={}){
  let now=new Date(START);
  let searchCalls=0,proofCalls=0,witnessCalls=0,revocationCalls=0;
  const phases=[];
  const search=overrides.search || (async()=>{return source()});
  const verify=overrides.verifyOfficial ||
      (async(jid,{phase})=>proof(jid,now));
  const revoke=overrides.isRevoked || (async()=>false);
  const witness=overrides.assertWitness || (async()=>true);
  const client=makeSyntheticClickRecheck({
    search:async term=>{searchCalls++;return search(term)},
    verifyOfficial:async(jid,ctx)=>{proofCalls++;phases.push(ctx.phase);return verify(jid,ctx)},
    isRevoked:async jid=>{revocationCalls++;return revoke(jid,revocationCalls)},
    assertWitness:async()=>{witnessCalls++;return witness(witnessCalls)},
    clock:()=>overrides.clock?overrides.clock():new Date(now)
  });
  return {
    client,phases,setNow:date=>{now=new Date(date)},
    getNow:()=>new Date(now),
    calls:()=>({searchCalls,proofCalls,revocationCalls,witnessCalls})
  };
}
async function ticket(r,term="竊盜",session=SESSION){
  const out=await r.client.issue(term,session);
  assert.equal(out.items.length,1);
  assert.equal(out.items[0].status,"click_requires_reverification",
    JSON.stringify(out));
  return out.items[0].ticket;
}

test("requires all search, official verifier, revocation and witness dependencies",()=>{
  for(const key of ["search","verifyOfficial","isRevoked","assertWitness"]){
    const options={
      search:async()=>source(),
      verifyOfficial:async()=>null,
      isRevoked:async()=>false,
      assertWitness:async()=>true
    };
    delete options[key];
    assert.throws(()=>makeSyntheticClickRecheck(options),/Missing stage3e dependency/);
  }
});
test("synthetic session must have a permitted shape; never contain an actual session",()=>{
  assert.equal(sessionDigest(SESSION).length,32);
  for(const bad of ["",123,"real_user_session","TEST_SESSION_SYNTHETIC_",
                    "TEST_SESSION_SYNTHETIC_X\nBAD"]){
    assert.throws(()=>sessionDigest(bad),/Synthetic-only session/);
  }
});
test("only synthetic JIDs may be included in a click ticket",()=>{
  assert.equal(syntheticJid(A),A);
  assert.throws(()=>syntheticJid("TPSM,114,台抗,2605,20251231,1"),/Synthetic-only/);
});
test("issue returns opaque ticket only, never the JID or any direct case URL",async()=>{
  const r=fixture();
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.status,"tickets_issued");
  const j=JSON.stringify(out);
  assert.doesNotMatch(j,/data\.aspx/);
  assert.equal(j.includes(A),false);
  assert.equal(j.includes(PRIVATE),false);
  assert.match(out.items[0].ticket,/^[a-f0-9]{48}$/);
  assert.equal(out.items[0].individualLink,false);
  assert.equal(out.fullTextStored,false);
  assert.equal(r.calls().proofCalls,1);
});
test("click performs a SECOND independently-injected official proof",async()=>{
  const r=fixture();
  const t=await ticket(r);
  const out=await r.client.redeem(t,SESSION);
  assert.equal(out.status,"redirect_official");
  assert.equal(out.href,officialUrlFor(A));
  assert.equal(out.verificationMode,"new_official_proof_on_click");
  assert.deepEqual(r.phases,["search","click"]);
  assert.equal(r.calls().proofCalls,2);
  assert.equal(out.fullTextStored,false);
});
test("ticket is one-time: second click goes to generic portal",async()=>{
  const r=fixture();
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).status,"redirect_official");
  const repeated=await r.client.redeem(t,SESSION);
  assert.equal(repeated.status,"portal_only");
  assert.equal(repeated.href,PORTAL_URL);
  assert.equal(JSON.stringify(repeated).includes(A),false);
});
test("concurrent double clicks cannot redeem same ticket twice",async()=>{
  const r=fixture({verifyOfficial:async(jid)=>proof(jid,START)});
  const t=await ticket(r);
  const outcomes=await Promise.all([r.client.redeem(t,SESSION),r.client.redeem(t,SESSION)]);
  assert.equal(outcomes.filter(x=>x.status==="redirect_official").length,1);
  assert.equal(outcomes.filter(x=>x.status==="portal_only").length,1);
});
test("expires after 60 seconds; refuses both link and stale JID",async()=>{
  const r=fixture();
  const t=await ticket(r);
  r.setNow(new Date(START.getTime()+TICKET_LIFETIME_MS));
  const out=await r.client.redeem(t,SESSION);
  assert.equal(out.href,PORTAL_URL);
  assert.equal(out.reason,"expired_or_used");
  assert.equal(JSON.stringify(out).includes(A),false);
});
test("one millisecond before 60-second ticket deadline still permits a NEW click check",async()=>{
  const r=fixture();
  const t=await ticket(r);
  r.setNow(new Date(START.getTime()+TICKET_LIFETIME_MS-1));
  assert.equal((await r.client.redeem(t,SESSION)).status,"redirect_official");
});
test("session mismatch consumes ticket without case disclosure",async()=>{
  const r=fixture();
  const t=await ticket(r);
  const stolen=await r.client.redeem(t,OTHER);
  assert.equal(stolen.href,PORTAL_URL);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
  assert.equal(r.calls().proofCalls,1);
});
test("invalid token never causes official verifier invocation",async()=>{
  const r=fixture();
  assert.equal((await r.client.redeem("NOT_A_TOKEN",SESSION)).href,PORTAL_URL);
  assert.equal(r.calls().proofCalls,0);
});
test("unknown well-formed token returns portal, not a deep link",async()=>{
  const r=fixture();
  assert.equal((await r.client.redeem("f".repeat(48),SESSION)).href,PORTAL_URL);
});
test("disallowed arbitrary queries are blocked before external search",async()=>{
  const r=fixture();
  await assert.rejects(r.client.issue("少年不公開事件某人姓名",SESSION),/predefined synthetic/);
  assert.equal(r.calls().searchCalls,0);
});
test("invalid search result JID is never turned into a ticket",async()=>{
  const r=fixture({search:()=>source("TPSM,114,台抗,2605,20251231,1")});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.status,"portal_only");
  assert.equal(out.items[0].href,PORTAL_URL);
  assert.equal(r.calls().proofCalls,0);
});
test("removed case at initial proof is not issued a ticket",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START,{status:"withdrawn"})});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.items[0].href,PORTAL_URL);
});
test("case removed after ticket issuance is refused on click",async()=>{
  const r=fixture({verifyOfficial:(jid,{phase})=>
    proof(jid,START,{status:phase==="click"?"withdrawn":"public"})});
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("revoked case cannot receive ticket even with an otherwise good official proof",async()=>{
  const r=fixture({isRevoked:()=>true});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.items[0].href,PORTAL_URL);
  assert.equal(r.calls().proofCalls,0);
});
test("revocation between issue and click blocks redirect",async()=>{
  let revoked=false;
  const r=fixture({isRevoked:()=>revoked});
  const t=await ticket(r);
  revoked=true;
  const out=await r.client.redeem(t,SESSION);
  assert.equal(out.href,PORTAL_URL);
});
test("revocation between official click verification and final check blocks redirect",async()=>{
  let stop=false;
  const r=fixture({
    verifyOfficial:(jid,{phase})=>{
      if(phase==="click")stop=true;
      return proof(jid,START);
    },
    isRevoked:()=>stop
  });
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("last-minute revocation also blocks after prior two checks succeeded",async()=>{
  // issue: two checks; click: initial, post-verifier, final = 5 total.
  const r=fixture({isRevoked:(_,n)=>n>=5});
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("witness failure before search prevents a source request",async()=>{
  const r=fixture({assertWitness:()=>{throw Error("private ledger details")}});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.status,"portal_only");
  assert.equal(r.calls().searchCalls,0);
  assert.equal(JSON.stringify(out).includes("private ledger"),false);
});
test("witness failure on click refuses redirect",async()=>{
  let fail=false;
  const r=fixture({assertWitness:()=>{if(fail)throw Error("unavailable");return true}});
  const t=await ticket(r);
  fail=true;
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("witness failure at last check refuses redirect",async()=>{
  // issue: pre + before + after = 3; redeem: before + after + final = 3.
  const r=fixture({assertWitness:n=>{if(n>=6)throw Error("ledger fail");return true}});
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("official proof absent at click refuses even if initially verified",async()=>{
  const r=fixture({verifyOfficial:(jid,{phase})=>phase==="click"?null:proof(jid,START)});
  const t=await ticket(r);
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("source HTTP200 without judgment body never counts as official verification",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START,{officialBodyVisible:false})});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.items[0].href,PORTAL_URL);
});
test("MCP cache masquerading as official page cannot issue ticket",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START,{origin:"mcp_cache"})});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("a search-time proof reused at click cannot justify a redirect",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START)});
  const t=await ticket(r);
  r.setNow(new Date(START.getTime()+1000));
  // Proof is still younger than 5 minutes, but not newly checked on click.
  assert.equal((await r.client.redeem(t,SESSION)).href,PORTAL_URL);
});
test("a newly timestamped proof after clock progresses is acceptable",async()=>{
  const r=fixture();
  const t=await ticket(r);
  r.setNow(new Date(START.getTime()+1000));
  assert.equal((await r.client.redeem(t,SESSION)).status,"redirect_official");
});
test("wrong JID in verification response is refused",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START,{jid:B})});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("untrusted official page hostname is refused on issuance",async()=>{
  const r=fixture({verifyOfficial:jid=>
    proof(jid,START,{finalUrl:"https://judgment.judicial.gov.tw.evil.test/FJUD/data.aspx"})});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("non-adult or not publicly accessible case is refused",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,START,{publicAdultCase:false})});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("search errors return generic portal with zero individual links",async()=>{
  const r=fixture({search:()=>{throw Error("PRIVATE_SERVER_FAILURE")}});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.status,"portal_only");
  assert.equal(out.items[0].href,PORTAL_URL);
  assert.equal(JSON.stringify(out).includes("PRIVATE_SERVER_FAILURE"),false);
});
test("broken search success flag is refused",async()=>{
  const r=fixture({search:()=>({success:false,results:[{jid:A}]})});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("result count over safety cap is rejected before verification",async()=>{
  const r=fixture({search:()=>({success:true,results:Array.from({length:11},()=>({jid:A}))})});
  await assert.rejects(r.client.issue("竊盜",SESSION),/exceed safety bound/);
  assert.equal(r.calls().proofCalls,0);
});
test("duplicate JIDs in source result produce one ticket",async()=>{
  const r=fixture({search:()=>({success:true,results:[{jid:A},{jid:A},{jid:A}]})});
  const out=await r.client.issue("竊盜",SESSION);
  assert.equal(out.items.length,1);
});
test("capacity limit fails to generic portal without exposing unissued JIDs",async()=>{
  let next=0;
  const r=fixture({search:()=>{
    const rows=Array.from({length:10},(_,i)=>({
      jid:"TEST_JID_SYNTHETIC_BATCH_"+String(next+i).padStart(2,"0")
    }));
    next+=10;
    return {success:true,results:rows};
  }});
  const first=await r.client.issue("竊盜",SESSION);
  const second=await r.client.issue("竊盜",SESSION);
  const third=await r.client.issue("竊盜",SESSION);
  assert.equal(first.items.filter(x=>x.ticket).length,10);
  assert.equal(second.items.filter(x=>x.ticket).length,10);
  assert.equal(third.items.filter(x=>x.ticket).length,5);
  assert.equal(third.items.filter(x=>x.href===PORTAL_URL).length,5);
  assert.equal(r.client.stats().pendingTickets,MAX_OUTSTANDING);
});
test("expiring tickets are pruned on a new lookup",async()=>{
  const r=fixture();
  await ticket(r);
  assert.equal(r.client.stats().pendingTickets,1);
  r.setNow(new Date(START.getTime()+TICKET_LIFETIME_MS+1));
  await r.client.issue("竊盜",SESSION);
  assert.equal(r.client.stats().pendingTickets,1);
});
test("stale initial proof older than request cannot issue even when under five minutes",async()=>{
  const r=fixture({verifyOfficial:jid=>
    proof(jid,new Date(START.getTime()-2_000))});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("initially future timestamped proof is rejected",async()=>{
  const r=fixture({verifyOfficial:jid=>proof(jid,new Date(START.getTime()+8_000))});
  assert.equal((await r.client.issue("竊盜",SESSION)).status,"portal_only");
});
test("malformed clock stops before any search",async()=>{
  const r=fixture({clock:()=>new Date("invalid")});
  await assert.rejects(r.client.issue("竊盜",SESSION),/Invalid click-verification clock/);
  assert.equal(r.calls().searchCalls,0);
});
test("no successful output exposes raw source title or body",async()=>{
  const r=fixture();
  const t=await ticket(r);
  const result=await r.client.redeem(t,SESSION);
  assert.equal(JSON.stringify(result).includes(PRIVATE),false);
  assert.equal(JSON.stringify(result).includes('"title"'),false);
  assert.equal(result.fullTextStored,false);
});
test("all decisions are immutable and stats don't leak tickets",async()=>{
  const r=fixture();
  const ticketValue=await ticket(r);
  const a=await r.client.redeem(ticketValue,SESSION);
  assert.equal(Object.isFrozen(a),true);
  const s=r.client.stats();
  assert.equal(Object.isFrozen(s),true);
  assert.equal(JSON.stringify(s).includes(ticketValue),false);
  assert.equal(JSON.stringify(s).includes(A),false);
});
