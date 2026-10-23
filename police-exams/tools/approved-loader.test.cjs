'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('police-exams/approved-loader.js','utf8');
const hash='a'.repeat(64);
const original={id:'police-115-counseling-1',year:115,questionNo:1,examName:'一般警察人員考試',
  examLevel:'三等考試',examType:'犯罪防治人員預防組',officialSubject:'諮商與輔導',body:'一、請完整分析此題情境與具體的理論問題。（25 分）',
  sourceKind:'official-original',verified:true,officialPoints:25,paperSha256:hash,textSha256:hash,
  sourceReview:{reviewer:'ChatGPT（非真人核對）',reviewMethod:'官方PDF原題核對'},
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
assert.equal(x.PolicePastPaperIntegration.rejected[0].reason,'not source-verified','an AI source check must not be described as manual verification');
x=run([{...original,examName:'警察人員考試'},{...original,officialSubject:'社會科學研究法'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'other exam/subject excluded');
x=run([{...original,officialPoints:null}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'missing points cannot be released');
assert.equal(x.PolicePastPaperIntegration.rejected[0].reason,'invalid official points');
x=run([{...original,sourceReview:null}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'missing source-review provenance cannot be released');
assert.equal(x.PolicePastPaperIntegration.rejected[0].reason,'missing review provenance');
x=run([{...original,id:'police-115-counseling-2'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'wrong paper ID cannot overwrite another question\'s saved answer');
assert.equal(x.PolicePastPaperIntegration.rejected[0].reason,'ID does not match official paper slot');
x=run([{...original,year:114}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'changing year without changing ID must be rejected');
x=run([{...original,examLevel:'二等考試'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'wrong exam level cannot enter the three-level exam bank');
assert.equal(x.PolicePastPaperIntegration.rejected[0].reason,'exam class mismatch');
x=run([{...original,examType:'行政警察人員'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,0,'different recruitment group is excluded');
x=run([{...original,questionNo:2,id:'police-115-counseling-2'}]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,1,'canonical IDs for other numbered questions remain valid');
x=run([original,original]);
assert.equal(x.POLICE_ORIGINAL_QUESTION_BANK.length,1,'duplicate IDs removed');
assert.equal(x.PolicePastPaperIntegration.rejected.length,1);
console.log('PASS: four-subject original-only gate; no unreviewed stems; no impact on legacy bank.');
