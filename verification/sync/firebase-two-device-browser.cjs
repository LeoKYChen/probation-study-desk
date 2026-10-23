'use strict';
// Two browser contexts with a synthetic cloud transport; no real OAuth / Firebase.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
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
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
 const contexts=[],errors=[],outside=[];
 const cloud={modules:new Map(),desk:new Map()},trace=[];
 const mockModule=[
  'export function validateFirebaseConfig(x) {',
  " if(!x || !x.apiKey || !x.authDomain || !x.projectId || !x.appId)throw Error('設定格式不符');",
  ' return x;',
  '}',
  'export async function openFirebase(config) {',
  ' return {',
  '  projectId:config.projectId,',
  "  user(){return {uid:'synthetic-user-id',email:'study@example.test'}},",
  "  async login(){return {uid:'synthetic-user-id',email:'study@example.test'}},",
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
  const last=values.get(data.key),rev=last?.revision||0;
  if(rev!==data.expected)throw Error('另一裝置已更新');
  values.set(data.key,{revision:rev+1,raw:data.raw});
  trace.push({type:data.type,key:data.key,revision:rev+1});
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
  await preview(b);await apply(b);
  await preview(a);await apply(a);
  assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('jj-read'))),['手機初稿','電腦新增']);
  assert.equal(await readDesk(a),'電腦完成的訂正');
  const writesBeforeReload=trace.length;
  await a.reload();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('study@example.test'));
  assert.equal(trace.length,writesBeforeReload,'restoring a prior login must not upload without explicit consent');
  assert.equal(await readDesk(a),'電腦完成的訂正','reloading an opted-in account cannot erase local answer');
  await a.locator('#firebase-signout').click();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('未登入'));
  assert.equal(await a.evaluate(()=>localStorage.getItem('psd-firebase-restore-login-v1')),null);
  const previousWrites=trace.length;
  await a.reload();
  await a.waitForFunction(()=>document.querySelector('#firebase-user').textContent.includes('未登入'));
  assert.equal(trace.length,previousWrites,'signing out must disable account restoration and automatic uploads');
  assert.equal(await readDesk(a),'電腦完成的訂正','logout must not erase guest study desk');
  assert.equal(outside.length,0,'synthetic transport never contacts real Firebase');
  assert.deepEqual(errors,[]);
  console.log('PASS Firebase whole-site UI: consent, both JSON backups, 15 modules + IndexedDB, two devices');
 }finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
