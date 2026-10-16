"use strict";
/**
 * v2.7 stage 3e: click-time official re-verification (SYNTHETIC ONLY).
 *
 * This module has NO HTTP endpoint, no persistent storage, no real court data,
 * no credential handling, and no live judicial.gov.tw verification provider.
 *
 * A ticket is an opaque, single-use, session-bound secret. No individual
 * court URL is returned before a SECOND independent proof at click-time.
 */
const {randomBytes,createHash,timingSafeEqual}=require("node:crypto");
const {
  PORTAL_URL,MAX_RESULTS,officialUrlFor,freshOfficialProof
}=require("./stage3d-link-only.cjs");

const JID_RE=/^TEST_JID_SYNTHETIC_[A-Z0-9_-]{1,45}$/;
const SESSION_RE=/^TEST_SESSION_SYNTHETIC_[A-Z0-9_-]{4,36}$/;
const TICKET_RE=/^[0-9a-f]{48}$/;
const TOPICS=new Set(["竊盜","詐欺","偽造文書"]);
const TICKET_LIFETIME_MS=60*1000;
const MAX_OUTSTANDING=25;
const VERIFY_TIMEOUT_MS=3000;
const LABEL="再次查證後前往司法院裁判書官方來源";
const PORTAL_LABEL="前往司法院裁判書官方查詢入口";
const LIMITATION="離線合成測試：查核結果不保證點擊後永久可取得。未驗證公開狀態時，只能使用官方通用查詢入口。";

function sessionDigest(session){
  if(typeof session!=="string"||!SESSION_RE.test(session))
    throw Error("Synthetic-only session identifier required");
  return createHash("sha256").update(session,"utf8").digest();
}
function syntheticJid(jid){
  if(typeof jid!=="string"||!JID_RE.test(jid))
    throw Error("Synthetic-only court ID required");
  return jid;
}
function clockDate(clock){
  const date=clock();
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
    throw Error("Invalid click-verification clock");
  return date;
}
function portal(reason="verification_unavailable"){
  const permitted=new Set(["verification_unavailable","expired_or_used","revoked_or_nonpublic","capacity_limited"]);
  return Object.freeze({
    status:"portal_only",reason:permitted.has(reason)?reason:"verification_unavailable",
    href:PORTAL_URL,label:PORTAL_LABEL,
    fullTextStored:false,individualLink:false
  });
}
function timeoutPromise(operation,timeoutMs){
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error("SOURCE_CHECK_TIMEOUT")),timeoutMs);
    })
  ]).finally(()=>clearTimeout(timer));
}
function makeSyntheticClickRecheck({
  search,verifyOfficial,isRevoked,assertWitness,clock=()=>new Date()
}={}){
  for(const [key,func] of Object.entries({search,verifyOfficial,isRevoked,assertWitness,clock})){
    if(typeof func!=="function")throw Error("Missing stage3e dependency: "+key);
  }
  // Memory only. 25 opaque tickets is a test bound, not a production rate limit.
  const tickets=new Map();
  function prune(date){
    for(const [token,record] of tickets){
      if(record.expiresAt<=date.getTime())tickets.delete(token);
    }
  }
  async function trustworthyAt(jid,phase,notBefore){
    // Unavailable witness or revocation ledger MUST fail closed.
    await timeoutPromise(()=>assertWitness(),VERIFY_TIMEOUT_MS);
    if(await timeoutPromise(()=>isRevoked(jid),VERIFY_TIMEOUT_MS))return false;
    const proof=await timeoutPromise(()=>verifyOfficial(jid,{phase}),VERIFY_TIMEOUT_MS);
    const checked=clockDate(clock);
    if(!freshOfficialProof(proof,jid,checked))return false;
    // A cached initial proof cannot satisfy a subsequent CLICK check.
    const verifiedAt=Date.parse(proof.checkedAt);
    if(!Number.isFinite(verifiedAt)||verifiedAt<notBefore.getTime())return false;
    await timeoutPromise(()=>assertWitness(),VERIFY_TIMEOUT_MS);
    if(await timeoutPromise(()=>isRevoked(jid),VERIFY_TIMEOUT_MS))return false;
    return true;
  }
  async function issue(term,session){
    const digest=sessionDigest(session);
    if(typeof term!=="string"||!TOPICS.has(term))
      throw Error("Only predefined synthetic demonstration search topics permitted");
    const at=clockDate(clock);
    prune(at);
    try{await timeoutPromise(()=>assertWitness(),VERIFY_TIMEOUT_MS)}
    catch{return Object.freeze({status:"portal_only",items:Object.freeze([portal()]),
                                fullTextStored:false})}
    let found;
    try{found=await timeoutPromise(()=>search(term),VERIFY_TIMEOUT_MS)}
    catch{return Object.freeze({status:"portal_only",items:Object.freeze([portal()]),
                                fullTextStored:false})}
    if(!found||found.success!==true||!Array.isArray(found.results))
      return Object.freeze({status:"portal_only",items:Object.freeze([portal()]),fullTextStored:false});
    if(found.results.length>MAX_RESULTS)
      throw Error("Synthetic source results exceed safety bound");
    const items=[];
    const seen=new Set();
    for(const candidate of found.results){
      let jid;
      try{jid=syntheticJid(candidate?.jid)}
      catch{items.push(portal());continue}
      if(seen.has(jid))continue;
      seen.add(jid);
      if(tickets.size>=MAX_OUTSTANDING){
        items.push(portal("capacity_limited"));
        continue;
      }
      let verified=false;
      try{verified=await trustworthyAt(jid,"search",at)}
      catch{verified=false}
      if(!verified){
        items.push(portal());
        continue;
      }
      let token;
      do{token=randomBytes(24).toString("hex")}while(tickets.has(token));
      const createdAt=clockDate(clock).getTime();
      tickets.set(token,{jid,sessionDigest:digest,
        expiresAt:createdAt+TICKET_LIFETIME_MS});
      // No deep link, JID, title, snippet, raw search metadata, or body.
      items.push(Object.freeze({
        status:"click_requires_reverification",ticket:token,
        label:LABEL,individualLink:false,fullTextStored:false
      }));
    }
    return Object.freeze({
      status:items.some(x=>x.status==="click_requires_reverification")?"tickets_issued":"portal_only",
      items:Object.freeze(items),
      fullTextStored:false,notice:LIMITATION
    });
  }
  async function redeem(ticket,session){
    // No network service or redirect implemented. This function returns a
    // sanitized redirect *decision* to a mock caller.
    const digest=sessionDigest(session);
    if(typeof ticket!=="string"||!TICKET_RE.test(ticket))
      return portal("expired_or_used");
    const record=tickets.get(ticket);
    // Consume BEFORE the first async step: simultaneous clicks cannot replay.
    tickets.delete(ticket);
    if(!record)return portal("expired_or_used");
    const at=clockDate(clock);
    if(at.getTime()>=record.expiresAt)return portal("expired_or_used");
    if(!timingSafeEqual(record.sessionDigest,digest))
      return portal("verification_unavailable");
    let verified=false;
    try{verified=await trustworthyAt(record.jid,"click",at)}
    catch{verified=false}
    if(!verified)return portal();
    // A last fast fail-closed check immediately before returning a decision.
    // There is still an unavoidable race AFTER return/redirect: NOT a
    // production guarantee of permanent public accessibility.
    try{
      await timeoutPromise(()=>assertWitness(),VERIFY_TIMEOUT_MS);
      if(await timeoutPromise(()=>isRevoked(record.jid),VERIFY_TIMEOUT_MS))
        return portal("revoked_or_nonpublic");
    }catch{return portal()}
    return Object.freeze({
      status:"redirect_official",href:officialUrlFor(record.jid),
      label:"前往司法院官方網站核對",
      individualLink:true,fullTextStored:false,
      verificationMode:"new_official_proof_on_click"
    });
  }
  function stats(){
    // For test introspection ONLY; no JID/ticket disclosure.
    return Object.freeze({pendingTickets:tickets.size,
      dataPersistence:"process_memory_only",publicEndpoint:false});
  }
  return Object.freeze({issue,redeem,stats});
}
module.exports={
  makeSyntheticClickRecheck,sessionDigest,syntheticJid,portal,
  TICKET_LIFETIME_MS,MAX_OUTSTANDING,VERIFY_TIMEOUT_MS
};
