'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium',root=path.resolve(process.argv[2]||'.');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(name.startsWith('/probation-study-desk/'))name=name.slice('/probation-study-desk'.length);
 const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(b);});
});
(async()=>{
 if(!process.env.UNIFIED_TEST_URL)await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await playwright[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
 const bases=process.env.UNIFIED_TEST_URL?[process.env.UNIFIED_TEST_URL]:['http://127.0.0.1:'+server.address().port+'/','http://127.0.0.1:'+server.address().port+'/probation-study-desk/'];
 for(const base of bases){
  const ctx=await browser.newContext({locale:'zh-TW',timezoneId:'Asia/Taipei',viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(15000);
  await page.clock.install({time:new Date('2026-10-17T12:00:00+08:00')});
  await page.goto(new URL('professional/',base).href);await page.waitForFunction(()=>window.Study30App&&window.Study30LearningCharts);
  const diagnostics=page.locator('details.content-collapse').filter({has:page.locator('.v254-panel')});
  assert.equal(await diagnostics.getAttribute('open'),null);
  await diagnostics.locator(':scope > summary').click();
  assert.equal(await page.locator('#v254Radar .radar-dot').count(),0,'no data is not zero');
  assert.equal(await page.locator('#v254Radar .radar-value-item').count(),7);
  assert.equal(await page.locator('#v254Radar .radar-area').count(),0);
  assert.equal(await page.locator('.data-health-panel').evaluate(n=>n.closest('.backup-import-panel')!==null),true);
  assert.equal(await page.locator('#simSource').count(),0);
  assert.equal(await page.locator('#simCase').count(),0);
  assert((await page.locator('#simOutput').textContent()).includes('尚無已自評'));
  assert.equal(await page.locator('#mode10').innerText(),'10分鐘');
  assert.equal(await page.locator('.backup-import-panel').evaluate(n=>n.closest('.content-collapse').previousElementSibling.classList.contains('history')),true);
  // Seed canonical old fields, all rubric families, a real zero, and one missing subject.
  const seeded=await page.evaluate(()=>{
   const api=Study30App,{bank,today}=api.getEssayReviewData(),key='probation-study30-v251:v1';
   const stored=JSON.parse(localStorage.getItem(key)),session=stored.sessions[today];
   session.unknownField={preserve:true};session.essayAssessments={};
   const subjects=Study30V254Diagnostics.SUBJECTS;
   for(const subject of subjects.filter(s=>s!=='諮商與輔導')){
    const type=Study30Rubric.subjectType(subject),rule=Study30Rubric.RULES[type],id='manual:2026-10-17:'+subject;
    const scores=Object.fromEntries(rule.criteria.map((c,i)=>[c.id,subject==='刑法'?0:subject==='心理學'?(i===0?0:4):2]));
    session.essayAssessments[id]={version:1,rubric:type,subject,scores,issues:[],nextStep:''};
   }
   stored.sessions['2026-10-16']={...structuredClone(session),date:'2026-10-16',questionId:bank.find(q=>q.subject==='心理學').id,rating:'review',essayAssessments:{},notes:[]};
   stored.sessions['2026-09-30']={...structuredClone(session),date:'2026-09-30',finished:true,notes:['九月已存速記'],essayDrafts:{past:{template:'law',outline:['九月已存爭點','','',''],fullAnswer:'九月完整答案'}},essayAssessments:{}};
   localStorage.setItem(key,JSON.stringify(stored));localStorage.setItem('other-module-sentinel','不更動');
   return localStorage.getItem(key);
  });
  await page.reload();await page.waitForFunction(()=>window.Study30App);
  const raw=()=>page.evaluate(()=>localStorage.getItem('probation-study30-v251:v1'));
  assert.equal(await raw(),seeded);
  await diagnostics.locator(':scope > summary').click();
  assert.equal(await page.locator('#v254Radar .radar-dot').count(),6);
  assert.equal(await page.locator('#v254Radar .radar-area').count(),0,'missing subject must not close a polygon');
  await page.locator('#v254Radar button').filter({hasText:'心理學'}).click();
  assert((await page.locator('#v254DetailHeading').innerText()).startsWith('心理學'));
  assert.equal(await page.locator('#v254AbilityRadar .radar-value-item').count(),5);
  assert.equal(await page.locator('#v254AbilityRadar .radar-value-item strong').first().innerText(),'0%');
  assert.equal(await page.locator('#v254AbilityRadar .radar-value-item strong').nth(1).innerText(),'100%');
  assert.equal(await page.locator('#v254Radar button').filter({hasText:'心理學'}).locator('strong').innerText(),'80%','use existing weighted score');
  const counseling=page.locator('#v254Radar [role=button]').filter({hasText:'諮商與輔導'});await counseling.focus();await counseling.press('Enter');
  assert.equal(await page.locator('#v254AbilityRadar .radar-dot').count(),0);
  assert.equal(await page.locator('#v254DetailHeading').innerText(),'諮商與輔導｜申論能力指標');
  await page.locator('#v254Subject').selectOption('刑法');
  assert.equal(await page.locator('#v254AbilityRadar .radar-dot').count(),4,'genuine zero is valid data');
  assert.equal(await page.locator('#v254AbilityRadar .radar-value-item strong').first().innerText(),'0%');
  await page.locator('#v254Days').selectOption('7');await page.locator('#v254Subject').selectOption('all');
  const analytics=page.locator('details.content-collapse').filter({has:page.locator('.essay-analytics-panel')});await analytics.locator(':scope > summary').click();
  await page.locator('#essayAnalyticsSubject').selectOption('犯罪學');
  assert.equal(await page.locator('#essayAbilityRadar .radar-value-item').count(),5);
  assert.equal(await page.locator('#essayAbilityRadar .radar-value-item strong').first().innerText(),'50%');
  assert.equal(await raw(),seeded,'charts and filters do not write storage');
  await page.locator('#reviewSimulator').evaluate(n=>n.open=true);
  await page.locator('#simDays').selectOption('1');await page.locator('#simPreview').click();
  assert((await page.locator('#simOutput').innerText()).includes('心理學'));
  assert(!(await page.locator('#reviewSimulator').innerText()).includes('範例資料'));
  await page.locator('#simRerate').selectOption('mastered');await page.locator('#simRetry').click();
  assert((await page.locator('#simNext').innerText()).includes('2026-10-25'));
  assert.equal(await raw(),seeded,'forecast and hypothetical rerating are read-only');
  const accents=await page.evaluate(()=>['.essay-review-panel','.content-collapse:has(.essay-analytics-panel)','.weakness-priority-panel','.content-collapse:has(.v254-panel)'].map(s=>getComputedStyle(document.querySelector(s)).borderLeftColor));
  assert.equal(new Set(accents).size,4,'ability sections have distinct accents');
  const axisColors=await page.locator('#v254Radar .radar-label').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill));
  assert.equal(new Set(axisColors).size,7,'subject axes have distinct colors');
  await page.locator('#showMonthProgress').click();
  assert.equal(await page.locator('#progressMonthGrid button').count(),31);
  assert.equal(await page.locator('#progressMonthGrid button:disabled').count(),14);
  assert.equal(await page.locator('#nextProgressMonth').isDisabled(),true);
  await page.locator('#progressMonthGrid [data-date="2026-10-01"]').click();
  assert((await page.locator('#progressMonthRecord').innerText()).includes('當天尚無練習紀錄'));
  assert.equal(await raw(),seeded,'empty date does not create a backdated session');
  await page.locator('#previousProgressMonth').click();
  assert.equal(await page.locator('#progressMonthGrid button').count(),30);
  await page.locator('#progressMonthGrid [data-date="2026-09-30"]').click();
  assert((await page.locator('#progressMonthRecord').innerText()).includes('九月已存速記'));
  await page.locator('#progressMonthRecord summary').click();
  assert((await page.locator('#progressMonthRecord').innerText()).includes('九月已存爭點'));
  assert((await page.locator('#progressMonthRecord').innerText()).includes('九月完整答案'));
  await page.locator('#nextProgressMonth').click();await page.locator('#showWeekProgress').click();
  assert.equal(await page.locator('#historyContent button').count(),7);assert.equal(await raw(),seeded);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});await page.locator('#showMonthProgress').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'professional overflow '+width);
   await page.locator('#essayEditor').evaluate(n=>n.open=true);
   const selectBox=await page.locator('#essayTemplate').boundingBox(),labelBox=await page.locator('.essay-template-label').boundingBox();
   assert(Math.abs(selectBox.width-labelBox.width)<2,'template select fills writing width '+width);
   if(width===1440)assert.equal(await page.locator('#reviewScheduleHint').evaluate(n=>n.scrollWidth>n.clientWidth),false,'single-line schedule hint fits');
  }
  if(process.env.LAYOUT_SCREENSHOT_DIR){fs.mkdirSync(process.env.LAYOUT_SCREENSHOT_DIR,{recursive:true});await page.locator('#v254Subject').selectOption('心理學');await diagnostics.screenshot({path:path.join(process.env.LAYOUT_SCREENSHOT_DIR,engine+'-diagnostics.png')});await page.locator('#showMonthProgress').click();await page.locator('.history').screenshot({path:path.join(process.env.LAYOUT_SCREENSHOT_DIR,engine+'-month.png')});}
  // Compose, switch topic, switch back, reload: existing drafts and versions survive the new layout.
  await page.goto(new URL('common-subjects/',base).href);
  await page.locator('#essayText').fill('保留我的作文原稿與版本。');await page.locator('#saveVersion').click();
  const commonKey='psd-common-subjects-v1';const common=await page.evaluate(key=>localStorage.getItem(key),commonKey);
  const original=await page.locator('#prompt').inputValue();await page.locator('#prompt').selectOption('1');await page.locator('#prompt').selectOption(original);
  assert.equal(await page.locator('#essayText').inputValue(),'保留我的作文原稿與版本。');
  await page.reload();assert.equal(await page.locator('#essayText').inputValue(),'保留我的作文原稿與版本。');
  const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),commonKey);
  assert.equal(state.drafts['sentence:0'].versions[0].text,'保留我的作文原稿與版本。');
  assert.equal(await page.locator('.hero-note').count(),0);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'common overflow '+width);
   const panel=await page.locator('.essay-question').boundingBox();
   for(const id of ['clock','timerToggle','timerReset']){
    const box=await page.locator('#'+id).boundingBox();assert(box.x>=panel.x&&box.x+box.width<=panel.x+panel.width+1,'timer stays inside '+id+' '+width);
   }
   if(width===1440){const controls=await page.locator('.essay-controls').boundingBox(),question=await page.locator('.essay-question').boundingBox(),editor=await page.locator('#essayText').boundingBox();assert(controls.x+controls.width<question.x);assert(editor.y>question.y+question.height);}
  }
  await page.locator('#tabRecords').click();
  assert.equal(await page.locator('#tabRecords').innerText(),'學習紀錄');
  await page.setViewportSize({width:1440,height:1000});
  const statBoxes=await page.locator('#panelRecords>.stats>.stat:visible').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right})));
  assert.equal(statBoxes.length,2);assert(Math.abs(statBoxes[0].width-statBoxes[1].width)<1);
  const stats=await page.locator('#panelRecords>.stats').boundingBox();assert(Math.abs(statBoxes[1].right-(stats.x+stats.width))<1,'stats fill the row');
  await page.locator('#tabEssay').click();
  assert.equal(await raw(),seeded);assert.equal(await page.evaluate(()=>localStorage.getItem('other-module-sentinel')),'不更動');assert.deepEqual(errors,[]);
  if(process.env.LAYOUT_SCREENSHOT_DIR){fs.mkdirSync(process.env.LAYOUT_SCREENSHOT_DIR,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(process.env.LAYOUT_SCREENSHOT_DIR,engine+'-essay.png'),fullPage:true});}
  await page.goto(new URL('common-subjects/english-assistant/',base).href);
  await page.locator('#tasks .card').first().waitFor();
  assert.equal(await page.locator('#englishLearningRecords #history').count(),1);
  assert.equal(await page.locator('#englishLearningRecords .usage-notes').count(),1);
  assert(!(await page.locator('body').innerText()).includes('不要使用隨機10題'));
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'English assistant overflow '+width);
   for(const row of await page.locator('#tasks .card>.buttons').all()){
    const boxes=await row.locator('.btn').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
    assert.equal(boxes.length,3);
    for(const b of boxes){assert(Math.abs(b.width-boxes[0].width)<2,'equal action width '+width);assert(Math.abs(b.height-boxes[0].height)<2,'equal action height '+width);}
   }
  }
  await page.locator('#tasks .card').first().getByRole('button',{name:'我已完成',exact:true}).click();
  await page.reload();assert((await page.locator('#tasks .card').first().innerText()).includes('已記錄完成'));
  assert.equal(await raw(),seeded);assert.equal(await page.evaluate(()=>localStorage.getItem('other-module-sentinel')),'不更動');assert.deepEqual(errors,[]);
  await ctx.close();console.log('PASS layout review:',engine,base,'7-subject drilldown, missing vs zero, rubric math, read-only month history, old drafts/versions, real-record forecast, equal cards/actions, ability colors, mobile layout');
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
