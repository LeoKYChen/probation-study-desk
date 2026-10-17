'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const playwright=require('playwright'),engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium',root=path.resolve(process.argv[2]||'.'),repo=path.resolve(__dirname,'..');
const ledger=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/layout-before-review/manifest.json'))),oldFiles=new Map();
for(const row of ledger.files){const data=fs.readFileSync(path.join(repo,row.path));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),row.sha256);oldFiles.set(row.name,data);}
const assets=JSON.parse(fs.readFileSync(path.join(root,'professional/sw.js'),'utf8').match(/const ASSETS=(\[.*?\]);/)[1]);
let upgraded=false;
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/professional\//,'');if(!name)name='index.html';
 const headers={'Content-Type':({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webmanifest':'application/manifest+json'}[path.extname(name)]||'application/octet-stream'),'Cache-Control':'no-store'};
 if(!upgraded){const data=oldFiles.get(name);res.writeHead(data?200:404,headers).end(data||'missing fixture');return;}
 const file=path.resolve(root,'professional',name);if(!file.startsWith(path.join(root,'professional')+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,headers).end(e?'missing file':b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'layout-installed-'+engine+'-'));
 let ctx;
 try{
  ctx=await playwright[engine].launchPersistentContext(profile,{headless:true,locale:'zh-TW',timezoneId:'Asia/Taipei',viewport:{width:390,height:844},...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=ctx.pages()[0]||await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));const base='http://127.0.0.1:'+server.address().port+'/professional/';
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#offlineStatus')?.dataset.kind==='ready',null,{timeout:45000});
  const before=await page.evaluate(()=>{const key='probation-study30-v251:v1',data=JSON.parse(localStorage.getItem(key));const today=Study30App.getEssayReviewData().today;data.sessions[today].notes=['升級前的速記'];data.sessions[today].unknownField='保留未知欄位';localStorage.setItem(key,JSON.stringify(data));localStorage.setItem('other-module','保留');return localStorage.getItem(key);});
  await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);
  upgraded=true;
  await page.reload(); // New HTML can initially encounter old cached scripts; it must remain compatible.
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await page.waitForFunction(async expected=>{
   const worker=navigator.serviceWorker.controller;if(!worker)return false;
   return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},1000);channel.port1.onmessage=({data})=>{clearTimeout(timer);channel.port1.close();resolve(data.ready&&data.total===expected);};worker.postMessage({type:'OFFLINE_STATUS_CHECK'},[channel.port2]);});
  },assets.length,{timeout:45000});
  await page.reload();await page.waitForFunction(()=>window.Study30LearningCharts&&window.Study30ProgressCalendar);
  await page.waitForFunction(()=>document.querySelectorAll('#v254Radar .radar-value-item').length===7,null,{timeout:15000});
  assert.equal(await page.locator('#showMonthProgress').count(),1);assert.equal(await page.locator('#v254Radar .radar-value-item').count(),7);
  assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study30-v251:v1')),before);
  assert.equal(await page.evaluate(()=>localStorage.getItem('other-module')),'保留');assert.deepEqual(errors,[],'no old-script/new-HTML error during cache upgrade');
  console.log('PASS installed layout upgrade:',engine,'frozen main assets, mixed-cache compatibility, updated chart/calendar, unchanged records');
 }finally{if(ctx)await ctx.close();server.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
