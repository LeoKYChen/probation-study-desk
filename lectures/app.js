(() => {
  'use strict';
  const core=window.PSDLectureCore, $=id=>document.getElementById(id);
  const make=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
  const minutes=n=>n>=60?Math.floor(n/60)+' 小時'+(n%60?' '+n%60+' 分':''):n+' 分鐘';
  let state=core.empty(),canSave=true,draft=null,draftSettings=null,lastRaw=null;
  let monthCursor=core.todayTaipei().slice(0,7),selectedDate=core.todayTaipei();
  function tell(text,bad=false){$('message').textContent=text;$('message').dataset.error=bad?'1':'0';}
  function save(next){
    if(!canSave){tell('原資料尚未能安全讀取；請先保存備份再處理。',true);return false;}
    try{
      if(localStorage.getItem(core.KEY)!==lastRaw)throw Error('其他分頁已有更新，請重新整理後再儲存');
      const valid=core.normalize(next),raw=JSON.stringify(valid);
      localStorage.setItem(core.KEY,raw);
      if(localStorage.getItem(core.KEY)!==raw)throw Error('瀏覽器未回存資料');
      lastRaw=raw;state=valid;draft=null;draftSettings=null;render();return true;
    }catch(e){tell('儲存失敗：'+e.message+'。原本學習紀錄未主動清除。',true);return false;}
  }
  function init(){
    try{
      const raw=localStorage.getItem(core.KEY);lastRaw=raw;
      if(raw!==null)state=core.normalize(JSON.parse(raw));
    }catch(e){
      canSave=false;tell('目前無法安全讀取已儲存的函授資料：'+e.message+'。系統不會覆寫原資料。請先前往備份中心保存紀錄。',true);
      document.querySelectorAll('form input,form select,form button,#previewButton,#confirmButton').forEach(e=>e.disabled=true);
    }
    for(const sub of core.SUBJECTS){const option=make('option',sub);option.value=sub;$('courseSubject').append(option);}
    const other=make('option','＋ 自訂其他考科');other.value='__custom__';$('courseSubject').append(other);
    $('courseSubject').addEventListener('change',()=>{$('customSubjectWrap').hidden=$('courseSubject').value!=='__custom__';$('customSubject').required=!$('customSubjectWrap').hidden;});
    $('strategy').addEventListener('change',showStrategyFields);
    $('planDays').addEventListener('input',()=>{$('planEndDate').value='';});
    $('planEndDate').addEventListener('input',()=>{
      const end=$('planEndDate').value,start=core.todayTaipei();
      if(core.validDate(end)&&end>=start)$('planDays').value=String(Math.floor((Date.parse(end)-Date.parse(start))/86400000)+1);
    });
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
      const course=next.courses.find(c=>c.id===id);course.teacher=$('courseTeacher').value.trim();course.expiresOn=$('courseExpiry').value||'';
      if(save(next)){$('courseTeacher').value='';$('courseExpiry').value='';$('courseName').value='';$('customSubject').value='';tell('已新增函授課程，可以逐堂記錄觀看進度。');}
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
      checked.type='checkbox';checked.checked=r.enabled;checked.setAttribute('aria-label','將 '+subject+' 排入學習計畫');
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
    if($('planEndDate').value){
      const end=$('planEndDate').value,start=core.todayTaipei();
      if(!core.validDate(end)||end<start)throw Error('結束日期不得早於今天');
      next.settings.planDays=Math.floor((Date.parse(end)-Date.parse(start))/86400000)+1;
    }
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
    if(save(next))tell('已確認並保存'+next.settings.planDays+'天學習進度計畫。之後完成課程可隨時重新排程。');
  }
  function summary(){
    const courses=state.courses,lessons=state.lessons,total=lessons.reduce((n,l)=>n+l.durationMinutes,0);
    const watched=lessons.reduce((n,l)=>n+l.watchedMinutes,0),done=lessons.filter(l=>l.watchedMinutes===l.durationMinutes).length;
    $('lessonStat').textContent=done+'／'+lessons.length;
    $('percentStat').textContent=total?Math.round(100*watched/total)+'%':'—';
    $('remainingStat').textContent=minutes(total-watched);
    const forecast=core.forecast(state,core.todayTaipei());
    $('forecastStat').textContent=lessons.length?(forecast.finishDate||'目前無法估算'):'—';
    const observed=core.observedForecast(state,core.todayTaipei());
    $('observedNote').textContent=observed?'依已記錄的實際學習速度，預估函授完成日：'+observed+'。此為推估，會隨紀錄調整。':'實際速度預估：請先記錄至少兩個日期的函授完成進度；既有累計觀看分鐘不會被當成每日學習速度。';
    $('activityStat').textContent=state.activities.filter(a=>a.status==='completed').length+'／'+state.activities.length;
    $('actualStat').textContent=minutes(state.activities.reduce((n,a)=>n+a.actualMinutes,0));
    $('reviewStat').textContent=String(state.activities.filter(a=>a.needsReview).length);
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
    head.append(make('b',(course.subject===course.name?course.subject:course.subject+'｜'+course.name)),make('small','已完成 '+lessons.filter(l=>l.watchedMinutes===l.durationMinutes).length+'/'+lessons.length+' 堂'));
    summary.append(head,make('span',total?Math.round(watched*100/total)+'%':'—','course-percent'));
    if(course.teacher)head.append(make('small',course.teacher));
    if(course.expiresOn){
      const days=Math.floor((Date.parse(course.expiresOn)-Date.parse(core.todayTaipei()))/86400000);
      head.append(make('small',days<0?'觀看期限已過：'+course.expiresOn:'觀看期限 '+course.expiresOn+'（剩 '+days+' 天）',days<=45?'expiry-warning':''));
    }
    const upcoming=lessons.find(l=>l.watchedMinutes<l.durationMinutes);
    if(upcoming)head.append(make('small','接續：'+upcoming.title));
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
    const metadata=make('form',undefined,'fields course-metadata');
    const teacher=field('授課教師',course.teacher||''),expiry=field('觀看期限',course.expiresOn||'','date');
    const saveMeta=make('button','儲存教師與期限');saveMeta.type='submit';
    metadata.append(teacher.wrap,expiry.wrap,saveMeta);
    metadata.addEventListener('submit',e=>{e.preventDefault();try{
      const next=core.normalize(state),c=next.courses.find(x=>x.id===course.id);c.teacher=teacher.input.value.trim();c.expiresOn=expiry.input.value;
      if(save(next))tell('已更新課程資訊。');
    }catch(err){tell(err.message,true);}});
    group.append(metadata,remove);details.append(group);return details;
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
    renderPlan(draft||state.plan,!!draft);
  }

  const typeLabels={lecture:'函授',reading:'閱讀',review:'複習',essay:'申論練習'};
  const statusLabels={pending:'○ 未開始',inprogress:'◐ 進行中',completed:'✓ 已完成'};
  function selectField(label,options,initial){
    const wrap=make('label',label),input=make('select');
    input.setAttribute('aria-label',label);
    for(const [value,text] of options){const o=make('option',text);o.value=value;input.append(o);}
    input.value=initial;wrap.append(input);return {wrap,input};
  }
  function editItem(item,isNew=false){
    const panel=make('details',undefined,'task-editor');panel.open=isNew;
    panel.append(make('summary',isNew?'＋ 新增學習項目':'編輯／記錄進度'));
    const form=make('form',undefined,'fields activity-form');
    const date=field('日期',item.date,'date'),type=selectField('學習類型',Object.entries(typeLabels),item.type);
    const subject=field('科目',item.subject),title=field('學習內容',item.title);
    const lesson=selectField('函授堂次',[['','請選擇堂次'],...state.lessons.map(l=>{
      const c=state.courses.find(c=>c.id===l.courseId);return [l.id,c.subject+'｜'+(c.name===c.subject?'':c.name+'｜')+l.title];
    })],item.lessonId||'');
    const planned=field('預計分鐘',item.plannedMinutes,'number',1,1440);
    const completed=field('已完成進度（分鐘）',item.completedMinutes,'number',0,1440);
    const actual=field('實際學習分鐘',item.actualMinutes,'number',0,1440);
    const status=selectField('完成狀態',Object.entries(statusLabels),item.status);
    const noteWrap=make('label','重點與疑問'),notes=make('textarea');notes.value=item.notes;notes.maxLength=5000;notes.rows=3;notes.setAttribute('aria-label','重點與疑問');noteWrap.className='settings-full';noteWrap.append(notes);
    const reviewWrap=make('label',undefined,'review-check'),review=make('input');review.type='checkbox';review.checked=item.needsReview;
    reviewWrap.append(review,make('span','↻ 需要再看／複習'));reviewWrap.classList.add('settings-full');
    function showType(){
      const isLecture=type.input.value==='lecture';lesson.wrap.hidden=!isLecture;
      if(!isLecture)lesson.input.value='';
      subject.input.readOnly=isLecture;
    }
    type.input.addEventListener('change',showType);
    lesson.input.addEventListener('change',()=>{
      const l=state.lessons.find(l=>l.id===lesson.input.value),c=l&&state.courses.find(c=>c.id===l.courseId);
      if(c){subject.input.value=c.subject;title.input.value=(c.name===c.subject?'':c.name+'｜')+l.title;}
    });
    if(item.lessonId&&!isNew){type.input.disabled=true;lesson.input.disabled=true;}
    for(const f of [date,subject,title,planned,completed,actual])f.input.required=true;
    subject.input.maxLength=50;
    const submit=make('button','儲存學習紀錄','primary');submit.type='submit';submit.disabled=!canSave;
    form.append(date.wrap,type.wrap,subject.wrap,title.wrap,lesson.wrap,planned.wrap,status.wrap,completed.wrap,actual.wrap,noteWrap,reviewWrap,submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      try{
        const next=core.saveActivity(state,{
          id:item.id,date:date.input.value,type:type.input.value,subject:subject.input.value.trim(),title:title.input.value.trim(),
          lessonId:type.input.value==='lecture'?lesson.input.value:'',
          plannedMinutes:Number(planned.input.value),completedMinutes:Number(completed.input.value),actualMinutes:Number(actual.input.value),
          status:status.input.value,notes:notes.value,needsReview:review.checked
        },item.fromPlan?{date:item.date,lessonId:item.lessonId}:null);
        selectedDate=date.input.value;monthCursor=selectedDate.slice(0,7);
        if(save(next))tell('已儲存學習紀錄；預計時間與實際進度分開保留。');
      }catch(e){tell(e.message,true);}
    });
    showType();panel.append(form);return panel;
  }
  function renderCalendarDetails(plan){
    const box=$('calendarDetails');box.replaceChildren();box.append(make('h4',selectedDate));
    const items=core.calendarItems(state,selectedDate,plan);
    const total=items.reduce((n,a)=>n+a.plannedMinutes,0),actual=items.reduce((n,a)=>n+a.actualMinutes,0);
    box.append(make('p','學習可用 '+minutes(core.capacity(state.settings,selectedDate))+'；預排 '+minutes(total)+'；實際 '+minutes(actual)+'。'));
    if(draft){box.append(make('p','目前為預覽，請先確認採用計畫，再編輯或記錄進度。'));return;}
    if(!items.length)box.append(make('p','當天尚未安排學習，可以在下方新增。'));
    for(const item of items){
      const card=make('article',undefined,'learning-task');card.dataset.taskId=item.id;
      card.append(make('h5',item.subject+'｜'+item.title));
      card.append(make('p',typeLabels[item.type]+' · '+statusLabels[item.status]+(item.needsReview?' · ↻ 需複習':''),'task-status '+item.status));
      card.append(make('p','預計 '+minutes(item.plannedMinutes)+'／完成進度 '+minutes(item.completedMinutes)+'／實際 '+minutes(item.actualMinutes),'hint'));
      if(item.notes)card.append(make('p',item.notes,'task-note'));
      const actions=make('div',undefined,'actions');
      if(item.status!=='completed'){
        const done=make('button','完成本項');done.type='button';done.disabled=!canSave;
        done.addEventListener('click',()=>{try{
          const next=core.saveActivity(state,{...item,status:'completed'},item.fromPlan?{date:item.date,lessonId:item.lessonId}:null);
          if(save(next))tell('已標記完成；實際學習時間可在編輯中另行填寫。');
        }catch(e){tell(e.message,true);}});
        actions.append(done);
      }
      if(!item.completedMinutes&&!item.actualMinutes&&!item.notes&&!item.needsReview){
        const remove=make('button','移除此安排');remove.type='button';remove.disabled=!canSave;
        remove.addEventListener('click',()=>{try{
          const next=core.removeActivity(state,item.id,item.fromPlan?{date:item.date,lessonId:item.lessonId}:null);
          if(save(next))tell('已移除未開始的安排。');
        }catch(e){tell(e.message,true);}});
        actions.append(remove);
      }
      card.append(actions,editItem(item));box.append(card);
    }
    const subjects=knownSubjects();
    box.append(editItem({id:'a'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),date:selectedDate,type:'reading',subject:subjects[0]||'少年事件處理法',title:'',lessonId:'',plannedMinutes:15,completedMinutes:0,actualMinutes:0,status:'pending',notes:'',needsReview:false},true));
  }
  function renderCalendar(plan){
    const grid=$('calendarGrid');grid.replaceChildren();
    const [year,month]=monthCursor.split('-').map(Number);
    $('calendarMonth').textContent=year+'年'+month+'月';
    const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
    const count=new Date(Date.UTC(year,month,0)).getUTCDate();
    for(let i=0;i<offset;i++){const spacer=make('span',undefined,'calendar-blank');spacer.setAttribute('aria-hidden','true');grid.append(spacer);}
    for(let d=1;d<=count;d++){
      const date=monthCursor+'-'+String(d).padStart(2,'0'),items=core.calendarItems(state,date,plan);
      const total=items.reduce((n,a)=>n+a.plannedMinutes,0),done=items.filter(a=>a.status==='completed').length;
      const started=items.some(a=>a.status!=='pending'||a.completedMinutes>0),review=items.some(a=>a.needsReview);
      const stateClass=done&&done===items.length?' completed':started?' inprogress':'';
      const cell=make('button',undefined,'calendar-cell'+(total?' has-plan':' no-plan')+stateClass+(date===core.todayTaipei()?' is-today':''));
      cell.type='button';cell.setAttribute('aria-pressed',String(selectedDate===date));cell.append(make('span',String(d),'date'));
      let description='未安排';
      if(items.length){
        const subjects=[...new Set(items.map(a=>a.subject))];
        cell.append(make('span',minutes(total),'minutes'),make('span',subjects.join('／'),'calendar-subject'));
        const label=(done===items.length?'✓ 已完成':started?'◐ 進行中':'○ 未開始')+' '+done+'/'+items.length+(review?' ↻':'');
        cell.append(make('span',label,'calendar-status'));description=subjects.join('、')+'，預排 '+minutes(total)+'，'+label;
      }else cell.append(make('span','未安排','no-plan-text'));
      cell.setAttribute('aria-label',date+'：'+description);
      cell.addEventListener('click',()=>{selectedDate=date;renderCalendar(plan);});
      grid.append(cell);
    }
    renderCalendarDetails(plan);
  }
  function renderPlan(plan,preview){
    const output=$('planList');output.replaceChildren();
    $('planSummary').textContent=plan?(preview?'預覽（尚未儲存）':'已儲存計畫')+'｜'+plan.startDate+' ～ '+(plan.endDate||plan.days.at(-1)?.date||plan.startDate)+'｜本次排入 '+minutes(plan.scheduledMinutes||0)+'，剩餘 '+minutes(plan.unscheduledMinutes||0)+' 尚待後續排程。':'尚未建立自動排程；也可以直接在月曆新增學習項目。';
    // 每次只建立目前月份的清單，長期計畫不會一次鋪滿頁面。
    const [y,m]=monthCursor.split('-').map(Number),count=new Date(Date.UTC(y,m,0)).getUTCDate();
    for(let i=1;i<=count;i++){
      const date=monthCursor+'-'+String(i).padStart(2,'0'),items=core.calendarItems(state,date,plan);
      if(!items.length)continue;
      const row=make('article',undefined,'day');row.append(make('h3',date));
      for(const a of items)row.append(make('p',a.subject+'｜'+a.title+'：'+minutes(a.plannedMinutes)+' · '+statusLabels[a.status]));
      output.append(row);
    }
    if(!output.childNodes.length)output.append(make('p','本月尚未安排學習。'));
    renderCalendar(plan);
  }
  function render(){
    for(const k of ['weekdayMinutes','weekendMinutes','reserveMinutes','reviewDays'])$(k).value=state.settings[k];
    $('examDate').value=state.settings.examDate;
    $('strategy').value=state.settings.strategy;
    $('planDays').value=String(state.settings.planDays);$('planEndDate').value='';
    $('maxSubjectsPerDay').value=String(state.settings.maxSubjectsPerDay);
    renderRuleEditors();showStrategyFields();
    $('confirmButton').disabled=!draft;
    summary();renderCourses();renderPlan(draft||state.plan,!!draft);
  }
  init();
})();
