/* Manual local-to-Google-Drive workflow: JSON is never uploaded by this page. */
(function(){
 'use strict';
 const core=window.PSDUnifiedBackup;
 const $=id=>document.getElementById(id);
 let incoming=null,plan=null,clearPlan=null,clearBackupRequested=false;
 const stamp=()=>new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
 const tell=(msg,error=false)=>{const n=$('message');n.textContent=msg;n.dataset.error=error?'1':'0';};
 function download(data,name){
  const raw=JSON.stringify(data,null,2),blob=new Blob([raw],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3500);
 }
 function current(){return core.storageSnapshot(localStorage);}
 // Read-only presentation counts. Never strip or rewrite blank sessions from JSON.
 function meaningfulSession(s){
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  if(s.finished===true||Number(s.elapsed)>0||Number(s.skippedSeconds)>0||Number(s.phase)>0||
     (s.rating!==null&&s.rating!==undefined&&s.rating!=='')||
     (typeof s.errorCause==='string'&&s.errorCause.trim()))return true;
  if(Array.isArray(s.notes)&&s.notes.some(x=>typeof x==='string'&&x.trim()))return true;
  const drafts=s.essayDrafts;
  if(drafts&&typeof drafts==='object'){
   for(const draft of Object.values(drafts)){
    if(!draft||typeof draft!=='object')continue;
    if(typeof draft.fullAnswer==='string'&&draft.fullAnswer.trim())return true;
    if(Array.isArray(draft.outline)&&draft.outline.some(x=>typeof x==='string'&&x.trim()))return true;
   }
  }
  for(const key of ['essayCustomPrompts','aiReviewTexts']){
   const items=s[key];
   if(items&&typeof items==='object'&&Object.values(items).some(x=>typeof x==='string'&&x.trim()))return true;
  }
  if(s.essayAssessments&&typeof s.essayAssessments==='object'&&Object.values(s.essayAssessments).some(x=>x&&typeof x==='object'&&Object.keys(x).length))return true;
  return false;
 }
 // The list shows only current, non-empty learning activity. Legacy keys stay in the actual JSON backup.
 const visibleKeys=new Set([
  'probation-study30-v251:v1','probation-study-desk-v24','probation-study-desk-v3',
  'probation-daily-github:records:v1','daily-reading-test:saved',
  'psd-common-subjects-v1','psd-staresto-link-coach-v06',
  'jj-bookmarks','jj-read','psd-lecture-planner-v1'
 ]);
 function explain(storage){
  let progressCount=0;
  const rows=[];
  for(const m of core.modules){
   if(!visibleKeys.has(m.key))continue;
   const raw=storage[m.key];
   if(raw===undefined)continue;
   const val=core.parseValue(m.key,raw);
   let count=0,pending=0,status='';
   if(m.kind==='prompts'){
    count=val.entries.length;
    status=count+' 組自訂批改提示詞';
   }else if(m.kind==='sessions'){
    const sessions=Object.values(val.sessions).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
    count=sessions.filter(meaningfulSession).length;
    pending=sessions.length-count;
    status=count+' 筆已開始／有作答紀錄'+(pending?'；'+pending+' 筆尚未開始的工作階段':'');
   }else if(m.kind==='records'){
    count=Object.keys(val).length;
    status=count+' 筆已儲存紀錄';
   }else if(m.kind==='common'){
    const drafts=Object.keys(val.drafts||{}).length;
    const english=Object.keys(val.english||{}).length;
    count=drafts+english;
    status=drafts+' 筆作文草稿、'+english+' 項英文資料';
   }else if(m.kind==='english'){
    count=Object.keys(val.completed||{}).length+Object.keys(val.wordProgress||{}).length;
    status=count+' 項已儲存練習';
   }else if(m.kind==='lectures'){
    count=val.lessons.filter(x=>x.watchedMinutes>0).length;
    status=val.courses.length+' 門函授課程、'+val.lessons.length+' 堂（已有觀看進度 '+count+' 堂）';
   }else if(m.kind==='list'){
    count=val.length;
    status=count+' 筆收藏／閱讀紀錄';
   }
   if(count===0&&!(m.kind==='lectures'&&val.courses.length))continue;
   if(m.kind!=='prompts')progressCount+=count;
   rows.push({name:m.name,status});
  }
  $('modules').replaceChildren();
  for(const row of rows){
   const li=document.createElement('li');
   li.textContent=row.name+'：'+row.status;
   $('modules').append(li);
  }
  $('summary').textContent='已儲存的學習／閱讀紀錄：'+progressCount+' 筆／項。'+
   (!rows.length?' 目前沒有已開始的學習紀錄。':'')+
   ' 只顯示有實際學習內容或已建立的函授課程；完整 JSON 仍保留舊版資料、設定與尚未開始的工作階段。';
 }

 let studyRestoreBackupRequested=false,studyRestoreBackupSnapshot=null,studyConflictPage=0;
 function studyVersionPreview(row){
  if(!row)return '目前主要紀錄不存在';
  const data={date:row.date,questionId:row.questionId||'',elapsed:row.elapsed||0,
   finished:!!row.finished,notes:row.notes||[],rating:row.rating||null,
   essayDrafts:row.essayDrafts||{},practiceRatings:row.practiceRatings||{},
   essayVersions:row.essayVersions||{}};
  const txt=JSON.stringify(data,null,2);
  return txt.length>12000?txt.slice(0,12000)+'\\n…內容過長，請下載完整衝突版本 JSON 查閱。':txt;
 }
 function renderStudy30Conflicts(){
  const host=$('study30ConflictList');
  if(!host)return;
  host.replaceChildren();
  try{
   const records=core.listStudy30Conflicts(current());
   const pageSize=25,totalPages=Math.max(1,Math.ceil(records.length/pageSize));
   studyConflictPage=Math.max(0,Math.min(studyConflictPage,totalPages-1));
   $('study30ConflictSummary').textContent=records.length
    ?'找到 '+records.length+' 筆每日30分鐘不同版本｜第 '+(studyConflictPage+1)+'／'+totalPages+' 頁。'
    :'目前沒有每日30分鐘待比較的歷史衝突。';
   if(records.length>pageSize){
    const nav=document.createElement('div');nav.className='actions';
    for(const [step,label] of [[-1,'上一頁'],[1,'下一頁']]){
     const button=document.createElement('button');button.type='button';button.textContent=label;
     button.disabled=studyConflictPage+step<0||studyConflictPage+step>=totalPages;
     button.addEventListener('click',()=>{studyConflictPage+=step;renderStudy30Conflicts();});
     nav.append(button);
    }
    host.append(nav);
   }
   for(const row of records.slice(studyConflictPage*pageSize,(studyConflictPage+1)*pageSize)){
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=row.date+'｜'+(row.incoming.questionId||row.existing.questionId||'自主練習')+
     '｜衝突紀錄 #'+(row.index+1);
    details.append(summary);
    const grid=document.createElement('div');grid.className='versions';
    for(const [title,record] of [['目前主要紀錄',row.main],['紀錄原版本',row.existing],['備份匯入版本',row.incoming]]){
     const box=document.createElement('div'),heading=document.createElement('strong'),pre=document.createElement('pre');
     heading.textContent=title;pre.textContent=studyVersionPreview(record);box.append(heading,pre);grid.append(box);
    }
    details.append(grid);
    for(const [side,label] of [['existing','將原版本設為主要紀錄'],['incoming','將匯入版本設為主要紀錄']]){
     const button=document.createElement('button');button.type='button';button.textContent=label;
     button.className='restoreStudy30';button.disabled=!studyRestoreBackupRequested||!$('study30ConflictConfirmed').checked;
     button.addEventListener('click',()=>restoreStudy30(row.index,side));
     details.append(button);
    }
    host.append(details);
   }
  }catch(e){$('study30ConflictSummary').textContent='無法檢查衝突版本：'+e.message;}
 }
 function restoreStudy30(index,side){
  if(!studyRestoreBackupRequested||!$('study30ConflictConfirmed').checked){
   tell('請先下載完整保護備份，確認檔案確實保存、並關閉其他編輯分頁。',true);return;
  }
  try{
   const now=current();
   const keys=new Set([...Object.keys(now),...Object.keys(studyRestoreBackupSnapshot||{})]);
   if(!studyRestoreBackupSnapshot||[...keys].some(k=>now[k]!==studyRestoreBackupSnapshot[k]))
    throw Error('下載保護備份後，另一分頁或此頁有更新；請重新下載最新保護備份。');
   const plan=core.planStudy30ConflictRestore(now,index,side);
   if(!plan.changed){tell('所選版本已經是主要紀錄，無需復原。');return;}
   if(!window.confirm('確認將 '+plan.date+' 的選定版本設為主要紀錄？原本主要版本會保留在衝突歷史；請確認備份檔已存在。'))return;
   core.apply(localStorage,plan);
   studyRestoreBackupRequested=false;studyRestoreBackupSnapshot=null;$('study30ConflictConfirmed').checked=false;
   refresh();tell('已復原 '+plan.date+' 的選定版本；原主要版本保留在衝突紀錄。請重新整理練習頁後確認。');
  }catch(e){tell('復原未完成：'+e.message,true);}
 }

 function updateClearReady(){
  $('clearLearning').disabled=!clearPlan||!clearPlan.items.length||!clearBackupRequested||
   !$('clearBackupConfirmed').checked||!$('clearTabsConfirmed').checked||
   $('clearTyped').value.trim()!=='清除';
 }
 function refreshClear(){
  clearBackupRequested=false;
  $('clearBackupConfirmed').checked=false;
  $('clearTabsConfirmed').checked=false;
  $('clearTyped').value='';
  try{
   clearPlan=core.previewClear(localStorage);
   $('clearSummary').textContent=clearPlan.items.length
    ?'本裝置目前有 '+clearPlan.items.length+' 個可清除的學習紀錄區（可能包含空白初始化資料）。'
    :'本裝置目前沒有需要清除的學習紀錄。';
   $('clearBackupBefore').disabled=!clearPlan.items.length;
  }catch(e){
   clearPlan=null;
   $('clearSummary').textContent='無法檢查可清除項目：'+e.message;
   $('clearBackupBefore').disabled=true;
   tell('請先檢查或另行備份無法辨識的學習資料；已阻止清除。',true);
  }
  updateClearReady();
 }
 // localStorage (~5 MB, counted in UTF-16) is shared by every page on this origin, including the dual-AI workbench.
 const STORAGE_LIMIT=5*1024*1024;
 function showUsage(){
  const box=$('storageUsage');
  try{
   const items=[];let total=0;
   for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),size=(k.length+(localStorage.getItem(k)||'').length)*2;total+=size;items.push([k,size]);}
   const mb=n=>(n/1048576).toFixed(n<104858?2:1)+' MB',share=Math.round(total/STORAGE_LIMIT*100);
   const top=items.sort((a,b)=>b[1]-a[1]).slice(0,3).filter(([,size])=>size>51200).map(([k,size])=>k+'（'+mb(size)+'）');
   box.textContent='本機儲存空間（與本網址其他頁面及雙 AI 工作臺共用，上限約 5 MB）：已用約 '+mb(total)+'，約 '+share+'%。'+(top.length?'占用最多：'+top.join('、')+'。':'')+(share>=80?' 空間快滿了，作答可能存不進去；請先下載備份，再清除不需要的紀錄。':'');
   box.dataset.error=share>=80?'true':'false';
  }catch{box.textContent='無法讀取本機儲存空間用量。';}
 }
 function refresh(){
  showUsage();
  try{explain(current());$('export').disabled=false;}
  catch(e){tell('無法讀取現有紀錄：'+e.message,true);$('export').disabled=true;}
  refreshClear();renderStudy30Conflicts();
 }
 function clearPreview(){incoming=null;plan=null;$('preview').hidden=true;$('restore').disabled=true;$('confirmSafe').checked=false;$('confirmTabs').checked=false;$('importFile').value='';$('importFileName').textContent='尚未選取檔案';}
 $('export').addEventListener('click',()=>{
  try{const data=core.collect(localStorage,location.origin);
   download(data,'觀護人學習平台-完整紀錄-'+stamp()+'.json');
   tell('已要求下載完整 JSON。請確認檔案確實存在，再自行上傳到私人 Google Drive。');
  }catch(e){tell('備份下載失敗：'+e.message,true)}
 });
 $('importFile').addEventListener('change',async function(){
  incoming=null;plan=null;$('preview').hidden=true;$('restore').disabled=true;
  $('confirmSafe').checked=false;$('confirmTabs').checked=false;
  const file=this.files&&this.files[0];
  $('importFileName').textContent=file?'已選擇：'+file.name:'尚未選取檔案';
  if(!file)return;
  if(file.size>20*1024*1024){tell('檔案超過20MB，沒有改動任何學習紀錄。',true);return;}
  try{
   const text=await file.text();
   incoming=core.validate(JSON.parse(text));
   plan=core.plan(current(),incoming);
   $('source').textContent='備份來源：'+(incoming.sourceOrigin||'未知')+'。建立時間：'+incoming.exportedAt;
   $('previewTable').replaceChildren();
   for(const row of plan.stats){
    const tr=document.createElement('tr');
    for(const val of [row.name,row.status==='not-in-backup'?'備份未含':row.status==='new'?'新增模組':row.status==='merge'?'合併':'無變更',row.added,row.conflicts]){
     const td=document.createElement('td');td.textContent=String(val);tr.append(td);
    }
    $('previewTable').append(tr);
   }
   $('conflicts').textContent=plan.conflicts.length
    ?'本次發現 '+plan.conflicts.length+' 筆需人工確認的差異：安全合併會補齊空白內容、承接已確認的新版；無法確認的不同答案保存於「衝突版本」，請下載比對。'
    :'沒有發現不同版本衝突。';
   $('preview').hidden=false;
   $('restore').disabled=false;
   tell('檔案驗證完成，目前只是預覽，尚未寫入任何資料。');
  }catch(e){incoming=null;plan=null;tell('檔案未通過檢查，沒有改動任何紀錄：'+e.message,true)}
 });
 $('backupBefore').addEventListener('click',()=>{
  try{download(core.collect(localStorage,location.origin),'觀護人學習平台-匯入前保護備份-'+stamp()+'.json');
   tell('已要求下載匯入前保護備份。請先確認檔案已保存到裝置。');
  }catch(e){tell('無法備份目前紀錄，已阻止匯入：'+e.message,true)}
 });
 $('restore').addEventListener('click',()=>{
  if(!incoming||!plan)return;
  if(!$('confirmSafe').checked||!$('confirmTabs').checked){tell('請先下載並確認保存匯入前備份，並關閉其他正在作答的分頁。',true);return;}
  if(!window.confirm('最後確認：匯入時新增資料，遇不同內容保留本機原始版本，其他版本存入衝突清單。確定繼續？'))return;
  try{
   // Always rebuild and validate to stop stale previews and cross-tab edits.
   const now=current();
   for(const k of new Set([...Object.keys(now),...Object.keys(plan.baseline)]))
    if(now[k]!==plan.baseline[k])throw Error('資料在預覽後已有更動，請重新選擇檔案並重新預覽。');
   const count=core.apply(localStorage,plan);
   tell('完成匯入，已更新 '+count+' 個紀錄區。請重新開啟學習頁檢查歷史資料。');
   clearPreview();refresh();
  }catch(e){tell('已停止匯入：'+e.message,true);}
 });
 $('study30ConflictBackup').addEventListener('click',()=>{
  try{
   const backup=core.collect(localStorage,location.origin);
   download(backup,'觀護人學習平台-版本復原前備份-'+stamp()+'.json');
   studyRestoreBackupSnapshot=backup.data;studyRestoreBackupRequested=true;
   renderStudy30Conflicts();
   tell('已要求下載保護備份。請確認檔案已保存，才能選擇復原版本。');
  }catch(e){studyRestoreBackupRequested=false;studyRestoreBackupSnapshot=null;tell('無法下載保護備份，已阻止復原：'+e.message,true);}
 });
 $('study30ConflictConfirmed').addEventListener('change',renderStudy30Conflicts);
 $('downloadConflicts').addEventListener('click',()=>{
  try{
   const raw=localStorage.getItem(core.CONFLICT_KEY);
   if(!raw){tell('目前沒有需要另存的衝突版本。');return;}
   const data=core.parseValue(core.CONFLICT_KEY,raw);
   download(data,'觀護人學習平台-衝突版本-'+stamp()+'.json');
   tell('已要求下載衝突版本檔。此檔包含另一份答案，請妥善保存。');
  }catch(e){tell('無法匯出衝突版本：'+e.message,true)}
 });
 $('clearBackupBefore').addEventListener('click',()=>{
  if(!clearPlan||!clearPlan.items.length)return;
  try{
   download(core.collect(localStorage,location.origin),'觀護人學習平台-清除前完整備份-'+stamp()+'.json');
   clearBackupRequested=true;
   updateClearReady();
   tell('已要求下載清除前備份。請在裝置的下載檔案中確認保存，再勾選確認框。');
  }catch(e){clearBackupRequested=false;updateClearReady();tell('無法匯出清除前備份，已阻止清除：'+e.message,true);}
 });
 for(const id of ['clearBackupConfirmed','clearTabsConfirmed','clearTyped']){
  $(id).addEventListener(id==='clearTyped'?'input':'change',updateClearReady);
 }
 $('clearLearning').addEventListener('click',()=>{
  if($('clearLearning').disabled||!clearPlan||!clearBackupRequested)return;
  if(!window.confirm('確定清除目前網址、這台裝置的學習與閱讀紀錄？操作後不能直接復原；請確認備份檔已保存。'))return;
  try{
   const count=core.applyClear(localStorage,clearPlan);
   clearPreview();
   refresh();
   tell('已清除 '+count+' 個本機學習紀錄區。設定及保留的課程資料不受影響；如需還原請使用清除前備份。');
  }catch(e){refreshClear();tell('已停止清除：'+e.message,true);}
 });
 $('refresh').addEventListener('click',refresh);
 refresh();
})();
