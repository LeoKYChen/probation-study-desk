/* 函授管理：純資料及排程計算，可於瀏覽器與 Node 測試。 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.PSDLectureCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const KEY='psd-lecture-planner-v1';
  const SUBJECTS=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法','國文','法學知識與英文'];
  const empty=()=>({schema:1,settings:{weekdayMinutes:60,weekendMinutes:240,reserveMinutes:30,examDate:'',reviewDays:14},courses:[],lessons:[],plan:null});
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  const datePlus=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const dayOf=s=>new Date(s+'T00:00:00Z').getUTCDay();
  const todayTaipei=()=>{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const m=Object.fromEntries(p.map(x=>[x.type,x.value]));
    return m.year+'-'+m.month+'-'+m.day;
  };
  const integer=(n,min,max)=>Number.isInteger(Number(n))&&Number(n)>=min&&Number(n)<=max?Number(n):null;
  function normalize(x){
    if(!x||x.schema!==1||!Array.isArray(x.courses)||!Array.isArray(x.lessons)||!x.settings||typeof x.settings!=='object'||Array.isArray(x.settings))throw Error('函授紀錄格式不符');
    if(x.courses.length>300||x.lessons.length>5000)throw Error('課程或堂數超過上限');
    const st=empty(),s=x.settings;
    for(const [k,min,max] of [['weekdayMinutes',0,1440],['weekendMinutes',0,1440],['reserveMinutes',0,1440],['reviewDays',0,365]]){
      const v=integer(s[k],min,max);if(v===null)throw Error('讀書時間或複習天數格式錯誤');st.settings[k]=v;
    }
    st.settings.examDate=s.examDate===''?'':validDate(s.examDate)?s.examDate:(()=>{throw Error('考試日期格式錯誤')})();
    const seen=new Set();
    st.courses=x.courses.map(c=>{
      if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||seen.has(c.id)||!SUBJECTS.includes(c.subject)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('課程資料格式錯誤');
      seen.add(c.id);return {id:c.id,name:c.name.trim(),subject:c.subject};
    });
    const ids=new Set(),courses=new Set(st.courses.map(c=>c.id));
    st.lessons=x.lessons.map(l=>{
      const duration=integer(l?.durationMinutes,1,1440),watched=integer(l?.watchedMinutes,0,1440);
      if(!l||typeof l.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(l.id)||ids.has(l.id)||!courses.has(l.courseId)||typeof l.title!=='string'||!l.title.trim()||l.title.length>100||duration===null||watched===null||watched>duration)throw Error('堂次資料格式錯誤');
      ids.add(l.id);return {id:l.id,courseId:l.courseId,title:l.title.trim(),durationMinutes:duration,watchedMinutes:watched};
    });
    if(x.plan!==null&&x.plan!==undefined){
      if(!x.plan||!validDate(x.plan.startDate)||!Array.isArray(x.plan.days)||x.plan.days.length>7||typeof x.plan.createdAt!=='string'||!Array.isArray(x.plan.baseline)||x.plan.baseline.length>5000)throw Error('原排程格式不符');
      st.plan=JSON.parse(JSON.stringify(x.plan));
    }
    return st;
  }
  function addCourse(state,subject,name,count,duration,id){
    const st=normalize(state),n=integer(count,1,120),d=integer(duration,1,1440);
    if(!SUBJECTS.includes(subject)||!String(name||'').trim()||String(name).length>100||n===null||d===null)throw Error('請填寫正確的課程、堂數與時長');
    if(st.courses.length>=300||st.lessons.length+n>5000)throw Error('課程數量已達上限');
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||st.courses.some(c=>c.id===id))throw Error('課程識別碼無效');
    st.courses.push({id,name:String(name).trim(),subject});
    for(let i=1;i<=n;i++)st.lessons.push({id:id+'_'+i,courseId:id,title:'第'+i+'堂',durationMinutes:d,watchedMinutes:0});
    return st;
  }
  function updateLesson(state,id,watched,duration,title){
    const st=normalize(state),lesson=st.lessons.find(l=>l.id===id);
    if(!lesson)throw Error('找不到堂次');
    const d=integer(duration,1,1440),w=integer(watched,0,1440);
    if(d===null||w===null||w>d||!String(title||'').trim()||String(title).length>100)throw Error('觀看分鐘數不得超過堂次長度');
    lesson.durationMinutes=d;lesson.watchedMinutes=w;lesson.title=String(title).trim();
    return st;
  }
  function removeCourse(state,id){
    const st=normalize(state);
    if(!st.courses.some(c=>c.id===id))throw Error('找不到課程');
    st.courses=st.courses.filter(c=>c.id!==id);
    st.lessons=st.lessons.filter(l=>l.courseId!==id);
    st.plan=null;
    return st;
  }
  function capacity(settings,date){
    const max=(dayOf(date)===0||dayOf(date)===6)?settings.weekendMinutes:settings.weekdayMinutes;
    return Math.max(0,max-settings.reserveMinutes);
  }
  function remaining(state){return state.lessons.reduce((a,l)=>a+(l.durationMinutes-l.watchedMinutes),0);}
  function schedule(state,startDate,days=7){
    const st=normalize(state);
    if(!validDate(startDate)||days<1||days>7||!Number.isInteger(days))throw Error('排程日期錯誤');
    const todo=st.lessons.filter(l=>l.watchedMinutes<l.durationMinutes).map(l=>({id:l.id,left:l.durationMinutes-l.watchedMinutes}));
    let at=0;
    const rows=[];
    for(let d=0;d<days;d++){
      const date=datePlus(startDate,d),cap=capacity(st.settings,date);
      let free=cap;const units=[];
      while(free>0&&at<todo.length){
        const cur=todo[at],minutes=Math.min(free,cur.left);
        units.push({lessonId:cur.id,minutes});cur.left-=minutes;free-=minutes;
        if(cur.left===0)at++;
      }
      rows.push({date,capacityMinutes:cap,units,scheduledMinutes:cap-free});
    }
    const total=rows.reduce((a,r)=>a+r.scheduledMinutes,0);
    return {startDate,createdAt:new Date().toISOString(),baseline:st.lessons.map(l=>({id:l.id,watchedMinutes:l.watchedMinutes})),days:rows,scheduledMinutes:total,unscheduledMinutes:Math.max(0,remaining(st)-total)};
  }
  function forecast(state,startDate){
    const st=normalize(state),left=remaining(st);
    let remain=left,finish=left===0?startDate:null;
    for(let i=0;i<3660&&remain>0;i++){
      const day=datePlus(startDate,i);
      remain-=capacity(st.settings,day);
      if(remain<=0)finish=day;
    }
    let cutoff=null,risk=null;
    if(st.settings.examDate){
      cutoff=datePlus(st.settings.examDate,-st.settings.reviewDays);
      risk=left>0&&(finish===null||finish>cutoff);
    }
    return {remainingMinutes:left,finishDate:finish,reviewCutoff:cutoff,risk};
  }
  function delay(state,date){
    const st=normalize(state),plan=st.plan;
    if(!plan)return 0;
    const base=new Map(plan.baseline.map(x=>[x.id,x.watchedMinutes]));
    const completed=new Map(st.lessons.map(l=>[l.id,Math.max(0,l.watchedMinutes-(base.get(l.id)||0))]));
    let late=0;
    for(const day of plan.days){
      if(day.date>=date)continue;
      for(const u of day.units||[]){
        const done=completed.get(u.lessonId)||0,offset=Math.min(done,u.minutes);
        completed.set(u.lessonId,done-offset);late+=u.minutes-offset;
      }
    }
    return late;
  }
  return {KEY,SUBJECTS,empty,normalize,addCourse,updateLesson,removeCourse,capacity,remaining,schedule,forecast,delay,todayTaipei,datePlus,validDate};
});
