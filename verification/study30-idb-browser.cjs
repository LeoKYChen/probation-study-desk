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
    assert.deepEqual(errors,[]);
    await ctx.close();console.log(`PASS ${engine.name()}: experimental daily UI migration, essay, AI feedback, reload and legacy retention`);
   }finally{await browser.close();}
  }
 }finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
