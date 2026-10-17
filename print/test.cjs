'use strict';
const assert=require('node:assert/strict');
require('./print-model.js');
const model=globalThis.PSDEssayPrint;
const raw={
 'probation-study30-v251:v1':JSON.stringify({version:1,sessions:{
  '2026-10-16':{date:'2026-10-16',aiReviewTexts:{'q-1':'AI批改應補法律依據'}},
  '2026-10-17':{date:'2026-10-17',essayDrafts:{'q-1':{template:'law',outline:['爭點A','法條B','涵攝C','結論D'],fullAnswer:'申論原稿',updatedAt:'2026-10-17T10:00:00Z'}},essayAssessments:{'q-1':{scores:{issue:3},issues:['要件'],nextStep:'重寫'}},essayCustomPrompts:{},notes:['今日札記']}
 }}),
 'probation-study-desk-v24':JSON.stringify({'q-1':{issue:'426題作答',essayDrafts:{issues:'第一格',basis:'第二格'},assessment:{strengths:['切題'],improvements:['法條']},updatedAt:'2026-10-17T09:00:00Z'}}),
 'probation-daily-github:records:v1':JSON.stringify({'d-1':{answer:'每日模擬作答',essayDrafts:{issues:'每日爭點'},aiFeedback:'模型回饋',updatedAt:'2026-10-17T08:00:00Z'}}),
 'psd-common-subjects-v1':JSON.stringify({schema:'psd-common-subjects-v1',drafts:{'full:12':{text:'作文現稿',feedback:'教師回饋',versions:[{text:'作文初稿',date:'2026-10-01T08:00:00Z'}],nextAction:'改寫轉折'}} ,english:{}})
};
const copy=JSON.stringify(raw);
const read={getItem:k=>Object.prototype.hasOwnProperty.call(raw,k)?raw[k]:null,setItem(){throw Error('printing must never write')},removeItem(){throw Error('printing must never delete')}};
const sources={past:[{id:'q-1',body:'原始考古題目',title:'115年刑法第一題',subject:'刑法',year:115,source:'考選部'}],
 daily:[{id:'d-1',date:'2026-10-17',subject:'刑法',question:'模擬原題'}],
 essays:[{id:'essay-1',title:'改編國文作文',body:'國文作文題幹',type:'short'}]};
const result=model.printRecords(read,sources);
assert.equal(result.errors.length,0);
assert.equal(result.records.length,4);
assert.deepEqual(new Set(result.records.map(r=>r.category)),new Set(['study30','past','daily','common']));
const pro=result.records.find(r=>r.category==='study30');
assert.equal(pro.question,'原始考古題目');
assert.equal(pro.sections[0].body,'爭點A');
assert(pro.sections.some(s=>s.title.includes('AI 批改')&&s.body.includes('應補法律依據')));
assert(pro.sections.some(s=>s.title.includes('自評')&&s.body.includes('重寫')));
const past=result.records.find(r=>r.category==='past');
assert.equal(past.question,'原始考古題目');
assert(past.sections.some(s=>s.title.includes('完整申論')&&s.body==='426題作答'));
const daily=result.records.find(r=>r.category==='daily');
assert.equal(daily.question,'模擬原題');
assert(daily.sections.some(s=>s.group==='feedback'&&s.body==='模型回饋'));
const common=result.records.find(r=>r.category==='common');
assert.equal(common.title,'改編國文作文');
assert.equal(common.question,'國文作文題幹');
assert(common.sections.some(s=>s.group==='revision'&&s.body==='作文初稿'));
assert.equal(JSON.stringify(raw),copy,'printing must not modify any localStorage value');
const bad={getItem:key=>key==='probation-study-desk-v24'?'broken':null,setItem(){throw Error('write')}};
const invalid=model.printRecords(bad,sources);
assert(invalid.errors.length===1);assert.equal(invalid.records.length,0);
const other={getItem:key=>key==='probation-study-desk-v3'?JSON.stringify({'old-q':{issue:'legacy note'}}):null};
const history=model.printRecords(other,sources);
assert.equal(history.records.length,1);
assert.match(history.records[0].question,/題庫找不到/);
console.log('PASS: all four areas, source stems, four-pane drafts, AI notes, revision copies, read-only, corrupt storage, legacy missing question');
