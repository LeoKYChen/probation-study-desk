'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const paper=read('v2.5/index.html');
const desk=read('study-desk/index.html'),deskApp=read('study-desk/app.js');
for(const id of ['shuatiQuestionLink','yamolQuestionLink','draftIssue','draftBasis','draftAnalysis','draftConclusion','issueInput','sourceLink','scoreRows'])
  assert(paper.includes('id="'+id+'"'),'existing practice feature missing: '+id);
assert(paper.includes('AI') && paper.includes('批改'),'AI review controls retained');
assert(paper.includes('../police-exams/questions.approved.js'));
assert(paper.includes('../police-exams/approved-loader.js'));
assert(paper.indexOf('approved-loader.js')<paper.indexOf('const questionBank ='),'gate executes before the question list');
assert(paper.includes('...(window.POLICE_ORIGINAL_QUESTION_BANK || [])'),'approved questions included without replacing original bank');
assert(desk.includes('../police-exams/approved-loader.js') && deskApp.includes('...(globalThis.POLICE_ORIGINAL_QUESTION_BANK||[])'));
const windows={};
vm.runInNewContext(read('professional/source-main-questions.js'),{window:windows},{filename:'source-main-questions.js'});
vm.runInNewContext(read('professional/source-related-questions.js'),{window:windows},{filename:'source-related-questions.js'});
assert.equal(windows.QUESTION_BANK.length,374);
assert.equal(windows.RELATED_QUESTION_BANK.length,52);
vm.runInNewContext(read('police-exams/questions.approved.js'),{window:windows},{filename:'approved.js'});
vm.runInNewContext(read('police-exams/approved-loader.js'),{window:windows},{filename:'approved-loader.js'});
assert.equal(windows.POLICE_ORIGINAL_QUESTION_BANK.length,16,'115 original verified PDF questions shipped');
assert.equal(windows.PolicePastPaperIntegration.rejected.length,0,'no approved question rejected');
assert.equal(new Set([...windows.QUESTION_BANK,...windows.RELATED_QUESTION_BANK,...windows.POLICE_ORIGINAL_QUESTION_BANK].map(q=>q.id)).size,442,'original ID collisions absent');
for(const q of windows.POLICE_ORIGINAL_QUESTION_BANK){
 assert.equal(q.sourceKind,'official-original');assert.equal(q.verified,true);assert.equal(q.year,115);
 assert(q.sourceReview.reviewer.includes('非真人閱卷'),'AI provenance must remain explicit');
 assert(q.body.includes('（25 分）'));
}
const groups={};for(const q of windows.POLICE_ORIGINAL_QUESTION_BANK)groups[q.officialSubject]=(groups[q.officialSubject]||0)+1;
assert.equal(Object.keys(groups).length,4);assert(Object.values(groups).every(n=>n===4));
assert.equal(windows.QUESTION_BANK.length+windows.RELATED_QUESTION_BANK.length,426);
const assets=JSON.parse(read('offline-manifest.json')).assets.map(x=>x.url);
for(const a of ['police-exams/questions.approved.js','police-exams/approved-loader.js','police-exams/catalog.json'])
 assert(assets.includes(a),'offline source missing: '+a);
assert.equal(assets.length,new Set(assets).size);
console.log('PASS: 426 legacy preserved + 16 visually/source-reviewed police originals; v2.5 practice controls retained.');
