"use strict";
/**
 * Fail-closed read/write facade over the private metadata adapter.
 * A future Worker MUST expose ONLY this facade, not a raw D1 binding.
 * Even when a backup restores deleted operational rows, independent
 * ledger tombstones block access before reconciliation.
 */
function makeGuardedMetadataService({operational,ledger,trustedMinimumRevision}={}){
  if(typeof trustedMinimumRevision!=="function")
    throw Error("Independent witness provider required");
  if(!operational||!ledger)throw Error("Both isolated stores required");
  async function minimum(){
    const value=await trustedMinimumRevision();
    if(!Number.isSafeInteger(value)||value<1)
      throw Error("Trusted ledger witness unavailable: fail closed");
    await ledger.assertHealthy(value);
    return value;
  }
  async function getPrivateMetadata(jid){
    const rev=await minimum();
    if(await ledger.isRevoked(jid,rev))return null;
    return await operational.getPrivateMetadata(jid);
  }
  async function putPrivate(record){
    if(!record?.jid)throw Error("Missing judgment record");
    const rev=await minimum();
    if(await ledger.isRevoked(record.jid,rev))
      throw Error("JID independently revoked; ingestion forbidden");
    await operational.blockPublicAccess(record.jid);
    return await operational.putPrivate(record);
  }
  async function publicLookup(){
    // v2.7.1c never publishes records, even after a clean reconciliation.
    return [];
  }
  return Object.freeze({getPrivateMetadata,putPrivate,publicLookup});
}

/**
 * Restored data is never returned directly; quarantine first, purge all
 * ledger-listed tombstones, and verify *live rows* only.
 * Historical D1 Time Travel and off-DB caches remain UNVERIFIED, so the
 * service is never automatically unfrozen or opened to the public.
 */
async function reconcileAfterRestore({operational,ledger,trustedMinimumRevision}={}){
  if(!operational||!ledger||typeof trustedMinimumRevision!=="function")
    throw Error("Cannot reconcile without both isolated stores and independent witness");
  const minimum=await trustedMinimumRevision();
  if(!Number.isSafeInteger(minimum)||minimum<1)
    throw Error("No trusted ledger version: quarantine maintained");
  const frozenRevision=await ledger.freeze(minimum);
  const ids=await ledger.listRevoked(frozenRevision);
  let checked=0;
  for(const jid of ids){
    await operational.blockPublicAccess(jid);
    await operational.purgeEverywhere(jid,[
      "primaryRecord","documentBody","publicSearchIndex","summaries",
      "embeddings","edgeCache","snapshots","backupCopies"
    ]);
    if(await operational.liveRowsPurged(jid)!==true)
      throw Error("Live cleanup incomplete: stop restore and stay frozen");
    checked++;
  }
  const auditedRevision=await ledger.auditReconcile(frozenRevision,checked);
  return Object.freeze({
    quarantine:true,openedToPublic:false,
    liveRowsChecked:checked,historyErased:false,
    lastLedgerRevision:auditedRevision,
    requiresBackupAndCacheVerification:true,
    warning:"Only current data checked; D1 Time Travel/backup erasure not verified"
  });
}
module.exports={makeGuardedMetadataService,reconcileAfterRestore};
