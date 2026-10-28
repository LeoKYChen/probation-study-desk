/* Opt-in Google OAuth for a static GitHub Pages site. Tokens only in memory. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const core=window.PSDUnifiedBackup,syncCore=window.PSDDriveSyncCore,drive=window.PSDDriveTransport;
 if(!core||!syncCore||!drive)return;
 const CID='psd-drive-oauth-client-id-v1',AUTO='psd-drive-auto-enabled-v1',DEVICE='psd-drive-device-v1',FOLDER_ID='psd-drive-folder-pin-v1';
 const SCOPE='https://www.googleapis.com/auth/drive.file',INTERVAL=5*60*1000;
 let token='',expiresAt=0,engine=null,busy=false,lastSync=0,tokenClient=null,tokenClientId='';
 const uuid=()=>window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():
  Math.random().toString(36).slice(2)+Date.now().toString(36);
 const device=()=>{let id=localStorage.getItem(DEVICE);if(!id){id=uuid();localStorage.setItem(DEVICE,id);}return id;};
 const usable=()=>location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
 const hasToken=()=>!!token&&Date.now()<expiresAt;
 function status(message,type='info'){
  const el=$('driveSyncStatus');if(!el)return;
  el.textContent=message;el.dataset.status=type;
 }
 function updateButtons(){
  if(!$('driveConnect'))return;
  const online=usable()&&navigator.onLine!==false;
  $('driveConnect').disabled=!online||busy;
  $('driveSyncNow').disabled=!online||!hasToken()||busy;
  $('driveDisconnect').disabled=!token||busy;
  $('driveClientId').disabled=busy;
  $('driveAutoSync').disabled=!hasToken()||busy;
 }
 function identifierValid(value){return /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);}
 function makeEngine(){
  const original=drive.create({getToken:()=>hasToken()?token:'',createId:uuid});
  const transport={...original,ensureFolder:async()=>{
   const id=await original.ensureFolder();
   const pinned=localStorage.getItem(FOLDER_ID);
   if(pinned&&pinned!==id)throw Error('偵測到不同的 Google 帳號或 OAuth 應用程式；同步資料夾與此裝置以前不同。為避免資料分流，已停止同步。');
   if(!pinned)localStorage.setItem(FOLDER_ID,id);
   return id;
  }};
  return syncCore.createEngine({core,storage:localStorage,transport,origin:location.origin,
   deviceId:device(),newId:uuid});
 }
 function setConnected(response){
  if(!response||response.error||!response.access_token){
   status('Google 授權未完成，資料仍完整保存於本機。','error');return;
  }
  if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE)){
   status('未取得所需的 Google Drive 檔案權限，已停止同步。','error');return;
  }
  token=response.access_token;
  expiresAt=Date.now()+Math.max(0,Number(response.expires_in||3300)-90)*1000;
  engine=makeEngine();
  status('Google Drive 已授權（暫時性）。即將安全合併最新快照…','pending');
  updateButtons();
  runSync();
 }
 function connect(){
  if(!usable()){status('Google Drive 連線需要 HTTPS 網站。','error');return;}
  const clientId=$('driveClientId').value.trim();
  if(!identifierValid(clientId)){status('請輸入 Google Cloud OAuth「網頁應用程式」用戶端 ID（不是密鑰）。','error');return;}
  try{localStorage.setItem(CID,clientId);}catch{status('無法保存用戶端設定，請檢查瀏覽器儲存空間','error');return;}
  if(!window.google?.accounts?.oauth2?.initTokenClient){
   status('Google 登入元件尚未載入。請確認連線，並再按一次「連線 Google Drive」。','error');return;
  }
  if(!tokenClient||tokenClientId!==clientId){
   tokenClient=window.google.accounts.oauth2.initTokenClient({
    client_id:clientId,scope:SCOPE,include_granted_scopes:false,
    callback:setConnected,
    error_callback:e=>status('Google 登入視窗未完成：'+(e.type||'取消或遭到阻擋'),'error')
   });
   tokenClientId=clientId;
  }
  // Called synchronously from a click; no popup without an explicit user gesture.
  tokenClient.requestAccessToken({prompt:'consent'});
 }
 async function runSync(){
  if(busy||!hasToken()||!engine)return;
  busy=true;updateButtons();
  try{
   const result=await engine.sync(message=>status(message,'pending'));
   lastSync=Date.now();
   const when=new Date(lastSync).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
   status('雲端已完成本次同步｜'+when+'｜讀取 '+result.remoteSnapshots+
    ' 份快照'+(result.uploaded?'，新增安全快照':'，未產生新快照')+
    (result.conflicts?'；新增 '+result.conflicts+' 筆待確認衝突，可至完整備份頁處理':'')+
    '。請先重新開啟練習頁再編輯匯入的內容。','success');
   const link=$('driveFolderLink');
   if(link&&result.folderId&&/^[a-zA-Z0-9_-]+$/.test(result.folderId)){
    link.href='https://drive.google.com/drive/folders/'+result.folderId;link.hidden=false;
   }
  }catch(e){
   status('未完成雲端同步：'+e.message+'。請保留本機紀錄與 JSON 備份。','error');
   if(/授權|401|403/.test(e.message)){token='';expiresAt=0;engine=null;}
  }finally{busy=false;updateButtons();}
 }
 function disconnect(){
  if(!token)return;
  const old=token;token='';expiresAt=0;engine=null;
  // Best-effort token revocation; no credentials are written to localStorage.
  if(window.google?.accounts?.oauth2?.revoke)window.google.accounts.oauth2.revoke(old,()=>{});
  status('已斷開 Google Drive。本機學習紀錄和雲端既有快照均未刪除。','info');
  updateButtons();
 }
 function start(){
  if(!$('driveSyncPanel'))return;
  $('driveClientId').value=localStorage.getItem(CID)||'';
  $('driveAutoSync').checked=localStorage.getItem(AUTO)==='true';
  $('driveConnect').addEventListener('click',connect);
  $('driveSyncNow').addEventListener('click',runSync);
  $('driveDisconnect').addEventListener('click',disconnect);
  $('driveAutoSync').addEventListener('change',()=>{
   localStorage.setItem(AUTO,String($('driveAutoSync').checked));
   status($('driveAutoSync').checked?'已啟用：網頁開啟且授權有效時，每5分鐘檢查並同步。':
    '已關閉週期性同步；仍可手動按「立即同步」。','info');
  });
  const online=()=>{if(navigator.onLine===false)status('目前離線。本機練習仍可使用，連網後再同步。','pending');updateButtons();};
  window.addEventListener('online',online);window.addEventListener('offline',online);
  document.addEventListener('visibilitychange',()=>{
   if(!document.hidden&&hasToken()&&$('driveAutoSync').checked&&Date.now()-lastSync>INTERVAL)runSync();
  });
  window.setInterval(()=>{
   if(!hasToken()&&token){status('Google Drive 授權已到期，請按「連線 Google Drive」重新授權。','pending');updateButtons();}
   else if(!document.hidden&&navigator.onLine!==false&&hasToken()&&$('driveAutoSync').checked&&Date.now()-lastSync>=INTERVAL)runSync();
  },60000);
  if(!usable())status('此頁須使用 HTTPS 才能連線 Google Drive。','error');
  else status('尚未連線 Google Drive。本機練習與 JSON 備份不受影響。');
  updateButtons();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
