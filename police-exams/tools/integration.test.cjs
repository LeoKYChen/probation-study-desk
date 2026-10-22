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
assert.equal(windows.POLICE_ORIGINAL_QUESTION_BANK.length,0,'no pending candidates accidentally shipped');
assert.equal(windows.QUESTION_BANK.length+windows.RELATED_QUESTION_BANK.length,426);
const assets=JSON.parse(read('offline-manifest.json')).assets.map(x=>x.url);
for(const a of ['police-exams/questions.approved.js','police-exams/approved-loader.js','police-exams/catalog.json'])
 assert(assets.includes(a),'offline source missing: '+a);
assert.equal(assets.length,new Set(assets).size);
console.log('PASS: original-only intake into v2.5 and study desk; all existing user-facing practice controls; 426 original entries untouched.');
