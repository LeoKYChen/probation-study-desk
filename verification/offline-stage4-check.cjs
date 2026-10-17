'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'offline-manifest.json'),'utf8'));
assert.equal(manifest.schemaVersion,1);
assert(Array.isArray(manifest.assets)&&manifest.assets.length>=170,'stage4 must include all modern study resources');
const urls=manifest.assets.map(x=>x.url),names=new Set(urls);
assert.equal(names.size,urls.length,'no duplicate cache URLs');
assert(urls.every(p=>!(/\.(cjs|ts|tsx|py)$/i.test(p))),'unpublished source or browser tests must not be requested by offline downloader');
const required=[
 'index.html','offline/index.html','offline.js','offline.css',
 'professional/index.html','professional/app.js','professional/question-sources.js','professional/essay.js','professional/source-main-questions.js','professional/source-related-questions.js',
 'v2.5/index.html','v2.5/questions.js','v2.5/related-questions.js','v2.5/essay-workspace25.js',
 'daily-simulation/index.html','daily-simulation/questions.json','daily-simulation/app.js',
 'common-subjects/index.html','common-subjects/essay-questions-v1.js','common-subjects/essay-questions-v2.js','common-subjects/essay-questions-v3.js',
 'common-subjects/daily/reading.json','common-subjects/english-assistant/vocab.js',
 'juvenile-news/index.html','juvenile-news/issues.json',
 'backup/index.html','backup/unified-core.js','print/index.html','print/print-model.js'
];
for(const file of required)assert(names.has(file),'missing essential offline resource '+file);
for(const file of urls){
 assert(!file.startsWith('/')&&!file.includes('..')&&!file.includes('?')&&!file.includes('#')&&!/^[a-z]+:/i.test(file),'invalid local path '+file);
 const abs=path.resolve(root,file);
 assert(abs.startsWith(root+path.sep),'path traversal: '+file);
 assert(fs.statSync(abs).isFile(),'missing tracked offline asset '+file);
 if(/\.(json|webmanifest)$/.test(file))assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(abs,'utf8')),'invalid JSON '+file);
}
for(const file of urls.filter(x=>x.endsWith('.html'))){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const [,url] of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)){
  let dep=new URL(url,'https://example.test/'+file);
  if(dep.origin!=='https://example.test'||dep.search||dep.hash)continue;
  const local=decodeURI(dep.pathname).replace(/^\//,'');
  if(/\.(js|css|png|svg|webmanifest)$/.test(local))assert(names.has(local),'missing HTML dependency '+file+' -> '+local);
 }
}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(home.includes('href="./offline/"'),'offline entry should be visible in sidebar');
assert.equal((home.match(/class="tile /g)||[]).length,5,'do not change the five approved study tiles');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
assert(sw.includes("PREFIX+'snapshot:'")&&sw.includes("port.postMessage({type:'done',state:next})"),'preserve atomic completed downloads');
assert(!sw.includes('localStorage.'),'the SW may not modify browser answers');
console.log('PASS stage4: '+urls.length+' local assets and HTML dependencies, correct JSON, atomic SW, five entrances preserved');
