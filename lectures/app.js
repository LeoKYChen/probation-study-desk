(() => {
  'use strict';
  const core=window.PSDLectureCore, $=id=>document.getElementById(id);
  const make=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
  const minutes=n=>n>=60?Math.floor(n/60)+' 小時'+(n%60?' '+n%60+' 分':''):n+' 分鐘';
  let state=core.empty(),canSave=true,draft=null,draftSettings=null;
  let monthCursor=core.todayTaipei().slice(0,7),selectedDate=core.todayTaipei();
  function tell(text,bad=false){$('message').textContent=text;$('message').dataset.error=bad?'1':'0';}
  function save(next){
    if(!canSave){tell('原資料尚未能安全讀取；請先保存備份再處理。',true);return false;}
    try{
      const valid=core.normalize(next),raw=JSON.stringify(valid);
      localStorage.setItem(core.KEY,raw);
      if(localStorage.getItem(core.KEY)!==raw)throw Error('瀏覽器未回存資料');
      state=valid;draft=null;draftSettings=null;window.PSDLocalJournal?.note(core.KEY);render();return true;
    }catch(e){tell('儲存失敗：'+e.message+'。原本學習紀錄未主動清除。',true);return false;}
  }
  function init(){
    try{
      const raw=localStorage.getItem(core.KEY);
      if(raw!==null)state=core.normalize(JSON.parse(raw));
    }catch(e){
      canSave=false;tell('目前無法安全讀取已儲存的函授資料：'+e.message+'。系統不會覆寫原資料。請先前往備份中心保存紀錄。',true);
      document.querySelectorAll('form input,form select,form button,#previewButton,#confirmButton').forEach(e=>e.disabled=true);
    }
    for(const sub of core.SUBJECTS){const option=make('option',sub);option.value=sub;$('courseSubject').append(option);}
    const other=make('option','＋ 自訂其他考科');other.value='__custom__';$('courseSubject').append(other);
    $('courseSubject').addEventListener('change',()=>{$('customSubjectWrap').hidden=$('courseSubject').value!=='__custom__';$('customSubject').required=!$('customSubjectWrap').hidden;});
    $('strategy').addEventListener('change',showStrategyFields);
    $('prevMonth').addEventListener('click',()=>moveMonth(-1));
    $('nextMonth').addEventListener('click',()=>moveMonth(1));
    $('courseForm').addEventListener('submit',onAdd);
    $('settingsForm').addEventListener('submit',onSettings);
    $('previewButton').addEventListener('click',onPreview);
    $('confirmButton').addEventListener('click',onConfirm);
    render();
  }
  function onAdd(event){
    event.preventDefault();
    try{
      const id='c'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
      const subject=$('courseSubject').value==='__custom__'?$('customSubject').value.trim():$('courseSubject').value;
      const next=core.addCourse(state,subject,$('courseName').value,$('courseCount').value,$('courseDuration').value,id);
      if(save(next)){$('courseName').value='';$('customSubject').value='';tell('已新增函授課程，可以逐堂記錄觀看進度。');}
    }catch(e){tell(e.message,true);}
  }
  function knownSubjects(){
    return [...new Set(state.courses.map(c=>c.subject))];
  }
  function renderRuleEditors(){
    const subjects=knownSubjects(),picker=$('courseSubject');
    const old=picker.value;
    // 已新增的自訂科目也能重複使用，不需重新輸入。
    picker.querySelectorAll('[data-added-subject]').forEach(x=>x.remove());
    const other=picker.querySelector('[value="__custom__"]');
    for(const sub of subjects){
      if(core.SUBJECTS.includes(sub))continue;
      const o=make('option',sub);o.value=sub;o.dataset.addedSubject='1';
      picker.insertBefore(o,other);
    }
    picker.value=[...picker.options].some(o=>o.value===old)?old:core.SUBJECTS[0];
    $('customSubjectWrap').hidden=picker.value!=='__custom__';
    $('customSubject').required=!$('customSubjectWrap').hidden;
    const rules=$('subjectRules');rules.replaceChildren();
    for(const subject of subjects){
      const r=state.settings.subjectRules[subject]||{enabled:true,weight:1};
      const line=make('div',undefined,'subject-rule');line.dataset.subject=subject;
      const label=make('label',undefined,'include'),checked=make('input');
      checked.type='checkbox';checked.checked=r.enabled;checked.setAttribute('aria-label','將 '+subject+' 排入函授計畫');
      label.append(checked,make('span',subject));
      const w=make('label',undefined,'weight'),select=make('select');
      for(let n=1;n<=5;n++){const opt=make('option',String(n));opt.value=String(n);select.append(opt);}
      select.value=String(r.weight);select.setAttribute('aria-label',subject+' 重要程度');
      w.append(make('span','重要程度'),select);
      line.append(label,w);rules.append(line);
    }
    if(!subjects.length)rules.append(make('p','請先新增至少一門函授課程，才能設定科目權重。','hint'));
    const names=['週日','週一','週二','週三','週四','週五','週六'];
    const fixed=$('fixedDays');fixed.replaceChildren();
    for(let i=0;i<7;i++){
      const box=make('label',undefined,'fixed-day');
      box.append(make('span',names[i]));
      const sel=make('select');sel.dataset.dayIndex=String(i);
      const blank=make('option','不排函授');blank.value='';sel.append(blank);
      for(const sub of subjects){const opt=make('option',sub);opt.value=sub;sel.append(opt);}
      sel.value=state.settings.fixedDays[i]||'';
      box.append(sel);fixed.append(box);
    }
  }
  function showStrategyFields(){
    const chosen=$('strategy').value;
    $('fixedDaysArea').hidden=chosen!=='fixed';
    $('subjectLimitWrap').hidden=chosen!=='weighted';
    for(const row of $('subjectRules').querySelectorAll('.weight')){
      row.hidden=chosen!=='weighted';
      row.querySelector('select').disabled=chosen!=='weighted';
    }
  }
  function readSettings(){
    const next=core.normalize(state);
    for(const key of ['weekdayMinutes','weekendMinutes','reserveMinutes','reviewDays']){
      if($(key).value.trim()==='')throw Error('讀書時數與複習天數不可留空');
      const n=Number($(key).value);
      if(!Number.isInteger(n))throw Error('讀書時數請輸入整數');
      next.settings[key]=n;
    }
    next.settings.examDate=$('examDate').value||'';
    next.settings.strategy=$('strategy').value;
    next.settings.planDays=Number($('planDays').value);
    next.settings.maxSubjectsPerDay=Number($('maxSubjectsPerDay').value);
    next.settings.subjectRules=Object.create(null);
    for(const row of $('subjectRules').querySelectorAll('.subject-rule')){
      next.settings.subjectRules[row.dataset.subject]={
        enabled:row.querySelector('.include input').checked,
        weight:Number(row.querySelector('.weight select').value)
      };
    }
    next.settings.fixedDays=Array.from($('fixedDays').querySelectorAll('select')).map(e=>e.value);
    return core.normalize(next);
  }
  function onSettings(event){
    event.preventDefault();
    try{
      const next=readSettings();
      next.plan=state.plan;
      if(save(next))tell('讀書時間已儲存。如需調整既定排程，請先預覽再確認。');
    }catch(e){tell('設定錯誤：'+e.message,true);}
  }
  function onPreview(){
    if(!canSave)return;
    try{
      const proposed=readSettings();
      draftSettings=proposed.settings;
      draft=core.schedule(proposed,core.todayTaipei(),proposed.settings.planDays);
      $('confirmButton').disabled=false;
      renderPlan(draft,true);
      tell('已計算新計畫，尚未修改原本排程。請確認後再儲存。');
    }catch(e){tell('無法預覽：'+e.message,true);}
  }
  function onConfirm(){
    if(!draft||!canSave)return;
    const next=core.normalize(state);
    next.settings=draftSettings;
    next.plan=draft;
    if(save(next))tell('已確認並保存'+next.settings.planDays+'天函授進度計畫。之後完成課程可隨時重新排程。');
  }
  function summary(){
    const courses=state.courses,lessons=state.lessons,total=lessons.reduce((n,l)=>n+l.durationMinutes,0);
    const watched=lessons.reduce((n,l)=>n+l.watchedMinutes,0),done=lessons.filter(l=>l.watchedMinutes===l.durationMinutes).length;
    $('lessonStat').textContent=done+'／'+lessons.length;
    $('percentStat').textContent=total?Math.round(100*watched/total)+'%':'—';
    $('remainingStat').textContent=minutes(total-watched);
    const forecast=core.forecast(state,core.todayTaipei());
    $('forecastStat').textContent=lessons.length?(forecast.finishDate||'目前時數不足'):'—';
    let msg='預估依目前的每天可用時數計算，不代表已看完或保證能考前完成。';
    if(forecast.reviewCutoff){
      msg+=' 考前預留複習的截止日：'+forecast.reviewCutoff+'。';
      if(forecast.risk)msg+=' 依目前設定可能無法在預留複習日前看完，建議檢視課程優先順序或可用時數。';
      else msg+=' 依目前設定預估可在預留複習日前完成。';
    }
    $('riskNote').textContent=lessons.length?msg:'';
    const start=core.todayTaipei();let cap=0;
    for(let i=0;i<7;i++)cap+=core.capacity(state.settings,core.datePlus(start,i));
    $('timeNote').textContent='今天起7天的函授可用時間：'+minutes(cap)+'（已逐日扣除預留的既有練習時間）；未設定考試日期時，只估算完課日。';
    const late=core.delay(state,start);
    $('lateNote').textContent=state.plan?(late>0?'先前計畫截至昨天尚有 '+minutes(late)+' 未完成。可按「預覽新進度安排」將剩餘內容向後調整。':'已保存上一份計畫；課程進度更新後，可按需要重新排程。'):'尚未儲存函授排程，請先建立課程並預覽。';
  }
  function field(label,initial,type='text',min,max){
    const wrap=make('label'),input=make('input');
    wrap.textContent=label;input.type=type;input.value=String(initial);input.setAttribute('aria-label',label);
    if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);
    if(type==='text')input.maxLength=100;
    wrap.append(input);return {wrap,input};
  }
  function courseBlock(course){
    const lessons=state.lessons.filter(l=>l.courseId===course.id);
    const total=lessons.reduce((n,l)=>n+l.durationMinutes,0),watched=lessons.reduce((n,l)=>n+l.watchedMinutes,0);
    const details=make('details',undefined,'course');details.open=state.courses.length===1;
    const summary=make('summary');
    const head=make('span',undefined,'course-head');
    head.append(make('b',course.subject+'｜'+course.name),make('small','已完成 '+lessons.filter(l=>l.watchedMinutes===l.durationMinutes).length+'/'+lessons.length+' 堂'));
    summary.append(head,make('span',total?Math.round(watched*100/total)+'%':'—','course-percent'));
    details.append(summary);
    const bar=make('div',undefined,'bar'),fill=make('i');fill.style.width=(total?Math.round(watched*100/total):0)+'%';bar.append(fill);details.append(bar);
    const group=make('div',undefined,'lessons');
    for(const lesson of lessons){
      const row=make('div',undefined,'lesson'),name=make('span',lesson.title,'lesson-name');
      name.append(make('small','已觀看 '+minutes(lesson.watchedMinutes)+'／'+minutes(lesson.durationMinutes)));
      const edit=make('div',undefined,'lesson-edit');
      const title=field('單元',lesson.title),duration=field('總分鐘',lesson.durationMinutes,'number',1,1440),watchedField=field('已看分鐘',lesson.watchedMinutes,'number',0,1440);
      title.wrap.classList.add('title');duration.wrap.classList.add('minutes');watchedField.wrap.classList.add('minutes');
      const submit=make('button','儲存');submit.type='button';
      const complete=make('button','標記完成');complete.type='button';
      function change(done){
        try{
          const mins=Number(duration.input.value),w=done?mins:Number(watchedField.input.value);
          const next=core.updateLesson(state,lesson.id,w,mins,title.input.value);
          if(save(next))tell('已更新「'+course.name+'／'+lesson.title+'」的函授紀錄。');
        }catch(e){tell(e.message,true);}
      }
      submit.addEventListener('click',()=>change(false));
      complete.addEventListener('click',()=>change(true));
      const actions=make('div',undefined,'lesson-actions');actions.append(submit,complete);
      edit.append(title.wrap,duration.wrap,watchedField.wrap,actions);
      row.append(name,edit);group.append(row);
    }
    const remove=make('button','刪除此課程及全部堂次','course-delete');remove.type='button';
    remove.addEventListener('click',()=>{
      if(!confirm('確定刪除「'+course.name+'」及所有觀看紀錄嗎？此操作無法在網站直接復原，建議先下載完整 JSON 備份。'))return;
      try{const next=core.removeCourse(state,course.id);if(save(next))tell('課程已刪除，請重新確認排程。');}
      catch(e){tell(e.message,true);}
    });
    group.append(remove);details.append(group);return details;
  }
  function renderCourses(){
    const root=$('courseList');root.replaceChildren();
    if(!state.courses.length){root.append(make('p','目前尚未新增函授課程。'));return;}
    for(const course of state.courses)root.append(courseBlock(course));
  }
  function moveMonth(n){
    const [year,month]=monthCursor.split('-').map(Number);
    const first=new Date(Date.UTC(year,month-1+n,1));
    monthCursor=first.toISOString().slice(0,7);
    selectedDate=monthCursor+'-01';
    renderCalendar(draft||state.plan);
  }
  function renderCalendarDetails(plan){
    const box=$('calendarDetails');box.replaceChildren();
    const title=make('h4',selectedDate);box.append(title);
    if(!plan){box.append(make('p','尚未有預排計畫；先按「預覽新進度安排」。'));return;}
    const day=plan.days.find(x=>x.date===selectedDate);
    if(!day){
      box.append(make('p','此日期未包含在目前的'+plan.days.length+'天預排範圍。可將預排天數改為30、60或90天後重新預覽。'));
      return;
    }
    box.append(make('p','函授可用 '+minutes(day.capacityMinutes)+'；預排 '+minutes(day.scheduledMinutes)+'。'));
    if(!day.units.length){box.append(make('p','本日未安排函授課程（可能是休息、固定科目未設定，或已完成待排課程）。'));return;}
    const courseById=new Map(state.courses.map(c=>[c.id,c])),lessonById=new Map(state.lessons.map(l=>[l.id,l]));
    const ul=make('ul');
    for(const u of day.units){
      const lesson=lessonById.get(u.lessonId),course=lesson&&courseById.get(lesson.courseId);
      ul.append(make('li',(course?course.subject+'｜'+course.name+'｜'+lesson.title:'已移除堂次')+'：'+minutes(u.minutes)));
    }
    box.append(ul);
  }
  function renderCalendar(plan){
    const grid=$('calendarGrid');grid.replaceChildren();
    const [year,month]=monthCursor.split('-').map(Number);
    $('calendarMonth').textContent=year+'年'+month+'月';
    const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
    const count=new Date(Date.UTC(year,month,0)).getUTCDate();
    for(let i=0;i<offset;i++){const spacer=make('span',undefined,'calendar-blank');spacer.setAttribute('aria-hidden','true');grid.append(spacer);}
    const byDate=new Map((plan?.days||[]).map(x=>[x.date,x]));
    const courseById=new Map(state.courses.map(c=>[c.id,c])),lessonById=new Map(state.lessons.map(l=>[l.id,l]));
    for(let d=1;d<=count;d++){
      const date=monthCursor+'-'+String(d).padStart(2,'0'),data=byDate.get(date);
      const cell=make('button',undefined,'calendar-cell'+(data?.scheduledMinutes?' has-plan':' no-plan')+(date===core.todayTaipei()?' is-today':''));
      cell.type='button';cell.setAttribute('aria-pressed',String(selectedDate===date));
      cell.append(make('span',String(d),'date'));
      let description='未納入預排範圍';
      if(data){
        if(data.scheduledMinutes){
          const subjects=[...new Set(data.units.map(u=>{
            const lesson=lessonById.get(u.lessonId);
            return lesson?courseById.get(lesson.courseId)?.subject||'':null;
          }).filter(Boolean))];
          cell.append(make('span',minutes(data.scheduledMinutes),'minutes'));
          cell.append(make('span',subjects.join('／'),'calendar-subject'));
          description=subjects.join('、')+'，預排 '+minutes(data.scheduledMinutes);
        }else{
          cell.append(make('span','無函授','no-plan-text'));
          description='本日無函授安排';
        }
      }else cell.append(make('span','未預排','no-plan-text'));
      cell.setAttribute('aria-label',date+'：'+description);
      cell.addEventListener('click',()=>{selectedDate=date;renderCalendar(plan);});
      grid.append(cell);
    }
    renderCalendarDetails(plan);
  }
  function renderPlan(plan,preview){
    const output=$('planList');output.replaceChildren();
    if(!plan){$('planSummary').textContent='尚未建立函授計畫。';renderCalendar(null);return;}
    $('planSummary').textContent=(preview?'預覽（尚未儲存）':'已儲存計畫')+'｜本次排入 '+minutes(plan.scheduledMinutes||0)+'，剩餘 '+minutes(plan.unscheduledMinutes||0)+' 尚待後續排程。';
    const courseById=new Map(state.courses.map(c=>[c.id,c])),lessonById=new Map(state.lessons.map(l=>[l.id,l]));
    for(const d of plan.days){
      const day=make('article',undefined,'day'+(!d.units.length?' empty':'')),h=make('h3');
      h.append(make('span',d.date),make('small','可用 '+minutes(d.capacityMinutes)));
      day.append(h);
      if(!d.units.length)day.append(make('p','當日無函授安排。'));
      for(const unit of d.units){
        const lesson=lessonById.get(unit.lessonId),course=lesson&&courseById.get(lesson.courseId);
        day.append(make('p',(course?course.subject+'｜'+course.name+'｜'+lesson.title:'已刪除堂次')+'：'+minutes(unit.minutes)));
      }
      output.append(day);
    }
    renderCalendar(plan);
  }
  function render(){
    for(const k of ['weekdayMinutes','weekendMinutes','reserveMinutes','reviewDays'])$(k).value=state.settings[k];
    $('examDate').value=state.settings.examDate;
    $('strategy').value=state.settings.strategy;
    $('planDays').value=String(state.settings.planDays);
    $('maxSubjectsPerDay').value=String(state.settings.maxSubjectsPerDay);
    renderRuleEditors();showStrategyFields();
    $('confirmButton').disabled=!draft;
    summary();renderCourses();renderPlan(draft||state.plan,!!draft);
  }
  init();
})();
