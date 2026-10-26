/* 申論評分參考：資料完整性與分數換算，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
for(const f of ['law-scoring/data.js','law-scoring/app.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w},{filename:f});
const D=w.LawScoringData,S=w.LawScoring;
assert(S&&typeof S.score==='function','app exposes the scoring function without a DOM');
const KINDS=['essay','case','proc','theory'],LAW=['少年事件處理法','刑法','刑事訴訟法與保安處分執行法'],THEORY=['犯罪學','心理學','諮商與輔導'];
const ids=new Set(),bySubject={};
for(const q of D.questions){
  assert(!ids.has(q.id),'duplicate id '+q.id);ids.add(q.id);
  bySubject[q.subject]=(bySubject[q.subject]||0)+1;
  assert(KINDS.includes(q.kind),q.id+' kind');
  for(const k of ['exam','subject','title','overview','body','check'])assert(typeof q[k]==='string'&&q[k].trim(),q.id+' missing '+k);
  assert(Number.isInteger(q.year)&&Number.isInteger(q.no),q.id+' year/no');
  assert.equal(q.checkOk,LAW.includes(q.subject),q.id+' law questions are checked against current law; theory ones await textbook review');
  assert(q.rows.length>=3&&q.organize.length&&q.pitfalls.length,q.id+' rows/organize/pitfalls');
  for(const r of q.rows){
    assert(r.point&&r.detail&&Array.isArray(r.articles)&&r.articles.length,q.id+' row fields');
    assert(typeof r.devNote==='string'&&typeof r.approved==='boolean',q.id+' developer fields');
  }
  if(q.kind==='case')assert(q.rows.some(r=>r.disputed),q.id+' needs a disputed row');
  const weights=S.weights(q);
  assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),100,q.id+' weights sum to 100');
  assert.equal(S.score(q,{checks:{},organize:{}}).total,0,q.id+' empty self-check scores 0');
  const checks={},organize={};
  q.rows.forEach((_,i)=>checks[i]=Object.fromEntries(S.COLS[q.kind].map(([k])=>[k,true])));
  q.organize.forEach((_,i)=>organize[i]=true);
  assert.equal(S.score(q,{checks,organize}).total,100,q.id+' full self-check scores 100');
}
for(const s of [...LAW,...THEORY])assert(bySubject[s]>=31,'subject coverage '+s);
const html=fs.readFileSync(path.join(root,'law-scoring/index.html'),'utf8');
assert(html.includes('非官方評分')&&!html.includes('fonts.googleapis'),'disclaimer present and no external fonts for offline use');
console.log('PASS law-scoring: '+D.questions.length+' questions, '+Object.keys(bySubject).length+' subjects');
