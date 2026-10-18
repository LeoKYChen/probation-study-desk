'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// package.json 設為 type:module；用 VM 執行瀏覽器 UMD 檔並取得其 CommonJS export。
function load(file){const scope={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),scope,{filename:file});return scope.module.exports;}
const core=load('./core.js');
const backup=load('../backup/unified-core.js');
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
 // 既有資料格式可無損升級：舊版7天排程仍能讀取，新欄位有安全預設值。
 const legacy=JSON.parse(JSON.stringify(initial));
 legacy.plan=null;
 const old=core.normalize(legacy);
 assert.equal(old.settings.strategy,'sequential');
 assert.equal(old.settings.planDays,30);
 assert.equal(old.lessons[0].watchedMinutes,20);
 const oldPlan=core.schedule(old,start,7);
 assert.equal(core.normalize({...old,plan:oldPlan}).plan.days.length,7);
 // 國考多科：不強迫必須屬於預設7科，且 30/90 天均不能超過每天分鐘數。
 let multi=core.empty();
 const names=['行政法','民法','刑法','刑事訴訟法','犯罪學','心理學','諮商與輔導','少年事件處理法','保安處分執行法','國文'];
 for(let i=0;i<names.length;i++)multi=core.addCourse(multi,names[i],names[i]+'函授',2,100,'multi'+i);
 const calendar=core.schedule(multi,start,90);
 assert.equal(calendar.days.length,90);
 assert(calendar.days.every(x=>x.scheduledMinutes<=x.capacityMinutes));
 assert.equal(calendar.days.reduce((n,x)=>n+x.scheduledMinutes,0),calendar.scheduledMinutes);
 assert.equal(calendar.scheduledMinutes,core.remaining(multi));
 // 排除科目不會刪資料，也不會偷渡到課表。
 multi.settings.subjectRules={'行政法':{enabled:false,weight:5}};
 const excluded=core.schedule(multi,start,30);
 const ids=new Set(multi.lessons.filter(l=>l.courseId==='multi0').map(l=>l.id));
 assert(excluded.days.every(day=>day.units.every(u=>!ids.has(u.lessonId))));
 assert.equal(multi.lessons.filter(l=>ids.has(l.id)).length,2);
 assert.equal(core.forecast(multi,start).finishDate,null,'被排除科目仍有未完成分鐘，不能誤報完課');
 // 科目每日輪替（一天不超過一科）；固定星期安排有空白休息日。
 multi.settings.subjectRules={};
 multi.settings.strategy='rotate';
 const rotated=core.schedule(multi,start,7);
 const lessonSubject=new Map(multi.lessons.map(l=>[l.id,multi.courses.find(c=>c.id===l.courseId).subject]));
 assert(rotated.days.every(day=>new Set(day.units.map(u=>lessonSubject.get(u.lessonId))).size<=1));
 assert.notEqual(lessonSubject.get(rotated.days[0].units[0].lessonId),lessonSubject.get(rotated.days[1].units[0].lessonId));
 multi.settings.strategy='fixed';
 multi.settings.fixedDays=['','','行政法','','','心理學',''];
 const fixed=core.schedule(multi,start,7);
 assert.equal(fixed.days[0].scheduledMinutes,0);
 assert(fixed.days[1].units.every(u=>lessonSubject.get(u.lessonId)==='行政法'));
 assert(fixed.days[4].units.every(u=>lessonSubject.get(u.lessonId)==='心理學'));
 // 加權分配不超過每日科目上限；高權重科目較低權重獲得更多時數。
 let weighted=core.empty();
 weighted=core.addCourse(weighted,'心理學','心理學',30,120,'weight_a');
 weighted=core.addCourse(weighted,'犯罪學','犯罪學',30,120,'weight_b');
 weighted.settings.strategy='weighted';
 weighted.settings.maxSubjectsPerDay=2;
 weighted.settings.subjectRules={'心理學':{enabled:true,weight:5},'犯罪學':{enabled:true,weight:1}};
 const wp=core.schedule(weighted,start,30);
 assert(wp.days.every(day=>new Set(day.units.map(u=>lessonSubject.get(u.lessonId))).size<=2)); // 下方另外用當前題目來源檢驗權重。
 const wmap=new Map(weighted.lessons.map(l=>[l.id,weighted.courses.find(c=>c.id===l.courseId).subject]));
 const counts={心理學:0,犯罪學:0};
 for(const day of wp.days)for(const u of day.units)counts[wmap.get(u.lessonId)]+=u.minutes;
 assert(counts['心理學']>counts['犯罪學']);
 assert(wp.days.every(day=>day.scheduledMinutes<=day.capacityMinutes));
 console.log('Lecture planner and backup regression tests passed');
}
run();
