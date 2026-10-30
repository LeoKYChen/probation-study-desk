/* Guarded v2.5 test-mode import and clear plans. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDV25Operations=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';const STUDY='probation-study-desk-v24',DAILY='probation-daily-github:records:v1',KEYS=[STUDY,'probation-study-desk-v3','probation-study-desk-v2',DAILY];
 function importPlan({core,backup,snapshot,incoming,active}){
  backup.validate(incoming);if(!backup.records(active))throw Error('目前考古題紀錄格式不符');
  const augmented=structuredClone(snapshot);if(!Object.hasOwn(augmented,STUDY)&&Object.keys(active).length)augmented[STUDY]=JSON.stringify(active);
  const data={};if(Object.keys(incoming.study).length)data[STUDY]=JSON.stringify(incoming.study);if(Object.keys(incoming.daily).length)data[DAILY]=JSON.stringify(incoming.daily);
  const bundle={format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:'test',data};const plan=core.plan(augmented,bundle);
  if(!Object.hasOwn(snapshot,STUDY)&&Object.hasOwn(augmented,STUDY)&&Object.keys(incoming.study).length&&!Object.hasOwn(plan.changes,STUDY))plan.changes[STUDY]=augmented[STUDY];
  plan.baseline=structuredClone(snapshot);return plan;
 }
 function clearPlan({core,snapshot}){
  const archive=snapshot[core.CONFLICT_KEY]?core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]):{schema:core.CONFLICT_KEY,entries:[]},changes={};let count=0;
  for(const key of KEYS){if(!Object.hasOwn(snapshot,key))continue;const old=core.parseValue(key,snapshot[key]);if(!Object.keys(old).length)continue;count+=Object.keys(old).length;archive.entries.push({key,path:[],existing:{},incoming:old,reason:'manual-clear'});changes[key]='{}';}
  if(count){changes[core.CONFLICT_KEY]=JSON.stringify(archive);for(const [key,raw] of Object.entries(changes))core.parseValue(key,raw);}
  return {baseline:structuredClone(snapshot),changes,count};
 }
 return {importPlan,clearPlan};
});
