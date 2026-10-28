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
  if(input.format==='psd-unified-learning-backup'){
   const core=root.PSDUnifiedBackup;
   if(!core)throw Error('共用備份模組未載入');
   core.validate(input);
   if(typeof input.data[KEY]!=='string')throw Error('完整備份中沒有每日30分鐘紀錄');
   return safeStore(JSON.parse(input.data[KEY]));
  }
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
 function merge(existing,imported,mode,archiveRaw){
  if(mode!=='merge')throw Error('為避免刪除舊紀錄，本版本僅提供安全合併。');
  const a=safeStore(existing),b=safeStore(imported),core=root.PSDUnifiedBackup;
  if(!core||typeof core.plan!=='function')throw Error('缺少共用合併模組；已停止匯入');
  const baseline={};
  baseline[KEY]=JSON.stringify(a);
  if(typeof archiveRaw==='string')baseline[core.CONFLICT_KEY]=archiveRaw;
  const data={};data[KEY]=JSON.stringify(b);
  const envelope={format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),
   sourceOrigin:location.origin,data};
  const plan=core.plan(baseline,envelope);
  const result=safeStore(JSON.parse(plan.changes[KEY]||baseline[KEY]));
  const added=Object.keys(result.sessions).length-Object.keys(a.sessions).length;
  return {result,added,conflicts:plan.conflicts.length,plan,mode};
 }
 root.Study30BackupImport={KEY,parse,safeStore,merge,count,maxBytes:MAX};
})(window);

(function(){
 'use strict';
 const $=id=>document.getElementById(id),api=window.Study30BackupImport,core=window.PSDUnifiedBackup;
 let imported=null,previewPlan=null;
 const status=message=>{$('importStatus').textContent=message;};
 const readCurrent=()=>api.safeStore(JSON.parse(localStorage.getItem(api.KEY)||'{"version":1,"sessions":{}}'));
 const snapshot=()=>core.storageSnapshot(localStorage);
 function planImport(){
  const previous=snapshot(),data={};
  data[api.KEY]=JSON.stringify(imported);
  return core.plan(previous,{format:core.FORMAT,schemaVersion:core.SCHEMA,
   exportedAt:new Date().toISOString(),sourceOrigin:location.origin,data});
 }
 function ready(){
  $('importExecute').disabled=!imported||!previewPlan||!$('importBackupConfirmed').checked;
 }
 function preview(){
  if(!imported)return;
  try{
   const before=readCurrent();
   previewPlan=planImport();
   const after=JSON.parse(previewPlan.changes[api.KEY]||JSON.stringify(before));
   const a=api.count(imported),b=api.count(before);
   const newDays=Object.keys(after.sessions).length-Object.keys(before.sessions).length;
   const changedDays=Object.keys(after.sessions).filter(day=>before.sessions[day]&&
     JSON.stringify(after.sessions[day])!==JSON.stringify(before.sessions[day])).length;
   $('importPreview').textContent='來源：'+a.days+'天／草稿'+a.drafts+'筆／自評'+a.assessments+
    '筆；本機：'+b.days+'天。預計新增'+newDays+'天、補充更新'+changedDays+
    '天，新增需人工確認的衝突'+previewPlan.conflicts.length+'筆。相同內容不會重複累計時間。';
   status('預覽完成，尚未寫入資料。請先下載保護備份。');
  }catch(e){previewPlan=null;status('無法安全預覽：'+e.message);}
  ready();
 }
 function downloadCurrent(){
  try{
   const data=core.collect(localStorage,location.origin);
   const raw=JSON.stringify(data,null,2),blob=new Blob([raw],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='study30-import-protection-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
   status('已要求下載整站保護備份；請確認檔案確實存在，再勾選確認。');
  }catch(e){status('保護備份失敗，請勿匯入：'+e.message);}
 }
 async function onFile(file){
  imported=null;previewPlan=null;$('importBackupConfirmed').checked=false;ready();
  if(!file){status('尚未選擇JSON檔案');return;}
  if(file.size>20*1024*1024){status('JSON檔案超過20 MB，已拒絕匯入');return;}
  try{imported=api.parse(await file.text());preview();}
  catch(e){status('無法匯入：'+e.message);}
 }
 function execute(){
  if(!imported||!previewPlan||!$('importBackupConfirmed').checked)return;
  if(!window.confirm('確認已下載本機完整保護備份、關閉其他編輯分頁？系統會合併資料並保留不同答案的衝突版本。'))return;
  try{
   window.Study30App?.prepareBackupRestore?.();
   const written=core.apply(localStorage,previewPlan);
   status('安全合併完成，更新'+written+'個資料區，即將重新載入。');
   location.reload();
  }catch(e){status('匯入停止，原始備份請保留：'+e.message);}
 }
 function init(){
  if(!$('importBackupFile'))return;
  $('importBackupFile').addEventListener('change',e=>onFile(e.target.files?.[0]));
  $('downloadBeforeImport').addEventListener('click',downloadCurrent);
  $('importBackupConfirmed').addEventListener('change',ready);
  $('importExecute').addEventListener('click',execute);
  ready();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
