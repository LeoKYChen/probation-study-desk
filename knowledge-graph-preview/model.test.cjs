'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'graph-model.js'),'utf8'),sandbox);
const G=sandbox.KnowledgeGraphModel;
const subjects=[
 {subject:'少年事件處理法',practiceSubject:'少年事件處理法',topics:[
  {label:'曝險少年',count:1,rows:[{year:115,no:1,keywords:'行政輔導先行',core:'曝險少年',secondary:'少年輔導委員會',sourceUrl:'https://wwwq.moex.gov.tw/source'}]}
 ],rows:[{year:115,no:1}],scope:'法源以題目時點為準'},
 {subject:'刑事訴訟法',practiceSubject:'刑事訴訟法與保安處分執行法',topics:[
  {label:'搜索',count:1,rows:[{year:110,no:1,core:'搜索'}]}
 ],rows:[]},
 {subject:'保安處分執行法',practiceSubject:'刑事訴訟法與保安處分執行法',topics:[
  {label:'保安處分',count:1,rows:[{year:110,no:1,core:'保安處分'}]}
 ],rows:[]},
 {subject:'刑法',topics:[],rows:[]}
];
const bank=[
 {id:'juvenile-115-1',year:115,questionNo:1,subject:'少年事件處理法',examType:'觀護人',sourceUrl:'https://wwwq.moex.gov.tw/test'},
 {id:'shared-110-1',year:110,questionNo:1,subject:'刑事訴訟法與保安處分執行法',examType:'觀護人'}
];
test('exact year / number / mapped subject required',()=>{
 assert.equal(G.findQuestion(bank,subjects[0],{year:115,no:1}).id,'juvenile-115-1');
 assert.equal(G.findQuestion(bank,subjects[0],{year:115,no:2}),null);
 assert.equal(G.findQuestion(bank,subjects[0],{year:114,no:1}),null);
 assert.equal(G.findQuestion(bank,subjects[1],{year:110,no:1}).id,'shared-110-1');
});
test('topic and original question linkage is source grounded',()=>{
 const graph=G.buildGraph(subjects,bank,{subject:'少年事件處理法'});
 assert.equal(graph.stats.subjects,1);assert.equal(graph.stats.topics,1);
 assert.equal(graph.stats.questions,1);assert.equal(graph.stats.matched,1);
 assert.equal(graph.edges.filter(x=>x.type==='所屬分類').length,1);
 assert.equal(graph.edges.filter(x=>x.type==='考點對應題次').length,1);
 const q=graph.nodes.find(n=>n.id==='question:juvenile-115-1');
 assert.equal(q.rows[0].sourceUrl,'https://wwwq.moex.gov.tw/source');
});
test('cross subject links only when canonical question ID agrees',()=>{
 const cross=G.buildGraph(subjects,bank,{cross:true});
 assert.equal(cross.stats.subjects,4);
 assert.equal(cross.stats.sharedQuestions,1);
 assert.equal(cross.nodes.filter(n=>n.id==='question:shared-110-1').length,1);
 const shared=cross.nodes.find(n=>n.id==='question:shared-110-1');
 assert.deepEqual(new Set(shared.rows.map(x=>x.subject)),new Set(['刑事訴訟法','保安處分執行法']));
});
test('never infer shared questions from same year and number alone',()=>{
 const x=G.buildGraph(subjects,[],{cross:true});
 assert.equal(x.stats.sharedQuestions,0);
 assert.equal(x.stats.matched,0);
 assert.equal(x.stats.questions,2);
});
test('search filters topics, avoids inventing missing matches',()=>{
 const g=G.buildGraph(subjects,bank,{subject:'少年事件處理法',search:'不存在的詞'});
 assert.equal(g.stats.topics,0);assert.equal(g.stats.questions,0);
 const h=G.buildGraph(subjects,bank,{subject:'少年事件處理法',search:'行政輔導'});
 assert.equal(h.stats.topics,1);
});
test('reject arbitrary, javascript and non-HTTPS question URLs',()=>{
 assert.equal(G.safeUrl('javascript:alert(1)'),'');
 assert.equal(G.safeUrl('http://example.com/'),'');
 assert.equal(G.safeUrl('https://law.moj.gov.tw/'), 'https://law.moj.gov.tw/');
});
