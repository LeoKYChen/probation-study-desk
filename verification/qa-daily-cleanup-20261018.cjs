/* QA-only: verify no changes outside exactly the authorized daily question metadata. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const BASE='b07f531df991d5c2065c3ce6d6a3050fc4d7a38a';
const file='daily-simulation/questions.json';
const orig=JSON.parse(execFileSync('git',['show',BASE+':'+file],{encoding:'utf8',maxBuffer:2000000}));
const curr=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(curr.count,orig.count);
assert.equal(curr.questions.length,orig.questions.length);
assert.equal(curr.count,132,'QA baseline count must remain unchanged');
assert.deepEqual(Object.keys(curr),Object.keys(orig),'root shape must not change');
const originalIds=orig.questions.map(q=>q.id);
assert.deepEqual(curr.questions.map(q=>q.id),originalIds);
assert.equal(new Set(originalIds).size,132);
const changes=[],questionIds=[],subjectIds=[];
const subjectAffected=new Set([
'gd-340e261ace95b3fcc1308076-1','md-0e67f1040706103f7c16',
'md-1173fc2d28a577d6cc9f','md-1c7fe63cc30054053a9c',
'md-4190a4a6bda42a66c018','md-7407a251eb866044eafe',
'md-be7852cef9df28aafa23','md-fab36073cf18b2110458',
'gd-ba9f24246d37253d4b1af9b2-1','gd-f338ef2cebfc6f037fc4a20d-1',
'md-0b7a99d93894e99f8441-qd87641fb7515','2026-10-14-1',
'md-801701c713341dedfa96-qa6f60cd07fdd','2026-10-12-1',
'2026-10-10-1','2026-10-09-1','2026-10-08-1','2026-10-07-1',
'2026-10-05-1','2026-10-03-1','2026-10-02-1','2026-10-01-1'
]);
const bodyAffected=new Set(['gd-340e261ace95b3fcc1308076-1','gd-ba9f24246d37253d4b1af9b2-1']);
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('daily-simulation/model.js','utf8'),ctx,{timeout:3000});
const M=ctx.window.PracticeModel;
M.dataset(curr);
for(let i=0;i<132;i++){
 const a=orig.questions[i],b=curr.questions[i];
 assert.deepEqual(Object.keys(b),Object.keys(a),'changed keys '+b.id);
 for(const k of Object.keys(a)){
  if(k==='subject'&&subjectAffected.has(a.id)){
   assert.notEqual(b.subject,a.subject,a.id+' expected subject cleanup');
   assert(!/[\r\n]/.test(b.subject));
  }else if(k==='question'&&bodyAffected.has(a.id)){
   assert.notEqual(b.question,a.question,a.id+' expected editor cleanup');
   assert(b.question.startsWith('案例事實：'));
   assert(!b.question.includes('將其深化為')&&!b.question.includes('改編後實例申論題題目'));
   assert(b.question.includes('（15 分）')&&b.question.includes('（10 分）'));
  }else assert.deepEqual(b[k],a[k],'unexpected '+a.id+'.'+k);
 }
 if(a.subject!==b.subject)subjectIds.push(a.id);
 if(a.question!==b.question)questionIds.push(a.id);
 if(!bodyAffected.has(a.id)){
  assert.equal(M.signature(a),M.signature(b),'subject cleanup must not change question snapshot '+a.id);
 }
}
assert.equal(subjectIds.length,22);
assert.equal(questionIds.length,2);
assert.deepEqual(subjectIds.slice().sort(),[...subjectAffected].sort());
assert.deepEqual(questionIds.slice().sort(),[...bodyAffected].sort());
assert.equal(curr.questions.filter(q=>q.subject==='待分類').length,4,'unresolved classifications remain explicitly flagged');
assert.equal(curr.questions.filter(q=>q.subject.includes('\n原試題出處：')).length,0);
assert.deepEqual(curr.templates,orig.templates);
assert.deepEqual(curr.diagnostics,orig.diagnostics);
assert.equal(curr.updatedAt,orig.updatedAt,'do not fake a production sync event');
console.log('PASS isolated QA: 132 original IDs and all source/rubric/review fields preserved; 22 subject metadata fixes, 2 editor-preface extractions; 4 intentionally unclassified; no other data changes');
