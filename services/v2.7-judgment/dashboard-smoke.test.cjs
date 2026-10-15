"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {DatabaseSync}=require("node:sqlite");
const fs=require("node:fs");
const path=require("node:path");
const md=fs.readFileSync(path.join(__dirname,"remote/dashboard-metadata-once.sql"),"utf8");
const ld=fs.readFileSync(path.join(__dirname,"remote/dashboard-ledger-once.sql"),"utf8");
test("one-paste metadata console SQL creates 5 tables with one blocked fake court record",()=>{
 const db=new DatabaseSync(":memory:");
 db.exec(md);
 const meta=db.prepare("SELECT count(*) AS n FROM judgment_metadata").get();
 const gated=db.prepare("SELECT count(*) AS n FROM judgment_access WHERE state='blocked'").get();
 assert.equal(meta.n,1);assert.equal(gated.n,1);
 assert.equal(db.prepare("SELECT title FROM judgment_metadata").get().title,"合成遠端測試紀錄");
 for(const table of ["judgment_search_tokens","judgment_vectors","judgment_summaries"])
  assert.equal(db.prepare("SELECT count(*) AS n FROM "+table).get().n,0);
 db.close();
});
test("one-paste ledger console SQL creates frozen revocation tombstone",()=>{
 const db=new DatabaseSync(":memory:");
 db.exec(ld);
 assert.equal(db.prepare("SELECT count(*) AS n FROM judgment_tombstones").get().n,1);
 assert.equal(db.prepare("SELECT mode,revision FROM ledger_control").get().mode,"frozen");
 assert.equal(db.prepare("SELECT revision FROM ledger_control").get().revision,2);
 assert.equal(db.prepare("SELECT count(*) AS n FROM ledger_audit").get().n,1);
 db.close();
});
test("repeated console paste cannot duplicate synthetic case or audit entry",()=>{
 const a=new DatabaseSync(":memory:"),b=new DatabaseSync(":memory:");
 a.exec(md);a.exec(md);b.exec(ld);b.exec(ld);
 assert.equal(a.prepare("SELECT count(*) AS n FROM judgment_metadata").get().n,1);
 assert.equal(b.prepare("SELECT count(*) AS n FROM judgment_tombstones").get().n,1);
 assert.equal(b.prepare("SELECT count(*) AS n FROM ledger_audit").get().n,1);
 assert.equal(b.prepare("SELECT revision FROM ledger_control").get().revision,2);
 a.close();b.close();
});
test("neither console SQL script contains real judgment, secrets, or D1 restore operations",()=>{
 for(const s of [md,ld]){
  assert.match(s,/TEST_JID_SYNTHETIC_REMOTE_20261015/);
  for(const bad of ["JUDICIAL_API_PASSWORD","JUDICIAL_API_USER","CREATE VIEW public_","DROP TABLE","DELETE FROM","judicial.gov.tw"])
   assert.equal(s.includes(bad),false);
 }
});
