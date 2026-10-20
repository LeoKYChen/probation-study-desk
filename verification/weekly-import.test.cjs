#!/usr/bin/env node
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseInput,merge,calculate}=require('../scripts/weekly-import.cjs');
const {validate}=require('../scripts/weekly-sync.cjs');

function article(id){
 return {id,title:'示範：'+id,category:'少年司法制度',tags:['測試'],type:'研究',
  publishedDate:'2026-10-19',eventDate:null,dateNote:'已核日期',author:'作者',
  sourceTitle:'Official report',url:'https://example.org/'+id,sourceStatus:'verified',
  summary:'摘要',significance:'制度意義',followUp:'問題',limitation:'資料限制',
  legalNature:'研究報告',checkedAt:'2026-10-20',readingScope:'公開摘要',isBackground:false};
}
function issue(id,date){
 return {id,date,periodStart:date,periodEnd:date,title:'第'+date+'期',
  sourceConversation:'fixture',status:'reviewed',note:'',trend:'',originalMarkdown:'# 原始週報\n',
  items:[article('article-'+date)]};
}
function archive(){return {issues:[issue('weekly-2026-10-18','2026-10-18'),issue('weekly-2026-10-11','2026-10-11')]};}
const newer=()=>issue('weekly-2026-10-25','2026-10-25');

test('accepts single issue wrapper, one-item issues wrapper, and direct issue',()=>{
 const it=newer();
 for(const data of [{issue:it},{issues:[it]},it]){
  assert.deepEqual(parseInput(JSON.stringify(data)),it);
 }
});
test('rejects bulk archive, unknown wrapping fields, and missing required issue fields',()=>{
 assert.throws(()=>parseInput({issues:[newer(),newer()]}),/exactly one issue/);
 assert.throws(()=>parseInput({issue:newer(),issues:[newer()]}),/may contain only/);
 assert.throws(()=>parseInput({issue:{id:'bad'}}));
});
test('new issue is added without modifying any earlier issue',()=>{
 const history=archive(),snapshot=JSON.stringify(history.issues);
 const imported=merge(history,{issue:newer()});
 assert.equal(imported.change,true);
 assert.equal(imported.data.issues.length,3);
 assert.equal(imported.data.issues[0].date,'2026-10-25');
 assert.equal(JSON.stringify(imported.data.issues.slice(1)),snapshot);
 assert.equal(validate(imported.data).issues,3);
});
test('missing backfill can be inserted between two existing dates',()=>{
 const incoming=issue('weekly-2026-10-14','2026-10-14');
 assert.deepEqual(merge(archive(),{issue:incoming}).data.issues.map(x=>x.date),
  ['2026-10-18','2026-10-14','2026-10-11']);
});
test('unchanged re-import is idempotent',()=>{
 const history=archive();
 const out=merge(history,{issue:history.issues[0]});
 assert.equal(out.change,false);
 assert.strictEqual(out.data,history);
});
test('a conflicting revision must never silently overwrite a published historical issue',()=>{
 const current=archive(),incoming=structuredClone(current.issues[0]);
 incoming.title='修改後的標題';
 assert.throws(()=>merge(current,{issue:incoming}),/no overwrite/);
});
test('duplicate date or duplicate ID with different identity is blocked',()=>{
 const current=archive();
 assert.throws(()=>merge(current,{issue:issue('different-id','2026-10-18')}),/already belongs/);
 assert.throws(()=>merge(current,{issue:issue('weekly-2026-10-18','2026-10-14')}),/already belongs/);
});
test('new issue cannot reuse an existing article ID',()=>{
 const current=archive(),incoming=newer();
 incoming.items[0].id=current.issues[0].items[0].id;
 assert.throws(()=>merge(current,{issue:incoming}),/Article ID already exists/);
});
test('invalid source verification is rejected by the shared validator',()=>{
 const incoming=newer();
 incoming.items[0].checkedAt=null;
 assert.throws(()=>merge(archive(),{issue:incoming}),/missing check date/);
});
test('import preview generates canonical JSON and both site/offline mirrors',()=>{
 const before=JSON.stringify(archive(),null,2)+'\n';
 const out=calculate(before,JSON.stringify({issue:newer()}));
 assert.equal(out.summary.issues,3);
 assert.equal(out.summary.articles,3);
 assert.equal(out.files['juvenile-news/issues.json'],
  out.files['juvenile-news/source/public/issues.json']);
 assert.match(out.files['file-data/weekly.generated.js'],/weekly-2026-10-25/);
 assert.equal(JSON.parse(out.files['juvenile-news/issues.json']).issues[2].date,'2026-10-11');
});
test('real published 2026-10-18 archive remains exactly unchanged on reimport',()=>{
 const raw=fs.readFileSync(path.join(__dirname,'../juvenile-news/issues.json'),'utf8');
 const current=JSON.parse(raw),existing=current.issues.find(x=>x.date==='2026-10-18');
 assert(existing,'2026-10-18 must remain in archive');
 const out=calculate(raw,JSON.stringify({issue:existing}));
 assert.equal(out.change,false);
 assert.equal(out.summary.issues,current.issues.length);
 assert.deepEqual(JSON.parse(out.files['juvenile-news/issues.json']),current);
});
