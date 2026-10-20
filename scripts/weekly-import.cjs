#!/usr/bin/env node
/* Import one reviewed weekly issue without rewriting existing history. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validate,artifacts,guardHistory} = require('./weekly-sync.cjs');

const ROOT=path.resolve(__dirname,'..');
const CANONICAL=path.join(ROOT,'juvenile-news/issues.json');

function parseInput(raw) {
 const data=typeof raw==='string'?JSON.parse(raw):raw;
 assert(data&&typeof data==='object'&&!Array.isArray(data),'Import input must be a JSON object');
 let issue;
 if(Object.hasOwn(data,'issue')) {
  assert.deepEqual(Object.keys(data),['issue'],'Single-issue wrapper may contain only "issue"');
  issue=data.issue;
 } else if(Object.hasOwn(data,'issues')) {
  assert.deepEqual(Object.keys(data),['issues'],'Archive wrapper may contain only "issues"');
  assert(Array.isArray(data.issues)&&data.issues.length===1,'Importer accepts exactly one issue, not an archive');
  issue=data.issues[0];
 } else {
  issue=data;
 }
 // Reuse the same validation rules as the live website.
 validate({issues:[issue]});
 return issue;
}

function canonicalEqual(a,b) {
 // Ignore cosmetic JSON formatting, never ignore actual metadata changes.
 return JSON.stringify(a)===JSON.stringify(b);
}

function merge(current,input) {
 validate(current);
 const issue=parseInput(input);
 const byId=current.issues.find(x=>x.id===issue.id);
 const byDate=current.issues.find(x=>x.date===issue.date);
 if(byId||byDate) {
  assert(byId&&byDate&&byId===byDate,
   'Issue ID or date already belongs to another issue: '+issue.id+' ('+issue.date+')');
  assert(canonicalEqual(byId,issue),
   'Existing issue differs from incoming data; manual review required, no overwrite: '+issue.id);
  return {data:current,change:false,issue,reason:'already imported'};
 }
 // Existing data may historically repeat article IDs; new imports must not add a collision.
 const previousArticleIds=new Set(current.issues.flatMap(x=>x.items.map(a=>a.id)));
 for(const article of issue.items) {
  assert(!previousArticleIds.has(article.id),'Article ID already exists: '+article.id);
 }
 const out={...current,issues:[...current.issues,issue].sort((a,b)=>b.date.localeCompare(a.date))};
 validate(out);
 guardHistory(current,out);
 for(const prev of current.issues) {
  const saved=out.issues.find(x=>x.id===prev.id);
  assert(saved&&canonicalEqual(saved,prev),'Historical issue was modified: '+prev.id);
 }
 return {data:out,change:true,issue,reason:'new issue'};
}

function calculate(currentText,inputText) {
 const current=JSON.parse(currentText);
 const result=merge(current,inputText);
 const canonical=JSON.stringify(result.data,null,2)+'\n';
 const {outputs,summary}=artifacts(canonical);
 return {...result,summary,files:{
  'juvenile-news/issues.json':canonical,
  ...outputs
 }};
}
function safeWrite(relative,content){
 const target=path.join(ROOT,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 const temp=target+'.tmp-'+process.pid;
 try{
  fs.writeFileSync(temp,content,'utf8');
  fs.renameSync(temp,target);
 }finally{
  if(fs.existsSync(temp))fs.unlinkSync(temp);
 }
}
function run(args=process.argv.slice(2)){
 let input=null,mode='check',expectedDate=null;
 for(let i=0;i<args.length;i++){
  const x=args[i];
  if(x==='--input'){input=args[++i];assert(input&&!input.startsWith('--'),'--input needs a JSON file');}
  else if(x==='--date'){expectedDate=args[++i];assert(expectedDate,'--date requires YYYY-MM-DD');}
  else if(x==='--write'){mode='write';}
  else if(x==='--check'){mode='check';}
  else throw Error('Unexpected argument: '+x);
 }
 assert(input,'Usage: node scripts/weekly-import.cjs --input path/to/issue.json [--date YYYY-MM-DD] [--check|--write]');
 const original=fs.readFileSync(CANONICAL,'utf8');
 const incoming=fs.readFileSync(path.resolve(input),'utf8');
 const result=calculate(original,incoming);
 if(expectedDate)assert(result.issue.date===expectedDate,
  'Incoming issue date does not match requested date: '+result.issue.date+' != '+expectedDate);
 if(mode==='write'&&result.change){
  for(const [file,content] of Object.entries(result.files))safeWrite(file,content);
 }
 if(mode==='write'&&!result.change) {
  // An idempotent replay must never write a new commit or replace old data.
  console.log('SKIP import: exact issue ID/date and contents already exist: '+result.issue.id);
 } else {
  console.log('PASS import '+mode+': '+result.issue.date+' / '+result.issue.id
   +'; change='+result.change+'; issues='+result.summary.issues+'; articles='+result.summary.articles);
 }
 return result;
}
if(require.main===module){
 try{run();}catch(err){console.error('FAIL weekly import: '+err.message);process.exitCode=1;}
}
module.exports={parseInput,merge,calculate,run};
