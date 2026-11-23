/* 今日題組（輪次練習）：題目順序、進度表、今日題組、紀錄格式、模擬題挑選與頁面接線檢查，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const ctx={window:w,localStorage:{getItem(){return null;},setItem(){throw new Error('pure functions must not write');}}};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const run=f=>vm.runInNewContext(read(f),ctx,{filename:f});
['data.js','exam-design/index.js','app.js','rounds.js'].forEach(f=>run('law-scoring/'+f));
const RD=w.LawScoringRounds,Q=w.LawScoringData.questions,LS=w.LawScoring;
const plain=x=>JSON.parse(JSON.stringify(x));
const code=read('law-scoring/rounds.js').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
assert(!/innerHTML|insertAdjacentHTML|document\.write/.test(code),'content is built with DOM nodes only');
assert(!/lawScoring\.v2/.test(code),'the scoring store is never named, so it cannot be written');
assert.equal((code.match(/DAILY_KEY/g)||[]).length,2,'the mock practice records are read in exactly one place');
assert(/readJSON\(DAILY_KEY\)/.test(code),'and only read');

// 範圍：觀護人 190 題 5 輪、相關類科 363 題 3 輪，共 2,039 題次；每輪每天 60 分鐘
const guan=Q.filter(RD.isGuan); assert.equal(Q.length,553); assert.equal(guan.length,190);
assert.deepEqual(plain(RD.sizes(Q)),[553,553,553,190,190]);
for(const r of RD.ROUNDS) assert.equal(r.min*r.perDay,60,'round '+r.n+' fills 60 minutes');
const slots=RD.slots(Q); assert.equal(slots.length,2039);
for(const r of RD.ROUNDS){
  const ids=RD.roundOrder(Q,r); assert.equal(new Set(ids).size,ids.length,'no repeats within round '+r.n);
  assert.equal(ids.length,r.scope==='guan'?190:553);
  const firstOther=ids.findIndex(id=>!RD.isGuan(Q.find(q=>q.id===id)));
  if(r.scope==='guan') assert.equal(firstOther,-1,'round '+r.n+' is probation questions only'); else assert.equal(firstOther,190,'probation questions come first in round '+r.n);
  assert.deepEqual(RD.roundOrder(Q,r),ids,'order is stable between runs');
}
// 各科平均：每輪各科輪流、一次一題。觀護人六科在題數用完前，任何連續 6 題都是 6 個不同科目；第 1 輪每天 5 題是 5 個不同科目
{ const by=new Map(Q.map(q=>[q.id,q])), key=id=>by.get(id).examType+'／'+by.get(id).subject;
  for(const r of RD.ROUNDS){ const ids=RD.roundOrder(Q,r); for(let i=0;i+6<=180;i++) assert.equal(new Set(ids.slice(i,i+6).map(key)).size,6,'round '+r.n+' window at '+i);
    if(r.scope!=='guan'){ const rest=ids.slice(190), groups=new Set(rest.map(key)).size; assert.equal(groups,14); assert.equal(new Set(rest.slice(0,groups).map(key)).size,groups,'related subjects also take turns'); } }
  const ids=RD.roundOrder(Q,RD.ROUNDS[0]); for(let d=0;d<36;d++) assert.equal(new Set(ids.slice(d*5,d*5+5).map(key)).size,5,'day '+(d+1)+' has five different subjects');
  const g0=by.get(ids[0]); assert.equal(g0.year,Math.max(...guan.filter(q=>q.subject===g0.subject).map(q=>q.year)),'newest year first');
  const per={}; ids.slice(0,30).forEach(id=>{per[key(id)]=(per[key(id)]||0)+1;}); assert.deepEqual(Object.values(per),[5,5,5,5,5,5],'the first week is five questions per subject'); }
for(const q of Q) assert.equal(slots.filter(s=>s.id===q.id).length,RD.maxRound(q),q.id+' appears once per round in scope');

// 預計完成日：週一到週六出題、週日休息；照目前每天題數從今天往後推算
const S0='2026-11-16', empty=RD.normalize(null);
assert.equal(RD.DEFAULT_START,S0); assert(!RD.isRest(S0)); assert(RD.isRest('2026-11-22'));
const f0=RD.forecast(Q,empty,S0), ends=plain(f0.ends); assert.equal(ends.length,5);
assert.deepEqual(ends,['2027-03-24','2027-05-28','2027-07-10','2027-07-22','2027-07-30'],'default pace from 11/16 matches the original schedule');
assert.equal(f0.finish,'2027-07-30'); assert(ends.every(d=>!RD.isRest(d)));
// 一週沒做：不欠題，完成日整週往後移
assert.equal(RD.forecast(Q,empty,'2026-11-23').finish,'2027-08-06','a missed week only shifts the finish by a week');
// 自己設每天題數
const slow=RD.setPerDay(empty,[3,10,15,20,30]); assert.equal(RD.perDayOf(slow,1),3); assert.equal(RD.perDayOf(empty,1),5); assert(RD.customPerDay(slow)); assert(!RD.customPerDay(empty));
assert.equal(plain(RD.forecast(Q,slow,'2026-11-23').ends)[0],'2027-06-25','553 questions at 3 a day, six days a week');
assert.equal(RD.setPerDay(empty,[0,10,15,20,30]),empty,'0 is rejected'); assert.equal(RD.setPerDay(empty,[61,10,15,20,30]),empty,'over 60 is rejected'); assert.equal(RD.setPerDay(empty,[2.5,10,15,20,30]),empty); assert.equal(RD.setPerDay(empty,[3,10]),empty);
assert.equal(RD.setPerDay(slow,RD.ROUNDS.map(r=>r.perDay)).settings.perDay,undefined,'back to defaults clears the setting');
assert.deepEqual(plain(RD.pack(slow)),{__settings:{perDay:[3,10,15,20,30]}}); assert.deepEqual(plain(RD.normalize(RD.pack(slow)).settings.perDay),[3,10,15,20,30],'round trip');
assert.equal(RD.normalize({__settings:{perDay:[3,'x',15,20,30]}}).settings.perDay,undefined,'bad settings are ignored');
assert.deepEqual(plain(RD.pack(RD.clearAll(slow))),{__settings:{perDay:[3,10,15,20,30]}},'clearing records keeps the daily counts');
// 考試日期
assert.deepEqual(plain(RD.examDate(null)),{date:RD.EXAM_GUESS,set:false}); assert.deepEqual(plain(RD.examDate({date:'2027-08-14'})),{date:'2027-08-14',set:true}); assert.equal(RD.examDate({date:'bad'}).set,false);

// 今日題組
let p=RD.plan(Q,empty,S0,0);
assert.equal(p.round,1); assert.equal(p.roundTotal,553); assert.equal(p.roundDone,0); assert.equal(p.total,2039); assert.equal(p.perDay,5);
assert.equal(p.queue.length,5); assert.equal(p.quota,5); assert(!p.rest&&!p.finished&&!p.late); assert.equal(p.finish,'2027-07-30'); assert.equal(p.exam,RD.EXAM_GUESS);
assert.equal(p.behind,undefined,'there is no backlog any more');
assert.deepEqual(plain(p.queue),plain(slots.slice(0,5)));
assert.equal(RD.plan(Q,empty,S0,5).queue.length,10,'extra questions on request');
assert.equal(RD.plan(Q,slow,'2026-11-24',0).queue.length,3,'own daily count');
p=RD.plan(Q,empty,'2026-11-23',0,'2027-08-01'); assert(p.late,'finishing after the exam date is flagged'); assert(!RD.plan(Q,empty,'2026-11-23',0,'2027-08-14').late);
// 做 2 題
let st=RD.record(empty,slots[0].id,'good',S0,300); st=RD.record(st,slots[1].id,'again',S0,700);
assert.deepEqual(plain(empty.items),{},'record does not mutate');
p=RD.plan(Q,st,S0,0); assert.equal(p.todayDone,2); assert.equal(p.queue.length,3); assert.equal(p.roundDone,2); assert.equal(p.doneTotal,2); assert.deepEqual(plain(p.tally),{again:1,partial:0,good:1});
assert.deepEqual(plain(p.queue),plain(slots.slice(2,5)));
assert.equal(RD.forecast(Q,st,S0).finish,'2027-07-30','what is done today counts towards today');
// 隔天：昨天少做 3 題，今天仍只出 5 題，不加量
p=RD.plan(Q,st,'2026-11-17',0); assert.equal(p.queue.length,5); assert.equal(p.todayDone,0);
// 週日休息：不出題，可加開
p=RD.plan(Q,st,'2026-11-22',0); assert(p.rest); assert.equal(p.queue.length,0); assert.equal(p.quota,0); assert.equal(RD.plan(Q,st,'2026-11-22',5).queue.length,5);
// 第 1 輪全部做完 → 進第 2 輪，每天 10 題，順序從觀護人題開始；同一題同一天不出兩次
{ let s=empty; for(const q of Q) s=RD.record(s,q.id,'good','2026-12-01',1);
  p=RD.plan(Q,s,'2026-12-02',0); assert.equal(p.round,2); assert.equal(p.queue.length,10); assert(p.queue.every(x=>x.r===2)); assert.equal(p.roundDone,0); assert.equal(p.doneTotal,553);
  assert.equal(plain(p.ends)[0],'done','finished rounds are marked done');
  assert.equal(RD.plan(Q,s,'2026-12-01',600).queue.length,0,'a question done today is not shown again today');
  for(const q of Q) for(let i=1;i<RD.maxRound(q)+1;i++) s=RD.record(s,q.id,'good','2027-01-0'+Math.min(i,9),1);
  p=RD.plan(Q,s,'2027-02-01',0); assert(p.finished); assert.equal(p.doneTotal,2039); assert.equal(p.queue.length,0); assert.equal(p.round,5); assert.equal(p.finish,null); assert(!p.late); }

// 紀錄格式：id → {done, notes}，壞資料忽略、題庫已不存在的 id 保留；起算日是預設值時不寫
let n=RD.setNote(st,slots[0].id,1,'罪名 → 競合'); n=RD.setNote(n,'mock:md-1',1,'x');
const packed=plain(RD.pack(n)); assert.deepEqual(Object.keys(packed).sort(),[slots[0].id,slots[1].id,'mock:md-1'].sort());
assert.deepEqual(packed[slots[0].id],{done:[{d:S0,r:'good',s:300}],notes:{1:'罪名 → 競合'}}); assert.deepEqual(packed[slots[1].id],{done:[{d:S0,r:'again',s:700}]});
assert.deepEqual(plain(RD.pack(RD.normalize(packed))),packed,'round trip keeps every record');
assert.deepEqual(plain(RD.pack(RD.setNote(n,'mock:md-1',1,''))['mock:md-1']||null),null,'an emptied note with no attempts is dropped');
const messy=RD.normalize({a:null,b:[],c:{done:[{d:'2026-13-40',r:'good'},{d:S0,r:'nope'},{d:S0,r:'partial',s:-5}],notes:{9:'x',2:5,1:'ok'}},'gone-id':{done:[{d:S0,r:'good',s:3}]},__settings:{start:'bad'}});
assert.deepEqual(plain(messy.items),{c:{done:[{d:S0,r:'partial',s:0}],notes:{1:'ok'}},'gone-id':{done:[{d:S0,r:'good',s:3}],notes:{}}}); assert.equal(messy.settings.start,S0);
assert.deepEqual(plain(RD.pack(RD.normalize({__settings:{start:'2026-12-01'}}))),{__settings:{start:'2026-12-01'}});
assert.equal(RD.setNote(empty,'x',1,'長'.repeat(5000)).items.x.notes[1].length,2000);

// 今天做過的題、重練與清除
{ let s=RD.record(empty,slots[1].id,'again',S0,100); s=RD.record(s,slots[0].id,'good',S0,50); s=RD.record(s,'mock:a','partial',S0,10); s=RD.record(s,slots[2].id,'good','2026-11-14',5); s=RD.setNote(s,slots[0].id,1,'骨架');
  assert.deepEqual(plain(RD.doneToday(Q,s,S0)),[{key:slots[0].id,r:1,rate:'good'},{key:slots[1].id,r:1,rate:'again'},{key:'mock:a',r:1,rate:'partial'}],'in question order, mock last');
  assert.deepEqual(plain(RD.doneToday(Q,s,'2026-11-17')),[]);
  const r2=RD.rerate(s,slots[1].id,S0,'good',30); assert.deepEqual(plain(r2.items[slots[1].id].done),[{d:S0,r:'good',s:130}],'redo updates today\'s entry without adding one'); assert.deepEqual(plain(s.items[slots[1].id].done),[{d:S0,r:'again',s:100}],'rerate does not mutate');
  assert.equal(RD.plan(Q,r2,S0,0).todayDone,RD.plan(Q,s,S0,0).todayDone); assert.equal(RD.plan(Q,r2,S0,0).doneTotal,3);
  assert.equal(RD.rerate(s,slots[2].id,S0,'again',1),s,'nothing to redo when it was not done today'); assert.equal(RD.rerate(s,'nope',S0,'again',1),s);
  const twice=RD.record(RD.record(empty,slots[0].id,'again','2026-11-14',1),slots[0].id,'partial',S0,1); assert.deepEqual(plain(RD.doneToday(Q,twice,S0)),[{key:slots[0].id,r:2,rate:'partial'}],'the round is the one done today');
  const cd=RD.clearDay(s,S0); assert.deepEqual(plain(RD.pack(cd)),{[slots[0].id]:{done:[],notes:{1:'骨架'}},[slots[2].id]:{done:[{d:'2026-11-14',r:'good',s:5}]}},'only today\'s attempts go; notes and earlier days stay');
  assert.equal(RD.plan(Q,cd,S0,0).todayDone,0); assert(!RD.mockDoneToday(cd,S0));
  const withStart=RD.normalize({__settings:{start:'2026-12-01'},x:{done:[{d:S0,r:'good',s:1}]}}); assert.deepEqual(plain(RD.pack(RD.clearAll(withStart))),{__settings:{start:'2026-12-01'}},'clearing everything keeps the start date');
  assert.deepEqual(plain(s.items[slots[0].id].done),[{d:S0,r:'good',s:50}],'clear does not mutate'); }

// 模擬題：每天 1 題；最新、非待訂正、兩邊都沒練過；當天選定後不換
const mocks=[{id:'a',date:'2026-11-12',reviewStatus:'待核對'},{id:'b',date:'2026-11-12',reviewStatus:'待訂正'},{id:'c',date:'2026-11-10',reviewStatus:'待核對'},{id:'d',date:'2026-11-09',reviewStatus:'待核對'},{id:'e',date:'2026-11-08',reviewStatus:'待核對',qualityStatus:'待訂正'}];
assert.equal(RD.pickMock(mocks,empty,null,'').id,'a'); assert.equal(RD.pickMock(mocks,empty,null,'d').id,'d','today\'s pick is kept');
let ms=RD.record(empty,'mock:a','good',S0,60); assert(RD.mockDoneToday(ms,S0)); assert(!RD.mockDoneToday(ms,'2026-11-17')); assert(!RD.mockDoneToday(st,S0),'past questions do not count as the mock');
assert.equal(RD.pickMock(mocks,ms,null,'').id,'c'); assert.equal(RD.pickMock(mocks,ms,{c:{answer:' 寫過 ',review:false,updatedAt:'x'}},'').id,'d'); assert.equal(RD.pickMock(mocks,ms,{c:{answer:'',essayDrafts:{issues:'草稿'}}},'').id,'d');
assert.equal(RD.pickMock(mocks,ms,{c:{answer:'',review:false}},'').id,'c','an empty record does not count as practised');
assert.equal(RD.pickMock([mocks[1],mocks[4]],empty,null,''),null); assert.equal(RD.pickMock(false,empty,null,''),null);
assert.equal(RD.plan(Q,ms,S0,0).todayDone,0,'the mock does not use up the round quota'); assert.equal(RD.plan(Q,ms,S0,0).doneTotal,0);
// 正式的模擬題資料：可用的題目夠多，欄位齊全
{ const M={}; vm.runInNewContext(read('daily-simulation/model.js'),{window:M}); const d=M.PracticeModel.dataset(JSON.parse(read('daily-simulation/questions.json')));
  const pick=RD.pickMock(d.questions,empty,null,''); assert(pick&&pick.question&&typeof pick.issues==='string'&&typeof pick.outline==='string'); assert(d.questions.filter(q=>q.reviewStatus!=='待訂正'&&!q.qualityStatus).length>=200); assert(M.PracticeModel.displayQuestion(pick)); }

// 單機設定：換日只留字級；跳過的排到最後
assert.deepEqual(plain(RD.normPos(null,S0)),{d:S0,id:'',stage:'front',skipped:[],extra:0,mock:'',secs:{},font:1});
const pos=RD.normPos({d:S0,id:'q',stage:'back',skipped:['a',3],extra:5,mock:'m',secs:{q:12.4,z:-1},font:3},S0);
assert.deepEqual(plain(pos),{d:S0,id:'q',stage:'back',skipped:['a'],extra:5,mock:'m',secs:{q:12},font:3});
assert.deepEqual(plain(RD.normPos(pos,'2026-11-17')),{d:'2026-11-17',id:'',stage:'front',skipped:[],extra:0,mock:'',secs:{},font:3});
assert.deepEqual(RD.arrange([{key:'a'},{key:'b'},{key:'c'}],['a','zz']).map(x=>x.key),['b','c','a']);

// 每題在這一頁用得到的欄位都在；命題者視角檔案對得到
for(const q of Q){ assert(q.body&&q.title&&q.overview&&q.exam&&q.subject&&Array.isArray(q.rows)&&q.rows.length,q.id+' has the fields the card shows'); assert(LS.designFile(q),q.id+' has an examiner-view file'); }

// 今日清單：多一行今日題組，仍只讀取
{ const out=LS.todayPlan({store:{},today:S0,data:w.LawScoringData,RD,roundState:st});
  assert.deepEqual(plain(out.rounds),{round:1,roundDone:2,roundTotal:553,todayDone:2,quota:5,rest:false,late:false,finished:false,mockDone:false});
  assert.equal(LS.todayPlan({store:{},today:S0,data:w.LawScoringData}).rounds,null,'still works when rounds.js is not loaded'); }

// 頁面接線、離線清單、備份
const html=read('law-scoring/rounds.html');
for(const id of ['rounds-root','rd-load','rd-round','rd-count','rd-how','rd-bar','rd-bar-fill','rd-chips','rd-tally','rd-card','rd-meta','rd-title','rd-front','rd-note-wrap','rd-note','rd-note-label','rd-back','rd-empty','rd-empty-title','rd-empty-text','rd-empty-actions','rd-table-body','rd-per-form','rd-per-reset','rd-per-status','rd-exam-note','rd-font-down','rd-font-up','rd-font-label','rd-progress','rd-clock','rd-undo','rd-skip','rd-status','rd-front-actions','rd-reveal','rd-rate','rd-exit','rd-done','rd-done-summary','rd-done-list','rd-clear-area','rd-clear-status'])
  assert(html.includes('id="'+id+'"'),'page has #'+id);
for(const id of new Set((code.match(/\$\('([^']+)'\)/g)||[]).map(x=>x.slice(3,-2)))) assert(html.includes('id="'+id+'"'),'script uses #'+id+' which the page has');
for(const k of ['again','partial','good']) assert(html.includes('data-rate="'+k+'"'));
const order=['data.js','exam-design/index.js','app.js','../daily-simulation/model.js','rounds.js'].map(f=>html.indexOf('src="'+f+'"')); assert(order.every((x,i)=>x>0&&(i===0||x>order[i-1])),'scripts load in dependency order');
assert(read('law-scoring/index.html').includes('href="rounds.html"')&&read('law-scoring/commute.html').includes('href="rounds.html"'),'entry links');
assert(read('law-scoring/app.js').includes("'rounds.js'"),'today list loads rounds.js');
const manifest=new Set(JSON.parse(read('offline-manifest.json')).assets.map(a=>a.url)),sw=read('sw.js');
for(const f of ['law-scoring/rounds.html','law-scoring/rounds.js','law-scoring/rounds.css','daily-simulation/model.js','daily-simulation/questions.json']) assert(manifest.has(f),'offline manifest has '+f);
for(const f of ['law-scoring/rounds.html','law-scoring/rounds.js','law-scoring/rounds.css']) assert(sw.includes("'"+f+"'"),'service worker fetches '+f+' network-first');
assert(read('backup/unified-core.js').includes("key:'"+RD.KEY+"'")&&read('backup/app.js').includes("'"+RD.KEY+"'"),'round records are in the full backup');
assert(!read('backup/unified-core.js').includes(RD.POS_KEY),'the per-device position is not backed up');
const freeze=JSON.parse(read('docs/stability-freeze-policy.json')).criticalPaths; for(const f of ['law-scoring/rounds.html','law-scoring/rounds.js','law-scoring/index.html','law-scoring/app.js']) assert(!freeze.includes(f));
// 入口與今日清單的連結不帶箭頭
assert(!/rounds\.html">[^<]*→/.test(read('law-scoring/index.html'))); assert(!/'[^']*→'/.test(read('law-scoring/app.js').split('// 今日清單的畫面')[1].split('box.addEventListener')[0]),'today list links have no arrows');
console.log('PASS law-scoring rounds: order, schedule, daily set, records, redo, clear, mock pick, wiring');
