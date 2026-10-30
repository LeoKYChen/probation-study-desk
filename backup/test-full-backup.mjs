/* Experimental complete export and restricted restore; not active on the formal site. */
import {IDBStore} from '../cloud-sync/idb.js';
import * as full from '../storage/full-backup.mjs';
if(window.PSD_STUDY30_IDB_TEST===true){
 const start=async()=>{
  const core=window.PSDUnifiedBackup,host=document.createElement('section');host.className='card';host.id='testFullBackup';
  const h=document.createElement('h2');h.textContent='測試版：全站 JSON 與備考書桌';host.append(h);
  const note=document.createElement('p');note.textContent='僅供合成資料測試。匯出包含目前網址的模組及書桌；還原只支援已接入 IndexedDB 的模組。計時不包含在全站備份中。';host.append(note);
  const message=document.createElement('p');message.setAttribute('role','status');message.id='testFullStatus';host.append(message);
  const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);host.append(b);return b;};
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','選擇測試版全站備份');
  let database,desk,learning,plan=null,protectedCopy=false,busy=false;
  function tell(text){message.textContent=text;}
  function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
  async function collect(){return full.collect({core,learning,deskDatabase:desk.db,origin:location.origin});}
  const archives=document.createElement('div');archives.id='testDeskArchives';host.append(archives);
  async function renderArchives(){
   archives.replaceChildren();const title=document.createElement('h3');title.textContent='備考書桌封存版本';archives.append(title);
   const rows=await full.listDeskArchives(desk.db);
   if(!rows.length){archives.append(document.createTextNode('目前沒有可比較的書桌封存版本。'));return;}
   for(const row of rows){
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='書桌 '+row.namespace+'｜封存 '+row.archive.slice(-12);details.append(summary);
    for(const [label,value] of [['目前版本',row.current],['封存版本',row.archived]]){
     const heading=document.createElement('h4');heading.textContent=label;const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(value,null,2);details.append(heading,pre);
    }
    const restore=document.createElement('button');restore.type='button';restore.textContent='下載保護備份並復原此版本';
    restore.addEventListener('click',async()=>{
     if(busy)return;busy=true;restore.disabled=true;
     try{
      const choice=await full.planDeskConflictRestore({deskDatabase:desk.db,namespace:row.namespace,archive:row.archive});
      download(await collect(),'test-full-before-desk-restore.json');
      if(!confirm('請確認保護備份已儲存，並關閉其他編輯分頁。復原封存版本？')){tell('已取消復原。');return;}
      await full.applyDeskConflictRestore(choice,desk.db);plan=null;protectedCopy=false;
      await renderArchives();tell('已復原書桌封存版本，原書桌仍保留為封存版本。');
     }catch(e){tell('書桌復原未完成：'+e.message);}
     finally{busy=false;restore.disabled=false;}
    });details.append(restore);archives.append(details);
   }
  }
  const save=button('下載測試版全站 JSON',async()=>{try{download(await collect(),'test-full-learning-backup.json');tell('已要求下載測試備份，請確認檔案已儲存。');}catch(e){tell('匯出失敗：'+e.message);}});
  host.append(input);
  const protect=button('下載匯入前保護備份',async()=>{if(busy||!plan){tell('請先選檔預覽。');return;}busy=true;protect.disabled=true;try{download(await collect(),'test-full-before-import.json');protectedCopy=true;tell('已要求下載保護備份；確認檔案存在後再匯入。');}catch(e){protectedCopy=false;tell('保護備份失敗：'+e.message);}finally{busy=false;protect.disabled=false;}});
  const apply=button('確認安全匯入測試備份',async()=>{
   if(busy||!plan||!protectedCopy){tell('請先選檔預覽並下載保護備份。');return;}
   if(!confirm('請確認已保存保護備份並關閉其他編輯分頁。開始匯入？'))return;
   busy=true;apply.disabled=true;try{const result=await full.applyRestore({plan,learning,deskDatabase:desk.db});plan=null;protectedCopy=false;await renderArchives();tell('匯入完成：學習資料 '+result.moduleWritten+' 個區域，書桌封存／新增 '+result.deskWritten+' 份。');}
   catch(e){plan=null;protectedCopy=false;tell('匯入未完全確認：'+e.message+'；請保留備份，重新預覽後再試。');}finally{busy=false;apply.disabled=false;}
  });
  input.addEventListener('change',async()=>{if(busy)return;plan=null;protectedCopy=false;const f=input.files?.[0];if(!f)return;busy=true;input.disabled=true;try{if(f.size>20*1024*1024)throw Error('檔案超過20MB');const bundle=JSON.parse(await f.text());plan=await full.planRestore({bundle,core,learning,deskDatabase:desk.db});tell('預覽完成：學習資料 '+Object.keys(plan.modulePlan.changes).length+' 區，書桌 '+plan.deskPlan.writes.length+' 份，書桌衝突 '+plan.deskPlan.conflicts.length+' 筆。請先下載保護備份。');}catch(e){tell('無法預覽：'+e.message);}finally{input.value='';input.disabled=false;busy=false;}});
  document.querySelector('main').prepend(host);save.disabled=protect.disabled=apply.disabled=input.disabled=true;
  try{
   database=await window.PSDLearningStorage.open();desk=await IDBStore.open('guest');
   const managedKeys=['probation-study30-v251:v1',core.CONFLICT_KEY];
   if(window.PSD_DAILY_IDB_TEST===true)managedKeys.push('probation-daily-github:records:v1','daily-reading-test:saved');
   if(window.PSD_V25_IDB_TEST===true)managedKeys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
   if(window.PSD_LECTURES_IDB_TEST===true)managedKeys.push('psd-lecture-planner-v1');
   if(window.PSD_COMMON_IDB_TEST===true)managedKeys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
   learning=window.PSDStudy30MixedBackup.create({core,database,legacy:localStorage,origin:location.origin,managedKeys});
   await learning.snapshot();await renderArchives();save.disabled=protect.disabled=apply.disabled=input.disabled=false;tell('測試儲存已開啟；請先關閉其他編輯分頁。');
  }catch(e){tell('測試備份無法啟動：'+e.message);database?.close();desk?.close();}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}
