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
   await page.selectOption('#courseSubject','心理學');
   await page.fill('#courseName','心理學函授');
   await page.fill('#courseCount','2');
   await page.fill('#courseDuration','180');
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
   await page.fill('#customSubject','行政法');
   await page.fill('#courseName','行政法總複習');
   await page.fill('#courseCount','4');
   await page.fill('#courseDuration','120');
   await page.locator('#courseForm button[type=submit]').click();
   await page.selectOption('#strategy','weighted');
   await page.selectOption('#planDays','30');
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
   await page.locator('#nextMonth').click();
   assert(await page.locator('#calendarMonth').innerText());
   assert.deepEqual(errors,[],'browser console page errors');
   await context.close();
  }
  console.log('PASS mobile 390px/desktop 1280px: equal buttons, progress, custom subjects, weights, calendar and persisted plan');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
