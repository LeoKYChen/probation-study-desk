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
const analysis = context.window.PsychologyExamAnalysis;
for(const q of target){
  assert.equal(analysis.scope(q),true,q.id);
  const data=analysis.analyze(q);
  assert.ok(data.requirements.length>0,q.id);
  assert.ok(data.structure.length>=3,q.id);
  assert.ok(data.tested.length>=2,q.id);
  assert.equal(analysis.render(q),true,q.id);
  assert.ok(els.pointList.children.length>0,q.id);
  assert.equal(els.psychTeacherPanel.hidden,false,q.id);
  assert.equal(els.psychIntentPanel.hidden,false,q.id);
}
const elkind=analysis.analyze(target.find(q=>q.id==='115-心理學-3'));
assert.ok(elkind.requirements.some(r=>r.includes('Elkind')||r.includes('艾爾肯')));
assert.ok(elkind.tested.some(r=>r.includes('個人神話')));
const regression=analysis.analyze(target.find(q=>q.id==='薦任升等（矯正）-112-心理測驗-2'));
assert.ok(regression.requirements.some(r=>r.includes('GPA')));
assert.ok(!regression.requirements.every(r=>r.startsWith('（一）')||r.startsWith('（二）')||r.startsWith('（三）')));
assert.equal(analysis.scope({subject:'犯罪學',year:114}),false);
analysis.render(null);
assert.equal(els.psychTeacherPanel.hidden,true);
assert.equal(els.psychIntentPanel.hidden,true);
const html=fs.readFileSync(path.join(root,'v2.5/index.html'),'utf8');
for(const id of ids) assert.ok(html.includes('id="'+id+'"'),'missing markup '+id);
assert.ok(html.includes('<script src="psychology-exam-analysis.js"></script>'));
console.log('PASS: 104 psychology / psychometrics questions; all three analyses render and hide safely.');
