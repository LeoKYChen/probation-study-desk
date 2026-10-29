/* Async IndexedDB adapter for the existing unified backup merge rules.
   Not connected to the backup UI or Drive until every participating module has migrated. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDIndexedBackup=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function create(core,store,origin){
  if(!core || !store || typeof store.snapshot!=='function' || typeof store.compareAndSetMany!=='function')throw Error('缺少備份或資料庫元件');
  const keys=[...core.modules.map(x=>x.key),core.CONFLICT_KEY];
  async function snapshot(){return store.snapshot(keys);}
  function bundle(data){
   const result={format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:String(origin||''),data};
   core.validate(result);
   return result;
  }
  async function collect(){return bundle(await snapshot());}
  async function plan(input){
   core.validate(input);
   return core.plan(await snapshot(),input);
  }
  async function apply(action){
   if(!action || !action.baseline || !action.changes)throw Error('無效的匯入計畫');
   const allowed=new Set(keys);
   for(const [key,raw] of Object.entries(action.changes)){
    if(!allowed.has(key) || typeof raw!=='string')throw Error('不支援的儲存項目');
    core.parseValue(key,raw);
   }
   // All baseline comparisons and changes happen in the same IDB transaction.
   return store.compareAndSetMany(keys,action.baseline,action.changes);
  }
  return {keys:keys.slice(),snapshot,collect,plan,apply};
 }
 return {create};
});
