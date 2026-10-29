'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+p+(p.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('invalid');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'}[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('not found');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true});try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{window.PSD_LECTURES_IDB_TEST=true});
  await page.goto(`http://127.0.0.1:${server.address().port}/lectures/`);
  await page.fill('#courseName','測試課程');await page.fill('#courseCount','2');await page.fill('#courseDuration','60');
  await page.locator('#courseForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#lessonStat').textContent==='0／2');
  assert.equal(await page.evaluate(()=>localStorage.getItem('psd-lecture-planner-v1')),null);
  await page.locator('.lesson-actions button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#lessonStat').textContent==='1／2');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#lessonStat').textContent==='1／2');
  assert.equal(await page.evaluate(()=>localStorage.getItem('psd-lecture-planner-v1')),null);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${engine.name()}: learning planner IndexedDB save and reload`);
 }finally{await browser.close();}}
}finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
