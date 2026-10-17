/* v2.5.3: Reuse the SAME existing essay editor for today's task and free subject practice.
   Move DOM element, never clone it or copy/delete drafts. No new localStorage keys. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  function relocate() {
    const editor=$('essayEditor'), today=$('dailyEssayWorkbenchSlot'), free=$('freeEssayWorkbenchSlot');
    const picker=$('essayPracticeSubject');
    if(!editor||!today||!free||!picker)return;
    const onToday=picker.value==='today';
    if(onToday){
      if(editor.parentElement!==today)today.append(editor);
    }else{
      if(editor.parentElement!==free)free.append(editor);
    }
    $('essayWorkbenchLocationHint').hidden=!onToday;
    $('dailyEssayLocationHint').hidden=onToday;
  }
  function switchToToday(){
    const picker=$('essayPracticeSubject');if(!picker)return;
    if(picker.value!=='today'){
      picker.value='today';
      picker.dispatchEvent(new Event('change',{bubbles:true}));
    }
    relocate();
  }
  function start(){
    if(!$('dailyEssayPanel'))return;
    $('dailyEssayResume').addEventListener('click',()=>{
      switchToToday();
      $('essayEditor').open=true;
      $('essayEditor').scrollIntoView({block:'start',behavior:'smooth'});
    });
    $('essayPracticeSubject').addEventListener('change',relocate);
    window.addEventListener('study30:render',relocate);
    relocate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();