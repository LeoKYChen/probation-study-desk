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
 const user='11111111-1111-4111-8111-111111111111',records=new Map(),operations=new Map(),events=[];
 async function cloudRoute(route) {
  const request=route.request(),url=new URL(request.url()),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
  let result={},status=200;
  const body=request.postDataJSON()||{};
  if(url.pathname==='/auth/v1/otp')result={};
  else if(url.pathname==='/auth/v1/verify')result={user:{id:user,email:body.email},access_token:'integration-access',refresh_token:'integration-refresh',expires_in:3600};
  else if(url.pathname==='/rest/v1/rpc/psd_sync_push'){
   const op=body.p_operation;
   if(operations.has(op.opId))result=operations.get(op.opId);
   else {
    const prior=records.get(op.id);
    if((prior?.revision||0)!==op.baseRevision)result={status:'conflict',record:prior};
    else {
     const record={revision:(prior?.revision||0)+1,value:op.value,deleted:op.deleted};
     records.set(op.id,record);events.push({id:op.id,...record,sequence:events.length+1});
     result={status:'ok',record};
    }
    operations.set(op.opId,result);
   }
  }else if(url.pathname==='/rest/v1/rpc/psd_sync_pull'){
   const changes=events.filter(e=>e.sequence>body.p_after);
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
 async function login(p) {
  await p.locator('#cloud-settings').evaluate(el=>el.open=true);
  await p.locator('#cloud-url').fill('https://psdtest.supabase.co');
  await p.locator('#cloud-key').fill('sb_publishable_integration');
  await p.locator('#cloud-email').fill('study@example.test');
  await p.locator('#cloud-send-code').click();
  await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('驗證碼已請求'));
  await p.locator('#cloud-code').fill('123456');
  await p.locator('#cloud-consent').check();
  await p.locator('#cloud-verify').click();
  await p.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
 }
 try {
  const a=await device();
  assert.equal(await a.locator('#cloud-connected').isHidden(),true);
  await a.locator('#manual-picker').evaluate(el=>el.open=true);
  await a.locator('#subject').selectOption({label:'心理學'});
  await a.locator('#start-selected').click();
  await a.locator('#editor').waitFor({state:'visible'});
  await a.locator('#answer').fill('手機原本的答案，尚未移轉。');
  await a.locator('#save').click();
  await a.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('已存此裝置'));
  await login(a);
  assert.equal([...records.keys()].some(id=>id.startsWith('attempt/')),false,'logging in must not upload guest answers');
  assert.equal(await a.locator('#notes button').count(),0,'new account namespace must not silently inherit guest data');
  await a.locator('#cloud-copy-guest').click();
  await a.waitForFunction(()=>document.querySelector('#notes').textContent.includes('心理學'));
  await a.locator('#cloud-sync-now').click();
  await a.waitForFunction(()=>document.querySelector('#cloud-status').textContent.includes('同步完成'));
  assert([...records.entries()].some(([id,r])=>id.startsWith('attempt/')&&r.value.answer==='手機原本的答案，尚未移轉。'));
  const b=await device();await login(b);
  assert.match(await b.locator('#notes').textContent(),/心理學/);
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
  await a.locator('#notes button').first().click();
  await a.waitForFunction(()=>document.querySelector('#answer').value==='在另一部裝置接續修改。');
  assert.equal(await a.locator('#answer').inputValue(),'在另一部裝置接續修改。');
  await a.locator('#cloud-logout').click();
  await a.waitForFunction(()=>document.querySelector('#account').textContent==='此裝置的本機書桌');
  assert.match(await a.locator('#notes').textContent(),/心理學/);
  await a.locator('#notes button').first().click();
  await a.waitForFunction(()=>document.querySelector('#answer').value==='手機原本的答案，尚未移轉。');
  assert.equal(await a.locator('#answer').inputValue(),'手機原本的答案，尚未移轉。','original guest work remains unchanged');
  assert.deepEqual(pageErrors,[]);
  console.log('cloud-browser: opt-in, migration, two-device sync and logout verified with synthetic account');
 }finally{
  await Promise.all(contexts.map(c=>c.close().catch(()=>{})));
  await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
