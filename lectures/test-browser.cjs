'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const contentType={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
    const stat=fs.statSync(file);
    const target=stat.isDirectory()?path.join(file,'index.html'):file;
    res.setHeader('Content-Type',contentType[path.extname(target)]||'application/octet-stream');
    res.end(fs.readFileSync(target));
  }catch{res.writeHead(404);res.end('not found');}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900}});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/lectures/');
   assert.equal(await page.locator('#customSubjectWrap').isVisible(),false,'custom subject must start hidden');
   assert.equal(await page.locator('#fixedDaysArea').isVisible(),false,'fixed-day controls must start hidden');
   assert.equal(await page.locator('#subjectLimitWrap').isVisible(),false,'weighted controls must start hidden');
   await page.selectOption('#courseSubject','心理學');
   await page.fill('#courseName','心理學函授');
   await page.fill('#courseCount','2');
   await page.fill('#courseDuration','180');
   if(width<=700){
    for(const [formId,fieldId] of [['#courseForm','#courseName'],['#settingsForm','#weekdayMinutes']]){
     const button=await page.locator(formId+' button[type=submit]').boundingBox();
     const field=await page.locator(fieldId).boundingBox();
     assert(button&&field&&Math.abs(button.x-field.x)<=1&&Math.abs(button.width-field.width)<=1&&button.height>=50,
      'mobile form submit must align with input '+formId);
    }
   }
   await page.locator('#courseForm button[type=submit]').click();
   assert.match(await page.locator('#lessonStat').innerText(),/0／2/);
   const actions=page.locator('.lesson-actions').first();
   const a=await actions.locator('button').nth(0).boundingBox();
   const b=await actions.locator('button').nth(1).boundingBox();
   assert(a&&b,'action buttons must be visible');
   assert(Math.abs(a.width-b.width)<1,'buttons must be same width at '+width);
   assert(Math.abs(a.y-b.y)<1,'buttons must line up at '+width);
   assert(a.x>=0&&b.x+b.width<=width+1,'buttons must not overflow at '+width);
   await actions.locator('button').nth(1).click();
   assert.match(await page.locator('#lessonStat').innerText(),/1／2/);
   await page.selectOption('#courseSubject','__custom__');
   assert.equal(await page.locator('#customSubjectWrap').isVisible(),true);
   await page.fill('#customSubject','行政法');
   await page.fill('#courseName','行政法總複習');
   await page.fill('#courseCount','4');
   await page.fill('#courseDuration','120');
   await page.locator('#courseForm button[type=submit]').click();
   await page.selectOption('#strategy','weighted');
   assert.equal(await page.locator('#subjectLimitWrap').isVisible(),true);
   assert.equal(await page.locator('#fixedDaysArea').isVisible(),false);
   await page.fill('#planDays','400');
   await page.selectOption('#maxSubjectsPerDay','2');
   const rule=page.locator('.subject-rule').filter({hasText:'行政法'});
   await rule.locator('.weight select').selectOption('5');
   await page.locator('#settingsForm button[type=submit]').click();
   await page.locator('#previewButton').click();
   assert.match(await page.locator('#planSummary').innerText(),/預覽/);
   const days=await page.locator('.calendar-cell').count();
   assert(days>=28&&days<=31);
   await page.locator('.calendar-cell.has-plan').first().click();
   assert.match(await page.locator('#calendarDetails').innerText(),/預排/);
   await page.locator('#confirmButton').click();
   await page.reload();
   assert.match(await page.locator('#planSummary').innerText(),/已儲存計畫/);
   assert.match(await page.locator('#lessonStat').innerText(),/1／6/);
   assert.equal(await page.locator('#strategy').inputValue(),'weighted');
   assert.equal(await page.locator('#courseList .course').count(),2);
   
   assert.equal(await page.locator('#planDays').inputValue(),'400');
   await page.locator('.calendar-cell.has-plan').first().click();
   const card=page.locator('#calendarDetails .learning-task').first();
   await card.locator('.task-editor summary').click();
   const edit=card.locator('.activity-form');
   await edit.locator('select[aria-label="完成狀態"]').selectOption('inprogress');
   await edit.locator('input[aria-label="已完成進度（分鐘）"]').fill('1');
   await edit.locator('input[aria-label="實際學習分鐘"]').fill('2');
   await edit.locator('textarea').fill('課後疑問：信度與效度');
   await edit.locator('input[type=checkbox]').check();
   await edit.locator('button[type=submit]').click();
   assert.equal(await page.locator('#message').getAttribute('data-error'),'0');
   assert.match(await page.locator('#calendarDetails').innerText(),/進行中/);
   assert.match(await page.locator('#calendarDetails').innerText(),/課後疑問/);
   const future=await page.evaluate(()=>window.PSDLectureCore.datePlus(window.PSDLectureCore.todayTaipei(),500));
   const add=page.locator('#calendarDetails > .task-editor .activity-form');
   await add.locator('input[aria-label="日期"]').fill(future);
   await add.locator('input[aria-label="學習內容"]').fill('自主閱讀筆記');
   await add.locator('input[aria-label="預計分鐘"]').fill('10');
   await add.locator('button[type=submit]').click();
   assert.equal(await page.locator('#message').getAttribute('data-error'),'0');
   await page.locator('#calendarDetails .learning-task').filter({hasText:'自主閱讀筆記'}).getByRole('button',{name:'完成本項'}).click();
   assert.match(await page.locator('#calendarDetails').innerText(),/已完成/);
   const watched=await page.evaluate(()=>JSON.parse(localStorage.getItem('psd-lecture-planner-v1')).lessons.reduce((n,l)=>n+l.watchedMinutes,0));
   await page.reload();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('psd-lecture-planner-v1')).activities.length),2);
   await page.locator('#previewButton').click();
   await page.locator('#confirmButton').click();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('psd-lecture-planner-v1')).activities.length),2);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('psd-lecture-planner-v1')).lessons.reduce((n,l)=>n+l.watchedMinutes,0)),watched);
   const end=await page.evaluate(()=>window.PSDLectureCore.datePlus(window.PSDLectureCore.todayTaipei(),729));
   await page.fill('#planEndDate',end);
   assert.equal(await page.locator('#planDays').inputValue(),'730');
   await page.locator('#previewButton').click();
   await page.locator('#confirmButton').click();
   assert.equal(await page.locator('#planDays').inputValue(),'730');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   await page.locator('#nextMonth').click();
   assert(await page.locator('#calendarMonth').innerText());
   assert.deepEqual(errors,[],'browser console page errors');
   await context.close();
  }
  console.log('PASS mobile 390px/desktop 1280px: equal buttons, progress, custom subjects, weights, calendar and persisted plan');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
