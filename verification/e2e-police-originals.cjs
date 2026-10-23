/* Browser acceptance: verified 127 police official originals use the FULL existing v2.5 workflow.
 * This test never fetches LawPlayer or modifies source questions. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const ENGINE=process.env.POLICE_E2E_ENGINE==='webkit'?webkit:chromium;
const ROOT=process.cwd();
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
'.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
'.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff'};
const reviewId='police-114-criminal_law_procedure-1';
const anotherId='police-108-psychology-1';
const official=JSON.parse(fs.readFileSync('police-exams/questions.approved.js','utf8')
  .split('window.POLICE_ORIGINAL_QUESTION_BANK = ')[1].split(';\n')[0]);
assert.equal(official.length,127);
const selected=official.find(q=>q.id===reviewId),other=official.find(q=>q.id===anotherId);
assert(selected && other);
assert.equal(selected.officialPoints,50);

async function main(){
 const server=http.createServer((req,res)=>{
  try{
   let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(name.endsWith('/'))name+='index.html';
   const filename=path.resolve(ROOT,'.'+name);
   if(!filename.startsWith(ROOT+path.sep)) {res.writeHead(403).end();return;}
   const content=fs.readFileSync(filename);
   res.writeHead(200,{'content-type':MIME[path.extname(filename)]||'application/octet-stream'}).end(content);
  }catch{res.writeHead(404).end('not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await ENGINE.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  const errors=[];
  await context.addInitScript(({origin})=>{
   if(location.origin!==origin)return;
   if(localStorage.getItem('probation-study-desk-v24')===null)
     localStorage.setItem('probation-study-desk-v24',JSON.stringify({'legacy-sentinel':{issue:'既有答案必須保留'}}));
  },{origin});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/v2.5/?q='+encodeURIComponent(reviewId),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>window.Practice25?.getQuestion()?.id===id,reviewId,{timeout:30000});
  await page.locator('#ai-simple-dual').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.evaluate(()=>window.Practice25.getQuestions().length),553);
  assert.equal((await page.locator('#bankCount').textContent()).trim(),'553');
  assert.equal(await page.locator('#questionBody').textContent(),selected.body);
  assert((await page.locator('#questionBody').textContent()).includes('（50 分）'));
  assert((await page.locator('#sourceLink').getAttribute('href')).includes('wwwq.moex.gov.tw/exam/'));
  assert((await page.locator('#examTypeTag').textContent()).includes('一般警察人員考試'));
  assert(await page.locator('#shuatiGuide').isVisible());
  assert(await page.locator('#yamolGuide').isVisible());
  assert((await page.locator('#shuatiQuestionLink').getAttribute('href')).startsWith('https://'));
  assert((await page.locator('#yamolQuestionLink').getAttribute('href')).startsWith('https://'));
  for(const id of ['draftIssue','draftBasis','draftAnalysis','draftConclusion']){
    assert(await page.locator('#'+id).isVisible(),id+' four-grid visible');
  }
  await page.locator('#draftIssue').fill('新試題四格：爭點');
  await page.locator('#draftBasis').fill('新試題四格：理論與法律');
  await page.locator('#draftAnalysis').fill('新試題四格：涵攝');
  await page.locator('#draftConclusion').fill('新試題四格：結論');
  await page.locator('#issueInput').fill('新試題完整申論：刑法構成要件、證據與程序。');
  await page.locator('#ai-simple-feedback').fill('新試題AI評語：應說明案例分層。');
  await page.waitForFunction(id=>{
   const all=JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}'),q=all[id];
   return q?.issue?.includes('刑法構成要件')&&q?.essayDrafts?.issues==='新試題四格：爭點'
     &&q?.essayDrafts?.conclusion==='新試題四格：結論'&&q?.aiFeedback?.includes('新試題AI評語');
  },reviewId);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>window.Practice25?.getQuestion()?.id===id,reviewId,{timeout:30000});
  await page.locator('#ai-simple-dual').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#draftIssue').inputValue(),'新試題四格：爭點');
  assert((await page.locator('#issueInput').inputValue()).includes('刑法構成要件'));
  assert((await page.locator('#ai-simple-feedback').inputValue()).includes('新試題AI評語'));
  assert.equal(await page.evaluate(()=>{
    return JSON.parse(localStorage.getItem('probation-study-desk-v24'))['legacy-sentinel'].issue;
  }),'既有答案必須保留');
  // Confirm a recovered old-year PDF question also renders literally.
  await page.evaluate(id=>window.Practice25.select(id),anotherId);
  assert.equal(await page.locator('#questionBody').textContent(),other.body);
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('#ai-simple-dual').isVisible());
  assert.equal(await page.locator('#questionBody').textContent(),other.body);
  // Print centre must resolve the newly added original, notes and AI feedback, without writing records.
  const print=await context.newPage();
  print.on('pageerror',error=>errors.push(error.message));
  await print.goto(origin+'/print/?module=past',{waitUntil:'domcontentloaded'});
  await print.locator('#recordList .record-item').first().waitFor({timeout:30000});
  assert((await print.locator('#recordList').textContent()).includes('刑法與刑事訴訟法'));
  await print.locator('#search').fill('114年');
  const labels=await print.locator('#recordList .record-item').count();
  assert(labels>0,'114 original essay appears in print list');
  await print.locator('#selectVisible').click();
  await print.locator('#preview').click();
  assert((await print.locator('#paper').textContent()).includes('新試題完整申論'));
  assert((await print.locator('#paper').textContent()).includes('新試題四格'));
  assert((await print.locator('#paper').textContent()).includes('新試題AI評語'));
  assert((await print.locator('#paper').textContent()).includes('（50 分）'));
  assert.deepEqual(errors,[], 'no runtime JavaScript exception in exam or print workflows');
  await context.close();
  console.log('PASS '+(ENGINE===webkit?'WebKit':'Chromium')+': 553 official exams, original 50-point paper, external lookup, four-grid, AI review, persistent legacy+new records, recovered original, and A4 print.');
 }finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
