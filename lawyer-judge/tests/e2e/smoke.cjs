#!/usr/bin/env node
/* 律司備考平臺冒煙測試：載入頁面、收集錯誤、檢查 11 種寬度整頁溢出、殘留觀護人詞彙。
 * 用法：node tests/e2e/smoke.cjs [頁面路徑 ...]（預設測全部主要頁面）
 * 需要 python3 與 playwright（PLAYWRIGHT_PATH 可指定模組路徑）。 */
'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const ROOT=path.resolve(__dirname,'..','..');
const PORT=Number(process.env.SMOKE_PORT||8851);
const WIDTHS=[320,360,375,390,414,430,600,768,1024,1280,1440];
const DEFAULT_PAGES=['index.html','professional/index.html','v2.5/index.html','v2.5/daily-practice.html','daily-simulation/index.html','active-recall/index.html','mcq/index.html','practice/index.html','outline/index.html','official/index.html','review/index.html','common-subjects/index.html','study-desk/index.html','lectures/index.html','backup/index.html','print/index.html','offline/index.html'];
// 使用者看得到的文字中不得出現的觀護人專屬詞彙
const BANNED=/觀護|少年事件|保安處分|犯罪學|諮商與輔導|心理學|心理測驗|少年司法|監獄官|家事調查官|116\s*年/;
const IGNORE_CONSOLE=/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|fonts\.(googleapis|gstatic)|Failed to load resource: net::ERR_(TUNNEL|PROXY|CONNECTION)/;
(async()=>{
  const pages=process.argv.slice(2).length?process.argv.slice(2):DEFAULT_PAGES;
  const srv=spawn('python3',['-m','http.server',String(PORT),'-d',ROOT],{stdio:'ignore'});
  await new Promise(r=>setTimeout(r,900));
  const browser=await chromium.launch();
  let fail=0;
  const log=(ok,msg)=>{if(!ok)fail++;console.log((ok?'PASS ':'FAIL ')+msg);};
  try{
    for(const rel of pages){
      const ctx=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
      const page=await ctx.newPage(),errs=[];
      page.on('pageerror',e=>errs.push('pageerror: '+e.message));
      page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errs.push('console: '+m.text());});
      page.on('requestfailed',r=>{const u=r.url();if(u.startsWith('http://localhost:'+PORT))errs.push('missing: '+u.replace('http://localhost:'+PORT,''));});
      const resp=await page.goto(`http://localhost:${PORT}/${rel}`,{waitUntil:'load'}).catch(e=>null);
      await page.waitForTimeout(700);
      log(resp&&resp.ok(),`${rel} loads (HTTP ${resp?resp.status():'n/a'})`);
      const text=await page.evaluate(()=>document.title+'\n'+document.body.innerText+'\n'+[...document.querySelectorAll('[placeholder],[aria-label],[title],option,meta[name=description]')].map(e=>e.getAttribute('placeholder')||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('content')||e.textContent).join('\n'));
      const bad=text.split('\n').filter(l=>BANNED.test(l)).slice(0,3);
      log(!bad.length,`${rel} no probation terms${bad.length?' → '+bad.map(s=>s.trim().slice(0,60)).join(' | '):''}`);
      // 品牌標誌（含 CSS ::before 產生的字）不得殘留觀護人站的「觀」
      const marks=await page.evaluate(()=>[...document.querySelectorAll('.brand-mark,.page-header,header,[class*=brand]')].flatMap(e=>[e.matches('.brand-mark')?e.textContent.trim():'',getComputedStyle(e,'::before').content]).filter(s=>/觀/.test(s)));
      log(!marks.length,`${rel} no probation brand mark${marks.length?' → '+marks.join(' | '):''}`);
      const nan=text.split('\n').filter(l=>/\bNaN\b|\bundefined\b/.test(l)).slice(0,2);
      log(!nan.length,`${rel} no NaN/undefined in text${nan.length?' → '+nan.join(' | ').slice(0,120):''}`);
      const over=[];
      for(const w of WIDTHS){
        await page.setViewportSize({width:w,height:900});await page.waitForTimeout(60);
        const d=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        if(d>1)over.push(w+'px(+'+d+')');
      }
      log(!over.length,`${rel} no page-level horizontal overflow${over.length?' at '+over.join(', '):''}`);
      log(!errs.length,`${rel} no runtime errors${errs.length?'\n    '+[...new Set(errs)].slice(0,6).join('\n    '):''}`);
      await ctx.close();
    }
  }finally{await browser.close();srv.kill();}
  console.log(fail?`FAILED ${fail}`:'ALL PASS');process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
