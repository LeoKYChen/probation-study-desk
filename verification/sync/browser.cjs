'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
(async()=>{
 const {PGlite}=await import(process.env.PSD_SYNC_TEST_MODULES?pathToFileURL(process.env.PSD_SYNC_TEST_MODULES+'/@electric-sql/pglite/dist/index.js'):'@electric-sql/pglite');
 const pg=new PGlite();
 await pg.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;");
 await pg.exec(await fs.readFile(new URL('../../cloud-sync/schema.sql',pathToFileURL(__filename)),'utf8'));
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 await pg.query('insert into auth.users values($1),($2)',[alice,bob]);
 let databaseQueue=Promise.resolve();
 const browser=await (process.env.PSD_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...(process.env.PSD_BROWSER==='webkit'?{}:{executablePath:process.env.BROWSER_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})});
 const contexts=[];const errors=[];
 const staticRoot=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{try{let file=path.resolve(staticRoot,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(staticRoot+path.sep)){res.writeHead(403).end();return;}if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.json':'application/json'})[ext]||'text/plain');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function device(user){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});contexts.push(context);
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.addInitScript(({id})=>{
   if(!location.origin.startsWith('http://127.0.0.1:'))return;
   const config={url:'https://psdtest.supabase.co',key:'sb_publishable_synthetic'};
   localStorage.setItem('psd-sync-public-config-v1',JSON.stringify(config));
   sessionStorage.setItem('psd-sync-session:psdtest.supabase.co',JSON.stringify({user:{id,email:id+'@example.test'},access_token:id,refresh_token:'test-refresh',expires_at:9999999999}));
  },{id:user});
  await context.route('https://psdtest.supabase.co/**',async route=>{
   const request=route.request();
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'}});return;}
   const task=databaseQueue.then(async()=>{
    const id=request.headers().authorization?.replace('Bearer ','');
    if(![alice,bob].includes(id))return {status:401,body:'{"message":"unauthorized"}'};
    const data=request.postDataJSON(),path=new URL(request.url()).pathname;
    await pg.exec('set role authenticated');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    try {
     if(path.endsWith('psd_sync_push'))return {status:200,body:JSON.stringify((await pg.query('select public.psd_sync_push($1::jsonb) as r',[JSON.stringify(data.p_operation)])).rows[0].r)};
     if(path.endsWith('psd_sync_pull'))return {status:200,body:JSON.stringify((await pg.query('select public.psd_sync_pull($1) as r',[data.p_after])).rows[0].r)};
     if(path.endsWith('/logout'))return {status:200,body:'{}'};
     return {status:400,body:'{"message":"unexpected test route"}'};
    } catch(e){return {status:400,body:JSON.stringify({message:e.message})};}finally{await pg.exec('reset role');}
   });databaseQueue=task.then(()=>{});
   await route.fulfill({...await task,headers:{'Access-Control-Allow-Origin':base,'Content-Type':'application/json'}});
  });
  const page=await context.newPage();await page.goto(base+'/study-desk/');await page.waitForFunction(()=>document.querySelector('#account').textContent.includes('帳號書桌'));return {context,page};
 }
 async function sync(page){await page.locator('#cloud-settings').evaluate(el=>el.open=true);await page.locator('#sync-now').click();try{await page.waitForFunction(()=>/已完成這次雲端同步|同步遇到版本差異/.test(document.querySelector('#status').textContent),{},{timeout:10000});}catch(e){console.log('SYNC STATUS',await page.locator('#status').textContent(),errors);throw e;}}
 async function state(page){return page.evaluate(async()=>{const {IDBStore}=await import('../cloud-sync/idb.js');const db=await IDBStore.open('psdtest.supabase.co:11111111-1111-4111-8111-111111111111');try{return await db.read();}finally{db.close();}});}
 try {
 const a=await device(alice),b=await device(alice),other=await device(bob),p=a.page;
 await p.locator('#today > details').evaluate(el=>el.open=true);
 await p.locator('#subject').selectOption({label:'心理學'});
 await p.locator('#start-selected').click();await p.locator('#answer').fill('我原先將信度與效度混淆。');await p.locator('#submit-answer').click();
 await p.waitForFunction(()=>document.querySelector('#milestones').textContent.includes('已作答：✓'));
 await sync(p);await sync(b.page);
 await b.page.locator('#notes button').first().click();await b.page.waitForFunction(()=>document.querySelector('#answer').value==='我原先將信度與效度混淆。');assert.equal(await b.page.locator('#answer').inputValue(),'我原先將信度與效度混淆。');
 await b.page.locator('#checked').click();
 await b.page.locator('#editor > details').first().evaluate(el=>el.open=true);
 await b.page.locator('#feedback-source').fill('AI來源甲');await b.page.locator('#feedback-text').fill('信度是測量一致性。');await b.page.locator('#add-feedback').click();
 await b.page.locator('#feedback-source').fill('AI來源乙');await b.page.locator('#feedback-text').fill('效度涉及分數解釋是否有證據支持。');await b.page.locator('#add-feedback').click();
 await b.page.locator('#gap').fill('區分信度與效度');await b.page.locator('#correction').fill('一致不代表所作的解釋有效。');await b.page.locator('#correct').click();await b.page.waitForFunction(()=>document.querySelector('#milestones').textContent.includes('已訂正：✓'));
 await sync(b.page);await sync(p);await p.locator('#notes button').first().click();
 await p.waitForFunction(()=>document.querySelectorAll('#feedback-list .feedback').length===2);assert.equal(await p.locator('#feedback-list .feedback').count(),2);assert.match(await p.locator('#milestones').textContent(),/已訂正：✓/);
 assert.equal((await state(p)).records[Object.keys((await state(p)).records).find(id=>id.startsWith('attempt/'))].value.recalls.length,0,'correction does not automatically become recall mastery');
 // Offline data survives a real browser reload, with no acknowledgement from API.
 await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload();await p.waitForFunction(()=>document.querySelector('#account').textContent.includes('帳號書桌'));await p.locator('#notes button').first().click();await a.context.setOffline(true);await p.locator('#answer').fill('手機離線修改');await p.locator('#save').click();await p.waitForFunction(()=>!document.querySelector('#save').disabled);await p.reload();await p.waitForFunction(()=>document.querySelector('#account').textContent.includes('帳號書桌'));await p.locator('#notes button').first().click();await p.waitForFunction(()=>document.querySelector('#answer').value==='手機離線修改');assert.equal(await p.locator('#answer').inputValue(),'手機離線修改');
 await b.page.locator('#answer').fill('電腦同時修改');await b.page.locator('#save').click();await sync(b.page);
 await a.context.setOffline(false);await sync(p);assert((await state(p)).conflicts && Object.keys((await state(p)).conflicts).length===1);
 await p.locator('#conflicts button').first().click();await sync(p);await sync(b.page);
 const s=await state(p);assert(Object.keys(s.records).some(k=>k.startsWith('conflict/')));
 await sync(other.page);assert.equal(await other.page.locator('#notes button').count(),0,'another account cannot see Alice records');
 // IndexedDB transactions serialize across two page instances; abort leaves state intact.
 await p.evaluate(async()=>{const {IDBStore}=await import('../cloud-sync/idb.js');const store=await IDBStore.open('transaction-test');await store.update(s=>s.cursor=7);try{await store.update(s=>{s.cursor=99;throw Error('abort');});}catch{}if((await store.read()).cursor!==7)throw Error('aborted write was applied');store.close();const first=await IDBStore.open('parallel-test'),second=await IDBStore.open('parallel-test');await Promise.all(Array.from({length:30},(_,i)=>(i%2?first:second).update(s=>{s.cursor++;})));if((await first.read()).cursor!==30)throw Error('parallel transaction lost an update');first.close();second.close();});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile has no horizontal overflow');
 // Export includes both AI feedback, original answer and correction.
 await p.locator('#notes button').first().click();await p.locator('#editor').waitFor({state:'visible'});const dl=p.waitForEvent('download');await p.locator('#export-note').click();const download=await dl;const md=await fs.readFile(await download.path(),'utf8');assert.match(md,/AI來源甲/);assert.match(md,/AI來源乙/);assert.match(md,/一致不代表/);assert.match(md,/我原先將信度與效度混淆/);
 await p.evaluate(()=>scrollTo(0,0));if(process.env.PSD_SCREENSHOT)await p.screenshot({path:process.env.PSD_SCREENSHOT});assert.deepEqual(errors,[]);
 console.log('PASS '+(process.env.PSD_BROWSER||'chromium')+': 3 isolated browser contexts → real PostgreSQL RPC; multi-AI, original answers, corrections, offline reload, concurrent conflict, account isolation, IDB abort, Markdown export, mobile width. Auth and HTTP routes are synthetic, not production Supabase.');
 }finally{for(const c of contexts)await c.close();await browser.close();await pg.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
