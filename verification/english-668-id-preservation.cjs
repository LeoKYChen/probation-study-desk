'use strict';
// Preserve the exact pre-migration question IDs and their recorded source metadata.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'common-subjects/daily');
const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/english-668-id-baseline.json'),'utf8'));
const env={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(dir,'engine.js'),'utf8'),env);
const files=['vocab.json','grammar-1.json','grammar-2.json','grammar-3.json','reading.json','completion.json'];
const bank=env.module.exports.createBank(files.map(name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))));
const rows=bank.questions.map(q=>({id:q.id,year:q.year,number:q.number,exam:q.exam,sourceUrl:q.sourceUrl})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
assert.equal(expected.count,668);assert.equal(rows.length,668);assert.equal(new Set(rows.map(x=>x.id)).size,668);
assert.equal(JSON.stringify(rows),JSON.stringify(expected.questions),'每一題 ID、年度、題號、考試及來源網址須與遷移基底相同');
console.log('PASS 668 individual question IDs and source metadata preserved from '+expected.sourceCommit);
