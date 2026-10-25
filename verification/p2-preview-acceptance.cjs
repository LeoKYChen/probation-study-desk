'use strict';
// All contexts are fresh, synthetic and local; no user browser profile or backup file.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const pw=require('playwright');
const root=path.resolve(process.argv[2]||'.'),artifact=process.env.PREVIEW_ARTIFACT_DIR;
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':'text/html;charset=utf-8'});res.end(e?'missing':b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch();
  try {for(const transport of ['http','file']){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei'});
   const page=await context.newPage(),errors=[],unexpected=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith('http://127.0.0.1:')||u.startsWith(pathToFileURL(root+path.sep).href))route.continue();else{unexpected.push(u);route.abort();}});
   const rel='previews/p2-backup-reminder/index.html';
   await page.goto(transport==='http'?`http://127.0.0.1:${server.address().port}/${rel}`:pathToFileURL(path.join(root,rel)).href);
   const status=s=>page.locator('#'+s+'-status'),action=(s,a)=>page.locator(`button[data-scope="${s}"][data-action="${a}"]`),days=page.locator('#days');
   await days.fill('6');assert.match(await status('desk').textContent(),/距今 6 天/);
   await days.fill('7');assert.equal(await status('desk').textContent(),'需備份','7 complete days must remind');
   await action('desk','download').click();assert.equal(await status('desk').textContent(),'需備份');assert.match(await page.locator('#desk-reminder').textContent(),/不等於檔案已確認保存/);
   await action('desk','confirm').click();assert.match(await status('desk').textContent(),/距今 0 天/);assert.equal(await status('legacy').textContent(),'需備份');
   await days.fill('13');assert.match(await status('desk').textContent(),/距今 6 天/);
   await days.fill('14');assert.equal(await status('desk').textContent(),'需備份');
   await action('desk','snooze').click();assert.match(await status('desk').textContent(),/第 15 天/);assert.equal(await status('legacy').textContent(),'需備份');
   assert.equal(await page.locator('#desk-reminder').isVisible(),false);
   await days.fill('15');assert.equal(await status('desk').textContent(),'需備份');assert.equal(await page.locator('#desk-reminder').isVisible(),true);
   await action('legacy','confirm').click();assert.equal(await status('desk').textContent(),'需備份');
   await action('legacy','unknown').click();assert.match(await page.locator('#legacy-reminder').textContent(),/尚無已確認保存/);
   for(const invalid of ['', '-1','1.5','366']){await days.fill(invalid);assert.equal(await days.getAttribute('aria-invalid'),'true');assert.equal(await status('desk').textContent(),'需備份');}
   await days.fill('15');assert.equal(await days.getAttribute('aria-invalid'),null);
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);}
   await page.setViewportSize({width:390,height:844});
   await action('desk','confirm').focus();await page.keyboard.press('Enter');assert.match(await status('desk').textContent(),/距今 0 天/);
   await page.reload();assert.equal(await status('desk').textContent(),'需備份');assert.equal(await days.inputValue(),'8');
   if(transport==='http')assert.deepEqual(await page.evaluate(async()=>({keys:Object.keys(localStorage),dbs:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(d=>d.name):[]})),{keys:[],dbs:[]});
   if(artifact){fs.mkdirSync(artifact,{recursive:true});await page.screenshot({path:path.join(artifact,`p2-${engine}-${transport}-390.png`),fullPage:true});}
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();
   console.log(`PASS P2 ${engine} ${transport}: boundary, independent confirmation, finite snooze, unknown, invalid input, 4 widths, keyboard, reload, no external requests`);
  }}finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
