#!/usr/bin/env node
'use strict';
/*
 * Deterministic, read-only-by-default monthly question migration.
 * --plan: no writes
 * --stage ABSOLUTE_DIRECTORY: isolated snapshot, never touches deployed files
 * --check: validate deployed monthly assets against immutable legacy ID baseline
 * --write: write monthly files to repo (only as an explicitly reviewed migration)
 * All shards are UTF-8 content-addressed and limited to 900,000 bytes.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const MAX=900000;
const legacy='daily-simulation/questions.json',manifestPath='daily-simulation/questions-monthly.json';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const monthPattern=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
const bytes=s=>Buffer.byteLength(s,'utf8');
const read=()=>JSON.parse(fs.readFileSync(path.join(ROOT,legacy),'utf8'));
function convert(original){
 assert.equal(original.schemaVersion,1);
 assert(Array.isArray(original.questions)&&original.questions.length>=125);
 assert.equal(original.count,original.questions.length);
 const groups=new Map(),ids=new Set(),catalog=[];
 for(const q of original.questions){
  assert(q&&typeof q.id==='string'&&q.id&&!ids.has(q.id),'Missing or duplicate question ID');
  assert(typeof q.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(q.date)&&monthPattern.test(q.date.slice(0,7)),'Invalid question date');
  ids.add(q.id);const month=q.date.slice(0,7);
  if(!groups.has(month))groups.set(month,[]);
  groups.get(month).push(q);
  catalog.push({id:q.id,month,date:q.date,subject:q.subject,title:String(q.question).replace(/\s+/g,' ').slice(0,110)});
 }
 const files=new Map(),months=[...groups.keys()].sort().reverse(),entries=[];
 function shard(month,chunk,list){
  const text=JSON.stringify({schemaVersion:1,questions:chunk}),length=bytes(text);
  assert(length<=MAX,'Monthly shard exceeds 900000 bytes');
  const name='question-shards/'+digest(text)+'.json';
  const filename='daily-simulation/'+name;
  if(files.has(filename))throw Error('Duplicate shard hash');
  files.set(filename,text);
  list.push({path:name,count:chunk.length,bytes:length});
 }
 for(const month of months){
  const list=[],source=groups.get(month);let chunk=[];
  for(const q of source){
   assert(bytes(JSON.stringify({schemaVersion:1,questions:[q]}))<=MAX,'One question exceeds shard limit: '+q.id);
   if(chunk.length&&bytes(JSON.stringify({schemaVersion:1,questions:chunk.concat(q)}))>MAX){shard(month,chunk,list);chunk=[];}
   chunk.push(q);
  }
  if(chunk.length)shard(month,chunk,list);
  entries.push({month,count:source.length,shards:list,status:month===months[0]?'current':'archived'});
 }
 const index={schemaVersion:2,count:original.count,updatedAt:original.updatedAt,activeMonth:months[0],months:entries,catalog,
  templates:original.templates||[],diagnostics:original.diagnostics||[]};
 files.set(manifestPath,JSON.stringify(index,null,2)+'\n');
 return {index,files};
}
function validate(index,root=ROOT){
 assert(index.schemaVersion===2&&Array.isArray(index.months)&&index.months.length&&Array.isArray(index.catalog));
 assert(index.count===index.catalog.length&&monthPattern.test(index.activeMonth));
 const ids=new Set(),months=new Set(),paths=new Set(),questions=[];
 for(const m of index.months){
  assert(monthPattern.test(m.month)&&!months.has(m.month),'Invalid/duplicate month');
  months.add(m.month);let n=0;
  assert(Array.isArray(m.shards)&&m.shards.length);
  for(const part of m.shards){
   assert(/^question-shards\/[a-f0-9]{64}\.json$/.test(part.path)&&!paths.has(part.path),'Invalid/duplicate shard');
   paths.add(part.path);
   const buf=fs.readFileSync(path.join(root,'daily-simulation',part.path));
   assert(buf.length<=MAX&&digest(buf)===part.path.slice('question-shards/'.length,-'.json'.length),'Shard SHA-256 mismatch');
   const data=JSON.parse(buf.toString('utf8'));
   assert(data.schemaVersion===1&&Array.isArray(data.questions)&&data.questions.length===part.count,'Bad shard item count');
   for(const q of data.questions){
    assert(q&&typeof q.id==='string'&&!ids.has(q.id)&&q.date.slice(0,7)===m.month,'Duplicate question or wrong month');
    ids.add(q.id);questions.push(q);n++;
   }
  }
  assert.equal(n,m.count,'Wrong monthly question count');
 }
 assert(months.has(index.activeMonth)&&index.count===questions.length,'Wrong overall count');
 const catIds=new Set(index.catalog.map(c=>c.id));
 assert(catIds.size===ids.size&&[...ids].every(id=>catIds.has(id)),'Catalog/ID mismatch');
 const old=read();
 for(const q of old.questions)assert(ids.has(q.id),'A published legacy ID was lost: '+q.id);
 return {count:questions.length,months:index.months.map(m=>({month:m.month,count:m.count,shards:m.shards.length}))};
}
function main(args=process.argv.slice(2)){
 const mode=args[0]||'--plan',result=convert(read());
 assert(['--plan','--stage','--check','--write'].includes(mode),'Unknown mode');
 if(mode==='--stage'){
  assert(args.length===2&&path.isAbsolute(args[1]),'Usage: --stage ABSOLUTE_DIRECTORY');
  const to=path.resolve(args[1]);
  assert(!to.startsWith(ROOT+path.sep)&&to!==ROOT&&!fs.existsSync(to),'Stage must be new and outside repository');
  for(const [name,content] of result.files){
   const filename=path.join(to,name);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content,{flag:'wx'});
  }
  console.log('Isolated stage created:',to);
 }else if(mode==='--write'){
  for(const [name,content] of result.files){
   const filename=path.join(ROOT,name);fs.mkdirSync(path.dirname(filename),{recursive:true});
   if(fs.existsSync(filename)&&fs.readFileSync(filename,'utf8')!==content)throw Error('Refuse to overwrite existing archive: '+name);
   if(!fs.existsSync(filename))fs.writeFileSync(filename,content,{flag:'wx'});
  }
 }else if(mode==='--check'){
  const saved=JSON.parse(fs.readFileSync(path.join(ROOT,manifestPath),'utf8'));
  const verified=validate(saved);
  console.log('PASS verified monthly question archive:',JSON.stringify(verified));
  return verified;
 }
 const stats=result.index.months.map(m=>m.month+': '+m.count+' questions, '+m.shards.length+' shards');
 console.log('Monthly question migration plan:',result.index.count,'questions;',stats.join('; '));
 return result;
}
if(require.main===module)main();
module.exports={convert,validate,read,main,MAX};
