#!/usr/bin/env node
/* Plan/stage read-only migration from existing verified news shards to monthly archives.
 * --plan: validate + print counts; never mutate the repository.
 * --stage DIR: create an isolated monthly news snapshot in DIR, using exclusive writes.
 * Activation requires a separate reviewed change; the live documents.json is untouched.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'daily-simulation/documents.json');
const MAX=1000000;
const hex=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const validMonth=s=>/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(s);
const byDate=(a,b)=>b.date.localeCompare(a.date)||b.modified.localeCompare(a.modified)||a.id.localeCompare(b.id);
function loadNews(){
 const manifest=JSON.parse(fs.readFileSync(source,'utf8'));
 if(manifest.schemaVersion===1){
  assert(Array.isArray(manifest.documents),'Legacy news documents absent');
  return manifest;
 }
 assert(manifest.schemaVersion===2,'Only v1/v2 news may be migrated');
 assert(Array.isArray(manifest.shards)&&manifest.shards.length>0,'Missing source shards');
 const documents=[],paths=new Set(),ids=new Set();
 for(const part of manifest.shards){
  assert(part&&/^news-shards\/[a-f0-9]{64}\.json$/.test(part.path)&&!paths.has(part.path),'Unsafe or duplicate news shard path');
  paths.add(part.path);
  const raw=fs.readFileSync(path.join(root,'daily-simulation',part.path));
  assert.equal(hex(raw),part.path.slice('news-shards/'.length,-'.json'.length),'Source shard SHA-256 invalid');
  const shard=JSON.parse(raw.toString('utf8'));
  assert(shard.schemaVersion===1&&Array.isArray(shard.documents)&&shard.documents.length===part.count,'Source shard count incorrect');
  for(const d of shard.documents){
   assert(d&&typeof d.id==='string'&&d.id&&!ids.has(d.id),'Duplicate news ID');
   ids.add(d.id);documents.push(d);
  }
 }
 assert.equal(documents.length,manifest.count,'Source news count invalid');
 return {schemaVersion:1,sync:manifest.sync,documents};
}
function convert(sourceData){
 const groups=new Map(),ids=new Set();
 for(const d of sourceData.documents){
  assert(d&&typeof d.id==='string'&&d.id&&!ids.has(d.id),'Missing/duplicate news ID');
  ids.add(d.id);
  assert(typeof d.date==='string'&&validMonth(d.date.slice(0,7))&&d.date.length===10,'Date invalid');
  assert(typeof d.title==='string'&&typeof d.modified==='string'&&Array.isArray(d.tags),'Document metadata invalid');
  const month=d.date.slice(0,7);
  if(!groups.has(month))groups.set(month,[]);
  groups.get(month).push(d);
 }
 const months=[...groups.keys()].sort().reverse(),files=new Map(),entries=[],catalog=[];
 for(const month of months){
  const docs=groups.get(month).sort(byDate);
  let chunk=[],shards=[];
  function flush(){
   if(!chunk.length)return;
   const body=JSON.stringify({schemaVersion:1,documents:chunk});
   const key='news-shards/'+hex(Buffer.from(body,'utf8'))+'.json';
   files.set('news-shards/'+key.split('/').pop(),body);
   shards.push({path:key,count:chunk.length});
   chunk=[];
  }
  for(const d of docs){
   const single=JSON.stringify({schemaVersion:1,documents:[d]});
   assert(Buffer.byteLength(single,'utf8')<=MAX,'Single article exceeds 1MB: '+d.id);
   if(chunk.length&&Buffer.byteLength(JSON.stringify({schemaVersion:1,documents:chunk.concat([d])}),'utf8')>MAX)flush();
   chunk.push(d);
   catalog.push({id:d.id,month,date:d.date,title:d.title,tags:d.tags,excerpt:d.excerpt||'',url:d.url});
  }
  flush();
  const monthly={schemaVersion:1,month,count:docs.length,shards};
  const indexPath='archives/'+month+'/index.json';
  files.set(indexPath,JSON.stringify(monthly,null,2)+'\n');
  entries.push({month,status:month===months[0]?'open':'archived',count:docs.length,index:indexPath});
 }
 const manifest={schemaVersion:3,count:sourceData.documents.length,activeMonth:months[0],
   sync:sourceData.sync,months:entries,catalog};
 assert.equal(catalog.length,sourceData.documents.length);
 assert.equal(entries.reduce((n,m)=>n+m.count,0),manifest.count);
 files.set('documents.json',JSON.stringify(manifest,null,2)+'\n');
 return {manifest,files};
}
function main(args){
 assert(args.length===0||args[0]==='--plan'||args[0]==='--stage','Usage: node scripts/build-monthly-news.cjs [--plan|--stage DIR]');
 const stage=args[0]==='--stage'?args[1]:null;
 if(args[0]==='--stage')assert(stage&&args.length===2,'--stage needs a destination directory');
 const result=convert(loadNews());
 const shardCount=[...result.files.keys()].filter(p=>p.startsWith('news-shards/')).length;
 const size=[...result.files.values()].reduce((n,x)=>n+Buffer.byteLength(x,'utf8'),0);
 console.log('Verified monthly archive plan:',result.manifest.count,'articles,',result.manifest.months.length,'months,',shardCount,'shards,',size,'UTF-8 bytes');
 for(const m of result.manifest.months)console.log(m.month,m.status,m.count);
 if(stage){
  const folder=path.resolve(stage);
  assert(!folder.startsWith(root+path.sep)&&folder!==root,'Staging must not be inside repository');
  assert(!fs.existsSync(folder),'Staging directory must not already exist');
  fs.mkdirSync(folder,{recursive:true});
  for(const [filename,contents] of result.files){
   const destination=path.join(folder,'daily-simulation',filename);
   fs.mkdirSync(path.dirname(destination),{recursive:true});
   fs.writeFileSync(destination,contents,{flag:'wx'});
  }
  console.log('Created isolated news-only snapshot:',folder);
  console.log('NOT activated. Missing questions.json/offline bridge by design.');
 }
 return result;
}
if(require.main===module)main(process.argv.slice(2));
module.exports={loadNews,convert,main};
