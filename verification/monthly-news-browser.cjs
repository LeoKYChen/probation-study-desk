'use strict';
// Actual published news -> in-memory v3 archive -> browser acceptance in Chromium/WebKit.
// Never changes the checked-out files, the live index, GitHub or Cloudflare.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {convert,loadNews}=require('../scripts/build-monthly-news.cjs');
const playwright=require('playwright');
const engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium';
assert(['chromium','webkit'].includes(engine),'Unsupported browser engine');
const root=path.resolve(process.argv[2]||'.'),index=convert(loadNews());
assert.equal(index.manifest.schemaVersion,3);
assert.equal(index.manifest.count,239,'Unexpected change in historical fixture count; review migration fixtures');
const archive=index.files;
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.woff':'font/woff','.png':'image/png'};
const requests=[];
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname.startsWith('/probation-study-desk/'))pathname=pathname.slice('/probation-study-desk'.length);
 const relative=pathname.replace(/^\/+/,''),key=relative.replace(/^daily-simulation\//,'');
 requests.push(relative);
 if(relative.startsWith('daily-simulation/')&&archive.has(key)){
  res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});
  res.end(archive.get(key));return;
 }
 let local=relative;if(!local||local.endsWith('/'))local+='index.html';
 const file=path.resolve(root,local);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{
  if(error){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store'}).end(bytes);
 });
});
const wait=(page,expected)=>page.waitForFunction(x=>{
 const text=document.getElementById('resultCount')?.textContent||'';
 return text.includes('共 '+x+' 份資料');
},expected);
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await playwright[engine].launch({headless:true});
 try{
  for(const prefix of ['/','/probation-study-desk/']){
   const context=await browser.newContext({locale:'zh-TW',timezoneId:'Asia/Taipei',
    viewport:{width:390,height:844},serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   const errors=[],bad=[];page.on('pageerror',e=>errors.push(String(e)));
   page.on('response',response=>{
    if(response.url().startsWith('http://127.0.0.1:')&&response.status()>=400)bad.push(response.status()+' '+response.url());
   });
   const base='http://127.0.0.1:'+server.address().port+prefix;
   const initialRequests=requests.length;
   await page.goto(new URL('daily-simulation/',base).href);
   await page.locator('#newsMonth option[value="2026-09"]').waitFor();
   await page.locator('button[data-tab="全部閱讀資料"]').first().click();
   await wait(page,20);
   assert.equal(await page.locator('#newsMonth').inputValue(),'2026-11');
   assert.equal(await page.locator('#total').innerText(),'239');
   const requestedOnEntry=requests.slice(initialRequests);
   assert(!requestedOnEntry.some(x=>x.includes('archives/2026-09/')||x.includes('archives/2026-10/')),
    'A visit to November must not download archived month manifests');
   await page.locator('#newsMonth').selectOption('2026-09');
   await wait(page,6);
   assert.equal(await page.locator('article.document-card').count(),6);
   const september=index.manifest.catalog.find(d=>d.month==='2026-09');
   assert(september);
   const article=page.locator('[data-doc-open="'+september.id+'"]').first();
   await article.click();
   await page.locator('#newsReader[open]').waitFor();
   assert.equal(await page.locator('#newsTitle').innerText(),september.title.replace(/\.md$/i,''));
   await page.locator('#newsBookmark').click();
   await page.locator('#newsRead').click();
   const bookmarks=await page.evaluate(()=>({
    saved:JSON.parse(localStorage.getItem('daily-reading-test:news-saved')),
    read:JSON.parse(localStorage.getItem('daily-reading-test:news-read'))
   }));
   assert(bookmarks.saved.includes(september.id)&&bookmarks.read.includes(september.id),'Archive reading state lost');
   await page.locator('#newsClose').click();
   await page.locator('#newsMonth').selectOption('2026-10');
   await wait(page,213);
   assert.equal(await page.locator('article.document-card').count(),213);
   await page.locator('#newsMonth').selectOption('2026-09');
   await wait(page,6);
   assert((await page.locator('[data-doc-save="'+september.id+'"]').first().innerText()).includes('★'),
    'Archive bookmark lost after month switching');
   const deepLink=new URL('daily-simulation/?document='+encodeURIComponent(september.id),base).href;
   await page.goto(deepLink);
   await page.locator('#newsReader[open]').waitFor();
   assert.equal(await page.locator('#newsTitle').innerText(),september.title.replace(/\.md$/i,''));
   assert.equal(await page.locator('#newsMonth').inputValue(),'2026-09');
   const persisted=await page.evaluate(()=>({
    saved:JSON.parse(localStorage.getItem('daily-reading-test:news-saved')),
    read:JSON.parse(localStorage.getItem('daily-reading-test:news-read'))
   }));
   assert(persisted.saved.includes(september.id)&&persisted.read.includes(september.id));
   assert.deepEqual(errors,[],'Unexpected browser JavaScript error');
   assert.deepEqual(bad,[],'Unexpected HTTP missing assets');
   console.log('PASS monthly archive browser:',engine,prefix,
    '239 published articles, lazy 20/213/6 month loads, historical deeplink, bookmarks and read status');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
