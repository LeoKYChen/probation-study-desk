"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const {makeD1MetadataAdapter,REQUIRED_PURGE}=require("./d1-metadata-adapter.cjs");
const {applyPrivateMutation}=require("./private-mutation.cjs");
const ID="TEST_JID_SYNTHETIC_001",OTHER="TEST_JID_SYNTHETIC_002";
const fixedClock=()=>new Date("2026-10-15T04:00:00Z");
function record(jid=ID,revision=1,title="合成裁判一"){
 return {jid,year:"999",caseType:"合成",caseNo:"001",judgmentDate:"20990101",title,revision};
}
function localD1({failBatchAt=0}={}){
 const db=new DatabaseSync(":memory:");
 db.exec("PRAGMA foreign_keys=ON");
 db.exec(fs.readFileSync(path.join(__dirname,"migrations/0001_private_metadata.sql"),"utf8"));
 const api={
   prepare(sql){
     return {bind(...values){
       return {
         run:async()=>db.prepare(sql).run(...values),
         first:async()=>db.prepare(sql).get(...values)??null
       };
     }};
   },
   async batch(statements){
     db.exec("BEGIN IMMEDIATE");
     try{
       for(let i=0;i<statements.length;i++){
         if(failBatchAt===i+1)throw Error("SIMULATED_SQL_BATCH_FAILURE");
         await statements[i].run();
       }
       db.exec("COMMIT");
     }catch(e){db.exec("ROLLBACK");throw e}
   }
 };
 return {db,api,adapter:makeD1MetadataAdapter(api,{clock:fixedClock})};
}
test("migration creates revocation gate plus four active-data tables",()=>{
 const {db}=localD1();
 for(const table of ["judgment_access","judgment_metadata","judgment_search_tokens","judgment_summaries","judgment_vectors"]){
   assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table).name,table);
 }
 db.close();
});
test("applyPrivateMutation stores metadata privately and public result remains empty",async()=>{
 const {db,adapter}=localD1();
 const p={kind:"upsert",jid:ID,publishable:false,record:record()};
 const r=await applyPrivateMutation(p,adapter);
 assert.equal(r.storedPrivate,true);
 assert.equal((await adapter.getPrivateMetadata(ID)).title,"合成裁判一");
 assert.deepEqual(await adapter.publicLookup(),[]);
 assert.equal(db.prepare("SELECT state FROM judgment_access WHERE jid=?").get(ID).state,"blocked");
 db.close();
});
test("revision increases but older version cannot overwrite",async()=>{
 const {db,adapter}=localD1();
 await adapter.blockPublicAccess(ID);
 await adapter.putPrivate(record(ID,3,"合成新版"));
 await adapter.putPrivate(record(ID,2,"合成舊版"));
 assert.equal((await adapter.getPrivateMetadata(ID)).title,"合成新版");
 assert.equal((await adapter.getPrivateMetadata(ID)).revision,3);
 db.close();
});
test("D1 records never store JDoc full text/preview/attachment",async()=>{
 const {db,adapter}=localD1();
 await adapter.blockPublicAccess(ID);
 for(const field of [{fullText:"sensitive"},{preview:"sensitive"},{pdfUrl:"https://data.judicial.gov.tw/jdg/api/JDocFile/x"},{attachments:[{title:"x"}]}]){
   await assert.rejects(adapter.putPrivate({...record(),...field}),/forbidden/);
 }
 assert.equal((await adapter.getPrivateMetadata(ID)),null);
 db.close();
});
test("refuses non-synthetic JIDs in every write",async()=>{
 const {db,adapter}=localD1();
 await assert.rejects(adapter.blockPublicAccess("TPEV-2026-REAL"),/synthetic JIDs only/);
 await assert.rejects(adapter.putPrivate({...record(),jid:"TPEV-2026-REAL"}),/synthetic JIDs only/);
 db.close();
});
test("withdraw deletes every LIVE metadata/index row, but cannot verify Time Travel history",async()=>{
 const {db,adapter}=localD1();
 await applyPrivateMutation({kind:"upsert",jid:ID,publishable:false,record:record()},adapter);
 db.prepare("INSERT INTO judgment_search_tokens(jid,token) VALUES(?,?)").run(ID,"synthetic");
 db.prepare("INSERT INTO judgment_summaries(jid,summary) VALUES(?,?)").run(ID,"fake summary");
 db.prepare("INSERT INTO judgment_vectors(jid,vector_ref) VALUES(?,?)").run(ID,"fake vec key");
 const removal={kind:"withdraw",jid:ID,publishable:false,purgeTargets:[...REQUIRED_PURGE]};
 // This must fail CLOSED, because Time Travel / caches cannot be proven erased.
 await assert.rejects(applyPrivateMutation(removal,adapter),/not fully verified/);
 assert.equal(await adapter.liveRowsPurged(ID),true);
 assert.equal(await adapter.verifyPurged(ID,[...REQUIRED_PURGE]),false);
 assert.equal(db.prepare("SELECT state FROM judgment_access WHERE jid=?").get(ID).state,"revoked");
 for(const table of ["judgment_metadata","judgment_search_tokens","judgment_summaries","judgment_vectors"]){
   assert.equal(db.prepare("SELECT count(*) AS n FROM "+table+" WHERE jid=?").get(ID).n,0);
 }
 assert.deepEqual(await adapter.publicLookup(),[]);
 db.close();
});
test("withdrawn JID cannot be accidentally ingested again or reopened by block",async()=>{
 const {db,adapter}=localD1();
 await adapter.blockPublicAccess(ID);
 await adapter.putPrivate(record());
 await adapter.purgeEverywhere(ID,[...REQUIRED_PURGE]);
 await adapter.blockPublicAccess(ID); // ON CONFLICT DO NOTHING prevents reopening
 await assert.rejects(adapter.putPrivate(record(ID,99,"合成重新匯入")),/previously revoked/);
 assert.equal(db.prepare("SELECT state FROM judgment_access WHERE jid=?").get(ID).state,"revoked");
 db.close();
});
test("revoking one synthetic JID cannot erase another",async()=>{
 const {db,adapter}=localD1();
 for(const jid of [ID,OTHER]){
   await adapter.blockPublicAccess(jid);
   await adapter.putPrivate(record(jid));
 }
 await adapter.purgeEverywhere(ID,[...REQUIRED_PURGE]);
 assert.equal(await adapter.getPrivateMetadata(ID),null);
 assert.notEqual(await adapter.getPrivateMetadata(OTHER),null);
 db.close();
});
test("SQL transaction failure rolls back purging, while earlier access block stays",async()=>{
 // Inject error at the third statement of the D1-style batch.
 const {db,api}=localD1({failBatchAt:3});
 const adapter=makeD1MetadataAdapter(api,{clock:fixedClock});
 await adapter.blockPublicAccess(ID);
 // Prepare a synthetic document without invoking upsert batch (which has one statement).
 db.prepare("INSERT INTO judgment_metadata(jid,case_year,case_type,case_no,judgment_date,title,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
 .run(ID,"999","合成","001","20990101","合成裁判",1,"now","now");
 const purge={kind:"withdraw",jid:ID,publishable:false,purgeTargets:[...REQUIRED_PURGE]};
 await assert.rejects(applyPrivateMutation(purge,adapter),/SIMULATED_SQL_BATCH_FAILURE/);
 assert.equal(db.prepare("SELECT state FROM judgment_access WHERE jid=?").get(ID).state,"blocked");
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM judgment_metadata WHERE jid=?").get(ID).n,1);
 assert.deepEqual(await adapter.publicLookup(),[]);
 db.close();
});
test("required targets cannot omit storage or derivative classes",async()=>{
 const {db,adapter}=localD1();
 await adapter.blockPublicAccess(ID);
 await assert.rejects(adapter.purgeEverywhere(ID,["primaryRecord"]),/Incomplete purge/);
 db.close();
});
