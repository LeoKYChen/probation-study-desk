'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:390,height:844},locale:'zh-TW'});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let passed=0;
 async function test(n,fn){await fn();console.log('LIVE PASS',++passed,n);}
 try{
  const url='https://v254-preview.probation-study30-test.pages.dev/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await test('public HTTP 200',async()=>assert.equal(response.status(),200));
  await page.locator('#daily30AiFeedback').waitFor({state:'attached',timeout:30000});
  await test('426 real original exam questions',async()=>assert.equal(await page.evaluate('Study30QuestionSources.all.length'),426));
  await test('one AI copy button and feedback field',async()=>{assert.equal(await page.locator('#daily30CopyAi').count(),1);assert.equal(await page.locator('#daily30AiFeedback').count(),1)});
  await test('Shuati and Yamol guide locations present',async()=>{assert.equal(await page.locator('#daily30ExternalGuide').count(),1);assert.equal(await page.locator('#essayExternalGuide').count(),1)});
  await page.locator('#essayEditor').evaluate(el=>el.open=true);
  const id=await page.evaluate('Study30App.essayContext().questionId');
  await page.locator('#essayFullAnswer').fill('正式部署隔離測試答案，與本人資料無關');
  await page.locator('#daily30CopyAi').click();
  await test('live copy contains current id and original answer',async()=>{const t=await page.evaluate('navigator.clipboard.readText()');assert(t.includes('正式部署隔離測試答案'));assert(t.includes(id))});
  const feedback='公開Cloudflare測試批改評語：法條要完整，涵攝要具體。';
  await page.locator('#daily30AiFeedback').fill(feedback);
  await test('live localStorage stores review per question',async()=>{const v=await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('probation-study30-v251:v1'));return Object.values(s.sessions).find(x=>x.aiReviewTexts?.[id])?.aiReviewTexts?.[id]},id);assert.equal(v,feedback)});
  const urls=await page.locator('#daily30ExternalGuide a').evaluateAll(xs=>xs.map(x=>x.href));
  await test('live provider links grounded',async()=>{assert(urls.length>=2);assert(urls.every(x=>{const h=new URL(x).hostname;return ['shuati.tw','yamol.tw','google.com'].some(a=>h===a||h.endsWith('.'+a))}))});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#daily30AiFeedback').waitFor({state:'attached'});
  await test('feedback persists through reload',async()=>assert.equal(await page.locator('#daily30AiFeedback').inputValue(),feedback));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  const file=path.join(os.tmpdir(),'daily30-live-qa.json');await download.saveAs(file);
  const backup=JSON.parse(fs.readFileSync(file,'utf8'));
  await test('JSON export carries AI feedback and original session',async()=>assert(Object.values(backup.data.sessions).some(x=>x.aiReviewTexts?.[id]===feedback)));
  await test('No JS page error',async()=>assert.deepEqual(errors,[]));
  console.log('LIVE DEPLOY PASSED',passed,'tests',url);
 }finally{await browser.close();}
})().catch(e=>{console.error('LIVE QA FAILED',e);process.exit(1)});
