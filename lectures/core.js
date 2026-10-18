/* 函授管理：v1 相容、純函式排程。瀏覽器及 Node 測試共用。 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PSDLectureCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const KEY='psd-lecture-planner-v1';
  const SUBJECTS=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法','國文','法學知識與英文'];
  const STRATEGIES=['sequential','rotate','weighted','fixed'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const integer=(n,min,max)=>Number.isInteger(Number(n))&&Number(n)>=min&&Number(n)<=max?Number(n):null;
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  const datePlus=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const dayOf=s=>new Date(s+'T00:00:00Z').getUTCDay();
  const validSubject=s=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=50&&s.trim()===s&&!/[<>\x00-\x1f]/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
  const empty=()=>({schema:1,settings:{weekdayMinutes:60,weekendMinutes:240,reserveMinutes:30,examDate:'',reviewDays:14,strategy:'sequential',planDays:30,maxSubjectsPerDay:2,subjectRules:{},fixedDays:['','','','','','','']},courses:[],lessons:[],plan:null});
  const todayTaipei=()=>{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const m=Object.fromEntries(p.map(x=>[x.type,x.value]));
    return m.year+'-'+m.month+'-'+m.day;
  };
  function normalize(x){
    if(!x||x.schema!==1||!Array.isArray(x.courses)||!Array.isArray(x.lessons)||!x.settings||typeof x.settings!=='object'||Array.isArray(x.settings))throw Error('函授紀錄格式不符');
    if(x.courses.length>300||x.lessons.length>5000)throw Error('課程或堂數超過上限');
    const st=empty(),s=x.settings;
    for(const [k,min,max] of [['weekdayMinutes',0,1440],['weekendMinutes',0,1440],['reserveMinutes',0,1440],['reviewDays',0,365]]){
      const v=integer(s[k],min,max);if(v===null)throw Error('讀書時間或複習天數格式錯誤');st.settings[k]=v;
    }
    st.settings.examDate=s.examDate===''?'':validDate(s.examDate)?s.examDate:(()=>{throw Error('考試日期格式錯誤')})();
    st.settings.strategy=STRATEGIES.includes(s.strategy)?s.strategy:(s.strategy===undefined?'sequential':(()=>{throw Error('排課模式不正確')})());
    st.settings.planDays=s.planDays===undefined?30:integer(s.planDays,1,90);
    if(st.settings.planDays===null)throw Error('預排天數不正確');
    st.settings.maxSubjectsPerDay=s.maxSubjectsPerDay===undefined?2:integer(s.maxSubjectsPerDay,1,3);
    if(st.settings.maxSubjectsPerDay===null)throw Error('每天科目上限不正確');
    const seen=new Set();
    st.courses=x.courses.map(c=>{
      if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||seen.has(c.id)||!validSubject(c.subject)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('課程資料格式錯誤');
      seen.add(c.id);return {id:c.id,name:c.name.trim(),subject:c.subject};
    });
    const ids=new Set(),courses=new Set(st.courses.map(c=>c.id));
    st.lessons=x.lessons.map(l=>{
      const duration=integer(l?.durationMinutes,1,1440),watched=integer(l?.watchedMinutes,0,1440);
      if(!l||typeof l.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(l.id)||ids.has(l.id)||!courses.has(l.courseId)||typeof l.title!=='string'||!l.title.trim()||l.title.length>100||duration===null||watched===null||watched>duration)throw Error('堂次資料格式錯誤');
      ids.add(l.id);return {id:l.id,courseId:l.courseId,title:l.title.trim(),durationMinutes:duration,watchedMinutes:watched};
    });
    const known=new Set(st.courses.map(c=>c.subject));
    const rules=s.subjectRules===undefined?{}:s.subjectRules;
    if(!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).length>300)throw Error('科目權重資料格式錯誤');
    st.settings.subjectRules=Object.create(null);
    for(const [name,r] of Object.entries(rules)){
      if(!known.has(name)||!r||typeof r!=='object'||Array.isArray(r)||typeof r.enabled!=='boolean'||integer(r.weight,1,5)===null)throw Error('科目排課設定不正確');
      st.settings.subjectRules[name]={enabled:r.enabled,weight:Number(r.weight)};
    }
    const fixed=s.fixedDays===undefined?['','','','','','','']:s.fixedDays;
    if(!Array.isArray(fixed)||fixed.length!==7||fixed.some(x=>x!==''&&!known.has(x)))throw Error('固定星期科目設定錯誤');
    st.settings.fixedDays=fixed.slice();
    if(x.plan!==null&&x.plan!==undefined){
      const p=x.plan;
      if(!p||!validDate(p.startDate)||!Array.isArray(p.days)||p.days.length>90||typeof p.createdAt!=='string'||!Array.isArray(p.baseline)||p.baseline.length>5000)throw Error('原排程格式不符');
      const lessonIds=new Set(st.lessons.map(l=>l.id));
      for(const row of p.days){
        if(!row||!validDate(row.date)||integer(row.capacityMinutes,0,1440)===null||integer(row.scheduledMinutes,0,1440)===null||row.scheduledMinutes>row.capacityMinutes||!Array.isArray(row.units)||row.units.length>5000)throw Error('原排程日期格式錯誤');
        let sum=0;
        for(const unit of row.units){
          if(!unit||!lessonIds.has(unit.lessonId)||integer(unit.minutes,1,1440)===null)throw Error('原排程堂次無效');
          sum+=unit.minutes;
        }
        if(sum!==row.scheduledMinutes)throw Error('原排程時間不符');
      }
      st.plan=JSON.parse(JSON.stringify(p));
    }
    return st;
  }
  function addCourse(state,subject,name,count,duration,id){
    const st=normalize(state),n=integer(count,1,120),d=integer(duration,1,1440);
    if(!validSubject(subject)||!String(name||'').trim()||String(name).length>100||n===null||d===null)throw Error('請填寫正確的科目、課程、堂數與時長');
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
    const subject=st.courses.find(c=>c.id===id).subject;
    st.courses=st.courses.filter(c=>c.id!==id);
    st.lessons=st.lessons.filter(l=>l.courseId!==id);
    if(!st.courses.some(c=>c.subject===subject)){
      delete st.settings.subjectRules[subject];
      st.settings.fixedDays=st.settings.fixedDays.map(x=>x===subject?'':x);
    }
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
    if(!validDate(startDate)||integer(days,1,90)===null)throw Error('排程日期錯誤');
    return build(st,startDate,days);
  }
  function build(st,startDate,days){
    const cfg=st.settings,subjectMap=new Map(st.courses.map(c=>[c.id,c.subject]));
    const bySubject=new Map(),order=[];
    for(const lesson of st.lessons){
      const left=lesson.durationMinutes-lesson.watchedMinutes,sub=subjectMap.get(lesson.courseId);
      if(left<=0)continue;
      if(!bySubject.has(sub)){bySubject.set(sub,[]);order.push(sub);}
      bySubject.get(sub).push({id:lesson.id,left});
    }
    const rule=s=>cfg.subjectRules[s]||{enabled:true,weight:1};
    const active=order.filter(s=>rule(s).enabled);
    const indexes=new Map(active.map(s=>[s,0])),allocated=new Map(active.map(s=>[s,0]));
    const hasWork=s=>active.includes(s)&&indexes.get(s)<bySubject.get(s).length;
    let rotateIndex=0,all=0;const rows=[];
    function spend(sub,budget,units){
      const q=bySubject.get(sub);let at=indexes.get(sub),remaining=budget,spent=0;
      while(remaining>0&&at<q.length){
        const l=q[at],m=Math.min(remaining,l.left);
        if(m<=0)break;
        const last=units[units.length-1];
        if(last?.lessonId===l.id)last.minutes+=m;
        else units.push({lessonId:l.id,minutes:m});
        remaining-=m;l.left-=m;spent+=m;
        if(l.left===0)at++;
      }
      indexes.set(sub,at);allocated.set(sub,allocated.get(sub)+spent);
      return spent;
    }
    for(let d=0;d<days;d++){
      const date=datePlus(startDate,d),cap=capacity(cfg,date),units=[];
      let free=cap;
      if(cfg.strategy==='sequential'){
        for(const sub of active)if(free>0&&hasWork(sub))free-=spend(sub,free,units);
      } else if(cfg.strategy==='fixed'){
        const sub=cfg.fixedDays[dayOf(date)];
        if(hasWork(sub))free-=spend(sub,free,units);
      } else if(cfg.strategy==='rotate'){
        let attempts=0;
        while(attempts<active.length&&active.length){
          const sub=active[rotateIndex%active.length];rotateIndex++;attempts++;
          if(hasWork(sub)){free-=spend(sub,free,units);break;}
        }
      } else {
        // 權重分配：逐日選擇累計分配分鐘數/權重最低的科目；
        // 同一天最多 maxSubjectsPerDay 科，15 分鐘為基本切片，保證跨日公平。
        const eligible=active.filter(hasWork).sort((a,b)=>
          allocated.get(a)/rule(a).weight-allocated.get(b)/rule(b).weight||order.indexOf(a)-order.indexOf(b));
        const picks=eligible.slice(0,cfg.maxSubjectsPerDay);
        while(free>0&&picks.some(hasWork)){
          const sub=picks.filter(hasWork).sort((a,b)=>
            allocated.get(a)/rule(a).weight-allocated.get(b)/rule(b).weight||order.indexOf(a)-order.indexOf(b))[0];
          free-=spend(sub,Math.min(15,free),units);
        }
      }
      const spent=cap-free;all+=spent;
      rows.push({date,capacityMinutes:cap,units,scheduledMinutes:spent});
    }
    return {startDate,createdAt:new Date().toISOString(),baseline:st.lessons.map(l=>({id:l.id,watchedMinutes:l.watchedMinutes})),days:rows,scheduledMinutes:all,unscheduledMinutes:Math.max(0,remaining(st)-all),strategy:cfg.strategy};
  }
  function forecast(state,startDate){
    const st=normalize(state),left=remaining(st);
    // 預測採相同排課規則，不把被排除或固定星期無法排到的科目誤算成已完成。
    let finish=left===0?startDate:null,remain=left;
    if(left>0){
      let start=startDate,used=0;
      while(used<3660&&remain>0){
        const n=Math.min(90,3660-used),part=build(st,start,n);
        if(part.scheduledMinutes===0){
          // 週期 7 天均無進度，之後也無法完課。
          if(n>=7)break;
        }
        // 將本次排入分鐘更新虛擬觀看進度，再以同一規則計算下一段。
        const byId=new Map(st.lessons.map(l=>[l.id,l]));
        for(const day of part.days){
          for(const unit of day.units){const lesson=byId.get(unit.lessonId);if(lesson)lesson.watchedMinutes+=unit.minutes;}
          remain-=day.scheduledMinutes;
          if(remain<=0){finish=day.date;break;}
        }
        used+=n;start=datePlus(start,n);
      }
    }
    const cutoff=st.settings.examDate?datePlus(st.settings.examDate,-st.settings.reviewDays):null;
    return {remainingMinutes:left,finishDate:finish,reviewCutoff:cutoff,risk:cutoff!==null&&left>0&&(finish===null||finish>cutoff)};
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
  return {KEY,SUBJECTS,STRATEGIES,empty,normalize,addCourse,updateLesson,removeCourse,capacity,remaining,schedule,forecast,delay,todayTaipei,datePlus,validDate,validSubject};
});
