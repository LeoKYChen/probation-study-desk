'use strict';
const assert=require('node:assert/strict');
const core=require('./core.js');
const backup=require('../backup/unified-core.js');
function fake(seed={}){
 const items=new Map(Object.entries(seed));
 return {items,getItem(k){return items.has(k)?items.get(k):null;},setItem(k,v){items.set(k,String(v));},removeItem(k){items.delete(k);}};
}
function run(){
 const start='2026-10-19';
 let st=core.empty();
 assert.equal(core.remaining(st),0);
 assert.equal(core.todayTaipei().length,10);
 st=core.addCourse(st,'心理學','心理學第一輪',3,120,'course_p1');
 assert.equal(st.courses.length,1);
 assert.equal(st.lessons.length,3);
 assert.equal(core.remaining(st),360);
 let plan=core.schedule(st,start);
 assert.equal(plan.days.length,7);
 assert.equal(plan.scheduledMinutes,360);
 assert.equal(plan.unscheduledMinutes,0);
 for(const d of plan.days){
  assert(d.scheduledMinutes<=d.capacityMinutes);
  assert.equal(d.units.reduce((n,x)=>n+x.minutes,0),d.scheduledMinutes);
 }
 assert.equal(plan.days[0].capacityMinutes,30);
 assert.equal(plan.days[5].capacityMinutes,210);
 st.plan=plan;
 assert.equal(core.delay(st,'2026-10-22'),90);
 st=core.updateLesson(st,'course_p1_1',45,120,'心理學緒論');
 assert.equal(core.remaining(st),315);
 assert.equal(core.delay(st,'2026-10-22'),45);
 assert.equal(st.lessons[0].title,'心理學緒論');
 assert.throws(()=>core.updateLesson(st,'course_p1_1',121,120,'超時'),/分鐘/);
 assert.throws(()=>core.addCourse(st,'心理學','錯誤',121,120,'invalid'),/課程/);
 const newPlan=core.schedule(st,start);
 assert.equal(newPlan.scheduledMinutes,315);
 assert.equal(newPlan.days[0].units[0].minutes,30);
 st.plan=newPlan;
 assert.equal(core.normalize(JSON.parse(JSON.stringify(st))).lessons[0].watchedMinutes,45);
 const finish=core.forecast(st,start);
 assert.equal(finish.remainingMinutes,315);
 assert(finish.finishDate>=start);
 st.settings.examDate='2026-10-22';
 st.settings.reviewDays=7;
 assert.equal(core.forecast(st,start).risk,true);
 const noHours=core.normalize(st);noHours.settings.weekdayMinutes=0;noHours.settings.weekendMinutes=0;noHours.settings.reserveMinutes=0;
 assert.equal(core.forecast(noHours,start).finishDate,null);
 assert.equal(core.schedule(noHours,start).scheduledMinutes,0);
 const removed=core.removeCourse(st,'course_p1');
 assert.equal(removed.lessons.length,0);
 assert.equal(removed.plan,null);
 // 備份中心：仍保留原本其他模組，不因函授更新而消失。
 const key=core.KEY;
 const initial={schema:1,settings:core.empty().settings,courses:[{id:'c1',name:'心理學',subject:'心理學'}],lessons:[{id:'c1_1',courseId:'c1',title:'第一堂',durationMinutes:90,watchedMinutes:20}],plan:null};
 const other=JSON.parse(JSON.stringify(initial));
 other.lessons[0].watchedMinutes=75;
 other.courses.push({id:'c2',name:'犯罪學',subject:'犯罪學'});
 other.lessons.push({id:'c2_1',courseId:'c2',title:'第二堂',durationMinutes:60,watchedMinutes:0});
 const local=fake({[key]:JSON.stringify(initial),'jj-read':'["keep"]'});
 const packageData=backup.collect(fake({[key]:JSON.stringify(other)}),'https://other.test');
 const incoming=backup.validate(packageData);
 assert(incoming.data[key]);
 const merge=backup.plan(backup.storageSnapshot(local),incoming);
 assert.equal(local.getItem(key),JSON.stringify(initial),'預覽不可修改本機資料');
 assert.equal(merge.conflicts.length,1,'同一堂進度不同應保留衝突');
 backup.apply(local,merge);
 const final=JSON.parse(local.getItem(key));
 assert.equal(final.lessons[0].watchedMinutes,20,'已存在的觀看進度不可被覆蓋');
 assert.equal(final.lessons.length,2,'新的堂次應被安全合併');
 assert.equal(local.getItem('jj-read'),'["keep"]','原閱讀紀錄應保持原狀');
 assert.equal(backup.collect(local,'https://local.test').data[key],local.getItem(key));
 console.log('Lecture planner and backup regression tests passed');
}
run();
