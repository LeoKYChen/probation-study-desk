'use strict';
// Browser contract: opt-in, no guest upload, account A -> B, no real credentials.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{
  try {
   let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.json':'application/json'})[path.extname(file)]||'text/plain');
   res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
 const contexts=[],pageErrors=[];
 const user='11111111-1111-4111-8111-111111111111',otherUser='22222222-2222-4222-8222-222222222222';
 const primary={records:new Map(),operations:new Map(),events:[]},secondary={records:new Map(),operations:new Map(),events:[]};
 const {records,events}=primary;
 async function cloudRoute(route) {
  const request=route.request(),url=new URL(request.url()),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
  let result={},status=200;
  const body=request.postDataJSON()||{};
  const scope=request.headers()['authorization']==='Bearer other-access'?secondary:primary;
  const operations=scope.operations;
  if(request.headers()['authorization']==='Bearer broken-access' && url.pathname.startsWith('/rest/v1/rpc/')){
   await route.fulfill({status:404,headers,body:JSON.stringify({message:'RPC function missing in this test project'})});return;
  }
  if(url.pathname==='/auth/v1/otp')result={};
  else if(url.pathname==='/auth/v1/verify'){
   const alternate=body.email==='alternate@example.test',broken=body.email==='broken@example.test';
   result={user:{id:alternate?otherUser:user,email:body.email},access_token:broken?'broken-access':alternate?'other-access':'integration-access',refresh_token:'integration-refresh',expires_in:3600};
  } else if(url.pathname==='/auth/v1/logout')result={};
  else if(url.pathname==='/rest/v1/rpc/psd_sync_push'){
   const op=body.p_operation;
   if(operations.has(op.opId))result=operations.get(op.opId);
   else {
    const prior=scope.records.get(op.id);
    if((prior?.revision||0)!==op.baseRevision)result={status:'conflict',record:prior};
    else {
     const record={revision:(prior?.revision||0)+1,value:op.value,deleted:op.deleted};
     scope.records.set(op.id,record);scope.events.push({id:op.id,...record,sequence:scope.events.length+1});
     result={status:'ok',record};
    }
    operations.set(op.opId,result);
   }
  }else if(url.pathname==='/rest/v1/rpc/psd_sync_pull'){
   const changes=scope.events.filter(e=>e.sequence>body.p_after);
   result={changes:changes.slice(0,200),more:changes.length>200};
  }else {status=404;result={message:'unexpected stub route '+url.pathname};}
  await route.fulfill({status,headers,body:JSON.stringify(result)});
 }
 async function device() {
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);
  await context.route('https://psdtest.supabase.co/**',cloudRoute);
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(base+'/study-desk/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('本機書桌已開啟'));
  return page;
 }
 async function login(p,email='study@example.test') {
  await p.locator('#cloud-settings').evaluate(el=>el.open=true);
  await p.locator('#cloud-url').fill('https://psdtest.supabase.co');
  await p.locator('#cloud-key').fill('sb_publishable_integration');
  await p.locator('#cloud-email').fill(email);
  await p.locator('#cloud-send-code').click();
  await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('驗證碼已請求'));
  await p.locator('#cloud-code').fill('123456');
  await p.locator('#cloud-consent').check();
  await p.locator('#cloud-verify').click();
  await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
 }
 try {
  const a=await device();
  await a.evaluate(()=>{
   const core=globalThis.PSDLectureCore;
   const data=core.addCourse(core.empty(),'心理學','此裝置的函授課程',1,60,'local-lecture');
   localStorage.setItem(core.KEY,JSON.stringify(data));
  });
  assert.equal(await a.locator('#cloud-connected').isHidden(),true);
  await a.locator('#manual-picker').evaluate(el=>el.open=true);
  await a.locator('#subject').selectOption({label:'心理學'});
  await a.locator('#start-selected').click();
  await a.locator('#editor').waitFor({state:'visible'});
  await a.locator('#answer').fill('手機原本的答案，尚未移轉。');
  await a.locator('#save').click();
  await a.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('已存此裝置'));
  await login(a);
  assert.match(await a.locator('#lecture-status').textContent(),/此帳號尚無函授進度快照/,'shared localStorage lectures must not leak into account');
  assert.equal([...records.keys()].some(id=>id.startsWith('attempt/')),false,'logging in must not upload guest answers');
  await a.locator('#refresh-lectures').click();
  await a.waitForFunction(()=>document.querySelector('#lecture-status').textContent.includes('此帳號已保存的函授快照'));
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert(primary.records.has('settings/lecture-progress'),'shared lecture data requires explicit import');
  assert.equal(await a.locator('#notes button').count(),0,'new account namespace must not silently inherit guest data');
  await a.locator('#cloud-copy-guest').click();
  await a.waitForFunction(()=>document.querySelector('#notes').textContent.includes('心理學'));
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert([...records.entries()].some(([id,r])=>id.startsWith('attempt/')&&r.value.answer==='手機原本的答案，尚未移轉。'));
  // Keep the first device's editor open while a remote edit arrives.
  await a.locator('#notes button').first().click();
  await a.waitForFunction(()=>document.querySelector('#answer').value==='手機原本的答案，尚未移轉。');
  const b=await device();await login(b);
  assert.match(await b.locator('#notes').textContent(),/心理學/);
  assert.match(await b.locator('#lecture-status').textContent(),/此帳號已保存的函授快照/,'same account shares imported course snapshot');
  await b.locator('#notes button').first().click();
  await b.waitForFunction(()=>document.querySelector('#answer').value==='手機原本的答案，尚未移轉。');
  assert.equal(await b.locator('#answer').inputValue(),'手機原本的答案，尚未移轉。');
  await b.locator('#answer').fill('在另一部裝置接續修改。');
  await b.locator('#save').click();
  await b.locator('#cloud-sync-now').click();
  await b.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert.match(await a.locator('#notes').textContent(),/心理學/);
  await a.waitForFunction(()=>document.querySelector('#answer').value==='在另一部裝置接續修改。');
  assert.equal(await a.locator('#answer').inputValue(),'在另一部裝置接續修改。');
  // A partially written correction and unsaved study settings must survive an incoming remote update.
  await a.locator('[data-subject="心理學"] .enabled').check();
  await a.locator('#gap').fill('我正在整理的新缺口');
  await b.locator('#answer').fill('電腦第二次修改。');
  await b.locator('#save').click();
  await b.locator('#cloud-sync-now').click();
  await b.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert.equal(await a.locator('#gap').inputValue(),'我正在整理的新缺口','unsent editor notes must never be cleared');
  assert.equal(await a.locator('[data-subject="心理學"] .enabled').isChecked(),true,'unsaved preferences must not be reset by polling');
  assert.match(await a.locator('#status').textContent(),/未送出的文字/);
  await a.locator('#gap').clear();
  // Offline edits must stay queued until connectivity returns.
  await b.context().setOffline(true);
  await b.locator('#answer').fill('電腦離線補充答案。');
  await b.locator('#save').click();
  await b.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('離線中'));
  assert.notEqual([...records.values()].find(r=>r.value?.kind==='attempt')?.value.answer,'電腦離線補充答案。','offline edits are not sent');
  await b.context().setOffline(false);
  await b.locator('#cloud-sync-now').click();
  await b.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert([...records.values()].some(r=>r.value?.answer==='電腦離線補充答案。'),'queued edit reaches cloud after reconnect');
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#answer').value==='電腦離線補充答案。');
  // Two devices edit the same revision offline. Both versions must survive.
  await a.context().setOffline(true);
  await b.context().setOffline(true);
  await a.locator('#answer').fill('手機並行修改，版本甲。');
  await a.locator('#save').click();
  await b.locator('#answer').fill('電腦並行修改，版本乙。');
  await b.locator('#save').click();
  await a.context().setOffline(false);
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  await b.context().setOffline(false);
  await b.locator('#cloud-sync-now').click();
  await b.waitForFunction(()=>document.querySelector('#conflicts').textContent.includes('同一紀錄有兩個版本'));
  assert.match(await b.locator('#conflicts').textContent(),/手機並行修改，版本甲/);
  assert.match(await b.locator('#conflicts').textContent(),/電腦並行修改，版本乙/);
  await b.locator('#conflicts button').first().click();
  await b.waitForFunction(()=>document.querySelector('#status').textContent.includes('差異已處理'));
  await b.locator('#cloud-sync-now').click();
  await b.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert([...records.keys()].some(id=>id.startsWith('conflict/')&&id.endsWith('/meta')),'both variants are archived for audit');
  await a.locator('#cloud-logout').click();
  await a.waitForFunction(()=>document.querySelector('#account').textContent==='此裝置的本機書桌');
  assert.match(await a.locator('#notes').textContent(),/心理學/);
  await a.locator('#notes button').first().click();
  await a.waitForFunction(()=>document.querySelector('#answer').value==='手機原本的答案，尚未移轉。');
  assert.equal(await a.locator('#answer').inputValue(),'手機原本的答案，尚未移轉。','original guest work remains unchanged');
  // An OTP by itself must not switch out of guest when the project has no sync RPC.
  await a.locator('#cloud-email').fill('broken@example.test');
  await a.locator('#cloud-send-code').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('驗證碼已請求'));
  await a.locator('#cloud-code').fill('123456');
  await a.locator('#cloud-consent').check();
  await a.locator('#cloud-verify').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('雲端資料庫尚未準備好'));
  assert.equal(await a.locator('#account').textContent(),'此裝置的本機書桌');
  assert.match(await a.locator('#notes').textContent(),/心理學/,'failed backend preflight preserves guest work');
  await login(a,'alternate@example.test');
  assert.equal(await a.locator('#notes button').count(),0,'another account has no access to the first user answers');
  assert.match(await a.locator('#lecture-status').textContent(),/此帳號尚無函授進度快照/,'another account cannot see first users course snapshot or shared browser data');
  assert.equal(secondary.records.size,0,'account switch does not upload previous users records');
  await a.locator('#cloud-logout').click();
  await a.waitForFunction(()=>document.querySelector('#account').textContent==='此裝置的本機書桌');
  assert.deepEqual(pageErrors,[]);
  console.log('cloud-browser: opt-in, migration, two-device sync and logout verified with synthetic account');
 }finally{
  await Promise.all(contexts.map(c=>c.close().catch(()=>{})));
  await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
