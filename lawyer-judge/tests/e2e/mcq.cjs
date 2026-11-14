#!/usr/bin/env node
/* 第一試選擇題練習：答題與即時對答案、錯題本與複習日、整卷計時與交卷、重新載入後續答、備份中心匯出入。
 * 以交付題庫（mcq/bank.js）為準，不寫死題數；正解從頁面上的 window.MCQ_BANK 讀取。
 * 用法：node tests/e2e/mcq.cjs（需要 python3 與 playwright） */
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const ROOT=path.resolve(__dirname,'..','..'),PORT=Number(process.env.SMOKE_PORT||8865),BASE=`http://localhost:${PORT}`;
const KEY='psd-mcq-v1';
let pass=0;const ok=m=>{pass++;console.log('PASS '+m);};
const store=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),KEY);

(async()=>{
  const srv=spawn('python3',['-m','http.server',String(PORT),'-d',ROOT],{stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({timezoneId:'Asia/Taipei',serviceWorkers:'block',viewport:{width:390,height:844}});
    const p=await ctx.newPage(),errs=[];
    p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
    await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#subject-groups input');

    // 題庫與資料契約
    const bank=await p.evaluate(()=>window.MCQ_BANK);
    assert(bank.length>0,'bank loaded');
    const ids=new Set(bank.map(q=>q.id));assert.equal(ids.size,bank.length,'unique ids');
    for(const q of bank){
      assert(['ok','multi','incomplete'].includes(q.status),'status '+q.id);
      if(q.status==='incomplete')assert.deepEqual([q.answer,q.acceptedAnswers.length,q.options.length],[null,0,0],'incomplete has no answer '+q.id);
      else{assert.equal(q.options.length,4,'4 options '+q.id);assert(q.acceptedAnswers.includes(q.answer),'answer accepted '+q.id);}
    }
    ok(`題庫 ${bank.length} 題：id 唯一、每題 4 選項與正解（殘缺題標為 incomplete）`);
    const correctOf=id=>bank.find(q=>q.id===id);

    // 依科目練習：選刑法、10 題；第一題故意答錯、第二題答對
    await p.click('#subjects-none');
    await p.check('#subject-groups input[value="刑法"]');
    await p.selectOption('#count','10');
    await p.waitForFunction(()=>/符合條件/.test(document.getElementById('pool-info').textContent));
    await p.click('#practice-start');
    await p.waitForSelector('#question-card .question-text');
    const idOf=async()=>p.evaluate(()=>{const t=document.querySelector('#question-card .question-text').textContent;return window.MCQ_BANK.find(q=>q.body===t)?.id;});
    let q1=correctOf(await idOf());assert.equal(q1.subject,'刑法');
    const wrongLetter=['A','B','C','D'].find(L=>!q1.acceptedAnswers.includes(L));
    assert.equal(await p.locator('#submit-answer').isDisabled(),true,'submit disabled before choosing');
    await p.check(`#question-card input[value="${wrongLetter}"]`);
    await p.click('#submit-answer');
    await p.waitForSelector('#question-card .feedback.bad');
    assert(/答錯了/.test(await p.locator('#question-card .feedback').innerText()));
    assert.equal(await p.locator('#question-card .option.correct').count(),q1.acceptedAnswers.length,'correct option marked');
    assert(/✓ 正確答案/.test(await p.locator('#question-card .option.correct').first().innerText()),'correctness not by colour alone');
    ok('作答後立刻顯示答錯與正確答案（文字＋標示，不只靠顏色）');
    await p.click('#next-question');
    await p.waitForSelector('#submit-answer');
    let q2=correctOf(await idOf());
    await p.check(`#question-card input[value="${q2.answer}"]`);
    await p.click('#submit-answer');
    await p.waitForSelector('#question-card .feedback.ok');
    ok('答對顯示「答對了」');
    let s=await store(p);
    assert.equal(s.records[q1.id].w,1);assert.equal(s.records[q1.id].b,0);
    assert.equal(s.records[q2.id].w,0);assert.equal(s.records[q2.id].c,1);
    const tomorrow=await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
    assert.equal(s.records[q1.id].d,tomorrow,'wrong answer is due tomorrow');
    ok('紀錄寫入：錯題進錯題本、隔天複習；答對不進錯題本');

    // 重新載入後可接續
    await p.reload();await p.waitForSelector('#resume-box:not([hidden])');
    assert(/做到第 2／10 題/.test(await p.locator('#resume-detail').innerText()));
    await p.click('#resume-go');await p.waitForSelector('#question-card .feedback.ok');
    assert.equal((await p.locator('#session-heading').innerText()).trim(),'第 2／10 題','shows the answered question with its feedback');
    await p.click('#next-question');await p.waitForSelector('#submit-answer');
    assert.equal((await p.locator('#session-heading').innerText()).trim(),'第 3／10 題');
    ok('重新載入後接續上次練習（回到第 2 題的對答案畫面，再進第 3 題）');
    await p.click('#session-end');await p.waitForSelector('#result-heading');
    assert(/本次練習結果/.test(await p.locator('#result-heading').innerText()));
    assert(/1／2/.test(await p.locator('#result-body .stat').first().innerText()),'result counts 1 of 2');
    await p.click('#result-body .actions button.secondary');await p.waitForSelector('#home-view:not([hidden])');
    ok('結束練習看結果：已答 2 題、答對 1 題');

    // 錯題本與到期複習
    assert.equal((await p.locator('#wrong-badge').innerText()).trim(),'1');
    await p.click('#tab-wrong');
    assert(/錯題本 1 題/.test(await p.locator('#wrong-info').innerText()));
    assert.equal(await p.locator('#wrong-practice-due').isDisabled(),true,'not due today');
    await p.evaluate(({k,id})=>{const s=JSON.parse(localStorage.getItem(k));s.records[id].d='2000-01-01';localStorage.setItem(k,JSON.stringify(s));},{k:KEY,id:q1.id});
    await p.reload();await p.click('#tab-wrong');
    assert.equal(await p.locator('#wrong-practice-due').isDisabled(),false,'due after date passes');
    await p.click('#wrong-practice-due');await p.waitForSelector('#submit-answer');
    assert.equal(await idOf(),q1.id,'review serves the wrong question');
    await p.check(`#question-card input[value="${q1.answer}"]`);await p.click('#submit-answer');
    s=await store(p);assert.equal(s.records[q1.id].b,1);assert.equal(s.records[q1.id].w,1,'still in book after first correct review');
    const plus3=await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+3);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
    assert.equal(s.records[q1.id].d,plus3,'next review in 3 days');
    ok('錯題複習：答對後間隔改為 3 天，仍留在錯題本');
    await p.click('#session-end');await p.waitForSelector('#result-heading');
    await p.click('#result-body .actions button.secondary');

    // 整卷模擬：不計時，答幾題後交卷，檢查計分
    await p.click('#tab-exam');
    const year=bank.find(q=>q.paper==='卷三').year;
    await p.selectOption('#exam-year',String(year));await p.selectOption('#exam-paper','卷三');await p.selectOption('#exam-timer','off');
    const paperQs=bank.filter(q=>q.year===year&&q.paper==='卷三').sort((a,b)=>a.no-b.no);
    const scoredQs=paperQs.filter(q=>q.status!=='incomplete');
    assert(new RegExp(`${paperQs.length} 題（計分 ${scoredQs.length} 題，滿分 ${scoredQs.length*2} 分）`).test(await p.locator('#exam-info').innerText()),'exam info');
    await p.click('#exam-start');await p.waitForSelector('#navigator button');
    assert.equal(await p.locator('#navigator button').count(),paperQs.length);
    assert.equal(await p.locator('#timer').isHidden(),true,'no timer when off');
    // 前 5 題：3 題答對、1 題答錯、1 題留白
    const plan=['right','right','wrong','right','blank'];
    for(let i=0;i<5;i++){
      const q=paperQs[i];
      if(q.status==='incomplete'){plan[i]='skip';}
      else if(plan[i]!=='blank'){
        const L=plan[i]==='right'?q.answer:['A','B','C','D'].find(x=>!q.acceptedAnswers.includes(x));
        await p.check(`#question-card input[value="${L}"]`);
      }
      if(i<4)await p.click('#question-card .actions button:has-text("下一題")');
    }
    const expectCorrect=plan.filter((x,i)=>x==='right').length;
    await p.click('#session-end');
    await p.waitForSelector('[role=alertdialog]');
    assert(/還有 \d+ 題沒作答/.test(await p.locator('[role=alertdialog]').innerText()));
    await p.click('[role=alertdialog] button.primary');
    await p.waitForSelector('#result-heading');
    const scoreText=await p.locator('#result-body .stat').first().innerText();
    assert(scoreText.replace(/\s/g,'').startsWith(`${expectCorrect*2}／${scoredQs.length*2}`),'score '+scoreText);
    assert(await p.locator('#result-body table tbody tr').count()>=2,'per-subject table');
    ok(`整卷模擬：交卷計分 ${expectCorrect*2}／${scoredQs.length*2} 分，並列出各科得分`);
    await p.click('#result-body .actions button.secondary');await p.click('#tab-exam');
    assert(await p.locator('#exam-history tbody tr').count()===1,'history row');
    ok('歷次整卷成績有紀錄，可再看檢討');

    // 計時：用假時鐘快轉，時間到自動交卷
    const ctx2=await browser.newContext({timezoneId:'Asia/Taipei',serviceWorkers:'block'});
    const t=await ctx2.newPage();await t.clock.install({time:new Date('2026-10-25T09:00:00+08:00')});
    await t.goto(BASE+'/mcq/index.html');await t.waitForSelector('#subject-groups input');
    await t.click('#tab-exam');await t.selectOption('#exam-paper','卷四');await t.click('#exam-start');await t.waitForSelector('#timer:not([hidden])');
    assert(/剩餘 (80:00|79:5\d)/.test(await t.locator('#timer').innerText()),'卷四 80 minutes');
    await t.clock.fastForward(81*60*1000);
    await t.waitForSelector('#result-heading',{timeout:5000});
    assert(/時間到，已自動交卷/.test(await t.locator('#result-body').innerText()));
    ok('計時：卷四 80 分鐘倒數，時間到自動交卷');
    await ctx2.close();

    // 殘缺題：不計分、沒有選項
    const bad=bank.find(q=>q.status==='incomplete');
    if(bad){
      await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#tab-exam');await p.click('#tab-exam');
      await p.selectOption('#exam-year',String(bad.year));await p.selectOption('#exam-paper',bad.paper);await p.selectOption('#exam-timer','off');
      await p.click('#exam-start');await p.waitForSelector('#navigator button');
      await p.click(`#navigator button:has-text("${bad.no}")`);
      assert(/不計分/.test(await p.locator('#question-card').innerText()));
      assert.equal(await p.locator('#question-card input[type=radio]').count(),0);
      ok('原檔殘缺的題目顯示「不計分」且沒有選項');
      await p.click('#session-end');await p.click('[role=alertdialog] button.primary');await p.waitForSelector('#result-heading');
    }

    // 不確定標記、錯因、已過時、依法條歸類
    await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#subject-groups input');
    await p.click('#subjects-none');await p.check('#subject-groups input[value="民法"]');await p.selectOption('#count','10');
    await p.waitForFunction(()=>/符合條件/.test(document.getElementById('pool-info').textContent));
    await p.click('#practice-start');await p.waitForSelector('#submit-answer');
    const u1=correctOf(await idOf());
    await p.check(`#question-card input[value="${u1.answer}"]`);await p.check('#unsure');await p.click('#submit-answer');
    await p.waitForSelector('#question-card .feedback.ok');
    assert(/不確定/.test(await p.locator('#question-card .feedback').innerText()),'feedback mentions unsure');
    s=await store(p);assert.deepEqual([s.records[u1.id].u,s.records[u1.id].w,s.records[u1.id].c,s.records[u1.id].d],[1,1,1,tomorrow],'unsure-correct is scheduled like a wrong answer but counts as correct');
    ok('不確定標記：答對仍計為答對，但排進錯題本、隔天複習');
    await p.click('#next-question');await p.waitForSelector('#submit-answer');
    assert.equal(await p.locator('#unsure').isChecked(),false,'unsure resets for the next question');
    const w1=correctOf(await idOf()),bad1=['A','B','C','D'].find(L=>!w1.acceptedAnswers.includes(L));
    await p.check(`#question-card input[value="${bad1}"]`);await p.click('#submit-answer');await p.waitForSelector('#question-card .cause-set');
    await p.check('#question-card .cause-set input[value="k"]');
    s=await store(p);assert.equal(s.records[w1.id].e,'k','cause saved');
    await p.click('#next-question');await p.waitForSelector('#submit-answer');
    const w2=correctOf(await idOf()),bad2=['A','B','C','D'].find(L=>!w2.acceptedAnswers.includes(L));
    await p.check(`#question-card input[value="${bad2}"]`);await p.click('#submit-answer');await p.waitForSelector('#question-card .cause-set');
    await p.click('#question-card .small-btn');
    s=await store(p);assert.equal(s.records[w2.id].x,1,'outdated flag saved');
    await p.click('#session-end');await p.waitForSelector('#result-heading');
    assert(/不確定/.test(await p.locator('#result-body').innerText()),'result mentions guessed questions');
    await p.click('#result-body .actions button.secondary');await p.waitForSelector('#home-view:not([hidden])');
    await p.click('#tab-wrong');
    const wrongText=await p.locator('#wrong-list').innerText();
    assert(/猜對/.test(wrongText),'guessed question is labelled in the wrong book');
    const inBook=await p.evaluate(()=>[...document.querySelectorAll('#wrong-list .qtext')].map(e=>e.textContent));
    assert(inBook.includes(w1.body)&&inBook.includes(u1.body),'wrong and guessed questions are in the book');
    assert(!inBook.includes(w2.body),'the outdated question is hidden from the book');
    ok('錯因存檔；標為已過時的題目不進錯題本');
    // 已過時的題不再被抽到
    const pooled=await p.evaluate(({k,id})=>{const s=JSON.parse(localStorage.getItem(k));return !!s.records[id].x;},{k:KEY,id:w2.id});assert(pooled);
    await p.click('#tab-stats');
    assert(/不知道這個規定/.test(await p.locator('#stats-causes').innerText()));
    assert.equal(await p.locator('#stats-outdated li').count(),1);
    // 依法條：放一筆「答錯過、題目有條號」的紀錄
    const withArt=bank.find(q=>q.subject==='民法'&&q.status==='ok'&&/民法第\s*\d+\s*條/.test(q.body+q.options.join('')));
    assert(withArt,'bank has a 民法 question citing an article');
    await p.evaluate(({k,id})=>{const s=JSON.parse(localStorage.getItem(k));s.records[id]={n:1,c:0,w:1,b:0,d:'2099-01-01',l:'A',t:new Date().toISOString()};localStorage.setItem(k,JSON.stringify(s));},{k:KEY,id:withArt.id});
    await p.reload();await p.click('#tab-stats');
    const artText=await p.locator('#stats-articles').innerText();
    assert(/民法第 \d+ 條/.test(artText),'article table lists a 民法 article: '+artText.slice(0,80));
    assert(/%）有寫到條號/.test(await p.locator('#stats-articles-note').innerText()),'coverage is stated');
    await p.click('#stats-articles button');await p.waitForSelector('#submit-answer');
    const artQ=correctOf(await idOf());assert(/第\s*\d+\s*條/.test(artQ.body+artQ.options.join('')),'article practice serves a question citing an article');
    assert.notEqual(artQ.id,w2.id,'outdated question is not served');
    await p.click('#session-end');await p.waitForSelector('#result-heading');await p.click('#result-body .actions button.secondary');
    await p.click('#tab-stats');await p.click('#stats-outdated button');
    s=await store(p);assert.equal(s.records[w2.id].x,undefined,'outdated flag can be removed');
    ok('統計：錯因分布、最常出錯的條文（含涵蓋率與練習）、已過時清單可取消');

    // 統計與備份
    await p.goto(BASE+'/mcq/index.html');await p.click('#tab-stats');
    assert(await p.locator('#stats-table tbody tr').count()===15,'15 subjects');
    assert(/刑法/.test(await p.locator('#stats-table tbody').innerText()));
    ok('統計：15 科都有列');
    await p.goto(BASE+'/backup/index.html');await p.waitForSelector('#modules');
    assert(/第一試選擇題紀錄|題做過的選擇題/.test(await p.locator('#modules').innerText()),'backup lists MCQ records');
    ok('備份中心列出選擇題紀錄');

    // 手機寬度沒有橫向溢出（練習首頁、作答、結果）
    for(const w of [320,375,430,768,1280]){
      await p.setViewportSize({width:w,height:900});
      for(const url of ['/mcq/index.html']){await p.goto(BASE+url);await p.waitForSelector('#subject-groups input');
        const d=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(d<=1,`overflow at ${w}: ${d}`);}
    }
    ok('320–1280 px 沒有整頁水平溢出');

    assert.deepEqual(errs,[],'no runtime errors: '+errs.join(' | '));
    ok('沒有執行錯誤');
  }finally{await browser.close();srv.kill();}
  console.log(`ALL PASS (${pass})`);
})().catch(e=>{console.error(e);process.exit(1);});
