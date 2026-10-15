'use strict';
/* Static release safeguards: no network, storage access or user data. */
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||path.join(__dirname,'../dist');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(x=>x[1]);
const local=scripts.filter(x=>x.startsWith('./')).map(x=>x.slice(2));
let n=0;function check(name,fn){fn();console.log('PASS',++n,name)}
check('bundled primary and related source present',()=>a.ok(local.includes('source-main-questions.js')&&local.includes('source-related-questions.js')));
check('no remote JavaScript dependencies',()=>a.deepEqual(scripts.filter(x=>/^https?:/.test(x)),[]));
check('all local scripts exist',()=>{for(const p of local)a.ok(fs.existsSync(path.join(root,p)),'missing '+p)});
check('all local scripts non-empty',()=>{for(const p of local)a.ok(fs.statSync(path.join(root,p)).size>100,'empty '+p)});
check('no duplicate script tags',()=>a.equal(new Set(local).size,local.length));
check('rubric before selfcheck',()=>a.ok(local.indexOf('essay-rubric-core.js')<local.indexOf('essay-selfcheck.js')));
check('review before analytics',()=>a.ok(local.indexOf('essay-review.js')<local.indexOf('essay-analytics.js')));
check('analytics before priority',()=>a.ok(local.indexOf('essay-analytics.js')<local.indexOf('weakness-priority.js')));
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]);
check('no duplicate DOM ids',()=>a.equal(new Set(ids).size,ids.length));
check('all critical controls',()=>{for(const id of ['todayHeading','timer','essayPracticeSubject','essayLab','essayReviewDue','essayAnalyticsSummary','weaknessPriorityList','export','openClearRecords'])a.ok(ids.includes(id),'missing '+id)});
check('original storage key preserved',()=>a.ok(app.includes("const KEY = 'probation-study30-v251:v1'")));
check('no localStorage.clear calls',()=>a.ok(!app.includes('localStorage.clear(')));
check('review separate from daily question',()=>a.ok(app.includes('function openEssayReview')&&app.includes('session.essayReviewTargetId=id;')));
check('daily subject rotation preserved',()=>a.ok(app.includes("const SUBJECTS = {1:'心理學',2:'諮商與輔導',3:'犯罪學',4:'少年事件處理法',5:'刑法'};")));
check('all study panels exactly once',()=>{for(const id of ['essayReviewHeading','essayAnalyticsHeading','weaknessPriorityHeading'])a.equal(ids.filter(x=>x===id).length,1)});
console.log('TOTAL',n,'site integrity checks: PASS');