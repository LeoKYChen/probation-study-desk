"use strict";
/**
 * Storage adapter contract for future private D1/R2/Worker implementation.
 * This module itself has NO storage and NO network; it never publishes content.
 *
 * Required adapter methods:
 * - blockPublicAccess(jid)
 * - purgeEverywhere(jid, requiredTargets)
 * - verifyPurged(jid, requiredTargets): true only if ALL targets absent
 * - putPrivate(record)
 */
async function applyPrivateMutation(plan,adapter){
  if(!plan||plan.publishable!==false||!["withdraw","upsert"].includes(plan.kind))
    throw Error("Non-private or unknown judgment mutation blocked");
  for(const name of ["blockPublicAccess","purgeEverywhere","verifyPurged","putPrivate"]){
    if(typeof adapter?.[name]!=="function")throw Error("Incomplete private storage adapter: "+name);
  }
  // Block first, including for upsert: public views may be stale/incorrect.
  await adapter.blockPublicAccess(plan.jid);
  if(plan.kind==="withdraw"){
    await adapter.purgeEverywhere(plan.jid,[...plan.purgeTargets]);
    const cleared=await adapter.verifyPurged(plan.jid,[...plan.purgeTargets]);
    if(cleared!==true)throw Error("Withdrawal not fully verified; keep public access blocked");
    return Object.freeze({kind:"withdraw",jid:plan.jid,blocked:true,purged:true});
  }
  await adapter.putPrivate(plan.record);
  return Object.freeze({kind:"upsert",jid:plan.jid,blocked:true,storedPrivate:true});
}
module.exports={applyPrivateMutation};
