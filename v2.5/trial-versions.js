/* Separate assessment providers share the original question and user answer. */
(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const providers={original:{id:'original',label:'原有版本',description:'保留網站現有的全科試評。'},supplement:{id:'supplement',label:'補充版本',description:'本次觀護人六科補充；原已完成54題沿用既有規則。'}};
  const provider=record=>record?.selectedTrialProvider==='supplement'?'supplement':'original';
  const available=id=>!!root.PROBATION_TRIAL_MANIFEST?.questions.some(q=>q.id===id);
  function rubric(id,record){
    if(available(id)&&provider(record)==='supplement'&&root.PROBATION_TRIAL_RUBRICS?.[id])return root.PROBATION_TRIAL_RUBRICS[id];
    return root.FULL_PILOT_RUBRICS?.[id]||root.PENDING_PILOT_RUBRICS?.[id]||null;
  }
  function snapshot(record){return {assessment:record.assessment?clone(record.assessment):null,scores:clone(record.scores||{issue:0,rule:0,analysis:0,structure:0}),pointFeedback:clone(record.pointFeedback||{}),scoreSource:record.scoreSource||null,updatedAt:record.updatedAt||null};}
  function archive(record){
    const versions=clone(record.assessmentVersions||{}),key=provider(record);
    if(versions[key]||record.assessment||record.scoreSource==='adjusted'||Object.keys(record.pointFeedback||{}).length)versions[key]=snapshot(record);
    return versions;
  }
  function save(record,assessment){
    const key=provider(record),versions=archive(record);
    const tagged={...assessment,trialProvider:key,trialProviderLabel:providers[key].label,questionId:record.questionId||assessment.questionId,
      reusedOriginalRules:key==='supplement'&&assessment.method!=='probation-190-trial-v1'};
    versions[key]={assessment:clone(tagged),scores:assessment.scores?clone(assessment.scores):{issue:0,rule:0,analysis:0,structure:0},pointFeedback:clone(record.pointFeedback||{}),scoreSource:'system',updatedAt:assessment.createdAt||new Date().toISOString()};
    return {assessment:tagged,assessmentVersions:versions};
  }
  function select(record,next){
    if(!providers[next])throw Error('未知的試評版本');
    const versions=archive(record),target=versions[next];
    return {selectedTrialProvider:next,assessmentVersions:versions,assessment:target?.assessment?clone(target.assessment):null,pointFeedback:clone(target?.pointFeedback||{}),
      scores:target?.scores?clone(target.scores):{issue:0,rule:0,analysis:0,structure:0},scoreSource:target?.scoreSource||null};
  }
  function average(records,knownIds,key){
    const totals=[];
    for(const [id,record] of Object.entries(records)){
      if(!knownIds.has(id)||!record.done)continue;
      const view=archive(record)[key];
      if(!view||(!view.assessment&&view.scoreSource!=='adjusted')||(view.assessment?.total===null&&view.scoreSource!=='adjusted'))continue;
      const values=['issue','rule','analysis','structure'].map(k=>Number(view.scores?.[k]||0));
      if(values.every(Number.isFinite))totals.push(values.reduce((a,b)=>a+b,0));
    }
    return totals.length?Math.round(totals.reduce((a,b)=>a+b,0)/totals.length):null;
  }
  root.TrialVersions={providers,provider,available,rubric,snapshot,archive,save,select,average};
})(typeof window==='undefined'?globalThis:window);
