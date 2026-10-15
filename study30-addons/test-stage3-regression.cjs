'use strict';
/* Browser-independent essay review regression tests; no actual study records. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),a=require('node:assert/strict');
const home=process.argv[2]||path.join(__dirname,'../dist');
const root={addEventListener(){}},env={window:root,document:{readyState:'loading',addEventListener(){}},Date,console};
for(const p of ['essay-rubric-core.js','essay-review.js'])vm.runInNewContext(fs.readFileSync(path.join(home,p),'utf8'),env);
const core=root.Study30EssayReview,rubric=root.Study30Rubric;
let passes=0;
const check=(name,test)=>{test();console.log('PASS',++passes,name)};
function entry(subject,score,issues=[]){const type=rubric.subjectType(subject);return {version:1,rubric:type,subject,questionHeading:'測試題',scores:Object.fromEntries(rubric.RULES[type].criteria.map(c=>[c.id,score])),issues,nextStep:'改善目標'};}
function record(day,id,assessment){return {[day]:{essayAssessments:{[id]:assessment}}};}
const today='2026-10-15';
const bank=[{id:'psych',subject:'心理學',subjectGroup:'心理學',title:'心理學題'},{id:'law',subject:'刑法',subjectGroup:'刑法',title:'法律題'}];
function m(s,when=today,subject='心理學'){return core.model(s,bank,when,subject)}
check('1-day rating',()=>a.equal(core.ratingFrom(25,[]),'review'));
check('3-day rating',()=>a.equal(core.ratingFrom(75,[]),'partial'));
check('7-day rating',()=>a.equal(core.ratingFrom(100,[]),'mastered'));
check('high score with weakness is partial',()=>a.equal(core.ratingFrom(100,['名詞定義不精確']),'partial'));
check('low score always review',()=>a.equal(core.ratingFrom(0,['名詞定義不精確']),'review'));
check('next day due',()=>{const r=m(record('2026-10-14','psych',entry('心理學',1)));a.equal(r.due[0].interval,1);a.equal(r.due[0].due,today)});
check('not due one day early',()=>{const r=m(record('2026-10-15','psych',entry('心理學',1)));a.equal(r.due.length,0);a.equal(r.upcoming[0].daysUntil,1)});
check('3-day due',()=>{const r=m(record('2026-10-12','psych',entry('心理學',3)));a.equal(r.due[0].interval,3)});
check('3-day not due at day 2',()=>{const r=m(record('2026-10-13','psych',entry('心理學',3)));a.equal(r.due.length,0)});
check('7-day due',()=>{const r=m(record('2026-10-08','psych',entry('心理學',4)));a.equal(r.due[0].interval,7)});
const repeat={'2026-09-17':{essayAssessments:{psych:entry('心理學',4)}},'2026-10-01':{essayAssessments:{psych:entry('心理學',4)}},'2026-10-15':{essayAssessments:{psych:entry('心理學',4)}}};
check('continuous mastery becomes 30 days',()=>a.equal(m(repeat).upcoming[0].interval,30));
check('second mastery becomes 14 days',()=>a.equal(m({'2026-10-01':repeat['2026-10-01'],'2026-10-15':repeat['2026-10-15']}).upcoming[0].interval,14));
check('mastery reset after weakness',()=>{const s={'2026-10-01':repeat['2026-10-01'],'2026-10-08':{essayAssessments:{psych:entry('心理學',1)}},'2026-10-15':repeat['2026-10-15']};a.equal(m(s).upcoming[0].interval,7)});
check('incomplete score ignored',()=>{const bad=entry('心理學',1);delete bad.scores.definition;const r=m(record(today,'psych',bad));a.equal(r.all.length,0);a.equal(r.incomplete,1)});
check('future record ignored',()=>a.equal(m(record('2026-10-16','psych',entry('心理學',1))).all.length,0));
check('invalid date ignored',()=>a.equal(m(record('no-date','psych',entry('心理學',1))).all.length,0));
check('past due remains due',()=>a.equal(m(record('2026-09-30','psych',entry('心理學',1))).due.length,1));
check('law subject separated',()=>a.equal(m(record('2026-10-12','law',entry('刑法',3))).all[0].subject,'刑法'));
check('today subject match on review',()=>a.equal(m(record('2026-10-12','psych',entry('心理學',3))).due[0].todayMatch,true));
check('other subject no match',()=>a.equal(m(record('2026-10-12','law',entry('刑法',3))).due[0].todayMatch,false));
check('original record not mutated',()=>{const s=record('2026-10-12','psych',entry('心理學',3));const before=JSON.stringify(s);m(s);a.equal(JSON.stringify(s),before)});
check('multiple subjects coexist',()=>{const s={'2026-10-12':{essayAssessments:{psych:entry('心理學',3),law:entry('刑法',3)}}};a.equal(m(s).due.length,2)});
check('latest assessment wins',()=>{const s={'2026-10-12':{essayAssessments:{psych:entry('心理學',1)}},'2026-10-15':{essayAssessments:{psych:entry('心理學',4)}}};a.equal(m(s).upcoming[0].interval,7)});
check('manual subject supported',()=>a.equal(m(record('2026-10-14','manual:2026-10-14:心理學',entry('心理學',1))).due[0].manual,true));
check('date ISO has correct month rollover',()=>a.equal(core.addDays('2026-10-31',1),'2026-11-01'));
check('invalid today makes empty result',()=>a.equal(m({},'2026-00-55').all.length,0));
console.log('TOTAL',passes,'stage3 review regressions: PASS');