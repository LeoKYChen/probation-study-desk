/* Explicit same-day essay snapshots; no new storage key. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 function render(){
  const list=$('essayVersionList'),app=window.Study30App;
  if(!list||!app?.getEssayVersions)return;
  list.replaceChildren();
  const versions=app.getEssayVersions();
  $('essayVersionCount').textContent=versions.length+' 個獨立保存版本';
  if(!versions.length){list.textContent='尚未儲存歷史版本；目前草稿仍會自動保存。';return;}
  for(const record of versions){
   const details=document.createElement('details'),sum=document.createElement('summary'),pre=document.createElement('pre'),
    button=document.createElement('button');
   sum.textContent=new Date(record.savedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'｜'+record.questionId;
   pre.textContent=[...(record.draft.outline||[]),record.draft.fullAnswer||''].filter(x=>typeof x==='string'&&x.trim()).join('\n\n');
   pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto';
   button.type='button';button.className='secondary';button.textContent='將此版本恢復為目前草稿';
   button.addEventListener('click',async()=>{
    if(!window.confirm('恢復此歷史版本？系統會先保存目前有內容的草稿為另一筆歷史版本。'))return;
    let ok=app.restoreEssayVersion(record.id);
    if(ok&&window.PSD_STUDY30_IDB_TEST===true){try{await app.whenSaved();}catch{ok=false;}}
    $('essayVersionStatus').textContent=ok?'已恢復此版本，原草稿仍可從歷史版本找回。':'無法恢復；請先確認本機儲存空間、同時編輯分頁及草稿狀態。';
   });
   details.append(sum,pre,button);list.append(details);
  }
 }
 function start(){
  if(!$('saveEssayVersion'))return;
  $('saveEssayVersion').addEventListener('click',async()=>{
   let success=window.Study30App?.saveEssayVersion?.();
   if(success&&window.PSD_STUDY30_IDB_TEST===true){try{await window.Study30App.whenSaved();}catch{success=false;}}
   $('essayVersionStatus').textContent=success?'已建立本次申論的獨立版本；可繼續修改或練習其他題目。':
    '無法保存空白草稿或版本數已達上限；請檢查本機儲存狀態。';
   render();
  });
  window.addEventListener('study30:render',render);
  window.addEventListener('study30:essay-version',render);
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
