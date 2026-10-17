#!/usr/bin/env node
// Offline deliverable with no dynamic imports, no HTTP, and no file:// fetch().
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'portable-dist');
function read(file){return fs.readFileSync(path.join(ROOT,file),'utf8');}
function globalAfter(files){
 const sandbox={window:{}};
 vm.createContext(sandbox);
 for(const file of files)vm.runInContext(read(file),sandbox,{filename:file,timeout:20000});
 return sandbox.window;
}
const questionSource=globalAfter(['v2.5/questions.js','v2.5/related-questions.js']);
const past=[...(questionSource.QUESTION_BANK||[]),...(questionSource.RELATED_QUESTION_BANK||[])];
assert.equal(past.length,426,'Do not ship a truncated 426-question set');
const dailySource=JSON.parse(read('daily-simulation/questions.json'));
assert.equal(dailySource.questions?.length,125,'Do not ship a truncated 125 daily-simulation set');
const essaySource=globalAfter(['common-subjects/essay-questions-v1.js','common-subjects/essay-questions-v2.js','common-subjects/essay-questions-v3.js']);
assert.equal(essaySource.PSD_ESSAY_QUESTIONS?.length,120,'Do not ship a truncated 120-question adapted essay set');
const printModel=globalAfter(['print/print-model.js']).PSDEssayPrint;
assert.equal(printModel.OLD.length,12,'Original essay topics must be preserved');
const weekly=JSON.parse(read('juvenile-news/issues.json')).issues;
assert(Array.isArray(weekly)&&weekly.length>0,'No juvenile weekly topics');
const a=[];
for(const q of past){
 assert(q.id&&q.body, 'Missing original exam question');
 a.push({id:q.id,title:q.title||q.id,year:q.year,subject:q.subject||'待分類',
 body:q.body,reference:Array.isArray(q.points)?q.points.join('\n'):''});
}
const d=dailySource.questions.map(q=>{
 assert(q.id&&q.question,'Missing daily-simulation question id or stem');
 return {id:q.id,title:(q.date||'')+'｜'+q.subject+'｜'+q.id,date:q.date||'',subject:q.subject||'每日模擬',body:q.question,reference:q.issues||''};
});
const essays=[
 ...printModel.OLD.map(([title,body],i)=>({id:'orig-'+i,title,subject:'國文作文',body,
   category:'原創作文題',reference:'請依題意自行練習；此為原創題目，非國考官方原卷。'})),
 ...essaySource.PSD_ESSAY_QUESTIONS.map(q=>({id:q.id,title:q.title,subject:'國文作文',body:q.body,
   category:'改編作文題',reference:q.requirements||''}))
];
const news=weekly.map(q=>({
 id:q.id,title:q.title||q.date,date:q.date||'',subject:'少年司法週報',
 body:[q.note,q.trend,q.originalMarkdown,
 ...(q.items||[]).map(x=>[x.title,x.summary,x.analysis,x.practicalNote].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n'),
 reference:'週報為離線歷史版本；若要查證來源與最新動態，請恢復網路到正式站查看。'
}));
const database={schemaVersion:1,source:'LeoKYChen/probation-study-desk published sources',sourceCommit:process.env.GITHUB_SHA||'local-test',
past:a,daily:d,essays,news};
for(const kind of ['past','daily','essays','news']){
 const seen=new Set;
 for(const q of database[kind]){
  assert(typeof q.body==='string'&&q.body.length>10,'Empty offline stem '+q.id);
  assert(!seen.has(q.id),'Duplicate offline id: '+q.id);seen.add(q.id);
 }
}
const safeJson=JSON.stringify(database).replace(/</g,'\\u003c');
let template=read('portable/study-shell.html');
const source=read('portable/study-app.js').replace(/<\\/script/gi,'<\\\\/script');
assert(template.includes('__EMBEDDED_DATA__')&&template.includes('__EMBEDDED_APP__'));
template=template.replace('__EMBEDDED_DATA__',safeJson).replace('__EMBEDDED_APP__',source);
assert(!/__EMBEDDED_(?:DATA|APP)__/.test(template));
assert(!/<script[^>]+src=/i.test(template),'Portable HTML may not fetch external scripts');
assert(!/<link[^>]+href=(?:"|')http/i.test(template),'Portable HTML may not use CDN');
assert(!/serviceWorker/.test(source),'Portable HTML must not register a service worker');
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,'index.html'),template,'utf8');
fs.writeFileSync(path.join(OUT,'README.txt'),read('portable/README.txt'),'utf8');
fs.copyFileSync(path.join(ROOT,'LICENSE'),path.join(OUT,'LICENSE'));
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({
 schemaVersion:1,sourceCommit:database.sourceCommit,count:{past:a.length,daily:d.length,essays:essays.length,news:news.length},
 files:['index.html','README.txt','LICENSE','manifest.json']
},null,2),'utf8');
console.log('PASS portable built: '+JSON.stringify({past:a.length,daily:d.length,essays:essays.length,news:news.length,htmlBytes:Buffer.byteLength(template)}));
