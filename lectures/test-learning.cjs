'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(file){const scope={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),scope);return scope.module.exports;}
const c=load('core.js'),b=load('../backup/unified-core.js'),today=c.todayTaipei();
let s=c.addCourse(c.empty(),'心理學','心理學',5,120,'psych');
s.settings.weekdayMinutes=120;s.settings.weekendMinutes=120;s.settings.reserveMinutes=0;
// More than 90 days, cross-year persistence, compact distant empty tails.
for(const days of [91,366,730,6000]){
 const p=c.schedule(s,today,days);
 assert.equal(p.endDate,c.datePlus(today,days-1));assert.equal(p.rangeDays,days);
 assert.equal(p.scheduledMinutes,600);
 const round=c.normalize({...s,settings:{...s.settings,planDays:days},plan:p});
 assert.equal(round.settings.planDays,days);
 assert(p.days.every(d=>d.scheduledMinutes<=d.capacityMinutes));
 if(days>365)assert(p.days.length<days);
}
for(const n of [0,-1,1.5,NaN,Infinity])assert.throws(()=>c.schedule(s,today,n));
assert.throws(()=>c.schedule(s,'9999-12-31',2));
assert.equal(c.normalize({...s,activities:undefined}).activities.length,0);
const p=c.schedule(s,today,180);s.plan=p;
const first=c.calendarItems(s,today).find(a=>a.fromPlan);
const source={date:today,lessonId:first.lessonId};
// Completing one allocation increments that lesson by exactly its planned minutes.
let done=c.saveActivity(s,{...first,status:'completed',actualMinutes:100,notes:'檢查信度與效度',needsReview:true},source);
assert.equal(done.lessons[0].watchedMinutes,120);
assert.equal(done.activities[0].status,'completed');
assert.equal(done.activities[0].actualMinutes,100);
assert.equal(c.calendarItems(done,today).length,1);
done=c.saveActivity(done,done.activities[0]);
assert.equal(done.lessons[0].watchedMinutes,120,'repeat save must not double count');
assert.equal(c.normalize(JSON.parse(JSON.stringify(done))).activities[0].notes,'檢查信度與效度');
assert.throws(()=>c.removeActivity(done,done.activities[0].id),/紀錄/);
// Partly completing a split lesson remains independent from other dates.
let split=c.addCourse(c.empty(),'刑法','刑法',1,120,'law');
split.settings.weekdayMinutes=30;split.settings.weekendMinutes=30;split.settings.reserveMinutes=0;split.plan=c.schedule(split,today,7);
const piece=c.calendarItems(split,today)[0];
split=c.saveActivity(split,{...piece,status:'inprogress',completedMinutes:15,actualMinutes:20},{date:today,lessonId:piece.lessonId});
assert.equal(split.lessons[0].watchedMinutes,15);
assert.equal(c.calendarItems(split,c.datePlus(today,1))[0].completedMinutes,0,'other dates cannot inherit this completion');
const replan=c.schedule(split,today,730);
assert.equal(replan.scheduledMinutes,90,'reserve remaining 15 minutes of explicitly edited task');
assert(replan.days.every(d=>d.scheduledMinutes<=d.capacityMinutes));
split.plan=replan;
assert.equal(c.normalize(split).activities[0].completedMinutes,15,'replan preserves actual log');
assert(c.forecast(split,today).finishDate,'reserved lecture allocations must be included in forecast');
// Manual reading, moving an item, planned/actual separation and capacity rollback.
const future=c.datePlus(today,800);
const reading={id:'reading_1',date:future,type:'reading',subject:'少年事件處理法',title:'閱讀筆記',lessonId:'',plannedMinutes:20,completedMinutes:0,actualMinutes:0,status:'pending',notes:'',needsReview:false};
split=c.saveActivity(split,reading);
assert.equal(split.lessons[0].watchedMinutes,15);
const moved=c.saveActivity(split,{...reading,date:c.datePlus(future,1)});
assert.equal(c.calendarItems(moved,future).length,0);
assert.equal(c.calendarItems(moved,c.datePlus(future,1))[0].title,'閱讀筆記');
assert.throws(()=>c.saveActivity(split,{...reading,id:'too_much',plannedMinutes:31}),/可用/);
const before=JSON.stringify(split);
assert.throws(()=>c.saveActivity(split,{...reading,id:'bad',date:c.datePlus(future,2),completedMinutes:25}),/內容/);
assert.equal(JSON.stringify(split),before,'failed updates leave input intact');
const readDone=c.saveActivity(split,{...reading,status:'completed'});
assert.equal(readDone.lessons[0].watchedMinutes,15);
assert.equal(readDone.activities.find(a=>a.id==='reading_1').actualMinutes,0,'completion must not invent actual time');
assert.equal(c.observedForecast(readDone,today),null,'single recorded day is insufficient');
// Course metadata is retained, and deleting a course removes only its linked logs.
done.courses[0].teacher='甲老師';done.courses[0].expiresOn=c.datePlus(today,30);
assert.equal(c.normalize(done).courses[0].teacher,'甲老師');
const removed=c.removeCourse(done,'psych');assert.equal(removed.activities.length,0);
// A direct legacy lesson update is reflected on calendar, and recording it must not count twice.
let legacy=c.addCourse(c.empty(),'心理學','心理學',1,120,'legacy');
legacy.settings.weekdayMinutes=120;legacy.settings.weekendMinutes=120;legacy.settings.reserveMinutes=0;legacy.plan=c.schedule(legacy,today,7);
legacy=c.updateLesson(legacy,'legacy_1',60,120,'第1堂');
const legacyItem=c.calendarItems(legacy,today)[0];assert.equal(legacyItem.completedMinutes,60);
legacy=c.saveActivity(legacy,{...legacyItem,notes:'補記'},{date:today,lessonId:legacyItem.lessonId});
assert.equal(legacy.lessons[0].watchedMinutes,60);
// Backup round-trip preserves both planned allocations and activity history.
function storage(value){const rows=new Map(value||[]);return{getItem:k=>rows.has(k)?rows.get(k):null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};}
const pack=b.collect(storage([[c.KEY,JSON.stringify(readDone)]]),'https://test.invalid');
assert.equal(JSON.parse(pack.data[c.KEY]).activities.length,2);
const blank=storage(),merge=b.plan(b.storageSnapshot(blank),b.validate(pack));b.apply(blank,merge);
assert.equal(c.normalize(JSON.parse(blank.getItem(c.KEY))).activities.length,2);
const cleared=b.previewClear(blank);b.applyClear(blank,cleared);
assert.equal(JSON.parse(blank.getItem(c.KEY)).activities.length,0);
console.log('PASS learning management: long ranges, partial completion, idempotence, preserved history, manual tasks, capacity, actual-time separation, legacy data and backup');
