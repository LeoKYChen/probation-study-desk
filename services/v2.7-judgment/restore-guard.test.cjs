"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const {DatabaseSync}=require("node:sqlite");
const {makeD1MetadataAdapter}=require("./d1-metadata-adapter.cjs");
const {makeRevocationLedger}=require("./revocation-ledger.cjs");
const {makeGuardedMetadataService,reconcileAfterRestore}=require("./restore-guard.cjs");
const JID="TEST_JID_SYNTHETIC_RESTORED";
const OTHER="TEST_JID_SYNTHETIC_OTHER";
const now=()=>new Date("2026-10-15T05:00:00.000Z");
function dbFixture(migration){
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(fs.readFileSync(path.join(__dirname,"migrations",migration),"utf8"));
  const d1={
    prepare(sql){return{bind(...args){return{
      async first(){return db.prepare(sql).get(...args)??null},
      async all(){return{results:db.prepare(sql).all(...args)}},
      async run(){return db.prepare(sql).run(...args)}
    }}}},
    async batch(queries){
      db.exec("BEGIN IMMEDIATE");
      try{
        for(const q of queries)await q.run();
        db.exec("COMMIT");
      }catch(e){db.exec("ROLLBACK");throw e}
    }
  };
  return {db,d1};
}
function rig(){
  const live=dbFixture("0001_private_metadata.sql");
  const audit=dbFixture("0002_separate_revocation_ledger.sql");
  const operational=makeD1MetadataAdapter(live.d1,{clock:now});
  const ledger=makeRevocationLedger(audit.d1,{clock:now});
  let expected=1; // out-of-band monotonic witness, NOT backed up with either DB
  const trustedMinimumRevision=()=>expected;
  const setExpected=x=>{expected=x};
  const guarded=makeGuardedMetadataService({operational,ledger,trustedMinimumRevision});
  const close=()=>{live.db.close();audit.db.close()};
  return {live,audit,operational,ledger,guarded,setExpected,trustedMinimumRevision,close};
}
const synth=(jid=JID)=>({jid,year:"999",caseType:"合成",caseNo:"001",
  judgmentDate:"20990101",title:"合成還原測試裁判",revision:1});
test("revoke ledger is independent of operational restore-state DB",async()=>{
  const r=rig();
  assert.notEqual(r.live.db,r.audit.db);
  await r.guarded.putPrivate(synth());
  assert.notEqual(await r.guarded.getPrivateMetadata(JID),null);
  const receipt=await r.ledger.tombstone(JID,1,"not_public");
  r.setExpected(receipt.ledgerRevision);
  // Restored operational DB still contains a pre-withdrawal row.
  assert.notEqual(await r.operational.getPrivateMetadata(JID),null);
  assert.equal(await r.guarded.getPrivateMetadata(JID),null);
  await assert.rejects(r.guarded.putPrivate(synth()),/independently revoked/);
  r.close();
});
test("freeze first then reconcile restored live rows, never opens public access",async()=>{
  const r=rig();
  await r.guarded.putPrivate(synth());
  const receipt=await r.ledger.tombstone(JID,1);
  r.setExpected(receipt.ledgerRevision);
  const result=await reconcileAfterRestore(r);
  assert.equal(result.quarantine,true);
  assert.equal(result.openedToPublic,false);
  assert.equal(result.liveRowsChecked,1);
  assert.equal(result.historyErased,false);
  assert.equal(result.requiresBackupAndCacheVerification,true);
  assert.equal(await r.operational.liveRowsPurged(JID),true);
  assert.equal(await r.guarded.getPrivateMetadata(JID),null);
  assert.deepEqual(await r.guarded.publicLookup(),[]);
  const events=r.audit.db.prepare("SELECT event_type FROM ledger_audit ORDER BY seq").all().map(x=>x.event_type);
  assert.deepEqual(events,["tombstone","freeze","reconcile"]);
  r.close();
});
test("two tombstones purge separately; unaffected synthetic record remains private",async()=>{
  const r=rig();
  await r.guarded.putPrivate(synth(JID));
  await r.guarded.putPrivate(synth(OTHER));
  const receipt=await r.ledger.tombstone(JID,1);
  r.setExpected(receipt.ledgerRevision);
  const result=await reconcileAfterRestore(r);
  assert.equal(result.liveRowsChecked,1);
  assert.equal(await r.guarded.getPrivateMetadata(JID),null);
  assert.notEqual(await r.guarded.getPrivateMetadata(OTHER),null);
  assert.deepEqual(await r.guarded.publicLookup(),[]);
  r.close();
});
test("if independent ledger falls behind trusted witness, all private lookups fail closed",async()=>{
  const r=rig();
  await r.guarded.putPrivate(synth());
  r.setExpected(3); // witness in separate deployment config knows newer revision
  await assert.rejects(r.guarded.getPrivateMetadata(JID),/rolled back/);
  await assert.rejects(r.guarded.putPrivate(synth()),/rolled back/);
  await assert.rejects(reconcileAfterRestore(r),/rolled back/);
  r.close();
});
test("ledger unavailable prevents reads and writes, even if operational DB is healthy",async()=>{
  const r=rig();
  await r.guarded.putPrivate(synth());
  const offline={
    assertHealthy:async()=>{throw Error("ledger network unavailable")},
    isRevoked:async()=>false
  };
  const svc=makeGuardedMetadataService({
    operational:r.operational,ledger:offline,trustedMinimumRevision:()=>1
  });
  await assert.rejects(svc.getPrivateMetadata(JID),/ledger network unavailable/);
  await assert.rejects(svc.putPrivate(synth()),/ledger network unavailable/);
  assert.deepEqual(await svc.publicLookup(),[]);
  r.close();
});
test("missing independent revision witness prevents all access and reconciliation",async()=>{
  const r=rig();
  const svc=makeGuardedMetadataService({
    operational:r.operational,ledger:r.ledger,trustedMinimumRevision:()=>undefined
  });
  await assert.rejects(svc.getPrivateMetadata(JID),/witness unavailable/);
  await assert.rejects(svc.putPrivate(synth()),/witness unavailable/);
  await assert.rejects(reconcileAfterRestore({
    operational:r.operational,ledger:r.ledger,trustedMinimumRevision:()=>undefined
  }),/No trusted ledger/);
  r.close();
});
test("restored revoked JID cannot be reimported even after reconcile",async()=>{
  const r=rig();
  await r.guarded.putPrivate(synth());
  const receipt=await r.ledger.tombstone(JID,1);
  r.setExpected(receipt.ledgerRevision);
  await reconcileAfterRestore(r);
  await assert.rejects(r.guarded.putPrivate({...synth(),revision:500}),/independently revoked/);
  r.close();
});
test("ledger never accepts actual case identifiers or invalid reasons",async()=>{
  const r=rig();
  await assert.rejects(r.ledger.tombstone("TPED,115,訴,123,20260101",1),/synthetic JIDs/);
  await assert.rejects(r.ledger.tombstone(JID,1,"any"),/Unknown withdrawal/);
  r.close();
});
test("ledger tombstone persists and cannot be removed by exposed API",async()=>{
  const r=rig();
  const receipt=await r.ledger.tombstone(JID,1);
  r.setExpected(receipt.ledgerRevision);
  assert.equal(await r.ledger.isRevoked(JID,receipt.ledgerRevision),true);
  assert.deepEqual(await r.ledger.listRevoked(receipt.ledgerRevision),[JID]);
  assert.equal(Object.hasOwn(r.ledger,"removeTombstone"),false);
  r.close();
});
test("malformed or incomplete ledger schema fails closed",async()=>{
  const r=rig();
  r.audit.db.exec("DROP TABLE ledger_control");
  await assert.rejects(r.guarded.getPrivateMetadata(JID));
  await assert.rejects(reconcileAfterRestore(r));
  r.close();
});
