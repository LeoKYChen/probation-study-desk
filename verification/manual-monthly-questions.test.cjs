'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),code=[
 'scripts/apps-script/ManualDailyQuestions.gs','scripts/apps-script/ManualMonthlyQuestions.gs'
].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const index=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions-monthly.json'),'utf8'));
const bank=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions.json'),'utf8'));
const original={...bank};
const b=v=>Buffer.from(v);
function runtime(){
 let writes=null,patches=0,head='head';
 const ctx={console,PSD_DAILY_SOURCE_STATE_PATH_:'scripts/sync-state/daily-question-sources.json',
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    computeDigest:(algorithm,source)=>Array.from(crypto.createHash('sha256').update(
      typeof source==='string'?source:Buffer.from(source)).digest()),
    newBlob:v=>{const x=b(v);return {getBytes:()=>Array.from(x),getDataAsString:()=>x.toString('utf8')}}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.psdBridgeConfig_=()=>({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock'});
 ctx.psdBridgeMeta_=()=>({sha:'old-index-sha'});
 ctx.manualQuestionRead_=(cfg,p)=>{
  const raw=fs.readFileSync(path.join(root,p),'utf8');
  return {sha:'file-sha',raw,data:JSON.parse(raw)};
 };
 ctx.psdBridgeApi_=(cfg,method,endpoint,payload)=>{
  if(endpoint==='git/ref/heads/main')return {object:{sha:head}};
  if(endpoint==='git/commits/head')return {tree:{sha:'tree'}};
  if(endpoint==='git/trees'){writes=payload.tree;return {sha:'newtree'};}
  if(endpoint==='git/commits')return {sha:'next'};
  if(endpoint==='git/refs/heads/main'){patches++;head=payload.sha;return {};}
  throw Error('unexpected GitHub '+endpoint);
 };
 return {ctx,writes:()=>writes,patches:()=>patches,setHead:v=>{head=v}};
}
const before=()=>structuredClone(bank);
const baseline=()=>({head:'head',indexSha:'old-index-sha',index:structuredClone(index),data:before()});
const state=()=>({schemaVersion:1,sources:{'md-test':{kind:'markdown',modified:'2026-11-05T00:00:00Z',nameSha256:'abc'}}});
test('original 245-question monthly archive can be verified through supplied GAS reader',()=>{
 const r=runtime(),value=r.ctx.manualQuestionReadMonthly_({branch:'main'},index,'head');
 assert.equal(value.count,245);
 const ids=new Map(value.questions.map(q=>[q.id,q]));
 assert.equal(ids.size,245);
 for(const q of bank.questions)assert.deepEqual(JSON.parse(JSON.stringify(ids.get(q.id))),q);
});
test('new October question creates one shard only and keeps all five existing hashes',()=>{
 const r=runtime(),after=before(),q=structuredClone(after.questions[0]);
 q.id='gd-new-1';q.date='2026-10-30';q.question+='（新考題）';
 after.questions.push(q);after.count++;
 const saved=r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),after,state());
 assert.equal(saved.questionsChanged,true);assert.equal(saved.newShards,1);
 assert.equal(saved.reusedShards,5);assert.equal(r.patches(),1);
 const names=r.writes().map(w=>w.path);
 assert.equal(names.filter(n=>n.startsWith('daily-simulation/question-shards/')).length,1);
 assert(names.includes('daily-simulation/questions-monthly.json'));
 assert(names.includes('file-data/questions-monthly.generated.js'));
 assert(!names.includes('daily-simulation/questions.json'),'The 2.5MB legacy source must not be re-uploaded');
 assert(names.includes('scripts/sync-state/daily-question-sources.json'));
});
test('editing one unprotected October question rebuilds its shard, not neighboring shards',()=>{
 const r=runtime(),after=before();
 const q=after.questions.find(q=>q.date.startsWith('2026-10')&&q.qualityStatus!=='待訂正');
 assert(q);
 q.issues+='（補充引用核對後的爭點）';
 const saved=r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),after,state());
 assert.equal(saved.newShards,1);
 assert.equal(saved.reusedShards,4);
});
test('no substantive change checkpoints only, without rewriting questions, offline or old shards',()=>{
 const r=runtime();const saved=r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),before(),state());
 assert.equal(saved.questionsChanged,false);
 assert.deepEqual(Array.from(r.writes(),w=>w.path),['scripts/sync-state/daily-question-sources.json']);
 assert.equal(saved.reusedShards,5);
});
test('older human-corrected question and previous question ID cannot be deleted or overwritten',()=>{
 const r=runtime(),after=before(),victim=after.questions.find(q=>q.qualityStatus==='待訂正');
 if(victim){victim.issues+=' ALTERED';assert.throws(()=>r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),after,state()),/人工訂正/);}
 const removed=before();removed.questions.pop();removed.count--;
 assert.throws(()=>r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),removed,state()),/題庫筆數/);
});
test('GitHub HEAD change prevents every new shard and source checkpoint write',()=>{
 const r=runtime();r.setHead('new-head');
 assert.throws(()=>r.ctx.manualQuestionCommitMonthly_({branch:'main'},baseline(),before(),state()),/HEAD 已變動/);
 assert.equal(r.patches(),0);assert.equal(r.writes(),null);
});
test('tampered published shard is rejected before source parsing or upload',()=>{
 const r=runtime(),originalReader=r.ctx.manualQuestionRead_;
 r.ctx.manualQuestionRead_=(cfg,p,ref,optional)=>{
  const record=originalReader(cfg,p,ref,optional);
  if(p.startsWith('daily-simulation/question-shards/'))record.raw+=' ';
  return record;
 };
 assert.throws(()=>r.ctx.manualQuestionReadMonthly_({branch:'main'},index,'head'),/原文位元組|SHA-256/);
 assert.equal(r.patches(),0);
});
