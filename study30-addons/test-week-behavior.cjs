/* Focused behavioral checks on the production function from the built app.js. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync((process.argv[2]||'deploy-dist')+'/app.js','utf8');
const source=app.match(/  function selectWeekPractice\(iso\)\{[\s\S]*?\n  \}/)?.[0];
assert.ok(source,'Production week-selector function not found');
const today='2026-10-15',prior='2026-10-13',future='2026-10-16',outside='2026-10-11';
let count=0;function test(name,fn){fn();console.log('PASS',++count,name);}
const todayRecord={date:today,questionId:'today-id',notes:['今天原有草稿'],elapsed:250,finished:false};
const oldRecord={date:prior,questionId:'old-id',notes:['以前的草稿'],elapsed:310,finished:false};
const state={
  store:{sessions:{[today]:todayRecord,[prior]:oldRecord}},
  session:todayRecord,selectedPracticeDate:null,
  isoTaipei:()=>today,
  dayIndex:iso=>Math.floor(Date.parse(iso+'T00:00:00Z')/86400000),
  dayNumber:iso=>new Date(iso+'T12:00:00+08:00').getUTCDay(),
  pause:()=>{state.pauses++},pauses:0,
  render:()=>{state.renders++},renders:0,
  persist:()=>{state.saves++},saves:0,
  say:txt=>{state.notice=txt},notice:'',
  newSession:iso=>({date:iso,questionId:'initial',notes:[],elapsed:0,mode:'30',finished:false}),
  subjectFor:iso=>({sunday:false,target:'諮商與輔導'}),
  pool:target=>[{id:'fixed-original-question',subject:target}],
  pick:arr=>arr[0],
  $:()=>({scrollIntoView(){}}),Date
};
vm.runInNewContext(source+'\nthis.choose=selectWeekPractice;',state);
test('saved Tuesday session reused',()=>{state.choose(prior);assert.strictEqual(state.session,oldRecord);assert.equal(state.selectedPracticeDate,prior);assert.equal(state.session.notes[0],'以前的草稿');});
test('return to today retains untouched session',()=>{state.choose(today);assert.strictEqual(state.session,todayRecord);assert.equal(state.selectedPracticeDate,null);assert.equal(state.session.notes[0],'今天原有草稿');});
test('new past day creates exactly one record',()=>{state.choose('2026-10-14');assert.equal(state.session.date,'2026-10-14');assert.equal(state.session.questionId,'fixed-original-question');assert.equal(state.saves,1);});
test('re-entering past day does not replace its record',()=>{const original=state.session;state.choose('2026-10-14');assert.strictEqual(state.session,original);assert.equal(state.saves,1);});
test('future date rejected without mutation',()=>{const old=state.session;state.choose(future);assert.strictEqual(state.session,old);assert.equal(state.store.sessions[future],undefined);assert.match(state.notice,/只能補練/);});
test('previous week rejected without mutation',()=>{const old=state.session;state.choose(outside);assert.strictEqual(state.session,old);assert.equal(state.store.sessions[outside],undefined);});
test('invalid date rejected',()=>{const old=state.session;state.choose('not-a-date');assert.strictEqual(state.session,old);});
test('timer paused before every real switch',()=>assert.ok(state.pauses>=4));
test('date selection repaints the existing workspace',()=>assert.ok(state.renders>=4));
console.log('TOTAL',count,'week-switch behavior tests PASS');