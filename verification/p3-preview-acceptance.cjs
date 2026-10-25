'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {pathToFileURL}=require('node:url'),pw=require('playwright');
const root=path.resolve(process.argv[2]||'.'),artifacts=process.env.PREVIEW_ARTIFACT_DIR;
const route='previews/p3-study-entry/index.html';
const expected=['study-desk','professional','common-subjects','lectures','daily-simulation','juvenile-news','v2.5','backup','offline'].map(x=>'../../'+x+'/index.html');
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.startsWith('/probation-study-desk/'))name=name.slice('/probation-study-desk'.length);
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':'text/html;charset=utf-8'});res.end(e?'missing':b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch();
  try{for(const mode of ['root','project-prefix','file']){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW'}),page=await context.newPage(),errors=[],unexpected=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://127.0.0.1:')||u.startsWith(pathToFileURL(root+path.sep).href))r.continue();else{unexpected.push(u);r.abort();}});
   const base=`http://127.0.0.1:${server.address().port}/`+(mode==='project-prefix'?'probation-study-desk/':'');
   const url=mode==='file'?pathToFileURL(path.join(root,route)).href:base+route;
   await page.goto(url);assert.equal(await page.locator('a.mainbtn').count(),1);assert.equal(await page.locator('a.tile').count(),6);
   assert.equal(await page.locator('a.mainbtn').getAttribute('href'),expected[0]);
   const links=await page.locator('a').evaluateAll(nodes=>nodes.map(a=>({href:a.getAttribute('href'),target:a.target,rel:a.rel})));
   assert.deepEqual(links.filter(x=>!x.href.startsWith('https:')).map(x=>x.href),expected);
   for(const href of expected){
    const local=path.resolve(root,'previews/p3-study-entry',href);assert(fs.statSync(local).isFile(),href);
    if(mode!=='file')assert.equal((await context.request.get(new URL(href,url).href)).status(),200,href);
    else assert(new URL(href,url).pathname.endsWith('/index.html'));
   }
   const external=links.find(x=>x.href.startsWith('https:'));assert.equal(external.href,'https://leokychen.github.io/multi-ai-review-desk/');assert.equal(external.target,'_blank');assert.match(external.rel,/noopener/);assert.match(external.rel,/noreferrer/);
   for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);const b=await page.locator('a.mainbtn').boundingBox();assert(b.x>=0&&b.x+b.width<=width);}
   await page.locator('a.mainbtn').focus();assert.equal(await page.evaluate(()=>document.activeElement.className),'mainbtn');
   // Intercept navigation to verify the CTA destination without executing any learning app.
   let destination;await page.route('**/study-desk/index.html',r=>{destination=r.request().url();r.fulfill({status:200,contentType:'text/html',body:'<title>Synthetic navigation target</title>'});});
   await page.keyboard.press('Enter');await page.waitForURL('**/study-desk/index.html');assert.equal(destination,new URL(expected[0],url).href);
   await page.goto(url);await page.setViewportSize({width:390,height:844});
   if(mode!=='file')assert.deepEqual(await page.evaluate(async()=>({keys:Object.keys(localStorage),dbs:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(x=>x.name):[]})),{keys:[],dbs:[]});
   if(artifacts){fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,`p3-${engine}-${mode}-390.png`),fullPage:true});}
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();
   console.log(`PASS P3 ${engine} ${mode}: CTA, six cards, 9 local paths, external safety, 4 widths, keyboard navigation, no storage or external requests`);
  }}finally{await browser.close();}
 }}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
