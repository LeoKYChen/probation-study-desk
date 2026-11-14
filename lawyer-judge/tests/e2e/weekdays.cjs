#!/usr/bin/env node
/* 專業科目練習臺：以固定時鐘逐日（週一到週日）檢查今日科目、說明文字，以及沒有觀護人詞彙或舊題數。
 * 用法：node tests/e2e/weekdays.cjs（需要 python3 與 playwright） */
'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const ROOT=path.resolve(__dirname,'..','..'),PORT=Number(process.env.SMOKE_PORT||8863);
const BANNED=/觀護|少年|犯罪學|諮商|心理學|保安處分|原站|426|553/;
// 2026-10-19 是週一；依規格第 5 節的期望科目
const EXPECT=[['2026-10-19','憲法與行政法'],['2026-10-20','民法'],['2026-10-21','民事訴訟法'],['2026-10-22','刑法'],['2026-10-23','刑事訴訟法'],['2026-10-24','商事法'],['2026-10-25','複習']];
// 週六四週一輪（週數自 2026-10-12 起算）：10/17 公司法、10/24 保險法、10/31 證券交易法、11/7 選試科目智慧財產法、11/14 回到公司法
const SAT=[['2026-10-17','商事法（公司法）'],['2026-10-24','商事法（保險法）'],['2026-10-31','商事法（證券交易法）'],['2026-11-07','選試科目（智慧財產法）'],['2026-11-14','商事法（公司法）']];
EXPECT.push(...SAT);
(async()=>{
  const srv=spawn('python3',['-m','http.server',String(PORT),'-d',ROOT],{stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
  const b=await chromium.launch();let fail=0;
  try{
    for(const [day,expected] of EXPECT){
      const ctx=await b.newContext({timezoneId:'Asia/Taipei',serviceWorkers:'block'}),p=await ctx.newPage(),errs=[];
      p.on('pageerror',e=>errs.push(e.message));
      await p.clock.install({time:new Date(day+'T09:00:00+08:00')});
      await p.goto(`http://localhost:${PORT}/professional/index.html`);await p.waitForFunction(()=>window.Study30App);
      const heading=await p.locator('#todayHeading').innerText(),desc=await p.locator('#todayDescription').innerText();
      const text=await p.evaluate(()=>document.body.innerText);
      const bad=text.split('\n').filter(l=>BANNED.test(l));
      const ok=heading.includes(expected)&&!bad.length&&!errs.length;
      if(!ok)fail++;
      console.log(`${ok?'PASS':'FAIL'} ${day} ${heading}｜${desc}${bad.length?' ｜殘留：'+bad.slice(0,2).join(' / '):''}${errs.length?' ｜錯誤：'+errs[0]:''}`);
      await ctx.close();
    }
  }finally{await b.close();srv.kill();}
  console.log(fail?`FAILED ${fail}`:'ALL PASS');process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
