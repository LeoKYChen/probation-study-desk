'use strict';
// 讀書計畫瀏覽器檢查：階段與倒數、本週清單的自動數字、心理學加減、四科打勾、檢核點狀態、重新整理後保留、其他紀錄不動，以及各寬度不產生頁面層級的水平捲動。
// 需要 Playwright；只使用測試用的瀏覽器設定檔，不碰任何真實學習紀錄。用法：node verification/law-scoring-plan-browser.cjs [截圖資料夾]
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
const KEY='lawScoring.plan.v1';
const at=iso=>new Date(iso+'T09:00:00+08:00');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/law-scoring/';
 const launch={headless:true}; if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(launch);
 try{
  const errors=[]; let page;
  const fresh=async(width,height)=>{ const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,locale:'zh-TW',timezoneId:'Asia/Taipei',hasTouch:true,serviceWorkers:'block'}); const pg=await ctx.newPage();
    pg.on('pageerror',e=>errors.push(pg.url()+' '+String(e.stack||e).split('\n').slice(0,3).join(' @ '))); pg.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());}); if(page) await page.context().close(); page=pg; };
  const shot=async name=>{ if(shots){ fs.mkdirSync(shots,{recursive:true}); await page.screenshot({path:path.join(shots,name+'.png'),fullPage:true}); } };
  const open=async day=>{ await page.clock.setFixedTime(at(day)); await page.goto(base+'plan.html',{waitUntil:'load'}); await page.locator('#pl-body').waitFor(); };
  const chips=()=>page.locator('#pl-chips .rd-chip').allInnerTexts();
  await fresh(390,844);

  // 空白瀏覽器、第一週：打底期、考試日期用估計值、五個檢核點都還在進行中
  await open('2026-11-18');
  assert.equal(await text(page,'#pl-phase'),'打底期・第 1 週'); let c=await chips(); assert(c.includes('距離考試 269 天')&&c.includes('下個檢核點 12/13（25 天後）')&&c.includes('本週 11/16–11/22'),c.join('|'));
  assert((await text(page,'#pl-exam-note')).includes('還沒設定')); assert.equal(await page.locator('#pl-cps .pl-cp').count(),5); assert.equal(await page.locator('#pl-cps .pl-cp.is-todo').count(),5);
  let week=await text(page,'#pl-week'); assert(week.includes('本週 0／30 題')&&week.includes('本週 0／7 題')&&week.includes('本週 0 題（目標 1 題）')&&week.includes('已上 0／34 堂・本週 0 堂（目標 2 到 3 堂）'),week);
  assert(await page.locator('#pl-psych-minus').isDisabled()); assert.equal(await page.locator('#pl-phases details[open] summary').innerText(),'打底期（11/16–2/28）・現在'); assert.equal(await store(page,KEY),null);
  await noOverflow(page,'empty'); await shot('01-empty');
  // 心理學加減；焦點留在按鈕上
  await page.locator('#pl-psych-plus').click(); await page.locator('#pl-psych-plus').click(); await page.locator('#pl-psych-plus').click();
  assert((await text(page,'#pl-psych-val')).startsWith('已上 3／34 堂・本週 3 堂')); assert.equal(await page.evaluate(()=>document.activeElement.id),'pl-psych-plus'); assert((await text(page,'#pl-status')).includes('3 堂'));
  await page.locator('#pl-psych-minus').click(); assert.deepEqual(await store(page,KEY),{'lecture:psych':{n:2},'week:2026-11-16':{psych:2,read:{}}});
  // 四科打勾
  await page.locator('#pl-read-criminal').check(); await page.locator('#pl-read-procedure').check(); await page.locator('#pl-done-counseling').check(); await page.locator('#pl-read-procedure').uncheck();
  let s=await store(page,KEY); assert.deepEqual(s['week:2026-11-16'],{psych:2,read:{criminal:true}}); assert.deepEqual(s['done:reread'],{counseling:true}); assert((await text(page,'.pl-reread .pl-val')).includes('本週 2／4 科'));
  // 自動數字：今日題組、模擬題、完整寫題（其他頁面的紀錄只讀）
  await page.evaluate(()=>{ const RD=window.LawScoringRounds, Q=window.LawScoringData.questions; let st=RD.normalize(null); for(const x of RD.slots(Q).slice(0,7)) st=RD.record(st,x.id,'good','2026-11-17',1); st=RD.record(st,'mock:m1','good','2026-11-17',1); localStorage.setItem(RD.KEY,JSON.stringify(RD.pack(st)));
    localStorage.setItem('probation-study30-v251:v1',JSON.stringify({version:1,sessions:{'2026-11-16':{questionId:'a',finished:true},'2026-11-17':{questionId:'b',rating:'review'}}})); localStorage.setItem('lawScoring.v2',JSON.stringify({q1:{history:[{d:'2026-11-18',score:70}]}})); });
  const before=await page.evaluate(()=>['lawScoring.rounds.v1','probation-study30-v251:v1','lawScoring.v2'].map(k=>localStorage.getItem(k)));
  await page.reload({waitUntil:'load'}); await page.locator('#pl-body').waitFor(); week=await text(page,'#pl-week');
  assert(week.includes('本週 7／30 題')&&week.includes('本週 1／7 題')&&week.includes('本週 3 題（目標 1 題）')&&week.includes('已上 2／34 堂・本週 2 堂'),week); assert(await page.locator('#pl-read-criminal').isChecked()); assert(await page.locator('#pl-done-counseling').isChecked()); assert(!(await page.locator('#pl-read-procedure').isChecked()));
  await page.locator('#pl-psych-plus').click(); await page.locator('#pl-paper-juvenile').check();
  assert.deepEqual(await page.evaluate(()=>['lawScoring.rounds.v1','probation-study30-v251:v1','lawScoring.v2'].map(k=>localStorage.getItem(k))),before,'other pages\' records are untouched'); await shot('02-filled');
  // 下一週：本週數字歸零，累計保留
  await open('2026-11-24'); assert.equal(await text(page,'#pl-phase'),'打底期・第 2 週'); week=await text(page,'#pl-week'); assert(week.includes('已上 3／34 堂・本週 0 堂')&&week.includes('本週 0 題（目標 1 題）'),week); assert(!(await page.locator('#pl-read-criminal').isChecked())); assert(await page.locator('#pl-done-counseling').isChecked()); assert((await text(page,'.pl-reread')).includes('刑法（已 1 週）'));
  assert(week.includes('落後')); assert.equal(await page.locator('#pl-week li.is-late').count(),1);
  // 過了第一個檢核點還不到 10 堂：標示未達到並顯示調整方式
  await open('2026-12-14'); assert.equal(await page.locator('#pl-cps .pl-cp').first().getAttribute('class'),'pl-cp is-late'); assert((await page.locator('#pl-cps .pl-cp').first().innerText()).includes('調整：假日先保心理學')); assert((await chips()).includes('下個檢核點 1/10（27 天後）')); await shot('03-late');
  // 首頁倒數有設定時用它；穩固期、衝刺期
  await page.evaluate(()=>localStorage.setItem('psd-home-exam-countdown-v1',JSON.stringify({date:'2027-08-07',name:'觀護人考試',style:'standard',accent:'mint'})));
  await open('2027-03-02'); assert.equal(await text(page,'#pl-phase'),'穩固期・第 16 週'); assert((await chips()).includes('距離考試 158 天')); assert((await text(page,'#pl-exam-note')).includes('2027-08-07')); assert((await text(page,'#pl-week')).includes('（目標 6 題）')); assert.equal(await page.locator('#pl-phases details[open] summary').innerText(),'穩固期（3/1–6/13）・現在');
  await open('2027-06-20'); assert.equal(await text(page,'#pl-phase'),'衝刺期・第 31 週'); assert.equal(await page.locator('#pl-cps .pl-cp.is-late').count(),5); assert.equal(await page.locator('#pl-paper-juvenile').isChecked(),true);
  // 全部達成
  await page.evaluate(()=>{ const SP=window.LawScoringStudyPlan; let st=SP.read(); for(let i=0;i<40;i++) st=SP.bumpPsych(st,'2026-11-18',1); for(const [id] of SP.REREAD) st=SP.setReread(st,id,true); for(const [id] of SP.PAPERS) st=SP.setPaper(st,id,true); localStorage.setItem(SP.KEY,JSON.stringify(SP.pack(st)));
    const RD=window.LawScoringRounds, Q=window.LawScoringData.questions; let rs=RD.normalize(null); for(const q of Q) rs=RD.record(rs,q.id,'good','2026-12-01',1); localStorage.setItem(RD.KEY,JSON.stringify(RD.pack(rs)));
    const ss={version:1,sessions:{}}; for(const d of ['2027-04-26','2027-04-27','2027-04-28','2027-04-29','2027-04-30','2027-05-01']) ss.sessions[d]={finished:true}; localStorage.setItem('probation-study30-v251:v1',JSON.stringify(ss)); });
  await page.reload({waitUntil:'load'}); await page.locator('#pl-body').waitFor(); assert.equal(await page.locator('#pl-cps .pl-cp.is-done').count(),4,'four met; the rounds one is behind schedule by June'); assert(await page.locator('#pl-psych-plus').isDisabled()); assert(!(await text(page,'#pl-psych-val')).includes('目標'));
  // 起算日前
  await fresh(390,844); await open('2026-11-15'); assert.equal(await text(page,'#pl-phase'),'打底期・11/16 開始');
  // 各寬度
  for(const wd of WIDTHS){ await fresh(wd,wd<600?740:900); await open('2026-11-18'); await page.locator('#pl-psych-plus').click(); await page.locator('#pl-read-criminal').check(); await page.locator('.cm-settings summary').click(); await page.evaluate(()=>document.querySelectorAll('#pl-phases details').forEach(d=>{d.open=true;})); await noOverflow(page,'plan '+wd);
    for(const b of await page.locator('.pl-step button, .pl-check').all()){ const bb=await b.boundingBox(); assert(bb.height>=44,'touch target height at '+wd); } if(wd===320||wd===1280) await shot('w'+wd); }
  // 申論評分參考：入口與今日清單
  await fresh(390,844); await page.clock.setFixedTime(at('2026-11-18')); await page.goto(base,{waitUntil:'load'}); assert.equal(await page.locator('.rounds-entry a').nth(1).getAttribute('href'),'plan.html'); await page.locator('#today summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#today-list li').length>=6); const first=await page.locator('#today-list li').first().innerText(); assert(first.includes('讀書計畫：打底期第 1 週・心理學 0／34 堂・下個檢核點 12/13'),first); await noOverflow(page,'index');
  assert.deepEqual(errors,[]);
  console.log('PASS law-scoring plan browser: phases, weekly numbers, manual records, checkpoints, other records untouched, widths');
 } finally { await browser.close(); server.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
