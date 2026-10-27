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
  const empty=()=>({schema:1,settings:{weekdayMinutes:60,weekendMinutes:240,reserveMinutes:30,examDate:'',reviewDays:14,strategy:'sequential',planDays:30,maxSubjectsPerDay:2,subjectRules:{},fixedDays:['','','','','','','']},courses:[],lessons:[],activities:[],plan:null});
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
    st.settings.planDays=s.planDays===undefined?30:integer(s.planDays,1,Number.MAX_SAFE_INTEGER);
    if(st.settings.planDays===null)throw Error('預排天數不正確');
    st.settings.maxSubjectsPerDay=s.maxSubjectsPerDay===undefined?2:integer(s.maxSubjectsPerDay,1,3);
    if(st.settings.maxSubjectsPerDay===null)throw Error('每天科目上限不正確');
    const seen=new Set();
    st.courses=x.courses.map(c=>{
      if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(c.id)||seen.has(c.id)||!validSubject(c.subject)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('課程資料格式錯誤');
      if(c.expiresOn!==undefined&&c.expiresOn!==''&&!validDate(c.expiresOn))throw Error('課程期限格式錯誤');
      if(c.teacher!==undefined&&(typeof c.teacher!=='string'||c.teacher.length>100))throw Error('授課教師格式錯誤');
      seen.add(c.id);return {id:c.id,name:c.name.trim(),subject:c.subject,teacher:c.teacher||'',expiresOn:c.expiresOn||''};
    });
    const ids=new Set(),courses=new Set(st.courses.map(c=>c.id));
    st.lessons=x.lessons.map(l=>{
      const duration=integer(l?.durationMinutes,1,1440),watched=integer(l?.watchedMinutes,0,1440);
      if(!l||typeof l.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(l.id)||ids.has(l.id)||!courses.has(l.courseId)||typeof l.title!=='string'||!l.title.trim()||l.title.length>100||duration===null||watched===null||watched>duration)throw Error('堂次資料格式錯誤');
      ids.add(l.id);return {id:l.id,courseId:l.courseId,title:l.title.trim(),durationMinutes:duration,watchedMinutes:watched};
    });
    if(x.activities!==undefined&&!Array.isArray(x.activities))throw Error('學習紀錄格式錯誤');
    const activityIds=new Set();
    st.activities=(x.activities||[]).map(a=>{
      if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{1,250}$/.test(a.id)||activityIds.has(a.id)||!validDate(a.date)||!['lecture','reading','review','essay'].includes(a.type)||!validSubject(a.subject)||typeof a.title!=='string'||!a.title.trim()||a.title.length>100||integer(a.plannedMinutes,1,1440)===null||integer(a.completedMinutes,0,a.plannedMinutes)===null||integer(a.actualMinutes,0,1440)===null||!['pending','inprogress','completed'].includes(a.status)||typeof a.notes!=='string'||a.notes.length>5000||typeof a.needsReview!=='boolean')throw Error('學習項目內容不正確');
      if(a.lessonId&&!ids.has(a.lessonId))throw Error('學習項目堂次不存在');
      if(a.type!=='lecture'&&a.lessonId)throw Error('非函授項目不得綁定堂次');
      if(a.type==='lecture'&&!a.lessonId)throw Error('請選擇函授堂次');
      if(a.status==='completed'&&a.completedMinutes!==a.plannedMinutes||a.status!=='completed'&&a.completedMinutes===a.plannedMinutes)throw Error('完成狀態與進度不符');
      activityIds.add(a.id);
      return {id:a.id,date:a.date,type:a.type,subject:a.subject,title:a.title.trim(),lessonId:a.lessonId||'',plannedMinutes:Number(a.plannedMinutes),completedMinutes:Number(a.completedMinutes),actualMinutes:Number(a.actualMinutes),status:a.status,notes:a.notes,needsReview:a.needsReview};
    });
    for(const l of st.lessons)if(st.activities.filter(a=>a.lessonId===l.id).reduce((n,a)=>n+a.completedMinutes,0)>l.watchedMinutes)throw Error('學習紀錄超過堂次已看進度');
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
      if(!p||!validDate(p.startDate)||!Array.isArray(p.days)||typeof p.createdAt!=='string'||!Array.isArray(p.baseline)||p.baseline.length>5000)throw Error('原排程格式不符');
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
    const removedIds=new Set(st.lessons.filter(l=>l.courseId===id).map(l=>l.id));
    st.activities=st.activities.filter(a=>!removedIds.has(a.lessonId));
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
    if(!validDate(startDate)||integer(days,1,Number.MAX_SAFE_INTEGER)===null||days>Math.floor((Date.parse('9999-12-31T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/86400000)+1)throw Error('請輸入有效日期與正整數天數');
    return build(st,startDate,days);
  }
  function build(st,startDate,days){
    const cfg=st.settings,subjectMap=new Map(st.courses.map(c=>[c.id,c.subject]));
    const bySubject=new Map(),order=[];
    for(const lesson of st.lessons){
      const reserved=st.activities.filter(a=>a.lessonId===lesson.id&&a.date>=startDate).reduce((n,a)=>n+a.plannedMinutes-a.completedMinutes,0);
      const left=Math.max(0,lesson.durationMinutes-lesson.watchedMinutes-reserved),sub=subjectMap.get(lesson.courseId);
      if(left<=0)continue;
      if(!bySubject.has(sub)){bySubject.set(sub,[]);order.push(sub);}
      bySubject.get(sub).push({id:lesson.id,left});
    }
    const rule=s=>cfg.subjectRules[s]||{enabled:true,weight:1};
    const active=order.filter(s=>rule(s).enabled);
    const indexes=new Map(active.map(s=>[s,0])),allocated=new Map(active.map(s=>[s,0]));
    const hasWork=s=>active.includes(s)&&indexes.get(s)<bySubject.get(s).length;
    let rotateIndex=0,all=0;const rows=[];
    const occupied=new Map();
    for(const a of st.activities)occupied.set(a.date,(occupied.get(a.date)||0)+a.plannedMinutes);
    const weeklyPossible=Array.from({length:7},(_,i)=>capacity(cfg,datePlus(startDate,i))).some(n=>n>0);
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
      // 長期計畫略過已無待排工作之空白尾端；月曆仍可瀏覽完整起訖範圍。
      if(days>365&&(!active.some(hasWork)||!weeklyPossible||cfg.strategy==='fixed'&&!cfg.fixedDays.some(s=>hasWork(s))))break;
      const date=datePlus(startDate,d),cap=Math.max(0,capacity(cfg,date)-(occupied.get(date)||0)),units=[];
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
      const merged=new Map();for(const u of units)merged.set(u.lessonId,(merged.get(u.lessonId)||0)+u.minutes);
      rows.push({date,capacityMinutes:cap,units:[...merged].map(([lessonId,minutes])=>({lessonId,minutes})),scheduledMinutes:spent});
    }
    return {startDate,endDate:datePlus(startDate,days-1),rangeDays:days,createdAt:new Date().toISOString(),baseline:st.lessons.map(l=>({id:l.id,watchedMinutes:l.watchedMinutes})),days:rows,scheduledMinutes:all,unscheduledMinutes:Math.max(0,remaining(st)-all-st.activities.filter(a=>a.lessonId&&a.date>=startDate).reduce((n,a)=>n+a.plannedMinutes-a.completedMinutes,0)),strategy:cfg.strategy};
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
          let reservedDone=0;
          for(const a of st.activities.filter(a=>a.lessonId&&a.date===day.date)){
            const mins=a.plannedMinutes-a.completedMinutes;
            byId.get(a.lessonId).watchedMinutes+=mins;reservedDone+=mins;a.completedMinutes=a.plannedMinutes;
          }
          remain-=day.scheduledMinutes+reservedDone;
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
    return late+st.activities.filter(a=>a.date<date).reduce((n,a)=>n+a.plannedMinutes-a.completedMinutes,0);
  }
  
  function taskKey(plan,date,lessonId){return 'p_'+date+'_'+lessonId+'_'+(Date.parse(plan.createdAt)||0);}
  function calendarItems(state,date,plan=state.plan){
    const explicit=state.activities.filter(a=>a.date===date);
    const day=plan?.days.find(d=>d.date===date),items=explicit.map(a=>({...a}));
    const merged=new Map();
    for(const u of day?.units||[])merged.set(u.lessonId,(merged.get(u.lessonId)||0)+u.minutes);
    for(const [lessonId,mins] of merged){
      const l=state.lessons.find(x=>x.id===lessonId),c=l&&state.courses.find(x=>x.id===l.courseId);
      if(!c)continue;
      const baseline=plan.baseline.find(b=>b.id===lessonId)?.watchedMinutes||0;
      const tracked=state.activities.filter(a=>a.lessonId===lessonId&&a.id.startsWith('p_')&&a.id.endsWith('_'+(Date.parse(plan.createdAt)||0))).reduce((n,a)=>n+a.completedMinutes,0);
      const before=plan.days.filter(d=>d.date<date).reduce((n,d)=>n+d.units.filter(u=>u.lessonId===lessonId).reduce((m,u)=>m+u.minutes,0),0);
      const completedMinutes=Math.min(mins,Math.max(0,l.watchedMinutes-baseline-tracked-before));
      items.push({id:taskKey(plan,date,lessonId),date,type:'lecture',lessonId,subject:c.subject,title:(c.name===c.subject?'':c.name+'｜')+l.title,plannedMinutes:mins,completedMinutes,actualMinutes:0,status:completedMinutes===mins?'completed':completedMinutes>0?'inprogress':'pending',notes:'',needsReview:false,fromPlan:true});
    }
    return items;
  }
  function refreshPlan(st){
    if(!st.plan)return;
    st.plan.days.forEach(d=>{d.scheduledMinutes=d.units.reduce((n,u)=>n+u.minutes,0);d.capacityMinutes=Math.max(d.scheduledMinutes,Math.max(0,capacity(st.settings,d.date)-st.activities.filter(a=>a.date===d.date).reduce((n,a)=>n+a.plannedMinutes,0)));});
    st.plan.scheduledMinutes=st.plan.days.reduce((n,d)=>n+d.scheduledMinutes,0);
    const reserved=st.activities.filter(a=>a.lessonId).reduce((n,a)=>n+a.plannedMinutes-a.completedMinutes,0);
    st.plan.unscheduledMinutes=Math.max(0,remaining(st)-st.plan.scheduledMinutes-reserved);
  }
  function saveActivity(state,input,source=null){
    const st=normalize(state),old=st.activities.find(a=>a.id===input.id);
    const originalQueued=(st.plan?.days||[]).filter(d=>d.date>=todayTaipei()).reduce((n,d)=>n+calendarItems(st,d.date).filter(a=>a.fromPlan&&a.lessonId===input.lessonId&&a.id!==input.id).reduce((m,a)=>m+a.plannedMinutes-a.completedMinutes,0),0);
    const priorCompleted=old?.completedMinutes||(source?calendarItems(st,source.date).find(a=>a.id===input.id)?.completedMinutes:0)||0;
    if(!old&&source){
      const day=st.plan?.days.find(d=>d.date===source.date);
      if(!day||input.id!==taskKey(st.plan,source.date,source.lessonId))throw Error('原排程已變更，請重新開啟項目');
      const units=day.units.filter(u=>u.lessonId===source.lessonId);
      if(!units.length)throw Error('原排程項目不存在');
      day.units=day.units.filter(u=>u.lessonId!==source.lessonId);
    }
    // 已有完成紀錄的函授項目只能調整日期、時數、筆記；不得改綁另一堂次。
    if(old&&old.completedMinutes>0&&(old.lessonId!==input.lessonId||old.type!==input.type))throw Error('請先將完成進度改為0，再更換堂次');
    const next={...input};
    if(next.status==='completed')next.completedMinutes=Number(next.plannedMinutes);
    if(!next.lessonId)next.lessonId='';
    const delta=Number(next.completedMinutes)-priorCompleted;
    const lesson=st.lessons.find(l=>l.id===next.lessonId);
    if(next.type==='lecture'){
      if(!lesson)throw Error('請選擇函授堂次');
      const course=st.courses.find(c=>c.id===lesson.courseId);next.subject=course.subject;
      const watched=lesson.watchedMinutes+delta;
      if(watched<0||watched>lesson.durationMinutes)throw Error('完成分鐘數超過堂次剩餘進度');
      lesson.watchedMinutes=watched;
      const reserved=st.activities.filter(a=>a.id!==next.id&&a.lessonId===lesson.id&&a.date>=todayTaipei()).reduce((n,a)=>n+a.plannedMinutes-a.completedMinutes,0)
        +(next.date>=todayTaipei()?Number(next.plannedMinutes)-Number(next.completedMinutes):0);
      const queued=originalQueued;
      if(reserved+queued>lesson.durationMinutes-lesson.watchedMinutes)throw Error('此堂次已有其他預排；請先調整原項目或重新排程');
    }
    if(old)st.activities=st.activities.map(a=>a.id===next.id?next:a);else st.activities.push(next);
    const planned=st.activities.filter(a=>a.date===next.date).reduce((n,a)=>n+Number(a.plannedMinutes),0)+(st.plan?.days.find(d=>d.date===next.date)?.units||[]).reduce((n,u)=>n+u.minutes,0);
    if(planned>capacity(st.settings,next.date)&&(!old||next.date!==old.date||Number(next.plannedMinutes)>old.plannedMinutes))throw Error('超過當天可用學習時間，請調整分鐘數或日期');
    refreshPlan(st);return normalize(st);
  }
  function removeActivity(state,id,source=null){
    const st=normalize(state),old=st.activities.find(a=>a.id===id);
    if(old?.completedMinutes||old?.actualMinutes||old?.notes||old?.needsReview)throw Error('有實際紀錄的項目請保留，或先在編輯中清空紀錄');
    if(old)st.activities=st.activities.filter(a=>a.id!==id);
    else if(source){const day=st.plan?.days.find(d=>d.date===source.date);if(!day||id!==taskKey(st.plan,source.date,source.lessonId))throw Error('原排程已變更');day.units=day.units.filter(u=>u.lessonId!==source.lessonId);}
    else throw Error('找不到學習項目');
    refreshPlan(st);return normalize(st);
  }
  function observedForecast(state,startDate){
    const rows=state.activities.filter(a=>a.type==='lecture'&&a.completedMinutes>0&&a.date<=startDate);
    const dates=[...new Set(rows.map(a=>a.date))].sort();
    if(dates.length<2)return null;
    const span=Math.floor((Date.parse(startDate)-Date.parse(dates[0]))/86400000)+1;
    const completed=rows.reduce((n,a)=>n+a.completedMinutes,0);
    const days=Math.ceil(remaining(state)/(completed/span));
    if(days>Math.floor((Date.parse('9999-12-31')-Date.parse(startDate))/86400000))return null;
    const end=days?datePlus(startDate,days):startDate;
    return validDate(end)?end:null;
  }

  return {calendarItems,saveActivity,removeActivity,observedForecast,taskKey,KEY,SUBJECTS,STRATEGIES,empty,normalize,addCourse,updateLesson,removeCourse,capacity,remaining,schedule,forecast,delay,todayTaipei,datePlus,validDate,validSubject};
});
