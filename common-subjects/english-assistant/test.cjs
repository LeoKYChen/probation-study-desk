'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const engineCode=fs.readFileSync(path.join(__dirname,'engine.js'),'utf8');
const engineCtx={module:{exports:{}},exports:{},Intl,Date,Array,Object,Set,Math,Number,String,JSON,RegExp};
vm.runInNewContext(engineCode,engineCtx,{filename:'engine.js'});
const e=engineCtx.module.exports;
const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
new vm.Script(app,{filename:'app.js'});
assert.match(page,/每天固定背單字/);
assert.match(page,/不修改 v0\.4 每日英文/,'ensure legacy records are explicitly protected');
assert.match(page,/engine\.js/);
assert.equal(e.STORAGE_KEY,'psd-staresto-link-coach-v06');
assert.equal(e.today(new Date('2026-10-17T15:59:00Z')),'2026-10-17');
assert.equal(e.today(new Date('2026-10-17T16:01:00Z')),'2026-10-18');
const state=e.createState(),day='2026-10-17',p=e.planDay(state,day),p2=e.planDay(state,day);
assert.strictEqual(p,p2,'same-day plan never reshuffled');
assert.ok(p.tasks.some(t=>t.type==='vocab'),'vocabulary is scheduled daily');
assert.ok(p.tasks.some(t=>t.type==='completion'),'Saturday has completion');
assert.equal(e.units.length,335,'verified manifest has 335 distinct resource ranges');
assert.equal(new Set(e.units.map(x=>x.id)).size,e.units.length,'all resource IDs distinct');
assert.match(e.getUnit('gsat-vocab-115-1-5').url,/#set-V0491,V0492,V0493,V0494,V0495/,'exact vocabulary question IDs');
assert.match(e.getUnit('gsat-grammar-115-1').url,/#set-G115_11_1,G115_12_1,G115_13_1,G115_14_1,G115_15_1/,'actual grammar question IDs');
assert.match(e.getUnit('gsat-reading-115-1').url,/#p=g115p1$/,'direct reading passage deep-link');
assert.equal(e.getUnit('gsat-completion-115-1').mode,'manual','unverified passage deep-link must not be claimed');
assert.equal(e.getUnit('gsat-vocab-83-1-5-recommend').title.includes('推薦甄選'),true,'older recommendations are not official GSAT');
for(const unit of e.units){assert.ok(unit.url.startsWith('https://staresto-create.github.io/'));assert.ok(unit.instructions&&unit.title);}

const first=p.tasks[0].id;
assert.throws(()=>e.markDone(state,day,first,{correct:9,total:5}),/有效/);
assert.equal(e.markDone(state,day,first,{correct:3,total:5}).correct,3);
assert.throws(()=>e.markDone(state,day,first),/已登記/);
const nextDay=e.planDay(state,'2026-10-18');assert.notEqual(nextDay.tasks[0].id,first,'do not repeat completed task');
assert.ok(nextDay.tasks.every(x=>!state.completed[x.id]),'no completed unit rescheduled');
const prev=nextDay.tasks[0].id,replacement=e.replacePreviouslyStudied(state,'2026-10-18',prev);
assert.ok(state.excluded[prev],'old studies are excluded from the schedule');
assert.ok(replacement&&replacement.id!==prev,'skipped item gets a new unit');
assert.throws(()=>e.replacePreviouslyStudied(state,day,first),/已完成/);
const seeded={schema:e.STORAGE_KEY,days:{'2026-10-01':{tasks:[{id:'gsat-vocab-111-1-5',type:'vocab'}]}},completed:{'gsat-vocab-112-1-5':{id:'gsat-vocab-112-1-5',type:'vocab',date:'2026-10-01',at:'2026-10-01T00:00:00Z',correct:null,total:null}},excluded:{}};
const restored=e.normalize(JSON.parse(JSON.stringify(seeded)));
assert.equal(e.planDay(restored,'2026-10-01').tasks[0].id,'gsat-vocab-111-1-5','preserve existing day list');
e.planDay(restored,'2026-10-19');
assert.ok(!restored.days['2026-10-19'].tasks.some(x=>['gsat-vocab-112-1-5','gsat-vocab-111-1-5'].includes(x.id)));
const all=e.createState(),seen=new Set(),seenVocab=new Set();
for(let i=0;i<85;i++){
  const d=new Date(Date.UTC(2026,9,17+i)).toISOString().slice(0,10);
  const today=e.planDay(all,d);
  assert.ok(today.tasks.some(t=>t.type==='vocab')=== (seenVocab.size<e.units.filter(x=>x.type==='vocab').length),'new vocab until remaining units exhausted');
  for(const t of today.tasks)assert.ok(!seen.has(t.id),'never reschedule a prior unit: '+t.id);
  for(const t of today.tasks){seen.add(t.id);if(t.type==='vocab')seenVocab.add(t.id)}
}
for(const source of Object.values(e.SOURCES))assert.match(source.url,/^https:\/\/staresto-create\.github\.io\//);
assert.doesNotMatch(app,/localStorage\.(?:removeItem|clear)\s*\(/,'do not delete browser data');
assert.doesNotMatch(app,/psd-staresto-daily-v04|psd-common-subjects-v1/,'do not touch legacy keys in app code');
console.log('PASS Staresto link coach v0.6 phase1: no-repeat, manual completion, replacement, frozen dates, legacy isolation');
