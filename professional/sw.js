/* v2.5.4 preview-only PWA service worker. This template is compiled by install-offline.cjs. */
'use strict';
const CACHE_PREFIX='study30-v254-offline-'+new URL(self.registration.scope).pathname+'-',CACHE=CACHE_PREFIX+'mist-blue-round-20261022-v8-ai-direction';
const ASSETS=["../assets/study-theme.css","../assets/study-round.woff","./practice-session.js","./practice-review.js","./practice-diagnostics.js","./layout-panels-v2.js","./practice-context.css","./layout-followup.css","./review-preview.js","./layout-panels.js","./learning-charts.js","./layout-review.css","./progress-calendar.js","./","./ai-review-links.js","./ai-review-links-direction.js","./app.js","./backup-import.js","./content-cleanup.css","./content-ui.js","./daily-essay-workbench.js","./data-health.js","./essay-analytics.js","./essay-review.js","./essay-rubric-core.js","./essay-selfcheck.js","./essay.js","./icon-180.png","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest","./offline-control.js","./offline.css","./question-sources.js","./review-core.js","./review-simulator.js","./source-main-questions.js","./source-related-questions.js","./study30-shuati-links.js","./study30-yamol-links.js","./style.css","./v254-diagnostics.js","./weakness-priority.js"];
const scope=self.registration.scope;
const urls=ASSETS.map(a=>new URL(a,scope).href);
const home=new URL('./index.html',scope).href;

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // An atomic install: if any required asset cannot be saved, installation fails.
    await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  // No cross-origin caching, no interception of external services or user exports.
  if(url.origin!==new URL(scope).origin||!url.href.startsWith(scope))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){
          const cache=await caches.open(CACHE);
          // Keep the offline landing page current after a successful connected visit.
          if(url.pathname===new URL(home).pathname||url.pathname===new URL(scope).pathname)
            await cache.put(home,response.clone());
        }
        return response;
      }catch(error){
        const cache=await caches.open(CACHE);
        const cached=await cache.match(request,{ignoreSearch:true})||await cache.match(home);
        if(cached)return cached;
        throw error;
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());
    return response;
  })());
});
self.addEventListener('message',event=>{
  if(!event.data||event.data.type!=='OFFLINE_STATUS_CHECK'||!event.ports||!event.ports[0])return;
  const port=event.ports[0];
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      const available=await Promise.all(urls.map(async u=>Boolean(await cache.match(u))));
      port.postMessage({ready:available.every(Boolean),assets:available.filter(Boolean).length,total:urls.length});
    }catch(e){port.postMessage({ready:false,error:'offline-cache-unavailable'});}
  })());
});
