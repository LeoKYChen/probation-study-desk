'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const url=process.env.KNOWLEDGE_GRAPH_URL;
  if(!/^http:\/\/127\.0\.0\.1:\d+\/knowledge-graph-preview\/$/.test(url||''))throw new Error('Local isolated preview URL required');
  const browser=await chromium.launch({headless:true});
  try{
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const errs=[];page.on('pageerror',err=>errs.push(err.message));
      await page.goto(url,{waitUntil:'networkidle',timeout:45000});
      await page.locator('#graph .graph-node').first().waitFor({timeout:15000});
      assert((await page.locator('#graph .graph-node').count())>15,'real data graph must render');
      assert.equal(await page.locator('#subjectSelect').inputValue(),'少年事件處理法');
      const labels=await page.locator('#subjectSelect option').allTextContents();
      assert.equal(labels.length,8,'seven professional subjects plus cross subject option');
      for(const excluded of ['國文','法學知識與英文','社會工作概論']){
        assert(!labels.includes(excluded),'excluded option: '+excluded);
        assert.equal(await page.locator('#graph .graph-node.subject[data-node-id="subject:'+excluded+'"]').count(),0);
      }

      await page.locator('#subjectSelect').selectOption('刑法');
      assert((await page.locator('#graph .graph-node.topic').count())>0);
      await page.locator('#subjectSelect').selectOption('cross');
      assert.equal(await page.locator('#graph .graph-node.subject').count(),4);
      await page.locator('#zoomIn').click();
      assert.notEqual(await page.locator('#zoomLabel').textContent(),'100%');
      await page.locator('#zoomReset').click();
      assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
      await page.locator('#search').fill('不存在的超長測試字串');
      assert.equal(await page.locator('#graph .graph-node.question').count(),0);
      await page.locator('#search').fill('');
      await page.locator('#subjectSelect').selectOption('少年事件處理法');
      await page.locator('#graph .graph-node.topic').first().focus();
      await page.keyboard.press('Enter');
      assert(await page.locator('#detailContent .record').count()>0,'topic detail should show original rows');
      const docWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert(docWidth<=viewport.width+2,'no horizontal overflow on mobile');
      assert.deepEqual(errs,[],'page should not throw errors');
      console.log('PASS: graph preview responsive interactive '+viewport.width+'px');
      await page.close();
    }
  } finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
