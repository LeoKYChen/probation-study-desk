'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'daily-simulation');
const {validate,convert,read,MAX}=require('../scripts/build-monthly-questions.cjs');
require('../daily-simulation/model.js');require('../daily-simulation/question-storage.js');
const legacy=read(),index=JSON.parse(fs.readFileSync(path.join(base,'questions-monthly.json'),'utf8'));
function fetcher(mod={}){return async loc=>{
 const name=loc.replace(/^\.\//,'');
 if(Object.hasOwn(mod,name)){
  const content=mod[name];
  if(content===null)return {ok:false,status:404};
  const text=typeof content==='string'?content:JSON.stringify(content);
  return {ok:true,text:async()=>text,json:async()=>JSON.parse(text)};
 }
 const full=path.join(base,name);
 if(!fs.existsSync(full))return {ok:false,status:404};
 const text=fs.readFileSync(full,'utf8');
 return {ok:true,text:async()=>text,json:async()=>JSON.parse(text)};
};}
test('245 published question IDs, text, dates and human corrections survive five monthly shards',async()=>{
 assert.equal(index.schemaVersion,2);
 const verified=validate(index);
 assert.equal(verified.count,legacy.count);
 assert.equal(verified.months.reduce((n,m)=>n+m.count,0),legacy.count);
 const loaded=await QuestionStorage.load(fetcher());
 assert.equal(loaded.count,legacy.count);
 assert.equal(loaded.questions.length,legacy.questions.length);
 assert.equal(PracticeModel.dataset(loaded),loaded);
 const byId=new Map(loaded.questions.map(q=>[q.id,q]));
 for(const original of legacy.questions){
  assert(byId.has(original.id));
  assert.deepEqual(byId.get(original.id),original);
 }
 assert.deepEqual(loaded.templates,legacy.templates);
 assert.deepEqual(loaded.diagnostics,legacy.diagnostics);
});
test('monthly archive has exactly the expected dates and all shards are SHA-256 addressed under 900KB',()=>{
 assert.deepEqual(index.months.map(m=>[m.month,m.count]),[['2026-11',20],['2026-10',219],['2026-09',6]]);
 assert.equal(index.months.flatMap(m=>m.shards).length,5);
 for(const m of index.months)for(const shard of m.shards){
  const b=fs.readFileSync(path.join(base,shard.path));
  assert(b.length<=MAX&&b.length===shard.bytes);
  assert(shard.path.endsWith(crypto.createHash('sha256').update(b).digest('hex')+'.json'));
 }
 const recreated=convert(legacy).index;
 assert.deepEqual(recreated,index,'Monthly snapshot must derive deterministically from the published original');
});
test('selective old-month loading does not read other months and keeps original IDs',async()=>{
 const accessed=[];
 const load=await QuestionStorage.load(async name=>{accessed.push(name);return fetcher()(name);},{month:'2026-09'});
 assert.equal(load.count,6);
 assert(load.questions.every(q=>q.date.startsWith('2026-09')));
 const allowed=new Set(index.months.find(m=>m.month==='2026-09').shards.map(s=>'./'+s.path));
 assert(accessed.every(x=>x==='./questions-monthly.json'||allowed.has(x)));
});
test('legacy data remains readable when monthly manifest is genuinely absent',async()=>{
 const loaded=await QuestionStorage.load(fetcher({'questions-monthly.json':null}));
 assert.equal(loaded.schemaVersion,1);
 assert.equal(loaded.count,legacy.count);
});
test('missing or tampered monthly shard fails closed rather than dropping historical answers',async()=>{
 const shard=index.months.find(m=>m.month==='2026-09').shards[0].path;
 await assert.rejects(QuestionStorage.load(fetcher({[shard]:null})),/HTTP 404/);
 const raw=fs.readFileSync(path.join(base,shard),'utf8');
 await assert.rejects(QuestionStorage.load(fetcher({[shard]:raw+' '})),/校驗/);
});
test('corrupt manifest count and duplicate catalog IDs are rejected',async()=>{
 const a=structuredClone(index);a.count++;
 await assert.rejects(QuestionStorage.load(fetcher({'questions-monthly.json':a})),/索引/);
 const b=structuredClone(index);b.catalog[1].id=b.catalog[0].id;
 await assert.rejects(QuestionStorage.load(fetcher({'questions-monthly.json':b})),/目錄/);
});
test('JS integrity fallback works for insecure offline file browsing',()=>{
 assert.equal(QuestionStorage.fallbackSha256(new TextEncoder().encode('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('indexed monthly question shards preserve original storage/backup ID schema',()=>{
 const keys=['probation-daily-github:records:v1','daily-reading-test:saved','psd-daily-dataset-v1'];
 assert.equal(new Set(keys).size,3);
 const example={answer:'',review:false,updatedAt:new Date(0).toISOString()};
 const id=legacy.questions[0].id;
 assert.deepEqual(PracticeModel.records({[id]:example}),{[id]:example});
 const record=PracticeModel.backup({schemaVersion:1,format:'probation-daily-github-records',records:{[id]:example}});
 assert.equal(record[id].updatedAt,example.updatedAt);
});
