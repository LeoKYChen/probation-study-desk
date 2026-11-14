/* Content-collapse only: wrap the SAME live panels; preserve controls and listeners. */
(function(){
  'use strict';
  function fold(selector,title){
    const panel=document.querySelector(selector);
    if(!panel||panel.parentElement?.classList.contains('content-collapse-body'))return;
    const wrapper=document.createElement('details');
    wrapper.className='content-collapse';
    const summary=document.createElement('summary');
    summary.textContent=title;
    summary.setAttribute('aria-label',title+'，按此展開或收合');
    const body=document.createElement('div');
    body.className='content-collapse-body';
    panel.parentNode.insertBefore(wrapper,panel);
    wrapper.append(summary,body);
    body.append(panel);
    // The original section retains its id and inner controls for scripts/backup.
  }
  function start(){
    fold('.essay-analytics-panel','申論能力成長統計');
    fold('.data-health-panel','學習紀錄健康檢查');
    fold('.backup-import-panel','學習紀錄 JSON 匯入／還原');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();