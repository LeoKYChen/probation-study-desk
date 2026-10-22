'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('police-exams/approved-loader.js','utf8');
const hash='a'.repeat(64);
const original={id:'police-115-counseling-1',year:115,questionNo:1,examName:'一般警察人員考試',
  officialSubject:'諮商與輔導',body:'一、請完整分析此題情境與具體的理論問題。（25 分）',
  sourceKind:'official-original',verified:true,paperSha256:hash,textSha256:hash,
  sourceUrl:'https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115060'};
const run=candidates=>{
 const window={QUESTION_BANK:[{id:'legacy1'}],RELATED_QUESTION_BANK:[{id:'legacy2'}],
  POLICE_ORIGINAL_QUESTION_BANK:candidates};
 vm.runInNewContext(source,{window});
 return window;
};
let x=run([original]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,1);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK[0].body,original.body,'original text remains unmodified');
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK[0].subject,'諮商與輔導');
assert.equal(x.QUESTION_BANK.length,1,'legacy bank must remain unchanged');
assert.equal(x.RELATED_QUESTION_BANK.length,1);
x=run([{...original,verified:false},{...original,sourceKind:'adapted'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'unreviewed/rewritten stems must not appear');
x=run([{...original,examName:'警察人員考試'},{...original,officialSubject:'社會科學研究法'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'other exam/subject excluded');
x=run([original,original]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,1,'duplicate IDs removed');
assert.equal(x.PolicePastPaperIntegration.rejected.length,1);
console.log('PASS: four-subject original-only gate; no unreviewed stems; no impact on legacy bank.');
