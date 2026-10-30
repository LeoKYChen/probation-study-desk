'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),prefix=process.env.TEST_OFFLINE_PREFIX||'';
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.md':'text/markdown;charset=utf-8'};
let dropNetwork=false;
const server=http.createServer((req,res)=>{
 if(dropNetwork){res.writeHead(503,{'content-type':'text/plain','cache-control':'no-store'}).end('origin unavailable');return;}
 let sub=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
 if(prefix&&sub.startsWith(prefix.replace(/^\//,'')+'/'))sub=sub.slice(prefix.replace(/^\//,'').length+1);
 if(!sub||sub.endsWith('/'))sub+='index.html';
 const f=path.resolve(root,sub);
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(f,(e,data)=>{if(e){res.writeHead(404).end('404');return;}
  res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'}).end(data)});
});
async function scenario(engine,name){
 const browser=await engine.launch({headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'zh-TW',serviceWorkers:'allow'});
 const page=await ctx.newPage();const base='http://127.0.0.1:'+server.address().port+prefix;
 await page.goto(base+'/offline/',{waitUntil:'load',timeout:30000});
 const entry=page.locator('.offline-entry');await entry.waitFor({timeout:25000});
 await page.waitForFunction(()=>!document.querySelector('#offline-dialog [data-download]').disabled,{timeout:25000});
 await entry.click();
 await page.locator('#offline-dialog [data-download]').click();
 await page.waitForFunction(()=>document.querySelector('#offline-dialog [data-status]').textContent.includes('已備妥'),{timeout:120000});
 const snapshot=await page.evaluate(async()=>{
  const reg=await navigator.serviceWorker.ready,active=reg.active;
  return new Promise((resolve,reject)=>{
   const c=new MessageChannel(),timeout=setTimeout(()=>reject(Error('status timeout')),9000);
   c.port1.onmessage=ev=>{clearTimeout(timeout);resolve(ev.data.state)};
   active.postMessage({type:'status'},[c.port2]);
  });
 });
 assert(snapshot&&snapshot.count>=180,'all stage4 assets must be in offline snapshot');
 const initial=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
 if(engine===webkit)dropNetwork=true;
 else await ctx.setOffline(true);
 const past=await ctx.newPage();
 await past.goto(base+'/v2.5/',{waitUntil:'load',timeout:25000});
 await past.locator('#issueInput').waitFor({timeout:12000});
 await past.locator('#issueInput').fill('第四階段離線申論原稿 — '+name);
 await past.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('probation-study-desk-v24')||'{}')).some(v=>String(v.issue||'').includes('第四階段離線申論原稿')),{timeout:12000});
 await past.reload({waitUntil:'load'});
 assert((await past.locator('#issueInput').inputValue()).includes('第四階段離線申論原稿'),'past essay must survive reload while still disconnected');
 const common=await ctx.newPage();await common.goto(base+'/common-subjects/',{waitUntil:'load',timeout:25000});
 await common.locator('#essayText').fill('作文離線保存測試 — '+name);
 await common.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('psd-common-subjects-v1')||'{}').drafts||{}).some(d=>String(d.text||'').includes('作文離線保存測試')),{timeout:12000});
 await common.reload({waitUntil:'load'});
 assert((await common.locator('#essayText').inputValue()).includes('作文離線保存測試'),'common essay must survive offline reload');
 const daily=await ctx.newPage();await daily.goto(base+'/daily-simulation/',{waitUntil:'load',timeout:25000});
 await daily.waitForFunction(()=>document.querySelector('#cards')?.children.length>0,{timeout:16000});
 const professional=await ctx.newPage();await professional.goto(base+'/professional/',{waitUntil:'load',timeout:30000});
 await professional.locator('#todayHeading').waitFor({timeout:20000});
 const backup=await ctx.newPage();await backup.goto(base+'/backup/',{waitUntil:'load',timeout:20000});
 await backup.locator('#export').waitFor();
 const printing=await ctx.newPage();await printing.goto(base+'/print/',{waitUntil:'load',timeout:20000});
 await printing.waitForFunction(()=>document.getElementById('notice')?.textContent.includes('已讀取'),{timeout:14000});
 const news=await ctx.newPage();await news.goto(base+'/juvenile-news/',{waitUntil:'load',timeout:25000});
 await news.locator('#root').waitFor();
 await news.waitForFunction(()=>document.querySelector('#root')?.textContent.length>30,{timeout:14000});
 if(engine===webkit)dropNetwork=false;
 else await ctx.setOffline(false);
 const after=await past.evaluate(()=>JSON.parse(localStorage.getItem('probation-study-desk-v24')));
 assert(Object.values(after).some(v=>String(v.issue||'').includes('第四階段離線申論原稿')));
 assert(after && Object.keys(after).length>0,'offline work must be retained after reconnect');
 console.log('PASS '+name+prefix+': '+snapshot.count+' cached assets; '+(engine===webkit?'simulated origin outage (all network responses HTTP 503)':'actual browser airplane mode')+'; past essay, common essay, daily practice, professional, news, JSON backup and print pages; answer persistence');
 await ctx.close();
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const type=process.env.TEST_OFFLINE_ENGINE||'chromium';await scenario(type==='webkit'?webkit:chromium,type);}
 finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
