'use strict';
/* Joint AI + approved layout + week backfill + offline browser acceptance, no user data. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(process.argv[2]||'deploy-dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const uri=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+(uri.pathname.endsWith('/')?uri.pathname+'index.html':uri.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:390,height:844},locale:'zh-TW'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let count=0;
 async function check(label,fn){await fn();console.log('UNIFIED PASS',++count,label);}
 try{
  const url='http://127.0.0.1:'+server.address().port+'/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  await page.locator('#daily30AiFeedback').waitFor({state:'attached',timeout:20000});
  await check('Original 426 and AI controls are present',async()=>{assert.equal(await page.evaluate('Study30QuestionSources.all.length'),426);assert.equal(await page.locator('#daily30CopyAi').count(),1);assert.equal(await page.locator('#daily30AiFeedback').count(),1);});
  await check('Approved green v254 title and fewer distractions',async()=>{assert.match(await page.title(),/v2\.5\.4/);assert(!((await page.locator('body').innerText()).includes('分科切換測試版')));});
  await check('Three approved panels are collapsible and default closed',async()=>{
   assert.equal(await page.locator('details.content-collapse').count(),3);
   assert.equal(await page.locator('details.content-collapse[open]').count(),0);
  });
  await check('Three panel summaries retain original inner controls',async()=>{
   const ids=['essayAnalyticsSummary','dataHealthSummary','importBackupFile'];
   for(const id of ids)assert.equal(await page.locator('#'+id).count(),1);
  });
  await page.locator('details.content-collapse').first().locator('summary').click();
  await check('Collapsed analytics can open safely',async()=>assert.equal(await page.locator('details.content-collapse[open]').count(),1));
  await check('Current-week progress rendered as date buttons',async()=>assert.equal(await page.locator('#historyContent button.day-cell').count(),7));
  const today=await page.evaluate('Study30Planner.isoTaipei()');
  const weekday=new Date(today+'T12:00:00+08:00').getUTCDay();
  const delta=(weekday+6)%7;
  if(delta>0){
   const past=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
   await page.locator('#historyContent button.day-cell').filter({hasText:''}).evaluateAll(nodes=>nodes.length);
   await page.locator('#historyContent button.day-cell[aria-label^="'+past+'"]').click();
   await check('Selecting yesterday changes learning date without changing today',async()=>assert.equal(await page.evaluate('Study30App.essayContext().date'),past));
   await check('Past-day return button is visible',async()=>assert.equal(await page.locator('#returnToday').isVisible(),true));
   await page.locator('#essayEditor').evaluate(el=>el.open=true);
   const pastId=await page.evaluate('Study30App.essayContext().questionId');
   await page.locator('#daily30AiFeedback').fill('補練日期獨立AI評語');
   await check('Past-day feedback saved in original Study30 JSON storage',async()=>{
    const saved=await page.evaluate(([date,id])=>JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions[date]?.aiReviewTexts?.[id],[past,pastId]);
    assert.equal(saved,'補練日期獨立AI評語');
   });
   await page.locator('#returnToday').click();
   await check('Return today preserves past record and title',async()=>{assert.equal(await page.evaluate('Study30App.essayContext().date'),today);assert.equal(await page.evaluate(([d,id])=>JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions[d]?.aiReviewTexts?.[id],[past,pastId]),'補練日期獨立AI評語');});
  }
  await check('Future dates disabled in weekly panel',async()=>{
   const future=await page.locator('#historyContent button.day-cell:disabled').count();
   const day=new Date(today+'T12:00:00+08:00').getUTCDay();
   assert.equal(future,day===0?0:7-(day===0?7:day));
  });
  await page.locator('#essayEditor').evaluate(el=>el.open=true);
  await page.locator('#essayFullAnswer').fill('合併站完整答案：先確認爭點，再適用法規及涵攝');
  await page.locator('#daily30CopyAi').click();
  await check('Copy AI instruction includes current original question and candidate answer',async()=>{const s=await page.evaluate('navigator.clipboard.readText()');assert(s.includes('合併站完整答案'));assert(s.includes(await page.evaluate('Study30App.essayContext().questionId')));});
  const activeId=await page.evaluate('Study30App.essayContext().questionId');
  await page.locator('#daily30AiFeedback').fill('合併站ChatGPT批改：爭點完整，增加法律效果。');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#daily30AiFeedback').waitFor({state:'attached'});
  await check('AI feedback persists after reload and original question unchanged',async()=>{assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'合併站ChatGPT批改：爭點完整，增加法律效果。');assert.equal(await page.evaluate('Study30App.essayContext().questionId'),activeId)});
  const urls=await page.locator('#daily30ExternalGuide a').evaluateAll(nodes=>nodes.map(n=>n.href));
  await check('Both external guides remain grounded',async()=>{assert(urls.length>=2);for(const url of urls){const h=new URL(url).hostname;assert(['shuati.tw','yamol.tw','google.com'].some(x=>h===x||h.endsWith('.'+x)));}});
  await check('Offline assets were included in built PWA',async()=>{assert.equal(await page.locator('link[rel=manifest]').count(),1);assert.equal(await page.locator('#offlineStatus').count(),1)});
  await page.waitForFunction(()=>document.querySelector('#offlineStatus')?.dataset.kind==='ready',null,{timeout:60000});
  await check('Service worker reports complete cache',async()=>assert.equal(await page.locator('#offlineStatus').getAttribute('data-kind'),'ready'));
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:35000});
  await page.locator('#daily30AiFeedback').waitFor({state:'attached'});
  await check('Offline reload preserves all 426 questions and AI review',async()=>{assert.equal(await page.evaluate('Study30QuestionSources.all.length'),426);assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'合併站ChatGPT批改：爭點完整，增加法律效果。')});
  await context.setOffline(false);
  await check('No uncaught browser page errors',async()=>assert.deepEqual(errors,[]));
  console.log('UNIFIED TOTAL',count,'browser acceptance PASS');
 }finally{await browser.close();}
})().then(()=>server.close()).catch(e=>{console.error('UNIFIED BROWSER FAIL',e);server.close();process.exitCode=1});
