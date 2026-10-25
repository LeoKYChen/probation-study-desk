'use strict';
// Every v2.5 original question has an all-subject pilot rubric, loaded in the same order as v2.5/index.html.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),v25=path.join(root,'v2.5');
const html=fs.readFileSync(path.join(v25,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const order=['questions.js','related-questions.js','rubrics.js','legal-pilots.js','full-pilots.js','pending-pilots-data.js','answer-calibrations.js','note-references.js','pending-pilots.js','grade-reference.js','full-pilots-all.js'];
for(const name of order)assert(scripts.includes(name),'v2.5/index.html loads '+name);
for(let i=1;i<order.length;i++)assert(scripts.indexOf(order[i-1])<scripts.indexOf(order[i]),order[i-1]+' loads before '+order[i]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'offline-manifest.json'),'utf8'));
assert(manifest.assets.some(a=>a.url==='v2.5/full-pilots-all.js'),'offline snapshot includes full-pilots-all.js');

const w={};w.window=w;vm.createContext(w);
for(const name of ['questions.js','related-questions.js','rubrics.js','content-standards.js','legal-pilots.js','full-pilots.js','pending-pilots-data.js','answer-calibrations.js','note-references.js','pending-pilots.js','grade-reference.js','full-pilots-all.js'])
  vm.runInContext(fs.readFileSync(path.join(v25,name),'utf8'),w,{filename:name});
const bank=[...w.QUESTION_BANK,...w.RELATED_QUESTION_BANK],R=w.FULL_PILOT_RUBRICS;
assert.equal(bank.length,426);
const missing=bank.filter(q=>!R[q.id]).map(q=>q.id);
assert.deepEqual(missing,[],'every question has an all-subject pilot');
assert.equal(Object.keys(R).length,bank.length,'no rubric without a question');
assert.equal(new Set(bank.map(q=>q.subject)).size,11);
assert(html.includes('全科試評：11科全部'+bank.length+'題'),'summary states the real count');

let added=0;
for(const q of bank){
  const r=R[q.id];
  if(w.LEGAL_PILOT_RUBRICS[q.id])continue;
  assert.equal(r.criteria.length,6,q.id+' has six points');
  assert.equal(r.criteria.reduce((n,c)=>n+c.weight,0),80,q.id+' point weights');
  assert.equal(r.criteria.map(c=>c.category).join(),'issue,issue,rule,rule,analysis,analysis',q.id+' categories');
  for(const c of r.criteria){
    assert(c.label&&c.hint&&!/~/.test(c.hint),q.id+' label and hint');
    assert(c.groups.length>0&&c.groups.every(g=>g.length&&g.every(t=>typeof t==='string'&&t.trim())),q.id+' '+c.label+' term groups');
  }
  assert(r.sources.length>0&&r.sources.every(s=>s&&/^https:\/\//.test(s.url)&&s.title),q.id+' sources');
  assert.equal(r.legalVersion,/刑法|訴訟法|少年事件處理法/.test(q.id)?'current':null,q.id+' legal version');
  if(r.version==='all-subject-pilot-v3-20261025'){
    added++;
    if(w.PENDING_PILOT_RUBRICS[q.id])assert(r.calibration?.referenceParagraphs?.length,q.id+' keeps the reference outline');
  }
  const empty=w.gradeFullPilot('',q);
  assert.equal(empty.total,0,q.id+' empty answer scores nothing');
  assert.equal(empty.rubricVersion,r.version,q.id+' assessment carries this rubric version');
}
assert.equal(added,316,'316 newly added pilots');

// A sentence answering a point is recognised; the same keywords as a bare list are not.
const q=bank.find(x=>x.id==='監獄官-109-犯罪學與再犯預測-4');
const prose=w.gradeFullPilot('RANT是毒品藥物個案早期分流的工具。\n它分別評估司法失敗風險與治療需求，因此形成四類。\n綜上，高風險者應配較密監督。',q);
assert(prose.total>0&&prose.evidence.filter(e=>e.status==='evidence').length>=2,'explanatory sentences are recognised');
const list=w.gradeFullPilot('RANT、分流、早期、毒品、風險、需求',q);
assert.equal(list.evidence.filter(e=>e.status==='evidence').length,0,'keyword lists are not evidence');
const variant=w.gradeFullPilot('乙受託持有禮金，抽出1200元據為己有，因此成立335侵佔罪。',bank.find(x=>x.id==='薦任升等（矯正）-112-刑法-4'));
assert.equal(variant.evidence[0].status,'evidence','占／佔 variants count as the same term');
const article=w.gradeFullPilot('依第78條之1應執行原無期徒刑，更犯之8月刑併執行之。',bank.find(x=>x.id==='監獄官-115-刑法與少年事件處理法-2'));
assert.equal(article.evidence[2].status,'evidence','78之1 matches 第78條之1');
console.log('all-subject pilots: '+bank.length+' questions, '+added+' added');
