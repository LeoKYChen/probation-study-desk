(() => {
  'use strict';
  const core=window.PSDLectureCore, $=id=>document.getElementById(id);
  const make=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
  const minutes=n=>n>=60?Math.floor(n/60)+' 小時'+(n%60?' '+n%60+' 分':''):n+' 分鐘';
  let state=core.empty(),canSave=true,draft=null;
  function tell(text,bad=false){$('message').textContent=text;$('message').dataset.error=bad?'1':'0';}
  function save(next){
    if(!canSave){tell('原資料尚未能安全讀取；請先保存備份再處理。',true);return false;}
    try{
      const valid=core.normalize(next),raw=JSON.stringify(valid);
      localStorage.setItem(core.KEY,raw);
      if(localStorage.getItem(core.KEY)!==raw)throw Error('瀏覽器未回存資料');
      state=valid;draft=null;render();return true;
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
      const next=core.addCourse(state,$('courseSubject').value,$('courseName').value,$('courseCount').value,$('courseDuration').value,id);
      if(save(next)){$('courseName').value='';tell('已新增函授課程，可以逐堂記錄觀看進度。');}
    }catch(e){tell(e.message,true);}
  }
  function onSettings(event){
    event.preventDefault();
    try{
      const next=core.normalize(state);
      for(const k of ['weekdayMinutes','weekendMinutes','reserveMinutes','reviewDays']){
        const val=Number($(k).value);
        if(!Number.isInteger(val))throw Error('讀書時數請輸入整數');
        next.settings[k]=val;
      }
      next.settings.examDate=$('examDate').value||'';
      next.plan=state.plan;
      if(save(next))tell('讀書時間已儲存。如需調整既定排程，請先預覽再確認。');
    }catch(e){tell('設定錯誤：'+e.message,true);}
  }
  function onPreview(){
    if(!canSave)return;
    try{
      draft=core.schedule(state,core.todayTaipei());
      $('confirmButton').disabled=false;
      renderPlan(draft,true);
      tell('已計算新計畫，尚未修改原本排程。請確認後再儲存。');
    }catch(e){tell('無法預覽：'+e.message,true);}
  }
  function onConfirm(){
    if(!draft||!canSave)return;
    const next=core.normalize(state);
    next.plan=draft;
    if(save(next))tell('已確認並保存7天函授進度計畫。之後完成課程可隨時重新排程。');
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
      edit.append(title.wrap,duration.wrap,watchedField.wrap,submit,complete);
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
  function renderPlan(plan,preview){
    const output=$('planList');output.replaceChildren();
    if(!plan){$('planSummary').textContent='尚未建立函授計畫。';return;}
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
  }
  function render(){
    for(const k of ['weekdayMinutes','weekendMinutes','reserveMinutes','reviewDays'])$(k).value=state.settings[k];
    $('examDate').value=state.settings.examDate;
    $('confirmButton').disabled=!draft;
    summary();renderCourses();renderPlan(draft||state.plan,!!draft);
  }
  init();
})();
