#!/usr/bin/env node
/* 第一試選擇題：通勤練習（固定題數、中斷續讀）、章節篩選與逐題更正、送給觀護人弱點地圖的摘要。
 * 用法：node tests/e2e/mcq-commute.cjs（需要 python3 與 playwright） */
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const ROOT=path.resolve(__dirname,'..','..'),PORT=Number(process.env.SMOKE_PORT||8871),BASE=`http://localhost:${PORT}`;
const KEY='psd-mcq-v1',WEAK='lsdesk-mcq-weak-v1';
let pass=0;const ok=m=>{pass++;console.log('PASS '+m);};
const read=(p,k)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),k);
const overflow=async(p,label)=>{const r=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);assert(r[0]<=r[1],label+' overflow '+r);};

(async()=>{
  const srv=spawn('python3',['-m','http.server',String(PORT),'-d',ROOT],{stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
  const browser=await chromium.launch();
  try{
    const ctx=await browser.newContext({timezoneId:'Asia/Taipei',serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true});
    const p=await ctx.newPage(),errs=[];
    p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
    await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#subject-groups input');
    const bank=await p.evaluate(()=>window.MCQ_BANK);
    const answerOf=id=>bank.find(q=>q.id===id).answer,wrongOf=id=>['A','B','C','D'].find(L=>!bank.find(q=>q.id===id).acceptedAnswers.includes(L));
    const pick=async L=>{await p.locator(`#question-card input[type=radio][value="${L}"]`).check();await p.click('#submit-answer');};

    // 通勤練習：預設刑法＋刑訴，20 題，全部來自這兩科
    assert.equal(await p.locator('#commute-subject').inputValue(),'criminal');
    assert.match(await p.textContent('#commute-info'),/到期該複習的錯題 0 題、還沒做過的 \d+ 題/);
    await p.click('#commute-20');
    await p.waitForSelector('#session-view:not([hidden])');
    let s=await read(p,KEY);
    assert.equal(s.active.ids.length,20);assert.equal(s.active.commute,1);
    assert(s.active.ids.every(id=>['刑法','刑事訴訟法'].includes(bank.find(q=>q.id===id).subject)),'commute questions come from the chosen subjects');
    assert.equal(new Set(s.active.ids).size,20,'no repeated question');
    assert.equal(await p.textContent('#session-kind'),'通勤練習');
    assert.equal(await p.evaluate(()=>document.body.classList.contains('mcq-commute')),true);
    const first=s.active.ids;
    // 第一題答錯、第二題答對，做到第三題
    await pick(wrongOf(first[0]));await p.click('#next-question');
    await pick(answerOf(first[1]));
    const sticky=await p.evaluate(()=>getComputedStyle(document.getElementById('next-question').parentElement).position);
    assert.equal(sticky,'sticky','next button stays reachable while scrolling');
    assert.equal(await p.evaluate(()=>document.getElementById('next-question').parentElement.children.length),1,'only the next button is pinned');
    assert.equal(await p.locator('#question-card .actions.plain button').count(),1,'mark-outdated stays in the page flow');
    const nb=await p.locator('#next-question').boundingBox();assert(nb.height>=44&&nb.y+nb.height<=844-56,'next button is above the bottom navigation');
    await overflow(p,'commute session 390');
    await p.click('#next-question');
    assert.match(await p.textContent('#session-heading'),/第 3／20 題/);
    ok('通勤練習：一鍵 20 題，只出刑法與刑訴，作答按鈕固定在下方');

    // 中斷續讀：重新載入直接回到第 3 題；#home 留在首頁；先停在這裡回首頁但進度還在
    await p.reload();await p.waitForSelector('#session-view:not([hidden])');
    assert.match(await p.textContent('#session-heading'),/第 3／20 題/,'reload resumes at the same question');
    s=await read(p,KEY);assert.deepEqual(s.active.ids,first);assert.equal(Object.keys(s.active.results).length,2);
    await p.click('#session-pause');
    await p.waitForSelector('#home-view:not([hidden])');
    assert.equal(await p.locator('#resume-box').isVisible(),true);
    assert.match(await p.textContent('#resume-detail'),/第 3／20 題/);
    assert.equal(await p.locator('#commute-20').isDisabled(),true,'cannot start a second set while one is unfinished');
    assert.equal(await p.evaluate(()=>document.body.classList.contains('mcq-commute')),false);
    await p.goto(BASE+'/mcq/index.html#home');await p.waitForSelector('#subject-groups input');
    assert.equal(await p.locator('#home-view').isVisible(),true,'#home keeps the home view');
    await p.click('#resume-go');await p.waitForSelector('#session-view:not([hidden])');
    assert.match(await p.textContent('#session-heading'),/第 3／20 題/);
    ok('中斷續讀：重新打開直接回到同一題；先停在這裡後可接續');

    // 通勤作答後看得到章節，可以更正
    await pick(answerOf(first[2]));
    await p.waitForSelector('.chapter-box');
    const q3=bank.find(q=>q.id===first[2]);
    const autoTags=await p.evaluate(id=>window.LSDeskMcqChapters.autoTags(window.MCQ_BANK.find(q=>q.id===id)),q3.id);
    assert.equal(await p.locator('.chapter-tags li').count(),Math.max(1,autoTags.length));
    assert.match(await p.textContent('.chapter-box p'),/自動歸類/);
    const addSel=p.locator('.chapter-edit select');
    const addId=await addSel.locator('option').nth(1).getAttribute('value');
    await addSel.selectOption(addId);
    s=await read(p,KEY);
    assert(s.chapters[q3.id].includes(addId)&&autoTags.every(t=>s.chapters[q3.id].includes(t)),'added chapter is stored with the automatic ones');
    assert.match(await p.textContent('.chapter-box p'),/你更正過/);
    if(autoTags.length){await p.locator('.chip-remove').first().click();s=await read(p,KEY);assert.equal(s.chapters[q3.id].length,autoTags.length,'one chapter removed');}
    await overflow(p,'chapter box 390');
    await p.setViewportSize({width:320,height:700});await overflow(p,'chapter box 320');await p.setViewportSize({width:390,height:844});
    await p.getByRole('button',{name:'還原自動歸類'}).click();
    s=await read(p,KEY);assert.equal(Object.prototype.hasOwnProperty.call(s.chapters,q3.id),false,'restore removes the override');
    assert.match(await p.textContent('.chapter-box p'),/自動歸類/);
    ok('章節標籤：作答後顯示，可加入、移除、還原');

    // 結束並看結果；弱點摘要只算還在錯題本的題目
    await p.click('#session-end');await p.waitForSelector('#result-view:not([hidden])');
    s=await read(p,KEY);assert.equal(s.active,null);
    const weak=await read(p,WEAK);
    assert.equal(weak.version,1);assert(weak.updatedAt);
    assert.deepEqual(Object.keys(weak.subjects),['刑法','刑事訴訟法']);
    const doneBy={刑法:0,刑事訴訟法:0};for(const id of first.slice(0,3))doneBy[bank.find(q=>q.id===id).subject]++;
    for(const sub of Object.keys(doneBy))assert.equal(weak.subjects[sub].done,doneBy[sub],'done count '+sub);
    const missSub=bank.find(q=>q.id===first[0]).subject;
    assert.equal(weak.subjects[missSub].wrong,1);assert.equal(weak.subjects[missSub==='刑法'?'刑事訴訟法':'刑法'].wrong,0);
    const missTags=await p.evaluate(id=>window.LSDeskMcqChapters.autoTags(window.MCQ_BANK.find(q=>q.id===id)),first[0]);
    assert.deepEqual(weak.subjects[missSub].chapters.map(c=>c.id).sort(),missTags.slice().sort(),'weak chapters are the missed question\'s chapters');
    for(const c of weak.subjects[missSub].chapters)assert.deepEqual([c.wrong>=1,c.done>=c.wrong,typeof c.name],[true,true,'string']);
    for(const a of weak.subjects[missSub].articles)assert(a.name.includes('第')&&a.wrong===1);
    // 沒有變動時不重寫（updatedAt 不變）
    await p.reload();await p.waitForSelector('#subject-groups input');
    assert.equal((await read(p,WEAK)).updatedAt,weak.updatedAt,'summary is not rewritten when nothing changed');
    ok('弱點摘要：只含刑法、刑訴，依還在錯題本的題目統計條文與章節');

    // 下一組通勤練習先出到期的錯題（把那一題的複習日改成今天）
    await p.evaluate(([k,id])=>{const st=JSON.parse(localStorage.getItem(k));const d=new Date();st.records[id].d=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;localStorage.setItem(k,JSON.stringify(st));},[KEY,first[0]]);
    await p.reload();await p.waitForSelector('#subject-groups input');
    assert.match(await p.textContent('#commute-info'),/到期該複習的錯題 1 題/);
    await p.selectOption('#commute-subject',missSub);
    await p.click('#commute-30');await p.waitForSelector('#session-view:not([hidden])');
    s=await read(p,KEY);
    assert.equal(s.active.ids.length,30);assert.equal(s.active.ids[0],first[0],'due wrong question comes first');
    assert(s.active.ids.every(id=>bank.find(q=>q.id===id).subject===missSub));
    assert(s.active.ids.slice(1).every(id=>!s.records[id]),'the rest are questions not done before');
    assert.equal(s.settings.commute,missSub,'chosen commute subject is remembered');
    await p.click('#session-end');await p.waitForSelector('#result-view:not([hidden])');
    ok('通勤練習：到期錯題排最前，其餘補還沒做過的題目，記住科目');

    // 章節篩選：只勾一科才出現；題數與歸類一致；出的題都屬於該章
    await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#subject-groups input');
    assert.equal(await p.locator('#chapter-wrap').isVisible(),false);
    assert.equal(await p.locator('#chapter-hint').isVisible(),true);
    await p.click('#subjects-none');await p.locator('#subject-groups input[value="刑事訴訟法"]').check();
    assert.equal(await p.locator('#chapter-wrap').isVisible(),true);
    assert.equal(await p.locator('#chapter-hint').isVisible(),false);
    await p.selectOption('#chapter','cp-search');
    const expected=await p.evaluate(()=>window.MCQ_BANK.filter(q=>q.subject==='刑事訴訟法'&&q.status!=='incomplete'&&window.LSDeskMcqChapters.inChapter(q,'cp-search',{})).map(q=>q.id));
    assert(expected.length>10);
    assert.match(await p.textContent('#pool-info'),new RegExp('符合條件 '+expected.length+' 題'));
    assert.match(await p.locator('#chapter option[value="cp-search"]').textContent(),new RegExp('（'+expected.length+'）'));
    await p.selectOption('#count','50');await p.click('#practice-start');await p.waitForSelector('#session-view:not([hidden])');
    s=await read(p,KEY);
    assert.equal(s.active.ids.length,Math.min(50,expected.length));assert(s.active.ids.every(id=>expected.includes(id)),'only questions in the chosen chapter');
    assert.equal(s.active.commute,undefined);assert.equal(s.settings.chapter,'cp-search');assert.equal(s.settings.commute,missSub,'practice settings keep the commute subject');
    // 把第一題移出這一章：這一章的題數少一題
    await pick(answerOf(s.active.ids[0]));await p.waitForSelector('.chapter-box');
    await p.getByRole('button',{name:/移出「搜索、扣押與通訊監察」/}).click();
    await p.click('#session-end');await p.waitForSelector('#result-view:not([hidden])');
    await p.goto(BASE+'/mcq/index.html');await p.waitForSelector('#subject-groups input');
    assert.equal(await p.locator('#chapter').inputValue(),'cp-search','chapter choice is remembered');
    assert.match(await p.textContent('#pool-info'),new RegExp('符合條件 '+(expected.length-1)+' 題'),'corrected question leaves the chapter');
    // 勾第二科：章節選單收起，篩選不再生效
    await p.locator('#subject-groups input[value="刑法"]').check();
    assert.equal(await p.locator('#chapter-wrap').isVisible(),false);
    const both=bank.filter(q=>['刑法','刑事訴訟法'].includes(q.subject)&&q.status!=='incomplete').length;
    assert.match(await p.textContent('#pool-info'),new RegExp('符合條件 '+both+' 題'));
    // 沒有章節歸類的科目不出現章節選單
    await p.click('#subjects-none');await p.locator('#subject-groups input[value="民法"]').check();
    assert.equal(await p.locator('#chapter-wrap').isVisible(),false);
    for(const w of [320,360,430,768,1280]){await p.setViewportSize({width:w,height:800});await overflow(p,'home '+w);}
    ok('章節篩選：單一科目才出現，題數一致，更正後即時反映');

    assert.deepEqual(errs,[],'no runtime errors: '+errs.join(' | '));
    ok('沒有執行錯誤');
  }finally{await browser.close();srv.kill();}
  console.log(`ALL PASS (${pass})`);
})().catch(e=>{console.error(e);process.exit(1);});
