'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const code=fs.readFileSync('scripts/apps-script/ManualMonthlyNews.gs','utf8');
const monthly=month=>({month,index:'archives/'+month+'/index.json',count:1,status:'archived'});
const doc=(id,month,content='original')=>({id,title:id,content,excerpt:content,tags:[],date:month+'-05',
 modified:month+'-05T00:00:00Z',url:'https://leokychen.github.io/probation-study-desk/daily-simulation/?document='+id});
function runtime(){
 let head='head',tree=null,patches=0;
 const utilities={DigestAlgorithm:{SHA_256:'sha256'},
  newBlob:(value)=>{const raw=Buffer.from(value);return {getBytes:()=>Array.from(raw),getDataAsString:()=>raw.toString()};},
  computeDigest:(a,b)=>Array.from(crypto.createHash(a).update(Buffer.from(b)).digest()),
  base64Decode:(b)=>Array.from(Buffer.from(b,'base64'))};
 const fixtureQ=JSON.stringify({questions:Array.from({length:125},(_,i)=>({id:String(i),question:'A'}))});
 const ctx={Utilities:utilities,readingNewsValidate_:()=>{}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.readingNewsApi_=(cfg,method,suffix,payload)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:head}};
  if(suffix==='contents/daily-simulation/documents.json?ref=head')return {sha:'previous'};
  if(suffix==='contents/daily-simulation/questions.json?ref=head')return {content:Buffer.from(fixtureQ).toString('base64'),encoding:'base64'};
  if(suffix==='git/commits/head')return {tree:{sha:'oldtree'}};
  if(suffix==='git/trees'){tree=payload.tree;return {sha:'newtree'};}
  if(suffix==='git/commits')return {sha:'next'};
  if(suffix==='git/refs/heads/main'){assert.equal(payload.force,false);patches++;head=payload.sha;return {};}
  throw Error('Unexpected GitHub request '+suffix);
 };
 return {ctx,tree:()=>tree,patches:()=>patches};
}
test('monthly update preserves untouched 2026-09 shard and indexes; writes only changed months',()=>{
 const a=doc('a','2026-09'),b=doc('b','2026-10'),updatedB=doc('b','2026-10','updated'),c=doc('c','2026-11','new');
 const groups=[{month:'2026-09',path:'news-shards/'+ 'a'.repeat(64)+'.json',documents:[a]},
  {month:'2026-10',path:'news-shards/'+ 'b'.repeat(64)+'.json',documents:[b]}];
 const r=runtime(),previous={storageVersion:3,sha:'previous',monthlyIndex:{schemaVersion:3,count:2,months:[monthly('2026-09'),monthly('2026-10')]},
  monthlyGroups:[{month:'2026-09',shards:[{path:groups[0].path,count:1}]},
  {month:'2026-10',shards:[{path:groups[1].path,count:1}]}],shardGroups:groups};
 const result=r.ctx.manualNewsCommitMonthly_({branch:'main',path:'daily-simulation/documents.json'},previous,
  {documents:[a,updatedB,c],sync:{status:'success',syncedAt:'2026-11-05T00:00:00Z'}});
 assert.equal(r.patches(),1);assert.equal(result.reusedShards,1);assert.equal(result.newShards,2);
 const writes=r.tree(),paths=writes.map(x=>x.path);
 assert(!paths.includes('daily-simulation/'+groups[0].path),'untouched September shard must not be recommitted');
 assert(!paths.includes('daily-simulation/archives/2026-09/index.json'),'untouched September index must not be recommitted');
 assert(paths.includes('daily-simulation/archives/2026-10/index.json'));
 assert(paths.includes('daily-simulation/archives/2026-11/index.json'));
 const index=JSON.parse(writes.find(x=>x.path==='daily-simulation/documents.json').content);
 assert.equal(index.count,3);
 assert.deepEqual(index.months.map(x=>x.month),['2026-11','2026-10','2026-09']);
 assert.equal(index.catalog.find(d=>d.id==='a').month,'2026-09');
 for(const file of writes.filter(x=>x.path.startsWith('daily-simulation/news-shards/'))){
  assert(file.path.endsWith(crypto.createHash('sha256').update(file.content).digest('hex')+'.json'));
 }
});
test('moving a document to a new month removes the old month without altering unchanged ID',()=>{
 const a=doc('a','2026-09'),moving=doc('a','2026-10','revised');
 const r=runtime(),previous={storageVersion:3,sha:'previous',
  monthlyIndex:{schemaVersion:3,count:1,months:[monthly('2026-09')]},
  monthlyGroups:[{month:'2026-09',shards:[{path:'news-shards/'+ 'a'.repeat(64)+'.json',count:1}]}],
  shardGroups:[{month:'2026-09',path:'news-shards/'+ 'a'.repeat(64)+'.json',documents:[a]}]};
 r.ctx.manualNewsCommitMonthly_({branch:'main',path:'daily-simulation/documents.json'},previous,{documents:[moving],sync:{status:'success'}});
 const index=JSON.parse(r.tree().find(x=>x.path==='daily-simulation/documents.json').content);
 assert.equal(index.count,1);assert.equal(index.catalog[0].id,'a');
 assert.equal(index.activeMonth,'2026-10');assert.deepEqual(index.months.map(x=>x.month),['2026-10']);
});
test('refuses concurrent index replacement before creating a monthly commit',()=>{
 const a=doc('a','2026-10'),r=runtime(),previous={storageVersion:3,sha:'incorrect',
  monthlyIndex:{schemaVersion:3,count:0,months:[]},monthlyGroups:[],shardGroups:[]};
 assert.throws(()=>r.ctx.manualNewsCommitMonthly_({branch:'main',path:'daily-simulation/documents.json'},
  previous,{documents:[a],sync:{status:'success'}}),/其他工作更新/);
 assert.equal(r.patches(),0);
});
