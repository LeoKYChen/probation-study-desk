"use strict";
/**
 * Isolated, synthetic-only D1-shaped revocation ledger.
 * MUST be bound to a DIFFERENT D1 database than the restored metadata DB.
 * It is not immutable storage; external minimumRevision witness is mandatory
 * for detecting ledger rollback. No endpoint exposes these functions.
 */
const {safeJid}=require("./jdoc-model.cjs");
function fixtureJid(raw){
  const jid=safeJid(raw);
  if(!/^TEST_JID_SYNTHETIC_[A-Za-z0-9_-]+$/.test(jid))
    throw Error("Revocation pilot only permits synthetic JIDs");
  return jid;
}
function makeRevocationLedger(db,{clock=()=>new Date()}={}){
  if(typeof db?.prepare!=="function"||typeof db?.batch!=="function")
    throw Error("Requires separate D1-shaped ledger binding");
  if(typeof clock!=="function")throw Error("Invalid clock");
  const time=()=>clock().toISOString();
  const stmt=(sql,...params)=>db.prepare(sql).bind(...params);
  async function assertHealthy(minimumRevision){
    if(!Number.isSafeInteger(minimumRevision)||minimumRevision<1)
      throw Error("Independent minimum ledger revision witness required");
    const row=await stmt("SELECT revision,mode FROM ledger_control WHERE id=1").first();
    if(!row||!Number.isSafeInteger(Number(row.revision))||
       row.mode!=="frozen"||Number(row.revision)<minimumRevision)
      throw Error("Revocation ledger missing, rolled back, or not frozen");
    return Number(row.revision);
  }
  async function freeze(minimumRevision){
    const old=await assertHealthy(minimumRevision);
    await db.batch([
      stmt("UPDATE ledger_control SET revision=revision+1,mode='frozen',modified_at=? WHERE id=1",time()),
      stmt("INSERT INTO ledger_audit(event_type,jid,note,occurred_at) VALUES('freeze',NULL,?,?)",
        "pre-restoration quarantine; no public access",time())
    ]);
    return await assertHealthy(old+1);
  }
  async function tombstone(rawJid,minimumRevision,reason="withdrawn"){
    const jid=fixtureJid(rawJid);
    if(!["withdrawn","not_public","legal_removal"].includes(reason))
      throw Error("Unknown withdrawal reason");
    await assertHealthy(minimumRevision);
    await db.batch([
      stmt("INSERT INTO judgment_tombstones(jid,reason,revoked_at) VALUES(?,?,?) ON CONFLICT(jid) DO NOTHING",
        jid,reason,time()),
      stmt("UPDATE ledger_control SET revision=revision+1,modified_at=? WHERE id=1",time()),
      stmt("INSERT INTO ledger_audit(event_type,jid,note,occurred_at) VALUES('tombstone',?,?,?)",
        jid,reason,time())
    ]);
    return {jid,ledgerRevision:await assertHealthy(minimumRevision),quarantined:true};
  }
  async function isRevoked(rawJid,minimumRevision){
    const jid=fixtureJid(rawJid);
    await assertHealthy(minimumRevision);
    return Boolean(await stmt("SELECT jid FROM judgment_tombstones WHERE jid=?",jid).first());
  }
  async function listRevoked(minimumRevision){
    await assertHealthy(minimumRevision);
    const result=await stmt("SELECT jid FROM judgment_tombstones ORDER BY jid").all();
    if(!result||!Array.isArray(result.results))
      throw Error("Revocation ledger list unavailable");
    return result.results.map(x=>fixtureJid(x.jid));
  }
  async function auditReconcile(minimumRevision,scanned){
    await assertHealthy(minimumRevision);
    if(!Number.isSafeInteger(scanned)||scanned<0)throw Error("Invalid reconciliation total");
    await db.batch([
      stmt("UPDATE ledger_control SET revision=revision+1,modified_at=? WHERE id=1",time()),
      stmt("INSERT INTO ledger_audit(event_type,jid,note,occurred_at) VALUES('reconcile',NULL,?,?)",
        "scanned synthetic tombstones: "+scanned,time())
    ]);
    return await assertHealthy(minimumRevision);
  }
  return Object.freeze({assertHealthy,freeze,tombstone,isRevoked,listRevoked,auditReconcile});
}
module.exports={makeRevocationLedger,fixtureJid};
