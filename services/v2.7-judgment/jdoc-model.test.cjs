"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {planJDocAction,reduceSnapshot,safeJudicialFileUrl}=require("./jdoc-model.cjs");
const JID="TEST_JID_SYNTHETIC_DO_NOT_USE";
const TEXT={JID,JYEAR:"999",JCASE:"測試",JNO:"000",JDATE:"20990101",JTITLE:"非真實裁判示例",
  ATTACHMENTS:[],JFULLX:{JFULLTYPE:"text",JFULLCONTENT:"synthetic-only full text",JFULLPDF:""}};
const REMOVAL={error:"查無資料，本裁判可能未公開或已從系統移除，若您曾經下載過本裁判，亦請您將其移除！謝謝！"};
test("official nested JFULLX text is parsed (not a string)",()=>{
 const a=planJDocAction(JID,TEXT);
 assert.equal(a.kind,"upsert");assert.equal(a.publishable,false);
 assert.equal(a.record.fullTextType,"plain-text");assert.equal(a.record.fullText,"synthetic-only full text");
 assert.equal(a.record.fullTextComplete,true);
});
test("PDF mode retains official file link but never claims text is complete",()=>{
 const response={...TEXT,JFULLX:{JFULLTYPE:"file",JFULLCONTENT:"short preview",
 JFULLPDF:"https://data.judicial.gov.tw/jdg/api/JDocFile/TEST_JID/file.pdf"}};
 const p=planJDocAction(JID,response);
 assert.equal(p.record.fullTextType,"file");assert.equal(p.record.fullText,null);
 assert.equal(p.record.preview,"short preview");assert.equal(p.record.fullTextComplete,false);
 assert.match(p.record.pdfUrl,/^https:\/\/data.judicial.gov.tw\//);
});
test("rejects bare JFULLX string from outdated model",()=>{
 assert.throws(()=>planJDocAction(JID,{...TEXT,JFULLX:"old-bad-format"}),/Missing JFULLX object/);
});
test("rejects wrong JID",()=>{
 assert.throws(()=>planJDocAction(JID,{...TEXT,JID:"OTHER_SYNTHETIC"}),/Mismatched/);
});
test("rejects non-withdrawal upstream errors",()=>{
 assert.throws(()=>planJDocAction(JID,{error:"驗證失敗"}),/returned an error/);
});
test("known non-public/withdrawn error plans full purge",()=>{
 const x=planJDocAction(JID,REMOVAL);
 assert.equal(x.kind,"withdraw");assert.equal(x.publishable,false);
 for(const name of ["documentBody","publicSearchIndex","summaries","embeddings","edgeCache","backupCopies"])
   assert.ok(x.purgeTargets.includes(name));
});
test("same JID overwrites in synthetic snapshot",()=>{
 const a=planJDocAction(JID,TEXT);
 const b=planJDocAction(JID,{...TEXT,JFULLX:{...TEXT.JFULLX,JFULLCONTENT:"revised synthetic body"}});
 const state=reduceSnapshot(reduceSnapshot(new Map(),a),b);
 assert.equal(state.size,1);assert.equal(state.get(JID).fullText,"revised synthetic body");
});
test("withdraw removes it from synthetic snapshot",()=>{
 const state=reduceSnapshot(reduceSnapshot(new Map(),planJDocAction(JID,TEXT)),planJDocAction(JID,REMOVAL));
 assert.equal(state.size,0);
});
test("rejects broken metadata and missing body",()=>{
 assert.throws(()=>planJDocAction(JID,{}),/Mismatched/);
 assert.throws(()=>planJDocAction(JID,{JID}),/Incomplete/);
 assert.throws(()=>planJDocAction(JID,{...TEXT,JFULLX:{JFULLTYPE:"text",JFULLCONTENT:""}}),/full text required/);
});
test("rejects untrusted PDF or attachment hosts",()=>{
 assert.throws(()=>safeJudicialFileUrl("javascript:alert(1)"),/Unexpected judicial/);
 assert.throws(()=>safeJudicialFileUrl("https://evil.example/JDocFile/document.pdf"),/Unexpected judicial/);
 assert.throws(()=>planJDocAction(JID,{...TEXT,ATTACHMENTS:[{TITLE:"evil",URL:"https://evil.example/a.pdf"}]}),/Unexpected judicial/);
});
test("prevents invalid JID controls",()=>{
 assert.throws(()=>planJDocAction("x\nid",TEXT),/Invalid JID/);
});
