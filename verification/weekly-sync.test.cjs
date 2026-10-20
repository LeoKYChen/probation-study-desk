#!/usr/bin/env node
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validate,artifacts,guardHistory}=require('../scripts/weekly-sync.cjs');
const fixture=()=>({issues:[{
 id:'weekly-2026-10-20',date:'2026-10-20',periodStart:'2026-10-13',periodEnd:'2026-10-19',
 title:'示範',sourceConversation:'test',status:'draft',note:'',trend:'',originalMarkdown:'',
 items:[{id:'sample-item',title:'示範研究',category:'少年司法制度',tags:[],type:'研究',
 publishedDate:null,eventDate:null,dateNote:'日期待查',author:'研究人員',sourceTitle:'示範資料',
 url:null,sourceStatus:'unverified',summary:'摘要',significance:'意義',followUp:'追問',
 limitation:'限制',legalNature:'研究資料',checkedAt:null,readingScope:'未查原文',isBackground:true}]
}]});
test('existing draft archive with explicitly unverified links remains valid',()=>{
 assert.equal(validate(fixture()).issues,1);
});
test('identical canonical JSON is copied to Vite source and deterministic ZIP bridge',()=>{
 const source=JSON.stringify(fixture(),null,2)+'\n';
 const {outputs}=artifacts(source);
 assert.equal(outputs['juvenile-news/source/public/issues.json'],source);
 assert.match(outputs['file-data/weekly.generated.js'],/^\/\* GENERATED from committed JSON/);
 assert.match(outputs['file-data/weekly.generated.js'],/weekly-2026-10-20/);
});
test('rejects duplicate issue IDs and invalid dates',()=>{
 const d=fixture();d.issues.push({...d.issues[0]});
 assert.throws(()=>validate(d),/duplicate issue id/);
 const bad=fixture();bad.issues[0].date='2026-02-31';
 assert.throws(()=>validate(bad),/invalid date/);
});
test('reviewed articles must not silently omit verified source or checked date',()=>{
 const x=fixture();x.issues[0].items[0].sourceStatus=undefined;
 assert.throws(()=>validate(x),/verified article missing source URL/);
});
test('historical issue loss is blocked, preserving append-only archive',()=>{
 const a=fixture();const b=fixture();b.issues[0].id='weekly-2026-10-21';b.issues[0].date='2026-10-21';
 assert.throws(()=>guardHistory(a,b),/historical issue removal blocked/);
});

test('2026-10-18 style records with verified sources and check dates are accepted',()=>{
 const d=fixture();
 const a=d.issues[0].items[0];
 a.url='https://example.org/research';
 a.checkedAt='2026-10-18';
 a.sourceStatus='verified';
 assert.equal(validate(d).articles,1);
});
test('verified record requires both public source URL and review date',()=>{
 const d=fixture();
 const a=d.issues[0].items[0];
 a.sourceStatus='verified';
 a.url='https://example.org/research';
 assert.throws(()=>validate(d),/verified article missing check date/);
});
