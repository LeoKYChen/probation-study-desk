(function(root){
 'use strict';
 const keys=['probation-study-desk-v24','probation-daily-github:records:v1','probation-study-desk-v3','probation-study-desk-v2','probation-v25:before-sync'];
 const signal='probation-v25:records-cleared';
 function clear(storage){
  const before=keys.map(key=>storage.getItem(key));
  try{
   for(const key of keys)if(key==='probation-v25:before-sync')storage.removeItem(key);else storage.setItem(key,'{}');
   storage.setItem(signal,new Date().toISOString());
  }catch(error){
   keys.forEach((key,i)=>{try{if(before[i]===null)storage.removeItem(key);else storage.setItem(key,before[i]);}catch{}});
   throw error;
  }
 }
 root.ClearRecords25={clear};
 if(typeof document==='undefined')return;
 const button=document.getElementById('clearAllRecords');
 if(!button)return;
 button.addEventListener('click',()=>{
  if(!confirm('確定清除全部練習紀錄？\n\n此操作會清除本瀏覽器中「練習臺」與「每日模擬題」的所有答案、評分、覆核、待複習標記、替代稿及匯入前暫存備份。\n\n題庫保留。若要保留紀錄，請先取消並匯出備份。'))return;
  try{root.Practice25?.flush();clear(localStorage);root.location.reload();}
  catch(error){alert('清除失敗：'+error.message+'。請先匯出備份；頁面將重新讀取現有紀錄。');root.location.reload();}
 });
 root.addEventListener('storage',event=>{if(event.key===signal&&event.newValue)root.location.reload();});
})(typeof window!=='undefined'?window:globalThis);
