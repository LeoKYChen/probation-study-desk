'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const read=path=>fs.readFileSync(path,'utf8');
const paper=read('v2.5/index.html');
const sourceCatalogue=read('police-exams/index.html');
assert(sourceCatalogue.includes('AI 輔助核對原題') && sourceCatalogue.includes('尚未經真人逐題校稿'), 'catalogue must disclose review method');
assert(sourceCatalogue.includes('已定位32份考選部官方原卷'), 'catalogue must report actual 32 official papers');
assert(sourceCatalogue.includes('邊做題、邊覆核') && sourceCatalogue.includes('僅完成作答不自動代表已逐字核稿'), 'live catalogue must support progressive source verification without false human sign-off');
const desk=read('study-desk/index.html'),deskApp=read('study-desk/app.js');
for(const id of ['shuatiQuestionLink','yamolQuestionLink','draftIssue','draftBasis','draftAnalysis','draftConclusion','issueInput','sourceLink','scoreRows'])
  assert(paper.includes('id="'+id+'"'),'existing practice feature missing: '+id);
assert(paper.includes('AI') && paper.includes('批改'),'AI review controls retained');
const aiReview=read('v2.5/ai-simple-review-v254.js');
assert(aiReview.includes('ai-simple-export-dual'),'main mobile dual-AI manual handoff must remain available');
assert(aiReview.includes('psd-dual-ai-import-v1'),'mobile handoff export format must not regress');
assert(aiReview.includes('PolicePastPaperIntegration') && aiReview.includes('legacyIds'),'expanded original-paper bank validation must remain available');
assert(paper.includes('../police-exams/questions.approved.js'));
assert(paper.includes('../police-exams/approved-loader.js'));
assert(paper.indexOf('approved-loader.js')<paper.indexOf('const questionBank ='),'gate executes before the question list');
assert(paper.includes('...(window.POLICE_ORIGINAL_QUESTION_BANK || [])'),'approved questions included without replacing original bank');
assert(desk.includes('../police-exams/approved-loader.js') && deskApp.includes('...(globalThis.POLICE_ORIGINAL_QUESTION_BANK||[])'));
const deskTabs = desk.match(/<nav class="desk-tabs"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
assert.equal((deskTabs.match(/<a /g)||[]).length,4,'existing four desk navigation tabs must remain');
assert(desk.includes('href="../police-exams/"'),'police official-source link remains available outside the four desk tabs');
const windows={};
vm.runInNewContext(read('professional/source-main-questions.js'),{window:windows},{filename:'source-main-questions.js'});
vm.runInNewContext(read('professional/source-related-questions.js'),{window:windows},{filename:'source-related-questions.js'});
assert.equal(windows.QUESTION_BANK.length,374);
assert.equal(windows.RELATED_QUESTION_BANK.length,52);
vm.runInNewContext(read('police-exams/questions.approved.js'),{window:windows},{filename:'approved.js'});
vm.runInNewContext(read('police-exams/approved-loader.js'),{window:windows},{filename:'approved-loader.js'});
assert.equal(windows.POLICE_ORIGINAL_QUESTION_BANK.length,127,'127 verified 108–115 official original questions shipped');
assert.equal(windows.PolicePastPaperIntegration.rejected.length,0,'no approved question rejected');
assert.equal(new Set([...windows.QUESTION_BANK,...windows.RELATED_QUESTION_BANK,...windows.POLICE_ORIGINAL_QUESTION_BANK].map(q=>q.id)).size,553,'original ID collisions absent');
for(const q of windows.POLICE_ORIGINAL_QUESTION_BANK){
 assert.equal(q.sourceKind,'official-original');assert.equal(q.verified,true);assert(q.year>=108&&q.year<=115);
 assert(q.sourceReview.reviewer.includes('非真人') && q.sourceReview.reviewer.includes('ChatGPT'),'AI provenance must remain explicit');
 assert(q.body.length>20,'original body must be present');
 assert.equal(createHash('sha256').update(q.body,'utf8').digest('hex'),q.textSha256,
   'immutable source text hash mismatch: '+q.id);
}
const groups={};for(const q of windows.POLICE_ORIGINAL_QUESTION_BANK)groups[q.officialSubject]=(groups[q.officialSubject]||0)+1;
assert.equal(Object.keys(groups).length,4);assert(Object.values(groups).every(n=>n>=4));
const special=windows.POLICE_ORIGINAL_QUESTION_BANK.filter(q=>q.year===114&&q.officialSubject==='刑法與刑事訴訟法');
assert.equal(special.length,3,'official 114 criminal-law/procedure has three questions');
assert.equal(special.map(q=>q.officialPoints).join(','),'50,25,25');
assert.equal(windows.QUESTION_BANK.length+windows.RELATED_QUESTION_BANK.length,426);
const officialCatalog=JSON.parse(read('police-exams/catalog.json'));
const officialSubjectKeys=new Map(officialCatalog.subjects.map(s=>[s.subject,s.key]));
const officialPapers=new Map();
for(const q of windows.POLICE_ORIGINAL_QUESTION_BANK){
 const subjectKey=officialSubjectKeys.get(q.officialSubject);
 assert(subjectKey, 'unknown official subject: '+q.id);
 const key=q.year+':'+subjectKey;
 assert.equal(q.sourceUrl, officialCatalog.knownPaperUrls[key], 'official URL mismatch: '+q.id);
 assert(Number.isInteger(q.officialPoints)&&q.officialPoints>0, 'explicit original point value missing: '+q.id);
 const bodyPoints=[...q.body.matchAll(/[（(]\s*(\d{1,3})\s*分\s*[）)]/g)].map(m=>Number(m[1]));
 if(bodyPoints.length>=1) assert.equal(q.officialPoints,bodyPoints.reduce((a,b)=>a+b,0),'point values differ from official stem: '+q.id);
 if(bodyPoints.length>1 && q.id==='police-111-psychology-1')
   assert.equal(q.officialPoints,20,'111 psychology first question must total 8+12 points');
 const previous=officialPapers.get(key)||{count:0,sum:0,paperSha256:q.paperSha256};
 assert.equal(previous.paperSha256,q.paperSha256,'mixed official PDF files within the same paper: '+key);
 officialPapers.set(key,{count:previous.count+1,sum:previous.sum+q.officialPoints,paperSha256:q.paperSha256});
}
assert.equal(Object.keys(officialCatalog.knownPaperUrls).length,32, '32 official paper source URLs expected');
assert.equal(officialPapers.size,32,'32 year/subject paper groups expected');
for(const [key,paper] of officialPapers){
 assert.equal(paper.sum,100,'per-paper official points must total 100: '+key);
 assert.equal(paper.count,key==='114:criminal_law_procedure'?3:4,'official question count: '+key);
}
const assets=JSON.parse(read('offline-manifest.json')).assets.map(x=>x.url);
const requiredPoliceFiles=['police-exams/questions.approved.js','police-exams/approved-loader.js','police-exams/catalog.json','police-exams/index.html'];
const mirror=read('scripts/build-cloudflare-main-mirror.py');
const requiredMirror=mirror.match(/REQUIRED = \(([\s\S]*?)\n\)/)?.[1] || '';
assert(mirror.includes('"police-exams",'),'the mirror must allow the official paper directory');
for(const a of [...requiredPoliceFiles,'dual-ai-bridge.js']){
 assert(assets.includes(a),'offline source missing: '+a);
 assert(requiredMirror.includes('"'+a+'"'),'Cloudflare mirror must enforce the required file: '+a);
}
assert.equal(assets.length,new Set(assets).size);
console.log('PASS: 426 legacy preserved + 127 PDF-source-reviewed police originals; all original practice controls retained.');
