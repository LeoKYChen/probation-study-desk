'use strict';
/* Release gate: no user data and no external link requests. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||'deploy-dist';
const load=f=>fs.readFileSync(path.join(root,f),'utf8');
const window={},document={readyState:'loading',addEventListener(){}};
const ctx={window,document,URL,encodeURIComponent,navigator:{},console};
for(const file of ['source-main-questions.js','source-related-questions.js','question-sources.js','study30-shuati-links.js','study30-yamol-links.js','ai-review-links.js'])
 vm.runInNewContext(load(file),ctx,{filename:file});
const bank=window.Study30QuestionSources.all,G=window.Study30GuidedReview,html=load('index.html'),app=load('app.js');
let count=0;function check(label,fn){fn();count++;console.log('PASS',count,label);}
check('original 426 questions',()=>assert.equal(bank.length,426));
check('unique question ids',()=>assert.equal(new Set(bank.map(q=>q.id)).size,426));
check('main 374 related 52',()=>{assert.equal(window.Study30QuestionSources.primaryCount,374);assert.equal(window.Study30QuestionSources.relatedCount,52);});
check('source mappings complete',()=>{assert.equal(Object.keys(window.SHUATI_LINKS).length,426);assert.equal(Object.keys(window.YAMOL_LINKS).length,426);});
check('all 426 links build with correct ID',()=>{
 for(const q of bank){for(const p of ['shuati','yamol']){const x=G.guide(q,p);assert(x.url?.startsWith('https://')); assert(['verified','paper','search'].includes(x.status));}}
});
check('all official direct links match expected domain',()=>{
 for(const q of bank){for(const [p,host] of [['shuati','shuati.tw'],['yamol','yamol.tw']]){const g=G.guide(q,p);if(g.status==='verified'||g.status==='paper'){const h=new URL(g.url).hostname;assert(h===host||h.endsWith('.'+host));}}}
});
check('all 426 AI prompts include relevant original question text',()=>{
 for(const q of bank){const prompt=G.prompt(q,{questionId:q.id,subject:q.subject},'測試原創答案');assert(prompt.includes(q.body));assert(prompt.includes(q.id));assert(prompt.includes('測試原創答案'));assert(prompt.includes('不需要 JSON'));}
});
check('empty draft cannot copy',()=>assert.throws(()=>G.prompt(bank[0],{questionId:bank[0].id},''),/先在申論答案/));
check('unknown question uses no fabricated link',()=>{assert.equal(G.guide(null,'shuati').url,null);assert.equal(G.guide(null,'yamol').url,null)});
check('not-indexed fallback explicitly marked search',()=>{
 const q=bank.find(x=>window.SHUATI_LINKS?.[x.id]?.status==='not-indexed');assert(q);
 const g=G.guide(q,'shuati');assert.equal(g.status,'search');assert(g.url.includes('google.com/search'));
});
check('paper-only Yamol distinguished from exact match',()=>{
 const q=bank.find(x=>window.YAMOL_LINKS?.[x.id]?.status==='paper_verified');assert(q);assert.equal(G.guide(q,'yamol').status,'paper');
});
check('no login or answers sent by links',()=>{const p=G.prompt(bank[0],{questionId:bank[0].id},'私人測試原文');assert(!G.guide(bank[0],'yamol').url.includes('私人測試原文'));assert(!G.guide(bank[0],'shuati').url.includes('私人測試原文'))});
check('AI controls are unique in generated page',()=>{
 for(const id of ['daily30CopyAi','daily30AiFeedback','daily30ExternalGuide','essayExternalGuide'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
});
check('script linked once in final page',()=>assert.equal((html.match(/src="\.\/ai-review-links\.js"/g)||[]).length,1));
check('same-session AI review saved as extra backup field',()=>{
 assert(app.includes('session.aiReviewTexts={'));assert(app.includes('localStorage.setItem(KEY,JSON.stringify(store))'));assert(app.includes('saveAiReview,readAiReview,currentDailyQuestion'));
});
check('study30 timer and backup preserved',()=>{assert(app.includes('function exportData()'));assert(html.includes('id="importBackupFile"'));assert(html.includes('id="mode30"'));assert(html.includes('id="timer"'));});
check('342 predicted source excluded',()=>assert.equal(window.Study30QuestionSources.predictedQuestionCount,0));
console.log('TOTAL',count,'Stage9 static integration checks: PASS');
