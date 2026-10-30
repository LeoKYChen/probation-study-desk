/* Test-mode common-subject imports and resets use one IDB transaction. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDCommonSubjectsOperations=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 async function run({core,database,legacy,repository,mixedApi,action,incoming,flags={}}){
  if(!core||!database||!legacy||!repository||!mixedApi)throw Error('缺少共同科目儲存服務');
  await repository.flush();const common=['psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04'];
  if(!common.includes(repository.key))throw Error('資料鍵不符');
  const keys=['probation-study30-v251:v1',core.CONFLICT_KEY,...common];
  if(flags.daily)keys.push('probation-daily-github:records:v1','daily-reading-test:saved');
  if(flags.v25)keys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
  if(flags.lectures)keys.push('psd-lecture-planner-v1');
  const mixed=mixedApi.create({core,database,legacy,managedKeys:keys}),snapshot=await mixed.snapshot();
  if((snapshot[repository.key]??null)!==repository.raw)throw Error('其他分頁已有更新，請重新整理後再操作');
  const raw=JSON.stringify(incoming);core.parseValue(repository.key,raw);let plan;
  if(action==='import')plan=core.plan(snapshot,{format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:'',data:{[repository.key]:raw}});
  else if(action==='clear'){
   const before=snapshot[repository.key]?core.parseValue(repository.key,snapshot[repository.key]):null;
   const archive=snapshot[core.CONFLICT_KEY]?core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]):{schema:core.CONFLICT_KEY,entries:[]};
   const changes={[repository.key]:raw};
   if(before!==null){archive.entries.push({key:repository.key,path:[],existing:incoming,incoming:before,reason:'manual-clear'});changes[core.CONFLICT_KEY]=JSON.stringify(archive);core.parseValue(core.CONFLICT_KEY,changes[core.CONFLICT_KEY]);}
   if(Object.values(changes).reduce((n,v)=>n+v.length,0)>20*1024*1024)throw Error('清除前保留資料超過上限');
   plan={baseline:snapshot,changes};
  }else throw Error('不支援的操作');
  if(Object.keys(plan.changes).length)await mixed.apply(plan);
  try{return {data:await repository.refresh(),conflicts:plan.conflicts?.length||0};}
  catch(error){throw Error('資料可能已寫入，但重新讀取失敗；請保留備份並重新整理：'+error.message);}
 }
 return {run};
});
