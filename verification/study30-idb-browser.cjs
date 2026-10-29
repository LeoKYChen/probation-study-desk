'use strict';
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname),name=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
  if(!name.startsWith(root+path.sep))throw Error('invalid path');
  const ext=path.extname(name),types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};
  res.setHeader('Content-Type',(types[ext]||'application/octet-stream')+'; charset=utf-8');
  res.end(fs.readFileSync(name));
 }catch{res.statusCode=404;res.end('not found');}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const engine of [chromium,webkit]){
   const browser=await engine.launch({headless:true});
   try{
    const ctx=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Taipei'});
    await ctx.route('https://accounts.google.com/**',route=>route.abort());
    const page=await ctx.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/professional/');
    const old=JSON.stringify({version:1,sessions:{'2026-10-28':{date:'2026-10-28',questionId:'synthetic-existing-id',mode:'30',phase:0,remaining:300,elapsed:0,notes:['舊答案'],finished:false}}});
    await page.evaluate(old=>localStorage.setItem('probation-study30-v251:v1',old),old);
    await ctx.addInitScript(()=>{window.PSD_STUDY30_IDB_TEST=true});
    await page.reload();
    await page.waitForFunction(()=>!!window.Study30App?.essayContext());
    await page.locator('#essayField0').fill('IndexedDB 申論草稿');
    await page.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('已自動保存'));
    await page.locator('#daily30AiFeedback').fill('AI 評語內容');
    await page.waitForFunction(()=>document.querySelector('#daily30AiStatus').textContent.includes('已儲存'));
    await page.evaluate(()=>window.Study30App.whenSaved());
    assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study30-v251:v1')),old);
    await page.reload();await page.waitForFunction(()=>!!window.Study30App?.essayContext());
    assert.equal(await page.locator('#essayField0').inputValue(),'IndexedDB 申論草稿');
    assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'AI 評語內容');
    const saved=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const v=await db.get('probation-study30-v251:v1');db.close();return JSON.parse(v)});
    assert.equal(saved.sessions['2026-10-28'].questionId,'synthetic-existing-id');
    assert.equal(await page.locator('#driveSyncPanel').isHidden(),true);
    assert.deepEqual(errors,[]);
    await ctx.close();console.log(`PASS ${engine.name()}: experimental daily UI migration, essay, AI feedback, reload and legacy retention`);
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
