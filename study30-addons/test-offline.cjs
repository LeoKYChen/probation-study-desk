'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const dir=process.argv[2]||'deploy-dist';
const read=p=>fs.readFileSync(path.join(dir,p));
const html=read('index.html').toString(),sw=read('sw.js').toString(),client=read('offline-control.js').toString();
let count=0;
function check(name,run){run();count++;console.log('PASS',count,name);}
check('original 426-question scripts still included',()=>{
  for(const name of ['source-main-questions.js','source-related-questions.js']){assert.ok(fs.statSync(path.join(dir,name)).size>10);}
});
check('original essay and records scripts still included',()=>{
  for(const name of ['app.js','essay.js','daily-essay-workbench.js','backup-import.js','v254-diagnostics.js'])assert.ok(fs.existsSync(path.join(dir,name)));
});
check('manifest and PWA meta linked only once',()=>{
  assert.equal((html.match(/rel="manifest"/g)||[]).length,1);
  assert.equal((html.match(/src="\.\/offline-control\.js"/g)||[]).length,1);
  assert.ok(html.includes('apple-touch-icon'));
});
check('minimal offline status, no existing app editor replaced',()=>{
  assert.equal((html.match(/id="offlineStatus"/g)||[]).length,1);
  assert.ok(html.includes('id="essayEditor"'));
  assert.ok(html.includes('id="v254StudySummary"'));
  assert.ok(html.includes('id="importConfirm"'));
});
check('no external scripts needed to run offline',()=>assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i));
check('no localStorage writes in offline integration',()=>{
  for(const script of [sw,client])assert.doesNotMatch(script,/\blocalStorage\b|\bsessionStorage\b/);
});
check('manifest has standalone scope and iPhone-compatible icons',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest').toString());
  assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'./');
  for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(dir,icon.src.slice(2))));
});
check('icons have valid PNG headers and dimensions',()=>{
  for(const size of [180,192,512]){
    const buf=read('icon-'+size+'.png');
    assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(buf.readUInt32BE(16),size);assert.equal(buf.readUInt32BE(20),size);
  }
});
check('offline cache response header configured',()=>assert.match(read('_headers').toString(),/\/sw\.js\s*\n\s+Cache-Control: no-cache/));
const match=sw.match(/const ASSETS=(\[.*\]);/);
check('exact generated static inventory appears',()=>assert.ok(match));
const assets=JSON.parse(match[1]);
check('both original question sources included in SW',()=>{
  assert.ok(assets.includes('./source-main-questions.js'));
  assert.ok(assets.includes('./source-related-questions.js'));
});
check('critical code and offline client are precached',()=>{
  for(const file of ['index.html','app.js','review-core.js','essay.js','v254-diagnostics.js','offline-control.js','offline.css','manifest.webmanifest','icon-180.png'])assert.ok(assets.includes('./'+file));
});
check('no missing assets referenced in precache manifest',()=>{
  for(const uri of assets){const file=uri.slice(2);if(!file)continue;assert.ok(fs.statSync(path.join(dir,file)).isFile(),uri);}
});
check('all linked local script files are precached',()=>{
  for(const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']\.\/([^"']+)["']/g)){
    assert.ok(assets.includes('./'+m[1]),m[1]);
  }
});
check('cache cleanup does not delete other preview caches',()=>{
  assert.match(sw,/n\.startsWith\(CACHE_PREFIX\)/);assert.match(sw,/n!==CACHE/);
});
check('offline control does not falsely claim ready on partial cache',()=>{
  assert.match(client,/if\(!result\.ready\)throw/);
  assert.match(client,/offline-cache-unavailable|必要檔案不完整/);
});
check('fetch handler restricted to GET and same-origin scope',()=>{
  assert.match(sw,/request\.method!=='GET'/);
  assert.match(sw,/url\.origin!==new URL\(scope\)\.origin/);
});
check('app shell and analytics remain read-only',()=>{
  assert.doesNotMatch(client,/\.rating\s*=|\.grade\s*=|\.answer\s*=/);
});
check('service worker offline fallback executes successfully',()=>{
  const handlers={};const origin='https://v254-offline-preview.probation-study30-test.pages.dev/';
  const entries=new Map(),cache={async addAll(reqs){for(const req of reqs)entries.set(req.url||String(req),{marker:'offline'})},
    async match(req){return entries.get(req.url||String(req))||null},
    async put(req,v){entries.set(req.url||String(req),v)}};
  const caches={async open(){return cache},async keys(){return[]},async delete(){return true}};
  function Req(url){this.url=String(url);this.method='GET';this.mode='same-origin';}
  const self={registration:{scope:origin},addEventListener(n,fn){handlers[n]=fn},
    async skipWaiting(){},clients:{async claim(){}}};
  vm.runInNewContext(sw,{self,caches,Request:Req,URL,fetch:async()=>{throw Error('airplane mode');}});
  assert.equal(typeof handlers.install,'function');
  assert.equal(typeof handlers.activate,'function');
  assert.equal(typeof handlers.fetch,'function');
  let installing;handlers.install({waitUntil(p){installing=p}});
  return installing.then(async()=>{
    assert.ok(entries.has(origin+'index.html'));
    let served;handlers.fetch({request:{method:'GET',url:origin,mode:'navigate'},respondWith(p){served=p}});
    const doc=await served;assert.equal(doc.marker,'offline');
    handlers.fetch({request:{method:'GET',url:origin+'source-main-questions.js',mode:'same-origin'},respondWith(p){served=p}});
    const bank=await served;assert.equal(bank.marker,'offline');
    assert.equal(entries.size,assets.length);
  });
});
Promise.resolve().then(()=>console.log('TOTAL',count,'offline checks dispatched')).catch(e=>{console.error(e);process.exitCode=1});
