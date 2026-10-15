"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {planJDocAction,reduceSnapshot}=require("./jdoc-model.cjs");
const JID="TEST_JID_SYNTHETIC_DO_NOT_USE";
const DOC={JID,JYEAR:"999",JCASE:"測試",JNO:"000",JDATE:"999-01-01",JTITLE:"非真實裁判示例",JFULLX:"synthetic-only test text"};
test("parse synthetic JDoc as private-only upsert",()=>{
 const p=planJDocAction(JID,DOC);
 assert.equal(p.kind,"upsert");assert.equal(p.record.fullTextType,"plain-text");assert.equal(p.publishable,false);
});
test("reject wrong JID rather than joining wrong case",()=>{
 assert.throws(()=>planJDocAction(JID,{...DOC,JID:"OTHER_SYNTHETIC"}),/Mismatched/);
});
test("fail closed on unidentified upstream errors",()=>{
 assert.throws(()=>planJDocAction(JID,{error:"rate limit"}),/Upstream/);
});
test("official non-public/removed response becomes mandatory purge",()=>{
 const x=planJDocAction(JID,{error:"查無資料，本裁判可能未公開或已從系統移除，若您曾經下載過本裁判，亦請您將其移除！謝謝！"});
 assert.equal(x.kind,"withdraw");assert.equal(x.publishable,false);
 for(const target of ["documentBody","publicSearchIndex","summaries","embeddings","edgeCache","backupCopies"])
   assert.ok(x.purgeTargets.includes(target));
});
test("repeated JID overwrites previous content in synthetic in-memory state",()=>{
 const a=planJDocAction(JID,DOC);
 const b=planJDocAction(JID,{...DOC,JFULLX:"revised synthetic case"});
 const s=reduceSnapshot(reduceSnapshot(new Map(),a),b);
 assert.equal(s.size,1);assert.equal(s.get(JID).fullText,"revised synthetic case");
});
test("withdrawal eliminates synthetic in-memory record",()=>{
 const s=reduceSnapshot(reduceSnapshot(new Map(),planJDocAction(JID,DOC)),
   planJDocAction(JID,{error:"查無資料，本裁判可能未公開或已從系統移除"}));
 assert.equal(s.size,0);
});
test("reject non-object or incomplete documents",()=>{
 assert.throws(()=>planJDocAction(JID,{}),/Mismatched/);
 assert.throws(()=>planJDocAction(JID,{JID}),/Incomplete/);
});
