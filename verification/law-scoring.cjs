/* 法律評分參考：資料完整性、分數換算與 AI 文字，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
for(const f of ['law-scoring/data.js','law-scoring/app.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w},{filename:f});
const D=w.LawScoringData,S=w.LawScoring;
assert.equal(Object.values(D.weights).reduce((a,b)=>a+b,0),100,'weights sum to 100');
assert.equal(JSON.stringify(D.weights),JSON.stringify({issues:20,law:25,apply:35,organize:20}),'weights match the law self-assessment rubric');
const ids=new Set();
for(const q of D.questions){
  assert(!ids.has(q.id),'duplicate id '+q.id);ids.add(q.id);
  for(const k of ['exam','subject','title','source','lawVersion','factSummary','task','overview'])assert(typeof q[k]==='string'&&q[k].trim(),q.id+' missing '+k);
  assert(q.rows.length&&q.rows.every(r=>r.actor&&r.offense&&r.issue&&typeof r.disputed==='boolean'),q.id+' rows');
  assert(q.rows.some(r=>r.disputed),q.id+' needs at least one disputed row');
  assert(q.organize.length&&q.examinerNotes.length,q.id+' organize/notes');
  assert.equal(S.score(q,{}).total,0,'empty self-check scores 0');
  const checks={},organize={};
  q.rows.forEach((r,i)=>checks[q.id+':'+i]={found:true,views:true,apply:true});
  q.organize.forEach((_,i)=>organize[i]=true);
  assert.equal(S.score(q,{checks,organize}).total,100,'full self-check scores 100');
  const p=S.buildPrompt(q,'我的測試答案');
  assert(p.includes('【我的答案】\n我的測試答案')&&p.includes(q.rows[0].issue)&&p.includes('事實涵攝與法律論證35分'));
}
const html=fs.readFileSync(path.join(root,'law-scoring/index.html'),'utf8');
assert(html.includes('不是考選部或觀護人考試的官方評分'),'non-official disclaimer');
console.log('PASS law-scoring: '+D.questions.length+' question(s)');
