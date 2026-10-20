#!/usr/bin/env node
/* Juvenile weekly: one canonical JSON, two deterministic mirrors. No other site data touched. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const CANONICAL='juvenile-news/issues.json';
const PUBLIC='juvenile-news/source/public/issues.json';
const OFFLINE='file-data/weekly.generated.js';
const categories=new Set(['少年司法制度','修復式司法','少年毒品處遇','CRC與國際規範']);
const statuses=new Set(['draft','reviewed','published']);
const idPattern=/^[a-z0-9][a-z0-9_-]{0,120}$/;
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const requiredArticle=['title','category','type','author','sourceTitle','summary','significance','followUp','limitation','legalNature','readingScope'];
function date(value,label,nullable=false){
 if(nullable&&value===null)return;
 assert(typeof value==='string'&&dayPattern.test(value),label+': expected ISO date');
 const t=new Date(value);
 assert(!Number.isNaN(t.valueOf())&&t.toISOString().slice(0,10)===value,label+': invalid date');
}
function validate(data){
 assert(data&&typeof data==='object'&&!Array.isArray(data)&&Array.isArray(data.issues),'issues must be an array');
 assert(data.issues.length>0,'weekly archive cannot be empty');
 const ids=new Set(),days=new Set();let previous='9999-99-99',total=0;
 for(const issue of data.issues){
  assert(issue&&typeof issue==='object','issue must be an object');
  assert(typeof issue.id==='string'&&idPattern.test(issue.id),'invalid issue id');
  assert(!ids.has(issue.id),'duplicate issue id: '+issue.id);ids.add(issue.id);
  date(issue.date,issue.id+'.date');
  date(issue.periodStart,issue.id+'.periodStart');
  date(issue.periodEnd,issue.id+'.periodEnd');
  assert(issue.periodStart<=issue.periodEnd,'inverted period: '+issue.id);
  assert(issue.date<=previous,'issues must be sorted newest first');previous=issue.date;
  assert(!days.has(issue.date),'duplicate issue date: '+issue.date);days.add(issue.date);
  assert(typeof issue.title==='string'&&issue.title.trim(),'missing title: '+issue.id);
  assert(statuses.has(issue.status),'invalid review status: '+issue.id);
  for(const field of ['sourceConversation','note','trend','originalMarkdown'])
   assert(typeof issue[field]==='string',issue.id+': '+field+' must be text');
  assert(Array.isArray(issue.items)&&issue.items.length<=30,issue.id+': invalid item list');
  const localIds=new Set();
  for(const a of issue.items){
   assert(a&&typeof a==='object'&&idPattern.test(a.id||''),'invalid article id in '+issue.id);
   assert(!localIds.has(a.id),'duplicate article within '+issue.id+': '+a.id);localIds.add(a.id);
   for(const field of requiredArticle)
    assert(typeof a[field]==='string'&&a[field].trim(),issue.id+'/'+a.id+': missing '+field);
   assert(categories.has(a.category),'invalid category '+issue.id+'/'+a.id);
   assert(Array.isArray(a.tags)&&a.tags.every(tag=>typeof tag==='string'),'invalid tags');
   assert(typeof a.dateNote==='string','invalid dateNote');
   assert(typeof a.isBackground==='boolean','invalid isBackground');
   date(a.publishedDate,a.id+'.publishedDate',true);
   date(a.eventDate,a.id+'.eventDate',true);
   date(a.checkedAt,a.id+'.checkedAt',true);
   const unverified=a.sourceStatus==='unverified';
   assert(a.sourceStatus===undefined||a.sourceStatus===null||unverified,'invalid sourceStatus');
   assert(a.url===null||typeof a.url==='string'&&/^https?:\/\/\S+$/i.test(a.url),'invalid source URL');
   if(!unverified){
    assert(a.url!==null,'verified article missing source URL: '+a.id);
    assert(a.checkedAt!==null,'verified article missing check date: '+a.id);
   }
   if(issue.status==='published')assert(!unverified,'published issue contains unverified article: '+a.id);
   total++;
  }
 }
 return {issues:data.issues.length,articles:total,latest:data.issues[0].date};
}
function artifacts(canonicalText){
 const doc=JSON.parse(canonicalText);
 const summary=validate(doc);
 const blob=JSON.stringify({[CANONICAL]:doc}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const js='/* GENERATED from committed JSON; do not hand-edit. */\n'+
  '(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+blob+');})();\n';
 return {summary,outputs:{[PUBLIC]:canonicalText,[OFFLINE]:js}};
}
function guardHistory(oldData,currentData){
 const old=validate(oldData),now=validate(currentData);
 const newIds=new Set(currentData.issues.map(i=>i.id));
 const removed=oldData.issues.map(i=>i.id).filter(id=>!newIds.has(id));
 assert(removed.length===0,'historical issue removal blocked: '+removed.join(', '));
 return {before:old.issues,after:now.issues};
}
function run(argv=process.argv.slice(2)){
 const mode=argv.includes('--write')?'write':'check';
 assert(!argv.includes('--write')||!argv.includes('--check'),'choose --write OR --check');
 const baseIndex=argv.indexOf('--base');
 const base=baseIndex===-1?null:argv[baseIndex+1];
 if(baseIndex!==-1)assert(base&&!base.startsWith('--'),'--base requires a Git ref');
 const original=fs.readFileSync(path.join(ROOT,CANONICAL),'utf8');
 const {outputs,summary}=artifacts(original);
 if(base){
  const prior=cp.execFileSync('git',['show',base+':'+CANONICAL],{cwd:ROOT,encoding:'utf8'});
  guardHistory(JSON.parse(prior),JSON.parse(original));
 }
 for(const [relative,content] of Object.entries(outputs)){
  const file=path.join(ROOT,relative);
  if(mode==='write'){
   fs.mkdirSync(path.dirname(file),{recursive:true});
   const temp=file+'.tmp-'+process.pid;
   try{fs.writeFileSync(temp,content,'utf8');fs.renameSync(temp,file);}
   finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  assert(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===content,
   'Out-of-sync weekly mirror: '+relative+'; run node scripts/weekly-sync.cjs --write');
 }
 console.log('PASS weekly '+mode+': '+summary.issues+' issues, '+summary.articles+' articles, newest '+summary.latest+'; canonical JSON, source/public and offline ZIP agree');
}
if(require.main===module){
 try{run();}catch(err){console.error('FAIL weekly sync: '+err.message);process.exitCode=1;}
}
module.exports={validate,artifacts,guardHistory,run};
