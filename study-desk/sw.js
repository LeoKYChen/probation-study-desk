const CACHE='psd-study-desk-shell-v8';
const FILES=['./','./index.html','./desk.css','./app.js','./reset.js','./domain.js','./planning.js','../lectures/core.js','./legacy.js','../cloud-sync/core.js','../cloud-sync/idb.js','../backup/unified-core.js','../professional/source-main-questions.js','../professional/source-related-questions.js','../ai-prompt-customizer.js','../dual-ai-bridge.js','../assets/study-theme.css','../assets/study-round.woff'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('psd-study-desk-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Never cache auth, API traffic, answers or third-party data.
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const approved=FILES.map(p=>new URL(p,self.location.href).href);
 if(!approved.includes(url.href))return;
 event.respondWith(fetch(request).catch(()=>caches.match(request).then(r=>r||Response.error())));
});
