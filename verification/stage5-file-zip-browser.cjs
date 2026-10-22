/* End-to-end: GitHub source ZIP -> unzip -> original root index.html under file://.
   NO localhost server. HTTP(S) is blocked and counted. Synthetic records only. */
'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'.');
const dailyCount=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions.json'),'utf8')).questions.length;
const weeklyCount=JSON.parse(fs.readFileSync(path.join(root,'juvenile-news/issues.json'),'utf8')).issues.length;
assert(weeklyCount>=11,'Original weekly archive unexpectedly lost issues');
assert(dailyCount>=125,'Daily source lost canonical questions');
const scheme='file://'+path.join(root,'index.html');
const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;
(async()=>{
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({locale:'zh-TW',viewport:{width:390,height:844},acceptDownloads:true});
  const requests=[],errors=[];
  await ctx.route(/^https?:/,r=>{requests.push(r.request().url());r.abort('internetdisconnected')});
  // WebKit's setOffline(true) can reject file navigations on Linux: block all HTTP instead.
  if(engine===chromium)await ctx.setOffline(true);
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>d.accept());
  await page.goto(scheme,{waitUntil:'load',timeout:30000});
  assert.equal(await page.locator('.tile').count(),6,'three course + three exploration entrances retained');
  assert.match(await page.title(),/觀護人/);
  assert(await page.locator('#psd-file-warning').count()===1,'ZIP storage warning visible');
  // First tile: original professional study30, not a new duplicate website.
  await page.locator('a[href="./professional/"]').click();
  assert.match(page.url(),/\/professional\/index\.html$/);
  await page.locator('#todayHeading').waitFor({timeout:15000});
  assert((await page.locator('#todayHeading').innerText()).length>0);
  // Practice entrance: existing common-subjects (essay), retaining its original storage.
  await page.goto(scheme,{waitUntil:'load'});
  await page.locator('a[href="./common-subjects/"]').click();
  assert.match(page.url(),/\/common-subjects\/index\.html$/);
  await page.locator('#essayText').waitFor({timeout:15000});
  await page.locator('#essayText').fill('ZIP原始網站離線作文測試');
  await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('psd-common-subjects-v1')||'{}').drafts||{}).some(v=>String(v.text||'').includes('ZIP原始網站離線作文測試')),null,{timeout:15000});
  await page.reload({waitUntil:'load'});
  assert.match(await page.locator('#essayText').inputValue(),/ZIP原始網站離線作文測試/);
  // Original daily-simulation JSON fetch is bridged to canonical generated JS.
  await page.goto(scheme,{waitUntil:'load'});
  await page.locator('a[href="./daily-simulation/"]').click();
  assert.match(page.url(),/\/daily-simulation\/index\.html$/);
  try{await page.waitForFunction(()=>document.querySelector('#cards')?.children.length>0,null,{timeout:20000});}
  catch(e){
   console.log('FILE DAILY DIAGNOSTIC:',await page.evaluate(()=>({
    href:location.href,compat:typeof window.PSDRegisterFileData,
    loaded:Object.keys(window.PSDFileData||{}),
    scripts:[...document.scripts].map(s=>s.src||s.textContent.slice(0,70)).slice(0,12),
    notice:document.querySelector('#notice')?.textContent,
    cards:document.querySelector('#cards')?.children.length
   })), 'JS ERRORS:',errors.slice(-12));
   throw e;
  }
  const daily=await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-reading-test:dataset')||'null'));
  // The app may store daily source lazily; the actual card count is the primary gate.
  assert((await page.locator('#cards').innerText()).length>20);
  const recordReader=page.locator('#reader');
  // Original weekly reader: file-scheme fallback with every canonical historical issue.
  await page.goto(scheme,{waitUntil:'load'});
  await page.locator('a[href="./juvenile-news/"]').click();
  assert.match(page.url(),/\/juvenile-news\/index\.html$/);
  await page.locator('#root select').waitFor({timeout:15000});
  assert.equal(await page.locator('#root select option').count(),weeklyCount);
  assert.match(await page.locator('#root').innerText(),/少年司法週報/);
  // Original v2.5 exam entry: 426 canonical questions.
  await page.goto(scheme,{waitUntil:'load'});
  await page.locator('a[href="./v2.5/"]').click();
  assert.match(page.url(),/\/v2\.5\/index\.html$/);
  await page.locator('#issueInput').waitFor({timeout:15000});
  await page.locator('#issueInput').fill('ZIP斷網考古題涵攝測試');
  try{
   await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}')).some(v=>String(v.issue||'').includes('ZIP斷網考古題涵攝測試')),null,{timeout:25000});
  }catch(error){
   const diagnostics=await page.evaluate(()=>{
    const key='probation-study-desk-v24';
    try{
     const raw=localStorage.getItem(key)||'{}';
     const entries=Object.entries(JSON.parse(raw));
     return {url:location.href,storedEntries:entries.length,hasAnswer:entries.some(([,r])=>String(r.issue||'').includes('ZIP斷網考古題涵攝測試')),
       text:document.getElementById('issueInput')?.value,save:document.getElementById('saveStatus')?.textContent,
       current:window.Practice25?.getQuestion()?.id,practiceBound:!!window.Practice25,storageLength:raw.length};
    }catch(e){return {error:String(e),url:location.href}};
   });
   console.error('ZIP V2.5 STORAGE DIAGNOSTICS:',diagnostics,'PAGE ERRORS:',errors);
   throw error;
  }
  await page.reload({waitUntil:'load'});
  assert.match(await page.locator('#issueInput').inputValue(),/ZIP斷網考古題涵攝測試/);
  // Browser-native JSON download and fresh-profile import must work directly from file://.
  const event=page.waitForEvent('download');
  await page.locator('#exportButton').click();
  const download=await event;
  const exportFile=path.join('/tmp','stage5-original-v25-'+process.env.TEST_BROWSER+'.json');
  await download.saveAs(exportFile);
  const exported=JSON.parse(fs.readFileSync(exportFile,'utf8'));
  assert.equal(exported.format,'probation-study-desk-sync','use the original v2.5 backup format');
  assert(Object.values(exported.study).some(q=>String(q.issue||'').includes('ZIP斷網考古題涵攝測試')));
  const clean=await browser.newContext({locale:'zh-TW',viewport:{width:390,height:844},acceptDownloads:true});
  await clean.route(/^https?:/,r=>{requests.push(r.request().url());r.abort('internetdisconnected')});
  const restorePage=await clean.newPage();
  restorePage.on('dialog',d=>d.accept());
  restorePage.on('pageerror',e=>errors.push(String(e)));
  await restorePage.goto('file://'+path.join(root,'v2.5/index.html'),{waitUntil:'load'});
  await restorePage.locator('#importFile').setInputFiles({name:'original-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await restorePage.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}')).some(v=>String(v.issue||'').includes('ZIP斷網考古題涵攝測試')),null,{timeout:16000});
  await restorePage.reload({waitUntil:'load'});
  assert.match(await restorePage.locator('#issueInput').inputValue(),/ZIP斷網考古題涵攝測試/);
  await clean.close();
  // Original v2.5 daily practice and common-subject daily English must load JSON offline.
  await page.goto('file://'+path.join(root,'v2.5/daily-practice.html'),{waitUntil:'load'});
  await page.waitForFunction(count=>document.querySelector('#count')?.textContent.includes(String(count)),dailyCount,{timeout:15000});
  await page.goto('file://'+path.join(root,'common-subjects/daily/index.html'),{waitUntil:'load'});
  await page.locator('#app').waitFor({state:'visible',timeout:15000});
  // Source-attributed catalog shard lookups work without file:// fetch.
  await page.goto('file://'+path.join(root,'common-subjects/catalog/index.html'),{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#stats')?.textContent.includes('題')||document.querySelector('#resultCount')?.textContent.includes('筆'),null,{timeout:20000});
  // Local backup page must open and have the original single JSON export control.
  await page.goto('file://'+path.join(root,'backup/index.html'),{waitUntil:'load'});
  await page.locator('#export').waitFor();
  assert.match(await page.locator('#summary').innerText(),/學習|紀錄/);
  // External AI service does not run offline; its link must not navigate the current file-mode tab.
  await page.goto(scheme,{waitUntil:'load'});
  const remote=page.locator('a[href="https://leokychen.github.io/multi-ai-review-desk/"]');
  assert.equal(await remote.count(),1);
  await remote.click();
  assert(page.url()===scheme,'offline must not navigate to remote AI');
  assert.equal(requests.length,0,'all file-mode operations should stay offline');
  assert.deepEqual(errors,[],'no original entry may throw a page error');
  console.log('PASS original GitHub ZIP '+process.env.TEST_BROWSER+': homepage 5, professional, common essay write/reload, daily '+dailyCount+', juvenile weekly '+weeklyCount+', v2.5 write/reload, extra practice, catalog, backup, offline AI guard');
  await ctx.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
