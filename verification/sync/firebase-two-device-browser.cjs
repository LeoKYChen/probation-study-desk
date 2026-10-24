'use strict';
// Two browser contexts with a synthetic cloud transport; no real OAuth / Firebase.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{
  try{
   let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
   res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'text/plain');
   res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const engine=process.env.PSD_BROWSER_ENGINE==='webkit'?webkit:chromium;
 const options={headless:true};
 if(process.env.BROWSER_EXECUTABLE)options.executablePath=process.env.BROWSER_EXECUTABLE;
 if(engine===chromium)options.args=['--no-sandbox','--disable-dev-shm-usage'];
 const browser=await engine.launch(options);
 const contexts=[],errors=[],outside=[];
 const cloud={modules:new Map(),desk:new Map()},trace=[];
 let failDeskWriteOnce=false,afterWriteOnce=null;
 const mockModule=[
  'export function validateFirebaseConfig(x) {',
  " if(!x || !x.apiKey || !x.authDomain || !x.projectId || !x.appId)throw Error('設定格式不符');",
  ' return x;',
  '}',
  'export async function openFirebase(config) {',
  ' return {',
  '  projectId:config.projectId,',
  "  user(){return {uid:'synthetic-user-id',email:'study@example.test'}},",
  "  async login(){",
  "   if(navigator.userActivation && !navigator.userActivation.isActive)",
  "    throw Error('登入視窗缺少直接點擊權限');",
  "   return {uid:'synthetic-user-id',email:'study@example.test'};",
  "  },",
  '  async signOut(){},',
  "  adapter(type='modules'){return {",
  "   async readAll(){return globalThis.__firebaseSynthetic({op:'read',type})},",
  "   async compareAndSet(key,raw,expected){return globalThis.__firebaseSynthetic({op:'write',type,key,raw,expected})}",
  '  }}',
  ' };',
  '}'
 ].join('\n');
 async function handle(_source,data){
  if(!['modules','desk'].includes(data.type))throw Error('unauthorized synthetic collection');
  const values=cloud[data.type];
  if(data.op==='read')return Object.fromEntries(values);
  if(data.op!=='write')throw Error('unsupported test operation');
  if(data.type==='desk'&&failDeskWriteOnce){failDeskWriteOnce=false;throw Error('模擬書桌網路中斷');}
  const last=values.get(data.key),rev=last?.revision||0;
  if(rev!==data.expected)throw Error('另一裝置已更新');
  values.set(data.key,{revision:rev+1,raw:data.raw});
  trace.push({type:data.type,key:data.key,revision:rev+1});
  if(afterWriteOnce){const action=afterWriteOnce;afterWriteOnce=null;await action();}
  return rev+1;
 }
 async function device(){
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});contexts.push(context);
  await context.exposeBinding('__firebaseSynthetic',handle);
  // Guard unknown external requests but fall through to module mock for local URLs.
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(!url.startsWith(base+'/')){outside.push(url);return route.abort();}
   return route.fallback();
  });
  await context.route('**/cloud-sync/firebase-client.mjs',route=>route.fulfill({status:200,contentType:'text/javascript',body:mockModule}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/backup/');
  await page.locator('#firebase-project').fill('synthetic-project');
  await page.locator('#firebase-api').fill('AIzaFakePublicFirebaseBrowserTestOnly000000');
  await page.locator('#firebase-auth-domain').fill('synthetic-project.firebaseapp.com');
  await page.locator('#firebase-app-id').fill('1:123456:web:abcdef');
  return page;
 }
 async function writeDesk(page,answer){
  await page.evaluate(async text=>{
   const {IDBStore}=await import('/cloud-sync/idb.js');
   const guest=await IDBStore.open('guest');
   try{await guest.update(state=>{
    state.records['attempt/study-test']={value:{kind:'attempt',answer:text},revision:0,deleted:false};
   });}finally{guest.close()}
  },answer);
 }
 async function readDesk(page){
  return page.evaluate(async()=>{
   const {IDBStore}=await import('/cloud-sync/idb.js');
   const guest=await IDBStore.open('guest');
   try{return (await guest.read()).records['attempt/study-test']?.value.answer;}
   finally{guest.close()}
  });
 }
 async function download(page,id){
  const event=page.waitForEvent('download');await page.locator(id).click();
  const file=await event;const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));
  assert(data.schemaVersion===1,'actual JSON backup must be created');
  return data;
 }
 async function connect(page){
  assert.equal(await page.locator('#firebase-login').isDisabled(),true,'popup must be disabled until SDK preparation');
  const writesBeforePrepare=trace.length;
  await page.locator('#firebase-prepare').click();
  await page.locator('#firebase-login').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#firebase-login').disabled);
  assert.equal(trace.length,writesBeforePrepare,'SDK preparation must not upload learning records');
  assert.equal(await page.locator('#firebase-user').textContent(),'未登入','SDK preparation does not sign in');
  await page.locator('#firebase-login').click();
  await page.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('study@example.test'));
 }
 async function preview(page){
  await page.locator('#firebase-preview-btn').click();
  await page.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('差異預覽完成'));
 }
 async function apply(page){
  const saved=await download(page,'#firebase-backup');
  const guest=await download(page,'#firebase-backup-desk');
  assert.equal(saved.format,'psd-unified-learning-backup');
  assert.equal(guest.format,'psd-study-desk-v1');
  await page.locator('#firebase-confirm').check();
  await page.locator('#firebase-apply').click();
  await page.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('本次同步完成'));
 }
 try{
  const a=await device();
  await a.evaluate(()=>{localStorage.setItem('jj-read',JSON.stringify(['手機初稿']));localStorage.setItem('unrelated-local-token','private');});
  await writeDesk(a,'手機第一版作答');
  await connect(a);await preview(a);
  assert.equal(trace.length,0,'preview must not upload data');
  await apply(a);
  await a.waitForFunction(()=>document.querySelector('#firebase-pending').textContent.includes('沒有相對於上次成功同步的本機變更'));
  assert(cloud.modules.has('jj-read'));
  assert(cloud.desk.has('attempt/study-test'));
  assert(!cloud.modules.has('unrelated-local-token'),'unknown keys must never upload');
  const b=await device();
  await connect(b);await preview(b);
  assert.equal(await b.evaluate(()=>localStorage.getItem('jj-read')),null,'first login does not auto-copy remote before approval');
  assert.equal(await readDesk(b),undefined);
  await apply(b);
  assert.deepEqual(await b.evaluate(()=>JSON.parse(localStorage.getItem('jj-read'))),['手機初稿']);
  assert.equal(await readDesk(b),'手機第一版作答');
  await b.evaluate(()=>localStorage.setItem('jj-read',JSON.stringify(['手機初稿','電腦新增'])));
  await writeDesk(b,'電腦完成的訂正');
  const journalBefore=await b.evaluate(()=>{
   window.PSDLocalJournal.note('jj-read');
   window.PSDLocalJournal.note('desk');
   return JSON.stringify(window.PSDLocalJournal.snapshot());
  });
  assert(journalBefore.includes('jj-read')&&journalBefore.includes('desk'),'sync journal contains only module identifiers');
  assert(!journalBefore.includes('電腦完成的訂正'),'sync journal never contains answer text');
  await preview(b);await apply(b);
  const journalAfter=await b.evaluate(()=>{
   return window.PSDLocalJournal.snapshot().entries;
  });
  assert.equal(Object.keys(journalAfter).length,0,'successful sync acknowledges queued metadata');
  await preview(a);await apply(a);
  assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('jj-read'))),['手機初稿','電腦新增']);
  assert.equal(await readDesk(a),'電腦完成的訂正');

  // Simulate a partial commit: module upload succeeds while desk upload
  // fails. The UI must discard stale approvals and force a fresh preview.
  await a.evaluate(()=>localStorage.setItem('jj-read',JSON.stringify(['手機初稿','電腦新增','中斷前新閱讀'])));
  await writeDesk(a,'網路中斷前的新訂正');
  await a.evaluate(()=>{window.PSDLocalJournal.note('jj-read');window.PSDLocalJournal.note('desk');});
  const traceBeforeScan=trace.length;
  await a.evaluate(()=>window.dispatchEvent(new Event('online')));
  await a.waitForFunction(()=>document.querySelector('#firebase-pending').textContent.includes('此裝置有'));
  assert.equal(trace.length,traceBeforeScan,'background local change detection must not call Firestore');
  await preview(a);
  await download(a,'#firebase-backup');
  await download(a,'#firebase-backup-desk');
  await a.locator('#firebase-confirm').check();
  failDeskWriteOnce=true;
  await a.locator('#firebase-apply').click();
  await a.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('模擬書桌網路中斷'));
  assert.equal(await a.locator('#firebase-apply').isDisabled(),true,'partial sync invalidates the prior approval');
  assert.equal(await a.locator('#firebase-preview').locator('li').count(),0,'old preview is cleared after partial commit');
  const pendingAfterFailure=await a.evaluate(()=>window.PSDLocalJournal.snapshot().entries);
  assert('desk' in pendingAfterFailure,'failed cloud write does not clear pending offline work');
  assert('jj-read' in pendingAfterFailure,'partial success does not prematurely acknowledge whole-site queue');
  assert.equal(await readDesk(a),'網路中斷前的新訂正','local answer remains even if cloud desk write fails');
  assert.equal(JSON.parse(cloud.modules.get('jj-read').raw).includes('中斷前新閱讀'),true);
  await preview(a);await apply(a);
  assert.equal(Object.keys(await a.evaluate(()=>window.PSDLocalJournal.snapshot().entries)).length,0,'retry acknowledges metadata after both stages succeed');
  await a.evaluate(()=>window.dispatchEvent(new Event('online')));
  await a.waitForFunction(()=>document.querySelector('#firebase-pending').textContent.includes('沒有相對於上次成功同步的本機變更'));
  assert.equal(JSON.parse(cloud.modules.get('jj-read').raw).includes('中斷前新閱讀'),true);
  assert.equal(JSON.parse(cloud.desk.get('attempt/study-test').raw).value.answer,'網路中斷前的新訂正');
  const writesBeforeReload=trace.length;
  await a.reload();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('study@example.test'));
  assert.equal(trace.length,writesBeforeReload,'restoring a prior login must not upload without explicit consent');
  assert.equal(await readDesk(a),'網路中斷前的新訂正','reloading an opted-in account cannot erase local answer');
  await a.locator('#firebase-signout').click();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('未登入'));
  assert.equal(await a.evaluate(()=>localStorage.getItem('psd-firebase-restore-login-v1')),null);
  const previousWrites=trace.length;
  await a.reload();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('未登入'));
  assert.equal(trace.length,previousWrites,'signing out must disable account restoration and automatic uploads');
  assert.equal(await readDesk(a),'網路中斷前的新訂正','logout must not erase guest study desk');

  // Clearing only this site's local learning records does not delete already
  // uploaded Firestore documents. A later login MUST NOT silently resurrect
  // those answers without a second explicit, separately worded opt-in.
  const clearBackup=await download(a,'#clearBackupBefore');
  assert.equal(clearBackup.format,'psd-unified-learning-backup');
  await a.locator('#clearBackupConfirmed').check();
  await a.locator('#clearTabsConfirmed').check();
  await a.locator('#clearTyped').fill('清除');
  await a.locator('#clearLearning').click();
  await a.waitForFunction(()=>localStorage.getItem('jj-read')===null);
  const mark=await a.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1'));
  assert(mark&&mark.includes('"schema":1'),'clear intent must survive a page reload');
  const beforeGuard=trace.length;
  await a.reload();
  assert.equal(await a.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),mark);
  await connect(a);
  await a.locator('#firebase-preview-btn').click();
  await a.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('曾清除學習紀錄'));
  assert.equal(trace.length,beforeGuard,'blocked preview never writes to the cloud');
  assert.equal(await a.evaluate(()=>localStorage.getItem('jj-read')),null,'old cloud answer was not silently restored');
  assert.equal(await a.locator('#firebase-cleared-warning').isVisible(),true);
  await a.locator('#firebase-restore-cleared').check();
  await preview(a);
  await apply(a);
  assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('jj-read'))),['手機初稿','電腦新增','中斷前新閱讀']);
  assert.equal(await a.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),null,'guard only cleared after explicit successful restoration');
  assert.equal(trace.length,beforeGuard,'restoring previously cloud-stored data needs no extra upload');

  // The study desk has its own independent IndexedDB clearing operation.
  // It must set the SAME persistent warning used by the backup centre.
  // Use a new, isolated browser store: the minimal transport-only attempt
  // payload used earlier is not a full valid study-desk domain record.
  const c=await device();
  await c.goto(base+'/study-desk/');
  await c.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('本機書桌已開啟'),null,{timeout:15000})
   .catch(async e=>{throw Error('無法啟動獨立備考書桌：'+(await c.locator('#status').textContent())+'；'+errors.slice(-3).join(' / '),{cause:e})});
  await c.locator('#clear-learning').click();
  await c.locator('#clear-confirm-text').fill('清除');
  await c.locator('#clear-confirm').click();
  await c.waitForFunction(()=>document.querySelector('#status').textContent.includes('已清除本機備考書桌'));
  const deskClearGuard=await c.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1'));
  assert(deskClearGuard,'desk clear must leave a durable cloud-restoration warning');
  const cloudBeforeDeskRestore=trace.length;
  await c.goto(base+'/backup/');
  // This independent device has not signed in before; the public Web config
  // was only in the earlier form and must be re-entered after navigation.
  await c.locator('#firebase-project').fill('synthetic-project');
  await c.locator('#firebase-api').fill('AIzaFakePublicFirebaseBrowserTestOnly000000');
  await c.locator('#firebase-auth-domain').fill('synthetic-project.firebaseapp.com');
  await c.locator('#firebase-app-id').fill('1:123456:web:abcdef');
  await connect(c);
  await c.locator('#firebase-preview-btn').click();
  await c.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('曾清除學習紀錄'));
  assert.equal(trace.length,cloudBeforeDeskRestore,'desk clearing cannot trigger hidden cloud upload or restore');
  assert.equal(await c.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),deskClearGuard);
  // Restoration consent belongs to one clear token, not every later clear.
  await c.locator('#firebase-restore-cleared').check();
  await preview(c);
  await c.evaluate(()=>window.PSDLocalClearGuard.mark(localStorage));
  await c.locator('#firebase-preview-btn').click();
  await c.waitForFunction(()=>!document.querySelector('#firebase-preview-btn').disabled);
  assert.match(await c.locator('#firebase-status').textContent(),/曾清除學習紀錄/,'a new same-tab clear requires fresh consent');
  assert.equal(await c.locator('#firebase-restore-cleared').isChecked(),false,'old consent checkbox is reset');
  assert.equal(await c.locator('#firebase-apply').isDisabled(),true);
  assert.equal(await c.evaluate(()=>localStorage.getItem('jj-read')),null);
  assert.equal(await readDesk(c),undefined);
  await c.locator('#firebase-restore-cleared').check();
  await preview(c);
  const secondClearTab=await c.context().newPage();
  await secondClearTab.goto(base+'/backup/');
  await secondClearTab.evaluate(()=>window.PSDLocalClearGuard.mark(localStorage));
  await c.waitForFunction(()=>document.querySelector('#firebase-apply').disabled);
  assert.equal(await c.locator('#firebase-restore-cleared').isChecked(),false,'a cross-tab clear also revokes the prior consent');
  await c.locator('#firebase-preview-btn').click();
  await c.waitForFunction(()=>!document.querySelector('#firebase-preview-btn').disabled);
  assert.match(await c.locator('#firebase-status').textContent(),/曾清除學習紀錄/);
  assert.equal(trace.length,cloudBeforeDeskRestore,'revoked consent never uploads any data');
  // Revoking consent while a request is pending must stop later restoration.
  await c.evaluate(()=>localStorage.setItem('jj-font','18'));
  await c.locator('#firebase-restore-cleared').check();
  await preview(c);
  await download(c,'#firebase-backup');await download(c,'#firebase-backup-desk');
  await c.locator('#firebase-confirm').check();
  const beforeRevoke=trace.length;
  const consentMarker=await c.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1'));
  afterWriteOnce=async()=>{await c.locator('#firebase-restore-cleared').uncheck();};
  await c.locator('#firebase-apply').click();
  await c.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('同意已撤回'));
  assert.equal(trace.length,beforeRevoke+1,'revocation stops later writes after the in-flight response');
  assert.equal(await c.evaluate(()=>localStorage.getItem('jj-read')),null,'revocation blocks module restoration');
  assert.equal(await readDesk(c),undefined,'revocation blocks desk restoration');
  assert.equal(await c.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),consentMarker,'revocation preserves the clear warning');
  assert.equal(await c.locator('#firebase-apply').isDisabled(),true);
  await c.locator('#firebase-restore-cleared').check();
  await preview(c);await apply(c);
  assert.equal(await c.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),null,'fresh consent and both backups allow explicit restoration');
  // Clear from a real second tab while the first tab awaits a CAS response.
  // Empty-before/empty-after records defeat a snapshot-only stale check.
  const d=await device();
  await d.evaluate(()=>localStorage.setItem('jj-bookmarks','["synthetic-race-upload"]'));
  await connect(d);await preview(d);
  const clearingTab=await d.context().newPage();
  await clearingTab.goto(base+'/backup/');
  await download(d,'#firebase-backup');await download(d,'#firebase-backup-desk');
  await d.locator('#firebase-confirm').check();
  const beforeRace=trace.length;
  let raceMarker;
  afterWriteOnce=async()=>{
   raceMarker=await clearingTab.evaluate(()=>{
    const marker=window.PSDLocalClearGuard.mark(localStorage);
    for(const {key} of window.PSDUnifiedBackup.modules)localStorage.removeItem(key);
    return marker;
   });
  };
  await d.locator('#firebase-apply').click();
  await d.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('同步期間本機清除紀錄'));
  assert.equal(trace.length,beforeRace+1,'only the already in-flight CAS may finish');
  assert.equal(await d.evaluate(()=>localStorage.getItem('jj-read')),null,'no old module answers restored after concurrent clear');
  assert.equal(await readDesk(d),undefined,'no desk download starts after concurrent clear');
  assert.equal(await d.evaluate(()=>localStorage.getItem('psd-firebase-local-clear-guard-v1')),raceMarker,'new warning survives failed sync');
  assert.equal(await d.locator('#firebase-apply').isDisabled(),true,'stale approval discarded');
  await d.locator('#firebase-preview-btn').click();
  await d.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('曾清除學習紀錄'));
  // A desk edit after preview must abort the WHOLE sync before modules upload.
  const e=await device();
  await e.evaluate(()=>localStorage.setItem('jj-font','20'));
  await connect(e);await preview(e);
  await download(e,'#firebase-backup');await download(e,'#firebase-backup-desk');
  await writeDesk(e,'synthetic-draft-after-backup');
  const beforeStaleDesk=trace.length;
  await e.locator('#firebase-confirm').check();
  await e.locator('#firebase-apply').click();
  await e.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('書桌紀錄在預覽後已變更'));
  assert.equal(trace.length,beforeStaleDesk,'stale desk preview must prevent all module uploads');
  assert.equal(await e.evaluate(()=>localStorage.getItem('jj-read')),null,'stale desk prevents module downloads too');
  assert.equal(await e.evaluate(()=>localStorage.getItem('psd-firebase-local-data-bound-v1')),null,'a rejected preflight must not bind a new device');
  assert.equal(await readDesk(e),'synthetic-draft-after-backup','the newer desk draft survives');
  assert.equal(await e.locator('#firebase-apply').isDisabled(),true);
  await preview(e);
  await download(e,'#firebase-backup');await download(e,'#firebase-backup-desk');
  await e.locator('#firebase-confirm').check();
  await e.evaluate(async()=>{
   const {IDBStore}=await import('/cloud-sync/idb.js');
   // Deterministically edit localStorage during the asynchronous desk preflight.
   document.querySelector('#firebase-apply').addEventListener('click',()=>{
    const original=IDBStore.prototype.read;
    IDBStore.prototype.read=async function(){
     IDBStore.prototype.read=original;
     const state=await original.call(this);
     localStorage.setItem('jj-font','22');
     return state;
    };
   },{once:true,capture:true});
  });
  await e.locator('#firebase-apply').click();
  await e.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('本機紀錄在預覽後已修改'));
  assert.equal(trace.length,beforeStaleDesk,'module edits during desk preflight also stop every upload');
  assert.equal(await e.evaluate(()=>localStorage.getItem('jj-read')),null);
  assert.equal(await e.evaluate(()=>localStorage.getItem('jj-font')),'22','new module edits survive');
  assert.equal(await readDesk(e),'synthetic-draft-after-backup');
  await preview(e);await apply(e);
  const afterRetry=await e.evaluate(async()=>{
   const {IDBStore}=await import('/cloud-sync/idb.js');const store=await IDBStore.open('guest');
   try{return JSON.stringify(await store.read());}finally{store.close();}
  });
  assert(afterRetry.includes('synthetic-draft-after-backup'),'fresh preview preserves the newer draft in the conflict archive');
  assert.equal(outside.length,0,'synthetic transport never contacts real Firebase');
  assert.deepEqual(errors,[]);
  console.log('PASS Firebase whole-site UI: consent, both JSON backups, 15 modules + IndexedDB, two devices');
 }finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
