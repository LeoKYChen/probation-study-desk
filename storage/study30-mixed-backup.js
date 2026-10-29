/* Transitional adapter: only study30 and its conflict archive are in IndexedDB.
   Other modules remain in localStorage. Not a complete study-desk backup. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDStudy30MixedBackup=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const STUDY='probation-study30-v251:v1';
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 function create({core,database,legacy,origin,managedKeys}){
  if(!core||!database||!legacy)throw Error('缺少備份或資料庫元件');
  const keys=[...core.modules.map(x=>x.key),core.CONFLICT_KEY];
  const managed=managedKeys===undefined?[STUDY,core.CONFLICT_KEY]:managedKeys.slice();
  if(!managed.length||new Set(managed).size!==managed.length||!managed.includes(core.CONFLICT_KEY)||managed.some(key=>!keys.includes(key)))throw Error('已遷移模組清單不正確');
  const validate=(key,raw)=>core.parseValue(key,raw);
  async function checkLegacy(){for(const key of managed)await database.migrate(legacy,[key],validate);}
  async function snapshot(){
   await checkLegacy();
   const before=core.storageSnapshot(legacy),idb=await database.snapshot(managed),after=core.storageSnapshot(legacy);
   if(keys.some(k=>before[k]!==after[k]))throw Error('讀取時資料變更，請關閉其他編輯分頁後重試');
   for(const key of managed){delete after[key];if(own(idb,key))after[key]=idb[key];}
   return after;
  }
  async function collect(){
   const result={format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:String(origin||''),data:await snapshot()};
   core.validate(result);return result;
  }
  async function plan(input){core.validate(input);return core.plan(await snapshot(),input);}
  async function apply(action){
   if(!action||!action.baseline||!action.changes)throw Error('匯入計畫不正確');
   if(Object.keys(action.changes).some(k=>!managed.includes(k)))throw Error('此測試版本只能匯入每日30分鐘等已遷移模組，其他模組尚未整合');
   for(const [key,raw] of Object.entries(action.changes)){if(typeof raw!=='string')throw Error('資料格式不正確');validate(key,raw);}
   const current=await snapshot();
   if(keys.some(key=>current[key]!==action.baseline[key]))throw Error('資料在預覽後已有更新，請重新預覽');
   const baseline=Object.create(null);
   for(const key of managed)if(own(action.baseline,key))baseline[key]=action.baseline[key];
   const count=await database.compareAndSetMany(managed,baseline,action.changes);
   // Cross-database writes are not atomic; detect legacy writers and fail closed.
   await checkLegacy();
   return count;
  }
  return {managedKeys:managed.slice(),snapshot,collect,plan,apply};
 }
 return {create};
});
