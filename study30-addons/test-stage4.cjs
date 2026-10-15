/* Automated regression checks; Node built-ins only, no live user data. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root={addEventListener(){},Study30Rubric:null};
const context={window:root,document:{readyState:'loading',addEventListener(){}},Date,console};
const dir=__dirname;
const rubricPath=process.argv[2]||path.join(dir,'../dist/essay-rubric-core.js');
vm.runInNewContext(fs.readFileSync(rubricPath,'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(dir,'essay-analytics.js'),'utf8'),context);
const A=root.Study30EssayAnalytics,R=root.Study30Rubric;
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+String(passed).padStart(2,'0')+' '+name);}
const base='2026-10-15';
function assessment(subject,score=4,extra={}){
 const type=R.subjectType(subject),scores=Object.fromEntries(R.RULES[type].criteria.map(c=>[c.id,score]));
 return {version:1,rubric:type,subject,questionHeading:subject+'練習題',scores,issues:[],nextStep:'',...extra};
}
const sessions={
 '2026-10-01':{essayAssessments:{p:assessment('心理學',1,{issues:['理論或學者混淆']})}},
 '2026-10-08':{essayAssessments:{p:assessment('心理學',3,{issues:['機制解釋不足']}),c:assessment('犯罪學',4)}},
 '2026-10-10':{essayAssessments:{p:assessment('心理學',4),l:assessment('刑法',2,{issues:['案例涵攝薄弱']})}},
 '2026-10-15':{essayAssessments:{p:assessment('心理學',3,{issues:['機制解釋不足']}),u:assessment('諮商與輔導',4),x:assessment('犯罪學',3,{scores:{theory:3}})}},
 '2026-10-16':{essayAssessments:{future:assessment('刑事訴訟法',4)}},
 garbage:{essayAssessments:{n:assessment('犯罪學',4)}}
};
const bank=[{id:'p',subject:'心理學'}, {id:'c',subject:'犯罪學'}, {id:'l',subject:'刑法'}, {id:'u',subject:'諮商與輔導'}, {id:'x',subject:'犯罪學'}];
const rows=A.collect(sessions,bank,base),all=A.summarize(rows,base,'all','all');
check('complete scores across subjects',()=>assert.equal(rows.length,7));
check('exclude future sessions',()=>assert.ok(rows.every(r=>r.day<=base)));
check('exclude malformed dates',()=>assert.ok(!rows.some(r=>r.day==='garbage')));
check('exclude incomplete scores',()=>assert.ok(!rows.some(r=>r.id==='x')));
check('retain assessed subject',()=>assert.equal(rows.find(r=>r.id==='l').subject,'刑法'));
check('weighted score for law',()=>assert.equal(rows.find(r=>r.id==='l').score,50));
check('complete assessment count',()=>assert.equal(all.count,7));
check('distinct days',()=>assert.equal(all.activeDays,4));
check('self-score average',()=>assert.equal(all.average,Math.round((25+75+100+100+50+75+100)/7)));
check('score bounded 100',()=>assert.ok(all.average<=100));
check('psychology count',()=>assert.equal(all.perSubject.find(s=>s.subject==='心理學').count,4));
check('psychology average',()=>assert.equal(all.perSubject.find(s=>s.subject==='心理學').average,69));
check('7 day filter',()=>assert.equal(A.summarize(rows,base,'7','all').count,4));
check('30 day filter',()=>assert.equal(A.summarize(rows,base,'30','all').count,7));
check('subject filter',()=>assert.equal(A.summarize(rows,base,'all','刑法').count,1));
check('absent subject zero',()=>assert.equal(A.summarize(rows,base,'7','保安處分執行法').count,0));
check('empty score not fabricated',()=>assert.equal(A.summarize(rows,base,'7','保安處分執行法').average,null));
check('three psychology comparisons',()=>assert.equal(A.summarize(rows,base,'all','心理學').repeatPairs,3));
check('two improvements',()=>assert.equal(A.summarize(rows,base,'all','心理學').improved,2));
check('one decline',()=>assert.equal(A.summarize(rows,base,'all','心理學').declined,1));
check('most common weakness label',()=>assert.equal(all.weaknesses[0].name,'機制解釋不足'));
check('two mechanism weakness events',()=>assert.equal(all.weaknesses[0].count,2));
check('daily entries count',()=>assert.equal(all.trend.find(r=>r.day==='2026-10-08').count,2));
check('daily score mean',()=>assert.equal(all.trend.find(r=>r.day==='2026-10-08').average,88));
check('criteria percent from scores',()=>assert.ok(all.criteria.some(c=>c.percent===50)));
check('never modify input records',()=>assert.equal(sessions['2026-10-08'].essayAssessments.p.scores.definition,3));
check('legacy subject from bank',()=>{
 const old=assessment('心理學',2);delete old.subject;
 assert.equal(A.collect({'2026-10-11':{essayAssessments:{p:old}}},bank,base)[0].subject,'心理學');
});
check('manual subject from ID',()=>{
 const old=assessment('犯罪學',4);delete old.subject;
 assert.equal(A.collect({'2026-10-11':{essayAssessments:{'manual:2026-10-11:犯罪學':old}}},[],base)[0].subject,'犯罪學');
});
check('invalid rubric excluded',()=>{
 const bad=assessment('刑法',4,{issues:['NOT IN RUBRIC']});
 assert.equal(A.collect({'2026-10-12':{essayAssessments:{bad}}},bank,base).length,0);
});
check('distinct questions not confused',()=>assert.equal(A.summarize(rows,base,'7','all').repeatPairs,1));
check('seven subject groups',()=>assert.equal(all.perSubject.length,7));
check('all includes 30 days',()=>assert.ok(A.summarize(rows,base,'all','all').count>=A.summarize(rows,base,'30','all').count));
console.log('TOTAL '+passed+' analytics regressions: PASS');