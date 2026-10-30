'use strict';
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname),name=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));
  if(!name.startsWith(root+path.sep))throw Error('invalid path');
  const ext=path.extname(name),types={'.mjs':'application/javascript','.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};
  res.setHeader('Content-Type',(types[ext]||'application/octet-stream')+'; charset=utf-8');
  res.end(fs.readFileSync(name));
 }catch{res.statusCode=404;res.end('not found');}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const engine of (process.env.STUDY30_CHROMIUM_ONLY ? [chromium] : [chromium,webkit])){
   const launch={headless:true};if(process.env.STUDY30_CHROMIUM_PATH&&engine===chromium)launch.executablePath=process.env.STUDY30_CHROMIUM_PATH;
   const browser=await engine.launch(launch);
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
    const stale=await ctx.newPage();stale.on('pageerror',e=>errors.push(e.message));
    await stale.goto(origin+'/professional/');await stale.waitForFunction(()=>!!window.Study30App?.essayContext());
    await page.locator('#essayField0').fill('較新的頁面內容');
    await page.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('已自動保存'));
    await stale.locator('#essayField0').fill('舊頁面不可覆寫');
    await stale.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('未能保存'));
    const checkNew=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const raw=await db.get('probation-study30-v251:v1');db.close();return raw;});
    assert.ok(checkNew.includes('較新的頁面內容'));assert.ok(!checkNew.includes('舊頁面不可覆寫'));
    await stale.close();
    await page.locator('#essayField0').fill('IndexedDB 申論草稿');
    await page.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('已自動保存'));
    // Import a divergent answer in test mode. The IDB primary and conflict archive
    // must both survive; the original localStorage value must stay intact.
    const imported=await page.evaluate(async()=>{
      const db=await PSDLearningStorage.open();const raw=await db.get('probation-study30-v251:v1');db.close();
      const doc=JSON.parse(raw),ctx=window.Study30App.essayContext();
      doc.sessions[ctx.date].essayDrafts[ctx.questionId].outline[0]='另一版本';
      return {format:'probation-study30-v253',version:1,exportedAt:new Date().toISOString(),data:doc};
    });
    page.on('dialog',dialog=>dialog.accept());
    const backupDetails=page.locator('#importBackupFile').locator('xpath=ancestor::details').first();
    await backupDetails.locator('summary').first().click();
    await page.locator('#importBackupFile').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.querySelector('#importPreview').textContent.includes('衝突'));
    const download=page.waitForEvent('download',{timeout:5000}).catch(async e=>{throw Error(JSON.stringify({status:await page.locator('#importStatus').innerText(),preview:await page.locator('#importPreview').innerText(),errors})+'; '+e.message)});await page.locator('#downloadBeforeImport').click();await download;
    await page.locator('#importBackupConfirmed').check();
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:10000}),page.locator('#importExecute').click()]);
    await page.waitForFunction(()=>!!window.Study30App?.essayContext());
    assert.equal(await page.locator('#essayField0').inputValue(),'IndexedDB 申論草稿');
    const archive=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const raw=await db.get('psd-unified-backup-conflicts-v1');db.close();return raw});
    assert.ok(archive&&archive.includes('另一版本'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study30-v251:v1')),old);
    assert.equal(await page.locator('#driveSyncPanel').isHidden(),true);
    await page.goto(origin+'/backup/');
    await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('完整備份尚未整合'));
    assert.equal(await page.locator('#export').isDisabled(),true);
    assert.equal(await page.locator('#importFile').isDisabled(),true);
    await page.waitForFunction(()=>document.querySelectorAll('#study30ConflictList details').length>0);
    const conflict=page.locator('#study30ConflictList details').first();await conflict.locator('summary').click();
    const protect=page.waitForEvent('download');await page.locator('#study30ConflictBackup').click();await protect;
    await page.locator('#study30ConflictConfirmed').check();
    await conflict.locator('button.restoreStudy30').nth(1).click();
    await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('已恢復選擇的版本'));
    const restored=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const value=await db.get('probation-study30-v251:v1'),archive=await db.get('psd-unified-backup-conflicts-v1');db.close();return {value,archive};});
    assert.ok(restored.value.includes('另一版本'));assert.ok(restored.archive.includes('IndexedDB 申論草稿'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('probation-study30-v251:v1')),old);
    assert.deepEqual(errors,[]);
    await ctx.close();
    const quota=await browser.newContext({serviceWorkers:'block',timezoneId:'Asia/Taipei'});
    await quota.route('https://accounts.google.com/**',route=>route.abort());
    await quota.addInitScript(()=>{window.PSD_STUDY30_IDB_TEST=true});
    const quotaPage=await quota.newPage(),quotaErrors=[];quotaPage.on('pageerror',e=>quotaErrors.push(e.message));
    await quotaPage.goto(origin+'/professional/');await quotaPage.waitForFunction(()=>!!window.Study30App?.essayContext());
    await quotaPage.evaluate(()=>window.Study30App.whenSaved());
    await quotaPage.locator('#essayField0').fill('容量測試前內容');
    await quotaPage.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('已自動保存'));
    await quotaPage.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(k==='probation-study30-v251:v1')throw new DOMException('full','QuotaExceededError');return put.call(this,v,k);};});
    await quotaPage.locator('#essayField0').fill('容量不足時的內容');
    await quotaPage.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('未能保存'));
    const intact=await quotaPage.evaluate(async()=>{const db=await PSDLearningStorage.open();const raw=await db.get('probation-study30-v251:v1');db.close();return raw});
    assert.ok(intact.includes('容量測試前內容'));assert.ok(!intact.includes('容量不足時的內容'));assert.deepEqual(quotaErrors,[]);
    await quota.close();
    console.log(`PASS ${engine.name()}: daily UI, stale tab, JSON conflict import and quota failure`);
    const offline=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Taipei'});
    await offline.route('https://accounts.google.com/**',route=>route.abort());
    await offline.addInitScript(()=>{window.PSD_STUDY30_IDB_TEST=true});
    const offlinePage=await offline.newPage();
    await offlinePage.goto(origin+'/professional/');
    await offlinePage.waitForFunction(()=>!!window.Study30App?.essayContext());
    await offlinePage.locator('#essayField0').fill('離線還原驗證');
    await offlinePage.waitForFunction(()=>document.querySelector('#essaySaveStatus').textContent.includes('已自動保存'));
    await offlinePage.waitForFunction(()=>document.querySelector('#offlineStatus')?.textContent.includes('離線資料已就緒'),null,{timeout:30000});
    await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
    await offline.setOffline(true);
    try { await offlinePage.goto(origin+'/professional/'); }
    catch (error) {
      // Diagnostic only: keep the offline-emulation failure visible in CI.
      if (engine===webkit) {
        await offline.setOffline(false);
        const port=server.address().port;
        await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
        try {
          await offlinePage.goto(origin+'/professional/');
          await offlinePage.waitForFunction(()=>!!window.Study30App?.essayContext(),null,{timeout:10000});
          assert.equal(await offlinePage.locator('#essayField0').inputValue(),'離線還原驗證');
          console.error('WebKit diagnostic: origin unavailable; cached page and stored draft restored successfully');
        } catch(e) { console.error('WebKit diagnostic: origin unavailable; cached page failed:',e.message); }
        finally { await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve)); }
      }
      throw error;
    }
    await offlinePage.waitForFunction(()=>!!window.Study30App?.essayContext());
    assert.equal(await offlinePage.locator('#essayField0').inputValue(),'離線還原驗證');
    await offline.close();
    console.log(`PASS ${engine.name()}: daily UI, stale tab, JSON conflict import, quota failure and offline reload`);
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
