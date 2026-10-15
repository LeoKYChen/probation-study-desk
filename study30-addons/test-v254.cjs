'use strict';
/* Pure analytics regression: only synthetic records; no browser storage, network, or model grader. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||'deploy-dist',window={addEventListener(){}};
const context={window,document:{readyState:'loading',addEventListener(){}},Date,console};
vm.runInNewContext(fs.readFileSync(path.join(root,'v254-diagnostics.js'),'utf8'),context);
const A=window.Study30V254Diagnostics;
const bank=[
 {id:'p',subject:'心理學',subjectGroup:'心理學',title:'心理學｜學習理論'},
 {id:'l',subject:'刑法',subjectGroup:'刑法',title:'刑法｜構成要件'},
 {id:'j',subject:'少年事件處理法',subjectGroup:'少年事件處理法',title:'少事法｜保護事件'},
 {id:'mix',subject:'刑事訴訟法與保安處分執行法',subjectGroup:'刑事訴訟法與保安處分執行法',title:'刑訴與保安｜程序'}];
const sessions={
 '2026-10-02':{questionId:'p',rating:'review',errorCause:'概念不熟'},
 '2026-10-08':{questionId:'p',rating:'partial',errorCause:'概念不熟'},
 '2026-10-09':{questionId:'l',rating:'review',errorCause:'案例涵攝'},
 '2026-10-11':{questionId:'p',rating:'mastered'},
 '2026-10-12':{questionId:'mix',rating:'partial'},
 '2026-10-13':{questionId:'unknown-342',rating:'review'},
 '2026-10-14':{questionId:'j',rating:'partial',errorCause:'法條待查'},
 '2026-10-15':{questionId:'l',rating:'review',errorCause:'案例涵攝'},
 '2026-10-16':{questionId:'p',rating:'review',errorCause:'未來不存在'},
 '2026-02-30':{questionId:'p',rating:'review'}};
const essay=[
 {day:'2026-10-08',id:'p',subject:'心理學',score:45,issues:['定義不清']},
 {day:'2026-10-11',id:'l',subject:'刑法',score:60,issues:['爭點缺漏']},
 {day:'2026-10-13',id:'l',subject:'刑法',score:75,issues:['爭點缺漏']},
 {day:'2026-10-15',id:'p',subject:'心理學',score:75,issues:['定義不清']},
 {day:'2026-10-14',id:'j',subject:'少年事件處理法',score:85,issues:[]},
 {day:'2026-10-16',id:'p',subject:'心理學',score:2,issues:['不應納入']}];
const due=[{id:'p',subject:'心理學',daysUntil:-2},{id:'l',subject:'刑法',daysUntil:0},{id:'l',subject:'刑法',daysUntil:0},{id:'mix',subject:'刑事訴訟法與保安處分執行法',daysUntil:1}];
const today='2026-10-15',all=A.analyze(sessions,bank,essay,due,today,'all'),last7=A.analyze(sessions,bank,essay,due,today,7);
const s=(model,name)=>model.subjects.find(x=>x.subject===name);
let count=0;function check(name,fn){fn();console.log('PASS '+ ++count+' '+name);}
check('seven original study subjects',()=>assert.equal(A.SUBJECTS.length,7));
check('combined criminal procedure maps both study subjects',()=>assert.equal(A.subjectsOf(bank[3]).length,2));
check('unrelated question has no assigned subject',()=>assert.equal(A.subjectsOf({subject:'民法'}).length,0));
check('source bank size reflected rather than invented',()=>assert.equal(all.totals.uniqueBankQuestions,4));
check('future daily excluded',()=>assert.equal(all.totals.dailyAttempts,6));
check('unknown 342 question excluded',()=>assert.equal(all.totals.dailyAttempts,6));
check('invalid calendar day excluded',()=>assert.equal(all.totals.dailyAttempts,6));
check('7-day period filters earlier attempts',()=>assert.equal(last7.totals.dailyAttempts,4));
check('30-day filter accepted',()=>assert.equal(A.analyze(sessions,bank,essay,due,today,30).period,30));
check('90-day filter accepted',()=>assert.equal(A.analyze(sessions,bank,essay,due,today,90).period,90));
check('unknown period defaults to 30',()=>assert.equal(A.analyze(sessions,bank,essay,due,today,'oops').period,30));
check('all period includes original attempts',()=>assert.equal(all.totals.dailyAttempts,6));
check('one topic improvement from review to partial',()=>assert.equal(all.totals.dailyBetter,2));
check('daily same rating reattempt is not improvement',()=>assert.equal(s(all,'刑法').dailySame,1));
check('psychology current mastered once',()=>assert.equal(s(all,'心理學').mastered,1));
check('psychology needs work currently zero',()=>assert.equal(s(all,'心理學').needsWork,0));
check('criminal law currently needs work once',()=>assert.equal(s(all,'刑法').needsWork,1));
check('psychology distinct daily questions',()=>assert.equal(s(all,'心理學').dailyQuestions,1));
check('criminal law has one distinct question',()=>assert.equal(s(all,'刑法').dailyQuestions,1));
check('combined counts in criminal procedure',()=>assert.equal(s(all,'刑事訴訟法').dailyQuestions,1));
check('combined counts in security measure enforcement',()=>assert.equal(s(all,'保安處分執行法').dailyQuestions,1));
check('overall total does not double-count combined',()=>assert.equal(all.totals.dailyAttempts,6));
check('deduplicate duplicate due records',()=>assert.equal(all.totals.dueQuestions,2));
check('criminal law due',()=>assert.equal(s(all,'刑法').due,2));
check('no unearned due juvenile',()=>assert.equal(s(all,'少年事件處理法').due,0));
check('essay entries filtered from future',()=>assert.equal(all.totals.essayAttempts,5));
check('essay average independent from daily review rating',()=>assert.equal(s(all,'心理學').essayAverage,60));
check('essay comparison same question across days',()=>assert.equal(s(all,'心理學').essayBetter,1));
check('essay comparison uses earlier baseline outside seven-day window',()=>assert.equal(s(last7,'心理學').essayBetter,1));
check('different questions not compared',()=>assert.equal(s(all,'少年事件處理法').essayBetter,0));
check('repeated psychology reason counts separate dates',()=>assert.equal(s(all,'心理學').repeatedReasons[0].count,2));
check('repeated criminal law reason tracked',()=>assert.ok(s(all,'刑法').repeatedReasons.some(x=>x.label.includes('案例涵攝'))));
check('individual repeated weak questions counted',()=>assert.equal(s(all,'刑法').recurringQuestions,1));
check('mastery clears latest work status even if earlier was weak',()=>assert.equal(s(all,'心理學').needsWork,0));
check('ranked priorities are evidence based',()=>assert.ok(all.priorities.length>0&&all.priorities.length<=3));
check('empty records do not claim any readiness score',()=>{
 const m=A.analyze({},bank,[],[],today,30);
 assert.equal(m.priorities.length,0);assert.equal(s(m,'心理學').essayAverage,null);
});
check('no user store mutation during analyses',()=>{
 const before=JSON.stringify(sessions),ess=JSON.stringify(essay),rev=JSON.stringify(due);
 A.analyze(sessions,bank,essay,due,today,7);
 assert.equal(JSON.stringify(sessions),before);assert.equal(JSON.stringify(essay),ess);assert.equal(JSON.stringify(due),rev);
});
check('invalid current date yields no attempts',()=>assert.equal(A.analyze(sessions,bank,essay,due,'2026-02-30','all').totals.dailyAttempts,0));
check('different day reasons counted once per label',()=>{
 const e=[{day:today,id:'l',subject:'刑法',score:45,issues:['爭點缺漏','爭點缺漏']}];
 const x=A.analyze({},bank,e,[],today,30);assert.equal(s(x,'刑法').repeatedReasons.length,0);
});
const raw=fs.readFileSync(path.join(root,'v254-diagnostics.js'),'utf8');
check('no storage writes or direct storage reads',()=>assert.ok(!/localStorage|sessionStorage|fetch\s*\(/.test(raw)));
check('source does not alter question selection',()=>assert.ok(!/session\.questionId\s*=|session\.rating\s*=/.test(raw)));
check('no 342 bank references',()=>assert.ok(!raw.includes('window.PREDICTED_QUESTION_BANK')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
check('v254 panel renders once',()=>assert.equal((html.match(/id="v254StudySummary"/g)||[]).length,1));
check('script correctly installed',()=>assert.ok(html.includes('src="./v254-diagnostics.js" defer')));
check('original daily and essay editors still present',()=>assert.ok(html.includes('id="dailyEssayWorkbenchSlot"')&&html.includes('id="essayEditor"')));
check('original local backup controls remain',()=>assert.ok(html.includes('id="importBackupFile"')));
const bankSrc=window.Study30QuestionSources;
console.log('TOTAL '+count+' v2.5.4 analytics checks: PASS');