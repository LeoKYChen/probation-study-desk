'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {convert}=require('../scripts/build-monthly-news.cjs');
require('../daily-simulation/news-storage.js');
const article=(id,date,content='x')=>({id,title:id,date,modified:date+'T00:00:00Z',tags:['少年司法'],excerpt:content,content,
 url:'https://leokychen.github.io/probation-study-desk/daily-simulation/?document='+id});
const fakeFetch=(files,accessed)=>async rel=>{
 accessed.push(rel);
 const path=rel.replace(/^\.\//,'');
 if(!files.has(path))return {ok:false,status:404};
 const raw=files.get(path);
 return {ok:true,text:async()=>raw,json:async()=>JSON.parse(raw)};
};
test('migration preserves every published document ID and verifies monthly shard digests',async()=>{
 const original=[article('oct-a','2026-10-03'),article('sep-a','2026-09-04'),article('oct-b','2026-10-02'),article('sep-b','2026-09-01')];
 const {manifest,files}=convert({schemaVersion:1,documents:original,sync:{status:'success'}});
 assert.equal(manifest.schemaVersion,3);assert.equal(manifest.count,4);
 assert.deepEqual(manifest.months.map(x=>x.month),['2026-10','2026-09']);
 for(const [name,raw] of files){
  if(name.startsWith('news-shards/'))assert.equal(name,'news-shards/'+crypto.createHash('sha256').update(raw).digest('hex')+'.json');
 }
 const requested=[];
 const selected=await NewsStorage.load(fakeFetch(files,requested));
 assert.equal(selected.month,'2026-10');
 assert.deepEqual(selected.documents.map(d=>d.id).sort(),['oct-a','oct-b']);
 assert(!requested.includes('./archives/2026-09/index.json'));
 const earlier=await NewsStorage.loadMonth(fakeFetch(files,requested),manifest,'2026-09');
 assert.deepEqual(earlier.documents.map(d=>d.id).sort(),['sep-a','sep-b']);
 assert.deepEqual(new Set([...selected.documents,...earlier.documents].map(x=>x.id)),new Set(original.map(x=>x.id)));
});
test('migration rejects malformed duplicate IDs or unsound document dates',()=>{
 assert.throws(()=>convert({documents:[article('x','2026-10-01'),article('x','2026-09-01')]}),/Duplicate/);
 assert.throws(()=>convert({documents:[article('x','2026-99-01')]}),/Date invalid/);
});
