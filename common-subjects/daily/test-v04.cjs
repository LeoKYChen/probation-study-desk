/* Regression and provenance checks for Staresto v0.4; run with Node >=22. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,E=require(path.join(root,'engine.js'));
const files=['vocab.json','grammar-1.json','grammar-2.json','grammar-3.json','reading.json','completion.json'];
const sources=files.map(f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')));
const script=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
new vm.Script(script,{filename:'app.js'});
assert.equal(E.VERSION,'psd-staresto-v04');
assert.equal(new Set(files).size,6);
const bank=E.createBank(sources),p=E.defaultState();
assert.equal(bank.questions.length,668);
assert.equal(Object.keys(bank.passages).length,34);
for(const [kind,n] of Object.entries({vocab:380,grammar:45,reading:63,completion:180})){
 assert.equal(bank.kinds[kind].length,n,kind+' count');
}
assert.equal(new Set(bank.questions.map(q=>q.id)).size,668,'stable unique IDs');
for(const q of bank.questions){
 assert.ok(q.options[q.answer],q.id);
 assert.equal(Object.keys(q.options).length,q.kind==='completion'?10:4);
 assert.equal(q.exam,'學測');
 assert.ok(q.year,'original year');
 assert.ok(q.number,'original question number');
 assert.match(q.sourceUrl,/^https:\/\/staresto-create\.github\.io\//);
 assert.ok(q.explanation,'source authored explanation');
 if(q.passageKey)assert.ok(bank.passages[q.passageKey]?.text.length>=200,'passage '+q.id);
 if(q.kind==='reading')assert.ok(q.id.startsWith('sr:'));
 if(q.kind==='vocab')assert.ok(q.id.startsWith('sv:'));
 if(q.kind==='completion')assert.ok(q.id.startsWith('sp:'));
 if(q.kind==='grammar')assert.ok(q.id.startsWith('sg:'));
}
assert.ok(!script.includes('psd-common-subjects-v1'),'old 80-question data remains isolated');
assert.ok(!script.includes('localStorage.clear'),'no destructive localStorage clear');
assert.ok(html.includes('staresto-create ZZSH'),'visible author attribution');
assert.ok(html.includes('SOURCES.md'),'visible source terms');
const week=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'];
for(let i=0;i<7;i++){
 const d=week[i],entry=E.buildDay(bank,p,d),taskIds=entry.tasks.flatMap(t=>t.ids);
 assert.ok(entry.tasks.length>=1,d+' has tasks');
 assert.ok(taskIds.length>0,d+' has questions');
 assert.ok(entry.tasks.reduce((sum,t)=>sum+t.minutes,0)<=(i===5||i===6?30:20),'daily time cap '+d);
 for(const t of entry.tasks){
  assert.ok(t.ids.every(id=>bank.byId[id]),'valid task ID '+d);
  if(t.key==='reading')assert.equal(new Set(t.ids.map(id=>bank.byId[id].passageKey)).size,1);
  if(t.key==='completion')assert.equal(new Set(t.ids.map(id=>bank.byId[id].passageKey)).size,1);
 }
 const snapshot=JSON.stringify(entry);
 assert.equal(JSON.stringify(E.buildDay(bank,p,d)),snapshot,'frozen daily plan '+d);
}
const sample=bank.kinds.vocab[0];
E.recordAttempt(p,sample.id,'A','B','2026-10-12');
assert.equal(E.recent(p,sample.id).correct,false);
assert.equal(p.progress[sample.id].due,'2026-10-13');
E.recordAttempt(p,sample.id,'B','B','2026-10-13');
assert.equal(p.progress[sample.id].due,'2026-10-16','1st correct 3-day interval');
assert.equal(p.progress[sample.id].attempts.length,2);
E.recordCard(p,sample.id,false,'2026-10-14');
assert.equal(p.progress[sample.id].attempts.length,2,'card record never mutates quiz scores');
assert.equal(p.cards[sample.id].due,'2026-10-15','weak flashcard next day');
const weekdayQuiz=E.buildDay(bank,p,'2026-10-19');
assert.ok(weekdayQuiz.tasks[0].ids.length===8,'Monday eight words');
const missed=E.unfinished(p,'2026-10-20');
assert.ok(missed.length>=1,'missed tasks remain available for 14 days');
const raw=JSON.stringify(p),restored=E.normalize(JSON.parse(raw));
assert.equal(restored.progress[sample.id].attempts.length,2);
assert.equal(E.normalize({schema:'other'}).schema,E.VERSION,'unexpected schema remains isolated');
const strong=E.defaultState();
for(let i=0;i<130;i++){
 const q=bank.kinds.vocab[i];
 const day=E.dayAdd('2026-01-01',i%30);
 E.recordAttempt(strong,q.id,'A','A',day);
}
assert.equal(E.stage(strong).level,3,'higher difficulty after sustained success');
const weak=E.defaultState();
for(let i=0;i<130;i++){
 const q=bank.kinds.vocab[i],date=E.dayAdd('2026-01-01',i%30);
 E.recordAttempt(weak,q.id,'B','A',date);
}
assert.equal(E.stage(weak).level,1,'low accuracy stays in base practice');
const assets=['index.html','style.css','engine.js','app.js','SOURCES.md',...files];
for(const f of assets)assert.ok(fs.statSync(path.join(root,f)).size>100,'required static resource '+f);
console.log('PASS v0.4: 668 attributed questions / 34 articles; 7-day training, adaptive stage, spaced review, backups, old-site isolation');
