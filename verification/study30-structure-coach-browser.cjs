'use strict';
/* Phase 1: synthetic, isolated Chromium/WebKit end-to-end checks.
   No production storage and no external AI calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(process.argv[2]||'.');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff':'font/woff'};
const server=http.createServer((req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/probation-study-desk/'))pathname=pathname.slice('/probation-study-desk'.length);
    const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(target,(err,data)=>{
      res.writeHead(err?404:200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
      res.end(err?'not found':data);
    });
  }catch{res.writeHead(400).end('bad request');}
});
const storageKey='probation-study30-v251:v1',day='2026-11-13';
async function exercise(engine,base){
  const browser=await engine.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Taipei',locale:'zh-TW',acceptDownloads:true,serviceWorkers:'block'});
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.clock.install({time:new Date('2026-11-13T08:00:00+08:00')});
    await page.goto(base+'professional/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.Study30App?.saveStructureCoach&&window.Study30StructureCoachModel);
    const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions['2026-11-13']);
    let rec=await read();
    assert.equal(rec.practiceMode,'structure','new Friday defaults to structure mode');
    assert.equal(await page.locator('#practiceStructure').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#structureCoachPanel').isVisible(),true);
    assert.equal(await page.evaluate(()=>Study30App.hasSessionProgress(Study30App.getEssayReviewData().sessions['2026-11-13'])),false,'default empty cards must not count as practice');
    await page.locator('#nextPhase').click();
    assert.equal((await read()).phase,0,'cannot advance without core reasoning');
    assert.match(await page.locator('#notice').innerText(),/尚未完成本階段/);
    await page.locator('#coach-facts').fill('甲被認定收受賄賂；乙交付黃金項鍊給丙。');
    await page.locator('#coach-coreQuestion').fill('法院得否依職權命丙參與沒收程序？');
    await page.locator('#coach-prerequisites').fill('確認財產權利及程序必要性');
    rec=await read();
    assert.equal(rec.structureCoach.coreQuestion,'法院得否依職權命丙參與沒收程序？');
    assert.equal(await page.locator('#practiceNormal').isDisabled(),true,'progress locks a mode switch');
    const timeSnapshot=()=>page.evaluate(()=>{
      const record=JSON.parse(localStorage.getItem('probation-study30-v251:v1')).sessions['2026-11-13'];
      return {now:Date.now(),visible:document.visibilityState,hidden:document.hidden,
        button:document.getElementById('toggleTimer')?.textContent,
        timer:document.getElementById('timer')?.textContent,
        elapsed:record.elapsed,remaining:record.remaining};
    });
    const timerBefore=await timeSnapshot();
    await page.locator('#toggleTimer').click();
    const timerStarted=await timeSnapshot();
    const timerStart=await page.evaluate(()=>Date.now());
    // Explicit system-time advance avoids WebKit's pinned headless mock clock.
    await page.clock.setSystemTime(new Date(timerStart+3500));
    const timerJumped=await timeSnapshot();
    await page.locator('#toggleTimer').click();
    const timerPaused=await timeSnapshot();
    if(engine.name()==='webkit')console.log('WEBKIT_TIMER_DEBUG',JSON.stringify({timerBefore,timerStarted,timerJumped,timerPaused}));
    rec=await read();
    assert(rec.elapsed>=3,'elapsed timer must be retained in '+engine.name()+': '+rec.elapsed);
    await page.locator('#nextPhase').click();
    assert.equal((await read()).phase,1);
    await page.locator('#nextPhase').click();
    assert.equal((await read()).phase,1,'empty outline blocks are not valid');
    await page.locator('#coach-title-0').fill('一、財產相關性');
    await page.locator('#coach-question-0').fill('黃金項鍊是否可能涉及第三人財產沒收？');
    await page.locator('#coach-title-1').fill('二、程序權限');
    await page.locator('#coach-question-1').fill('二審法院得否依職權命第三人參與？');
    await page.locator('button[data-coach-action="down"][data-coach-index="0"]').click();
    rec=await read();
    assert.equal(rec.structureCoach.outline[0].title,'二、程序權限','ordering persists');
    await page.reload();
    await page.waitForFunction(()=>window.Study30App?.structureCoachContext);
    assert.equal(await page.locator('#coach-title-0').inputValue(),'二、程序權限','outline survives reload');
    assert((await read()).elapsed>=1,'timer survives reload');
    await page.locator('#nextPhase').click();
    assert.equal((await read()).phase,2);
    await page.locator('#coach-issue').fill('法院職權命第三人參與之要件');
    await page.locator('#coach-rule').fill('待查相關法律規範與要件');
    await page.locator('#coach-application').fill('丙不知賄賂，仍須具體判斷財產是否可能受沒收影響');
    await page.locator('#coach-conclusion').fill('需依法定要件判斷，不能只因丙不知情即斷言');
    await page.locator('#nextPhase').click();
    assert.equal((await read()).phase,3);
    await page.locator('#coach-check-0').count(); // fields persist; checkboxes are identified by data attribute
    await page.locator('input[data-coach-check="0"]').check();
    await page.locator('#coach-weakness').fill('沒有把必要前提與核心爭點分清楚');
    await page.locator('#coach-nextGoal').fill('下次先把前提放在核心爭點之前');
    await page.locator('#nextPhase').click();
    rec=await read();
    assert.equal(rec.finished,true);
    assert(rec.elapsed>=1,'final session retains actual time');
    assert(rec.structureCoach.checks[0],'structural check stays saved');
    assert.equal(await page.locator('#coach-weakness').isDisabled(),true,'completed original coach must be read-only');
    // The original session and the new coach fields are round-tripped by the unchanged JSON format.
    const dlEvent=page.waitForEvent('download');
    await page.locator('#export').click();
    const download=await dlEvent;
    const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(data.data.sessions[day].structureCoach.weakness,'沒有把必要前提與核心爭點分清楚');
    const roundtrip=await page.evaluate(raw=>{
      const parsed=Study30BackupImport.parse(raw);
      return parsed.sessions['2026-11-13'].structureCoach.outline[0].title;
    },JSON.stringify(data));
    assert.equal(roundtrip,'二、程序權限','backup import retains structural cards');
    // Calendar click is read-only; only explicit re-practice adds a fresh attempt.
    await page.locator('#showMonthProgress').click();
    await page.locator('#progressMonthGrid button[data-date="2026-11-13"]').click();
    assert.equal((await read()).repeatAttempts?.length||0,0);
    await page.locator('#progressMonthRecord button').first().click();
    rec=await read();
    assert.equal(rec.repeatAttempts?.length,1,'explicit repeat creates separate practice attempt');
    assert.equal(rec.finished,true,'original completion must remain');
    assert.equal(rec.structureCoach.paragraph.issue,'法院職權命第三人參與之要件');
    assert.equal(rec.repeatAttempts[0].finished,false);
    assert.equal(rec.repeatAttempts[0].structureCoach,undefined,'new attempt has fresh empty coach draft');
    await page.locator('#coach-facts').fill('重新練習：新的案件事實');
    rec=await read();
    assert.equal(rec.repeatAttempts[0].structureCoach.facts,'重新練習：新的案件事實');
    assert.equal(rec.structureCoach.facts,'甲被認定收受賄賂；乙交付黃金項鍊給丙。','repeat cannot overwrite original');
    for(const width of [320,375,390,430]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2),false,'mobile overflow at '+width);
    }
    assert.deepEqual(errors,[],'no page errors');
    console.log('PASS '+engine.name()+' '+base+' coach mode, phase gating, timer, reload, outline, backup, calendar and repeat');
    await ctx.close();
  }finally{await browser.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    for(const engine of [chromium,webkit])for(const prefix of ['/','/probation-study-desk/'])
      await exercise(engine,origin+prefix);
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
