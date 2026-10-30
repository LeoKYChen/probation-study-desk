/* Coordinates a daily-page editor with the transactional mixed backup. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDDailyOperations=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 async function run({core,database,legacy,repository,recovery,mixedApi,action,incoming,flags={}}){
  if(!core||!database||!legacy||!repository||!recovery||!mixedApi)throw Error('缺少每日題儲存服務');
  await repository.flush();
  const keys=['probation-study30-v251:v1',core.CONFLICT_KEY,recovery.KEY,'daily-reading-test:saved'];
  if(flags.v25)keys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
  if(flags.lectures)keys.push('psd-lecture-planner-v1');
  if(flags.common)keys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
  const mixed=mixedApi.create({core,database,legacy,managedKeys:keys}),snapshot=await mixed.snapshot();
  for(const key of [recovery.KEY,'daily-reading-test:saved'])if((snapshot[key]??null)!==(repository.raw[key]??null))throw Error('其他分頁已有更新，請重新整理後再操作');
  const plan=action==='clear'?recovery.planClear({core,snapshot}):action==='import'?recovery.planImport({core,snapshot,incoming}):null;
  if(!plan)throw Error('不支援的操作');
  if(Object.keys(plan.changes).length)await mixed.apply(plan);
  return {data:await repository.refresh(),conflicts:plan.conflicts?.length||0,count:plan.count||0};
 }
 return {run};
});
