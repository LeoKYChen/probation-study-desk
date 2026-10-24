'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{
  try{
   let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.css':'text/css','.json':'application/json','.woff':'font/woff'})[path.extname(file)]||'text/plain');
   res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const engine=process.env.PSD_BROWSER_ENGINE==='webkit'?webkit:chromium;
 const options={headless:true};
 if(process.env.BROWSER_EXECUTABLE)options.executablePath=process.env.BROWSER_EXECUTABLE;
 if(engine===chromium)options.args=['--no-sandbox','--disable-dev-shm-usage'];
 const browser=await engine.launch(options);
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[],outside=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(!url.startsWith(base+'/')){outside.push(url);await route.abort();}
  else await route.continue();
 });
 try{
  await page.goto(base+'/backup/');
  await page.locator('#firebase-hub').waitFor({state:'visible'});
  assert.equal(await page.locator('#firebase-user').textContent(),'未登入');
  assert.equal(outside.length,0,'Firebase SDK and auth are not loaded without user consent');
  await page.evaluate(()=>{
   localStorage.setItem('jj-read',JSON.stringify(['topic-1']));
   localStorage.setItem('private-unknown-key','must-never-upload');
  });
  await page.reload();
  await page.locator('#firebase-hub').waitFor({state:'visible'});
  const download=page.waitForEvent('download');
  await page.locator('#export').click();
  const json=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
  assert.deepEqual(JSON.parse(json.data['jj-read']),['topic-1']);
  assert.equal(Object.hasOwn(json.data,'private-unknown-key'),false);
  await page.locator('#firebase-preview-btn').click();
  await page.waitForFunction(()=>document.querySelector('#firebase-status').textContent.includes('請先用 Google 帳號登入'));
  assert.equal(await page.locator('#firebase-apply').isDisabled(),true);
  assert.equal(outside.length,0,'preview and manual export remain offline, without Firebase auth');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('PASS Firebase whole-site UI remains manual, offline-safe, and no external calls before opt-in');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
