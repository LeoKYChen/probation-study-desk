/*
 * Optional Firebase test console: explicit preview + external JSON backup
 * confirmation before ANY local overwrite or remote upload.
 * This first adapter covers the 15 allowlisted localStorage modules, not IDB.
 */
import {openFirebase,validateFirebaseConfig} from '../cloud-sync/firebase-client.mjs';
import {prepare,commit} from '../cloud-sync/whole-site-core.mjs';

const core=window.PSDUnifiedBackup;
const $=id=>document.getElementById(id);
const CFG='psd-firebase-public-web-config-v1';
let connection=null,plan=null,adapter=null,cloudUser=null,snapshotSaved=false,busy=false;
const safeLabel=e=>e instanceof Error?e.message:String(e);
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
 $('firebase-scope').textContent='將比較 '+plan.status.length+' 類既有模組；'+plan.conflicts+' 類版本差異。此階段暫不包含備考書桌 IndexedDB，沒有將測試當作全站上線。';
}
function lock(locked){
 busy=locked;
 for(const id of ['firebase-login','firebase-signout','firebase-preview-btn','firebase-apply','firebase-backup'])
  $(id).disabled=locked;
}
async function perform(fn){
 if(busy)return;
 lock(true);
 try{await fn();}
 catch(e){status('操作未完成：'+safeLabel(e)+'。原本網站資料仍應保留，請先確認 JSON 備份。',true);}
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
 cloudUser=user;adapter=connection.adapter();
 localStorage.setItem(CFG,JSON.stringify(config));
 $('firebase-user').textContent='已登入：'+user.email+'（'+connection.projectId+'）';
 plan=null;snapshotSaved=false;
 status('已登入。尚未上傳任何學習紀錄。請先按「預覽差異」。');
}
$('firebase-login').addEventListener('click',()=>perform(connect));
$('firebase-signout').addEventListener('click',()=>perform(async()=>{
 if(connection)await connection.signOut();
 connection=null;adapter=null;cloudUser=null;plan=null;snapshotSaved=false;
 $('firebase-user').textContent='未登入';$('firebase-preview').replaceChildren();
 status('已登出。此瀏覽器的原始學習紀錄沒有刪除。');
}));
$('firebase-preview-btn').addEventListener('click',()=>perform(async()=>{
 if(!adapter||!cloudUser)throw Error('請先用 Google 帳號登入');
 if(!navigator.onLine)throw Error('離線中，無法讀取雲端最新版本');
 const local=core.storageSnapshot(localStorage);
 const docs=await adapter.readAll();
 plan=await prepare(core,local,docs,readShadow());
 snapshotSaved=false;
 renderPlan();
 status('差異預覽完成。這一步沒有修改本機，也沒有上傳。請先下載本機 JSON，再確認操作。');
}));
$('firebase-backup').addEventListener('click',()=>perform(async()=>{
 downloadBackup();snapshotSaved=true;
 status('已提出完整備份下載要求。請確認檔案實際存在；只有你可以確認備份成功。');
}));
$('firebase-apply').addEventListener('click',()=>perform(async()=>{
 if(!plan||!adapter)throw Error('請先預覽差異');
 if(!snapshotSaved||!$('firebase-confirm').checked)throw Error('請先下載、實際檢查 JSON 備份，關閉其他作答分頁並勾選確認');
 if(!navigator.onLine)throw Error('需要連線才能確認最新雲端版本');
 if(!confirm('確認執行本次合併？原始資料已另外備份；遇衝突會將本機差異封存，雲端版本保持為主要紀錄。'))return;
 const result=await commit(core,localStorage,adapter,plan);
 saveShadow(result.shadow);plan=null;snapshotSaved=false;
 $('firebase-preview').replaceChildren();$('firebase-confirm').checked=false;
 status('本次同步完成：上傳 '+result.uploaded+' 類、更新本機 '+result.downloaded+' 類，版本差異 '+result.conflicts+' 類。請重新開啟各學習模組檢查，不要清除原始 JSON。');
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
