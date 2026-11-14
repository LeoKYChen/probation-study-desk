/* v2.5.3 final stage: safe, local-only JSON backup import.
   No network, no cross-app storage keys. Never auto-import without user confirmation. */
(function(root){
 'use strict';
 const KEY='probation-study30-v251:v1',MAX=8*1024*1024,MAX_DAYS=2500;
 const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(Date.parse(s+'T00:00:00Z')).toISOString().slice(0,10)===s;
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const keys=o=>Object.keys(o||{});
 const safeStore=(input)=>{
  if(!obj(input)||input.version!==1||!obj(input.sessions))throw Error('備份版本或 sessions 結構不符，沒有寫入任何資料。');
  const days=keys(input.sessions);
  if(days.length>MAX_DAYS)throw Error('備份日期數異常，為安全起見不匯入。');
  const out={...input,sessions:{}};
  for(const d of days){
   if(!isDate(d))throw Error('發現無效日期 '+String(d).slice(0,20)+'，已拒絕匯入。');
   const s=input.sessions[d];
   if(!obj(s)||('notes'in s&&!Array.isArray(s.notes))||('essayDrafts'in s&&!obj(s.essayDrafts))||
     ('essayAssessments'in s&&!obj(s.essayAssessments))||
     ('essayCustomPrompts'in s&&!obj(s.essayCustomPrompts)))throw Error('日期 '+d+' 的紀錄格式異常。');
   if(s.date&&s.date!==d)throw Error('日期 '+d+' 的內容日期與索引不同。');
   // Fill fields needed by older versions, keeping all original essay/review metadata.
   const mode=['10','30'].includes(String(s.mode))?String(s.mode):'30';
   const phase=Number.isInteger(s.phase)&&s.phase>=0&&s.phase<=4?s.phase:0;
   const elapsed=Number.isFinite(s.elapsed)&&s.elapsed>=0?s.elapsed:0;
   const remaining=Number.isFinite(s.remaining)&&s.remaining>=0?s.remaining:0;
   out.sessions[d]={...s,date:d,mode,phase,elapsed,remaining,notes:Array.isArray(s.notes)?s.notes.slice():[],
    rating:['review','partial','mastered'].includes(s.rating)?s.rating:null,
    finished:!!s.finished};
  }
  return out;
 };
 function parse(text){
  if(typeof text!=='string'||text.length>MAX)throw Error('JSON備份超過8 MB或格式無效。');
  let input;
  try{input=JSON.parse(text);}catch{throw Error('檔案不是有效JSON；請選擇本模組匯出的JSON備份。');}
  if(!obj(input))throw Error('JSON最外層格式不正確。');
  // v2.5.1–v2.5.3 historical exports use data envelope; also accept raw v1 store.
  if('data'in input){
   if(typeof input.format!=='string'||!/^probation-study30-v25[1-3]/.test(input.format))
     throw Error('這不是每日30分鐘模組的備份檔。');
   return safeStore(input.data);
  }
  return safeStore(input);
 }
 const count=store=>{let drafts=0,assessments=0;for(const s of Object.values(store.sessions)){
  drafts+=keys(s.essayDrafts).length;assessments+=keys(s.essayAssessments).length;
 }return {days:keys(store.sessions).length,drafts,assessments};};
 function merge(existing,imported,mode){
  const a=safeStore(existing),b=safeStore(imported);
  if(mode==='replace')return {result:b,added:keys(b.sessions).length,skipped:0,mode};
  if(mode!=='merge')throw Error('請選擇合併或完整還原。');
  const result={...a,sessions:{...a.sessions}},stats={result,added:0,skipped:0,mode};
  for(const [day,session] of Object.entries(b.sessions)){
   if(Object.prototype.hasOwnProperty.call(result.sessions,day))stats.skipped++;
   else{result.sessions[day]=session;stats.added++;}
  }
  return stats;
 }
 root.Study30BackupImport={KEY,parse,safeStore,merge,count,maxBytes:MAX};
})(window);

(function(){
 'use strict';
 const $=id=>document.getElementById(id),api=window.Study30BackupImport;
 let fileText='',imported=null;
 const readCurrent=()=>api.safeStore(JSON.parse(localStorage.getItem(api.KEY)||'{"version":1,"sessions":{}}'));
 const status=message=>{$('importStatus').textContent=message;};
 const buttonState=()=>{const mode=document.querySelector('input[name="importMode"]:checked')?.value;
  $('importExecute').disabled=!imported||!$('importBackupConfirmed').checked||(mode==='replace'&&$('importConfirm').value.trim()!=='完整還原');
 };
 function preview(){
  if(!imported)return;
  try{const existing=readCurrent(),mode=document.querySelector('input[name="importMode"]:checked')?.value||'merge',plan=api.merge(existing,imported,mode);
   const ic=api.count(imported),cc=api.count(existing);
   $('importPreview').textContent='備份：'+ic.days+' 天／草稿 '+ic.drafts+' 筆／自評 '+ic.assessments+
    ' 筆。目前瀏覽器：'+cc.days+' 天。'+
    (mode==='merge'?'預計新增 '+plan.added+' 天；跳過 '+plan.skipped+' 個已存在日期（既有資料優先）。':
     '完整還原將以備份中的 '+ic.days+' 天取代目前所有日期；未包含於備份的日期會被移除。');
   status('檔案已驗證。請先備份目前的紀錄，再確認執行。');
  }catch(error){imported=null;status(error.message);}
  buttonState();
 }
 function downloadCurrent(){
  try{
   const existing=readCurrent();
   const content=JSON.stringify({format:'probation-study30-v253',version:1,exportedAt:new Date().toISOString(),data:existing},null,2);
   const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='study30-before-import-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
   status('已要求瀏覽器下載目前紀錄。請確認檔案確實存在，再勾選「已下載備份」。');
  }catch(error){status('目前紀錄無法讀取或匯出，已停止匯入：'+error.message);}
 }
 async function onFile(file){
  imported=null;fileText='';$('importBackupConfirmed').checked=false;$('importConfirm').value='';buttonState();
  if(!file){status('尚未選擇JSON檔案。');return;}
  if(file.size>api.maxBytes){status('檔案超過8 MB，已拒絕匯入。');return;}
  try{fileText=await file.text();imported=api.parse(fileText);preview();}
  catch(e){status('無法匯入：'+e.message);}
 }
 function execute(){
  if(!imported||!$('importBackupConfirmed').checked)return;
  const mode=document.querySelector('input[name="importMode"]:checked')?.value;
  if(mode==='replace'&&$('importConfirm').value.trim()!=='完整還原')return;
  if(!window.confirm(mode==='replace'?
    '最後確認：完整還原會取代此瀏覽器每日30分鐘模組的所有現有紀錄，確定已另外保存備份？':
    '最後確認：將新增備份中尚未存在的日期，遇到相同日期時保留目前資料，確定執行？'))return;
  try{
   // Pause first: otherwise pagehide would overwrite the just-restored data.
   if(window.Study30App?.prepareBackupRestore)window.Study30App.prepareBackupRestore();
   const current=readCurrent(),plan=api.merge(current,imported,mode);
   const json=JSON.stringify(plan.result);
   localStorage.setItem(api.KEY,json); // Single synchronous atomic write to the namespaced key.
   if(localStorage.getItem(api.KEY)!==json)throw Error('儲存驗證失敗');
   status('匯入成功，正在重新載入以顯示更新後的紀錄。');
   window.location.reload();
  }catch(error){status('匯入失敗，請保留備份：'+error.message);}
 }
 function init(){
  if(!$('importBackupFile'))return;
  $('importBackupFile').addEventListener('change',e=>onFile(e.target.files?.[0]));
  document.querySelectorAll('input[name="importMode"]').forEach(x=>x.addEventListener('change',preview));
  $('downloadBeforeImport').addEventListener('click',downloadCurrent);
  $('importBackupConfirmed').addEventListener('change',buttonState);
  $('importConfirm').addEventListener('input',buttonState);
  $('importExecute').addEventListener('click',execute);
  buttonState();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
