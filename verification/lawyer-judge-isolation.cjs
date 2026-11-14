'use strict';
// 律師・司法官備考平臺放在 lawyer-judge/ 之下，與觀護人學習平臺同一個網址來源。
// 這支檢查確認兩邊的紀錄、快取與離線清單互不干擾，以及申論評分參考頂端的開關預設關閉。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),LJ=path.join(root,'lawyer-judge');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const DEV_DIRS=new Set(['tests','docs','scripts','verification','data','file-data']);
function walk(dir,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()){if(dir===LJ&&DEV_DIRS.has(e.name))continue;walk(full,out);}
    else out.push(path.relative(LJ,full).split(path.sep).join('/'));
  }
  return out;
}
const files=walk(LJ),pages=files.filter(f=>f.endsWith('.html')),scripts=files.filter(f=>f.endsWith('.js'));
assert(pages.length>=21,'lawyer-judge pages are present');

// 1. 每一頁第一支程式都是紀錄分隔檔，而且路徑指向 lawyer-judge/storage-namespace.js。
for(const page of pages){
  const html=fs.readFileSync(path.join(LJ,page),'utf8');
  const first=html.match(/<script\b[^>]*>/i);
  assert(first,'page has a script: '+page);
  const src=(first[0].match(/\bsrc="([^"]+)"/)||[])[1]||'';
  assert(/(^|\/)storage-namespace\.js$/.test(src)&&!/\b(defer|async|type="module")/.test(first[0]),page+' loads storage-namespace.js first, synchronously');
  assert.equal(path.posix.normalize(path.posix.join(path.posix.dirname(page),src)),'storage-namespace.js',page+' points at the shared separator');
  assert(html.indexOf(first[0])<html.search(/<\/head>/i),page+' loads it inside <head>');
  assert(!/(?:href|src)="\/(?!\/)/.test(html),page+' has no site-root absolute links');
}

// 2. 分隔檔只攔 getItem／setItem／removeItem／key／length／clear 與 window 的 storage 事件，所以律司的程式不能用其他寫法。
for(const file of scripts){
  if(file==='storage-namespace.js')continue;
  const code=fs.readFileSync(path.join(LJ,file),'utf8');
  assert(!/(?:local|session)Storage\s*\[/.test(code),file+' does not index storage by property');
  assert(!/Object\.(?:keys|entries|values)\(\s*(?:window\.)?(?:local|session)Storage\s*\)/.test(code),file+' does not enumerate storage as an object');
  // storage 事件只能掛在 window 上（分隔檔只轉譯這一種），不能用 onstorage 或自己發事件。
  assert(!/\bonstorage\b/.test(code)&&!/new StorageEvent/.test(code),file+' does not use onstorage or synthetic storage events');
  for(const m of code.matchAll(/([A-Za-z_$.]+)\.addEventListener\(\s*['"]storage['"]/g))assert(['window','root'].includes(m[1]),file+' listens for storage events on window only ('+m[1]+')');
  const props=code.match(/\b(?:local|session)Storage\.([A-Za-z_$]+)/g)||[];
  for(const p of props)assert(/\.(getItem|setItem|removeItem|key|length|clear)$/.test(p),file+' uses only wrapped storage methods ('+p+')');
}

// 3. 分隔檔的行為：同名的鍵各存各的；clear() 只清律司自己的；length／key 只看得到律司的鍵。
{
  class Storage{
    constructor(){Object.defineProperty(this,'m',{value:new Map()});}
    getItem(k){k=String(k);return this.m.has(k)?this.m.get(k):null;}
    setItem(k,v){this.m.set(String(k),String(v));}
    removeItem(k){this.m.delete(String(k));}
    key(i){return [...this.m.keys()][i]??null;}
    clear(){this.m.clear();}
    get length(){return this.m.size;}
  }
  const raw={get:Storage.prototype.getItem,set:Storage.prototype.setItem,clear:Storage.prototype.clear};
  const listeners=[];
  const store=new Storage(),win={addEventListener(type,fn){listeners.push([type,fn]);},removeEventListener(type,fn){const i=listeners.findIndex(l=>l[0]===type&&l[1]===fn);if(i>=0)listeners.splice(i,1);}};
  class StorageEvent{constructor(type,init){Object.assign(this,{type},init);}}
  raw.set.call(store,'probation-study-desk-v24','PROBATION');
  raw.set.call(store,'psd-mcq-v1','PROBATION-MCQ');
  vm.runInNewContext(read('lawyer-judge/storage-namespace.js'),{window:win,Storage,StorageEvent,WeakMap,Object,String,Number});
  assert.equal(win.__lsdeskStorageNamespace,'lj::');
  assert.equal(store.getItem('probation-study-desk-v24'),null,'lawyer-judge pages cannot read probation records');
  assert.equal(store.length,0);
  store.setItem('probation-study-desk-v24','LAW');store.setItem('psd-mcq-v1','LAW-MCQ');
  assert.equal(store.getItem('probation-study-desk-v24'),'LAW');
  assert.equal(raw.get.call(store,'probation-study-desk-v24'),'PROBATION','probation record is not overwritten');
  assert.equal(raw.get.call(store,'lj::psd-mcq-v1'),'LAW-MCQ');
  assert.equal(store.length,2);
  assert.deepEqual([store.key(0),store.key(1),store.key(2)].sort(),[null,'probation-study-desk-v24','psd-mcq-v1'].sort((a,b)=>String(a).localeCompare(String(b))).sort());
  store.removeItem('psd-mcq-v1');
  assert.equal(raw.get.call(store,'psd-mcq-v1'),'PROBATION-MCQ','removeItem leaves the probation record');
  store.clear();
  assert.equal(store.length,0);
  assert.equal(raw.get.call(store,'probation-study-desk-v24'),'PROBATION','clear() leaves probation records');
  assert.equal(raw.get.call(store,'psd-mcq-v1'),'PROBATION-MCQ');
  // storage 事件：律司的鍵去掉前綴後轉交；觀護人的鍵不轉交；整個清空照常通知；可以正常移除監聽。
  const seen=[],fn=e=>seen.push([e.key,e.newValue]);
  win.addEventListener('storage',fn);win.addEventListener('click',fn);
  const fire=e=>listeners.filter(l=>l[0]==='storage').forEach(l=>l[1](e));
  fire({key:'lj::probation-study-desk-v24',newValue:'{"a":1}',oldValue:null});
  fire({key:'probation-study-desk-v24',newValue:'PROBATION-CHANGED',oldValue:null});
  fire({key:null,newValue:null,oldValue:null});
  assert.deepEqual(seen,[['probation-study-desk-v24','{"a":1}'],[null,null]]);
  assert.equal(listeners.filter(l=>l[0]==='click')[0][1],fn,'other event types are passed through untouched');
  win.removeEventListener('storage',fn);
  assert.equal(listeners.filter(l=>l[0]==='storage').length,0,'storage listeners can be removed');
  // 再載入一次也不會疊兩層前綴。
  vm.runInNewContext(read('lawyer-judge/storage-namespace.js'),{window:win,Storage,StorageEvent,WeakMap,Object,String,Number});
  store.setItem('x','1');assert.equal(raw.get.call(store,'lj::x'),'1');
}

// 4. IndexedDB 與快取名稱不與本站相同，快取清理不會刪到本站的快取。
{
  const mine=read('cloud-sync/idb.js').match(/indexedDB\.open\('([^']+)'/)[1];
  const theirs=read('lawyer-judge/cloud-sync/idb.js').match(/indexedDB\.open\('([^']+)'/)[1];
  assert.notEqual(theirs,mine,'sync databases have different names');
  const sw=read('lawyer-judge/study-desk/sw.js'),cache=sw.match(/const CACHE='([^']+)'/)[1];
  const cleanup=sw.match(/startsWith\('([^']+)'\)/)[1];
  assert(cache.startsWith(cleanup),'study-desk worker cleans up its own cache family');
  const rootDesk=read('study-desk/sw.js');
  for(const m of rootDesk.matchAll(/'((?:psd|probation)-study-desk-shell-[^']*)'/g))assert(!m[1].startsWith(cleanup),'cleanup prefix does not match a probation cache: '+m[1]);
  // 其餘兩支 service worker 的快取名稱都帶有各自的路徑，子資料夾自然不同名。
  assert(read('lawyer-judge/sw.js').includes("const PREFIX='probation-offline-'+BASE.pathname+':'"));
  assert(read('lawyer-judge/professional/sw.js').includes('new URL(self.registration.scope).pathname'));
}

// 5. 本站的離線清單與 service worker 不含律司的檔案；律司的離線清單每一項都存在，而且會被部署。
{
  assert(!read('offline-manifest.json').includes('lawyer-judge'),'probation offline package does not grow');
  assert(!read('sw.js').includes('lawyer-judge'),'probation service worker is unchanged for lawyer-judge');
  const assets=JSON.parse(read('lawyer-judge/offline-manifest.json')).assets.map(a=>a.url);
  assert(assets.includes('storage-namespace.js'),'separator is available offline');
  for(const url of assets){
    assert(fs.existsSync(path.join(LJ,url)),'offline asset exists: '+url);
    assert(!DEV_DIRS.has(url.split('/')[0])&&!/\.(cjs|py|ts|tsx)$/.test(url),'offline asset is deployed: '+url);
  }
  const builder=read('scripts/build-cloudflare-main-mirror.py');
  assert(/"lawyer-judge",\n\}/.test(builder),'mirror publishes lawyer-judge');
  for(const dir of DEV_DIRS)assert(builder.includes('"lawyer-judge/'+dir+'"'),'mirror leaves out lawyer-judge/'+dir);
}

// 6. 申論評分參考頂端的開關：在今日清單之後，預設關閉，入口預設隱藏，只記住開或關。
{
  const page=read('law-scoring/index.html'),app=read('law-scoring/app.js');
  const today=page.indexOf('id="today"'),sw=page.indexOf('id="lj-switch"'),grid=page.indexOf('<div class="grid">');
  assert(today>0&&sw>today&&sw<grid,'switch sits right after 今日清單, above the question');
  assert(/<input type="checkbox" id="lj-enabled" role="switch"[^>]*>/.test(page)&&!/id="lj-enabled"[^>]*\bchecked\b/.test(page),'switch is off by default');
  assert(/<nav class="lj-links" id="lj-links"[^>]*\bhidden>/.test(page),'links are hidden until switched on');
  const links=[...page.matchAll(/href="(\.\.\/lawyer-judge\/[^"]*)"/g)].map(m=>m[1]);
  assert(links.length>=1);
  for(const href of links){const target=path.join(root,'law-scoring',href,href.endsWith('/')?'index.html':'');assert(fs.existsSync(target),'switch link resolves: '+href);}
  assert(app.includes("LJ_KEY='lawScoring.lawyerJudge.enabled'"));
  const block=app.slice(app.indexOf('(function ljSwitch(){'),app.indexOf('\nrender();\n})();'));
  assert(block.length>0&&!/\bstore\b|persist\(|KEY\)/.test(block.replace(/LJ_KEY/g,'')),'switch does not touch answer records');
  assert(read('law-scoring/style.css').includes('.lj-links[hidden]{display:none}'));
}
console.log('PASS lawyer-judge isolation: '+pages.length+' pages load the separator first, storage and caches are separate, switch is off by default');
