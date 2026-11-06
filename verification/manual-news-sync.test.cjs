'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const script=fs.readFileSync('scripts/apps-script/ManualIncrementalNews.gs','utf8');
function ctxWith(overrides={}){
 const properties=new Map(),p={
   getProperty:k=>properties.get(k)||null,
   setProperty:(k,v)=>properties.set(k,v),
   deleteProperty:k=>properties.delete(k)
 };
 const Utilities={
   DigestAlgorithm:{SHA_256:'sha256'},
   newBlob:v=>{const b=Buffer.from(v);return {getBytes:()=>Array.from(b),getDataAsString:()=>b.toString('utf8')};},
   computeDigest:(algo,b)=>Array.from(crypto.createHash(algo).update(Buffer.from(b)).digest()),
   base64Decode:s=>Array.from(Buffer.from(s,'base64'))
 };
 const ctx={console,Utilities,PropertiesService:{getScriptProperties:()=>p},readingNewsValidate_:()=>{},Logger:{log:()=>{}},...overrides};
 vm.createContext(ctx);vm.runInContext(script,ctx);return {ctx,properties};
}
function doc(id,text='text',date='2026-11-05'){
 return {id:'news-'+id,title:'News '+id,content:text,date,modified:'2026-11-05T00:00:00.000Z',mime:'text/markdown',tags:[],
 url:'https://leokychen.github.io/probation-study-desk/daily-simulation/?document=news-'+id};
}
test('skips committed unchanged files and resumes after maxChanges without rescanning',()=>{
 const list=[{id:'a',name:'News a',modified:'2026-11-05T00:00:00.000Z',body:'same'},
 {id:'b',name:'News b',modified:'2026-11-05T00:00:00.000Z',body:'first'},
 {id:'c',name:'News c',modified:'2026-11-05T00:00:00.000Z',body:'second'}];
 const makeFile=f=>({getId:()=>f.id,getName:()=>f.name,getMimeType:()=> 'text/markdown',
  getLastUpdated:()=>new Date(f.modified),getBlob:()=>({getDataAsString:()=>f.body})});
 const iter=start=>{let index=start;return {hasNext:()=>index<list.length,getNext:()=>makeFile(list[index++]),
  next:()=>makeFile(list[index++]),getContinuationToken:()=>String(index)};};
 const {ctx}=ctxWith({
  DriveApp:{getFolderById:()=>({getFiles:()=>iter(0)}),continueFileIterator:token=>iter(Number(token))},
  readingNewsId_:id=>'news-'+id,
  readingNewsDate_:()=> '2026-11-05',readingNewsTags_:()=>[]
 });
 const config=()=>({folderId:'folder',recursive:false,site:'https://leokychen.github.io/probation-study-desk/daily-simulation/',started:Date.now()});
 const old={documents:[{...doc('a','same'),title:'News a'}]};
 let first=ctx.manualNewsScan_(config(),old,1,125000);
 assert.equal(first.skipped,1);
 assert.equal(first.changed.length,1);
 assert.equal(first.changed[0].id,'news-b');
 assert(first.cursor&&first.cursor.token);
 ctx.manualNewsSaveCursor_(first.cursor);
 const now={documents:[...old.documents,...first.changed]};
 let second=ctx.manualNewsScan_(config(),now,1,125000);
 assert.equal(second.changed.length,1);
 assert.equal(second.changed[0].id,'news-c');
 assert.equal(second.skipped,0);
 assert.equal(second.cursor,null);
 ctx.manualNewsSaveCursor_(second.cursor);
 const final=ctx.manualNewsScan_(config(),{documents:[...now.documents,...second.changed]},2,125000);
 assert.equal(final.changed.length,0);
 assert.equal(final.skipped,3);
});
test('keeps untouched hash-named shards out of GitHub tree when only one article changes',()=>{
 const originalA=doc('a','old'),originalB=doc('b','same'),changedA=doc('a','updated'),newC=doc('c','new');
 let tree=null,manifest=null,patched=0;
 const {ctx}=ctxWith();
 const question=JSON.stringify({questions:Array.from({length:125},(_,i)=>({id:String(i),question:'Q'}))});
 ctx.readingNewsApi_=(_cfg,method,suffix,payload)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:'head'}};
  if(suffix==='contents/daily-simulation/documents.json?ref=head')return {sha:'original-index'};
  if(suffix==='contents/daily-simulation/questions.json?ref=head')return {content:Buffer.from(question).toString('base64'),encoding:'base64'};
  if(suffix==='git/commits/head')return {tree:{sha:'oldtree'}};
  if(suffix==='git/trees'){tree=payload.tree;return {sha:'newtree'};}
  if(suffix==='git/commits')return {sha:'newcommit'};
  if(suffix==='git/refs/heads/main'){patched++;assert.equal(payload.force,false);return {};}
  throw Error('Unexpected GitHub call '+suffix);
 };
 const previous={sha:'original-index',data:{documents:[originalA,originalB]},shardGroups:[
  {path:'news-shards/'+ 'a'.repeat(64)+'.json',count:1,documents:[originalA]},
  {path:'news-shards/'+ 'b'.repeat(64)+'.json',count:1,documents:[originalB]}]};
 const next={documents:[changedA,originalB,newC],sync:{status:'success',syncedAt:'2026-11-05T00:00:00Z'}};
 const result=ctx.manualNewsCommit_({branch:'main',path:'daily-simulation/documents.json'},previous,next);
 assert.equal(result.sha,'newcommit');assert.equal(result.reusedShards,1);assert.equal(result.newShards,2);
 assert.equal(patched,1);
 const paths=tree.map(f=>f.path);
 assert.equal(paths.length,6); // 2 shard JSON + 2 shard JS + manifest + main offline JS
 assert(!paths.includes('daily-simulation/news-shards/'+ 'b'.repeat(64)+'.json'));
 manifest=JSON.parse(tree.find(f=>f.path==='daily-simulation/documents.json').content);
 assert.equal(manifest.count,3);assert.equal(manifest.schemaVersion,2);
 assert(manifest.shards.some(s=>s.path==='news-shards/'+ 'b'.repeat(64)+'.json'));
 assert(manifest.shards.some(s=>s.month==='2026-11'));
 const created=tree.filter(f=>f.path.startsWith('daily-simulation/news-shards/'));
 for(const f of created){
  const hash=crypto.createHash('sha256').update(f.content).digest('hex');
  assert(f.path.endsWith(hash+'.json'),'content-addressed file differs from SHA-256');
 }
});
test('rejects a concurrent GitHub index change before making a commit',()=>{
 const {ctx}=ctxWith();
 ctx.readingNewsApi_=(cfg,method,suffix)=>suffix==='git/ref/heads/main'?{object:{sha:'head'}}:{sha:'changed-index'};
 assert.throws(()=>ctx.manualNewsCommit_(
  {branch:'main',path:'daily-simulation/documents.json'},
  {sha:'original-index',data:{documents:[]},shardGroups:[]},
  {documents:[doc('a')],sync:{status:'success'}}),/其他工作更新/);
});

test('unchanged monthly catalog scans metadata only, without redownloading GitHub shards',()=>{
 const modified='2026-11-05T00:00:00.000Z',id='news-a';
 const index={schemaVersion:3,count:1,activeMonth:'2026-11',
  months:[{month:'2026-11',count:1,index:'archives/2026-11/index.json'}],
  catalog:[{id,title:'News a',modified,mime:'text/markdown',date:'2026-11-05',month:'2026-11',tags:[]}]};
 let deepReads=0,bodyReads=0,apiReads=0;
 const {ctx}=ctxWith({
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  readingNewsConfig_:()=>({folderId:'folder',recursive:false,branch:'main',path:'daily-simulation/documents.json'}),
  readingNewsReadGithub_:()=>{deepReads++;throw Error('Full archive must not be read on no-op');},
  readingNewsId_:id=>'news-'+id,
  DriveApp:{getFolderById:()=>({getFiles:()=>{
   let n=0;return {hasNext:()=>n<1,next:()=>{n++;return {
    getId:()=> 'a',getName:()=> 'News a',getMimeType:()=> 'text/markdown',
    getLastUpdated:()=>new Date(modified),
    getBlob:()=>{bodyReads++;throw Error('Source body must not be read');}
   };}};
  }})}
 });
 ctx.readingNewsApi_=(cfg,method,suffix)=>{
  apiReads++;
  if(suffix==='git/ref/heads/main')return {object:{sha:'head'}};
  if(suffix==='contents/daily-simulation/documents.json?ref=head')
   return {sha:'hash',encoding:'base64',content:Buffer.from(JSON.stringify(index)).toString('base64')};
  throw Error('Unexpected request '+suffix);
 };
 const result=ctx.manualSyncReadingNews();
 assert.equal(result.mode,'unchanged');
 assert.equal(result.changed,0);
 assert.equal(result.skipped,1);
 assert.equal(deepReads,0);
 assert.equal(bodyReads,0);
 assert.equal(apiReads,2);
});
test('v3 without complete metadata falls back to verified full read',()=>{
 const {ctx}=ctxWith();
 ctx.readingNewsApi_=(cfg,method,suffix)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:'head'}};
  if(suffix==='contents/daily-simulation/documents.json?ref=head')
   return {sha:'hash',encoding:'base64',content:Buffer.from(JSON.stringify({
    schemaVersion:3,count:1,months:[{month:'2026-11',index:'archives/2026-11/index.json',count:1}],
    catalog:[{id:'news-a',title:'News a',month:'2026-11'}]
   })).toString('base64')};
  throw Error('Unexpected request');
 };
 assert.equal(ctx.manualNewsReadCatalog_({branch:'main',path:'daily-simulation/documents.json'}),null);
});
