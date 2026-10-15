"use strict";
/**
 * Stage 3c: MOCK-ONLY daily JList -> JDoc -> isolated ledger/D1-shaped metadata.
 *
 * Purpose: verify safe orchestration; this is NOT a production API client,
 * storage pipeline, withdrawal-completion certificate, or public lookup.
 * Inputs must be synthetic fixtures and intentionally cannot ingest real JIDs.
 */
const {fixtureJid}=require("../../services/v2.7-judgment/revocation-ledger.cjs");
const {REQUIRED_PURGE}=require("../../services/v2.7-judgment/d1-metadata-adapter.cjs");

const MAX_CASES=20;
function expectedChangeDate(now){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error("Invalid test clock");
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(now);
  const val=key=>parts.find(p=>p.type===key)?.value;
  const year=Number(val("year")),month=Number(val("month")),day=Number(val("day"));
  const d=new Date(Date.UTC(year,month-1,day));
  d.setUTCDate(d.getUTCDate()-7);
  return d.toISOString().slice(0,10);
}
function scrubMetadata(plan,revision){
  if(plan.kind!=="upsert"||plan.publishable!==false)throw Error("Not a private upsert");
  const r=plan.record||{};
  fixtureJid(r.jid);
  if(!Number.isSafeInteger(revision)||revision<1)throw Error("Bad mock revision");
  // The existing metadata adapter forbids judgment bodies, file previews,
  // PDF links, attachments, and any non-synthetic title.
  if(!String(r.title||"").includes("合成"))throw Error("Only synthetic title permitted");
  return Object.freeze({
    jid:r.jid,year:r.year,caseType:r.caseType,caseNo:r.caseNo,
    judgmentDate:r.judgmentDate,title:r.title,revision
  });
}
function makeSyntheticDeltaRunner({
  client,guarded,operational,ledger,trustedMinimumRevision,
  advanceWitness,nextRevision,clock=()=>new Date()
}={}){
  for(const [name,fn] of Object.entries({
    getChanges:client?.getChanges,getJudgment:client?.getJudgment,
    putPrivate:guarded?.putPrivate,blockPublicAccess:operational?.blockPublicAccess,
    purgeEverywhere:operational?.purgeEverywhere,
    liveRowsPurged:operational?.liveRowsPurged,
    tombstone:ledger?.tombstone,assertHealthy:ledger?.assertHealthy,
    trustedMinimumRevision,advanceWitness,nextRevision,clock
  })){
    if(typeof fn!=="function")throw Error("Stage3c dependency missing: "+name);
  }
  async function runOneMockCycle(){
    const now=clock();
    // Fail-closed before doing any source request or metadata mutation.
    const before=await trustedMinimumRevision();
    await ledger.assertHealthy(before);
    const dated=expectedChangeDate(now);
    const changes=await client.getChanges();
    if(!Array.isArray(changes)||changes.length>MAX_CASES)
      throw Error("Unsafe JList response size for mock-only stage 3c");
    if(changes.some(x=>!x||x.date!==dated))
      throw Error("JList date differs from official T-7 window; stop before mutation");
    const jids=changes.map(x=>fixtureJid(x.jid));
    if(new Set(jids).size!==jids.length)
      throw Error("Unexpected duplicate JID after official client deduplication");
    // Preflight all responses before mutating either store. This bounds the
    // mock batch; it is not suitable for bulk ingestion of real case bodies.
    const plans=[];
    for(const jid of jids){
      const plan=await client.getJudgment(jid);
      if(!plan||plan.publishable!==false||plan.jid!==jid||
         !["upsert","withdraw"].includes(plan.kind))
        throw Error("Unsafe JDoc mutation plan");
      plans.push(plan);
    }
    const result={
      only_synthetic:true,expected_source_date:dated,changes_read:plans.length,
      stored_private:0,revoked_live_rows:0,
      withdrawal_fully_verified:false,public_search_enabled:false,
      source_api_called_with_actual_credentials:false,
      court_bodies_written_to_reports:false
    };
    // Priority to privacy removal before replacement. Ledger tombstone is
    // independent of restored operational metadata; witness is injected mock.
    for(const plan of plans.filter(x=>x.kind==="withdraw")){
      const current=await trustedMinimumRevision();
      await ledger.assertHealthy(current);
      const tombstone=await ledger.tombstone(plan.jid,current,"not_public");
      await advanceWitness(tombstone.ledgerRevision);
      const confirmed=await trustedMinimumRevision();
      if(confirmed<tombstone.ledgerRevision)
        throw Error("Witness did not advance after revocation; stay closed");
      await ledger.assertHealthy(confirmed);
      await operational.blockPublicAccess(plan.jid);
      await operational.purgeEverywhere(plan.jid,[...REQUIRED_PURGE]);
      if(await operational.liveRowsPurged(plan.jid)!==true)
        throw Error("Live revocation incomplete; halt ingestion");
      result.revoked_live_rows++;
      // Time Travel/old backups/caches are NOT verified, so never report
      // full purge, unfreeze access or allow publication.
    }
    for(const plan of plans.filter(x=>x.kind==="upsert")){
      const revision=await nextRevision();
      await guarded.putPrivate(scrubMetadata(plan,revision));
      result.stored_private++;
    }
    return Object.freeze(result);
  }
  return Object.freeze({runOneMockCycle});
}
module.exports={makeSyntheticDeltaRunner,expectedChangeDate,scrubMetadata,MAX_CASES};
