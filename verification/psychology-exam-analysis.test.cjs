/* Node regression: psychology / psychometrics coverage and safe render. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const els = {};
const ids = ['psychTeacherPanel','psychIntentPanel','pointList','pointTitle','psychAnalysisNotice','psychTeacherItems','psychIntentItems'];
for (const id of ids) els[id] = {
  hidden:false, open:false, children:[], textContent:'',
  replaceChildren(){ this.children=[]; },
  appendChild(el){ this.children.push(el); }
};
const context = {
  window:{},
  document:{
    getElementById(id){return els[id]||null;},
    createElement(tagName){return {tagName,textContent:''};}
  }
};
vm.createContext(context);
const load = file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), context, {filename:file});
load('professional/source-main-questions.js');
load('professional/source-related-questions.js');
load('police-exams/questions.approved.js');
load('v2.5/psychology-curated-main.js');
load('v2.5/psychology-curated-psychometrics.js');
load('v2.5/psychology-curated-related.js');
load('v2.5/psychology-curated-police.js');
load('v2.5/psychology-exam-analysis.js');
const all = [
  ...context.window.QUESTION_BANK,
  ...context.window.RELATED_QUESTION_BANK,
  ...context.window.POLICE_ORIGINAL_QUESTION_BANK
];
const target = all.filter(q=>q.subject==='心理學'||q.subject==='心理測驗');
assert.equal(target.length,104,'all-source psychology inventory must be 104');
assert.equal(new Set(target.map(q=>q.id)).size,104,'question IDs must be unique');
const bySubject = target.reduce((acc,q)=>(acc[q.subject]=(acc[q.subject]||0)+1,acc),{});
assert.equal(bySubject['心理學'],88);
assert.equal(bySubject['心理測驗'],16);
const notes = context.window.PsychologyExamCurated;
assert.equal(Object.keys(notes).length,104,'all 104 questions must have editorial notes');
const analysis = context.window.PsychologyExamAnalysis;
for(const q of target){
  assert.equal(analysis.scope(q),true,q.id);
  const note=notes[q.id];
  assert.ok(note && note.d && note.s && note.c && note.p && /^[0-9a-f]{8}$/.test(note.sig),q.id+' curated fields and source fingerprint');
  const data=analysis.analyze(q);
  assert.deepEqual(Array.from(data.requirements),Array.from(note.r),q.id+' human-reviewed question subtasks');
  assert.equal(data.reviewStatus.includes('非官方標準答案'),true,q.id);
  assert.ok(data.structure.some(x=>x.includes(note.s)),q.id+' unique command structure');
  assert.ok(data.tested.some(x=>x.includes(note.c)),q.id+' unique exam target');
  assert.ok(data.tested.some(x=>x.includes(note.p)),q.id+' specific pitfalls');
  assert.ok(data.requirements.length>0,q.id);
  assert.ok(data.structure.length>=3,q.id);
  assert.ok(data.tested.length>=2,q.id);
  assert.equal(analysis.render(q),true,q.id);
  assert.ok(els.pointList.children.length>0,q.id);
  assert.equal(els.psychTeacherPanel.hidden,false,q.id);
  assert.equal(els.psychIntentPanel.hidden,false,q.id);
}
const original=target.find(q=>q.id==='115-心理學-3');
const elkind=analysis.analyze(original);
const changed=analysis.analyze({...original,body:original.body+'【原題異動測試】'});
assert.ok(changed.reviewStatus.includes('重新覆核'));
assert.ok(!changed.tested.join(' ').includes('個人神話'),'stale analysis must not leak when question changes');
assert.ok(elkind.requirements.some(r=>r.includes('Elkind')||r.includes('艾爾肯')));
assert.ok(elkind.tested.some(r=>r.includes('個人神話')));
assert.ok(elkind.requirements.some(r=>r.includes('兩種')));
const waid=analysis.analyze(target.find(q=>q.id==='112-心理學-4'));
assert.equal(waid.requirements.length,2);
assert.ok(waid.requirements.every(r=>r.includes('15分')));
const policeTerms=analysis.analyze(target.find(q=>q.id==='police-108-psychology-1'));
assert.ok(policeTerms.requirements[0].includes('五'));
const policePoints=analysis.analyze(target.find(q=>q.id==='police-111-psychology-1'));
assert.ok(policePoints.tested.join('').includes('20'));
const attachment=analysis.analyze(target.find(q=>q.id==='113-家事調查官-心理測驗員-心理學-1'));
assert.ok(attachment.tested.join('').includes('Main'));
const regression=analysis.analyze(target.find(q=>q.id==='薦任升等（矯正）-112-心理測驗-2'));
assert.ok(regression.requirements.some(r=>r.includes('GPA')));
assert.ok(!regression.requirements.every(r=>r.startsWith('（一）')||r.startsWith('（二）')||r.startsWith('（三）')));
assert.equal(analysis.scope({subject:'犯罪學',year:114}),false);
analysis.render(null);
assert.equal(els.psychTeacherPanel.hidden,true);
assert.equal(els.psychIntentPanel.hidden,true);
const html=fs.readFileSync(path.join(root,'v2.5/index.html'),'utf8');
for(const id of ids) assert.ok(html.includes('id="'+id+'"'),'missing markup '+id);
for(const filename of ['psychology-curated-main.js','psychology-curated-psychometrics.js','psychology-curated-related.js','psychology-curated-police.js','psychology-exam-analysis.js'])
  assert.ok(html.includes('<script src="'+filename+'"></script>'),'missing JS '+filename);
console.log('PASS: all 104 psychology / psychometrics questions contain curated analyses; existing question view remains safe.');
