'use strict';
// 瀏覽器驗收：六項 UI 修改，使用合成資料，不接觸使用者 localStorage。
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
  const p=path.resolve(root,'.'+pathname);
  if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);res.end();return;}
  try{const target=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));}
  catch{res.writeHead(404);res.end('not found');}
});
const sample={
  schema:1,settings:{weekdayMinutes:60,weekendMinutes:240,reserveMinutes:30,examDate:'2027-08-13',reviewDays:14,strategy:'weighted',planDays:30,maxSubjectsPerDay:2,
    subjectRules:{'心理學':{enabled:true,weight:4},'犯罪學':{enabled:true,weight:2}},fixedDays:['','','','','','','']},
  courses:[{id:'course_a',name:'心理學',subject:'心理學'},{id:'course_b',name:'犯罪學',subject:'犯罪學'}],
  lessons:[{id:'course_a_1',courseId:'course_a',title:'第1堂',durationMinutes:180,watchedMinutes:0},{id:'course_b_1',courseId:'course_b',title:'第1堂',durationMinutes:120,watchedMinutes:20}],plan:null
};
const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const [engine,browserType] of [['Chromium',chromium],['WebKit',webkit]]){
      const browser=await browserType.launch({headless:true});
      try{
        for(const width of [320,375,390,430,768,1280]){
          const context=await browser.newContext({viewport:{width,height:850},hasTouch:true});
          await context.addInitScript((data)=>localStorage.setItem('psd-lecture-planner-v1',JSON.stringify(data)),sample);
          const page=await context.newPage(),errors=[];
          page.on('pageerror',e=>errors.push(e.message));
          await page.goto(base+'/');
          const home=await page.evaluate(()=>{
            const cards=[...document.querySelectorAll('.course-grid>.course-tile')];
            return {count:cards.length,explore:document.querySelectorAll('.explore-grid>.explore-tile').length,labels:cards.map(c=>c.querySelector('.tile-title').textContent),hrefs:cards.map(c=>c.getAttribute('href')),arrow:cards.map(c=>c.querySelector('.tile-arrow').textContent),rects:cards.map(c=>({w:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height})),backgrounds:cards.map(c=>getComputedStyle(c).backgroundImage),ink:cards.map(c=>getComputedStyle(c).color),overflow:document.documentElement.scrollWidth-innerWidth};
          });
          assert.equal(home.count,3,engine+' '+width+' course cards');
          assert.equal(home.explore,3,engine+' '+width+' exploration cards');
          assert.deepEqual(home.hrefs,['./professional/','./common-subjects/','./lectures/']);
          assert.deepEqual(home.arrow,['↗','↗','↗']);
          assert(home.labels.every(x=>!x.includes('🎬')));
          assert(home.rects.every(r=>near(r.w,home.rects[0].w)&&near(r.h,home.rects[0].h)),engine+' '+width+' card equality '+JSON.stringify(home.rects));
          assert(home.backgrounds.every(x=>x===home.backgrounds[0])&&home.ink.every(x=>x===home.ink[0]));
          assert(home.overflow<=1,engine+' '+width+' homepage overflow '+home.overflow);
          await page.goto(base+'/lectures/');
          await page.locator('.course').first().locator('summary').click();
          const layout=await page.evaluate(()=>{
            const root=document.querySelector('.lesson-edit'),labels=[...root.querySelectorAll(':scope > label')],inputs=labels.map(l=>l.querySelector('input')),btns=[...root.querySelectorAll('.lesson-actions button')],date=document.querySelector('#examDate'),card=date.closest('.card'),box=document.querySelector('.subject-rule .include input[type=checkbox]'),line=document.querySelector('.subject-rule'),footer=document.querySelector('footer');
            const coords=(el)=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
            const cb=getComputedStyle(box);
            return {labels:labels.map(coords),inputs:inputs.map(coords),btns:btns.map(coords),date:coords(date),card:coords(card),rule:coords(line),checkbox:coords(box),cbMinHeight:cb.minHeight,footer:footer.innerText,overflow:document.documentElement.scrollWidth-innerWidth};
          });
          assert.equal(layout.labels.length,3);
          assert(layout.labels.every(l=>near(l.width,layout.labels[0].width)),engine+' '+width+' three label widths: '+JSON.stringify(layout.labels));
          assert(layout.inputs.every(i=>near(i.width,layout.inputs[0].width)&&near(i.height,layout.inputs[0].height)));
          assert(layout.btns.length===2&&near(layout.btns[0].width,layout.btns[1].width)&&near(layout.btns[0].y,layout.btns[1].y));
          assert(layout.date.right<=layout.card.right-5,engine+' '+width+' date overflow '+JSON.stringify(layout.date));
          assert(layout.checkbox.width<=22&&layout.checkbox.height<=22,engine+' '+width+' checkbox unexpectedly large '+JSON.stringify(layout.checkbox));
          assert.equal(layout.overflow<=1,true,engine+' '+width+' lecture overflow '+layout.overflow);
          assert(layout.footer.includes('備份')&&layout.footer.includes('自行設定'));
          assert.equal(await page.locator('.subject-rule .weight').first().isVisible(),true);
          await page.selectOption('#strategy','rotate');
          assert.equal(await page.locator('.subject-rule .weight').first().isVisible(),false);
          await page.selectOption('#strategy','weighted');
          assert.equal(await page.locator('.subject-rule .weight').first().isVisible(),true);
          const before=await page.locator('.subject-rule .weight select').first().inputValue();
          await page.locator('#settingsForm button[type=submit]').click();
          await page.reload();
          assert.equal(await page.locator('#examDate').inputValue(),'2027-08-13');
          assert.equal(await page.locator('.subject-rule .weight select').first().inputValue(),before);
          assert.equal(await page.locator('.subject-rule .include input').first().isChecked(),true);
          assert.deepEqual(errors,[],engine+' '+width+' JS errors');
          await context.close();
        }
      }finally{await browser.close();}
    }
    console.log('PASS 6 UI fixes: Chromium/WebKit at 320,375,390,430,768,1280px, preserved schedule and settings');
  }finally{server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
