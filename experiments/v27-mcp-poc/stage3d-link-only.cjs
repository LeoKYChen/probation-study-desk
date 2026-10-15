"use strict";
/**
 * v2.7 stage3d LINK-ONLY pilot.
 * Mock ONLY: only accepts TEST_JID_SYNTHETIC_* identifiers; no real cases.
 * Does not perform network requests, store court documents, persist results,
 * publish an endpoint, or authenticate to any real judicial service.
 *
 * Search results must NEVER be treated as independent publication evidence.
 * Verification callbacks are injected synthetic substitutes for a future
 * separately authorised, trusted, official-source verifier.
 */
const PORTAL_URL="https://judgment.judicial.gov.tw/FJUD/";
const OFFICIAL_HOST="judgment.judicial.gov.tw";
const MAX_AGE_MS=5*60*1000;
const MAX_RESULTS=10;
const TEST_JID=/^TEST_JID_SYNTHETIC_[A-Z0-9_-]{1,45}$/;
const EXAMPLE_TERMS=new Set(["竊盜","詐欺","偽造文書"]);
const LINK_LABEL="前往司法院官方網站重新核對公開裁判";
const PORTAL_LABEL="前往司法院裁判書系統自行查詢";
const NOTICE="這是離線合成驗證介面，不提供裁判書全文、摘要或法律見解。"+
 "官網連結僅表示指定時點曾獨立確認頁面公開，不能保證裁判已確定或此刻仍可取得。";

function assertSyntheticId(value){
  if(typeof value!=="string"||!TEST_JID.test(value))
    throw Error("Link-only pilot accepts synthetic identifiers only");
  return value;
}
function officialUrlFor(jid){
  const id=assertSyntheticId(jid);
  const target=new URL("https://judgment.judicial.gov.tw/FJUD/data.aspx");
  target.searchParams.set("ty","JD");
  target.searchParams.set("id",id);
  return target.href;
}
function isExactOfficialPage(candidateUrl,jid){
  if(typeof candidateUrl!=="string")return false;
  try{
    assertSyntheticId(jid);
    const u=new URL(candidateUrl);
    if(u.protocol!=="https:"||u.hostname!==OFFICIAL_HOST||u.port||
       u.username||u.password||u.hash)return false;
    if(u.pathname!=="/FJUD/data.aspx"&&u.pathname!=="/FJUD/printData.aspx")return false;
    const entries=[...u.searchParams.entries()];
    const count=entries.length;
    if(u.pathname==="/FJUD/data.aspx"){
      return count===2&&u.searchParams.getAll("id").length===1&&
        u.searchParams.get("id")===jid&&u.searchParams.getAll("ty").length===1&&
        u.searchParams.get("ty")==="JD";
    }
    return count===1&&u.searchParams.getAll("id").length===1&&
      u.searchParams.get("id")===jid;
  }catch{return false}
}
function freshOfficialProof(proof,jid,now){
  if(!proof||typeof proof!=="object"||Array.isArray(proof))return false;
  if(proof.status!=="public"||proof.origin!=="independently_checked_official_page"||
     proof.jid!==jid||proof.publicAdultCase!==true||
     proof.officialCourtConfirmed!==true||proof.officialBodyVisible!==true||
     proof.officialJidConfirmed!==true||
     !isExactOfficialPage(proof.finalUrl,jid))return false;
  const t=Date.parse(proof.checkedAt);
  const ms=now.getTime()-t;
  return Number.isFinite(t)&&ms>=0&&ms<=MAX_AGE_MS;
}
function pendingResult(reason="not_confirmed"){
  // Never include the queried JID or third-party title in unverified results.
  return Object.freeze({
    state:"verification_pending",reason,
    href:PORTAL_URL,label:PORTAL_LABEL,
    fullTextStored:false,verifiedNow:false
  });
}
function linkResult(jid,proof){
  return Object.freeze({
    state:"official_page_confirmed",href:officialUrlFor(jid),label:LINK_LABEL,
    checkedAt:proof.checkedAt,
    fullTextStored:false,verifiedNow:true
  });
}
function makeSyntheticLinkOnlyPilot({search,verifyOfficial,isRevoked,assertWitness,clock=()=>new Date()}={}){
  for(const [name,fn] of Object.entries({search,verifyOfficial,isRevoked,assertWitness,clock})){
    if(typeof fn!=="function")throw Error("Required private service dependency: "+name);
  }
  async function lookup(term){
    // Selected synthetic demonstration topics only: no real case details.
    if(typeof term!=="string"||!EXAMPLE_TERMS.has(term))
      throw Error("Only three predefined synthetic demo topics may be searched");
    // Fail closed if the independent revocation witness is unavailable.
    await assertWitness();
    const date=clock();
    if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
      throw Error("Invalid verification clock");
    let response;
    try{response=await search(term)}catch{return Object.freeze({
      status:"unavailable",items:[],notice:NOTICE,fullTextStored:false
    })}
    if(!response||response.success!==true||!Array.isArray(response.results))
      return Object.freeze({status:"unavailable",items:[],notice:NOTICE,fullTextStored:false});
    if(response.results.length>MAX_RESULTS)
      throw Error("Synthetic source result limit exceeded");
    const items=[];
    for(const candidate of response.results){
      let jid;
      try{jid=assertSyntheticId(candidate?.jid)}
      catch{items.push(pendingResult("invalid_identifier"));continue}
      // Never use a supplied sourceUrl, HTML, summary or snippet as evidence.
      try{
        await assertWitness();
        if(await isRevoked(jid)){
          items.push(pendingResult("withdrawn_or_nonpublic"));
          continue;
        }
        const proof=await verifyOfficial(jid);
        if(proof?.status==="withdrawn"||proof?.status==="not_public"){
          items.push(pendingResult("withdrawn_or_nonpublic"));
          continue;
        }
        if(!freshOfficialProof(proof,jid,clock())){
          items.push(pendingResult("not_independently_confirmed"));
          continue;
        }
        // Recheck the ledger after the await: withdrawal during a slow
        // verification must not leave a link approved for display.
        await assertWitness();
        if(await isRevoked(jid)){
          items.push(pendingResult("withdrawn_or_nonpublic"));
          continue;
        }
        items.push(linkResult(jid,proof));
      }catch{
        // Read errors, timeouts, removed pages and ledger failure never
        // produce a case-specific link. Deliberately no raw error logging.
        items.push(pendingResult("source_or_revocation_check_unavailable"));
      }
    }
    return Object.freeze({
      status:items.some(x=>x.state==="official_page_confirmed")?"limited_results":"no_confirmed_pages",
      items:Object.freeze(items),
      notice:NOTICE,fullTextStored:false,persistentCacheUsed:false
    });
  }
  return Object.freeze({lookup});
}
module.exports={
  PORTAL_URL,NOTICE,MAX_AGE_MS,MAX_RESULTS,
  officialUrlFor,isExactOfficialPage,freshOfficialProof,
  makeSyntheticLinkOnlyPilot
};
