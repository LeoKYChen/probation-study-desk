'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('scripts/apps-script/DailyResourcesSelective.gs','utf8');
const model=fs.readFileSync('daily-simulation/model.js','utf8');
function parser(){
 const ctx={};
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 return ctx;
}
test('complete question with no reliable subject remains practice-ready and unclassified',()=>{
 const ctx=parser();
 const text='少年甲與同儕於超商竊取商品，請分別說明犯罪學理論及少年司法處遇的分析方式。';
 const result=ctx.mdSourceQuality_(text,'待分類');
 assert.equal(result.status,'待分類');
 assert.equal(result.canPractice,true);
});
test('incomplete reference-only prompt cannot enter practice bank',()=>{
 const ctx=parser();
 const result=ctx.mdSourceQuality_('依上述事實回答本題','待分類');
 assert.equal(result.status,'待補正');
 assert.equal(result.canPractice,false);
});
test('explicit subjects remain practice-ready',()=>{
 const ctx=parser();
 const text='少年甲與同儕於超商竊取商品，請依少年事件處理法分析應有之程序保障及必要處遇。';
 const result=ctx.mdSourceQuality_(text,'少年事件處理法');
 assert.equal(result.status,'可練習');
 assert.equal(result.canPractice,true);
});
test('existing practice model includes unclassified questions without changing IDs or records',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(model,ctx);
 const M=ctx.PracticeModel,id='md-unchanged-1';
 const q={id,date:'2026-11-08',subject:'待分類',
   question:'少年甲與同儕於超商竊取商品，請分析少年司法與犯罪學的可能問題。',
   issues:'',outline:'',theoryTable:[],sourceQualityStatus:'待分類'};
 const dataset=M.dataset({schemaVersion:1,count:1,questions:[q]});
 const record={answer:'自行作答',review:false,updatedAt:'2026-11-08T01:00:00.000Z'};
 const records=M.records({[id]:record});
 assert.equal(M.subject(q),'待分類');
 const result=M.filter(dataset.questions,records,[],{tab:'全部題目',subject:'待分類',date:'',query:'',sort:'newest'});
 assert.equal(result.length,1);
 assert.equal(result[0].id,id);
 assert.equal(records[id].answer,'自行作答');
});
