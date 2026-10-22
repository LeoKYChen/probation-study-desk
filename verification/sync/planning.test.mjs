import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intervals,topicScope,validateMapping,planLimits,readLectures} from '../../study-desk/planning.js';
import {recommend,newAttempt,nextReview} from '../../study-desk/domain.js';
import {emptyState} from '../../cloud-sync/core.js';
const q={id:'psych',title:'信度與效度',body:'比較兩者',subject:'心理學',topicKey:'psych-topic'};
const course={courses:[{id:'c',name:'心理學函授',subject:'心理學'}],lessons:[{id:'l',courseId:'c',title:'測驗理論',watchedMinutes:30,durationMinutes:60}]};
function prefs(){return {subjects:{心理學:{enabled:true,weight:1}},learnedTopics:[],topicLessons:{}};}
test('watching lectures alone never establishes learned scope; explicit mapping plus completion does',()=>{
 const p=prefs();assert.equal(topicScope(q,p,course).learned,false);p.topicLessons[q.topicKey]=validateMapping(q,'l',course);assert.equal(topicScope(q,p,course).learned,false);
 const completed=structuredClone(course);completed.lessons[0].watchedMinutes=60;assert.equal(topicScope(q,p,completed).learned,true);assert.equal(recommend(emptyState(),[q],p,[],{lectures:completed}).type,'new');assert.equal(recommend(emptyState(),[q],p,[],{lectures:course}).type,'empty');
});
test('removed lesson or explicit invalid-live context cannot use an old completed snapshot',()=>{
 const p=prefs();p.topicLessons[q.topicKey]=validateMapping(q,'l',course);const s=emptyState(),completed=structuredClone(course);completed.lessons[0].watchedMinutes=60;s.records['settings/lecture-progress']={value:{data:completed}};
 assert.equal(recommend(s,[q],p).type,'new');assert.equal(recommend(s,[q],p,[],{lectures:null}).type,'empty');assert.equal(topicScope(q,p,{...completed,lessons:[]}).learned,false);
});
test('explicit learned confirmation can cover material learned outside lectures',()=>{const p=prefs();p.learnedTopics=[q.topicKey];assert.equal(topicScope(q,p,null).learned,true);assert.throws(()=>validateMapping(q,'missing',course),/存在/);});
test('scope reader does not modify legacy storage',()=>{let writes=0;const s={getItem:()=>'{"raw":true}',setItem:()=>writes++},core={KEY:'lectures',normalize:x=>x};assert.deepEqual(readLectures(s,core),{raw:true});assert.equal(writes,0);});
test('custom review settings cross calendar boundaries and reject invalid order',()=>{assert.equal(nextReview('hint',new Date('2026-10-31T00:00:00Z'),{again:2,hint:5,independent:9}),'2026-11-05');assert.throws(()=>intervals({again:3,hint:1,independent:9}),/依序/);assert.throws(()=>intervals({again:0,hint:3,independent:9}),/365/);});
test('short budgets do not overbook extra reviews or change old due dates',()=>{
 const p=prefs();p.planning={minutes:10,reviewLimit:5};const s=emptyState();for(let i=0;i<4;i++){s.records['attempt/'+i]={value:{...newAttempt(q,'full'),correctedAt:'saved',due:'2026-01-01'},deleted:false};}
 const before=structuredClone(s);const result=recommend(s,[q],p,[],{date:new Date('2026-10-22T00:00:00Z')});assert.equal(result.type,'review');assert.equal(result.mainMinutes,10);assert.equal(result.due.length,0);assert.equal(result.deferredReviews,3);assert.deepEqual(s,before);assert.throws(()=>planLimits({planning:{minutes:0}}),/時間預算/);
});
test('weak-topic priority stays within balanced subject selection and reasons are reproducible',()=>{
 const p=prefs();p.learnedTopics=['normal','weak'];p.weakTopics=['weak'];const qs=[{...q,id:'a',topicKey:'normal'},{...q,id:'b',topicKey:'weak'}],s=emptyState();const opts={date:new Date('2026-10-22T00:00:00Z')};const first=recommend(s,qs,p,[],opts);assert.equal(first.question.id,'b');assert.deepEqual(first,recommend(s,qs,p,[],opts));assert.equal(first.audit.selectedId,'b');assert.equal(first.audit.excluded.scopeUnknown,0);
});

test('legacy essay conversion is deterministic, leaves source intact and does not invent completion',async()=>{
 const {convertibleAttempts}=await import('../../study-desk/legacy.js');
 const snapshot={kind:'legacy',origin:'https://example.test',key:'probation-study30-v251:v1',oldId:'2026-10-22',data:{essayDrafts:{psych:{fullAnswer:'原始申論',outline:['提綱'],updatedAt:'2026-10-22T01:00:00Z'}},aiReviewTexts:{psych:'原有評語'}}};
 const before=structuredClone(snapshot),first=convertibleAttempts('legacy/abc',snapshot,[q]);assert.deepEqual(first,convertibleAttempts('legacy/abc',snapshot,[q]));assert.deepEqual(snapshot,before);assert.equal(first[0].value.answer,'原始申論');assert.equal(first[0].value.feedback[0].text,'原有評語');assert.equal(first[0].value.checkedAt,null);assert.equal(first[0].value.answeredAt,null);assert.equal(first[0].value.correctedAt,null);
 const unknown=convertibleAttempts('legacy/def',{...snapshot,data:{essayDrafts:{missing:{fullAnswer:'日期未知'}}}},[]);assert.equal(unknown[0].value.revisions[0].at,'原紀錄日期不詳');assert.match(unknown[0].value.question.body,/未能/);
});

test('invalid imported progress and settings are rejected before application',async()=>{
 const {validatePreferences}=await import('../../study-desk/planning.js');
 assert.throws(()=>validatePreferences({subjects:{},learnedTopics:'all topics'}),/主題清單/);
 assert.throws(()=>validatePreferences({subjects:{心理學:{enabled:true,weight:0}}}),/權重/);
 assert.throws(()=>validatePreferences({subjects:{},topicLessons:{x:{lessonId:'l'}}}),/對應/);
 assert.deepEqual(validatePreferences({subjects:{},learnedTopics:[]}).reviewIntervals,{again:1,hint:3,independent:7});
});
