'use strict';
// Visual-only RWD checks against synthetic browser profiles. No learning records touched.
const {chromium, webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const requested=decodeURIComponent(url.pathname);
 const candidate=path.resolve(root,'.'+requested,requested.endsWith('/')?'index.html':'');
 if(!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const actual=fs.existsSync(candidate)&&fs.statSync(candidate).isDirectory()?path.join(candidate,'index.html'):candidate;
 fs.readFile(actual,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(actual)]||'application/octet-stream','cache-control':'no-store'}).end(bytes)});
});
const approx=(a,b,t=2)=>Math.abs(a-b)<=t;
const measure=(page,selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),style=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:style.display,align:style.alignItems,justify:style.justifyContent,whiteSpace:style.whiteSpace}});
async function run(engine,device){
 const browser=await engine.launch({headless:true});
 const width=device;
 try{
 const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,locale:'zh-TW'});
 const page=await ctx.newPage();
 const address='http://127.0.0.1:'+server.address().port;
 await page.goto(address+'/professional/',{waitUntil:'load'});
 const wk=await measure(page,'#showWeekProgress'),month=await measure(page,'#showMonthProgress'),sw=await measure(page,'.progress-switch');
 assert(approx(wk.width,month.width,1),'#1 week/month widths must be equal');
 assert(approx(wk.x,sw.x)&&approx(month.right,sw.right),'#1 progress row must use full panel width');
 await page.goto(address+'/common-subjects/',{waitUntil:'load'});
 const start=await measure(page,'#timerToggle'),reset=await measure(page,'#timerReset');
 assert(approx(start.width,reset.width,1)&&approx(start.y,reset.y,1),'#2 start and reset must be equal-width same-row buttons');
 const selectors=['#saveVersion','#copyReview','#copyRevision','#clearEssay'];
 const buttons=await Promise.all(selectors.map(s=>measure(page,s)));
 assert(buttons.every(b=>approx(b.width,buttons[0].width,1)),'#3 four editing buttons must be same width');
 assert(approx(buttons[0].y,buttons[1].y,1)&&approx(buttons[2].y,buttons[3].y,1)&&buttons[2].y>buttons[0].y,'#3 four buttons must be two rows');
 const view=await measure(page,'#viewVersion'),restore=await measure(page,'#restoreVersion');
 assert(approx(view.width,restore.width,1)&&approx(view.y,restore.y,1),'#6 version buttons equal and aligned');
 const source=await measure(page,'#compareBase'),update=await measure(page,'#compareRefresh');
 assert(approx(source.width,update.width,1),'#7 version dropdown and refresh control equal widths');
 assert(approx(source.bottom,update.bottom,2),'#7 dropdown and refresh control bottom aligned');
 assert(approx(source.height,update.height,2),'#7 refresh and dropdown same height');
 await page.locator('#tabEnglish').click();
 const links=await page.locator('.staresto-action-links > a').all();
 assert.equal(links.length,2,'#4 expected both Staresto navigation buttons');
 for(const link of links){
  assert(!(await link.innerText()).includes('→'),'#4 no arrows in Staresto link labels');
  const a=await link.evaluate(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{width:r.width,x:r.x,textAlign:c.textAlign,display:c.display,align:c.alignItems,justify:c.justifyContent}});
  assert(a.textAlign==='center'&&a.align==='center'&&a.justify==='center','#4 Staresto text must be centered');
 }
 await page.goto(address+'/v2.5/',{waitUntil:'load'});
 const pdf=await measure(page,'.topbar-tools > a[href*="/print/"]');
 const exportBtn=await measure(page,'#exportButton');
 assert(pdf.display==='flex'&&pdf.align==='center'&&pdf.justify==='center','#5 PDF link must center text');
 assert(approx(pdf.height,exportBtn.height,3),'#5 PDF and adjacent action height match');
 for(const [url,kind] of [['/common-subjects/','common'],['/professional/','prof'],['/v2.5/','past']]){
  await page.goto(address+url,{waitUntil:'load'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert(overflow<=2,kind+' caused mobile horizontal overflow: '+overflow);
 }
 console.log('PASS '+engine.name()+' '+width+'px: 7 alignments, no horizontal scrolling');
 await ctx.close();
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{for(const engine of [chromium,webkit])for(const w of [375,390,430])await run(engine,w);}
 finally{server.close()}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
