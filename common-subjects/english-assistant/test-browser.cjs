/* Browser-level smoke acceptance in temporary CI Chromium, never touches real user data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const mime={'.js':'application/javascript;charset=utf-8','.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8'};
async function main(){
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let p=decodeURIComponent(url.pathname);
  if(p.endsWith('/'))p+='index.html';
  const filename=path.resolve(root,'.'+p);
  if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(filename,(err,data)=>{
   if(err){res.writeHead(404);return res.end('not found')}
   res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  });
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const address='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true,locale:'zh-TW'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(address+'/common-subjects/english-assistant/',{waitUntil:'domcontentloaded'});
  await page.locator('#newWords .word-card').first().waitFor();
  assert.equal(await page.locator('#newWords .word-card').count(),6,'six word cards in real browser');
  assert.match(await page.locator('#newWords .word-card').first().innerText(),/evidence/);
  assert.equal(await page.locator('#newWords .word-card .desc').first().isVisible(),false,'Chinese hidden until user flips');
  await page.locator('#newWords .word-card').first().getByRole('button',{name:'顯示中文與例句'}).click();
  assert.equal(await page.locator('#newWords .word-card .desc').first().isVisible(),true);
  assert.match(await page.locator('#newWords .word-card .desc').first().innerText(),/證據/);
  await page.evaluate(()=>{localStorage.setItem('psd-common-subjects-v1','PRESERVE-ORIGINAL80');localStorage.setItem('psd-staresto-daily-v04','PRESERVE-668')});
  await page.locator('#newWords .word-card').first().getByRole('button',{name:'記住了'}).click();
  assert.match(await page.locator('#wordStatus').innerText(),/新字 1\/6/);
  await page.locator('#personalTerm').fill('resilience');
  await page.locator('#personalMeaning').fill('韌性');
  await page.getByRole('button',{name:'加入字庫'}).click();
  assert.match(await page.locator('#alert').innerText(),/已將/);
  const firstLink=await page.locator('#tasks .card a').first().getAttribute('href');
  assert.match(firstLink,/#set-V0491,V0492,V0493,V0494,V0495/);
  await page.locator('#tasks .card').first().locator('input').first().fill('4');
  await page.locator('#tasks .card').first().locator('input').last().fill('5');
  await page.locator('#tasks .card').first().getByRole('button',{name:'我已完成'}).click();
  assert.match(await page.locator('#progress').innerText(),/1／/);
  let snapshot=await page.evaluate(()=>({data:JSON.parse(localStorage.getItem('psd-staresto-link-coach-v06')),old80:localStorage.getItem('psd-common-subjects-v1'),old668:localStorage.getItem('psd-staresto-daily-v04')}));
  assert.equal(snapshot.old80,'PRESERVE-ORIGINAL80');assert.equal(snapshot.old668,'PRESERVE-668');
  assert.equal(snapshot.data.wordProgress['core-evidence'].attempts.length,1);
  assert.ok(snapshot.data.customWords['mine-resilience']);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('#wordStatus').innerText(),/新字 1\/6/);
  assert.match(await page.locator('#progress').innerText(),/1／/);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'匯出 JSON 備份'}).click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/staresto-v06-.*\.json/);
  const content=await new Promise((resolve,reject)=>{
   const chunks=[];download.createReadStream().then(stream=>{
    stream.on('data',c=>chunks.push(c));stream.on('error',reject);stream.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
   },reject);
  });
  const exported=JSON.parse(content);
  assert.equal(exported.wordProgress['core-evidence'].attempts.length,1);
  assert.ok(exported.customWords['mine-resilience']);
  await page.goto(address+'/common-subjects/',{waitUntil:'domcontentloaded'});
  await page.locator('#tabEnglish').click();
  assert.equal(await page.locator('#legacy80Practice').isVisible(),false);
  await page.locator('#tabRecords').click();
  assert.equal(await page.locator('#legacy80ResetControls').isVisible(),false);
  assert.equal(await page.locator('#legacy80Stats').isVisible(),false);
  assert.deepEqual(errors,[],'no unexpected browser JS runtime errors');
  await context.close();
  console.log('PASS browser acceptance: 6 flashcards, scoring, reload, original-80 hidden, legacy localStorage isolated, backup download');
 }finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
