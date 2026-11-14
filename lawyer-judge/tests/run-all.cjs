#!/usr/bin/env node
/*
 * 律司備考平臺｜全站測試總管
 *
 * 第一段：在「要交付的版本」（內含 LawPlayer 111–114 年第二試題庫）上跑資料檢查、單元測試與冒煙測試。
 * 第二段：把專案複製到暫存目錄，先清空題庫跑空狀態冒煙測試，再匯入 tests/fixtures 的虛構測試題跑瀏覽器端完整流程。
 *         交付版本的題庫不會被改動。
 *
 * 用法：node tests/run-all.cjs [--quick]
 *   --quick  只跑第一段
 * 需要：Node 20+、python3、Playwright（PLAYWRIGHT_PATH 或全域安裝）；verification/sync 需先 npm ci。
 * 環境沒有 WebKit 時，只能用 WebKit 的測試會標示為「略過」，不算通過。
 */
'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const quick=process.argv.includes('--quick');
const results=[];

function playwrightDir(){
  const candidates=[process.env.PLAYWRIGHT_PATH&&path.dirname(process.env.PLAYWRIGHT_PATH),'/opt/npm-tools/node_modules',path.join(ROOT,'node_modules')].filter(Boolean);
  return candidates.find(d=>fs.existsSync(path.join(d,'playwright')))||'';
}
const PW_DIR=playwrightDir();
const env={...process.env,NODE_PATH:[PW_DIR,process.env.NODE_PATH].filter(Boolean).join(path.delimiter),PLAYWRIGHT_PATH:PW_DIR?path.join(PW_DIR,'playwright'):''};
function hasWebkit(){
  if(!PW_DIR)return false;
  const r=spawnSync(process.execPath,['-e',"const {webkit}=require('playwright');webkit.launch().then(b=>b.close()).then(()=>process.exit(0),()=>process.exit(1))"],{env,timeout:60000});
  return r.status===0;
}
function run(name,cmd,args,{cwd=ROOT,extraEnv={},timeout=600000}={}){
  const t0=Date.now();
  const r=spawnSync(cmd,args,{cwd,env:{...env,...extraEnv},encoding:'utf8',timeout,maxBuffer:64*1024*1024});
  const ok=r.status===0;
  const out=(r.stdout||'')+(r.stderr||'');
  const line=out.trim().split('\n').filter(Boolean).slice(ok?-1:-6).join('\n    ');
  results.push({name,status:ok?'PASS':'FAIL',secs:((Date.now()-t0)/1000).toFixed(1)});
  console.log(`${ok?'PASS':'FAIL'}  ${name}  (${results.at(-1).secs}s)${ok?'':'\n    '+line}`);
  return ok;
}
function skip(name,reason){results.push({name,status:'SKIP'});console.log(`SKIP  ${name}  — ${reason}`);}
const node=(name,file,args=[],opts)=>run(name,process.execPath,[file,...args],opts);

console.log('== 第一段：交付版本 ==');
node('資料：離線資料檔與 JSON 一致','scripts/generate-file-data.cjs',['--check']);
node('LawPlayer 試題轉換','tests/unit/convert-lawplayer.test.mjs');
node('第一試選擇題：轉換與匯入驗證','tests/unit/import-mcq.test.mjs');
node('首頁排程與專業科目練習臺一致','tests/unit/schedule.test.cjs');
node('設計代幣文字對比（WCAG AA）','tests/unit/contrast.test.cjs');
node('評分要點共用計算與弱點地圖','tests/unit/official-core.test.cjs');
node('整合契約：題庫副本、首頁入口、儲存鍵','verification/unified-integration.cjs',['.']);
node('離線清單','verification/offline-stage4-check.cjs');
node('每日模擬與 AI 提示詞回歸','verification/check-daily-v254.cjs');
node('雙 AI 交接','verification/dual-ai-handoff.cjs');
node('書桌弱點分類','verification/study-desk-weakness.cjs');
node('備份中心','backup/test.cjs');
node('函授規劃','lectures/test.cjs');
node('列印中心','print/test.cjs');
node('共同科目 v0.2','common-subjects/test-v02.cjs');
node('每日英文 v0.4','common-subjects/daily/test-v04.cjs');
node('英文助手','common-subjects/english-assistant/test.cjs');
node('英文單字卡','common-subjects/english-assistant/test-vocab.cjs');
if(fs.existsSync(path.join(ROOT,'verification/sync/node_modules')))run('書桌核心（node --test）','npm',['test','--silent'],{cwd:path.join(ROOT,'verification/sync')});
else skip('書桌核心（node --test）','請先執行 npm --prefix verification/sync ci');
if(PW_DIR)node('考選部評分要點：逐點勾選、骨架回想、失分清單、弱點地圖（交付題庫）','tests/e2e/official-points.cjs');
if(PW_DIR)node('冒煙測試：17 頁 × 11 種寬度（交付題庫）','tests/e2e/smoke.cjs',[],{extraEnv:{SMOKE_PORT:'8861'}});
if(PW_DIR)node('第一試選擇題頁面（作答、錯題本、整卷、計時、備份）','tests/e2e/mcq.cjs',[],{extraEnv:{SMOKE_PORT:'8865'}});
if(PW_DIR)node('專業科目逐日（週一到週日）科目與文字','tests/e2e/weekdays.cjs',[],{extraEnv:{SMOKE_PORT:'8864'}});
else skip('冒煙測試','找不到 Playwright');

if(!quick){
  console.log('\n== 第二段：暫存副本＋虛構測試題 ==');
  if(!PW_DIR){skip('瀏覽器流程測試','找不到 Playwright');}
  else{
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lsdesk-test-'));
    fs.cpSync(ROOT,tmp,{recursive:true,filter:src=>!/[\\/](\.git|node_modules)([\\/]|$)/.test(path.relative(ROOT,src))||src.includes(path.join('verification','sync','node_modules'))});
    const webkit=hasWebkit();
    try{
      node('清空題庫（暫存副本）','scripts/import-questions.mjs',['--empty'],{cwd:tmp});
      node('冒煙測試：空題庫的空狀態','tests/e2e/smoke.cjs',[],{cwd:tmp,extraEnv:{SMOKE_PORT:'8863'}});
      node('匯入虛構主題庫','scripts/import-questions.mjs',['tests/fixtures/sample-questions.json'],{cwd:tmp});
      node('匯入虛構每日模擬題','scripts/import-questions.mjs',['--daily','tests/fixtures/sample-daily.json'],{cwd:tmp});
      node('轉換並合併匯入 LawPlayer 試題','scripts/convert-lawplayer.mjs',['tests/fixtures/lawplayer','-o','lawplayer-test.json'],{cwd:tmp});
      node('合併匯入轉換結果','scripts/import-questions.mjs',['lawplayer-test.json','--merge'],{cwd:tmp});
      node('整合契約（有題目）','verification/unified-integration.cjs',['.'],{cwd:tmp});
      node('冒煙測試（有題目）','tests/e2e/smoke.cjs',[],{cwd:tmp,extraEnv:{SMOKE_PORT:'8862'}});
      node('專業科目：版面、雷達圖、自評、練習脈絡','verification/layout-review-browser.cjs',['.'],{cwd:tmp});
      node('首頁與專業科目整合（Chromium）','verification/unified-browser.cjs',['.'],{cwd:tmp});
      node('每日模擬端對端（Chromium）','verification/e2e-daily-v254.cjs',[],{cwd:tmp});
      node('手機導覽與書桌','verification/mobile-home-desk-nav.cjs',['.'],{cwd:tmp});
      node('手機版面 375/390/430','verification/mobile-rwd-seven-browser.cjs',['.'],{cwd:tmp,extraEnv:{TEST_ENGINES:webkit?'chromium,webkit':'chromium'}});
      node('各頁橫向溢出 320–1440','tests/e2e/overflow.cjs',[],{cwd:tmp});
      node('離線下載與斷網作答（Chromium）','verification/offline-stage4-browser.cjs',['.'],{cwd:tmp});
      node('ZIP 直開離線模式（Chromium）','verification/stage5-file-zip-browser.cjs',['.'],{cwd:tmp,extraEnv:{TEST_BROWSER:'chromium'}});
      const exe=['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find(p=>fs.existsSync(p));
      node('書桌瀏覽器流程','verification/sync/local-browser.cjs',[],{cwd:tmp,extraEnv:exe?{BROWSER_EXECUTABLE:exe}:{}});
      if(webkit){
        node('首頁與專業科目整合（WebKit）','verification/unified-browser.cjs',['.'],{cwd:tmp,extraEnv:{UNIFIED_BROWSER_ENGINE:'webkit'}});
        node('函授介面（WebKit）','lectures/test-ui.cjs',[],{cwd:tmp});
      }else{
        skip('WebKit 相關測試（unified-browser webkit、lectures/test-ui、mobile-rwd webkit）','此環境沒有安裝 WebKit');
      }
    }finally{fs.rmSync(tmp,{recursive:true,force:true});}
  }
}

const count=s=>results.filter(r=>r.status===s).length;
console.log(`\n結果：通過 ${count('PASS')}、失敗 ${count('FAIL')}、略過 ${count('SKIP')}`);
process.exit(count('FAIL')?1:0);
