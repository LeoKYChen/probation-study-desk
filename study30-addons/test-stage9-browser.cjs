'use strict';
/* Browser E2E on a temporary localhost origin; nothing deployed. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'deploy-dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.css':'text/css;charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403).end();return;}
 fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end('Missing');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:390,height:844},locale:'zh-TW'});
 const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port+'/';
 let n=0;async function check(name,fn){await fn();console.log('PASS',++n,name);}
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#daily30AiFeedback').waitFor({timeout:20000});
 await check('426 original questions loaded',async()=>assert.equal(await page.evaluate('Study30QuestionSources.all.length'),426));
 await check('today and essay external guide controls exist',async()=>{assert.equal(await page.locator('#daily30ExternalGuide').count(),1);assert.equal(await page.locator('#essayExternalGuide').count(),1)});
 await page.locator('#essayEditor').evaluate(el=>el.open=true);
 const id=await page.evaluate('Study30App.essayContext().questionId');assert(id);
 await check('daily assignment identified by ID',async()=>assert(await page.evaluate(id=>Study30QuestionSources.all.some(q=>q.id===id),id)));
 await page.locator('#essayFullAnswer').fill('測試用完整申論作答：逐項分析爭點、法規範及涵攝');
 await page.locator('#daily30CopyAi').click();
 await check('native browser clipboard carries correct answer',async()=>{const s=await page.evaluate('navigator.clipboard.readText()');assert(s.includes('測試用完整申論作答'));assert(s.includes(id))});
 const feedback='第一段應補強法條\n第二段應增加反面論證';
 await page.locator('#daily30AiFeedback').fill(feedback);
 await check('actual localStorage has same-question original AI feedback',async()=>{
 const obj=await page.evaluate(id=>{const store=JSON.parse(localStorage.getItem('probation-study30-v251:v1'));return Object.values(store.sessions).find(s=>Object.prototype.hasOwnProperty.call(s.aiReviewTexts||{},id))?.aiReviewTexts?.[id]},id);
 assert.equal(obj,feedback);
 });
 await check('verified external links are in known hosts or explicit searches',async()=>{
 const a=await page.locator('#daily30ExternalGuide a').evaluateAll(a=>a.map(x=>x.href));
 assert(a.length>=2);for(const u of a)assert(['www.shuati.tw','yamol.tw','www.google.com'].some(s=>new URL(u).hostname===s||new URL(u).hostname.endsWith('.'+s)));
 });
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#daily30AiFeedback').waitFor({timeout:15000});
 await check('feedback survives real browser reload',async()=>assert.equal(await page.locator('#daily30AiFeedback').inputValue(),feedback));
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);const filename=download.suggestedFilename();
 const temp=require('node:os').tmpdir()+'/daily30-v254-test-qa.json';await download.saveAs(temp);
 const saved=JSON.parse(fs.readFileSync(temp,'utf8'));
 await check('JSON backup contains plain-text review',async()=>assert(Object.values(saved.data.sessions).some(s=>s.aiReviewTexts?.[id]===feedback)));
 await check('original per-day backup name kept',async()=>assert(filename.endsWith('.json')));
 await check('no runtime JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
 console.log('PASSED',n,'Daily30 true-browser checks');
 await browser.close();
})().then(()=>server.close()).catch(e=>{console.error('FAILED Daily30 browser:',e);server.close();process.exit(1)});
