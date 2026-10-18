'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const playwright=require('playwright');
const engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium';
assert(['chromium','webkit'].includes(engine));
const root=path.resolve(process.argv[2]||'.'),remote=process.env.UNIFIED_TEST_URL;
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
 if(pathname.startsWith('/probation-study-desk/'))pathname=pathname.slice('/probation-study-desk'.length);
 const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(b);});
});
(async()=>{
 if(!remote)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await playwright[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const bases=remote?[remote]:['http://127.0.0.1:'+server.address().port+'/','http://127.0.0.1:'+server.address().port+'/probation-study-desk/'];
  for(const base of bases){
   const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei',...(engine==='chromium'?{permissions:['clipboard-read','clipboard-write']}:{}),acceptDownloads:true});
   await ctx.addInitScript(()=>{const clipboard=navigator.clipboard;if(clipboard?.writeText){const nativeWrite=clipboard.writeText.bind(clipboard);clipboard.writeText=text=>{window.__testCopyPayload=text;return nativeWrite(text);};}});
   const page=await ctx.newPage(),errors=[],bad=[];page.setDefaultTimeout(15000);
   page.on('dialog',async dialog=>{await dialog.dismiss();});
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)bad.push(r.status()+' '+r.url());});
   assert.equal((await page.goto(base)).status(),200);
   await page.evaluate(()=>{localStorage.setItem('probation-study-desk-v24','{"legacy-sentinel":{"answer":"原考古題答案","done":true}}');localStorage.setItem('unrelated-module-sentinel','不得修改');});
   const retained=await page.evaluate(()=>localStorage.getItem('probation-study-desk-v24'));
   assert.equal(await page.locator('a.tile.course-tile').count(),3);assert.equal(await page.locator('a.tile.explore-tile').count(),3);assert.equal(await page.locator('a.tile').count(),6);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await page.locator('#countdown-settings').evaluate(n=>n.open=true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'home overflow '+width);
    const bounds=await page.locator('#exam-date').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width,'date bounds '+width);
   }
   await page.locator('#exam-date').fill('2027-08-14');await page.locator('.save-button').click();await page.reload();assert.equal(await page.locator('#countdown-date-caption').innerText(),'2027/08/14');
   const countdown=await page.evaluate(()=>localStorage.getItem('psd-home-exam-countdown-v1'));
   for(const [label,target] of [['專業科目','professional/'],['共同科目','common-subjects/'],['每日模擬','daily-simulation/'],['知識補給','juvenile-news/']]){
    const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('a.tile').filter({hasText:label}).click()]);await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),new URL(target,base).href);await popup.close();
   }
   await page.setViewportSize({width:390,height:844});
   await page.goto(new URL('professional/',base).href);await page.waitForFunction(()=>window.Study30QuestionSources?.all?.length===426);
   const key='probation-study30-v251:v1';
   // Seed an existing old session, then confirm startup/save leaves it intact.
   const legacySession={date:'2026-01-01',questionId:'legacy-sentinel',notes:['既有專業練習答案'],customField:'必須保留'};
   await page.evaluate(([key,session])=>{const s=JSON.parse(localStorage.getItem(key));s.sessions[session.date]=session;localStorage.setItem(key,JSON.stringify(s));},[key,legacySession]);
   await page.reload();await page.waitForFunction(()=>window.Study30App);
   assert.equal(await page.locator('#historyContent button.day-cell').count(),7);
   const id=await page.evaluate(()=>Study30App.essayContext().questionId);
   await page.locator('.daily-quick-notes summary').click();
   await page.locator('#answer').fill('每日練習保存測試');
   await page.locator('#essayEditor').evaluate(n=>n.open=true);
   await page.locator('#essayFullAnswer').fill('整合測試答案：爭點、規範、涵攝、結論。');
   await page.locator('#daily30CopyAi').click();
   if(engine==='chromium')assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('整合測試答案'));
   else {assert((await page.evaluate(()=>window.__testCopyPayload)).includes('整合測試答案'));await page.waitForFunction(()=>/已複製|請從跳出/.test(document.querySelector('#daily30AiStatus').textContent));}
   await page.locator('#daily30AiFeedback').fill('整合測試：補充法律效果。');
   await page.locator('#toggleTimer').click();await page.waitForTimeout(1200);await page.locator('#toggleTimer').click();
   assert((await page.evaluate(key=>Object.values(JSON.parse(localStorage.getItem(key)).sessions).some(s=>s.elapsed>0),key)));
   await page.reload();await page.locator('#daily30AiFeedback').waitFor({state:'attached'});
   assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'整合測試：補充法律效果。');
   assert.equal(await page.locator('#essayFullAnswer').inputValue(),'整合測試答案：爭點、規範、涵攝、結論。');
   assert.equal(await page.evaluate(()=>Study30App.essayContext().questionId),id);
   assert.equal(await page.locator('#answer').inputValue(),'每日練習保存測試');
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).sessions['2026-01-01'],key),legacySession);
   assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study-desk-v24')),retained);
   assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-module-sentinel')),'不得修改');
   assert.equal(await page.evaluate(()=>localStorage.getItem('psd-home-exam-countdown-v1')),countdown);
   await page.goto(new URL('legacy-home.html',base).href);assert.equal(await page.locator('#subjects .card').count()>0,true);
   await page.goto(new URL('v2.5/',base).href);await page.waitForLoadState('networkidle');assert((await page.locator('body').innerText()).length>100);
   assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-module-sentinel')),'不得修改');
   assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study-desk-v24')),retained);
   assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
   console.log('PASS browser:',engine,base,'six entries, responsive countdown, 426 questions, timer, drafts/AI reload, old sessions/keys, old pages');
   await ctx.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
