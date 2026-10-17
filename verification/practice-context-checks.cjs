'use strict';
const assert=require('node:assert/strict');
module.exports=async function(browser,base){
 const ctx=await browser.newContext({locale:'zh-TW',timezoneId:'Asia/Taipei',viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.clock.install({time:new Date('2026-10-17T12:00:00+08:00')});
  await page.goto(new URL('professional/',base).href);await page.waitForFunction(()=>window.Study30App&&window.Study30BackupImport);
  const read=()=>page.evaluate(()=>{const {today,sessions}=Study30App.getEssayReviewData();return sessions[today];});
  await page.locator('.daily-quick-notes>summary').click();
  await page.locator('#answer').fill('保留每日速記');
  await page.locator('#essayField0').fill('保留四格草稿');
  await page.locator('#essayFullAnswer').fill('保留完整答案');
  await page.locator('[data-rating=partial]').click();await page.locator('#errorCause').selectOption('案例涵攝');
  await page.locator('#toggleTimer').click();await page.clock.runFor(13000);
  await page.locator('#mode10').click();let row=await read();
  assert.equal(row.mode,'10');assert.equal(row.elapsed,13);assert.equal(row.remaining,107);assert.equal(row.phase,0);
  assert.equal(await page.locator('#toggleTimer').innerText(),'開始／繼續');
  await page.locator('#mode30').click();row=await read();assert.equal(row.remaining,287);assert.equal(row.elapsed,13);
  await page.locator('#nextPhase').click();await page.locator('#toggleTimer').click();await page.clock.runFor(7000);
  await page.locator('#mode10').click();row=await read();assert.equal(row.phase,1);assert.equal(row.elapsed,20);assert.equal(row.remaining,293);
  await page.locator('#mode30').click();assert.equal((await read()).remaining,893);
  assert.equal((await read()).notes[0],'保留每日速記');assert.equal(await page.locator('#essayField0').inputValue(),'保留四格草稿');assert.equal(await page.locator('#essayFullAnswer').inputValue(),'保留完整答案');
  const daily=await read();
  await page.locator('#essayPracticeSubject').selectOption('心理學');
  assert.equal(await page.locator('#practiceSelfCheck').isVisible(),true);
  await page.locator('[data-practice-rating=review]').click();await page.locator('#practiceErrorCause').selectOption('概念不熟');
  const psychId=await page.evaluate(()=>Study30App.essayContext().questionId);
  await page.locator('#essayPracticeSubject').selectOption('刑法');await page.locator('[data-practice-rating=mastered]').click();
  await page.reload();await page.waitForFunction(()=>window.Study30App);
  assert.equal(await page.locator('[data-practice-rating=mastered]').getAttribute('aria-pressed'),'true');
  await page.locator('#essayPracticeSubject').selectOption('心理學');
  assert.equal(await page.locator('[data-practice-rating=review]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#practiceErrorCause').inputValue(),'概念不熟');
  row=await read();for(const key of ['questionId','rating','errorCause','notes','elapsed','phase','essayDrafts'])assert.deepEqual(row[key],daily[key],'daily preserved '+key);
  const analysis=await page.evaluate(()=>{
   const {sessions,bank,today}=Study30App.getEssayReviewData(),review=Study30Review.model(sessions,bank,today);
   const diag=Study30V254Diagnostics.analyze(sessions,bank,[],review.all,today,'all');
   const raw=JSON.stringify({version:1,sessions});
   return {review,diag,backup:JSON.stringify(Study30BackupImport.parse(raw))===raw};
  });
  assert.equal(analysis.review.all.find(x=>x.id===psychId).subject,'心理學');assert.equal(analysis.review.all.find(x=>x.id===psychId).cause,'概念不熟');
  assert.equal(analysis.diag.subjects.find(x=>x.subject==='心理學').needsWork,1);
  assert.equal(analysis.diag.subjects.find(x=>x.subject==='刑法').mastered,1);
  // safeStore normalizes optional fields; the new per-question map must survive exactly.
  assert.equal(await page.evaluate(()=>{const {sessions,today}=Study30App.getEssayReviewData();return JSON.stringify(Study30BackupImport.parse(JSON.stringify({version:1,sessions})).sessions[today].practiceRatings)===JSON.stringify(sessions[today].practiceRatings);}),true);
  // A daily and independent rating of the same single-subject question count once/day.
  assert.equal(await page.evaluate(()=>{const {bank,today}=Study30App.getEssayReviewData(),q=bank.find(x=>x.subject==='心理學');return Study30Review.model({[today]:{questionId:q.id,rating:'partial',practiceRatings:{one:{questionId:q.id,subject:'心理學',rating:'mastered'}}}},bank,today).all[0].attempts;}),1);
  assert.equal(await page.evaluate(()=>{const {bank,today}=Study30App.getEssayReviewData(),q=bank.find(x=>x.subject==='心理學');return Study30Review.model({[today]:{practiceRatings:{bad:{questionId:q.id,subject:'刑法',rating:'mastered'}}}},bank,today).all.length;}),0);
  for(const panel of ['.essay-analytics-panel','.v254-panel']){
   const summary=page.locator('details.content-collapse').filter({has:page.locator(panel)}).locator(':scope>summary');
   const en=await summary.locator('.eyebrow').boundingBox(),zh=await summary.locator('.collapse-title').boundingBox();
   assert(en&&zh&&en.y+en.height<=zh.y,'English is above Chinese '+panel);
  }
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'practice UI overflow '+width);}
  await page.locator('#essayPracticeSubject').selectOption('today');assert.equal(await page.locator('#practiceSelfCheck').isVisible(),false);
  assert.equal(await page.evaluate(()=>{
   const {bank,today}=Study30App.getEssayReviewData(),q=bank.find(x=>x.subject==='心理學');
   const make=(dailyTime,freeTime)=>Study30Review.model({[today]:{questionId:q.id,rating:'mastered',ratingUpdatedAt:dailyTime,practiceRatings:{one:{questionId:q.id,subject:'心理學',rating:'review',updatedAt:freeTime}}}},bank,today).all[0];
   return make('2026-10-17T10:00:00Z','2026-10-17T09:00:00Z').rating==='mastered'&&make('2026-10-17T09:00:00Z','2026-10-17T10:00:00Z').rating==='review';
  }),true,'same-day daily/free edits use the latest explicit self-rating timestamp');
  // Shrinking an already-used phase clamps at zero without losing time when enlarged.
  await page.evaluate(()=>{const key='probation-study30-v251:v1',data=JSON.parse(localStorage.getItem(key)),s=data.sessions['2026-10-17'];s.phase=0;s.mode='30';s.remaining=100;s.elapsed=200;delete s.phaseTimeUsed;localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();await page.waitForFunction(()=>window.Study30App);
  await page.locator('#mode10').click();assert.equal((await read()).remaining,0);assert.equal((await read()).elapsed,200);
  await page.locator('#mode30').click();assert.equal((await read()).remaining,100);assert.equal((await read()).elapsed,200);
  // A combined-bank subject is attributed only to the explicitly practised component.
  assert.equal(await page.evaluate(()=>{
   const {bank,today}=Study30App.getEssayReviewData(),q=bank.find(x=>Study30Review.canonicalSubject(x)==='刑事訴訟法與保安處分執行法');
   const sessions={'2026-10-16':{questionId:q.id,rating:'review'},[today]:{practiceRatings:{one:{questionId:q.id,subject:'保安處分執行法',rating:'partial',errorCause:'案例涵攝'}}}};
   const review=Study30Review.model(sessions,bank,today),diag=Study30V254Diagnostics.analyze(sessions,bank,[],review.all,today,'all');
   return review.all.length===1&&review.all[0].subject==='保安處分執行法'&&review.all[0].attempts===2&&diag.subjects.find(x=>x.subject==='刑事訴訟法').needsWork===0&&diag.subjects.find(x=>x.subject==='保安處分執行法').needsWork===1;
  }),true);
  // Sunday budgets and completed sessions must not reopen or erase records.
  const sunday=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('probation-study30-v251:v1'));data.sessions['2026-10-18']={...data.sessions['2026-10-17'],date:'2026-10-18',phase:1,mode:'30',remaining:580,elapsed:42,phaseTimeUsed:20};return data;});
  // Unload the Saturday app before changing the clock; its rollover interval must
  // not overwrite an external test seed from an older in-memory session store.
  await page.goto('about:blank');await page.clock.setFixedTime(new Date('2026-10-18T12:00:00+08:00'));
  await page.addInitScript(data=>localStorage.setItem('probation-study30-v251:v1',JSON.stringify(data)),sunday);
  await page.goto(new URL('professional/',base).href);await page.waitForFunction(()=>window.Study30App);
  await page.locator('#mode10').click();assert.equal((await read()).remaining,220);assert.equal((await read()).elapsed,42);
  await page.locator('#nextPhase').click();await page.locator('#mode30').click();assert.equal((await read()).finished,true);assert.equal((await read()).remaining,0);assert.equal((await read()).elapsed,42);
  assert.deepEqual(errors,[]);console.log('PASS practice context: timer switches preserve elapsed/drafts; subject ratings, causes, review/diagnostic attribution, backup retention, headings, Sunday/completion');
 }finally{await ctx.close();}
};
