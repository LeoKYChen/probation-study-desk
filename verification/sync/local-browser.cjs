'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.json':'application/json'})[path.extname(file)]||'text/plain');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const contexts=[],errors=[],external=[];
 async function device(){const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);await context.addInitScript(()=>{if(!location.origin.startsWith('http://127.0.0.1:'))return;localStorage.setItem('psd-sync-public-config-v1',JSON.stringify({url:'https://unused.supabase.co',key:'sb_publishable_unused'}));sessionStorage.setItem('psd-sync-session:unused.supabase.co',JSON.stringify({user:{id:'previous-user'},access_token:'do-not-use',refresh_token:'do-not-use',expires_at:9999999999}));});await context.route('**/*',async route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());await route.abort();}else await route.continue();});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base+'/study-desk/');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('本機書桌已開啟'));return {page,context};}
 async function saved(page,id){await page.waitForFunction(id=>!document.getElementById(id).disabled,id);}
 try{
 const a=await device(),p=a.page;
 assert.equal(await p.locator('#cloud-settings').count(),0,'no login or cloud configuration controls');
 assert.equal(await p.locator('#account').textContent(),'此裝置的本機書桌');
 await p.locator('#manual-picker').evaluate(el=>el.open=true);await p.locator('#subject').selectOption({label:'心理學'});await p.locator('#start-selected').click();await p.locator('#editor').waitFor({state:'visible'});
 await p.locator('#answer').fill('原始答案：我把信度與效度混淆。');await p.locator('#submit-answer').click();await saved(p,'submit-answer');await p.locator('#checked').click();await saved(p,'checked');
 await p.locator('#editor > details').first().evaluate(el=>el.open=true);await p.locator('#feedback-source').fill('人工核對');await p.locator('#feedback-text').fill('請區分測量一致性與效度證據。');await p.locator('#add-feedback').click();await saved(p,'add-feedback');
 await p.locator('#gap-category').selectOption('norm');await p.locator('#gap').fill('區分信度與效度');await p.locator('#correction').fill('一致性不等於解釋已有適當效度證據。');await p.locator('#correct').click();await saved(p,'correct');
 assert.match(await p.locator('#weakness-summary').textContent(),/法規／理論知識 1/);
 assert.match(await p.locator('#weakness-board').textContent(),/區分信度與效度/);
 assert.match(await p.locator('#weakness-trends').textContent(),/尚無跨不同題目/);
 assert.match(await p.locator('#recall-trends').textContent(),/尚無訂正後/);
 assert.match(await p.locator('#milestones').textContent(),/已訂正：✓/);
 const backupEvent=p.waitForEvent('download');await p.locator('#export-backup').click();const backup=await backupEvent;const bytes=await fs.readFile(await backup.path());const data=JSON.parse(bytes);assert.equal(Object.keys(data.state.outbox).length,0,'local edits do not accumulate cloud operations');assert(Object.values(data.state.records).some(r=>r.value.answer==='原始答案：我把信度與效度混淆。'));
 await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('本機書桌已開啟'));await p.locator('#notes button').first().click();await p.locator('#editor').waitFor({state:'visible'});
 await a.context.setOffline(true);await p.locator('#answer').fill('離線仍能接著寫');await p.locator('#save').click();await saved(p,'save');await p.reload();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('本機書桌已開啟'));await p.locator('#notes button').first().click();await p.waitForFunction(()=>document.querySelector('#answer').value==='離線仍能接著寫');assert.match(await p.locator('#save-status').textContent(),/已存此裝置/);assert.doesNotMatch(await p.locator('#save-status').textContent(),/待同步/);
 const mdEvent=p.waitForEvent('download');await p.locator('#export-note').click();const md=await fs.readFile(await (await mdEvent).path(),'utf8');assert.match(md,/原始答案/);assert.match(md,/效度證據/);
 const b=await device();assert.equal(await b.page.locator('#notes button').count(),0,'devices do not automatically share data');await b.page.locator('#import-backup').setInputFiles({name:'local-backup.json',mimeType:'application/json',buffer:bytes});await b.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已匯入書桌紀錄'));await b.page.locator('#notes button').first().click();await b.page.waitForFunction(()=>document.querySelector('#answer').value.includes('原始答案'));assert.match(await b.page.locator('#milestones').textContent(),/已訂正：✓/);

 // Real legacy lecture data feeds a user-confirmed topic mapping, without mutation.
 await a.context.setOffline(false);
 await p.evaluate(()=>{const core=globalThis.PSDLectureCore;let data=core.addCourse(core.empty(),'心理學','心理學函授',1,60,'psych-course');data=core.updateLesson(data,'psych-course_1',30,60,'測驗理論');localStorage.setItem(core.KEY,JSON.stringify(data));});
 await p.locator('#refresh-lectures').click();await saved(p,'refresh-lectures');
 await p.locator('#manual-picker').evaluate(el=>el.open=true);await p.locator('#subject').selectOption({label:'心理學'});
 await p.locator('#topic-lesson').selectOption('psych-course_1');await p.locator('#save-topic-lesson').click();await saved(p,'save-topic-lesson');assert.match(await p.locator('#topic-scope').textContent(),/尚未看完/);
 await p.locator('[data-subject="心理學"] .enabled').check();await p.locator('#planning-minutes').fill('10');await p.locator('#interval-again').fill('2');await p.locator('#interval-hint').fill('5');await p.locator('#interval-independent').fill('9');await p.locator('#save-preferences').click();await saved(p,'save-preferences');assert.match(await p.locator('#rating option[value="independent"]').textContent(),/9天/);assert.match(await p.locator('#recommendation').textContent(),/尚無符合已學/);
 await p.evaluate(()=>{const core=globalThis.PSDLectureCore;const raw=localStorage.getItem(core.KEY);const data=core.updateLesson(JSON.parse(raw),'psych-course_1',60,60,'測驗理論');localStorage.setItem(core.KEY,JSON.stringify(data));});
 await p.locator('#refresh-lectures').click();await saved(p,'refresh-lectures');assert.match(await p.locator('#topic-scope').textContent(),/已完成/);assert.match(await p.locator('#recommendation').textContent(),/心理學函授/);assert.match(await p.locator('#recommendation-audit').textContent(),/推薦規則：/);assert.match(await p.locator('#recommendation-audit').textContent(),/新題候選比較/);
 const lectureBefore=await p.evaluate(()=>localStorage.getItem(globalThis.PSDLectureCore.KEY));await p.locator('#start-recommended').click();await saved(p,'start-recommended');assert.equal(await p.locator('#mode').inputValue(),'short');assert.equal(await p.locator('#minutes').inputValue(),'10');assert.equal(await p.evaluate(()=>localStorage.getItem(globalThis.PSDLectureCore.KEY)),lectureBefore,'planning never changes lecture data');
 // Import preserves course mapping, custom intervals and portable progress snapshot.
 const newerEvent=p.waitForEvent('download');await p.locator('#export-backup').click();const newer=await fs.readFile(await(await newerEvent).path());await b.page.locator('#import-backup').setInputFiles({name:'newer.json',mimeType:'application/json',buffer:newer});await b.page.waitForFunction(()=>document.querySelector('#interval-independent').value==='9');assert.match(await b.page.locator('#lecture-status').textContent(),/備份中的函授快照/);
 const originalDue=JSON.parse(bytes).state.records;const old=Object.values(originalDue).find(r=>r.value.kind==='attempt').value.due;const newerData=JSON.parse(newer);assert.equal(Object.values(newerData.state.records).find(r=>r.value.answer==='離線仍能接著寫').value.due,old,'changing interval settings does not reschedule existing reviews');

 // Import a documented legacy session and resume the derived notebook entry.
 const oldRaw=await p.evaluate(()=>{const q=globalThis.QUESTION_BANK.find(q=>q.subject==='心理學');const value=JSON.stringify({version:1,sessions:{'2026-10-01':{essayDrafts:{[q.id]:{fullAnswer:'舊模組申論內容',outline:[],updatedAt:'2026-10-01T00:00:00Z'}},aiReviewTexts:{[q.id]:'舊模組評語'}}}});localStorage.setItem('probation-study30-v251:v1',value);return value;});
 await p.locator('#import-legacy').click();await saved(p,'import-legacy');await p.locator('#legacy-list').evaluate(el=>{el.parentElement.open=true;for(const d of el.querySelectorAll('details'))d.open=true;});
 await p.getByRole('button',{name:/整理為可接續筆記/}).click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('舊作答已整理'));
 const migrated=await p.evaluate(async()=>{const {IDBStore}=await import('../cloud-sync/idb.js');const s=await IDBStore.open('guest');try{return Object.entries((await s.read()).records).find(([,r])=>r.value.answer==='舊模組申論內容')[0];}finally{s.close();}});
 await p.locator('[data-attempt-id="'+migrated+'"] button').click();await p.waitForFunction(()=>document.querySelector('#answer').value==='舊模組申論內容');assert.match(await p.locator('#milestones').textContent(),/已作答：—/);assert.match(await p.locator('#feedback-list').textContent(),/舊模組評語/);assert.equal(await p.evaluate(()=>localStorage.getItem('probation-study30-v251:v1')),oldRaw);
 await p.locator('#import-legacy').click();await saved(p,'import-legacy');assert.equal(await p.getByRole('button',{name:/整理為可接續筆記/}).count(),0,'repeat import retains conversion receipt');
 assert.equal(await p.evaluate(()=>globalThis.QUESTION_BANK.length+globalThis.RELATED_QUESTION_BANK.length),426);
 for(const width of [320,375,393,600,1000]){
  await p.setViewportSize({width,height:900});
  const layout=await p.locator('.task-actions > button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,width:r.width,height:r.height,top:r.top,bottom:r.bottom,nowrap:s.whiteSpace,overflow:e.scrollWidth>e.clientWidth};}));
  assert.deepEqual(layout.map(x=>x.text),['開始任務','稍後處理']);
  assert.equal(layout[0].width,layout[1].width);assert.equal(layout[0].height,layout[1].height);assert.equal(layout[0].top,layout[1].top);assert.equal(layout[0].bottom,layout[1].bottom);
  assert(layout.every(x=>x.nowrap==='nowrap'&&!x.overflow),'task buttons stay on one line at '+width);
  const mobile=await p.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
    const rows=[...document.querySelectorAll('.subject-row>.check')];
    const spans=[...document.querySelectorAll('#import-legacy span')];
    return {
      lecture:rect('#refresh-lectures'),save:rect('#save-preferences'),backup:rect('.backup-actions'),
      rows:rows.map(el=>({text:el.textContent,nowrap:getComputedStyle(el).whiteSpace,overflow:el.scrollWidth>el.clientWidth})),
      importParts:spans.map(el=>({text:el.textContent,overflow:el.scrollWidth>el.clientWidth})),
      shortcutLinks:[...document.querySelectorAll('.study-shortcuts a')].map(el=>({href:el.getAttribute('href'),visible:el.getBoundingClientRect().width>0})),
      overflow:document.documentElement.scrollWidth>innerWidth
    };
  });
  assert.equal(mobile.overflow,false,'page must not horizontally overflow at '+width);
  assert(Math.abs(mobile.lecture.width-mobile.backup.width)<2,'lecture button matches backup row width at '+width);
  assert(Math.abs(mobile.lecture.left-mobile.backup.left)<2,'lecture button aligns with backup row at '+width);
  assert(Math.abs(mobile.save.right-mobile.backup.right)<2,'subject save button right-aligns with backup row at '+width);
  assert(Math.abs(mobile.save.left-mobile.backup.left)<2,'subject save button left-aligns with backup row at '+width);
  assert.deepEqual(mobile.shortcutLinks.map(x=>x.href),['../v2.5/','../daily-simulation/']);
  assert(mobile.shortcutLinks.every(x=>x.visible),'exam and daily shortcuts remain visible at '+width);
  assert.deepEqual(mobile.importParts.map(x=>x.text),['預覽並匯入','舊紀錄']);
  assert(mobile.importParts.every(x=>!x.overflow),'import label does not split characters at '+width);
  if(width<=600){
    assert(mobile.rows.every(x=>x.nowrap==='nowrap'&&!x.overflow),'subject names never wrap or overflow at '+width);
    assert(mobile.lecture.height>=88,'lecture button matches backup tile height at '+width);
  }

 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(external,[],'no external requests even with stale cloud configuration');assert.deepEqual(errors,[]);
 console.log('PASS local-only browser: no account/cloud requests; answer → feedback → correction; offline reload; no sync queue; JSON manual transfer; Markdown history; lecture-topic mapping/completion/portable snapshot; custom intervals/time budget; legacy notebook conversion/idempotency; 426 questions; mobile width.');
 }finally{for(const context of contexts)await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
