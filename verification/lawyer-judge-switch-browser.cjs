'use strict';
// 律師・司法官備考開關的瀏覽器檢查：預設關閉、開啟後出現入口並記住、進入律司頁面後兩邊紀錄互不覆蓋、
// 律司選擇題的常錯條文與章節顯示在重點整理頁、
// 跨分頁的 storage 事件不互相干擾、各寬度不產生頁面層級的水平捲動。
// 需要 Playwright；只使用測試用的瀏覽器設定檔，不碰任何真實學習紀錄。用法：node verification/lawyer-judge-switch-browser.cjs [截圖資料夾]
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),shots=process.argv[2]||'';
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const candidate=path.resolve(root,'.'+requested,requested.endsWith('/')?'index.html':'');
 if(!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(candidate,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(candidate)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
});
const WIDTHS=[320,360,375,390,414,430,600,768,1024,1280,1440];
const LJ_PAGES=['','mcq/','practice/','review/','study-desk/','backup/','v2.5/','official/','outline/'];
async function noOverflow(page,label){
 const r=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
 assert(r.sw<=r.cw,label+': page-level horizontal overflow '+r.sw+' > '+r.cw);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,scoring=origin+'/law-scoring/',lj=origin+'/lawyer-judge/';
 const launch={headless:true}; if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(launch);
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'zh-TW',timezoneId:'Asia/Taipei',hasTouch:true,serviceWorkers:'block'});
  const errors=[];
  const watch=p=>{p.on('pageerror',e=>errors.push(p.url()+' '+String(e.stack||e).split('\n').slice(0,3).join(' @ ')));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});};
  const page=await ctx.newPage();watch(page);

  // 1. 預設關閉：只有開關那一列，入口不顯示；既有紀錄沒有被寫入任何東西。
  await page.goto(scoring,{waitUntil:'load'});
  await page.waitForSelector('#q-heading:not(:empty)');
  assert.equal(await page.locator('#lj-enabled').isChecked(),false,'switch is off on first visit');
  assert.equal(await page.locator('#lj-links').isVisible(),false,'links are hidden while off');
  assert.equal(await page.evaluate(()=>localStorage.getItem('lawScoring.lawyerJudge.enabled')),null,'nothing is stored until the switch is used');
  const box=await page.locator('#lj-switch').boundingBox(),today=await page.locator('#today').boundingBox(),grid=await page.locator('.grid').boundingBox();
  assert(box.y>=today.y+today.height-1&&box.y+box.height<=grid.y+1,'switch sits between 今日清單 and the question');
  const label=await page.locator('.lj-switch-label').boundingBox();assert(label.height>=44,'switch touch target is at least 44px');
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'switch-off-390.png')});}

  // 觀護人這邊先放幾筆與律司同名的紀錄，稍後確認沒有被動到。
  const SHARED=['probation-study-desk-v24','psd-mcq-v1','probation-study30-v251:v1','psd-lecture-planner-v1'];
  await page.evaluate(keys=>{for(const k of keys)localStorage.setItem(k,JSON.stringify({owner:'probation',key:k}));},SHARED);
  const before=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return o;});

  // 2. 開啟：入口出現、重新整理後仍開啟；關閉後入口收起。
  await page.locator('#lj-enabled').check();
  assert.equal(await page.locator('#lj-links').isVisible(),true,'links appear when switched on');
  assert.equal(await page.evaluate(()=>localStorage.getItem('lawScoring.lawyerJudge.enabled')),'1');
  await page.reload({waitUntil:'load'});await page.waitForSelector('#q-heading:not(:empty)');
  assert.equal(await page.locator('#lj-enabled').isChecked(),true,'switch state survives reload');
  assert.equal(await page.locator('#lj-links').isVisible(),true);
  for(const w of WIDTHS){await page.setViewportSize({width:w,height:900});await noOverflow(page,'law-scoring switch on @'+w);
   for(const a of await page.locator('#lj-links a').all()){const b=await a.boundingBox();assert(b.height>=44,'link touch target @'+w);}}
  await page.setViewportSize({width:390,height:844});
  if(shots)await page.screenshot({path:path.join(shots,'switch-on-390.png')});
  await page.locator('#lj-enabled').uncheck();
  assert.equal(await page.locator('#lj-links').isVisible(),false,'links hide again when switched off');
  assert.equal(await page.evaluate(()=>localStorage.getItem('lawScoring.lawyerJudge.enabled')),'0');
  await page.locator('#lj-enabled').check();

  // 3. 每個入口都開得起來，而且是律司的頁面。
  const hrefs=await page.locator('#lj-links a').evaluateAll(as=>as.map(a=>a.href));
  assert(hrefs.length>=4&&hrefs.every(h=>h.startsWith(lj)),'links stay inside lawyer-judge/');
  for(const href of hrefs){const p=await ctx.newPage();watch(p);const r=await p.goto(href,{waitUntil:'load'});assert.equal(r.status(),200,href);assert(/律司/.test(await p.title()),'lawyer-judge page title: '+href);await p.close();}

  // 4. 律司頁面：分隔檔已生效，看不到觀護人的紀錄；寫入後觀護人的紀錄原封不動。
  const law=await ctx.newPage();watch(law);
  await law.goto(lj,{waitUntil:'load'});
  assert.equal(await law.evaluate(()=>window.__lsdeskStorageNamespace),'lj::');
  for(const k of SHARED)assert.equal(await law.evaluate(key=>localStorage.getItem(key),k),null,'lawyer-judge cannot see probation '+k);
  // 觀護人分頁監聽 storage 事件：律司寫入時只會看到 lj:: 開頭的鍵。
  await page.evaluate(()=>{window.__seen=[];window.addEventListener('storage',e=>window.__seen.push(e.key));});
  await law.evaluate(()=>{window.__seen=[];window.addEventListener('storage',e=>window.__seen.push(e.key));});
  await law.evaluate(keys=>{for(const k of keys)localStorage.setItem(k,JSON.stringify({owner:'lawyer-judge',key:k}));},SHARED);
  await page.waitForFunction(n=>window.__seen.length>=n,SHARED.length);
  assert.deepEqual(await page.evaluate(()=>window.__seen),SHARED.map(k=>'lj::'+k),'probation tab sees only prefixed keys');
  // 觀護人改自己的同名紀錄（其他鍵），律司分頁不會收到；觀護人直接改到律司的鍵時，律司收到還原後的鍵名。
  await page.evaluate(()=>{localStorage.setItem('probation-daily-github:records:v1','{}');localStorage.setItem('lj::cross-tab-probe','{"from":"other-tab"}');});
  await law.waitForFunction(()=>window.__seen.length>=1);
  assert.deepEqual(await law.evaluate(()=>window.__seen),['cross-tab-probe'],'lawyer-judge tab receives only its own keys, unprefixed');
  await page.evaluate(()=>{localStorage.removeItem('probation-daily-github:records:v1');localStorage.removeItem('lj::cross-tab-probe');});
  for(const k of SHARED)assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).owner,k),'probation','probation record intact: '+k);

  // 測試用的假資料不是律司各頁看得懂的格式，先清掉律司這邊的（觀護人那邊的留著，後面還要比對）。
  await law.evaluate(keys=>{for(const k of keys)localStorage.removeItem(k);},SHARED);
  for(const k of SHARED)assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).owner,k),'probation','removeItem in lawyer-judge leaves probation '+k);

  // 5. 走過律司主要頁面（含各寬度），確認導覽有回觀護人的連結、沒有錯誤、沒有水平捲動。
  for(const rel of LJ_PAGES){
   await law.goto(lj+rel,{waitUntil:'load'});
   await law.waitForSelector('.site-nav');
   const back=law.locator('.site-nav-host');
   assert.equal(await back.count(),1,'back link on '+rel);
   assert.equal(new URL(await back.getAttribute('href'),law.url()).href,scoring,'back link goes to 申論評分參考');
   for(const w of WIDTHS){await law.setViewportSize({width:w,height:900});await noOverflow(law,'lawyer-judge/'+rel+' @'+w);}
  }
  await law.setViewportSize({width:390,height:844});
  if(shots)await law.screenshot({path:path.join(shots,'lawyer-judge-nav-390.png')});
  // 在律司的選擇題頁真的作答一題，確認紀錄落在 lj:: 之下。
  await law.goto(lj+'mcq/',{waitUntil:'load'});
  const after=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return o;});
  for(const [k,v] of Object.entries(before))assert.equal(after[k],v,'probation key unchanged after visiting lawyer-judge: '+k);
  const added=Object.keys(after).filter(k=>!(k in before)&&k!=='lawScoring.lawyerJudge.enabled');
  assert(added.length>0&&added.every(k=>k.startsWith('lj::')),'every key written by lawyer-judge pages is prefixed: '+added.filter(k=>!k.startsWith('lj::')).join(','));
  await law.click('.site-nav-host');await law.waitForSelector('#lj-enabled');
  assert.equal(await law.locator('#lj-enabled').isChecked(),true,'back on 申論評分參考 with the switch still on');

  // 6. 律司選擇題的常錯條文與章節出現在重點整理頁的優先複習（刑法、刑訴才有），而且觀護人的紀錄沒有被寫入。
  const sum=await ctx.newPage();watch(sum);
  await sum.goto(scoring+'summaries.html',{waitUntil:'load'});
  await sum.locator('.sum-subject[data-slug="criminal-law"]').click();
  await sum.waitForSelector('#sum-weak:not([hidden])');
  assert.equal(await sum.locator('#sum-weak h3',{hasText:'律司選擇題'}).count(),0,'nothing shown before any lawyer-judge practice');
  // 在律司做一組通勤練習：前兩題故意答錯。
  await law.goto(lj+'mcq/#home',{waitUntil:'load'});await law.waitForSelector('#subject-groups input');
  await law.selectOption('#commute-subject','刑法');await law.click('#commute-20');await law.waitForSelector('#session-view:not([hidden])');
  const missed=[];
  for(let i=0;i<2;i++){
   const info=await law.evaluate(()=>{const st=JSON.parse(localStorage.getItem('psd-mcq-v1')),q=window.MCQ_BANK.find(x=>x.id===st.active.ids[st.active.idx]);return {id:q.id,wrong:['A','B','C','D'].find(L=>!q.acceptedAnswers.includes(L))};});
   missed.push(info.id);
   await law.locator('#question-card input[type=radio][value="'+info.wrong+'"]').check();await law.click('#submit-answer');await law.click('#next-question');
  }
  await law.click('#session-end');await law.waitForSelector('#result-view:not([hidden])');
  const summary=await page.evaluate(()=>JSON.parse(localStorage.getItem('lj::lsdesk-mcq-weak-v1')));
  assert.equal(summary.subjects['刑法'].wrong,2);assert.equal(summary.subjects['刑法'].done,2);
  const frozen=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith('lj::'))o[k]=localStorage.getItem(k);}return o;});
  await sum.reload({waitUntil:'load'});
  await sum.locator('.sum-subject[data-slug="criminal-law"]').click();
  await sum.waitForSelector('#sum-weak h3:has-text("律司選擇題")');
  const weakText=await sum.locator('#sum-weak').innerText();
  assert(/做過 2 題、目前錯 2 題/.test(weakText),'summary totals shown');
  for(const row of [...summary.subjects['刑法'].articles,...summary.subjects['刑法'].chapters])assert(weakText.includes(row.name),'row shown: '+row.name);
  assert.equal(new URL(await sum.locator('#sum-weak a[href*="lawyer-judge"]').getAttribute('href'),sum.url()).href,lj+'mcq/#home');
  for(const w of WIDTHS){await sum.setViewportSize({width:w,height:900});await noOverflow(sum,'summaries with lawyer-judge block @'+w);}
  await sum.setViewportSize({width:390,height:844});
  if(shots){await sum.locator('#sum-weak').scrollIntoViewIfNeeded();await sum.screenshot({path:path.join(shots,'summaries-lawyer-mcq-390.png')});}
  await sum.locator('.sum-subject[data-slug="criminal-procedure"]').click();
  await sum.waitForFunction(()=>document.getElementById('sum-title').textContent.includes('刑事訴訟'));
  assert.equal(await sum.locator('#sum-weak h3',{hasText:'律司選擇題'}).count(),0,'no block for a subject without lawyer-judge practice');
  await sum.locator('.sum-subject[data-slug="juvenile"]').click();
  await sum.waitForFunction(()=>document.getElementById('sum-title').textContent.includes('少年'));
  assert.equal(await sum.locator('#sum-weak h3',{hasText:'律司選擇題'}).count(),0,'no block for non-shared subjects');
  const frozenAfter=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith('lj::'))o[k]=localStorage.getItem(k);}return o;});
  delete frozen['lawScoring.summaries.v1'];delete frozenAfter['lawScoring.summaries.v1']; // 重點整理頁自己記住最後看的科目
  assert.deepEqual(frozenAfter,frozen,'showing the block writes nothing to probation records');

  assert.deepEqual(errors,[],'no page errors or failed requests');
  console.log('PASS lawyer-judge switch browser: off by default, persists, '+hrefs.length+' entries open, records separate both ways, '+LJ_PAGES.length+' pages without overflow');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
