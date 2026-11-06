'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {convert,loadNews,main}=require('../scripts/build-monthly-news.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
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
 assert.throws(()=>convert({documents:[article('x','2026-10-01'),article('x','2026-09-01')]}),/duplicate/i);
 assert.throws(()=>convert({documents:[article('x','2026-99-01')]}),/Date invalid/);
});

test('real verified archive can be staged without touching published v2 index or losing IDs',()=>{
 const root=path.resolve(__dirname,'..'),live=path.join(root,'daily-simulation/documents.json');
 const before=fs.readFileSync(live),source=loadNews();
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'psd-monthly-stage-'));
 try {
  const stage=path.join(parent,'snapshot');
  const result=main(['--stage',stage]);
  assert.equal(result.manifest.count,source.documents.length);
  assert.deepEqual(fs.readFileSync(live),before,'live v2 index must not change');
  const stagedIndex=JSON.parse(fs.readFileSync(path.join(stage,'daily-simulation/documents.json'),'utf8'));
  assert.equal(stagedIndex.schemaVersion,3);
  const originalIds=new Set(source.documents.map(d=>d.id)),archivedIds=new Set();
  for(const month of stagedIndex.months){
   const m=JSON.parse(fs.readFileSync(path.join(stage,'daily-simulation',month.index),'utf8'));
   let count=0;
   for(const shard of m.shards){
    const raw=fs.readFileSync(path.join(stage,'daily-simulation',shard.path));
    assert.equal('news-shards/'+crypto.createHash('sha256').update(raw).digest('hex')+'.json',shard.path);
    const contents=JSON.parse(raw.toString('utf8'));
    count+=contents.documents.length;
    for(const d of contents.documents){
     assert.equal(d.date.slice(0,7),month.month);
     assert(!archivedIds.has(d.id));archivedIds.add(d.id);
    }
   }
   assert.equal(count,month.count);
  }
  assert.deepEqual(archivedIds,originalIds);
 } finally {fs.rmSync(parent,{recursive:true,force:true});}
});
