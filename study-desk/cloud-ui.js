/* Optional, explicit account sync. Never upload guest data without a user action.
 * Tokens live only in sessionStorage; the public project configuration is not a secret.
 */
import {IDBStore} from '../cloud-sync/idb.js';
import {same} from '../cloud-sync/core.js';
import {SupabaseTransport,validateConfig} from '../cloud-sync/supabase.js';

const CONFIG_KEY='psd-sync-public-config-v1';
const ENABLED_KEY='psd-study-desk-cloud-enabled-v1';
const $=id=>document.getElementById(id);
const count=s=>Object.keys(s.records||{}).filter(id=>!s.records[id].deleted).length;
function sessionKey(url) {return 'psd-sync-session:'+new URL(url).hostname;}
function message(error) {return error instanceof Error?error.message:String(error);}
function backup(data) {
 const file=new Blob([JSON.stringify({format:'psd-study-desk-v1',schemaVersion:1,exportedAt:new Date().toISOString(),state:data},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download='備考書桌-原裝置保留備份.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export class CloudDeskUI {
 constructor({getStore,getEngine,openAccount,openGuest,beforeSwitch,afterSync,report}) {
  Object.assign(this,{getStore,getEngine,openAccount,openGuest,beforeSwitch,afterSync,report});
  this.transport=null;this.config=null;this.active=false;this.running=null;this.delay=null;this.pendingEmail=null;
 }
 status(text,bad=false) {
  $('cloud-status').textContent=text;
  $('cloud-status').classList.toggle('error',bad);
 }
 controls() {
  $('cloud-login').hidden=this.active;
  $('cloud-connected').hidden=!this.active;
  $('cloud-copy-guest').disabled=!this.active;
  $('cloud-logout').disabled=!this.active;
  $('cloud-sync-now').disabled=!this.active;
  $('cloud-save-config').disabled=this.active;
  $('cloud-send-code').disabled=this.active;
  $('cloud-verify').disabled=this.active;
 }
 configFromForm() {
  return validateConfig({url:$('cloud-url').value.trim().replace(/\/+$/,''),key:$('cloud-key').value.trim()});
 }
 saveConfig() {
  const next=this.configFromForm();
  if(this.config && this.config.url!==next.url) {
   sessionStorage.removeItem(sessionKey(this.config.url));
  }
  localStorage.setItem(CONFIG_KEY,JSON.stringify(next));
  this.config=next;
  this.status('已保存公開連線設定。尚未登入，也不會上傳任何紀錄。');
  return next;
 }
 async init() {
  const safe=fn=>async()=>{
   try {await fn();}
   catch(e){this.status(message(e)+'；本機資料仍保留。',true);}
  };
  $('cloud-save-config').addEventListener('click',safe(()=>this.saveConfig()));
  $('cloud-send-code').addEventListener('click',safe(()=>this.sendCode()));
  $('cloud-verify').addEventListener('click',safe(()=>this.verify()));
  $('cloud-sync-now').addEventListener('click',safe(()=>this.syncNow(true)));
  $('cloud-copy-guest').addEventListener('click',safe(()=>this.copyGuest()));
  $('cloud-backup-guest').addEventListener('click',safe(()=>this.backupGuest()));
  $('cloud-logout').addEventListener('click',safe(()=>this.logout()));
  window.addEventListener('online',()=>this.scheduleSync(200));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.scheduleSync(300);});
  window.setInterval(()=>{if(this.active&&!document.hidden&&navigator.onLine)this.scheduleSync(0);},45000);
  try {
   const value=localStorage.getItem(CONFIG_KEY);
   if(value){
    const cfg=validateConfig(JSON.parse(value));
    this.config=cfg;$('cloud-url').value=cfg.url;$('cloud-key').value=cfg.key;
   }
  } catch {this.status('既有連線設定無效，請重新輸入；不會自動上傳。',true);}
  this.controls();
  // Historical connection settings alone do not opt users into cloud sync.
  if(localStorage.getItem(ENABLED_KEY)==='yes' && this.config) {
   try {
    const raw=sessionStorage.getItem(sessionKey(this.config.url)),session=raw&&JSON.parse(raw);
    if(session?.user?.id && session.access_token && session.refresh_token && Number.isFinite(session.expires_at)) {
     this.transport=this.makeTransport(session);
     await this.enterAccount();
    } else this.status('此分頁未登入；請重新以 Email 驗證碼登入。');
   } catch(e) {this.status('無法恢復登入：'+message(e)+'。請重新登入，本機資料不受影響。',true);}
  }
 }
 makeTransport(session=null) {
  return new SupabaseTransport(this.config,session,{onSession:s=>{
   const key=sessionKey(this.config.url);
   if(s)sessionStorage.setItem(key,JSON.stringify(s));
   else sessionStorage.removeItem(key);
  }});
 }
 async sendCode() {
  this.saveConfig();
  const email=$('cloud-email').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('請填寫有效的 Email');
  this.pendingEmail=email;
  const t=this.makeTransport();
  await t.sendCode(email);
  this.status('驗證碼已請求寄送至 '+email+'。請查看信箱，填寫收到的驗證碼。');
 }
 async verify() {
  if(!this.pendingEmail)throw Error('請先按「寄送驗證碼」');
  if(!$('cloud-consent').checked)throw Error('請先確認雲端保存與隱私提醒');
  this.saveConfig();
  const code=$('cloud-code').value.trim();
  if(!/^[0-9]{6,8}$/.test(code))throw Error('驗證碼格式不符');
  const t=this.makeTransport();
  await t.verify(this.pendingEmail,code);
  this.transport=t;
  // The user's confirmed OTP action is the explicit opt-in. Guest records are never auto-copied.
  localStorage.setItem(ENABLED_KEY,'yes');
  await this.enterAccount();
 }
 async enterAccount() {
  const id=this.transport?.session?.user?.id;
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('登入帳號識別碼不符');
  await this.beforeSwitch();
  await this.openAccount(new URL(this.config.url).hostname+'/'+id);
  this.active=true;
  this.controls();
  $('account').textContent='帳號書桌｜資料先存此裝置';
  this.status('已登入。正在讀取帳號資料；原本未登入的書桌保留在此裝置。');
  await this.syncNow(false);
 }
 scheduleSync(ms=1200) {
  if(!this.active || !this.transport)return;
  clearTimeout(this.delay);
  this.delay=setTimeout(()=>{
   this.delay=null;
   if(navigator.onLine)this.syncNow(false).catch(()=>{});
  },ms);
 }
 async syncNow(showError=false) {
  if(!this.active || !this.transport)throw Error('尚未登入雲端書桌');
  if(this.running)return this.running;
  this.status('正在同步，請勿關閉或清除網站資料…');
  $('cloud-sync-now').disabled=true;
  this.running=(async()=>{
   clearTimeout(this.delay);this.delay=null;
   await this.beforeSwitch();
   const engine=this.getEngine();
   const state=await engine.sync(this.transport);
   await this.afterSync();
   this.status('同步完成：'+count(state)+'筆紀錄；待上傳 '+Object.keys(state.outbox).length+'筆、待處理衝突 '+Object.keys(state.conflicts).length+'筆。');
  })().catch(async e=>{
   let pending='';try{const s=await this.getStore().read();pending='；待上傳 '+Object.keys(s.outbox).length+'筆';}catch{}
   this.status('尚未同步：'+message(e)+pending+'。資料已先存本機，連線恢復後可重試。',true);
   if(showError)this.report('雲端同步未完成：'+message(e)+'；本機作答仍保留。',true);
  }).finally(()=>{this.running=null;this.controls();});
  return this.running;
 }
 async guestState() {
  const guest=await IDBStore.open('guest');
  try {return await guest.read();}finally{guest.close();}
 }
 async backupGuest() {
  const state=await this.guestState();
  backup(state);
  this.status('已產生原裝置書桌備份，請確認檔案實際保存。');
 }
 async copyGuest() {
  if(!this.active)throw Error('請先登入雲端帳號');
  const source=await this.guestState(),account=await this.getStore().read();
  const incoming={};
  for(const [id,rec] of Object.entries(source.records)) {
   if(id==='settings/recommendation-audit')continue; // derived local display metadata
   const current=account.records[id];
   if(current&&current.deleted===rec.deleted&&same(current.value,rec.value))continue;
   const archived=Object.values(account.records).some(r=>r.value?.originalId===id && r.value?.record?.deleted===rec.deleted && same(r.value.record.value,rec.value));
   if(!archived)incoming[id]=rec;
  }
  const number=Object.keys(incoming).length;
  if(!number){this.status('原裝置書桌沒有新的可複製紀錄；既有資料與已封存版本均保留。');return;}
  if(!confirm('要將此裝置的 '+number+' 筆尚未複製的書桌紀錄加入目前帳號嗎？原資料不刪除；同 ID 差異只封存，不覆寫。建議先下載原裝置備份。'))return;
  await this.beforeSwitch();
  await this.getEngine().importRecords(incoming);
  await this.afterSync();
  this.status('已複製到帳號的本機資料區；原裝置紀錄保留。連線後會上傳，版本差異請至「我的筆記」查看。');
  this.scheduleSync(100);
 }
 async logout() {
  if(!this.active)return;
  if(this.running)await this.running;
  await this.beforeSwitch();
  clearTimeout(this.delay);this.delay=null;
  // Keep the account IndexedDB namespace and its unsent outbox on this device.
  try {await this.transport?.logout();}catch {sessionStorage.removeItem(sessionKey(this.config.url));}
  this.transport=null;this.active=false;
  await this.openGuest();
  this.controls();
  this.status('已登出。帳號的離線紀錄保留在本裝置；此時顯示未登入書桌。');
 }
}
export function setupCloudUI(options) {return new CloudDeskUI(options);}
