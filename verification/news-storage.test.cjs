'use strict';
const assert=require('node:assert/strict');const test=require('node:test');const crypto=require('node:crypto');require('../daily-simulation/news-storage.js');
function fetcher(files){return async path=>Object.hasOwn(files,path)?{ok:true,json:async()=>files[path],text:async()=>JSON.stringify(files[path])}:{ok:false,status:404};}
const records=[{id:'original-id',title:'內容'}];const shard={schemaVersion:1,documents:records};const file='news-shards/'+crypto.createHash('sha256').update(JSON.stringify(shard)).digest('hex')+'.json';
test('existing single file is readable',async()=>assert.deepEqual((await NewsStorage.load(fetcher({'./documents.json':{schemaVersion:1,documents:records}}))).documents,records));
test('sharded archive preserves original IDs and metadata',async()=>{const files={'./documents.json':{schemaVersion:2,count:1,sync:{status:'success'},shards:[{path:file,count:1}]},['./'+file]:shard};assert.deepEqual((await NewsStorage.load(fetcher(files))).documents,records)});
test('missing shard rejects the whole archive',async()=>await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:1,shards:[{path:file,count:1}]}}))));
test('duplicate IDs reject the archive',async()=>{const dup={schemaVersion:1,documents:[records[0],records[0]]},p='news-shards/'+crypto.createHash('sha256').update(JSON.stringify(dup)).digest('hex')+'.json';await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:2,shards:[{path:p,count:2}]},['./'+p]:dup})));});
test('untrusted shard paths rejected',async()=>await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:1,shards:[{path:'https://evil.example/data.json',count:1}]}}))));

const article=(id,month)=>({id,title:'文章 '+id,content:'內文',date:month+'-02',modified:month+'-02T10:00:00Z',tags:[],
 url:'https://leokychen.github.io/probation-study-desk/daily-simulation/?document='+id});
function monthlyFixture(){
 const a=article('news-september','2026-09'),b=article('news-october','2026-10');
 const shardA={schemaVersion:1,documents:[a]},shardB={schemaVersion:1,documents:[b]};
 const name=v=>'news-shards/'+crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')+'.json';
 const index={schemaVersion:3,count:2,activeMonth:'2026-10',sync:{status:'success'},
  months:[{month:'2026-10',status:'open',count:1,index:'archives/2026-10/index.json'},
   {month:'2026-09',status:'archived',count:1,index:'archives/2026-09/index.json'}],
  catalog:[a,b].map(d=>({id:d.id,month:d.date.slice(0,7),date:d.date,title:d.title,tags:d.tags}))};
 const files={
  './documents.json':index,
  './archives/2026-09/index.json':{schemaVersion:1,month:'2026-09',count:1,shards:[{path:name(shardA),count:1}]},
  './archives/2026-10/index.json':{schemaVersion:1,month:'2026-10',count:1,shards:[{path:name(shardB),count:1}]},
  ['./'+name(shardA)]:shardA,['./'+name(shardB)]:shardB
 };
 return {files,index,a,b};
}
test('monthly manifest loads only active month and preserves global document metadata',async()=>{
 const {files,a,b}=monthlyFixture(),requested=[];
 const loaded=await NewsStorage.load(async path=>{requested.push(path);return fetcher(files)(path)});
 assert.equal(loaded.month,'2026-10');assert.equal(loaded.totalCount,2);
 assert.deepEqual(loaded.documents,[b]);assert.equal(loaded.catalog.find(x=>x.id===a.id).month,'2026-09');
 assert(!requested.some(path=>path.includes('/2026-09/')||path.includes('news-shards/')&&path!=='./'+files['./archives/2026-10/index.json'].shards[0].path));
});
test('monthly switching loads archived shard by month without altering ID',async()=>{
 const {files,a,index}=monthlyFixture();
 const loaded=await NewsStorage.loadMonth(fetcher(files),index,'2026-09');
 assert.equal(loaded.documents.length,1);assert.equal(loaded.documents[0].id,a.id);
});
test('unsafe monthly index path and mismatched catalog are rejected',async()=>{
 const {files,index}=monthlyFixture();
 index.months[0].index='../../secrets';
 await assert.rejects(NewsStorage.load(fetcher(files)),/月份索引/);
 index.months[0].index='archives/2026-10/index.json';
 index.catalog[0].id=index.catalog[1].id;
 await assert.rejects(NewsStorage.load(fetcher(files)),/新聞目錄/);
});
test('monthly archive refuses corrupt or incomplete shards',async()=>{
 const {files,index}=monthlyFixture();const ref=files['./archives/2026-09/index.json'].shards[0].path;
 files['./'+ref]={schemaVersion:1,documents:[{id:'tampered',content:'changed'}]};
 await assert.rejects(NewsStorage.loadMonth(fetcher(files),index,'2026-09'),/校驗/);
});
