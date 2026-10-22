'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const playwright=require('playwright');
const root=path.resolve(process.argv[2]||'.');
const engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium';
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.woff':'font/woff'};
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright[engine].launch({headless:true});
  try{
    const base='http://127.0.0.1:'+server.address().port;
    for(const width of [320,375,390,430,768,860]){
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/');
      const toggle=page.locator('#mobile-nav-toggle');
      assert(await toggle.isVisible(),'navigation toggle visible '+width);
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await page.locator('#workspace-sidebar').isVisible(),false,'drawer starts closed '+width);
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      await page.locator('#workspace-sidebar').waitFor({state:'visible'});assert(await page.locator('#workspace-sidebar').isVisible(),'drawer opens '+width);
      assert.equal(await page.locator('#workspace-sidebar').evaluate(el=>el.inert),false);
      await page.locator('#mobile-nav-close').click();
      await page.locator('#workspace-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('#workspace-sidebar').isVisible(),false,'close control closes '+width);
      await toggle.click();
      await page.keyboard.press('Escape');
      await page.locator('#workspace-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('#workspace-sidebar').isVisible(),false,'Escape closes '+width);
      await toggle.click();
      await page.locator('#sidebar-scrim').click({position:{x:width-6,y:300}});
      await page.locator('#workspace-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('#workspace-sidebar').isVisible(),false,'backdrop closes '+width);
      await toggle.click();
      await page.locator('#workspace-sidebar a[href="#courses-heading"]').click();
      await page.locator('#workspace-sidebar').waitFor({state:'hidden'});assert.equal(await page.locator('#workspace-sidebar').isVisible(),false,'anchor navigates and closes '+width);
      assert.equal(await page.locator('#workspace-sidebar').evaluate(el=>el.inert),true,'closed sidebar inert '+width);
      assert.deepEqual(errors,[],'home page errors '+width);
      if(width<=430){
        await page.goto(base+'/study-desk/');
        const tabs=page.locator('.desk-tabs a');
        assert.equal(await tabs.count(),4);
        const boxes=await Promise.all([0,1,2,3].map(i=>tabs.nth(i).boundingBox()));
        for(const box of boxes)assert(box&&box.width>0&&box.height>=58,'tab visible '+width);
        assert(Math.abs(boxes[0].width-boxes[1].width)<1,'columns equal '+width);
        assert(Math.abs(boxes[0].width-boxes[2].width)<1,'all widths equal '+width);
        assert(Math.abs(boxes[0].height-boxes[3].height)<1,'all heights equal '+width);
        assert(Math.abs(boxes[0].y-boxes[1].y)<1,'first row aligned '+width);
        assert(Math.abs(boxes[2].y-boxes[3].y)<1,'second row aligned '+width);
        assert(boxes[2].y>boxes[0].y+boxes[0].height-1,'two rows '+width);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow '+width);
        await tabs.nth(3).click();
        assert.equal(new URL(page.url()).hash,'#settings','settings link works '+width);
      }
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto(base+'/');
    assert.equal(await page.locator('#mobile-nav-toggle').isVisible(),false,'desktop menu toggle hidden');
    assert.equal(await page.locator('#workspace-sidebar').isVisible(),true,'desktop sidebar remains visible');
    await page.goto(base+'/study-desk/');
    const boxes=await Promise.all([0,1,2,3].map(i=>page.locator('.desk-tabs a').nth(i).boundingBox()));
    assert(boxes.every(b=>Math.abs(b.y-boxes[0].y)<1),'desktop four tabs share one row');
    await context.close();
    console.log('PASS: '+engine+' drawer accessible and study-desk mobile navigation 2x2 equal sized');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
