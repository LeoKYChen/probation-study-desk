/* Experimental complete export and restricted restore; not active on the formal site. */
import {IDBStore} from '../cloud-sync/idb.js';
import * as full from '../storage/full-backup.mjs';
import * as fullDrive from '../storage/full-drive.mjs';
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
  function addDrive(){
   const panel=document.createElement('section');panel.id='testFullDrive';const title=document.createElement('h3');title.textContent='測試版 Google Drive 手動同步';panel.append(title);
   const explanation=document.createElement('p');explanation.textContent='僅用合成資料。使用獨立測試資料夾，不會自動同步或讀取舊版同步資料夾；計時資料不包含。';panel.append(explanation);
   const label=document.createElement('label');label.textContent='Google OAuth 用戶端 ID ';const cid=document.createElement('input');cid.type='text';cid.autocomplete='off';cid.setAttribute('aria-label','測試版 Google OAuth 用戶端 ID');cid.value=localStorage.getItem('psd-test-full-drive-client')||'';label.append(cid);panel.append(label);
   const status=document.createElement('p');status.id='testFullDriveStatus';status.setAttribute('role','status');status.textContent='尚未連線。';panel.append(status);
   let token='',expires=0,engine=null,client=null,clientId='';const scope='https://www.googleapis.com/auth/drive.file';
   const uuid=()=>crypto.randomUUID();
   const createButton=(name,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',fn);panel.append(b);return b;};
   const connect=createButton('連線測試版 Google Drive',()=>{
    const value=cid.value.trim();if(!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)){status.textContent='請輸入有效的 Google OAuth 網頁用戶端 ID。';return;}
    if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname)){status.textContent='Google 授權需要 HTTPS。';return;}
    if(!window.google?.accounts?.oauth2?.initTokenClient){status.textContent='Google 授權元件尚未載入。';return;}
    try{localStorage.setItem('psd-test-full-drive-client',value);}catch{status.textContent='無法保存用戶端設定。';return;}
    if(!client||clientId!==value){clientId=value;client=google.accounts.oauth2.initTokenClient({client_id:value,scope,include_granted_scopes:false,callback:response=>{
     if(!response?.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,scope)){status.textContent='Google 授權未完成。';return;}
     token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in||3300)-90)*1000;
     const original=window.PSDDriveTransport.create({getToken:()=>Date.now()<expires?token:'',createId:uuid,folderName:'觀護人學習平台-完整同步測試-私人'});
     const transport={...original,ensureFolder:async()=>{const id=await original.ensureFolder(),pin=localStorage.getItem('psd-test-full-drive-folder');if(pin&&pin!==id)throw Error('同步資料夾與本機先前設定不同，已停止');if(!pin)localStorage.setItem('psd-test-full-drive-folder',id);return id;}};
     let device=localStorage.getItem('psd-test-full-drive-device');if(!device){device=uuid();localStorage.setItem('psd-test-full-drive-device',device);}
     engine=fullDrive.create({core,learning,deskDatabase:desk.db,transport,origin:location.origin,deviceId:device,newId:uuid});sync.disabled=false;disconnect.disabled=false;status.textContent='已取得暫時授權；請先保存 JSON 備份，再按同步。';
    },error_callback:()=>{status.textContent='Google 授權視窗未完成。';}});}
    client.requestAccessToken({prompt:'consent'});
   });
   const sync=createButton('同步測試資料',async()=>{
    if(busy||!engine)return;if(Date.now()>=expires){token='';engine=null;sync.disabled=true;status.textContent='授權已到期，請重新連線。';return;}
    if(!confirm('請確認已下載並保存測試版全站 JSON，且已關閉其他編輯分頁。開始同步？'))return;
    busy=true;sync.disabled=connect.disabled=disconnect.disabled=true;
    try{const result=await engine.sync(s=>{status.textContent=s});plan=null;protectedCopy=false;await renderArchives();status.textContent='同步完成：讀取 '+result.remoteSnapshots+' 份快照，保留 '+result.conflicts+' 筆衝突'+(result.uploaded?'，已新增快照':'，無需新增快照')+(result.pendingLocalChanges?'；同步期間的新修改尚待下次同步':'')+'。';window.dispatchEvent(new CustomEvent('psd:drive-sync-finished',{detail:result}));}
    catch(e){status.textContent='同步未完成：'+e.message+'；請保留本機資料與 JSON 備份。';}
    finally{busy=false;connect.disabled=false;sync.disabled=!engine;disconnect.disabled=!token;}
   });sync.disabled=true;
   const disconnect=createButton('斷開測試版授權',()=>{const old=token;token='';expires=0;engine=null;sync.disabled=disconnect.disabled=true;if(old&&google?.accounts?.oauth2?.revoke)google.accounts.oauth2.revoke(old,()=>{});status.textContent='已斷開授權，未刪除任何資料。';});disconnect.disabled=true;
   host.append(panel);
  }
  document.querySelector('main').prepend(host);save.disabled=protect.disabled=apply.disabled=input.disabled=true;
  try{
   database=await window.PSDLearningStorage.open();desk=await IDBStore.open('guest');
   const managedKeys=['probation-study30-v251:v1',core.CONFLICT_KEY];
   if(window.PSD_DAILY_IDB_TEST===true)managedKeys.push('probation-daily-github:records:v1','daily-reading-test:saved');
   if(window.PSD_V25_IDB_TEST===true)managedKeys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
   if(window.PSD_LECTURES_IDB_TEST===true)managedKeys.push('psd-lecture-planner-v1');
   if(window.PSD_COMMON_IDB_TEST===true)managedKeys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
   learning=window.PSDStudy30MixedBackup.create({core,database,legacy:localStorage,origin:location.origin,managedKeys});
   await learning.snapshot();await renderArchives();addDrive();save.disabled=protect.disabled=apply.disabled=input.disabled=false;tell('測試儲存已開啟；請先關閉其他編輯分頁。');
  }catch(e){tell('測試備份無法啟動：'+e.message);database?.close();desk?.close();}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}
