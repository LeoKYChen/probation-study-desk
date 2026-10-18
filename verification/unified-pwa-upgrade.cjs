'use strict';
// Actual old worker + actual old snapshot download, with synthetic records only.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const playwright=require('playwright'),engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium';
assert(['chromium','webkit'].includes(engine));
const root=path.resolve(process.argv[2]||'.');
const fixture=path.join(__dirname,'fixtures/legacy-main-sw.js');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/MAIN_MIRROR_BYTE_AUDIT_20261017.json')));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),audit.files.find(row=>row.file==='sw.js').expected,'fixture is the exact main baseline worker');
let upgraded=false,failRoot=false;
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
 if(pathname.startsWith('/probation-study-desk/'))pathname=pathname.slice('/probation-study-desk'.length);
 if(pathname.endsWith('/'))pathname+='index.html';
 if(failRoot&&pathname==='/index.html'){res.writeHead(503).end('simulated homepage outage');return;}
 let file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!upgraded&&pathname==='/index.html')file=path.join(root,'legacy-home.html');
 if(!upgraded&&pathname==='/sw.js')file=fixture;
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let context;const profiles=[];
 try{
  for(const prefix of ['/','/probation-study-desk/']){
   upgraded=false;failRoot=false;const base='http://127.0.0.1:'+server.address().port+prefix;
   const profile=fs.mkdtempSync(path.join(os.tmpdir(),'probation-pwa-upgrade-'));profiles.push(profile);
   context=await playwright[engine].launchPersistentContext(profile,{headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei'});
   const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(15000);
   await page.goto(base);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   const before=await page.evaluate(async()=>{
    localStorage.setItem('probation-study-desk-v24','{"old-question":{"answer":"舊考古題答案","done":true}}');
    localStorage.setItem('probation-study30-v251:v1',JSON.stringify({version:1,sessions:{'2026-01-01':{date:'2026-01-01',questionId:'legacy-sentinel',notes:['舊專業練習答案'],extra:'保留'}}}));
    localStorage.setItem('psd-home-exam-countdown-v1',JSON.stringify({date:'2027-08-14',name:'我的考試',style:'large',accent:'mint'}));
    localStorage.setItem('another-module-record','不得改動');
    const cache=await caches.open('another-module-cache-sentinel');await cache.put(new URL('cache-sentinel',location.href),new Response('其他模組快取'));
    return Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]));
   });
   const snapshot=await page.evaluate(()=>new Promise(async(resolve,reject)=>{
    const registration=await navigator.serviceWorker.ready,channel=new MessageChannel();
    const timer=setTimeout(()=>reject(Error('legacy snapshot download timed out')),60000);
    channel.port1.onmessage=({data})=>{if(data.type==='progress')return;clearTimeout(timer);channel.port1.close();if(data.type==='error')reject(Error(data.message));else resolve(data.state);};
    registration.active.postMessage({type:'download'},[channel.port2]);
   }));
   assert(snapshot.count>=75,'actual baseline manifest was downloaded');
   const oldResponse=await page.reload();assert.equal(await page.locator('a.tile').count(),0,'old snapshot is installed');
   const cachedHome=await oldResponse.text();assert.equal(cachedHome,fs.readFileSync(path.join(root,'legacy-home.html'),'utf8'),'worker serves exact baseline home');
   const cachesBefore=await page.evaluate(()=>caches.keys());

   // WebKit network emulation cannot reliably reload a worker-controlled page.
   // Its online upgrade and exact stored cache contents are tested below.
   if(engine==='chromium'){await context.setOffline(true);await page.reload();assert.equal(await page.locator('#subjects .card').count()>0,true,'existing offline snapshot retained');await context.setOffline(false);}
   upgraded=true;
   await page.evaluate(()=>{window.__upgradeControllerChanged=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{window.__upgradeControllerChanged=true;});});
   await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
   await page.waitForFunction(()=>window.__upgradeControllerChanged,null,{timeout:30000});
   await page.reload();
   assert.equal(await page.locator('a.tile').count(),6,'connected upgraded worker must show unified home instead of cached legacy home');
   const after=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
   assert.deepEqual(after,before,'root upgrade preserves every stored value');
   const retainedSnapshot=await page.evaluate(()=>new Promise(async(resolve,reject)=>{
    const registration=await navigator.serviceWorker.getRegistration(),channel=new MessageChannel();
    const timer=setTimeout(()=>reject(Error('snapshot status timed out')),10000);
    channel.port1.onmessage=({data})=>{clearTimeout(timer);channel.port1.close();if(data.type==='error')reject(Error(data.message));else resolve(data.state);};
    registration.active.postMessage({type:'status'},[channel.port2]);
   }));
   assert.deepEqual(retainedSnapshot,snapshot,'worker verifies every old cached URL is still present');
   failRoot=true;
   const fallback=await page.reload();assert.equal(await fallback.text(),cachedHome,'on server failure actual worker returns exact old snapshot bytes');
   assert.equal(await page.locator('a.tile').count(),0,'old snapshot remains usable without clearing records');
   failRoot=false;await page.reload();assert.equal(await page.locator('a.tile').count(),6,'online recovery returns unified home');
   await page.goto(new URL('index.html?from=installed',base).href);assert.equal(await page.locator('a.tile').count(),6,'explicit index route also refreshes online');
   assert.equal(await page.locator('#countdown-date-caption').innerText(),'2027/08/14');
   // Root worker and nested professional worker coexist without deleting old caches.
   await page.goto(new URL('professional/',base).href);
   await page.waitForFunction(()=>window.Study30QuestionSources?.all?.length===426);
   await page.waitForFunction(()=>document.querySelector('#offlineStatus')?.dataset.kind==='ready',null,{timeout:40000});
   const state=await page.evaluate(async()=>({scope:(await navigator.serviceWorker.getRegistration()).scope,caches:await caches.keys(),main:localStorage.getItem('probation-study-desk-v24'),extra:localStorage.getItem('another-module-record'),oldSession:JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions['2026-01-01']}));
   assert.equal(state.scope,new URL('professional/',base).href,'nested worker scope');
   for(const name of cachesBefore)assert(state.caches.includes(name),'unrelated/legacy cache retained: '+name);
   assert.equal(state.main,before['probation-study-desk-v24']);assert.equal(state.extra,before['another-module-record']);
   assert.deepEqual(state.oldSession,JSON.parse(before['probation-study30-v251:v1']).sessions['2026-01-01']);
   await page.goto(base);assert.equal(await page.locator('a.tile').count(),6,'nested worker does not take over root home');
   await context.close();
   context=await playwright[engine].launchPersistentContext(profile,{headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei'});
   const reopened=context.pages()[0]||await context.newPage();await reopened.goto(base);
   assert.equal(await reopened.locator('a.tile').count(),6,'upgraded home survives a browser restart');
   const reopenedData=await reopened.evaluate(()=>({main:localStorage.getItem('probation-study-desk-v24'),extra:localStorage.getItem('another-module-record'),oldSession:JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions['2026-01-01']}));
   assert.equal(reopenedData.main,state.main);assert.equal(reopenedData.extra,state.extra);assert.deepEqual(reopenedData.oldSession,state.oldSession);
   console.log('PASS existing-PWA upgrade:',engine,base,'actual baseline snapshot',snapshot.count,'files; five-entry online home; all old records/caches retained; root and professional scopes coexist; browser restart preserved records');
   await context.close();context=null;
  }
 }finally{if(context)await context.close();for(const profile of profiles)fs.rmSync(profile,{recursive:true,force:true});server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
