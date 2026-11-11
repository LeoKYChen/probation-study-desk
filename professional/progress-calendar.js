/* Selecting a date is read-only. An explicit action opens the practice editor. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let month='',selected='',lastToday='',lastCurrentMonth='';
 const hasProgress=session=>window.Study30App.hasSessionProgress(session);
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 function daysInMonth(value){
  const [y,m]=value.split('-').map(Number),length=new Date(Date.UTC(y,m,0)).getUTCDate();
  return Array.from({length},(_,i)=>value+'-'+String(i+1).padStart(2,'0'));
 }
 function changeMonth(delta){
  const [y,m]=month.split('-').map(Number);month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);selected='';render();
 }
 function showRecord(sessions,bank){
  const host=$('progressMonthRecord');host.replaceChildren();
  if(!selected){host.textContent='點選日期查看紀錄。';return;}
  host.append(make('h3',selected+' 練習紀錄'));
  const s=sessions[selected];
  if(!hasProgress(s)){host.append(make('p','當天尚無練習紀錄。','muted'));return;}
  const date=selected;
  const attempts=window.Study30App.repeatAttempts(s);
  const lastAttempt=attempts.at(-1);
  const label=!s.finished?'接續這天的練習':lastAttempt&&!lastAttempt.finished?'接續重練':'重新練習這題';
  const action=make('button',label,'secondary');
  action.type='button';
  action.addEventListener('click',()=>window.Study30App.openHistoryPractice(date));
  host.append(action);
  appendRecord(host,s,bank);
  attempts.forEach((attempt,index)=>{
   const details=make('details');
   details.append(make('summary','第 '+(index+1)+' 次重練'));
   appendRecord(details,attempt,bank);
   host.append(details);
  });
 }
 function appendRecord(host,s,bank){
  const q=bank.find(q=>q.id===s.questionId);
  host.append(make('p',(q?.subject||'自主練習')+'｜'+(q?.title||s.questionId||'未選題')));
  const rating={mastered:'能自行說明',partial:'還不完整',review:'需要再複習'}[s.rating]||'尚未自評';
  host.append(make('p',(s.finished?'已標記完成':'尚未完成')+'｜專注 '+Math.floor(Number(s.elapsed||0)/60)+' 分｜'+rating));
  if(s.practiceMode==='structure'){
    host.append(make('p','訓練模式：申論結構教練'));
    const model=window.Study30StructureCoachModel;
    if(model?.hasActivity(s.structureCoach)){
      const c=model.normalize(s.structureCoach),details=make('details');
      details.append(make('summary','查看申論結構教練紀錄'));
      const sections=[
        ['題目已知事實',c.facts],['核心法律問題',c.coreQuestion],['必要前提',c.prerequisites],
        ['標題骨架',c.outline.filter(x=>x.title.trim()||x.question.trim()).map((x,i)=>(i+1)+'. '+x.title+'｜'+x.question).join('\n')],
        ['本段爭點',c.paragraph.issue],['規範及要件',c.paragraph.rule],
        ['具體涵攝',c.paragraph.application],['本段結論',c.paragraph.conclusion],
        ['整合段落',c.paragraph.combined],
        ['結構自我檢查',c.checks.map((x,i)=>(i+1)+'. '+(x?'已確認':'待確認')).join('\n')],
        ['主要結構問題',c.weakness],['下次改善目標',c.nextGoal]
      ];
      for(const [label,value] of sections){
        if(!String(value||'').trim())continue;
        details.append(make('h4',label),make('pre',value));
      }
      host.append(details);
    }
  }
  const notes=Array.isArray(s.notes)?s.notes.filter(t=>typeof t==='string'&&t.trim()):[];
  if(notes.length){host.append(make('h4','步驟速記'),make('pre',notes.join('\n\n')));}
  const drafts=Object.entries(s.essayDrafts||{});
  for(const [id,draft] of drafts){
   if(!draft||typeof draft!=='object')continue;
   const parts=[...(Array.isArray(draft.outline)?draft.outline:[]),draft.fullAnswer].filter(t=>typeof t==='string'&&t.trim());
   if(!parts.length)continue;
   const details=make('details'),name=bank.find(q=>q.id===id);
   details.append(make('summary','申論草稿｜'+(name?.title||id)),make('pre',parts.join('\n\n')));host.append(details);
  }
 }
 function render(){
  const data=window.Study30App?.getEssayReviewData?.();if(!data||!$('progressMonthGrid'))return;
  const {sessions,bank,today}=data,currentMonth=today.slice(0,7);
  // Follow a date rollover only when the viewer was looking at the current month.
  if(!month||(today!==lastToday&&month===lastCurrentMonth))month=currentMonth;
  lastToday=today;lastCurrentMonth=currentMonth;
  $('progressMonthLabel').textContent=month.replace('-',' 年 ')+' 月';
  $('nextProgressMonth').disabled=month>=currentMonth;
  const host=$('progressMonthGrid');host.replaceChildren();
  for(const label of ['一','二','三','四','五','六','日'])host.append(make('div',label,'month-weekday'));
  const days=daysInMonth(month),offset=(new Date(days[0]+'T00:00:00Z').getUTCDay()+6)%7;
  for(let i=0;i<offset;i++){const spacer=make('span');spacer.setAttribute('aria-hidden','true');host.append(spacer);}
  for(const date of days){
   const s=sessions[date],button=make('button',undefined,'month-day'+(date===today?' today':'')+(s?.finished?' finished':''));
   button.type='button';button.dataset.date=date;button.disabled=date>today;
   const state=date>today?'尚未到來':hasProgress(s)?(s.finished?'已完成':'有紀錄'):'無紀錄';
   button.setAttribute('aria-label',date+' '+state);button.setAttribute('aria-pressed',String(selected===date));
   button.append(make('strong',String(Number(date.slice(-2)))),make('small',state));
   button.addEventListener('click',()=>{
    selected=date;
    render();
    $('progressMonthRecord').scrollIntoView({block:'nearest',behavior:'smooth'});
   });
   host.append(button);
  }
  showRecord(sessions,bank);
 }
 function start(){
  if(!$('showMonthProgress'))return;
  for(const view of ['Week','Month'])$('show'+view+'Progress').addEventListener('click',()=>{
   const week=view==='Week';$('weeklyProgressPanel').hidden=!week;$('monthlyProgressPanel').hidden=week;
   $('showWeekProgress').setAttribute('aria-pressed',String(week));$('showMonthProgress').setAttribute('aria-pressed',String(!week));render();
  });
  $('previousProgressMonth').addEventListener('click',()=>changeMonth(-1));
  $('nextProgressMonth').addEventListener('click',()=>{const today=window.Study30App.getEssayReviewData().today;if(month<today.slice(0,7))changeMonth(1);});
  window.addEventListener('study30:render',render);window.addEventListener('study30:essay-assessed',render);render();
 }
 window.Study30ProgressCalendar={daysInMonth,validDate};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
