// Run with NODE_PATH pointing to Playwright. Synthetic fixtures only.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.css':'text/css;charset=utf-8'};
const server=http.createServer((req,res)=>{
 let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),abs;
 if(rel.endsWith('/')||!rel)rel+='index.html';
 abs=path.resolve(root,rel);
 if(!abs.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(abs,(error,data)=>{
  if(error){res.writeHead(404).end('missing');return}
  res.writeHead(200,{'content-type':mime[path.extname(abs)]||'application/octet-stream'}).end(data);
 });
});
const json=JSON.stringify;
const key='probation-study30-v251:v1',common='psd-common-subjects-v1',archive='psd-unified-backup-conflicts-v1';
const first={version:1,sessions:{'2026-10-17':{date:'2026-10-17',notes:['Mac記錄'],essayDrafts:{Q1:{fullAnswer:'Mac原答案'}}}}};
const newer={version:1,sessions:{'2026-10-17':{date:'2026-10-17',notes:['iPhone更新'],essayDrafts:{Q1:{fullAnswer:'iPhone不同答案'}}},'2026-10-18':{date:'2026-10-18',notes:['手機新增'],essayDrafts:{Q2:{fullAnswer:'新增題目'}}}}};
async function takeDownload(page,click){
 const event=page.waitForEvent('download');await click();
 const dl=await event,dir=fs.mkdtempSync('/tmp/backup-e2e-'),file=path.join(dir,'saved.json');
 await dl.saveAs(file);
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port, browser=await chromium.launch({headless:true});
 try{
  // Reproduce a clean learner profile that only visited two daily questions.
  const emptyCtx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'});
  const untouched=await emptyCtx.newPage();
  await untouched.goto(base+'/backup/');
  const emptySessions={version:1,sessions:{
   '2026-10-17':{date:'2026-10-17',mode:'30',questionId:'synthetic-Q1',phase:0,remaining:300,elapsed:0,notes:[],rating:null,finished:false},
   '2026-10-16':{date:'2026-10-16',mode:'30',questionId:'synthetic-Q2',phase:0,remaining:300,elapsed:0,notes:[],rating:null,finished:false}
  }};
  await untouched.evaluate(input=>{
   localStorage.setItem(input.key,JSON.stringify(input.sessions));
   localStorage.setItem('probation-study-desk-v24','{}');
  },{key,sessions:emptySessions});
  await untouched.reload();
  const emptySummary=await untouched.locator('#summary').innerText();
  assert.match(emptySummary,/已儲存的學習／閱讀紀錄：0 筆/);
  assert.match(emptySummary,/尚未開始的工作階段：2 筆/);
  assert.match(await untouched.locator('#modules').innerText(),/空白儲存區（0 筆）/);
  const zeroBundle=await takeDownload(untouched,()=>untouched.locator('#export').click());
  assert.deepEqual(JSON.parse(zeroBundle.data[key]),emptySessions,'export must preserve empty sessions unchanged');
  assert.equal(zeroBundle.data['probation-study-desk-v24'],'{}','an empty record map must be kept in backup');
  await emptyCtx.close();
  const a=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'});
  const page=await a.newPage();
  await page.goto(base+'/backup/');
  await page.evaluate(args=>{localStorage.setItem(args.key,JSON.stringify(args.first));localStorage.setItem(args.common,JSON.stringify({schema:args.common,drafts:{'full:12':{text:'一篇作文'}},english:{}}));}, {key,first,common});
  await page.reload();await page.locator('#export').waitFor();
  assert.match(await page.locator('#summary').innerText(),/已儲存的學習／閱讀紀錄：2 筆/);
  const bundle=await takeDownload(page,()=>page.locator('#export').click());
  assert.equal(bundle.format,'psd-unified-learning-backup');
  assert.equal(JSON.parse(bundle.data[key]).sessions['2026-10-17'].essayDrafts.Q1.fullAnswer,'Mac原答案');
  const b=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'});
  const phone=await b.newPage();await phone.goto(base+'/backup/');
  await phone.locator('#importFile').setInputFiles({name:'study.json',mimeType:'application/json',buffer:Buffer.from(json(bundle))});
  await phone.locator('#preview').waitFor({state:'visible'});
  assert.match(await phone.locator('#previewTable').innerText(),/專業科目每日30分鐘/);
  await takeDownload(phone,()=>phone.locator('#backupBefore').click());
  await phone.locator('#confirmSafe').check();await phone.locator('#confirmTabs').check();
  phone.on('dialog',dialog=>dialog.accept());
  await phone.locator('#restore').click();
  assert.match(await phone.locator('#message').innerText(),/完成匯入/);
  let restored=await phone.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  assert.equal(restored.sessions['2026-10-17'].essayDrafts.Q1.fullAnswer,'Mac原答案');
  await phone.reload();await phone.locator('#export').waitFor();
  // Re-import another phone after the same day was edited; never overwrite Mac.
  const conflicting={...bundle,data:{...bundle.data,[key]:json(newer)}};
  await phone.locator('#importFile').setInputFiles({name:'phone.json',mimeType:'application/json',buffer:Buffer.from(json(conflicting))});
  await phone.locator('#preview').waitFor({state:'visible'});
  assert.match(await phone.locator('#conflicts').innerText(),/1 筆/);
  await takeDownload(phone,()=>phone.locator('#backupBefore').click());
  await phone.locator('#confirmSafe').check();await phone.locator('#confirmTabs').check();await phone.locator('#restore').click();
  restored=await phone.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  assert.equal(restored.sessions['2026-10-17'].essayDrafts.Q1.fullAnswer,'Mac原答案');
  assert.equal(restored.sessions['2026-10-18'].essayDrafts.Q2.fullAnswer,'新增題目');
  const alts=await phone.evaluate(k=>JSON.parse(localStorage.getItem(k)),archive);
  assert.equal(alts.entries[0].incoming.essayDrafts.Q1.fullAnswer,'iPhone不同答案');
  const exportedConflicts=await takeDownload(phone,()=>phone.locator('#downloadConflicts').click());
  assert.equal(exportedConflicts.entries.length,1);
  await phone.reload();
  assert.match(await phone.locator('#summary').innerText(),/2 種學習資料/);
  console.log('PASS browser: Mac→phone JSON transfer, roundtrip reload, conflict archive, local-only file download, mobile viewport');
  await a.close();await b.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
