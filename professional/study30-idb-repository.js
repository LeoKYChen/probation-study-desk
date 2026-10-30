/* Development-only repository for the daily 30-minute module.
   The page does not yet use it: backup, review, AI and PWA paths must be migrated together. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Study30IndexedRepository=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='probation-study30-v251:v1';
 function validate(raw){
  const value=JSON.parse(raw);
  if(!value || value.version!==1 || !value.sessions || typeof value.sessions!=='object' || Array.isArray(value.sessions)) throw Error('每日30分鐘紀錄格式不符');
  return value;
 }
 async function open({database,legacy}){
  if(!database || !legacy)throw Error('缺少儲存服務');
  await database.migrate(legacy,[KEY],(_key,raw)=>validate(raw));
  const raw=await database.get(KEY);
  if(raw!==null)validate(raw);
  return new Repository(database,legacy,raw);
 }
 class Repository {
  constructor(database,legacy,raw){this.database=database;this.legacy=legacy;this.raw=raw;this.tail=Promise.resolve();this.failure=null;}
  read(){return this.raw===null?{version:1,sessions:{}}:validate(this.raw);}
  write(value){
   let raw;
   try {raw=JSON.stringify(value);validate(raw);} catch(e) {return Promise.reject(e);}
   const task=this.tail.then(async()=>{
    if(this.failure)throw this.failure;
    try{
     // Old tabs may keep writing localStorage after initial migration. Stop and
     // preserve both versions when detected. This cannot lock legacy writers.
     await this.database.migrate(this.legacy,[KEY],(_key,text)=>validate(text));
     await this.database.compareAndSet(KEY,this.raw,raw);
     this.raw=raw;
     await this.database.migrate(this.legacy,[KEY],(_key,text)=>validate(text));
    }catch(e){this.failure=e;throw e;}
   });
   // Preserve the rejection for the caller while allowing flush and later writes
   // to report the same failure without unhandled promise rejections.
   this.tail=task.catch(()=>{});
   return task;
  }
  async flush(){await this.tail;if(this.failure)throw this.failure;}
 }
 return {KEY,validate,open};
});
