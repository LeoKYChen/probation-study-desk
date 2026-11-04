/* Browser acceptance for all 104 cross-class psychology / psychometric past papers.
 * Tests original text, newly curated three-section analysis, mobile layout,
 * browser state across question switching, and existing answer persistence.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium,webkit} = require('playwright');
const engineName = process.env.PSYCHOLOGY_BROWSER_ENGINE || 'chromium';
assert(['chromium','webkit'].includes(engineName));
const engine = engineName==='webkit'?webkit:chromium;
const root = process.cwd();
const types = {'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.woff':'font/woff','.svg':'image/svg+xml'};
const remote = process.env.PSYCHOLOGY_E2E_BASE_URL;
const server = http.createServer((req,res)=>{
  try{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name.startsWith('/probation-study-desk/'))name=name.slice('/probation-study-desk'.length);
    if(name.endsWith('/'))name+='index.html';
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const body=fs.readFileSync(file);
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end('not found');}
});
const targets=[
  '115-心理學-3',
  '113-家事調查官-心理測驗員-心理學-1',
  '薦任升等（矯正）-112-心理測驗-2',
  '薦任升等（矯正）-108-心理測驗-1',
  'police-111-psychology-1',
  'police-108-psychology-1'
];
async function main(){
  if(!remote)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=remote||'http://127.0.0.1:'+server.address().port+'/';
  let browser;
  try{
    browser=await engine.launch({headless:true});
    const ctx=await browser.newContext({locale:'zh-TW',timezoneId:'Asia/Taipei',viewport:{width:390,height:844},serviceWorkers:'block'});
    const errors=[], failures=[];
    const page=await ctx.newPage();
    page.on('pageerror',err=>errors.push(String(err)));
    page.on('response',res=>{if(res.url().startsWith(base) && res.status()>=400)failures.push(res.status()+' '+res.url());});
    const qUrl = new URL('v2.5/?q='+encodeURIComponent(targets[0]),base).href;
    await page.goto(qUrl,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(id=>window.Practice25?.getQuestion?.()?.id===id,targets[0],{timeout:45000});
    const indexed=await page.evaluate(()=>{
      const all=window.Practice25.getQuestions();
      return all.filter(q=>q.subject==='心理學'||q.subject==='心理測驗').map(q=>({id:q.id,body:q.body,subject:q.subject}));
    });
    assert.equal(indexed.length,104,'all source records must be usable from the live question view');
    assert.equal(new Set(indexed.map(q=>q.id)).size,104);
    for (const q of indexed){
      await page.evaluate(id=>window.Practice25.select(id),q.id);
      const d=await page.evaluate(()=>({
        id:window.Practice25.getQuestion()?.id,
        body:document.querySelector('#questionBody')?.textContent,
        list:document.querySelectorAll('#pointList li').length,
        section2:document.querySelector('#psychTeacherPanel')?.hidden,
        section3:document.querySelector('#psychIntentPanel')?.hidden,
        notice:document.querySelector('#psychAnalysisNotice')?.textContent,
      }));
      assert.equal(d.id,q.id,'routing '+q.id);
      assert.equal(d.body,q.body,'original question must not be edited: '+q.id);
      assert(d.list>0,'no lost tasks: '+q.id);
      assert.equal(d.section2,false,q.id);
      assert.equal(d.section3,false,q.id);
      assert(d.notice.includes('非官方標準答案'),q.id);
    }
    for (const id of targets){
      await page.evaluate(v=>window.Practice25.select(v),id);
      assert((await page.locator('#pointList').innerText()).length>20,id);
    }
    await page.evaluate(id=>window.Practice25.select(id),'113-家事調查官-心理測驗員-心理學-1');
    assert((await page.locator('#pointList').innerText()).includes('依附創傷'),'must show 5-point attachment trauma subtask');
    await page.evaluate(id=>window.Practice25.select(id),'115-心理學-3');
    assert.equal(await page.locator('#psychIntentPanel').getAttribute('open'),null,'answer analysis stays collapsed');
    await page.locator('#psychIntentPanel summary').click();
    assert.notEqual(await page.locator('#psychIntentPanel').getAttribute('open'),null,'can open answer analysis');
    await page.evaluate(()=>window.Practice25.select('115-心理學-3'));
    assert.notEqual(await page.locator('#psychIntentPanel').getAttribute('open'),null,'same-question refresh keeps manual open state');
    await page.evaluate(()=>window.Practice25.select('114-心理學-1'));
    assert.equal(await page.locator('#psychIntentPanel').getAttribute('open'),null,'changing question collapses prior answer');
    const nonPsych=await page.evaluate(()=>window.Practice25.getQuestions().find(q=>q.subject==='犯罪學')?.id);
    assert(nonPsych,'nonpsych sample is available');
    await page.evaluate(id=>window.Practice25.select(id),nonPsych);
    assert.equal(await page.locator('#psychTeacherPanel').isVisible(),false,'nonpsych analysis must be hidden');
    assert.equal(await page.locator('#psychIntentPanel').isVisible(),false,'no answer spillover to other subjects');
    await page.evaluate(()=>window.Practice25.select('115-心理學-3'));
    await page.locator('#draftIssue').fill('心理學四格草稿留存驗證');
    await page.locator('#issueInput').fill('心理學申論完整作答留存驗證');
    await page.waitForFunction(()=>{
      let r=JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}')['115-心理學-3'];
      return r?.essayDrafts?.issues==='心理學四格草稿留存驗證' && r?.issue==='心理學申論完整作答留存驗證';
    },null,{timeout:20000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(id=>window.Practice25?.getQuestion?.()?.id===id,'115-心理學-3',{timeout:45000});
    assert.equal(await page.locator('#draftIssue').inputValue(),'心理學四格草稿留存驗證');
    assert.equal(await page.locator('#issueInput').inputValue(),'心理學申論完整作答留存驗證');
    for (const width of [320,375,390,768,1280]){
      await page.setViewportSize({width,height:900});
      for(const id of ['#pointList','#psychTeacherPanel','#psychIntentPanel']){
        let bounds=await page.locator(id).boundingBox();
        assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1,'horizontal overflow '+id+' '+width);
      }
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),'document overflow at '+width);
    }
    assert.deepEqual(errors,[],'no uncaught JS exceptions');
    assert.deepEqual(failures,[],'all local resources loaded');
    console.log('PASS '+engineName+': all 104 source questions, analysis visibility, 320–1280px, persistent answer.');
    await ctx.close();
  } finally {if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
