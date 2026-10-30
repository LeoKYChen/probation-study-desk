/* Coordinates a daily-page editor with the transactional mixed backup. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDDailyOperations=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 async function run({core,database,legacy,repository,recovery,mixedApi,action,incoming,favorites,timers,session,timerKey,flags={}}){
  if(!core||!database||!legacy||!repository||!recovery||!mixedApi)throw Error('缺少每日題儲存服務');
  await repository.flush();
  const keys=['probation-study30-v251:v1',core.CONFLICT_KEY,recovery.KEY,'daily-reading-test:saved'];
  if(flags.v25)keys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
  if(flags.lectures)keys.push('psd-lecture-planner-v1');
  if(flags.common)keys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
  const mixed=mixedApi.create({core,database,legacy,managedKeys:keys}),snapshot=await mixed.snapshot();
  for(const key of [recovery.KEY,'daily-reading-test:saved'])if((snapshot[key]??null)!==(repository.raw[key]??null))throw Error('其他分頁已有更新，請重新整理後再操作');
  const plan=action==='clear'?recovery.planClear({core,snapshot}):action==='import'?recovery.planImport({core,snapshot,incoming,favorites}):null;
  if(!plan)throw Error('不支援的操作');
  let before=null,staged=null,nextTimers;
  if(timers!==undefined){
   if(!session||typeof timerKey!=='string'||!timers||typeof timers!=='object'||Array.isArray(timers)||Object.keys(timers).length>3000)throw Error('計時資料格式不符');
   before=session.getItem(timerKey);const old=before===null?{}:JSON.parse(before);
   if(!old||typeof old!=='object'||Array.isArray(old))throw Error('目前計時資料無法安全讀取');
   nextTimers={...old};for(const [key,value] of Object.entries(timers)){
    if(!key||key.length>300||['__proto__','prototype','constructor'].includes(key)||!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(value.deadline))throw Error('計時資料格式不符');
    if(!Object.hasOwn(nextTimers,key))nextTimers[key]={deadline:value.deadline};
   }
   staged=JSON.stringify(nextTimers);
   try{session.setItem(timerKey,staged);if(session.getItem(timerKey)!==staged)throw Error('計時資料未能正確保存');}
   catch(error){try{if(before===null)session.removeItem(timerKey);else session.setItem(timerKey,before);}catch{throw Error('計時資料可能需手動恢復，請保留原備份');}throw error;}
  }
  try{if(Object.keys(plan.changes).length)await mixed.apply(plan);}
  catch(error){if(staged!==null){try{if(session.getItem(timerKey)!==staged)throw Error('計時資料已變動');if(before===null)session.removeItem(timerKey);else session.setItem(timerKey,before);}catch(rollback){throw Error('每日題未完成；計時資料可能需手動恢復，請保留原備份：'+rollback.message);}}throw error;}
  return {data:await repository.refresh(),timers:nextTimers,conflicts:plan.conflicts?.length||0,count:plan.count||0};
 }
 return {run};
});
