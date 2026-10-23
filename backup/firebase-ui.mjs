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

const core=window.PSDUnifiedBackup;
const $=id=>document.getElementById(id);
const CFG='psd-firebase-public-web-config-v1',BOUND='psd-firebase-local-data-bound-v1';
let connection=null,plan=null,deskPlan=null,adapter=null,deskAdapter=null,deskStore=null,cloudUser=null,busy=false;
let backedUp={modules:false,desk:false};
const safeLabel=e=>e instanceof Error?e.message:String(e);
function assertIdentity(){
 if(!cloudUser || !connection)throw Error('請先登入');
 let bound;
 try{bound=JSON.parse(localStorage.getItem(BOUND)||'null');}
 catch{throw Error('此裝置帳號綁定資料已損壞；請先保留完整 JSON 備份，不可繼續同步');}
 if(bound && (bound.uid!==cloudUser.uid||bound.projectId!==connection.projectId))
  throw Error('此瀏覽器的學習資料曾與另一個 Google 帳號／Firebase 專案同步。為防止混入不同使用者的答案，已阻止切換後同步。請先分別備份，再改用其他瀏覽器設定檔或清理測試環境。');
}
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
function lock(locked){
 busy=locked;
 for(const id of ['firebase-login','firebase-signout','firebase-preview-btn','firebase-apply','firebase-backup','firebase-backup-desk'])
  $(id).disabled=locked;
}
async function perform(fn){
 if(busy)return;
 lock(true);
 try{await fn();}
 catch(e){status('操作未完成：'+safeLabel(e)+'。某些雲端項目可能已寫入；原始 JSON 備份及本機紀錄應保留，請重新預覽確認，不要重複盲目上傳。',true);}
 finally{lock(false);$('firebase-apply').disabled=!plan;}
}
async function connect(){
 const config=validateFirebaseConfig({
  apiKey:$('firebase-api').value.trim(),
  projectId:$('firebase-project').value.trim(),
  authDomain:$('firebase-auth-domain').value.trim(),
  appId:$('firebase-app-id').value.trim()
 });
 // A public Web config does not grant database access; Firestore rules do.
 connection=await openFirebase(config);
 const user=await connection.login();
 if(!user)throw Error('沒有取得 Google 登入資訊');
 cloudUser=user;adapter=connection.adapter();deskAdapter=connection.adapter('desk');
 assertIdentity();
 localStorage.setItem(CFG,JSON.stringify(config));
 $('firebase-user').textContent='已登入：'+user.email+'（'+connection.projectId+'）';
 plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 status('已登入。尚未上傳任何學習紀錄。請先按「預覽差異」。');
}
$('firebase-login').addEventListener('click',()=>perform(connect));
$('firebase-signout').addEventListener('click',()=>perform(async()=>{
 if(connection)await connection.signOut();
 connection=null;adapter=null;deskAdapter=null;cloudUser=null;plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 deskStore?.close();deskStore=null;
 $('firebase-user').textContent='未登入';$('firebase-preview').replaceChildren();
 status('已登出。此瀏覽器的原始學習紀錄沒有刪除。');
}));
$('firebase-preview-btn').addEventListener('click',()=>perform(async()=>{
 if(!adapter||!cloudUser)throw Error('請先用 Google 帳號登入');
 assertIdentity();
 if(!navigator.onLine)throw Error('離線中，無法讀取雲端最新版本');
 const local=core.storageSnapshot(localStorage);
 const docs=await adapter.readAll();
 plan=await prepare(core,local,docs,readShadow());
 deskStore?.close();deskStore=await IDBStore.open('guest');
 deskPlan=await prepareDesk(await deskStore.read(),await deskAdapter.readAll(),readDeskShadow());
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
 assertIdentity();
 if(!backedUp.modules||!backedUp.desk||!$('firebase-confirm').checked)throw Error('請先下載並檢查舊模組及備考書桌兩份 JSON 備份，關閉其他作答分頁並確認');
 if(!navigator.onLine)throw Error('需要連線才能確認最新雲端版本');
 if(!confirm('確認執行本次合併？原始資料已另外備份；遇衝突會將本機差異封存，雲端版本保持為主要紀錄。'))return;
 // Bind the shared browser origin BEFORE the first upload, so a failed
 // second stage cannot later leak the first user's data to another account.
 localStorage.setItem(BOUND,JSON.stringify({uid:cloudUser.uid,projectId:connection.projectId}));
 const result=await commit(core,localStorage,adapter,plan);
 saveShadow(result.shadow);
 // If desk sync fails, the legacy modules already completed safely; preview again to resume.
 const deskResult=await commitDesk(deskStore,deskAdapter,deskPlan);
 saveDeskShadow(deskResult.shadow);
 localStorage.setItem(BOUND,JSON.stringify({uid:cloudUser.uid,projectId:connection.projectId}));
 plan=null;deskPlan=null;backedUp={modules:false,desk:false};
 $('firebase-preview').replaceChildren();$('firebase-confirm').checked=false;
 status('本次同步完成：舊模組上傳 '+result.uploaded+' 類、更新本機 '+result.downloaded+' 類；書桌上傳 '+deskResult.uploaded+' 筆、更新本機 '+deskResult.downloaded+' 筆；合計差異 '+(result.conflicts+deskResult.conflicts)+'。請重新開啟練習頁檢查，不要清除 JSON。');
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
