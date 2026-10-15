"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {planJDocAction}=require("./jdoc-model.cjs");
const {applyPrivateMutation}=require("./private-mutation.cjs");
const JID="TEST_JID_SYNTHETIC_DO_NOT_USE";
const DOC={JID,JYEAR:"999",JCASE:"測試",JNO:"001",JDATE:"20990101",
  JTITLE:"非真實案例",JFULLX:{JFULLTYPE:"text",JFULLCONTENT:"private synthetic text",JFULLPDF:""}};
const WITHDRAWN={error:"查無資料，本裁判可能未公開或已從系統移除，若您曾經下載過本裁判，亦請您將其移除！謝謝！"};
function fakeAdapter({verify=true,failPurge=false}={}){
 const state={blocked:new Set(),privateRecords:new Map(),calls:[],targets:[]};
 const adapter={
   async blockPublicAccess(jid){state.calls.push("block");state.blocked.add(jid)},
   async purgeEverywhere(jid,targets){
     state.calls.push("purge");state.targets=[...targets];
     if(failPurge)throw Error("simulated purge failure");
     state.privateRecords.delete(jid);
   },
   async verifyPurged(jid){
     state.calls.push("verify");
     return verify&&!state.privateRecords.has(jid);
   },
   async putPrivate(record){
     state.calls.push("store");state.privateRecords.set(record.jid,record);
   }
 };
 return {state,adapter};
}
test("private upsert blocks public access; no publish method",async()=>{
 const {state,adapter}=fakeAdapter();
 const a=planJDocAction(JID,DOC);
 const r=await applyPrivateMutation(a,adapter);
 assert.deepEqual(state.calls,["block","store"]);
 assert.equal(state.blocked.has(JID),true);
 assert.equal(r.storedPrivate,true);assert.equal(r.blocked,true);
});
test("withdrawal first blocks access then purges all targets and verifies",async()=>{
 const {state,adapter}=fakeAdapter();
 await applyPrivateMutation(planJDocAction(JID,DOC),adapter);
 state.calls=[];
 const result=await applyPrivateMutation(planJDocAction(JID,WITHDRAWN),adapter);
 assert.deepEqual(state.calls,["block","purge","verify"]);
 assert.equal(result.purged,true);
 assert.equal(state.privateRecords.has(JID),false);
 for(const x of ["primaryRecord","documentBody","publicSearchIndex","summaries","embeddings","edgeCache","snapshots","backupCopies"])
   assert.ok(state.targets.includes(x));
});
test("incomplete purge keeps access blocked and throws",async()=>{
 const {state,adapter}=fakeAdapter({verify:false});
 await assert.rejects(applyPrivateMutation(planJDocAction(JID,WITHDRAWN),adapter),/not fully verified/);
 assert.equal(state.blocked.has(JID),true);
});
test("purge failure stops and keeps access blocked",async()=>{
 const {state,adapter}=fakeAdapter({failPurge:true});
 await assert.rejects(applyPrivateMutation(planJDocAction(JID,WITHDRAWN),adapter),/simulated purge failure/);
 assert.equal(state.blocked.has(JID),true);
 assert.deepEqual(state.calls,["block","purge"]);
});
test("incomplete adapter refused before storing",async()=>{
 await assert.rejects(applyPrivateMutation(planJDocAction(JID,DOC),{}),/Incomplete/);
});
test("cannot inject publishable record into private mutation contract",async()=>{
 const {adapter}=fakeAdapter();
 await assert.rejects(applyPrivateMutation({kind:"upsert",jid:JID,publishable:true},adapter),/Non-private/);
});
