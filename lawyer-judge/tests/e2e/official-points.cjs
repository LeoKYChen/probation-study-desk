// 考選部評分要點：v2.5 逐點勾選、骨架回想、失分清單、複習頁弱點地圖、備份中心（Chromium）。
'use strict';
const assert=require('node:assert/strict'),path=require('path'),http=require('http'),fs=require('fs');
const root=path.resolve(__dirname,'..','..');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{if(q.url==='/favicon.ico'){r.writeHead(204);return r.end();}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const CK='lsdesk-official-check-v1',RK='lsdesk-outline-recall-v1',ID='lawplayer-112-criminal-law-procedure-1';
let n=0;const ok=m=>{n++;console.log('PASS '+m);};
(async()=>{await new Promise(r=>srv.listen(0,r));const base=`http://localhost:${srv.address().port}`;
const {chromium}=require('playwright');const b=await chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{});
try{
const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block',timezoneId:'Asia/Taipei'});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url());});p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const get=k=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),k);
const noOverflow=async w=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'橫向溢出 '+w);

// v2.5：面板逐點勾選
await p.goto(base+'/v2.5/index.html');
await p.evaluate(id=>{const q=window.QUESTION_BANK.find(x=>x.id===id);document.getElementById('questionTitle').textContent=q.title;document.getElementById('directionPanel').hidden=false;window.dispatchEvent(new Event('practice25:render'));},ID);
await p.evaluate(()=>{document.getElementById('officialPoints').open=true;});
assert.equal(await p.locator('#officialPoints .op-items > li').count(),12);
await p.evaluate(()=>{const li=document.querySelectorAll('#officialPoints .op-items > li');li[0].querySelector('input[value=hit]').click();li[1].querySelector('input[value=miss]').click();li[5].querySelector('input[value=miss]').click();});
let c=await get(CK);assert.deepEqual(c[ID].marks,{0:'hit',1:'miss',5:'miss'});assert.equal(c[ID].n,12);
assert(/有寫到 1、漏掉 2/.test(await p.locator('#officialPoints .op-status').innerText()));
await p.evaluate(()=>document.querySelectorAll('#officialPoints .op-items > li')[5].querySelector('input[value=miss]').click());
c=await get(CK);assert.deepEqual(c[ID].marks,{0:'hit',1:'miss'},'再點一次取消');
await p.evaluate(()=>window.dispatchEvent(new Event('practice25:render')));
assert.equal(await p.evaluate(()=>document.querySelectorAll('#officialPoints .op-items > li')[1].querySelector('input[value=miss]').checked),true,'重繪後保留勾選');
await p.evaluate(()=>{const q=window.QUESTION_BANK.find(x=>!window.OFFICIAL_POINTS[x.id]);document.getElementById('questionTitle').textContent=q.title;window.dispatchEvent(new Event('practice25:render'));});
assert.equal(await p.locator('#officialPoints').count(),0,'沒收錄的題目不顯示');await noOverflow(390);
ok('考古題練習臺：評分要點 12 點可逐點勾選、取消、重繪後保留；未收錄題不顯示');

// 失分清單
await p.goto(base+'/official/index.html');
assert(/漏掉的爭點（1 點）/.test(await p.locator('#panel-missed').innerText()));
assert(/恐嚇危害安全罪/.test(await p.locator('#panel-missed .queue').innerText()));
assert(/50%・1 題/.test(await p.locator('#panel-missed .mastery').innerText()));
await p.click('#tab-checklist');assert.equal(await p.locator('#panel-checklist .theme-list > li').count(),9);
const firstTheme=p.locator('#panel-checklist .theme-list > li').first();assert(/作答前自問/.test(await firstTheme.innerText()));
await firstTheme.locator('summary').click();assert(/\d{3} 年.+第 \d 題｜/.test(await firstTheme.locator('details p').first().innerText()),'原文附出處');
await p.selectOption('#k-subject','財稅法');assert(/財稅法：\d+ 題有閱卷委員的話/.test(await p.locator('#panel-checklist [role=status]').innerText()));await noOverflow('checklist');
await p.click('#tab-commentary');assert(await p.locator('#panel-commentary .c-block').count()>150,'全部科目');
await p.selectOption('#c-subject','刑法與刑事訴訟法');assert.equal(await p.locator('#panel-commentary .c-block').count(),16,'107–114 年各 2 題');
await p.fill('#c-search','涵攝');const hit=await p.locator('#panel-commentary .c-block').count();assert(hit>0&&hit<16,'關鍵字只留下含該字的題目');
assert(await p.evaluate(()=>[...document.querySelectorAll('#panel-commentary .c-block p')].every(e=>e.textContent.includes('涵攝'))));
await p.fill('#c-search','不存在的關鍵字xyz');assert(/沒有符合/.test(await p.locator('#panel-commentary').innerText()));
await p.click('#tab-coverage');assert(/199 題中，185 題已收錄/.test(await p.locator('#panel-coverage').innerText()));
await p.keyboard.press('Tab');await noOverflow(390);
ok('失分清單、常見錯誤（9 類、附原文出處）、閱卷委員的話（科目與關鍵字篩選）、收錄範圍');

// 骨架回想
await p.goto(base+'/outline/index.html');
assert(/還沒做過 185 題/.test(await p.locator('.dark-panel').innerText()));
await p.click('.dark-panel .go');await p.waitForSelector('#outline-text');
assert(/112 年刑法與刑事訴訟法第 1 題/.test(await p.locator('.recall-card .page-eyebrow').innerText()),'漏點多的題先出');
assert(/^[0-3]:\d\d$/.test((await p.locator('.clock').innerText()).trim()));
await p.fill('#outline-text','一、強盜未遂\n二、強制猥褻');await p.click('.actions .primary');await p.waitForSelector('.op-items');
assert(/強盜未遂/.test(await p.locator('pre.mine').innerText()));
assert.equal(await p.evaluate(()=>document.querySelectorAll('.op-items > li')[1].querySelector('input[value=miss]').checked),true,'沿用先前勾選');
await p.evaluate(()=>document.querySelectorAll('.op-items > li')[2].querySelector('input[value=hit]').click());
c=await get(CK);assert.equal(c[ID].marks[2],'hit');await noOverflow(390);
await p.click('.actions.rate button:nth-child(2)');await p.waitForSelector('[role=status]');
let r=await get(RK);const today=await p.evaluate(()=>window.OfficialPoints.today());
assert.deepEqual([r[ID].lvl,r[ID].n,r[ID].last,r[ID].due],[0,1,today,await p.evaluate(t=>window.OfficialPoints.addDays(t,1),today)]);
await p.click('.actions .primary');await p.waitForSelector('#outline-text');
assert(!/112 年刑法與刑事訴訟法第 1 題/.test(await p.locator('.recall-card .page-eyebrow').innerText()),'接下一題');
await p.click('.actions .secondary');await p.waitForSelector('.dark-panel');
assert(/還沒做過 184 題・之後到期 1 題/.test(await p.locator('.dark-panel').innerText()));
ok('骨架回想：出題順序、計時、對照勾選、自評後排到隔天、接下一題');

// 複習頁弱點地圖
await p.goto(base+'/review/index.html');await p.waitForSelector('#priority-list li');
assert(/刑法與刑事訴訟法/.test(await p.locator('#priority-list').innerText()));
assert(/評分要點命中 67%/.test(await p.locator('#priority-list').innerText()));
assert(/民法與民事訴訟法/.test(await p.locator('#untouched').innerText()));await noOverflow(390);
ok('複習頁弱點地圖：有紀錄的科目排名並列出依據，沒紀錄的另列');

// 備份中心
await p.goto(base+'/backup/index.html');await p.waitForSelector('#modules');
const mods=await p.locator('#modules').innerText();assert(/評分要點逐點勾選/.test(mods)&&/爭點骨架回想排程/.test(mods));
ok('備份中心列出兩項新紀錄');

// 版面寬度
for(const w of [320,768,1440]){await p.setViewportSize({width:w,height:900});for(const u of ['/outline/index.html','/official/index.html','/review/index.html','/practice/index.html']){await p.goto(base+u);await p.waitForTimeout(150);await noOverflow(w+u);}}
await p.goto(base+'/outline/index.html');await p.click('.dark-panel .go');await p.waitForSelector('#outline-text');await p.click('.actions .primary');await p.waitForSelector('.op-items');await noOverflow('320 check');
ok('320／768／1440px 無橫向溢出');
assert.deepEqual(errs,[],'執行錯誤：'+errs.join(' | '));ok('沒有執行錯誤');
}finally{await b.close();srv.close();}
console.log(`ALL PASS (${n})`);})().catch(e=>{console.error(e);process.exit(1);});
