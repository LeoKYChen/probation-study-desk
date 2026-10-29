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
  }catch(e){$('study30ConflictSummary').textContent='無法讀取衝突：'+e.message;}
 }
 async function start(){
  try{
   const db=await window.PSDLearningStorage.open();
   mixed=window.PSDStudy30MixedBackup.create({core,database:db,legacy:localStorage,origin:location.origin});
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
