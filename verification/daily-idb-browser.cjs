'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('invalid');const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};res.setHeader('Content-Type',(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('not found');}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const origin=`http://127.0.0.1:${server.address().port}`,question=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions.json'))).questions[0];
  for(const engine of (process.env.STUDY30_CHROMIUM_ONLY?[chromium]:[chromium,webkit])){
   const options={headless:true};if(process.env.STUDY30_CHROMIUM_PATH&&engine===chromium)options.executablePath=process.env.STUDY30_CHROMIUM_PATH;
   const browser=await engine.launch(options);
   try{
    const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Taipei'}),page=await context.newPage(),errors=[];
    let stage='initial';
    page.on('pageerror',e=>errors.push({stage,page:page.url(),message:e.message,stack:e.stack}));
    await page.goto(origin+'/daily-simulation/');
    const legacy=JSON.stringify({[question.id]:{answer:'舊的每日答案',review:false,updatedAt:'2099-01-01'}}),favorites=JSON.stringify([question.id]);
    await page.evaluate(({legacy,favorites})=>{localStorage.setItem('probation-daily-github:records:v1',legacy);localStorage.setItem('daily-reading-test:saved',favorites);},{legacy,favorites});
    await context.addInitScript(()=>{window.PSD_DAILY_IDB_TEST=true;window.PSD_STUDY30_IDB_TEST=true});
    stage='migration reload';await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#total').textContent)>0);
    await page.locator(`[data-open="${question.id}"]`).first().click();
    assert.equal(await page.locator('#answer').inputValue(),'舊的每日答案');
    await page.locator('#answer').fill('每日 IndexedDB 新答案');
    await page.waitForFunction(()=>document.querySelector('#draftStatus').textContent.includes('已自動儲存'));
    await page.locator('#aiFeedback').fill('每日 AI 評語');
    await page.waitForFunction(()=>document.querySelector('#feedbackStatus').textContent.includes('已保存'));
    await page.locator('#bookmark').click();
    await page.waitForFunction(()=>document.querySelector('#bookmark').getAttribute('aria-pressed')==='false');
    assert.equal(await page.evaluate(()=>localStorage.getItem('probation-daily-github:records:v1')),legacy);
    assert.equal(await page.evaluate(()=>localStorage.getItem('daily-reading-test:saved')),favorites);
    stage='saved reload';await page.reload();await page.waitForFunction(()=>Number(document.querySelector('#total').textContent)>0);
    await page.locator(`[data-open="${question.id}"]`).first().click();
    assert.equal(await page.locator('#answer').inputValue(),'每日 IndexedDB 新答案');
    assert.equal(await page.locator('#aiFeedback').inputValue(),'每日 AI 評語');
    assert.equal(await page.locator('#bookmark').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('#import').isDisabled(),true);assert.equal(await page.locator('#clearRecords').isDisabled(),true);
    stage='v2.5 navigation';await page.goto(origin+'/v2.5/daily-practice.html?question='+encodeURIComponent(question.id));
    await page.waitForFunction(()=>!document.querySelector('#workspace').hidden);
    assert.equal(await page.locator('#answer').inputValue(),'每日 IndexedDB 新答案');
    assert.equal(await page.locator('#aiFeedback').inputValue(),'每日 AI 評語');
    await page.locator('#answer').fill('v2.5 寫入同一題');
    await page.waitForFunction(()=>document.querySelector('#saved').textContent==='已保存');
    assert.equal(await page.locator('#import').isDisabled(),true);assert.equal(await page.locator('#clear').isDisabled(),true);
    // Transitional protection export must read the migrated daily answer from
    // IndexedDB, rather than the retained legacy copy.
    stage='backup navigation';await page.goto(origin+'/professional/');await page.waitForFunction(()=>!!window.Study30App?.essayContext());
    const detail=page.locator('#importBackupFile').locator('xpath=ancestor::details').first();await detail.locator('summary').first().click();
    const download=page.waitForEvent('download');await page.locator('#downloadBeforeImport').click();const file=await download;
    const bundle=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
    assert.equal(JSON.parse(bundle.data['probation-daily-github:records:v1'])[question.id].answer,'v2.5 寫入同一題');
    assert.deepEqual(JSON.parse(bundle.data['daily-reading-test:saved']),[]);
    stage='print navigation';await page.goto(origin+'/print/?module=daily');
    await page.waitForFunction(()=>document.querySelectorAll('#recordList input').length>0);
    await page.locator('#selectVisible').click();await page.locator('#preview').click();
    assert.ok((await page.locator('#paper').innerText()).includes('v2.5 寫入同一題'));
    assert.ok((await page.locator('#paper').innerText()).includes('每日 AI 評語'));
    stage='daily return';await page.goto(origin+'/daily-simulation/');await page.waitForFunction(()=>Number(document.querySelector('#total').textContent)>0);
    await page.locator(`[data-open="${question.id}"]`).first().click();
    assert.equal(await page.locator('#answer').inputValue(),'v2.5 寫入同一題');
    assert.equal(await page.locator('#aiFeedback').inputValue(),'每日 AI 評語');
    assert.equal(await page.evaluate(()=>localStorage.getItem('probation-daily-github:records:v1')),legacy);
    assert.equal(await page.evaluate(()=>localStorage.getItem('daily-reading-test:saved')),favorites);
    stage='stale tab';const stale=await context.newPage();stale.on('pageerror',e=>errors.push({stage,page:stale.url(),message:e.message,stack:e.stack}));
    await stale.goto(origin+'/v2.5/daily-practice.html?question='+encodeURIComponent(question.id));
    await stale.waitForFunction(()=>!document.querySelector('#workspace').hidden);
    await page.locator('#answer').fill('每日頁較新版本');
    await page.waitForFunction(()=>document.querySelector('#draftStatus').textContent.includes('已自動儲存'));
    await stale.locator('#answer').fill('v2.5 過期版本');
    await stale.waitForFunction(()=>document.querySelector('#saved').textContent==='尚未保存');
    let raw=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const value=await db.get('probation-daily-github:records:v1');db.close();return value;});
    assert.ok(raw.includes('每日頁較新版本'));assert.ok(!raw.includes('v2.5 過期版本'));
    stage='quota';await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(k==='probation-daily-github:records:v1')throw new DOMException('full','QuotaExceededError');return put.call(this,v,k);};});
    await page.locator('#answer').fill('容量不足未保存版本');
    await page.waitForFunction(()=>document.querySelector('#draftStatus').textContent.includes('儲存失敗'));
    raw=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const value=await db.get('probation-daily-github:records:v1');db.close();return value;});
    assert.ok(raw.includes('每日頁較新版本'));assert.ok(!raw.includes('容量不足未保存版本'));
    assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${engine.name()}: shared daily/v2.5 gated IndexedDB, favorites, AI, reload and legacy retention`);
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
