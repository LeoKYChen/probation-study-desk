'use strict';
// Dedicated, synthetic-data browser acceptance for PR #127. Nothing is posted to external apps.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff':'font/woff'};
const server=http.createServer((req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/probation-study-desk/'))pathname=pathname.slice('/probation-study-desk'.length);
    const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(target,(err,data)=>{
      res.writeHead(err?404:200,{'content-type':MIME[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
      res.end(err?'not found':data);
    });
  }catch{res.writeHead(400).end('bad request');}
});
async function exercise(engine,base){
  const browser=await engine.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',timezoneId:'Asia/Taipei',acceptDownloads:true});
    await ctx.addInitScript(()=>{
      // Clipboard capture: assertions inspect generated prompts, never send them to ChatGPT.
      const fake={writeText:async value=>{window.__study30Copied=String(value);},readText:async()=>window.__study30Copied||''};
      try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:fake});}catch{}
      window.prompt=(label,value)=>{window.__study30Copied=String(value||'');return ''};
    });
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.goto(base+'professional/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.Study30App?.saveAnswerLink && window.Study30App?.readAnswerLink);
    const input=page.locator('#daily30AnswerLink'),open=page.locator('#daily30OpenAnswerLink');
    assert.equal(await input.count(),1,'exactly one answer-link input');
    assert.equal(await open.count(),1);
    assert.equal(await open.isVisible(),false,'blank links are hidden');
    assert.equal(await page.locator('#daily30AiMode').inputValue(),'full');

    for(const width of [375,390,430]){
      await page.setViewportSize({width,height:844});
      const measure=await page.evaluate(()=>{
        const choices=[...document.querySelectorAll('.daily30-mode-option')].map(el=>el.getBoundingClientRect());
        const input=document.querySelector('#daily30AnswerLink').getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,choices:choices.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),input:{x:input.x,right:input.right}};
      });
      assert(measure.overflow<=2,'horizontal overflow at '+width+': '+measure.overflow);
      assert.equal(measure.choices.length,2);
      assert(measure.choices[1].y>measure.choices[0].y+10,'review cards should stack on phones');
      assert(measure.choices.every(x=>x.height>=44),'review cards need touch targets');
      assert(measure.input.x>=0 && measure.input.right<=width,'answer-link input must fit');
    }
    const todayId=await page.evaluate(()=>Study30App.essayContext().questionId);
    assert(todayId,'a question ID must exist');
    const storageKey='probation-study30-v251:v1';
    await page.evaluate(key=>{
      const store=JSON.parse(localStorage.getItem(key));
      const today=Study30App.essayContext().date;
      store.sessions[today].unrelatedSentinel='must-preserve';
      localStorage.setItem(key,JSON.stringify(store));
    },storageKey);
    // Initialize the application with the historical record, rather than mutating storage behind a live in-memory session.
    await page.reload();
    await page.waitForFunction(()=>window.Study30App?.saveAnswerLink);
    const firstLink='https://www.notion.so/study30-answer-test-123';
    await input.fill(firstLink);
    assert.equal(await open.isVisible(),true,'stored link should expose the open action');
    assert.equal(await open.getAttribute('href'),firstLink);
    assert.equal(await open.getAttribute('target'),'_blank');
    assert.match(await open.getAttribute('rel'),/noopener/);
    assert.match(await open.getAttribute('rel'),/noreferrer/);
    assert.equal(await page.evaluate(id=>Study30App.readAnswerLink(id),todayId),firstLink);
    assert.equal(await page.evaluate(([key,id])=>{
      const data=JSON.parse(localStorage.getItem(key));
      const date=Study30App.essayContext().date;
      return data.sessions[date].answerLinks[id];
    },[storageKey,todayId]),firstLink);

    // The visible cards must control the existing AI-prompt mode (no scoring on four-grid drafts).
    await page.locator('#essayEditor').evaluate(el=>{el.open=true;});
    await page.locator('#essayField0').fill('方向測試：辨識法律爭點');
    await page.locator('input[name="daily30ReviewChoice"][value="direction"]').check();
    assert.equal(await page.locator('#daily30AiMode').inputValue(),'direction');
    await page.locator('#daily30CopyAi').click();
    const direction=await page.evaluate(()=>window.__study30Copied||'');
    assert(direction.includes('不給百分制模擬成績'),'direction mode cannot request a percentage score');
    assert(direction.includes('方向測試：辨識法律爭點'),'direction mode should include the outline');
    assert(!direction.includes(firstLink),'external link must not enter AI prompt');

    await page.locator('#essayFullAnswer').fill('完整測試：爭點、規範、涵攝、結論');
    await page.locator('input[name="daily30ReviewChoice"][value="full"]').check();
    assert.equal(await page.locator('#daily30AiMode').inputValue(),'full');
    await page.locator('#daily30CopyAi').click();
    const full=await page.evaluate(()=>window.__study30Copied||'');
    assert(full.includes('爭點掌握（30分）'),'full mode should retain the four-dimension scoring rules');
    assert(full.includes('完整測試：爭點、規範、涵攝、結論'));
    assert(!full.includes(firstLink),'external link must not enter full AI prompt');
    await page.locator('#daily30AiFeedback').fill('保留的合成 AI 評語');

    // Invalid and credentialed URLs must not replace the saved link or remain clickable.
    for(const invalid of ['javascript:alert(1)','https://user:password@example.org/essay']){
      await input.fill(invalid);
      assert.equal(await open.isVisible(),false,'invalid link must not have an open action');
      assert.equal(await page.evaluate(id=>Study30App.readAnswerLink(id),todayId),firstLink,'rejected URL must not overwrite existing link');
      assert.match(await page.locator('#daily30AnswerLinkStatus').innerText(),/請貼上/);
    }
    await input.fill(firstLink);
    await page.locator('#essayPracticeSubject').selectOption('刑事訴訟法');
    const otherId=await page.evaluate(()=>Study30App.essayContext().questionId);
    assert.notEqual(otherId,todayId,'must switch to a distinct question');
    assert.equal(await input.inputValue(),'','another question must not inherit link');
    const otherLink='https://drive.google.com/file/d/synthetic-study30-answer/view';
    await input.fill(otherLink);
    assert.equal(await page.evaluate(id=>Study30App.readAnswerLink(id),otherId),otherLink);
    await page.locator('#essayPracticeSubject').selectOption('today');
    assert.equal(await input.inputValue(),firstLink,'returning to first question restores first URL');
    await page.reload();
    await page.waitForFunction(()=>window.Study30App?.readAnswerLink && document.querySelector('#daily30AnswerLink')?.value);
    assert.equal(await input.inputValue(),firstLink,'URL must survive reload');
    assert.equal(await page.locator('#essayFullAnswer').inputValue(),'完整測試：爭點、規範、涵攝、結論');
    assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'保留的合成 AI 評語');
    const backupPromise=page.waitForEvent('download');
    await page.locator('#export').click();
    const download=await backupPromise;
    const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(backup.format,'probation-study30-v252');
    const date=await page.evaluate(()=>Study30App.essayContext().date);
    assert.equal(backup.data.sessions[date].answerLinks[todayId],firstLink);
    assert.equal(backup.data.sessions[date].answerLinks[otherId],otherLink);
    assert.equal(backup.data.sessions[date].unrelatedSentinel,'must-preserve');
    const importResult=await page.evaluate(json=>{
      const store=Study30BackupImport.parse(json);
      return {count:Object.keys(store.sessions).length,hasUrl:Object.values(store.sessions).some(s=>Object.values(s.answerLinks||{}).some(v=>v.includes('notion.so')))};
    },JSON.stringify(backup));
    assert(importResult.count>=1&&importResult.hasUrl,'existing import parser should preserve new link field');

    await input.fill('');
    assert.equal(await open.isVisible(),false);
    await page.reload();
    await page.waitForFunction(()=>window.Study30App?.readAnswerLink);
    assert.equal(await input.inputValue(),'','cleared URL must stay cleared after reload');
    await page.locator('#essayPracticeSubject').selectOption('刑事訴訟法');
    assert.equal(await input.inputValue(),otherLink,'other question URL must survive clearing first URL');
    assert.deepEqual(errors,[],'no browser errors');
    console.log('PASS '+engine.name()+' '+base+' review modes, mobile RWD, URL security, question switching, refresh, AI isolation, JSON backup/import');
    await ctx.close();
  }finally{await browser.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    for(const engine of [chromium,webkit])for(const prefix of ['/','/probation-study-desk/'])await exercise(engine,origin+prefix);
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
