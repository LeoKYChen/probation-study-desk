/* 讀書計畫：階段與週次、手動記錄格式、本週清單、檢核點與頁面接線檢查，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const ctx={window:w,localStorage:{getItem(){return null;},setItem(){throw new Error('pure functions must not write');}}};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
['data.js','exam-design/index.js','app.js','rounds.js','plan.js'].forEach(f=>vm.runInNewContext(read('law-scoring/'+f),ctx,{filename:f}));
const SP=w.LawScoringStudyPlan,RD=w.LawScoringRounds,Q=w.LawScoringData.questions,LS=w.LawScoring;
const plain=x=>JSON.parse(JSON.stringify(x));
const code=read('law-scoring/plan.js').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
assert(!/innerHTML|insertAdjacentHTML|document\.write/.test(code),'content is built with DOM nodes only');
assert.equal((code.match(/localStorage\.setItem\(/g)||[]).length,1,'the page writes in exactly one place'); assert(/localStorage\.setItem\(KEY,/.test(code),'and only its own key');

// 階段、週次（週一到週日）、考試日期
assert.equal(SP.START,'2026-11-16'); assert.equal(SP.monday('2026-11-22'),'2026-11-16'); assert.equal(SP.monday('2026-11-16'),'2026-11-16'); assert.equal(SP.monday('2026-11-23'),'2026-11-23');
assert.equal(SP.weekNo('2026-11-16'),1); assert.equal(SP.weekNo('2026-11-22'),1); assert.equal(SP.weekNo('2026-11-23'),2); assert.equal(SP.weekNo('2027-02-28'),15); assert.equal(SP.weekNo('2026-11-15'),0);
assert.equal(SP.phaseOf('2026-11-15').n,1); assert.equal(SP.phaseOf('2027-02-28').n,1); assert.equal(SP.phaseOf('2027-03-01').n,2); assert.equal(SP.phaseOf('2027-06-13').n,2); assert.equal(SP.phaseOf('2027-06-14').n,3); assert.equal(SP.phaseOf('2027-09-01').n,3);
for(let i=1;i<SP.PHASES.length;i++) assert.equal(SP.diffDays(SP.PHASES[i].start,SP.PHASES[i-1].end),1,'phases are contiguous');
assert.deepEqual(plain(SP.examDate(null)),{date:'2027-08-14',set:false}); assert.deepEqual(plain(SP.examDate({date:'2027-08-07',name:'x'})),{date:'2027-08-07',set:true}); assert.equal(SP.examDate({date:'nope'}).set,false);
assert.deepEqual(plain(SP.CHECKPOINTS.map(c=>c.date)),['2026-12-13','2027-01-10','2027-02-28','2027-04-30','2027-06-13']);

// 手動記錄：加減堂數、打勾、格式來回
const empty=SP.normalize(null), D='2026-11-18';
let s=SP.bumpPsych(empty,D,1); s=SP.bumpPsych(s,D,1); s=SP.bumpPsych(s,'2026-11-28',1);
assert.equal(s.psych,3); assert.equal(s.weeks['2026-11-16'].psych,2); assert.equal(s.weeks['2026-11-23'].psych,1); assert.equal(empty.psych,0,'bump does not mutate');
assert.equal(SP.bumpPsych(empty,D,-1),empty,'cannot go below zero');
let down=SP.bumpPsych(s,'2026-12-02',-1); assert.equal(down.psych,2); assert.equal(down.weeks['2026-11-30'].psych,0,'a correction in a week with no lessons only lowers the total');
let full=empty; for(let i=0;i<40;i++) full=SP.bumpPsych(full,D,1); assert.equal(full.psych,34,'capped at the course length');
s=SP.setRead(s,D,'criminal',true); s=SP.setRead(s,D,'procedure',true); s=SP.setRead(s,D,'procedure',false); s=SP.setReread(s,'counseling',true); s=SP.setPaper(s,'psychology',true);
const packed=plain(SP.pack(s));
assert.deepEqual(packed,{'lecture:psych':{n:3},'done:reread':{counseling:true},'done:paper':{psychology:true},'week:2026-11-16':{psych:2,read:{criminal:true}},'week:2026-11-23':{psych:1,read:{}}});
assert.deepEqual(plain(SP.pack(SP.normalize(packed))),packed,'round trip');
for(const v of Object.values(packed)) assert(v&&typeof v==='object'&&!Array.isArray(v),'every value is a record, as the backup expects');
assert.deepEqual(plain(SP.pack(SP.normalize({'lecture:psych':{n:99},'week:bad':{psych:1},'week:2026-11-16':{psych:-2,read:{criminal:true,other:true,procedure:'yes'}},'done:reread':{x:true},junk:5}))),{'lecture:psych':{n:34},'week:2026-11-16':{read:{criminal:true}}});
assert.equal(SP.readWeeks(s,'criminal'),1); assert.equal(SP.readWeeks(s,'procedure'),0);

// 從既有紀錄讀數字
const study30={version:1,sessions:{'2026-11-16':{questionId:'a',finished:true},'2026-11-17':{questionId:'b',rating:'review'},'2026-11-18':{questionId:'c',finished:false,rating:''},'2026-11-23':{questionId:'d',finished:true}}};
const scoreStore={q1:{history:[{d:'2026-11-20',score:70},{d:'2026-11-09',score:50}]},q2:{answer:'x'},q3:{history:'bad'}};
assert.equal(SP.writesInWeek(study30,scoreStore,D),3,'two daily sessions with progress plus one saved attempt'); assert.equal(SP.writesInWeek(study30,scoreStore,'2026-11-24'),1); assert.equal(SP.writesInWeek(null,null,D),0);
const slots=RD.slots(Q); let rs=RD.normalize(null); for(const x of slots.slice(0,7)) rs=RD.record(rs,x.id,'good','2026-11-17',1); rs=RD.record(rs,'mock:m1','good','2026-11-17',1); rs=RD.record(rs,slots[7].id,'good','2026-11-09',1);
const rw=SP.roundsInWeek(RD,Q,rs,D); assert.equal(rw.done,7); assert.equal(rw.mock,1); assert.equal(rw.target,30); assert.equal(rw.perDay,5); assert.equal(rw.round,1); assert.equal(rw.roundDone,8); assert.equal(SP.roundsInWeek(null,Q,null,D),null);
const env={state:s,today:D,RD,questions:Q,roundState:rs,study30,scoreStore};
const ws=SP.weekStats(env); assert.equal(ws.phase.n,1); assert.equal(ws.week,1); assert.equal(ws.monday,'2026-11-16'); assert.equal(ws.sunday,'2026-11-22');
assert.deepEqual(plain(ws.write),{done:3,target:1}); assert.deepEqual(plain(ws.psych),{week:2,total:3,of:34,target:[2,3]});
assert.deepEqual(plain(ws.read),[{id:'criminal',name:'刑法',week:true,done:false,weeks:1},{id:'procedure',name:'刑事訴訟法',week:false,done:false,weeks:0},{id:'criminology',name:'犯罪學',week:false,done:false,weeks:0},{id:'counseling',name:'諮商與輔導',week:false,done:true,weeks:0}]);
assert.equal(SP.weekStats(Object.assign({},env,{today:'2027-03-02'})).write.target,6); assert.equal(SP.weekStats(Object.assign({},env,{state:full})).psych.target,null,'no weekly lesson target once the course is finished');

// 檢核點
let cps=SP.checkpoints(env); assert.deepEqual(plain(cps.map(c=>c.status)),['todo','todo','todo','todo','todo']); assert.equal(cps[0].days,25); assert.equal(cps[0].items[0].ok,false); assert.equal(cps[0].items[1].ok,true);
cps=SP.checkpoints(Object.assign({},env,{today:'2026-12-14'})); assert.equal(cps[0].status,'late','past the date without ten lessons'); assert.equal(cps[1].status,'todo');
let good=SP.normalize(null); for(let i=0;i<34;i++) good=SP.bumpPsych(good,D,1); for(const [id] of SP.REREAD) good=SP.setReread(good,id,true); for(const [id] of SP.PAPERS) good=SP.setPaper(good,id,true);
let rsHalf=RD.normalize(null); for(const x of slots.slice(0,277)) rsHalf=RD.record(rsHalf,x.id,'good','2026-11-17',1);
cps=SP.checkpoints({state:good,today:'2026-11-18',RD,questions:Q,roundState:rsHalf,study30:{version:1,sessions:{'2026-11-16':{finished:true},'2026-11-17':{finished:true},'2026-11-18':{finished:true},'2026-11-19':{finished:true},'2026-11-20':{finished:true},'2026-11-21':{finished:true}}},scoreStore:null});
assert.deepEqual(plain(cps.map(c=>c.status)),['done','done','done','done','done'],'everything met shows as done even before the dates');
cps=SP.checkpoints({state:SP.normalize(null),today:'2027-07-01',RD,questions:Q,roundState:RD.normalize(null),study30:null,scoreStore:null}); assert.deepEqual(plain(cps.map(c=>c.status)),['late','late','late','late','late']); assert(cps.every(c=>c.fallback));
cps=SP.checkpoints({state:SP.normalize(null),today:D,RD:null,questions:Q,roundState:null,study30:null,scoreStore:null}); assert.equal(cps[0].items[1].ok,false,'no rounds data is not counted as met'); assert.equal(cps[0].items[1].detail,'讀不到');
// 四科各讀 6 週即算約三分之一
let six=SP.normalize(null); for(let i=0;i<20;i++) six=SP.bumpPsych(six,D,1); 
for(let wk=0;wk<6;wk++){ const day=['2026-11-16','2026-11-23','2026-11-30','2026-12-07','2026-12-14','2026-12-21'][wk]; for(const [id] of SP.REREAD) six=SP.setRead(six,day,id,true); }
assert.equal(SP.checkpoints(Object.assign({},env,{state:six}))[1].status,'done');

// 今日清單摘要
assert.deepEqual(plain(SP.summary(s,D)),{phase:'打底',week:1,started:true,psych:3,psychTotal:34,next:'2026-12-13'}); assert.equal(SP.summary(s,'2026-11-15').started,false); assert.equal(SP.summary(s,'2027-07-01').next,null);
{ const out=LS.todayPlan({store:{},today:D,data:w.LawScoringData,SP,planState:s}); assert.deepEqual(plain(out.plan),{phase:'打底',week:1,started:true,psych:3,psychTotal:34,next:'2026-12-13'}); assert.equal(LS.todayPlan({store:{},today:D,data:w.LawScoringData}).plan,null); }

// 頁面接線、離線清單、備份
const html=read('law-scoring/plan.html');
for(const id of new Set((code.match(/\$\('([^']+)'\)/g)||[]).map(x=>x.slice(3,-2)))) assert(html.includes('id="'+id+'"'),'script uses #'+id+' which the page has');
assert(html.includes('id="plan-root"')); const order=['data.js','rounds.js','plan.js'].map(f=>html.indexOf('src="'+f+'"')); assert(order.every((x,i)=>x>0&&(i===0||x>order[i-1])),'scripts load in dependency order');
assert(read('law-scoring/index.html').includes('href="plan.html"')&&read('law-scoring/rounds.html').includes('href="plan.html"'),'entry links'); assert(read('law-scoring/app.js').includes("'plan.js'"),'today list loads plan.js');
const manifest=new Set(JSON.parse(read('offline-manifest.json')).assets.map(a=>a.url)),sw=read('sw.js');
for(const f of ['law-scoring/plan.html','law-scoring/plan.js','law-scoring/plan.css']){ assert(manifest.has(f),'offline manifest has '+f); assert(sw.includes("'"+f+"'"),'service worker fetches '+f+' network-first'); }
assert(read('backup/unified-core.js').includes("key:'"+SP.KEY+"'")&&read('backup/app.js').includes("'"+SP.KEY+"'"),'manual plan records are in the full backup');
const freeze=JSON.parse(read('docs/stability-freeze-policy.json')).criticalPaths; for(const f of ['law-scoring/plan.html','law-scoring/plan.js']) assert(!freeze.includes(f));
console.log('PASS law-scoring plan: phases, manual records, weekly numbers, checkpoints, wiring');
