/* Read-only browser storage health; no writes or network requests. */
(function(root){
 'use strict';
 const KEY='probation-study30-v251:v1',MAX_REMINDER=2*1024*1024;
 function examine(raw){
  if(raw===null||raw===undefined||raw==='')return {ok:true,days:0,assessments:0,drafts:0,estimatedBytes:0,needsBackup:false,empty:true};
  let doc;try{doc=JSON.parse(raw);}catch{return {ok:false,error:'紀錄格式無法解析。請不要清除資料，先備份原始資料。'};}
  if(doc?.version!==1||!doc.sessions||typeof doc.sessions!=='object'||Array.isArray(doc.sessions))return {ok:false,error:'紀錄版本或資料結構異常，請保留資料。'};
  let days=0,assessments=0,drafts=0;
  for(const [day,session] of Object.entries(doc.sessions)){
   if(!/^\d{4}-\d\d-\d\d$/.test(day)||!session||typeof session!=='object')continue;
   days++;
   if(session.essayDrafts&&typeof session.essayDrafts==='object')drafts+=Object.keys(session.essayDrafts).length;
   if(session.essayAssessments&&typeof session.essayAssessments==='object')assessments+=Object.keys(session.essayAssessments).length;
  }
  // UTF-16 code units*2 is a conservative indication, not a browser quota reading.
  const estimatedBytes=raw.length*2;
  return {ok:true,days,assessments,drafts,estimatedBytes,needsBackup:estimatedBytes>=MAX_REMINDER,empty:false};
 }
 root.Study30DataHealth={examine,key:KEY};
 function render(){
  const el=document.getElementById('dataHealthSummary');if(!el)return;
  let report;
  try{report=examine(localStorage.getItem(KEY));}
  catch{report={ok:false,error:'目前無法讀取瀏覽器儲存空間。請確認沒有使用受限瀏覽模式。'};}
  if(!report.ok){el.dataset.risk='warning';el.textContent=report.error;return;}
  const units=(report.estimatedBytes/1024).toFixed(1);
  el.dataset.risk=report.needsBackup?'warning':'ok';
  el.textContent='已保存 '+report.days+' 天、申論草稿 '+report.drafts+' 筆、申論自評 '+report.assessments+
    ' 筆；估計資料量約 '+units+' KiB（以 UTF-16 保守估算，不代表實際儲存額度）。'+
    (report.needsBackup?' 紀錄已累積較多，請儘快匯出 JSON 備份。':
     ' 可使用本區的 JSON 匯入／還原。');
 }
 function init(){render();root.addEventListener('study30:render',render);root.addEventListener('study30:essay-assessed',render);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);