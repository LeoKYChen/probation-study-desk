'use strict';
/* Verify the actual deployed source snapshots, selection rules, safe read-only diagnostics. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||'deploy-dist';
const win={addEventListener(){}},doc={readyState:'loading',addEventListener(){}};
const sandbox={window:win,document:doc,console,Date,JSON,Number,localStorage:{getItem(){return null}}};
const load=file=>vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
let passed=0;
const check=(name,test)=>{test();console.log('PASS '+ ++passed+' '+name)};
load('source-main-questions.js');load('source-related-questions.js');load('question-sources.js');load('data-health.js');
const Q=win.Study30QuestionSources,D=win.Study30DataHealth;
check('main count 374',()=>a.equal(Q.primaryCount,374));
check('related count 52',()=>a.equal(Q.relatedCount,52));
check('total 426',()=>a.equal(Q.total,426));
check('all IDs unique',()=>a.equal(new Set(Q.all.map(q=>q.id)).size,426));
check('zero duplicated IDs',()=>a.equal(Q.duplicates.length,0));
check('source classification preserved',()=>a.equal(Q.all.filter(q=>q.sourceCategory==='相關類科考古題').length,52));
check('prediction bank is absent',()=>a.equal(Q.predictedQuestionCount,0));
check('original exam type preserved',()=>a.ok(Q.all.some(q=>q.examTypes.includes('監獄官'))));
check('related exam types preserved',()=>a.ok(Q.all.some(q=>q.examTypes.includes('心理測驗員'))));
check('related psychology now included',()=>a.ok(Q.all.some(q=>q.sourceCategory==='相關類科考古題'&&q.subject==='心理學')));
check('related juvenile law now included',()=>a.ok(Q.all.some(q=>q.sourceCategory==='相關類科考古題'&&q.subject==='少年事件處理法')));
check('all entries have question body',()=>a.ok(Q.all.every(q=>q.body?.length>0)));
check('every original ID retained',()=>a.ok(win.QUESTION_BANK.every(q=>Q.all.find(z=>z.id===q.id))));
check('every related ID retained',()=>a.ok(win.RELATED_QUESTION_BANK.every(q=>Q.all.find(z=>z.id===q.id))));

const studyTargets=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法'];
const clean=s=>String(s||'').replace(/[（(].*?[）)]/g,'').trim();
const isCandidate=(q,t)=>[clean(q.subject),clean(q.subjectGroup)].some(x=>x===t||(x==='刑事訴訟法與保安處分執行法'&&['刑事訴訟法','保安處分執行法'].includes(t)));
check('every one of 426 maps to at least one subject',()=>a.ok(Q.all.every(q=>studyTargets.some(t=>isCandidate(q,t)))));
check('seven subjects each have matching questions',()=>a.ok(studyTargets.every(t=>Q.all.some(q=>isCandidate(q,t)))));
check('all 52 related questions are selectable',()=>a.equal(Q.all.filter(q=>q.sourceCategory==='相關類科考古題'&&studyTargets.some(t=>isCandidate(q,t))).length,52));

const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
check('app binds to merged bank',()=>a.ok(app.includes('window.Study30QuestionSources?.all')));
check('app no longer restricts pool to probation only',()=>a.ok(app.includes('const pool = target => BANK.filter(q=>candidateSubject(q,target));')));
check('old storage key retained',()=>a.ok(app.includes("const KEY = 'probation-study30-v251:v1'")));
check('data-health storage key matches',()=>a.equal(D.key,'probation-study30-v251:v1'));
check('empty local storage safe',()=>a.equal(D.examine(null).days,0));
check('valid legacy record accepted',()=>{
 const x=D.examine(JSON.stringify({version:1,sessions:{'2026-10-15':{elapsed:60,notes:['a']}}}));a.equal(x.days,1);a.ok(x.ok);
});
check('essay assessments counted',()=>{
 const x=D.examine(JSON.stringify({version:1,sessions:{'2026-10-15':{essayDrafts:{x:{}},essayAssessments:{x:{}}}}}));a.equal(x.drafts,1);a.equal(x.assessments,1);
});
check('invalid JSON warning',()=>a.equal(D.examine('{bad').ok,false));
check('wrong record format warning',()=>a.equal(D.examine(JSON.stringify({version:2,sessions:{}})).ok,false));
check('storage size threshold triggers backup reminder',()=>a.equal(D.examine(JSON.stringify({version:1,sessions:{'2026-10-15':{big:'x'.repeat(1100000)}}})).needsBackup,true));
check('diagnostics never clear browser storage',()=>a.ok(!fs.readFileSync(path.join(root,'data-health.js'),'utf8').includes('removeItem(')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
check('main and related scripts installed',()=>a.ok(html.includes('src="./source-main-questions.js"')&&html.includes('src="./source-related-questions.js"')));
check('source bank loaded before app',()=>a.ok(html.indexOf('src="./question-sources.js"')<html.indexOf('src="./app.js"')));
check('source summary panel installed',()=>a.ok(html.includes('id="questionSourceSummary"')));
check('data-health panel installed',()=>a.ok(html.includes('id="dataHealthSummary"')));
check('not loading old remote source',()=>a.ok(!html.includes('src="https://leokychen.github.io/probation-study-desk/v2.5/questions.js"')));
console.log('TOTAL '+passed+' source and storage regressions: PASS');