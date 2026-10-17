/* Real-browser acceptance test for v2.5.4 daily practice. npm i --no-save playwright && npx playwright install chromium */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const IS_WEBKIT=process.env.DAILY_E2E_ENGINE==='webkit';
const ROOT=process.cwd();
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const data=JSON.parse(fs.readFileSync('daily-simulation/questions.json','utf8'));
assert.ok(data.questions.length);
const q=[...data.questions].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))[0];
let browser,server;
async function check(){
 server=http.createServer((req,res)=>{
   try{
     let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
     if(file.endsWith('/'))file+='index.html';
     const abs=path.resolve(ROOT,'.'+file);
     if(!abs.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
     const buf=fs.readFileSync(abs);
     res.writeHead(200,{'content-type':MIME[path.extname(abs)]||'application/octet-stream'});
     res.end(buf);
   }catch(error){res.writeHead(404).end('not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await (IS_WEBKIT?webkit:chromium).launch({headless:true,...(IS_WEBKIT?{}:{args:['--no-sandbox']})});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:850}});
 if(!IS_WEBKIT)await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
 const oldRecord={answer:'驗收前既有答案',review:false,updatedAt:'2026-10-16T10:00:00.000Z',questionSnapshot:'legacy'};
 await context.addInitScript(args=>{
   if(location.origin!==args.origin)return;
   if(localStorage.getItem(args.dailyKey)===null)localStorage.setItem(args.dailyKey,JSON.stringify({[args.id]:args.record}));
   if(localStorage.getItem(args.studyKey)===null)localStorage.setItem(args.studyKey,JSON.stringify({sentinel:{issue:'保留原本考古題'}}));
 },{origin,dailyKey:'probation-daily-github:records:v1',studyKey:'probation-study-desk-v24',id:q.id,record:oldRecord});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(origin+'/v2.5/daily-practice.html',{waitUntil:'domcontentloaded'});
 await page.locator('#questionList button[data-id]').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#count').textContent(),String(data.questions.length));
 assert.equal(await page.locator('#answer').inputValue(),'驗收前既有答案','pre-existing answer should load');
 await page.locator('#answer').fill('新練習答案：爭點、涵攝、結論。');
 await page.locator('#aiFeedback').fill('AI評語：法條論述得當，但應補上學理。');
 await page.waitForFunction(id=>{
   const r=JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id];
   return r?.answer.includes('新練習答案')&&r?.aiFeedback.includes('AI評語');
 },q.id);
 await page.locator('#startTimer').click();
 await page.waitForFunction(()=>document.querySelector('#timer').textContent!=='30:00',null,{timeout:8000}).catch(async error=>{
   const snapshot=await page.evaluate(()=>({timer:document.querySelector('#timer').textContent,status:document.querySelector('#timerStatus').textContent,session:sessionStorage.getItem('probation-daily-30min:session:v1')}));
   throw Error('timer did not move: '+JSON.stringify(snapshot)+'; page errors='+JSON.stringify(errors)+'; '+error.message);
 });
 let running=await page.locator('#timer').textContent();
 assert.ok(running!=='30:00','timer must count down');
 await page.reload();
 await page.locator('#questionList button[data-id]').first().waitFor();
 assert.equal(await page.locator('#answer').inputValue(),'新練習答案：爭點、涵攝、結論。');
 assert.match(await page.locator('#timerStatus').textContent(),/倒數進行中/,'timer must persist after reload');
 await page.locator('#copyAI').click();
 await page.waitForFunction(()=>document.querySelector('#copyStatus').textContent.trim().length>0);
 if(!IS_WEBKIT){
   const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
   assert.ok(clipboard.includes('新練習答案'));
   assert.ok(clipboard.includes(q.question));
   assert.ok(clipboard.includes('純學科題採整題評分'));
   assert.ok(clipboard.includes('法律部分及非法律學科部分分別評分'));
 }
 const oldPage=await context.newPage();
 oldPage.on('pageerror',error=>errors.push('original daily page: '+error.message));
 await oldPage.goto(origin+'/daily-simulation/',{waitUntil:'domcontentloaded'});
 await oldPage.locator('[data-open]').first().waitFor({timeout:30000});
 await oldPage.locator('[data-open="'+q.id+'"]').first().click();
 assert.equal(await oldPage.locator('#answer').inputValue(),'新練習答案：爭點、涵攝、結論。');
 await oldPage.locator('#answer').fill('由原每日題瀏覽頁更新的答案');
 await oldPage.waitForFunction(id=>(JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id]||{}).answer==='由原每日題瀏覽頁更新的答案',q.id);
 const still=await page.evaluate(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id].aiFeedback,q.id);
 assert.equal(still,'AI評語：法條論述得當，但應補上學理。','old daily page must preserve feedback');
 await oldPage.close();
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#export').click();
 const downloaded=await downloadPromise;
 const readable=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));
 assert.equal(readable.records[q.id].aiFeedback,still);
 const replacement={format:'probation-daily-github-records',schemaVersion:1,records:{[q.id]:{answer:'已還原的每日題答案',review:true,updatedAt:new Date().toISOString(),aiFeedback:'已還原的AI評語'}}};
 await page.locator('#importFile').setInputFiles({name:'daily-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id]?.answer==='已還原的每日題答案',q.id);
 assert.equal(await page.locator('#aiFeedback').inputValue(),'已還原的AI評語');
 const deleteDownload=page.waitForEvent('download');
 await page.locator('#clear').click();
 await deleteDownload;
 await page.waitForFunction(()=>Object.keys(JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')).length===0);
 const left=await page.evaluate(()=>({
   study:JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}'),
   daily:JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}'),
   timer:JSON.parse(sessionStorage.getItem('probation-daily-30min:session:v1')||'{}')
 }));
 assert.equal(left.study.sentinel.issue,'保留原本考古題');
 assert.equal(Object.keys(left.daily).length,0);
 assert.equal(Object.keys(left.timer).length,0);
 assert.deepEqual(errors,[],'no uncaught browser page errors');
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
 const mobile=await mobileContext.newPage(),mobileErrors=[];
 mobile.on('pageerror',e=>mobileErrors.push(e.message));
 await mobile.goto(origin+'/v2.5/daily-practice.html',{waitUntil:'domcontentloaded'});
 await mobile.locator('#questionList button[data-id]').first().waitFor({timeout:30000});
 const dimensions=await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 assert.ok(dimensions.page<=dimensions.viewport+2,'mobile must not overflow horizontally '+JSON.stringify(dimensions));
 await mobile.locator('#startTimer').click();
 assert.equal(await mobile.locator('#startTimer').isDisabled(),true,'mobile timer click must work');
 await mobile.locator('#answer').fill('手機介面作答驗收');
 await mobile.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id]?.answer==='手機介面作答驗收',q.id);
 await mobile.locator('#aiFeedback').fill('手機批改評語');
 await mobile.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id]?.aiFeedback==='手機批改評語',q.id);
 assert.deepEqual(mobileErrors,[],'no uncaught mobile browser errors');
 await mobileContext.close();
 console.log((IS_WEBKIT?'WebKit':'Chromium')+' desktop + 390px touch-mobile browser acceptance passed: '+data.questions.length+' questions; old answer, timer, AI clipboard, shared page, backup/restore, clear and mobile layout.');
}
check().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
});
