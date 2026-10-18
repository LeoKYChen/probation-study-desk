'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let failing=false,failCount=0;
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  let file=decodeURIComponent(u.pathname).replace(/^\/+/, '');
  if(!file||file.endsWith('/'))file+='index.html';
  if(failing&&file==='v2.5/questions.js'){failCount++;res.writeHead(503).end('temporary test outage');return;}
  const absolute=path.resolve(root,file);
  if(!absolute.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(absolute,(err,buf)=>{
    if(err){res.writeHead(404).end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'}).end(buf);
  });
});
async function snapshot(page){
 return page.evaluate(async()=>{
  const reg=await navigator.serviceWorker.ready;
  return new Promise((done,fail)=>{
   const channel=new MessageChannel();
   const timeout=setTimeout(()=>fail(Error('SW status timeout')),15000);
   channel.port1.onmessage=ev=>{clearTimeout(timeout);done(ev.data.state);};
   reg.active.postMessage({type:'status'},[channel.port2]);
  });
 });
}
async function scenario(name,engine){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({locale:'zh-TW',viewport:{width:390,height:844},serviceWorkers:'allow'});
  const base='http://127.0.0.1:'+server.address().port;
  const page=await ctx.newPage();
  await page.goto(base+'/offline/');
  await page.waitForFunction(()=>!document.querySelector('#offline-dialog [data-download]')?.disabled,{timeout:30000});
  const value='SYNTHETIC-PHASE1-PRESERVE-'+name;
  await page.evaluate(x=>localStorage.setItem('phase1-qa-sentinel',x),value);
  await page.locator('.offline-entry').click();
  const download=page.locator('#offline-dialog [data-download]');
  await download.click();
  await page.waitForFunction(()=>document.querySelector('#offline-dialog [data-status]')?.textContent.includes('已備妥'),{timeout:180000});
  const before=await snapshot(page);
  assert(before&&before.count>=180);
  failing=true;
  await download.click();
  await page.waitForFunction(()=>document.querySelector('#offline-dialog [data-status]')?.textContent.includes('上一份完整離線資料仍保留'),{timeout:180000});
  assert(failCount>0,'injected HTTP 503 must be observed');
  const failed=await snapshot(page);
  assert.equal(failed.cacheName,before.cacheName,'old complete cache pointer changed');
  assert.equal(failed.version,before.version,'old snapshot version changed');
  const cacheNames=await page.evaluate(()=>caches.keys());
  assert(cacheNames.includes(before.cacheName),'old cache removed');
  assert(!cacheNames.some(x=>x.includes('snapshot:')&&x!==before.cacheName),'failed partial cache was retained');
  assert.equal(await page.evaluate(()=>localStorage.getItem('phase1-qa-sentinel')),value);
  failing=false;
  if(name==='chromium')await ctx.setOffline(true);
  const cached=await ctx.newPage();
  await cached.goto(base+'/common-subjects/',{timeout:30000});
  assert((await cached.title()).length>2);
  assert.equal(await cached.evaluate(()=>localStorage.getItem('phase1-qa-sentinel')),value);
  if(name==='chromium')await ctx.setOffline(false);
  await download.click();
  await page.waitForFunction(()=>document.querySelector('#offline-dialog [data-status]')?.textContent.includes('已備妥'),{timeout:180000});
  const retry=await snapshot(page);
  assert(retry&&retry.cacheName!==before.cacheName&&retry.count>=180,'retry update failed');
  assert.equal(await page.evaluate(()=>localStorage.getItem('phase1-qa-sentinel')),value);
  console.log('PASS '+name+': 184-asset complete snapshot kept after HTTP 503; failed partial cache cleaned; existing offline page opens; retry successful; localStorage unchanged');
  await ctx.close();
 }finally{failing=false;await browser.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await scenario('chromium',chromium);await scenario('webkit',webkit);}
 finally{server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
