/* Content-collapse only: wrap the SAME live panels; preserve controls and listeners. */
(function(){
  'use strict';
  function fold(selector,title){
    const panel=document.querySelector(selector);
    if(!panel||panel.parentElement?.classList.contains('content-collapse-body'))return;
    const wrapper=document.createElement('details');
    wrapper.className='content-collapse';
    const summary=document.createElement('summary');
    const eyebrow=panel.querySelector('.section-head .eyebrow');
    if(eyebrow){
      const titles=document.createElement('span');titles.className='collapse-titles';
      const english=document.createElement('span');english.className='eyebrow';english.textContent=eyebrow.textContent;
      const chinese=document.createElement('span');chinese.className='collapse-title';chinese.textContent=title;
      titles.append(english,chinese);summary.append(titles);eyebrow.hidden=true;
    }else summary.textContent=title;
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
    const health=document.querySelector('.data-health-panel'),backup=document.querySelector('.backup-import-panel');
    if(health&&backup)backup.querySelector('h2').after(health);
    fold('.v254-panel','七科學習診斷與弱點追蹤');
    fold('.backup-import-panel','學習紀錄 JSON 匯入／還原');
    const backupPanel=backup?.closest('.content-collapse'),progress=document.querySelector('.history');
    if(backupPanel&&progress)progress.after(backupPanel);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
/* New presentation URL keeps existing analytics compatible with installed old scripts. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 function renderDiagnostics(){
  if(!$('v254Radar')||!window.Study30App?.getEssayReviewData||!window.Study30V254Diagnostics||!window.Study30LearningCharts)return;
  const {sessions,bank,today}=Study30App.getEssayReviewData(),days=$('v254Days').value,chosen=$('v254Subject').value;
  const essays=Study30EssayAnalytics.collect(sessions,bank,today),reviews=Study30Review.model(sessions,bank,today).all;
  const data=Study30V254Diagnostics.analyze(sessions,bank,essays,reviews,today,days);
    const charts=window.Study30LearningCharts;
    const selectSubject=subject=>{$('v254Subject').value=subject;$('v254Subject').dispatchEvent(new Event('change'));};
    charts.radar($('v254Radar'),data.subjects.map(x=>({label:x.subject,value:x.essayAverage})),{
      title:'七科申論自評平均',onSelect:selectSubject,selected:chosen});
    const detail=$('v254SubjectDetail');detail.hidden=chosen==='all';
    if(chosen!=='all'){
      const row=data.subjects.find(x=>x.subject===chosen);
      $('v254DetailHeading').textContent=chosen+'｜申論能力指標';
      $('v254DetailSummary').textContent='申論自評 '+row.essayAttempts+' 筆｜每日練習 '+row.dailyAttempts+' 次｜待補強 '+row.needsWork+' 題｜到期 '+row.due+' 題';
      charts.radar($('v254AbilityRadar'),charts.subjectAxes(chosen,essays,today,days),{title:chosen+'各項申論自評達成率'});
    }

 }
 function renderEssay(){
  if(!$('essayAbilityRadar')||!window.Study30App?.getEssayReviewData||!window.Study30EssayAnalytics||!window.Study30LearningCharts)return;
  const {sessions,bank,today}=Study30App.getEssayReviewData(),days=$('essayAnalyticsDays').value,subject=$('essayAnalyticsSubject').value;
  const rows=Study30EssayAnalytics.collect(sessions,bank,today),data=Study30EssayAnalytics.summarize(rows,today,days,subject);
  const charts=window.Study30LearningCharts;
  if(subject==='all'){
   charts.radar($('essayAbilityRadar'),data.perSubject.map(x=>({label:x.subject,value:x.average})),{
    title:'七科申論自評平均',onSelect:name=>{$('essayAnalyticsSubject').value=name;$('essayAnalyticsSubject').dispatchEvent(new Event('change'));}});
  }else charts.radar($('essayAbilityRadar'),charts.subjectAxes(subject,rows,today,days),{title:subject+'各項申論自評達成率'});

 }
 function render(){
  renderDiagnostics();renderEssay();
  const summary=$('questionSourceSummary');if(summary?.dataset.complete==='true')summary.textContent='選題來源：專業科目練習題庫；完整考古題請至練習臺。';
  const health=$('dataHealthSummary');if(health)health.textContent=health.textContent.replace('建議定期備份；目前仍需最後階段才能匯入還原。','可使用本區的 JSON 匯入／還原。');
 }
 function start(){
  for(const id of ['v254Days','v254Subject','essayAnalyticsDays','essayAnalyticsSubject'])$(id)?.addEventListener('change',render);
  window.addEventListener('study30:render',render);window.addEventListener('study30:essay-assessed',render);render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
