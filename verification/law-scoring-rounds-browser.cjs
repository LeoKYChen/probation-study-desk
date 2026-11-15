'use strict';
// 今日題組瀏覽器檢查：輪次題與模擬題的翻開、自評、復原、跳過、續做、加開、換日、各輪深度，以及各寬度不產生頁面層級的水平捲動。
// 需要 Playwright；只使用測試用的瀏覽器設定檔，不碰任何真實學習紀錄。用法：node verification/law-scoring-rounds-browser.cjs [截圖資料夾]
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
const KEY='lawScoring.rounds.v1',POS='lawScoring.rounds.pos.v1';
const at=iso=>new Date(iso+'T09:00:00+08:00');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/law-scoring/';
 const launch={headless:true}; if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(launch);
 try{
  const errors=[]; let page;
  // 每次開新的瀏覽器設定檔（乾淨的紀錄），並收集頁面錯誤與讀不到的檔案。
  const fresh=async(width,height)=>{ const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,locale:'zh-TW',timezoneId:'Asia/Taipei',hasTouch:true,serviceWorkers:'block'}); const pg=await ctx.newPage();
    pg.on('pageerror',e=>errors.push(pg.url()+' '+String(e.stack||e).split('\n').slice(0,3).join(' @ '))); pg.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());}); if(page) await page.context().close(); page=pg; };
  await fresh(390,844);
  const shot=async name=>{ if(shots){ fs.mkdirSync(shots,{recursive:true}); await page.screenshot({path:path.join(shots,name+'.png')}); } };
  const chips=()=>page.locator('#rd-chips .rd-chip').allInnerTexts();
  const open=async day=>{ await page.clock.setFixedTime(at(day)); await page.goto(base+'rounds.html',{waitUntil:'load'}); await page.waitForFunction(()=>!document.querySelector('#rd-chips')?.textContent.includes('讀取中')); };
  const order=await (async()=>{ await page.clock.setFixedTime(at('2026-11-16')); await page.goto(base+'rounds.html',{waitUntil:'load'}); return page.evaluate(()=>window.LawScoringRounds.slots(window.LawScoringData.questions)); })();
  const titleOf=id=>page.evaluate(i=>{const q=window.LawScoringData.questions.find(x=>x.id===i);return q.subject+'・第 '+q.no+' 題（'+q.points+' 分）';},id);

  // 起算日（週一）空白瀏覽器：第 1 輪、今日 0／5、模擬題 0／1，第一題是順序表的第一題
  await open('2026-11-16');
  assert.equal(await text(page,'#rd-round'),'第 1 輪'); assert.equal(await text(page,'#rd-count'),'0／553');
  let c=await chips(); assert(c.includes('今日 0／5')&&c.includes('模擬題 0／1')&&c.includes('進度正常')&&c.includes('照表 7/30 跑完'),c.join('|'));
  assert(await vis(page,'#rd-card')); assert.equal(await text(page,'#rd-title'),await titleOf(order[0].id)); assert((await text(page,'#rd-meta')).startsWith('第 1 輪・'));
  assert(await vis(page,'#rd-reveal')); assert(!(await vis(page,'#rd-rate'))); assert(!(await vis(page,'#rd-back'))); assert(await vis(page,'#rd-skip')); assert(!(await vis(page,'#rd-undo')));
  // 第 1 輪：題幹要求按需載入；骨架可以寫，重畫不會洗掉
  await page.locator('#rd-note').pressSequentially('立法理由 → 規範');
  await page.locator('.rd-demands summary').waitFor(); assert.equal(await page.locator('#rd-note').inputValue(),'立法理由 → 規範');
  assert((await text(page,'#rd-progress')).startsWith('剩 6 題')); await shot('01-front');
  await page.locator('#rd-reveal').click();
  assert(await vis(page,'#rd-back')); assert(await vis(page,'#rd-rate')); assert(!(await vis(page,'#rd-reveal'))); assert(!(await vis(page,'#rd-skip')));
  const backText=await text(page,'#rd-back'); for(const h of ['命題結構','評分要點','答題組織','常見失分']) assert(backText.includes(h),'full depth shows '+h);
  assert(await page.locator('#rd-back .rd-detail').count()>0); assert.equal(await page.locator('#rd-back button',{hasText:'看完整評分要點'}).count(),0);
  assert.equal((await store(page,KEY))[order[0].id].notes[1],'立法理由 → 規範'); await shot('02-back');
  // 重新整理：回到同一題、同一面
  await page.reload({waitUntil:'load'}); assert.equal(await text(page,'#rd-title'),await titleOf(order[0].id)); assert(await vis(page,'#rd-rate')); assert.equal(await page.locator('#rd-note').inputValue(),'立法理由 → 規範');
  // 自評 → 記錄、進到下一題；復原 → 回到上一題的答案面
  await page.locator('[data-rate="good"]').click();
  let s=await store(page,KEY); assert.equal(s[order[0].id].done.length,1); assert.equal(s[order[0].id].done[0].r,'good'); assert.equal(s[order[0].id].done[0].d,'2026-11-16');
  assert.equal(await text(page,'#rd-title'),await titleOf(order[1].id)); assert((await chips()).includes('今日 1／5')); assert.equal(await text(page,'#rd-count'),'1／553'); assert((await text(page,'#rd-status')).includes('抓到了'));
  await page.locator('#rd-undo').click(); assert.equal(await text(page,'#rd-title'),await titleOf(order[0].id)); assert(await vis(page,'#rd-rate')); assert.deepEqual((await store(page,KEY))[order[0].id].done,[]); assert((await chips()).includes('今日 0／5'));
  assert.equal(await page.locator('#rd-note').inputValue(),'立法理由 → 規範');
  await page.locator('[data-rate="again"]').click(); assert.equal((await store(page,KEY))[order[0].id].done[0].r,'again');
  // 先跳過：排到今天最後（模擬題之後）
  await page.locator('#rd-skip').click(); assert.equal(await text(page,'#rd-title'),await titleOf(order[2].id));
  for(const k of ['good','partial','good']){ await page.locator('#rd-reveal').click(); await page.locator('[data-rate="'+k+'"]').click(); }
  // 模擬題：標示 AI 產生，翻開有爭點與參考架構
  assert.equal(await text(page,'#rd-title'),'今天的模擬題'); assert((await text(page,'#rd-meta')).startsWith('模擬題・')); assert((await text(page,'#rd-front')).includes('AI 產生'));
  await shot('03-mock-front'); await page.locator('#rd-reveal').click(); const mockBack=await text(page,'#rd-back'); assert(mockBack.includes('爭點')&&mockBack.includes('參考架構')); await noOverflow(page,'mock back'); await shot('04-mock-back');
  await page.locator('[data-rate="partial"]').click();
  s=await store(page,KEY); const mockKey=Object.keys(s).find(k=>k.startsWith('mock:')); assert(mockKey&&s[mockKey].done.length===1); assert((await chips()).includes('模擬題 1／1'));
  // 剩下剛才跳過的那一題
  assert.equal(await text(page,'#rd-title'),await titleOf(order[1].id)); await page.locator('#rd-reveal').click(); await page.locator('[data-rate="good"]').click();
  assert(await vis(page,'#rd-empty')); assert.equal(await text(page,'#rd-empty-title'),'今天的題組做完了'); assert((await chips()).includes('今日 5／5')); assert(!(await vis(page,'#rd-card'))); await shot('05-done');
  // 加開 5 題
  await page.locator('#rd-empty-actions button').click(); assert(await vis(page,'#rd-card')); assert.equal(await text(page,'#rd-title'),await titleOf(order[5].id)); assert((await chips()).includes('今日 5／10'));
  // 其他紀錄沒有被動到
  assert.equal(await page.evaluate(()=>localStorage.getItem('lawScoring.v2')),null); assert.equal(await page.evaluate(()=>localStorage.getItem('probation-daily-github:records:v1')),null);

  // 隔天：配額重算、換新的模擬題、加開歸零
  await open('2026-11-17'); c=await chips(); assert(c.includes('今日 0／5')&&c.includes('模擬題 0／1')&&c.includes('進度正常'),c.join('|')); assert.equal(await text(page,'#rd-count'),'5／553');
  assert.equal((await store(page,POS)).extra,0); assert.notEqual('mock:'+(await store(page,POS)).mock,mockKey);
  // 兩天沒練：落後 5 題；週日只補落後的
  await open('2026-11-19'); assert((await chips()).some(x=>x==='落後 10 題'),(await chips()).join('|'));
  await open('2026-11-22'); c=await chips(); assert(c.includes('今日 0／10')&&c.includes('落後 25 題，今天補'),c.join('|'));
  // 進度表與起算日
  await page.locator('.cm-settings summary').click(); assert.equal(await page.locator('#rd-table-body li').count(),5); assert.equal(await page.locator('#rd-table-body li.is-now strong').innerText(),'第 1 輪');
  assert.deepEqual((await page.locator('#rd-table-body li span:nth-child(2)').allInnerTexts()).map(x=>x.split('・').pop()),['3/24 完成','5/28 完成','7/10 完成','7/22 完成','7/30 完成']); assert.equal(await page.locator('#rd-start').inputValue(),'2026-11-16');
  await page.locator('#rd-start').fill('2026-11-23'); await page.locator('#rd-start-form button').click(); assert((await chips()).some(x=>x.startsWith('起算日 11/23'))); assert.equal((await store(page,KEY)).__settings.start,'2026-11-23'); await noOverflow(page,'settings open'); await shot('06-settings');
  await page.locator('#rd-start').fill('2026-11-16'); await page.locator('#rd-start-form button').click(); assert.equal((await store(page,KEY)).__settings,undefined);
  // 字級
  await page.locator('#rd-font-up').click(); assert(await page.evaluate(()=>document.body.classList.contains('cm-f2'))); assert.equal((await store(page,POS)).font,2); await page.locator('#rd-font-down').click();

  // 第 2 輪（中等深度）與第 3 輪（精簡）
  const seed=async(rounds,day)=>{ await page.evaluate(({k,n})=>{ const o={}; for(const q of window.LawScoringData.questions) o[q.id]={done:Array.from({length:n},(_, i)=>({d:'2026-12-0'+(i+1),r:'good',s:1})),notes:{[n]:'上一輪的骨架'}}; localStorage.setItem(k,JSON.stringify(o)); localStorage.removeItem('lawScoring.rounds.pos.v1'); },{k:KEY,n:rounds}); await open(day); };
  await seed(1,'2027-03-25'); assert.equal(await text(page,'#rd-round'),'第 2 輪'); assert((await chips()).includes('今日 0／10')); assert.equal(await page.locator('.rd-demands').count(),0); assert(await vis(page,'#rd-note')); assert((await text(page,'#rd-front')).includes('上一輪：抓到了'));
  await page.locator('#rd-reveal').click(); assert.equal(await page.locator('#rd-back .rd-detail').count(),0); assert((await text(page,'#rd-back')).includes('第 1 輪你列的骨架')); assert((await text(page,'#rd-back')).includes('評分要點'));
  await page.locator('#rd-back button',{hasText:'看完整評分要點'}).click(); assert(await page.locator('#rd-back .rd-detail').count()>0); await shot('07-round2-back');
  await seed(2,'2027-05-29'); assert.equal(await text(page,'#rd-round'),'第 3 輪'); assert((await chips()).includes('今日 0／15')); assert(!(await vis(page,'#rd-note-wrap')));
  await page.locator('#rd-reveal').click(); assert((await text(page,'#rd-back')).includes('爭點')); assert.equal(await page.locator('#rd-back .rd-detail').count(),0); assert.equal(await page.locator('#rd-back .rd-src').count(),0);
  // 第 4 輪只剩觀護人題；全部完成
  await seed(3,'2027-07-12'); assert.equal(await text(page,'#rd-round'),'第 4 輪'); assert.equal(await text(page,'#rd-count'),'0／190'); assert((await text(page,'#rd-meta')).includes('觀護人'));
  await seed(5,'2027-08-01'); assert.equal(await text(page,'#rd-round'),'五輪都跑完了'); await page.waitForSelector('#rd-card:not([hidden])'); assert.equal(await text(page,'#rd-title'),'今天的模擬題');

  // 模擬題讀不到：照樣能練輪次題
  await page.evaluate(k=>{localStorage.removeItem(k);localStorage.removeItem('lawScoring.rounds.pos.v1');},KEY);
  await page.route('**/daily-simulation/questions.json',r=>r.abort()); await open('2026-11-16'); assert((await chips()).includes('模擬題 讀不到')); assert((await text(page,'#rd-progress')).startsWith('剩 5 題')); await page.unroute('**/daily-simulation/questions.json');
  errors.length=0;

  // 各寬度：題面、答案面都沒有頁面層級水平捲動，操作列不超出畫面
  for(const wd of WIDTHS){ await fresh(wd,wd<600?740:900); await open('2026-11-16'); await page.locator('.rd-demands summary').waitFor(); await page.locator('.rd-demands summary').click(); await noOverflow(page,'front '+wd);
    await page.locator('#rd-reveal').click(); await noOverflow(page,'back '+wd);
    const bar=await page.locator('#rd-bar-bottom').boundingBox(); assert(bar.x>=0&&bar.x+bar.width<=wd+0.5,'bar fits at '+wd);
    for(const b of await page.locator('#rd-rate button').all()){ const bb=await b.boundingBox(); assert(bb.height>=44&&bb.width>=44,'rate button touch size at '+wd); }
    if(wd===320||wd===1280) await shot('w'+wd+'-back'); }
  // 申論評分參考：入口連結與今日清單多一行
  await fresh(390,844); await page.clock.setFixedTime(at('2026-11-16')); await page.goto(base,{waitUntil:'load'});
  assert.equal(await page.locator('.rounds-entry a').getAttribute('href'),'rounds.html'); await page.locator('#today summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#today-list li').length>=5); const first=await page.locator('#today-list li').first().innerText(); assert(first.includes('今日題組：第 1 輪 0／553・今天 0／5・模擬題 0／1'),first); await noOverflow(page,'index'); await shot('08-index');
  assert.deepEqual(errors,[]);
  console.log('PASS law-scoring rounds browser: flow, resume, undo, skip, mock, extra, day change, depths, widths');
 } finally { await browser.close(); server.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
