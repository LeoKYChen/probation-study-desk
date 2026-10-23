/* Manual local-to-Google-Drive workflow: JSON is never uploaded by this page. */
(function(){
 'use strict';
 const core=window.PSDUnifiedBackup;
 const $=id=>document.getElementById(id);
 let incoming=null,plan=null;
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
  'psd-ai-custom-rules-v1','probation-study30-v251:v1','probation-study-desk-v24',
  'probation-daily-github:records:v1','daily-reading-test:saved',
  'psd-common-subjects-v1','psd-staresto-link-coach-v06',
  'jj-bookmarks','jj-read','psd-lecture-planner-v1'
 ]);
 function explain(storage){
  let progressCount=0,pendingCount=0;
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
    count=val.lessons.length;
    status=val.courses.length+' 門函授課程、'+count+' 堂（已完成 '+val.lessons.filter(x=>x.watchedMinutes===x.durationMinutes).length+' 堂）';
   }else if(m.kind==='list'){
    count=val.length;
    status=count+' 筆收藏／閱讀紀錄';
   }
   if(count===0&&pending===0)continue;
   if(m.kind!=='prompts')progressCount+=count;
   pendingCount+=pending;
   rows.push({name:m.name,status});
  }
  $('modules').replaceChildren();
  for(const row of rows){
   const li=document.createElement('li');
   li.textContent=row.name+'：'+row.status;
   $('modules').append(li);
  }
  $('summary').textContent='已儲存的學習／閱讀紀錄：'+progressCount+' 筆／項。'+
   (pendingCount?' 另有尚未開始的工作階段：'+pendingCount+' 筆。':'')+
   (!rows.length?'目前沒有已開始的學習紀錄。':'')+
   ' 下方只列出有內容的現行學習模組；完整 JSON 仍保留可識別的舊版資料、設定與空白工作階段，避免意外遺失。';
 }
 function refresh(){try{explain(current());$('export').disabled=false;}catch(e){tell('無法讀取現有紀錄：'+e.message,true);$('export').disabled=true;}}
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
    ?'本次發現 '+plan.conflicts.length+' 筆不同版本：以這台裝置原紀錄為主，備份中的不同內容會保留在「衝突版本」中，供日後另行檢視／下載。'
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
 $('downloadConflicts').addEventListener('click',()=>{
  try{
   const raw=localStorage.getItem(core.CONFLICT_KEY);
   if(!raw){tell('目前沒有需要另存的衝突版本。');return;}
   const data=core.parseValue(core.CONFLICT_KEY,raw);
   download(data,'觀護人學習平台-衝突版本-'+stamp()+'.json');
   tell('已要求下載衝突版本檔。此檔包含另一份答案，請妥善保存。');
  }catch(e){tell('無法匯出衝突版本：'+e.message,true)}
 });
 $('refresh').addEventListener('click',refresh);
 refresh();
})();
