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
   if(localStorage.getItem('daily-reading-test:saved')===null)localStorage.setItem('daily-reading-test:saved',JSON.stringify([args.id]));
 },{origin,dailyKey:'probation-daily-github:records:v1',studyKey:'probation-study-desk-v24',id:q.id,record:oldRecord});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(origin+'/v2.5/daily-practice.html',{waitUntil:'domcontentloaded'});
 await page.locator('#questionList button[data-id]').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#count').textContent(),String(data.questions.length));
 assert.equal(await page.locator('#answer').inputValue(),'驗收前既有答案','pre-existing answer should load');
 await page.locator('#answer').fill('新練習答案：爭點、涵攝、結論。');
 await page.locator('#draftIssue').fill('爭點草稿：甲之程序保障');
 await page.locator('#draftBasis').fill('法律草稿：少年事件處理法');
 await page.locator('#draftAnalysis').fill('涵攝草稿：警方之詢問程序');
 await page.locator('#draftConclusion').fill('結論草稿：須分別檢驗');
 await page.locator('#aiFeedback').fill('AI評語：法條論述得當，但應補上學理。');
 await page.waitForFunction(id=>{
   const r=JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id];
   return r?.answer.includes('新練習答案')&&r?.aiFeedback.includes('AI評語')&&
     r?.essayDrafts?.issues.includes('爭點草稿')&&r?.essayDrafts?.conclusion.includes('結論草稿');
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
 assert.equal(await page.locator('#draftIssue').inputValue(),'爭點草稿：甲之程序保障');
 assert.equal(await page.locator('#draftBasis').inputValue(),'法律草稿：少年事件處理法');
 assert.equal(await page.locator('#draftAnalysis').inputValue(),'涵攝草稿：警方之詢問程序');
 assert.equal(await page.locator('#draftConclusion').inputValue(),'結論草稿：須分別檢驗');
 assert.match(await page.locator('#timerStatus').textContent(),/倒數進行中/,'timer must persist after reload');
 await page.locator('.ai-custom-editor summary').click();
 await page.locator('.ai-custom-editor select').selectOption('');
 await page.locator('.ai-custom-editor textarea').fill('請優先分析題目設問，指出答題邏輯不一致處。');
 await page.locator('.ai-custom-editor button').filter({hasText:'儲存此組合'}).click();
 assert.match(await page.locator('.ai-custom-editor [role="status"]').textContent(),/已儲存/);
 await page.locator('#copyAI').click();
 await page.waitForFunction(()=>document.querySelector('#copyStatus').textContent.trim().length>0);
 if(!IS_WEBKIT){
   const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
   assert.ok(clipboard.includes('新練習答案'));
   assert.ok(clipboard.includes(await page.locator('#questionText').textContent()));
   assert.ok(clipboard.includes('【本次每日模擬題】'));
   assert.ok(!clipboard.includes('【原題】'));
   assert.ok(clipboard.includes('純學科題採整題評分'));
   assert.ok(clipboard.includes('按題目設問分別評分'));
   assert.ok(clipboard.includes('請優先分析題目設問，指出答題邏輯不一致處。'));
 }
 await page.locator('#aiReviewMode').selectOption('direction');
 await page.locator('#copyAI').click();
 await page.waitForFunction(()=>document.querySelector('#copyStatus').textContent.includes('答題方向'));
 if(!IS_WEBKIT){const outlineClipboard=await page.evaluate(()=>navigator.clipboard.readText());
   assert.ok(outlineClipboard.includes('【我的答題方向／四格草稿】'));
   assert.ok(outlineClipboard.includes('爭點草稿：甲之程序保障'));
   assert.ok(!outlineClipboard.includes('【本次完整答案】'));
 }
 await page.locator('#aiReviewMode').selectOption('full');
 const oldPage=await context.newPage();
 oldPage.on('pageerror',error=>errors.push('original daily page: '+error.message));
 oldPage.on('dialog',dialog=>dialog.accept());
 await oldPage.goto(origin+'/daily-simulation/',{waitUntil:'domcontentloaded'});
 await oldPage.locator('[data-open]').first().waitFor({timeout:30000});
 await oldPage.locator('[data-open="'+q.id+'"]').first().click();
 assert.equal(await oldPage.locator('#answer').inputValue(),'新練習答案：爭點、涵攝、結論。');
 assert.equal(await oldPage.locator('#draftIssue').inputValue(),'爭點草稿：甲之程序保障');
 assert.equal(await oldPage.locator('#aiFeedback').inputValue(),'AI評語：法條論述得當，但應補上學理。');
 assert.ok(await oldPage.locator('.ai-custom-editor').count(),'editor should be shared across daily pages');
 await oldPage.locator('#answer').fill('由原每日題瀏覽頁更新的答案');
 await oldPage.locator('#draftBasis').fill('法律草稿：少年事件處理法');
 await oldPage.locator('#draftAnalysis').fill('涵攝草稿：警方之詢問程序');
 await oldPage.locator('#draftConclusion').fill('結論草稿：須分別檢驗');
 await oldPage.waitForFunction(id=>{
   const record=JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id];
   return record?.essayDrafts?.conclusion==='結論草稿：須分別檢驗' && record?.aiFeedback?.startsWith('AI評語');
 },q.id);
 await oldPage.locator('#startTimer').click();
 assert.equal(await oldPage.locator('#startTimer').isDisabled(),true);
 await oldPage.locator('#copyAI').click();
 await oldPage.waitForFunction(()=>document.querySelector('#copyStatus').textContent.trim().length>0);
 if(!IS_WEBKIT){
   const promptText=await oldPage.evaluate(()=>navigator.clipboard.readText());
   assert.ok(promptText.includes('由原每日題瀏覽頁更新的答案')&&promptText.includes('【本次每日模擬題】'));
   assert.ok(promptText.includes('法律／實務依據無法查證時標示待確認'));
   assert.ok(promptText.includes('請優先分析題目設問，指出答題邏輯不一致處。'),'settings persist across same-origin daily modules');
 }
 await oldPage.locator('#aiReviewMode').selectOption('direction');
 await oldPage.locator('#copyAI').click();
 await oldPage.waitForFunction(()=>document.querySelector('#copyStatus').textContent.includes('答題方向'));
 if(!IS_WEBKIT){const outline=await oldPage.evaluate(()=>navigator.clipboard.readText());
   assert.ok(outline.includes('【我的答題方向／四格草稿】'));
   assert.ok(outline.includes('爭點草稿：甲之程序保障'));
   assert.ok(!outline.includes('【本次完整答案】'));
 }
 await oldPage.locator('#aiReviewMode').selectOption('full');
 await oldPage.waitForFunction(id=>(JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id]||{}).answer==='由原每日題瀏覽頁更新的答案',q.id);
 const still=await page.evaluate(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id].aiFeedback,q.id);
 assert.equal(still,'AI評語：法條論述得當，但應補上學理。','old daily page must preserve feedback');
 assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id].essayDrafts.issues,q.id),'爭點草稿：甲之程序保障','old daily page must preserve four drafts');
 const secondId=await page.locator('#questionList button[data-id]').nth(1).getAttribute('data-id');
 await page.locator('#questionList button[data-id]').nth(1).click();
 await page.locator('#draftIssue').fill('第二題才有的草稿');
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id]?.essayDrafts?.issues==='第二題才有的草稿',secondId);
 await page.locator('#questionList button[data-id="'+q.id+'"]').click();
 assert.equal(await page.locator('#draftIssue').inputValue(),'爭點草稿：甲之程序保障','switching questions must preserve correct drafts');
 const markdownPromise=page.waitForEvent('download');
 await page.locator('#exportEssay').click();
 const md=await markdownPromise;
 assert.ok(md.suggestedFilename().endsWith('.md'),'must export Markdown file');
 const mdText=fs.readFileSync(await md.path(),'utf8');
 assert.ok(mdText.includes('## 四格草稿')&&mdText.includes('爭點草稿：甲之程序保障'));
 assert.ok(mdText.includes('## 完整答案')&&mdText.includes('由原每日題瀏覽頁更新的答案'));
 assert.ok(mdText.includes('AI評語：法條論述得當'));
 // Markdown exports directly from the browsing page without leaving it.
 const inlineDownload=oldPage.waitForEvent('download');
 await oldPage.locator('#exportEssay').click();
 const inlineMd=await inlineDownload;
 assert.ok(inlineMd.suggestedFilename().endsWith('.md'));
 const inlineText=fs.readFileSync(await inlineMd.path(),'utf8');
 assert.ok(inlineText.includes('## 四格草稿')&&inlineText.includes('爭點草稿：甲之程序保障'));
 assert.ok(inlineText.includes('## 完整答案')&&inlineText.includes('由原每日題瀏覽頁更新的答案'));
 assert.ok(inlineText.includes('AI評語：法條論述得當'));
 await oldPage.locator('#next').click();
 assert.notEqual(await oldPage.locator('#readerMeta').textContent(),q.date+' · '+q.subject,'next question navigation should work');
 await oldPage.locator('#draftIssue').fill('另一題的四格草稿');
 await oldPage.locator('#previous').click();
 assert.equal(await oldPage.locator('#draftIssue').inputValue(),'爭點草稿：甲之程序保障','returning to question restores its own draft');
 await oldPage.close();
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#export').click();
 const downloaded=await downloadPromise;
 const readable=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));
 assert.equal(readable.records[q.id].aiFeedback,still);
 assert.equal(readable.records[q.id].essayDrafts.basis,'法律草稿：少年事件處理法');
 assert.ok(readable.saved.includes(q.id),'backup includes daily bookmarks');
 assert.ok(readable.timers[q.id]?.deadline>Date.now(),'backup includes in-progress 30-minute timers');
 const replacement={format:'probation-daily-github-records',schemaVersion:1,saved:[q.id,'additional-starred-id'],records:{[q.id]:{answer:'已還原的每日題答案',essayDrafts:{issues:'還原的爭點草稿',basis:'',analysis:'',conclusion:''},review:true,updatedAt:new Date().toISOString(),aiFeedback:'已還原的AI評語'}}};
 await page.locator('#importFile').setInputFiles({name:'daily-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id]?.answer==='已還原的每日題答案',q.id);
 assert.equal(await page.locator('#aiFeedback').inputValue(),'已還原的AI評語');
 assert.equal(await page.locator('#draftIssue').inputValue(),'還原的爭點草稿');
 assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-reading-test:saved')))).includes('additional-starred-id'));
 const partial={format:'probation-daily-github-records',schemaVersion:1,records:{[q.id]:{answer:'舊備份更新答案',review:true,updatedAt:new Date().toISOString()}}};
 await page.locator('#importFile').setInputFiles({name:'older-daily-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(partial))});
 await page.waitForFunction(id=>{
   const r=JSON.parse(localStorage.getItem('probation-daily-github:records:v1'))[id];
   return r?.answer==='舊備份更新答案' && r?.aiFeedback==='已還原的AI評語' && r?.essayDrafts?.issues==='還原的爭點草稿';
 },q.id);
 assert.equal(await page.locator('#draftIssue').inputValue(),'還原的爭點草稿');
 assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-reading-test:saved')))).includes('additional-starred-id'),'older backup cannot delete bookmarks');
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
 async function checkMobileControls(width){
   await mobile.setViewportSize({width,height:844});
   await mobile.locator('.site-header nav .offline-entry').waitFor({timeout:10000});
   const geometry=await mobile.evaluate(()=>{
     const $=selector=>document.querySelector(selector),rect=element=>{
       const r=element.getBoundingClientRect(),style=getComputedStyle(element);
       return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,whiteSpace:style.whiteSpace,display:style.display};
     };
     return {
       full:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
       navLinks:[...document.querySelectorAll('.site-header nav a')].map(rect),
       offline:rect($('.site-header nav .offline-entry')),
       timer:[rect($('#startTimer')),rect($('#resetTimer'))],
       backup:[rect($('#export')),rect($('#import')),rect($('#clear'))],
       labels:[$('#export').textContent.trim(),$('#import').textContent.trim(),$('#clear').textContent.trim()]
     };
   });
   assert.ok(geometry.full<=geometry.viewport+2,'horizontal scroll at '+width+'px: '+JSON.stringify(geometry));
   const navOverlap=geometry.navLinks.some(x=>geometry.offline.top<x.bottom-1&&geometry.offline.bottom>x.top+1&&geometry.offline.left<x.right+4&&geometry.offline.right>x.left-4);
   assert.ok(!navOverlap,'offline entry must not overlap navigation at '+width+'px: '+JSON.stringify(geometry));
   assert.ok(geometry.offline.right<=geometry.viewport+2,'offline entry stays inside viewport at '+width+'px');
   const headerHeight=await mobile.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height);
   assert.ok(headerHeight<165,'navigation header should remain compact at '+width+'px: '+headerHeight);
   assert.deepEqual(geometry.labels,['匯出備份','匯入備份','清除紀錄'],'short labels match the mobile request');
   assert.ok(geometry.timer.every(x=>x.height<=65&&x.whiteSpace==='nowrap'),'timer buttons must stay single-line at '+width+'px: '+JSON.stringify(geometry.timer));
   assert.ok(geometry.backup.every(x=>x.height<=60&&x.whiteSpace==='nowrap'),'backup buttons must stay single-line at '+width+'px: '+JSON.stringify(geometry.backup));
   assert.ok(Math.abs(geometry.timer[0].top-geometry.timer[1].top)<=2,'timer actions must share a row at '+width+'px');
   assert.ok(geometry.backup.every(x=>Math.abs(x.top-geometry.backup[0].top)<=2),'backup actions must share one row at '+width+'px');
   assert.ok(geometry.backup.every(x=>x.right<=geometry.viewport+2),'backup actions must fit viewport at '+width+'px');
 }
 for(const width of [390,360,320])await checkMobileControls(width);
 await mobile.setViewportSize({width:390,height:844});
 await mobile.locator('#startTimer').click();
 assert.equal(await mobile.locator('#startTimer').isDisabled(),true,'mobile timer click must work');
 assert.equal(await mobile.locator('#essayHeading').textContent(),'我的練習紀錄');
 await mobile.locator('#draftIssue').fill('手機四格草稿測試');
 await mobile.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id]?.essayDrafts?.issues==='手機四格草稿測試',q.id);
 await mobile.locator('#answer').fill('手機介面作答驗收');
 await mobile.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id]?.answer==='手機介面作答驗收',q.id);
 await mobile.locator('#aiFeedback').fill('手機批改評語');
 await mobile.waitForFunction(id=>JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id]?.aiFeedback==='手機批改評語',q.id);
 assert.deepEqual(mobileErrors,[],'no uncaught mobile browser errors');
 // Mobile Safari/Chromium must also support all features *inside* the evening-room modal.
 const inlineMobile=await mobileContext.newPage(),inlineErrors=[];
 inlineMobile.on('pageerror',error=>inlineErrors.push(error.message));
 inlineMobile.on('dialog',dialog=>dialog.accept());
 await inlineMobile.goto(origin+'/daily-simulation/',{waitUntil:'domcontentloaded'});
 await inlineMobile.locator('[data-open="'+q.id+'"]').first().waitFor({timeout:30000});
 await inlineMobile.locator('[data-open="'+q.id+'"]').first().click();
 assert.ok(await inlineMobile.locator('#draftIssue').isVisible());
 for(const width of [390,360,320]){
   await inlineMobile.setViewportSize({width,height:844});
   const geometry=await inlineMobile.evaluate(()=>{
     const container=document.querySelector('#readerScroll');
     const grid=document.querySelector('.essay-draft-grid');
     const width=container.clientWidth;
     const gridRect=grid.getBoundingClientRect(),containerRect=container.getBoundingClientRect();
     return {viewport:document.documentElement.clientWidth,body:document.documentElement.scrollWidth,gridRight:gridRect.right,containerRight:containerRect.right,containerScroll:container.scrollWidth,containerClient:container.clientWidth,width};
   });
   assert.ok(geometry.body<=geometry.viewport+2,'evening-room mobile page overflows at '+width+': '+JSON.stringify(geometry));
   assert.ok(geometry.gridRight<=geometry.containerRight+2,'four-grid exceeds mobile modal at '+width+': '+JSON.stringify(geometry));
   assert.ok(geometry.containerScroll<=geometry.containerClient+3,'modal content horizontally scrolls at '+width+': '+JSON.stringify(geometry));
 }
 await inlineMobile.setViewportSize({width:390,height:844});
 await inlineMobile.locator('#draftIssue').fill('晚間學習室手機版草稿');
 await inlineMobile.locator('#answer').fill('晚間學習室手機版完整答案');
 await inlineMobile.locator('#aiFeedback').fill('晚間學習室手機版 AI 評語');
 await inlineMobile.waitForFunction(id=>{
   const r=JSON.parse(localStorage.getItem('probation-daily-github:records:v1')||'{}')[id];
   return r?.essayDrafts?.issues==='晚間學習室手機版草稿' && r?.answer==='晚間學習室手機版完整答案' && r?.aiFeedback==='晚間學習室手機版 AI 評語';
 },q.id);
 const mobileMarkdown=inlineMobile.waitForEvent('download');
 await inlineMobile.locator('#exportEssay').click();
 const mobileMd=await mobileMarkdown;
 assert.ok(fs.readFileSync(await mobileMd.path(),'utf8').includes('晚間學習室手機版草稿'));
 assert.deepEqual(inlineErrors,[],'no uncaught evening-room mobile errors');
 await inlineMobile.close();
 await mobileContext.close();
 console.log((IS_WEBKIT?'WebKit':'Chromium')+' desktop + 390px touch-mobile browser acceptance passed: '+data.questions.length+' questions; old answer, timer, AI clipboard, shared page, backup/restore, clear and mobile layout.');
}
check().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.close(resolve));
});
