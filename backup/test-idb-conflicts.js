/* Test-mode-only conflict recovery using the existing backup page controls.
   Full backup, Google Drive and other module restores remain disabled. */
(function(){
 'use strict';
 if(window.PSD_STUDY30_IDB_TEST!==true)return;
 const $=id=>document.getElementById(id),core=window.PSDUnifiedBackup;
 let mixed,baseline=null,busy=false,page=0;
 const tell=(message,error=false)=>{const el=$('message');el.textContent=message;el.dataset.error=error?'1':'0';};
 function equalSnapshot(a,b){const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);return [...keys].every(k=>a?.[k]===b?.[k]);}
 function preview(value){
  if(!value)return '目前主要紀錄不存在';
  const text=JSON.stringify(value,null,2);
  return text.length>12000?text.slice(0,12000)+'\n…內容過長，請下載保護備份查閱。':text;
 }
 function buttons(){
  for(const button of document.querySelectorAll('#study30ConflictList button.restoreStudy30'))button.disabled=busy||!baseline||!$('study30ConflictConfirmed').checked;
 }
 async function restore(index,side){
  if(busy||!baseline||!$('study30ConflictConfirmed').checked)return;
  if(!confirm('確認恢復此版本？目前主要紀錄會保留為另一個衝突版本。'))return;
  busy=true;buttons();
  try{
   const now=await mixed.snapshot();
   if(!equalSnapshot(now,baseline))throw Error('下載保護備份後資料已變更，請重新下載並確認');
   const plan=core.planStudy30ConflictRestore(now,index,side,window.crypto?.randomUUID?.());
   await mixed.apply(plan);
   baseline=null;$('study30ConflictConfirmed').checked=false;
   tell('已恢復選擇的版本；原主要版本保留於衝突紀錄。');
   await render();
  }catch(e){tell('恢復未完成：'+e.message+'。請保留保護備份。',true);}
  finally{busy=false;buttons();}
 }
 async function render(){
  const host=$('study30ConflictList');host.replaceChildren();
  try{
   const rows=core.listStudy30Conflicts(await mixed.snapshot());
   const pageSize=25,totalPages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.max(0,Math.min(page,totalPages-1));
   $('study30ConflictSummary').textContent=rows.length?'找到 '+rows.length+' 筆每日30分鐘不同版本｜第 '+(page+1)+'／'+totalPages+' 頁。':'目前沒有每日30分鐘待比較的歷史衝突。';
   if(totalPages>1){
    const nav=document.createElement('div');nav.className='actions';
    for(const [delta,label] of [[-1,'上一頁'],[1,'下一頁']]){
     const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=page+delta<0||page+delta>=totalPages;
     button.addEventListener('click',()=>{page+=delta;render();});nav.append(button);
    }
    host.append(nav);
   }
   for(const row of rows.slice(page*pageSize,(page+1)*pageSize)){
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=row.date+'｜'+(row.incoming?.questionId||row.existing?.questionId||'自主練習')+'｜衝突紀錄 #'+(row.index+1);details.append(summary);
    const grid=document.createElement('div');grid.className='versions';
    for(const [title,value] of [['目前主要紀錄',row.main],['紀錄原版本',row.existing],['備份匯入版本',row.incoming]]){
     const box=document.createElement('div'),heading=document.createElement('strong'),pre=document.createElement('pre');
     heading.textContent=title;pre.textContent=preview(value);box.append(heading,pre);grid.append(box);
    }
    details.append(grid);
    for(const [side,label] of [['existing','將原版本設為主要紀錄'],['incoming','將匯入版本設為主要紀錄']]){
     const button=document.createElement('button');button.type='button';button.className='restoreStudy30';button.textContent=label;
     button.addEventListener('click',()=>restore(row.index,side));details.append(button);
    }
    host.append(details);
   }
   buttons();
   await renderV25();await renderCommon();await renderDaily();await renderLectures();
  }catch(e){$('study30ConflictSummary').textContent='無法讀取衝突：'+e.message;}
 }
 async function renderLectures(){
  if(window.PSD_LECTURES_IDB_TEST!==true||!window.PSDLectureRecovery||!window.PSDLectureCore)return;
  let panel=$('lectureConflictPanel');if(!panel){panel=document.createElement('section');panel.id='lectureConflictPanel';$('study30ConflictPanel').after(panel);}
  panel.replaceChildren();const h=document.createElement('h3');h.textContent='學習管理｜不同版本比較與復原';panel.append(h);
  const note=document.createElement('p');note.textContent='請先下載保護備份並勾選確認，關閉學習管理編輯分頁。若版本與其他課程或進度不相容，系統會停止復原。';panel.append(note);
  const rows=window.PSDLectureRecovery.list({core,lecture:window.PSDLectureCore,snapshot:await mixed.snapshot()});if(!rows.length){panel.append(document.createTextNode('目前沒有學習管理衝突版本。'));return;}
  for(const row of rows){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.path.join(' / ');details.append(summary);
   for(const [label,value] of [['目前版本',row.main],['原版本',row.existing],['匯入版本',row.incoming]]){const heading=document.createElement('strong'),pre=document.createElement('pre');heading.textContent=label;pre.textContent=preview(value);details.append(heading,pre);}
   for(const [side,label] of [['existing','恢復學習管理原版本'],['incoming','恢復學習管理匯入版本']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{
    if(busy||!baseline||!$('study30ConflictConfirmed').checked){tell('請先下載保護備份並勾選確認。',true);return;}if(!confirm('恢復此版本？目前主要紀錄會保留在衝突紀錄。'))return;
    busy=true;try{const now=await mixed.snapshot();if(!equalSnapshot(now,baseline))throw Error('下載備份後資料已變更，請重新下載');await mixed.apply(window.PSDLectureRecovery.planRestore({core,lecture:window.PSDLectureCore,snapshot:now,index:row.index,side}));baseline=null;$('study30ConflictConfirmed').checked=false;tell('已恢復學習管理版本；原主要紀錄仍保留。');await render();}catch(e){tell('恢復未完成：'+e.message,true);}finally{busy=false;buttons();}
   });details.append(button);}panel.append(details);
  }
 }
 async function renderDaily(){
  if(window.PSD_DAILY_IDB_TEST!==true||!window.PSDDailyRecovery)return;
  let panel=$('dailyConflictPanel');if(!panel){panel=document.createElement('section');panel.id='dailyConflictPanel';$('study30ConflictPanel').after(panel);}
  panel.replaceChildren();const h=document.createElement('h3');h.textContent='每日模擬題｜不同版本比較與復原';panel.append(h);
  const note=document.createElement('p');note.textContent='請先下載保護備份並勾選確認，關閉每日題編輯分頁。';panel.append(note);
  const rows=window.PSDDailyRecovery.listConflicts({core,snapshot:await mixed.snapshot()});if(!rows.length){panel.append(document.createTextNode('目前沒有每日題衝突版本。'));return;}
  for(const row of rows){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.path[0]||'清除前完整紀錄';details.append(summary);
   for(const [label,value] of [['目前版本',row.main],['原版本',row.existing],['匯入或清除前版本',row.incoming]]){const heading=document.createElement('strong'),pre=document.createElement('pre');heading.textContent=label;pre.textContent=preview(value);details.append(heading,pre);}
   for(const [side,label] of [['existing','恢復每日題原版本'],['incoming','恢復每日題匯入或清除前版本']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{
    if(busy||!baseline||!$('study30ConflictConfirmed').checked){tell('請先下載保護備份並勾選確認。',true);return;}if(!confirm('恢復此版本？目前主要紀錄會保留在衝突紀錄。'))return;
    busy=true;try{const now=await mixed.snapshot();if(!equalSnapshot(now,baseline))throw Error('下載備份後資料已變更，請重新下載');await mixed.apply(window.PSDDailyRecovery.planRestore({core,snapshot:now,index:row.index,side}));baseline=null;$('study30ConflictConfirmed').checked=false;tell('已恢復每日題版本；原主要紀錄仍保留。');await render();}catch(e){tell('恢復未完成：'+e.message,true);}finally{busy=false;buttons();}
   });details.append(button);}panel.append(details);
  }
 }
 async function renderCommon(){
  if(window.PSD_COMMON_IDB_TEST!==true)return;
  let panel=$('commonConflictPanel');if(!panel){panel=document.createElement('section');panel.id='commonConflictPanel';$('study30ConflictPanel').after(panel);}
  panel.replaceChildren();const h=document.createElement('h3');h.textContent='共同科目｜不同版本比較與復原';panel.append(h);
  const note=document.createElement('p');note.textContent='請先使用上方按鈕下載測試保護備份並勾選確認，並關閉共同科目編輯分頁。';panel.append(note);
  const rows=core.listCommonConflicts(await mixed.snapshot());if(!rows.length){panel.append(document.createTextNode('目前沒有共同科目衝突版本。'));return;}
  for(const row of rows){
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.key+'｜'+(row.path.join(' / ')||'清除前完整紀錄');details.append(summary);
   for(const [label,value] of [['目前版本',row.main],['原版本',row.existing],['匯入或清除前版本',row.incoming]]){const heading=document.createElement('strong'),pre=document.createElement('pre');heading.textContent=label;pre.textContent=preview(value);details.append(heading,pre);}
   for(const [side,label] of [['existing','恢復原版本'],['incoming','恢復匯入或清除前版本']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{
     if(busy||!baseline||!$('study30ConflictConfirmed').checked){tell('請先下載保護備份並勾選確認。',true);return;}
     if(!confirm('恢復此版本？目前資料會另存於衝突紀錄。'))return;
     busy=true;try{const now=await mixed.snapshot();if(!equalSnapshot(now,baseline))throw Error('下載備份後資料已變更，請重新下載');
      await mixed.apply(core.planCommonConflictRestore(now,row.index,side));baseline=null;$('study30ConflictConfirmed').checked=false;tell('已恢復共同科目版本；原主要版本仍留在衝突紀錄。');await render();
     }catch(e){tell('恢復未完成：'+e.message,true);}finally{busy=false;buttons();}
    });details.append(button);
   }
   panel.append(details);
  }
 }
 async function renderV25(){
  if(window.PSD_V25_IDB_TEST!==true)return;
  let panel=$('v25ConflictPanel');
  if(!panel){panel=document.createElement('section');panel.id='v25ConflictPanel';$('study30ConflictPanel').after(panel);}
  panel.replaceChildren();const h=document.createElement('h3');h.textContent='考古題｜不同答案比較與復原';panel.append(h);
  const note=document.createElement('p');note.textContent='先使用上方按鈕下載測試保護備份並勾選確認；請關閉考古題編輯分頁。此備份不含備考書桌。';panel.append(note);
  const rows=core.listV25Conflicts(await mixed.snapshot());
  if(!rows.length){panel.append(document.createTextNode('目前沒有考古題衝突版本。'));return;}
  for(const row of rows){
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=row.id+'｜'+row.key;details.append(summary);
   for(const [label,value] of [['目前版本',row.main],['原版本',row.existing],['匯入版本',row.incoming]]){const heading=document.createElement('strong'),pre=document.createElement('pre');heading.textContent=label;pre.textContent=preview(value);details.append(heading,pre);}
   for(const [side,label] of [['existing','恢復原版本'],['incoming','恢復匯入版本']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{
     if(busy||!baseline||!$('study30ConflictConfirmed').checked){tell('請先下載保護備份並勾選確認。',true);return;}
     if(!confirm('恢復此版本？目前主要答案會保留於衝突紀錄。'))return;
     busy=true;try{const now=await mixed.snapshot();if(!equalSnapshot(now,baseline))throw Error('下載備份後資料已變更，請重新下載');
      await mixed.apply(core.planV25ConflictRestore(now,row.index,side));baseline=null;$('study30ConflictConfirmed').checked=false;tell('已恢復選擇的考古題版本；原主要版本仍留在衝突紀錄。');await render();
     }catch(e){tell('恢復未完成：'+e.message,true);}finally{busy=false;buttons();}
    });details.append(button);
   }
   panel.append(details);
  }
 }
 async function start(){
  try{
   const db=await window.PSDLearningStorage.open();
   const managedKeys=['probation-study30-v251:v1',core.CONFLICT_KEY];
   if(window.PSD_DAILY_IDB_TEST===true)managedKeys.push('probation-daily-github:records:v1','daily-reading-test:saved');
   if(window.PSD_V25_IDB_TEST===true)managedKeys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');if(window.PSD_LECTURES_IDB_TEST===true)managedKeys.push('psd-lecture-planner-v1');if(window.PSD_COMMON_IDB_TEST===true)managedKeys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
   mixed=window.PSDStudy30MixedBackup.create({core,database:db,legacy:localStorage,origin:location.origin,managedKeys});
   const backup=$('study30ConflictBackup'),confirmed=$('study30ConflictConfirmed');
   backup.disabled=false;confirmed.disabled=false;
   backup.textContent='下載測試保護備份（不含備考書桌）';
   confirmed.parentElement.replaceChildren(confirmed,document.createTextNode(' 我已確認測試保護備份已保存，並關閉其他編輯分頁。'));
   backup.addEventListener('click',async()=>{
    try{
     const data=await mixed.collect();baseline=data.data;confirmed.checked=false;buttons();
     const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');
     a.href=url;a.download='study30-test-before-restore.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
     tell('已要求下載測試保護備份；此檔不含備考書桌，請確認檔案存在。');
    }catch(e){baseline=null;tell('無法下載保護備份：'+e.message,true);}
   });
   confirmed.addEventListener('change',buttons);
   await render();
  }catch(e){$('study30ConflictSummary').textContent='測試儲存無法開啟：'+e.message;}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
