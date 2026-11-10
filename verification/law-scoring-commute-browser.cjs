'use strict';
// 通勤模式瀏覽器檢查：三組卡片的翻面、評分、復原、跳過、續讀，以及各寬度不產生頁面層級的水平捲動。
// 需要 Playwright；只使用測試用的瀏覽器設定檔，不碰任何真實學習紀錄。用法：node verification/law-scoring-commute-browser.cjs [截圖資料夾]
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),shots=process.argv[2]||'';
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const candidate=path.resolve(root,'.'+requested,requested.endsWith('/')?'index.html':'');
 if(!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(candidate,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(candidate)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
});
const WIDTHS=[320,360,375,390,414,430,600,768,1024,1280,1440];
const vis=(page,sel)=>page.locator(sel).isVisible();
const text=(page,sel)=>page.locator(sel).innerText();
const store=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function noOverflow(page,label){
 const r=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
 assert(r.sw<=r.cw,label+': page-level horizontal overflow '+r.sw+' > '+r.cw);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/law-scoring/';
 const launch={headless:true}; if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(launch);
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'zh-TW',timezoneId:'Asia/Taipei',hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(page.url()+' '+String(e.stack||e).split('\n').slice(0,3).join(' @ '))); page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});

  // 空白瀏覽器：沒有失分卡，從第一組有卡片的（考點回想）開始
  await page.goto(base+'commute.html',{waitUntil:'load'});
  assert.equal(await text(page,'#cm-count-miss'),'完成'); assert.equal(await text(page,'#cm-count-topic'),'剩 5 張'); assert.equal(await text(page,'#cm-count-theory'),'剩 10 張');
  assert.equal(await page.locator('[data-deck="topic"]').getAttribute('aria-pressed'),'true');
  assert(await vis(page,'#cm-card')); assert(!(await vis(page,'#cm-back'))); assert(await vis(page,'#cm-reveal')); assert(await vis(page,'#cm-hint'));
  assert(!(await vis(page,'.study-header nav')),'main nav is folded away on phones'); assert(await vis(page,'.cm-links'));
  // 操作鈕在螢幕底部、夠大
  const bar=await page.locator('#cm-reveal').boundingBox(); assert(bar.height>=56&&bar.y+bar.height<=844&&bar.y>844-140,'reveal button sits in the thumb zone');
  // 點卡片：題面 → 提示 → 答案
  const firstTopic=await text(page,'#cm-title');
  await page.locator('#cm-title').click(); assert(await vis(page,'#cm-hints')); assert(!(await vis(page,'#cm-back'))); assert(!(await vis(page,'#cm-hint')));
  await page.locator('#cm-title').click(); assert(await vis(page,'#cm-back')); assert(await vis(page,'#cm-rate3')); assert(!(await vis(page,'#cm-front-actions')));
  assert((await text(page,'#cm-content')).length>40,'full content is shown');
  for(const b of await page.locator('#cm-rate3 .btn').all()){ const r=await b.boundingBox(); assert(r.height>=56&&r.width>=90,'rating buttons are large'); }
  // 續讀：重新整理後回到同一組、同一張、同一面
  let pos=await store(page,'lawScoring.commute.v1'); assert.equal(pos.deck,'topic'); assert.equal(pos.stage,'back');
  await page.reload({waitUntil:'load'});
  assert.equal(await text(page,'#cm-title'),firstTopic); assert(await vis(page,'#cm-back')); assert.equal(await text(page,'#cm-status'),'已回到上次的位置。');
  // 評分寫進考點回想原本的紀錄；下一張回到題面
  await page.locator('#cm-rate3 [data-rate="good"]').click();
  let tr=await store(page,'lawScoring.topicRecall.v1'); let ids=Object.keys(tr).filter(k=>!k.startsWith('__')); assert.equal(ids.length,1); assert.equal(tr[ids[0]].box,2);
  assert.notEqual(await text(page,'#cm-title'),firstTopic); assert(!(await vis(page,'#cm-back'))); assert.equal(await text(page,'#cm-count-topic'),'剩 4 張');
  assert((await text(page,'#cm-progress')).includes('做完 1 張'));
  // 復原上一張
  assert(await vis(page,'#cm-undo')); await page.locator('#cm-undo').click();
  tr=await store(page,'lawScoring.topicRecall.v1'); assert.equal(Object.keys(tr).filter(k=>!k.startsWith('__')).length,0,'undo restores the stored records');
  assert.equal(await text(page,'#cm-title'),firstTopic); assert(await vis(page,'#cm-back')); assert(!(await vis(page,'#cm-undo')));
  // 先跳過：排到最後
  await page.locator('#cm-skip').click(); assert.notEqual(await text(page,'#cm-title'),firstTopic); assert.equal(await text(page,'#cm-count-topic'),'剩 5 張');
  for(let i=0;i<4;i++){ await page.locator('#cm-reveal').click(); await page.locator('#cm-rate3 [data-rate="partial"]').click(); }
  assert.equal(await text(page,'#cm-title'),firstTopic,'skipped card returns last');
  await page.locator('#cm-reveal').click(); await page.locator('#cm-rate3 [data-rate="again"]').click();
  // 做完：可加開新卡、可換組
  assert(await vis(page,'#cm-empty')); assert((await text(page,'#cm-empty-title')).includes('考點回想今天做完了')); assert.equal(await text(page,'#cm-count-topic'),'完成');
  assert.equal(await page.locator('#cm-empty-actions .btn').count(),2,'more new cards + the one other deck with cards');
  await page.locator('#cm-empty-actions .btn').first().click(); assert.equal(await text(page,'#cm-count-topic'),'剩 5 張');
  // 考點回想頁看得到同一份進度
  await page.goto(base+'review.html#topics',{waitUntil:'load'}); assert((await text(page,'#tr-summary')).includes('複習中 5 張'));
  await page.goto(base+'commute.html',{waitUntil:'load'});

  // 理論卡：沒有提示，一次翻開；紀錄另存
  await page.locator('[data-deck="theory"]').click(); assert(!(await vis(page,'#cm-hint'))); assert(await vis(page,'#cm-context'));
  const th1=await text(page,'#cm-title'); await page.locator('#cm-card').click({position:{x:20,y:20}}); assert(await vis(page,'#cm-back')); assert((await text(page,'#cm-content')).includes(th1));
  await page.locator('#cm-rate3 [data-rate="good"]').click();
  const th=await store(page,'lawScoring.theoryCards.v1'); assert.equal(Object.keys(th).length,1); assert.equal(await text(page,'#cm-count-theory'),'剩 9 張');
  assert.equal(Object.keys(await store(page,'lawScoring.topicRecall.v1')).filter(k=>!k.startsWith('__')).length,5,'topic recall records untouched by theory cards');

  assert.equal(await page.evaluate(()=>localStorage.getItem('psd-staresto-link-coach-v06')),null,'the English records are not created or touched');

  // 失分回想：先在申論評分參考留下一題只勾一格的自評，卡片就會出現；評分寫進失分回想卡原本的紀錄
  await page.goto(base+'commute.html',{waitUntil:'load'});
  await page.evaluate(()=>{ const q=window.LawScoringData.questions[0]; localStorage.setItem('lawScoring.v2',JSON.stringify({[q.id]:{answer:'測試作答',answerUrl:'',unlocked:true,checks:{0:{found:true}},organize:{},devNotes:{},approved:{}}})); });
  const scoreBefore=await page.evaluate(()=>localStorage.getItem('lawScoring.v2'));
  await page.reload({waitUntil:'load'}); await page.locator('[data-deck="miss"]').click();
  const missCount=await text(page,'#cm-count-miss'); assert(/^剩 \d+ 張$/.test(missCount)&&missCount!=='剩 0 張');
  assert((await text(page,'#cm-note')).startsWith('上次漏了：')); await page.locator('#cm-reveal').click(); assert(await vis(page,'#cm-link'));
  await page.locator('#cm-rate3 [data-rate="good"]').click();
  const rc=await store(page,'lawScoring.recall.v1'); assert(Object.values(rc).some(c=>c.box===2&&c.reviews.length===1));
  assert.equal(await page.evaluate(()=>localStorage.getItem('lawScoring.v2')),scoreBefore,'the self-grading records are never changed');
  await page.goto(base+'review.html',{waitUntil:'load'}); assert((await text(page,'#deck-summary')).includes('今天到期'));

  // 字級：四級，重新整理後保留
  await page.goto(base+'commute.html',{waitUntil:'load'}); await page.locator('.cm-settings summary').click();
  const size=()=>page.locator('#cm-title').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)); const s1=await size();
  await page.locator('#cm-font-up').click(); await page.locator('#cm-font-up').click(); const s3=await size(); assert(s3>s1*1.3); assert(await page.locator('#cm-font-up').isDisabled());
  await page.reload({waitUntil:'load'}); assert.equal(Math.round(await size()),Math.round(s3)); assert.equal(await page.locator('#cm-font-label').textContent(),'最大');
  await noOverflow(page,'390 largest font');
  // 最大字級、答案展開時，最後一行內容不會被底部操作列蓋住
  await page.locator('[data-deck="theory"]').click(); await page.locator('#cm-reveal').click();
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const linkBox=await page.locator('.cm-links').boundingBox(), barBox=await page.locator('#cm-bar').boundingBox(); assert(linkBox.y+linkBox.height<=barBox.y+1,'page bottom clears the fixed bar');
  if(shots){ await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:path.join(shots,'commute-390-back-largest.png')}); }
  await page.locator('.cm-settings summary').click(); await page.locator('#cm-font-down').click(); await page.locator('#cm-font-down').click(); assert.equal(await page.locator('#cm-font-label').textContent(),'標準');

  // 各寬度：題面與答案兩種狀態都沒有頁面層級水平捲動；其他三頁的五項導覽也不溢出
  for(const width of WIDTHS){
   await page.setViewportSize({width,height:width<600?780:900});
   await page.goto(base+'commute.html',{waitUntil:'load'});
   for(const deck of ['miss','topic','theory']){
    await page.locator('[data-deck="'+deck+'"]').click(); await noOverflow(page,width+' '+deck+' front');
    if(await vis(page,'#cm-reveal')){ await page.locator('#cm-reveal').click(); await noOverflow(page,width+' '+deck+' back'); const r=await page.locator('#cm-bar').boundingBox(); assert(r.x>=0&&r.x+r.width<=width+1); }
    if(shots&&[320,390,768,1280].includes(width)&&deck==='theory') await page.screenshot({path:path.join(shots,'commute-'+width+'-theory-back.png')});
   }
   await page.locator('[data-deck="topic"]').click(); if(shots&&[320,390].includes(width)) await page.screenshot({path:path.join(shots,'commute-'+width+'-topic.png')});
   for(const f of ['index.html','summaries.html','review.html']){ await page.goto(base+f,{waitUntil:'load'}); await noOverflow(page,width+' '+f); const n=await page.locator('.study-header nav a').count(); assert.equal(n,5);
    for(const a of await page.locator('.study-header nav a').all()){ const r=await a.boundingBox(); assert(r.height>=44&&r.x>=0&&r.x+r.width<=width+1,width+' '+f+' nav item fits'); } }
   if(shots&&width===320){ await page.screenshot({path:path.join(shots,'review-320-nav.png')}); }
  }
  assert.deepEqual(errors,[],'no page errors: '+errors.join(' | '));
  console.log('PASS law-scoring commute browser: three decks, resume, undo, skip, font size, '+WIDTHS.length+' widths');
 }finally{ await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exit(1);});
