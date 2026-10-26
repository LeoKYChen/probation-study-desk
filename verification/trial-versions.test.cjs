'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),old=root,baseline=root,patch=root;
const read=(base,p)=>fs.readFileSync(path.join(base,p),'utf8');
const window={},context={window,globalThis:window};vm.createContext(context);
const run=(base,p)=>vm.runInContext(read(base,p),context,{filename:p,timeout:10000});
for(const p of ['questions.js','legal-pilots.js','full-pilots.js','pending-pilots-data.js','answer-calibrations.js','pending-pilots.js','grade-reference.js','full-pilots-all.js'])run(baseline,'v2.5/'+p);
const originalJSON=JSON.stringify(window.FULL_PILOT_RUBRICS),questionsJSON=JSON.stringify(window.QUESTION_BANK),pendingJSON=JSON.stringify(window.PENDING_PILOT_RUBRICS);
assert.equal(Object.keys(window.FULL_PILOT_RUBRICS).length,426,'current other-AI rules loaded');
const before={};for(const id of ['115-刑法-1','113-心理學-1','115-少年事件處理法-1']){
  const q=window.QUESTION_BANK.find(q=>q.id===id);before[id]=window.gradeFullPilot('',q);delete before[id].createdAt;
}
run(patch,'v2.5/probation-trial-data.js');run(patch,'v2.5/probation-trial.js');run(patch,'v2.5/trial-versions.js');
assert.equal(JSON.stringify(window.FULL_PILOT_RUBRICS),originalJSON,'all 426 original rubrics remain byte-equivalent as data');
assert.equal(JSON.stringify(window.QUESTION_BANK),questionsJSON,'original questions remain unchanged');
assert.equal(JSON.stringify(window.PENDING_PILOT_RUBRICS),pendingJSON,'original drafts remain unchanged');
for(const id of Object.keys(before)){const result=window.gradeFullPilot('',window.QUESTION_BANK.find(q=>q.id===id));delete result.createdAt;assert.deepEqual(result,before[id],'original scoring untouched');}
const rules=window.PROBATION_TRIAL_RUBRICS,manifest=window.PROBATION_TRIAL_MANIFEST,V=window.TrialVersions;
assert.equal(manifest.total,190);assert.equal(manifest.retained,54);assert.equal(Object.keys(rules).length,136);
assert.equal(new Set(manifest.questions.map(q=>q.id)).size,190);
let checked=0,sourceCount=0;const referenceCoverage=[];
for(const [id,r] of Object.entries(rules)){
  const q=window.QUESTION_BANK.find(q=>q.id===id);assert.equal(q.examType,'觀護人');
  assert.equal(q.body,r.questionBody);assert.equal(r.questionHash,crypto.createHash('sha256').update(q.body).digest('hex'));
  assert.equal(r.contentStatus,'targeted-source-review');assert.ok(r.referenceAnswer.length>50);assert.equal(r.criteria.length,4);
  assert.equal(r.criteria.map(x=>x.category).join(','),'issue,rule,analysis,structure');assert.ok(r.sources.length>=2);
  assert.ok(r.sources.some(s=>s.checkedAt&&s.verification!=='existing-reference-not-rechecked'));
  assert.ok(r.openIssues.length);assert.equal(r.calibration.humanReviewed,false);assert.equal(r.calibration.fullAnswerCalibrated,false);
  for(const s of r.sources){assert.ok(/^https?:\/\//.test(s.url));if(s.checkedAt){assert.ok(['2026-10-25','2026-10-26'].includes(s.checkedAt));sourceCount++;}}
  for(const answer of ['',q.body,q.title,r.coreGroups.flat(2).join('、')]){
    const result=window.gradeProbationTrial(answer,q);assert.equal(result.total,null,'blank/copy/keywords must not earn a score: '+id);
    assert.equal(result.dimensionReasons.length,4);assert.ok(result.warnings.length);assert.equal(result.answer,answer);
  }
  const result=window.gradeProbationTrial(r.referenceAnswer,q);assert.equal(result.dimensionReasons.length,4);assert.equal(result.manualReview,true);
  referenceCoverage.push({id,matched:result.evidence.filter(x=>x.label.startsWith('本題概念線索')&&x.status==='reference-evidence').length});
  assert.equal(V.rubric(id,{}),window.FULL_PILOT_RUBRICS[id]);assert.equal(V.rubric(id,{selectedTrialProvider:'supplement'}),r);
  checked++;
}
for(const item of manifest.questions.filter(q=>q.status==='existing-unchanged')){
  assert.equal(V.rubric(item.id,{selectedTrialProvider:'supplement'}),window.FULL_PILOT_RUBRICS[item.id]);assert.equal(rules[item.id],undefined,'54 retained questions not regenerated');
}
assert.equal(window.gradeProbationTrial('任何答案',{id:'監獄官-115-刑法-1'}),null,'outside scope has no supplement');
const q=window.QUESTION_BANK.find(q=>q.id==='115-刑法-1');
const legacy={issue:'這份使用者原答必須原封保留。',scores:{issue:20,rule:20,analysis:20,structure:10},assessment:{method:'all-subject-pilot-v2',total:70,answer:'這份使用者原答必須原封保留。'},pointFeedback:{'0:某要點':{note:'原有版本的人工回饋'}},scoreSource:'system',done:true,review:false,essayDrafts:{issues:'我的草稿'}};
const legacyOriginal=JSON.stringify(legacy),switched={...legacy,...V.select(legacy,'supplement')};
assert.equal(JSON.stringify(legacy),legacyOriginal,'switch planner does not mutate legacy record');
assert.equal(switched.issue,legacy.issue);assert.equal(switched.assessment,null);assert.equal(switched.done,true);assert.deepEqual(switched.essayDrafts,legacy.essayDrafts);
assert.equal(switched.assessmentVersions.original.assessment.total,70);assert.equal(switched.scores.issue,0);
assert.equal(Object.keys(switched.pointFeedback).length,0,'a new provider must not borrow original point feedback');
const bAssessment={method:'probation-190-trial-v1',total:40,scores:{issue:10,rule:10,analysis:10,structure:10},answer:legacy.issue};
const savedB={...switched,...V.save(switched,bAssessment),scores:bAssessment.scores,scoreSource:'system'};
assert.equal(savedB.assessment.trialProvider,'supplement');
const backA={...savedB,...V.select(savedB,'original')};assert.equal(backA.assessment.total,70);assert.equal(backA.scores.issue,20);assert.equal(backA.assessmentVersions.supplement.assessment.total,40);
assert.equal(backA.pointFeedback['0:某要點'].note,'原有版本的人工回饋','switching back restores original point feedback');
const backB={...backA,...V.select(backA,'supplement')};assert.equal(backB.assessment.total,40);assert.equal(backB.issue,legacy.issue);
const changedAnswer={...backB,issue:'使用者修改後的答案，原試評結果仍保留。'};
const aAfterEdit={...changedAnswer,...V.select(changedAnswer,'original')};assert.equal(aAfterEdit.issue,changedAnswer.issue);assert.notEqual(aAfterEdit.assessment.answer,aAfterEdit.issue,'old assessment keeps its original answer for freshness checks');
const manuallyAdjusted={...backA,scoreSource:'adjusted',scores:{issue:25,rule:22,analysis:20,structure:17}};
const manualRound={...manuallyAdjusted,...V.select(manuallyAdjusted,'supplement')};const manualBack={...manualRound,...V.select(manualRound,'original')};assert.equal(manualBack.scoreSource,'adjusted');assert.equal(manualBack.scores.issue,25);
const feedbackOnly={pointFeedback:{a:{note:'僅人工回饋，尚未評分'}},scores:{issue:0,rule:0,analysis:0,structure:0}};
const feedbackSwitch={...feedbackOnly,...V.select(feedbackOnly,'supplement')};
const feedbackBack={...feedbackSwitch,...V.select(feedbackSwitch,'original')};assert.equal(feedbackBack.pointFeedback.a.note,'僅人工回饋，尚未評分');
const cleared={...backB,assessment:null,scoreSource:null,scores:{issue:0,rule:0,analysis:0,structure:0},pointFeedback:{}};const clearToA={...cleared,...V.select(cleared,'original')};const clearBack={...clearToA,...V.select(clearToA,'supplement')};assert.equal(clearBack.assessment,null,'cleared version must not resurrect old scores');assert.equal(clearToA.assessment.total,70,'clearing supplement preserves original');
const recordMap={[q.id]:backB};assert.equal(V.average(recordMap,new Set([q.id]),'original'),70);assert.equal(V.average(recordMap,new Set([q.id]),'supplement'),40);
assert.equal(V.average({[q.id]:{...backB,assessment:{total:null},scoreSource:'system'}},new Set([q.id]),'supplement'),null,'unscored checks excluded, not treated as zero');
assert.equal(V.provider(JSON.parse(JSON.stringify(backB))),'supplement','selected provider survives reload');
run(old,'v2.5/backup-core.js');const backup=window.Backup25.create(recordMap,{}),round=window.Backup25.validate(JSON.parse(JSON.stringify(backup)));
assert.equal(round.study[q.id].assessmentVersions.original.assessment.total,70);assert.equal(round.study[q.id].assessmentVersions.supplement.assessment.total,40);
const merged=window.Backup25.merge(backup,window.Backup25.create({[q.id]:backA},{}));assert.ok(window.Backup25.contains(backup,merged.data),'sync merge preserves version-specific results');
const numeric=window.QUESTION_BANK.find(q=>q.id==='115-刑事訴訟法與保安處分執行法-1');
const nr=window.gradeProbationTrial('一、原宣告刑為十九月、八月、十二月、十二月、十二月，因此外部界限為十九月至六十三月。\n二、內部界限上限為五年，原定二年並非絕對下限，低於原定刑應具體說明理由。',numeric);
assert.equal(nr.total,null,'numeric and legal range need semantic review');assert.ok(nr.evidence.some(x=>x.label==='更定執行刑結果'));
const html=read(patch,'v2.5/index.html');
assert.equal((html.match(/id="trialVersionPanel"/g)||[]).length,1);assert.ok(html.indexOf('id="trialVersionPanel"')>html.indexOf('class="workspace"'),'provider selection is inside the question workspace');
assert.ok(html.includes('const trialAverage=window.TrialVersions.average(saved,knownIds,trialKey)'),'stats refresh must not mix providers');
assert.ok(html.includes('全科試評：11科全部426題'),'new current original summary retained');
assert.ok(html.indexOf('full-pilots-all.js')<html.indexOf('trial-versions.js'));assert.ok(html.includes('...versionSaved,\n        assessmentHistory:'));
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
for(const p of ['probation-trial-data.js','probation-trial.js','trial-versions.js','probation-trial-ui.js'])new vm.Script(read(patch,'v2.5/'+p));
const report=read(patch,'v2.5/probation-trial-review.html');for(const m of report.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
const result={passed:true,total:190,retained:54,supplemented:checked,originalRulesPreserved:426,checkedSourceEntries:sourceCount,blankCopyKeywordCases:checked*4,versionSwitchAndBackup:'passed',numericReview:'passed',referenceWithoutMatchedGroup:referenceCoverage.filter(x=>!x.matched).map(x=>x.id)};
console.log(JSON.stringify(result,null,2));
