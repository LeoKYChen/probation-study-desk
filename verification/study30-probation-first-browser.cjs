'use strict';
// 每日30分鐘選題檢查：平日先出還沒練過的觀護人考古題、不重複；沒開始練的日期不算練過；該科觀護人題都練過後回到原本的抽題。
// 需要 Playwright；只使用測試用的瀏覽器設定檔。用法：node verification/study30-probation-first-browser.cjs
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const candidate=path.resolve(root,'.'+requested,requested.endsWith('/')?'index.html':'');
 if(!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(candidate,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(candidate)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
});
const KEY='probation-study30-v251:v1';
const addDays=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/professional/';
 const launch={headless:true}; if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(launch);
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei',serviceWorkers:'block'});
  const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e.stack||e).split('\n').slice(0,3).join(' @ ')));
  // 打開某一天，回傳當天排到的題目
  const open=async iso=>{ await page.clock.setFixedTime(new Date(iso+'T09:00:00+08:00')); await page.goto(url,{waitUntil:'load'});
   return page.evaluate(({k,d})=>{ const s=JSON.parse(localStorage.getItem(k)).sessions[d], q=window.Study30QuestionSources.all.find(x=>x.id===s.questionId); return {id:q.id,examType:q.examType,subject:q.subjectGroup||q.subject,title:document.getElementById('workTitle').textContent}; },{k:KEY,d:iso}); };
  const sessions=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).sessions,KEY);
  // 頁面離開時會把記憶中的紀錄寫回去，所以測試用的改動放在另一個鍵，下次載入頁面、程式執行前才套用。
  await ctx.addInitScript(()=>{ try{ const ops=JSON.parse(localStorage.getItem('__test_ops')||'null'), k='probation-study30-v251:v1', o=JSON.parse(localStorage.getItem(k)||'null'); if(!ops||!o) return;
    for(const [d,s] of Object.entries(o.sessions)){ if(ops.doneAll) Object.assign(s,{elapsed:1800,finished:true,rating:'review'}); if(ops.force&&ops.force[d]) s.questionId=ops.force[d]; } localStorage.setItem(k,JSON.stringify(o)); }catch(e){} });
  const ops=o=>page.evaluate(v=>v?localStorage.setItem('__test_ops',JSON.stringify(v)):localStorage.removeItem('__test_ops'),o);
  const wipe=async()=>{ await ops(null); await page.goto(url+'manifest.webmanifest'); await page.evaluate(k=>localStorage.removeItem(k),KEY); };

  // 週一到週六各科：排到的都是觀護人的題，科目與當天相符
  const week={ '2026-11-16':'心理學','2026-11-17':'諮商與輔導','2026-11-18':'犯罪學','2026-11-19':'少年事件處理法','2026-11-20':'刑法','2026-11-21':'刑事訴訟法與保安處分執行法' };
  for(const [day,subject] of Object.entries(week)){ const q=await open(day); assert(q.examType.includes('觀護人'),day+' picked '+q.examType); assert.equal(q.subject,subject,day); assert(q.title); }
  // 同一天重開不換題
  const mon=await open('2026-11-16'); assert.equal((await open('2026-11-16')).id,mon.id);
  // 沒開始練的日期不算練過：把 11/16（沒開始）的題換成下週一原本會抽到的那一題，下週一仍然抽到它
  await wipe(); const next=await open('2026-11-23');
  await wipe(); await open('2026-11-16'); await ops({force:{'2026-11-16':next.id}});
  assert.equal((await open('2026-11-23')).id,next.id,'an unstarted day does not use up its question'); assert.equal((await sessions())['2026-11-16'].questionId,next.id);
  // 同樣的情況但 11/16 練過了：下週一換別題
  await wipe(); await open('2026-11-16'); await ops({doneAll:true,force:{'2026-11-16':next.id}});
  const other=await open('2026-11-23'); assert.notEqual(other.id,next.id,'a practised question is not picked again'); assert(other.examType.includes('觀護人'));
  // 連續 32 個週一都練完：32 題心理學觀護人題各出一次、沒有重複；上週自評「待加強」也先出新題
  await wipe(); await page.goto(url+'manifest.webmanifest'); await ops({doneAll:true});
  const seen=new Set(); let day='2026-11-09';
  for(let i=0;i<32;i++){ day=addDays(day,7); const q=await open(day); assert(q.examType.includes('觀護人'),day+' picked '+q.examType); assert.equal(q.subject,'心理學'); assert(!seen.has(q.id),'repeat on '+day+': '+q.id); seen.add(q.id); }
  assert.equal(seen.size,32);
  // 第 33 個週一：觀護人題都練過了，回到原本的規則（到期複習），不會出錯
  const after=await open(addDays(day,7)); assert(after.id&&after.title); assert(seen.has(after.id),'falls back to a due review once every probation question is done');
  assert.equal(Object.keys(await sessions()).length,33);
  // 補練本週已過日期：也是先出沒練過的觀護人題
  await wipe(); await open('2026-11-20'); await page.locator('#historyContent .day-cell').nth(2).click();
  const made=await page.evaluate(k=>{ const s=JSON.parse(localStorage.getItem(k)).sessions['2026-11-18']; const q=window.Study30QuestionSources.all.find(x=>x.id===s.questionId); return {examType:q.examType,subject:q.subjectGroup||q.subject}; },KEY);
  assert(made.examType.includes('觀護人'),'make-up day picked '+made.examType); assert.equal(made.subject,'犯罪學');
  assert.deepEqual(errors,[]);
  console.log('PASS study30 probation-first: weekday subjects, unstarted days ignored, no repeats over 32 weeks, fallback after completion, make-up day');
 } finally { await browser.close(); server.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
