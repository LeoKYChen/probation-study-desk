/* GPL-3.0-only. Atomic offline snapshots; personal records are never changed. */
'use strict';
const BASE=new URL('./',self.location.href);
const PREFIX='probation-offline-'+BASE.pathname+':';
const CONTROL=PREFIX+'control', META=new URL('pwa/snapshot-state',BASE).href;
const absolute=path=>new URL(path,BASE).href;
// Preserve installed snapshots as fallback; connected visits must see the unified home after upgrade.
// Both directory and explicit index routes are used by existing installed apps.
const NETWORK_FIRST=new Set(['storage/full-drive.mjs','backup/test-full-backup.mjs','storage/full-backup.mjs','cloud-sync/idb.js','cloud-sync/core.js','print/index.html','print/app.js','storage/v25-repository.js','storage/lectures-repository.js','storage/common-subjects-operations.js','storage/common-subjects-repository.js','storage/daily-recovery.js','storage/daily-operations.js','storage/daily-shared-repository.js','backup/index.html','backup/test-idb-conflicts.js','storage/indexeddb.js','storage/study30-mixed-backup.js','professional/study30-idb-repository.js','professional/practice-session.js','professional/backup-import.js','professional/essay.js','backup/app.js','backup/drive-sync-ui.js','lectures/','lectures/index.html','lectures/core.js','lectures/app.js','lectures/learning.css','backup/unified-core.js','assets/study-theme.css','assets/study-round.woff','shared-ui.css','ai-prompt-customizer.js','','index.html','daily-simulation/index.html','daily-simulation/app.js','daily-simulation/questions.json','daily-simulation/practice.css','v2.5/','v2.5/index.html','v2.5/probation-trial-review.html','v2.5/probation-trial-data.js','v2.5/probation-trial.js','v2.5/trial-versions.js','v2.5/probation-trial-ui.js','v2.5/ai-simple-review-v254.js','v2.5/daily-practice.html','v2.5/daily-practice.js','professional/ai-review-links.js','professional/ai-review-links-direction.js','professional/','professional/index.html','professional/style.css','professional/layout-followup.css','common-subjects/index.html','common-subjects/english-assistant/index.html','common-subjects/catalog/index.html','common-subjects/daily/index.html',
  // Weekly updates must bypass an older downloaded PWA snapshot while online.
  'juvenile-news/','juvenile-news/index.html','juvenile-news/issues.json',
  // Scoring points grow in batches; online visits must not keep an older snapshot.
  'law-scoring/','law-scoring/index.html','law-scoring/app.js','law-scoring/data.js','law-scoring/style.css','law-scoring/review.html','law-scoring/review.js',
  'file-data/weekly.generated.js'].map(absolute));
async function networkCopy(request){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{const response=await fetch(request,{cache:'no-store',signal:controller.signal});return response.ok?response:null;}
  catch{return null;}
  finally{clearTimeout(timer);}
}
let downloading=false;
async function state(){const r=await(await caches.open(CONTROL)).match(META);return r?r.json():null;}
async function status(){const s=await state();if(!s)return null;const keys=new Set((await(await caches.open(s.cacheName)).keys()).map(r=>r.url));return s.urls.every(u=>keys.has(u))?s:null;}
async function bytes(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('下載失敗：'+new URL(url).pathname);
    if(r.redirected){
      // Cloudflare Pages canonically redirects /dir/index.html to /dir/.
      // Accept exactly this same-origin, same-directory redirect, never arbitrary URLs.
      const requested=new URL(url),final=new URL(r.url);
      const expected=requested.pathname.endsWith('/index.html')
        ?requested.pathname.slice(0,-'index.html'.length)
        :requested.pathname.endsWith('.html')
        ?requested.pathname.slice(0,-'.html'.length):null;
      if(!expected||final.origin!==requested.origin||final.pathname!==expected||
         final.search||final.hash||!final.pathname.startsWith(BASE.pathname))
        throw Error('離線下載遇到非預期轉址：'+requested.pathname);
    }return {r,b:await r.arrayBuffer()};}finally{clearTimeout(timer);}}
async function download(port){
  if(downloading)throw Error('另一個頁面正在下載，請稍後再試。');
  downloading=true;let stage;
  try{
    const {b}=await bytes(absolute('offline-manifest.json'));
    const m=JSON.parse(new TextDecoder().decode(b));
    if(m.schemaVersion!==1||!Array.isArray(m.assets)||!m.assets.length)throw Error('離線清單格式不符。');
    const seen=new Set(),pending=[];
    for(const asset of m.assets){const u=new URL(asset.url,BASE);if(u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname)||u.search||u.hash||seen.has(u.href))throw Error('離線資源路徑不符。');seen.add(u.href);pending.push(u.href);}
    const old=await state();stage=PREFIX+'snapshot:'+Date.now()+':'+Math.random().toString(16).slice(2);
    const cache=await caches.open(stage);let count=0,totalBytes=0;const fingerprints=[];
    port.postMessage({type:'progress',completed:0,total:pending.length});
    for(const url of pending){
      const {r,b:body}=await bytes(url);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),n=>n.toString(16).padStart(2,'0')).join('');
      if(/\.(json|webmanifest)$/.test(url))JSON.parse(new TextDecoder().decode(body));
      totalBytes+=body.byteLength;fingerprints.push(url+':'+digest);
      if(/\.html$/.test(url)){
        const html=new TextDecoder().decode(body);
        for(const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)){
          const u=new URL(match[1],url);u.search='';u.hash='';
          if(u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname)||!/\.(js|css|png|svg|webmanifest)$/.test(u.pathname)||seen.has(u.href))continue;
          seen.add(u.href);pending.push(u.href);
        }
      }
      await cache.put(url,new Response(body,{status:200,headers:r.headers}));
      port.postMessage({type:'progress',completed:++count,total:pending.length});
    }
    const version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprints.join('\n')))),n=>n.toString(16).padStart(2,'0')).join('').slice(0,20);
    const next={cacheName:stage,version,count,bytes:totalBytes,downloadedAt:new Date().toISOString(),urls:[...seen]};
    await(await caches.open(CONTROL)).put(META,new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json'}}));
    stage=null;port.postMessage({type:'done',state:next});
    for(const name of await caches.keys())if(name.startsWith(PREFIX+'snapshot:')&&name!==next.cacheName&&name!==old?.cacheName)await caches.delete(name);
  }finally{if(stage)await caches.delete(stage);downloading=false;}
}
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{const port=e.ports?.[0];if(!port)return;e.waitUntil((async()=>{try{if(e.data?.type==='download')await download(port);else if(e.data?.type==='status')port.postMessage({type:'done',state:await status()});}catch(error){port.postMessage({type:'error',message:error.message||'下載未完成，請重新連線後再試。'});}})());});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname)||['sw.js','offline-manifest.json'].includes(u.pathname.slice(BASE.pathname.length)))return;
  e.respondWith((async()=>{
    const clean=new URL(e.request.url);clean.search='';clean.hash='';
    if(NETWORK_FIRST.has(clean.href)&&self.navigator?.onLine!==false){
      const fresh=await networkCopy(e.request);
      if(fresh)return fresh;
    }
    const s=await state();
    if(s){u.search='';u.hash='';if(u.pathname.endsWith('/'))u.pathname+='index.html';const r=await(await caches.open(s.cacheName)).match(u.href);if(r)return r;}
    try{return await fetch(e.request);}catch{
      if(e.request.mode==='navigate')return new Response('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>尚未下載此頁</title><body style="font:18px/1.8 system-ui;padding:24px"><h1>此頁尚未備妥離線資料</h1><p>請連線後開啟練習臺，按「下載離線資料」並等候完成。</p><a href="'+absolute('v2.5/')+'">返回練習臺</a></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return new Response('Offline resource unavailable',{status:503});
    }
  })());
});
