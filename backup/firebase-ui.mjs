/*
 * Optional Firebase test console: explicit preview + external JSON backup
 * confirmation before ANY local overwrite or remote upload.
 * Covers 15 allowlisted localStorage modules and study-desk guest IndexedDB.
 */
import {openFirebase,validateFirebaseConfig} from '../cloud-sync/firebase-client.mjs';
import {prepare,commit} from '../cloud-sync/whole-site-core.mjs';
import {prepareDesk,commitDesk} from '../cloud-sync/whole-desk-core.mjs';
import {IDBStore} from '../cloud-sync/idb.js';
import {FORMAT} from '../cloud-sync/core.js';
import {pendingChanges} from '../cloud-sync/pending-detection.mjs';
import {checkReadiness} from '../cloud-sync/readiness.mjs';

const core=window.PSDUnifiedBackup;
const $=id=>document.getElementById(id);
const CFG='psd-firebase-public-web-config-v1',BOUND='psd-firebase-local-data-bound-v1',RESTORE='psd-firebase-restore-login-v1';
let connection=null,plan=null,deskPlan=null,adapter=null,deskAdapter=null,deskStore=null,cloudUser=null,busy=false;
let backedUp={modules:false,desk:false};
let scanning=false,journalPreview=null,preparedConfig=null,clearGuardPreview=null;
const safeLabel=e=>e instanceof Error?e.message:String(e);
function currentClearGuard(){
 if(!window.PSDLocalClearGuard)throw Error('缺少本機清除紀錄防護元件，已停止 Firebase 同步');
 const marker=window.PSDLocalClearGuard.read(localStorage);
 $('firebase-cleared-warning').hidden=!marker;
 return marker;
}
function approveClearedRestore(){
 const marker=currentClearGuard();
 if(marker&&!$('firebase-restore-cleared').checked)
  throw Error('這台裝置曾清除學習紀錄。雲端可能仍有舊答案；如確定要恢復，請另勾選「同意恢復雲端舊答案」再重新預覽');
 return marker;
}
window.addEventListener('storage',event=>{
 if(event.key===window.PSDLocalClearGuard?.KEY){
  try{currentClearGuard();}catch(e){status(safeLabel(e),true)}
  invalidatePreview();
 }
});
$('firebase-check-device').addEventListener('click',()=>{
 const list=$('firebase-device-report');
 list.replaceChildren();
 const report=checkReadiness(window);
 for(const result of report.checks){
  const item=document.createElement('li');
  item.textContent=(result.ok?'✓ ':'需處理：')+result.name+'：'+
    (result.ok?'可用':'尚未通過')+'。'+result.detail;
  list.append(item);
 }
 const summary=document.createElement('li');
 summary.textContent=report.ready
  ?'本機環境檢查已通過；尚須另行驗證 Google 登入及 Firestore 權限，且不會自動上傳。'
  :'這部裝置尚有未符合的項目；原始學習紀錄不受檢查影響，也不會因此上傳。';
 list.append(summary);
});
function assertIdentity(){
 if(!cloudUser || !connection)throw Error('請先登入');
 // A second tab may have signed out or changed users after this preview.
 // Never send one account's local study records using another auth session.
 if(connection.user()?.uid!==cloudUser.uid)
  throw Error('Google 登入帳號已變更，請重新登入並重新檢視所有學習紀錄');
 let bound;
 try{bound=JSON.parse(localStorage.getItem(BOUND)||'null');}
 catch{throw Error('此裝置帳號綁定資料已損壞；請先保留完整 JSON 備份，不可繼續同步');}
 if(bound && (bound.uid!==cloudUser.uid||bound.projectId!==connection.projectId))
  throw Error('此瀏覽器的學習資料曾與另一個 Google 帳號／Firebase 專案同步。為防止混入不同使用者的答案，已阻止切換後同步。請先分別備份，再改用其他瀏覽器設定檔或清理測試環境。');
}
// Read only. No background Firebase writes or reads; safe on Spark free quota.
async function scanLocalPending(){
 const el=$('firebase-pending');
 if(!cloudUser||!connection){
  el.textContent='訪客模式：紀錄只存這部裝置；無需登入或連線。';
  return;
 }
 if(!localStorage.getItem(BOUND)){
  el.textContent='已登入 Google，但尚未完成首次同步。請先預覽、下載兩份備份並親自確認；不會自行上傳。';
  return;
 }
 if(scanning||document.hidden)return;
 scanning=true;
 try{
  assertIdentity();
  const guest=await IDBStore.open('guest');
  let state;
  try{state=await guest.read();}finally{guest.close();}
  const result=await pendingChanges(core,core.storageSnapshot(localStorage),state,readShadow(),readDeskShadow());
  el.textContent=result.total
   ?'此裝置有 '+result.modules+' 類模組及 '+result.desk+' 筆書桌紀錄與上次成功同步不同；'+
    (navigator.onLine?'請按「預覽」確認合併。':'目前離線，資料已留在此裝置，恢復網路後可確認同步。')
   :'此裝置目前沒有相對於上次成功同步的本機變更；不代表其他裝置沒有新紀錄。';
 }catch(e){
  el.textContent='目前無法檢查待同步資料：'+safeLabel(e)+'。原本的本機紀錄仍保留。';
 }finally{scanning=false;}
}
window.addEventListener('storage',()=>{void scanLocalPending()});
window.addEventListener('psd:local-change',()=>{void scanLocalPending()});
window.addEventListener('online',()=>{void scanLocalPending()});
window.addEventListener('offline',()=>{void scanLocalPending()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void scanLocalPending()});
window.setInterval(()=>{if(cloudUser&&!document.hidden)void scanLocalPending()},30000);
function status(message,bad=false){
 const el=$('firebase-status');el.textContent=message;el.dataset.error=bad?'1':'0';
}
function downloadBackup(){
 const data=core.collect(localStorage,location.origin);
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;
 a.download='觀護人學習平臺-雲端同步前-完整備份-'+new Date().toISOString().replace(/:/g,'-')+'.json';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function downloadDeskBackup(){
 const guest=await IDBStore.open('guest');
 try {
  const state=await guest.read();
  const data={format:FORMAT,schemaVersion:1,exportedAt:new Date().toISOString(),state};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='備考書桌-同步前-保護備份.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 } finally {guest.close();}
}
function shadowKey(){
 if(!cloudUser||!connection)throw Error('尚未登入');
 return 'psd-firebase-shadow-v1:'+connection.projectId+':'+cloudUser.uid;
}
function readShadow(){
 try{return JSON.parse(localStorage.getItem(shadowKey())||'{}');}catch{return {};}
}
function saveShadow(value){
 localStorage.setItem(shadowKey(),JSON.stringify(value));
}
function deskShadowKey(){return shadowKey().replace('psd-firebase-shadow-v1','psd-firebase-desk-shadow-v1');}
function readDeskShadow(){try{return JSON.parse(localStorage.getItem(deskShadowKey())||'{}')}catch{return {};}}
function saveDeskShadow(value){localStorage.setItem(deskShadowKey(),JSON.stringify(value));}
function renderPlan(){
 $('firebase-preview').replaceChildren();
 const descriptions={upload:'此裝置 → 雲端',download:'雲端 → 此裝置',conflict:'兩種版本；雲端為主要顯示，差異另存衝突紀錄',
  same:'資料一致',empty:'兩邊都無紀錄'};
 for(const row of plan.status){
  const item=document.createElement('li');
  item.textContent=row.name+'：'+descriptions[row.status];
  $('firebase-preview').append(item);
 }
 $('firebase-confirm').checked=false;
 $('firebase-apply').disabled=false;
 const deskCount=deskPlan.statuses.length;
 $('firebase-scope').textContent='已比較 '+plan.status.length+' 類舊模組及備考書桌 '+deskCount+' 筆紀錄；模組衝突 '+plan.conflicts+' 類、書桌衝突 '+deskPlan.conflicts+' 筆。未涵蓋白名單外的其他資料鍵，且尚未啟用背景同步。';
 const deskText=document.createElement('li');
 deskText.textContent='備考書桌 IndexedDB：'+deskCount+' 筆；上傳 '+deskPlan.statuses.filter(x=>x.status==='upload').length+'、下載 '+deskPlan.statuses.filter(x=>x.status==='download').length+'、版本差異 '+deskPlan.conflicts;
 $('firebase-preview').append(deskText);
}
function invalidatePreview(){
 plan=null;deskPlan=null;journalPreview=null;clearGuardPreview=null;backedUp={modules:false,desk:false};
 $('firebase-preview').replaceChildren();
 $('firebase-confirm').checked=false;
 $('firebase-apply').disabled=true;
}
function lock(locked){
 busy=locked;
 for(const id of ['firebase-prepare','firebase-login','firebase-signout','firebase-preview-btn','firebase-apply','firebase-backup','firebase-backup-desk'])
  $(id).disabled=locked;
 if(!locked)$('firebase-login').disabled=!connection||!preparedConfig;
}
async function perform(fn){
 if(busy)return;
 lock(true);
 try{await fn();}
 catch(e){
  // Some writes may have completed before a remote conflict; never allow a
  // second click on the stale plan to replay writes or create extra archives.
  invalidatePreview();
  status('操作未完成：'+safeLabel(e)+'。雲端可能有部分資料已寫入，已清除舊預覽。請先保留本機原稿、重新預覽並確認兩份備份，再重試。',true);
 }
 finally{lock(false);$('firebase-apply').disabled=!plan;}
}
function configFromForm(){
 return validateFirebaseConfig({
  apiKey:$('firebase-api').value.trim(),
  projectId:$('firebase-project').value.trim(),
  authDomain:$('firebase-auth-domain').value.trim(),
  appId:$('firebase-app-id').value.trim()
 });
}
async function prepareLogin(){
 // SDK initialization may be slow; it must never consume the popup click.
 // Preparation touches only public Firebase configuration and Auth state.
 invalidatePreview();
 deskStore?.close();deskStore=null;
 connection=null;preparedConfig=null;adapter=null;deskAdapter=null;cloudUser=null;
 $('firebase-user').textContent='未登入';
 const config=configFromForm();
 const ready=await openFirebase(config);
 connection=ready;
 preparedConfig=JSON.stringify(config);
 status('登入環境已準備完成。請另外按「② 以 Google 帳號登入」，才會開啟 Google 視窗；尚未讀取或上傳任何學習答案。');
}
async function connect(){
 if(!connection||!preparedConfig)throw Error('請先按「① 準備 Google 登入環境」');
 const config=configFromForm();
 if(preparedConfig!==JSON.stringify(config))
  throw Error('Firebase 設定在準備後已變更；請重新按「① 準備 Google 登入環境」');
 // Must call login() synchronously within this second, real user click.
 // No SDK import, authStateReady(), or setPersistence await before popup.
 const user=await connection.login();
 if(!user)throw Error('沒有取得 Google 登入資訊');
 cloudUser=user;adapter=connection.adapter();deskAdapter=connection.adapter('desk');
 assertIdentity();
 localStorage.setItem(CFG,JSON.stringify(config));
 localStorage.setItem(RESTORE,'yes');
 $('firebase-user').textContent='已登入：'+user.email+'（'+connection.projectId+'）';
 plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 status('已登入。尚未上傳任何學習紀錄。請先按「預覽差異」。');
 void scanLocalPending();
}
$('firebase-prepare').addEventListener('click',()=>perform(prepareLogin));
$('firebase-login').addEventListener('click',()=>perform(connect));
$('firebase-signout').addEventListener('click',()=>perform(async()=>{
 if(connection)await connection.signOut();
 localStorage.removeItem(RESTORE); // Sign-out stays guest on the next visit.
 connection=null;preparedConfig=null;adapter=null;deskAdapter=null;cloudUser=null;plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 deskStore?.close();deskStore=null;
 $('firebase-user').textContent='未登入';$('firebase-preview').replaceChildren();
 status('已登出。此瀏覽器的原始學習紀錄沒有刪除。');
 void scanLocalPending();
}));
$('firebase-preview-btn').addEventListener('click',()=>perform(async()=>{
 invalidatePreview();
 const cleared=approveClearedRestore();
 if(!adapter||!cloudUser)throw Error('請先用 Google 帳號登入');
 assertIdentity();
 if(!navigator.onLine)throw Error('離線中，無法讀取雲端最新版本');
 journalPreview=window.PSDLocalJournal?.snapshot()||null;
 const local=core.storageSnapshot(localStorage);
 const docs=await adapter.readAll();
 plan=await prepare(core,local,docs,readShadow());
 deskStore?.close();deskStore=await IDBStore.open('guest');
 deskPlan=await prepareDesk(await deskStore.read(),await deskAdapter.readAll(),readDeskShadow());
 if(currentClearGuard()!==cleared)throw Error('預覽期間其他分頁已清除學習紀錄，請重新確認是否恢復雲端舊答案');
 clearGuardPreview=cleared;
 backedUp={modules:false,desk:false};
 renderPlan();
 status('差異預覽完成。這一步沒有修改本機，也沒有上傳。請先下載本機 JSON，再確認操作。');
}));
$('firebase-backup').addEventListener('click',()=>perform(async()=>{
 downloadBackup();backedUp.modules=true;
 status('已提出完整備份下載要求。請確認檔案實際存在；只有你可以確認備份成功。');
}));
$('firebase-backup-desk').addEventListener('click',()=>perform(async()=>{
 await downloadDeskBackup();backedUp.desk=true;
 status('已提出備考書桌 JSON 下載要求，請確認兩份備份均已安全保存。');
}));
$('firebase-apply').addEventListener('click',()=>perform(async()=>{
 if(!plan||!deskPlan||!adapter||!deskAdapter||!deskStore)throw Error('請先預覽整個網站的資料差異');
 const cleared=approveClearedRestore();
 if(cleared!==clearGuardPreview)throw Error('預覽後本機清除紀錄的狀態已改變，請重新預覽');
 assertIdentity();
 if(!backedUp.modules||!backedUp.desk||!$('firebase-confirm').checked)throw Error('請先下載並檢查舊模組及備考書桌兩份 JSON 備份，關閉其他作答分頁並確認');
 if(!navigator.onLine)throw Error('需要連線才能確認最新雲端版本');
 if(!confirm('確認執行本次合併？原始資料已另外備份；遇衝突會將本機差異封存，雲端版本保持為主要紀錄。'))return;
 // Bind the shared browser origin BEFORE the first upload, so a failed
 // second stage cannot later leak the first user's data to another account.
 localStorage.setItem(BOUND,JSON.stringify({uid:cloudUser.uid,projectId:connection.projectId}));
 // Capture this operation's token, rather than mutable preview state which
 // another tab's storage event can invalidate while a request is in flight.
 const assertCurrent=()=>{
  assertIdentity();
  if(currentClearGuard()!==cleared)
   throw Error('同步期間本機清除紀錄的狀態已改變，已停止同步，請重新預覽');
 };
 const result=await commit(core,localStorage,adapter,plan,assertCurrent);
 assertCurrent();
 saveShadow(result.shadow);
 // If desk sync fails, the legacy modules already completed safely; preview again to resume.
 const deskResult=await commitDesk(deskStore,deskAdapter,deskPlan,assertCurrent);
 assertCurrent();
 saveDeskShadow(deskResult.shadow);
 if(cleared)window.PSDLocalClearGuard.acknowledge(localStorage,cleared);
 $('firebase-restore-cleared').checked=false;
 currentClearGuard();
 // A later tab edit gets a new token and is never cleared by this acknowledgement.
 window.PSDLocalJournal?.acknowledge(journalPreview);
 journalPreview=null;
 localStorage.setItem(BOUND,JSON.stringify({uid:cloudUser.uid,projectId:connection.projectId}));
 plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 $('firebase-preview').replaceChildren();$('firebase-confirm').checked=false;
 status('本次同步完成：舊模組上傳 '+result.uploaded+' 類、更新本機 '+result.downloaded+' 類；書桌上傳 '+deskResult.uploaded+' 筆、更新本機 '+deskResult.downloaded+' 筆；合計差異 '+(result.conflicts+deskResult.conflicts)+'。請重新開啟練習頁檢查，不要清除 JSON。');
 void scanLocalPending();
}));
try{
 const saved=JSON.parse(localStorage.getItem(CFG)||'null');
 if(saved){
  const cfg=validateFirebaseConfig(saved);
  for(const [id,value] of [['firebase-api',cfg.apiKey],['firebase-project',cfg.projectId],
    ['firebase-auth-domain',cfg.authDomain],['firebase-app-id',cfg.appId]])$(id).value=value;
 }
}catch{
 status('原本的 Firebase 公開設定無效，請重新輸入。',true);
}
$('firebase-apply').disabled=true;
try{currentClearGuard()}catch(e){status('清除紀錄的安全標記異常：'+safeLabel(e),true)}
// Restore a previously opted-in Firebase identity, without fetching any user
// learning records or uploading automatically. Guests never load the SDK.
async function restoreSession(){
 if(!localStorage.getItem(BOUND)||localStorage.getItem(RESTORE)!=='yes')return;
 const raw=localStorage.getItem(CFG);if(!raw)return;
 try{
  const config=validateFirebaseConfig(JSON.parse(raw));
  connection=await openFirebase(config);
  preparedConfig=JSON.stringify(config);
  $('firebase-login').disabled=false;
  const user=connection.user();
  if(!user){
   cloudUser=null;
   status('此裝置的 Google 登入已失效，請親自按「② 以 Google 帳號登入」重新驗證；不會自動上傳任何學習資料。');
   return;
  }
  cloudUser=user;
  assertIdentity();
  adapter=connection.adapter();deskAdapter=connection.adapter('desk');
  $('firebase-user').textContent='已登入：'+user.email+'（'+connection.projectId+'）';
  status('已恢復 Google 帳號。資料仍保留在本機，尚未執行雲端同步；需要預覽後確認。');
  void scanLocalPending();
 }catch(error){
  connection=null;preparedConfig=null;cloudUser=null;adapter=null;deskAdapter=null;
  $('firebase-login').disabled=true;
  status('無法自動恢復同步登入：'+safeLabel(error)+'。本機資料仍可正常使用。',true);
 }
}
restoreSession();
