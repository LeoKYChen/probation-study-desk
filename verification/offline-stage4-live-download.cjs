'use strict';
// Uses only an isolated, new Playwright browser profile. Never reads real user records.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.STAGE4_BASE_URL;
assert(base&&base.startsWith('https://'),'Provide a real HTTPS Cloudflare preview URL');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({locale:'zh-TW',viewport:{width:390,height:844},serviceWorkers:'allow'});
  const page=await context.newPage();
  await page.goto(base+'/offline/',{waitUntil:'load',timeout:30000});
  const button=page.locator('#offline-dialog [data-download]');
  await button.waitFor({timeout:15000});
  await page.waitForFunction(()=>!document.querySelector('#offline-dialog [data-download]').disabled,{timeout:25000});
  await page.locator('.offline-entry').click();
  await button.click();
  try{
   await page.waitForFunction(()=>{
    const text=document.querySelector('#offline-dialog [data-status]')?.textContent||'';
    if(text.includes('下載失敗')||text.includes('尚未備妥離線使用')||text.includes('上一份完整離線資料仍保留'))throw Error(text);
    return text.includes('已備妥');
   },{timeout:180000});
  }catch(error){
   console.error('Live Cloudflare download status:',await page.locator('#offline-dialog [data-status]').textContent());
   throw error;
  }
  const snapshot=await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.ready;
   return await new Promise((resolve,reject)=>{
     const c=new MessageChannel();
     const t=setTimeout(()=>reject(Error('status timeout')),15000);
     c.port1.onmessage=e=>{clearTimeout(t);resolve(e.data.state)};
     reg.active.postMessage({type:'status'},[c.port2]);
   });
  });
  assert(snapshot&&snapshot.count>=180,'Full Cloudflare offline download not completed');
  // A canonicalized directory URL must be served from the downloaded /index.html cache.
  await context.setOffline(true);
  const offline=await context.newPage();
  await offline.goto(base+'/active-recall/',{waitUntil:'load',timeout:25000});
  assert.match(await offline.title(),/回憶|練習|觀護|active/i);
  const essay=await context.newPage();
  await essay.goto(base+'/common-subjects/',{waitUntil:'load',timeout:25000});
  await essay.locator('#essayText').fill('Stage 4 remote flight mode test');
  await essay.waitForFunction(()=>{
   const data=JSON.parse(localStorage.getItem('psd-common-subjects-v1')||'null');
   return data && Object.values(data.drafts||{}).some(d=>String(d.text||'').includes('Stage 4 remote flight mode test'));
  },{timeout:18000});
  await essay.reload({waitUntil:'load',timeout:25000});
  assert.match(await essay.locator('#essayText').inputValue(),/Stage 4 remote flight mode test/);
  console.log('PASS Cloudflare actual download button: '+snapshot.count+' assets, offline active-recall, common-subject answer and reload');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
