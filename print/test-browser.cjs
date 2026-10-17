'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),q=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions.json'))).questions[0];
const headers={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.css':'text/css;charset=utf-8'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),target;
 if(!name||name.endsWith('/'))name+='index.html';
 target=path.resolve(root,name);
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(target,(error,data)=>{if(error){res.writeHead(404).end('missing');return}
 res.writeHead(200,{'content-type':headers[path.extname(target)]||'application/octet-stream'}).end(data)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({locale:'zh-TW',viewport:{width:390,height:844}});
  await context.addInitScript(data=>{
   if(location.pathname!=='/print/'&&location.pathname!=='/print/index.html')return;
   const x={
    'probation-study30-v251:v1':{version:1,sessions:{'2026-10-17':{date:'2026-10-17',essayDrafts:{'115-少年事件處理法-1':{template:'law',outline:['夜間詢問','程序保障','個案涵攝','救濟'],fullAnswer:'正式申論正文'}},aiReviewTexts:{'115-少年事件處理法-1':'AI原評語：應核對現行法條'}}}},
    'probation-study-desk-v24':{'115-少年事件處理法-1':{issue:'考古題完整答題',essayDrafts:{issues:'爭點'},updatedAt:'2026-10-17T12:00:00Z'}},
    'probation-daily-github:records:v1':{[data.id]:{answer:'每日模擬正文',essayDrafts:{issues:'問題界定'},aiFeedback:'批改回饋',updatedAt:'2026-10-17T12:30:00Z'}},
    'psd-common-subjects-v1':{schema:'psd-common-subjects-v1',drafts:{'full:12':{text:'完整作文稿',versions:[{text:'原始版本',date:'2026-10-15T10:00:00Z'}],feedback:'教師回饋',nextAction:'重寫段落'}},english:{}}
   };
   for(const [key,value] of Object.entries(x))localStorage.setItem(key,JSON.stringify(value));
  },{id:q.id});
  const page=await context.newPage();
  const err=[];page.on('pageerror',e=>err.push(String(e)));
  await page.goto(base+'/print/?module=study30');
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('已讀取 '),{timeout:15000});
  assert.equal(await page.locator('#module').inputValue(),'study30');
  assert.match(await page.locator('#count').innerText(),/可列印 1 題/);
  await page.locator('#selectVisible').click();await page.locator('#preview').click();
  assert.match(await page.locator('#paper').innerText(),/夜間詢問/);
  assert.match(await page.locator('#paper').innerText(),/AI原評語/);
  assert.equal(await page.locator('.print-sheet').count(),1);
  await page.evaluate(()=>window.print=()=>{window.__printInvoked=true});
  await page.locator('#print').click();
  assert.equal(await page.evaluate(()=>window.__printInvoked),true);
  const pdf=await page.pdf({format:'A4',printBackground:false});
  assert(Buffer.isBuffer(pdf)&&pdf.subarray(0,5).toString()==='%PDF-','browser PDF must be produced');
  assert(pdf.length>3000,'PDF size must be plausible');
  await page.locator('#includeFeedback').uncheck();
  assert.doesNotMatch(await page.locator('#paper').innerText(),/AI原評語/);
  await page.locator('#module').selectOption('all');
  await page.locator('#selectVisible').click();await page.locator('#preview').click();
  assert.equal(await page.locator('.print-sheet').count(),4);
  const allText=await page.locator('#paper').innerText();
  for(const snippet of ['考古題完整答題','每日模擬正文','完整作文稿','原始版本'])assert(allText.includes(snippet),snippet);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('header').first().evaluate(e=>getComputedStyle(e).display),'none');
  assert.equal(await page.locator('.print-sheet').first().evaluate(e=>getComputedStyle(e).breakAfter),'page');
  const ok=await page.evaluate(()=>['probation-study30-v251:v1','probation-study-desk-v24','probation-daily-github:records:v1','psd-common-subjects-v1'].every(k=>!!localStorage.getItem(k)));
  assert(ok,'testing must preserve all existing keys');
  assert.deepEqual(err,[]);
  console.log('PASS: 4 saved categories; native print, A4 CSS, generated PDF, option filtering, mobile viewport, no JS errors');
  await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
