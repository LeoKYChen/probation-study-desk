/* Shared draft adapter for daily-simulation and v2.5 daily-practice.
   Neither page uses it yet. Both must switch together before activation. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDDailySharedRepository=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const RECORDS='probation-daily-github:records:v1',FAVORITES='daily-reading-test:saved';
 async function open({database,legacy,model}){
  if(!database||!legacy||!model||typeof model.records!=='function')throw Error('缺少每日模擬題儲存服務');
  const validate=(key,raw)=>{
   const value=JSON.parse(raw);
   if(key===RECORDS)model.records(value);
   else if(key===FAVORITES&&(!Array.isArray(value)||value.length>3000||!value.every(x=>typeof x==='string'&&x.length<300)))throw Error('題目收藏資料格式不符');
  };
  // Each key has its own idempotent migration marker; if one fails the legacy
  // copies remain and opening is rejected before either page becomes writable.
  for(const key of [RECORDS,FAVORITES])await database.migrate(legacy,[key],validate);
  const snapshot=await database.snapshot([RECORDS,FAVORITES]);
  for(const [key,raw] of Object.entries(snapshot))validate(key,raw);
  return new Repository(database,legacy,validate,snapshot);
 }
 class Repository{
  constructor(database,legacy,validate,snapshot){this.database=database;this.legacy=legacy;this.validate=validate;this.raw=snapshot;this.tail=Promise.resolve();this.failure=null;}
  read(){return {records:JSON.parse(this.raw[RECORDS]||'{}'),favorites:JSON.parse(this.raw[FAVORITES]||'[]')};}
  writeRecords(value){return this.write({[RECORDS]:value});}
  writeFavorites(value){return this.write({[FAVORITES]:value});}
  writeBoth(records,favorites){return this.write({[RECORDS]:records,[FAVORITES]:favorites});}
  write(input){
   const entries=Object.entries(input),changes=Object.create(null);
   try{
    if(!entries.length||entries.some(([key])=>![RECORDS,FAVORITES].includes(key)))throw Error('不支援的資料');
    for(const [key,value] of entries){const raw=JSON.stringify(value);this.validate(key,raw);changes[key]=raw;}
   }catch(e){return Promise.reject(e);}
   const task=this.tail.then(async()=>{
    if(this.failure)throw this.failure;
    try{
     for(const key of [RECORDS,FAVORITES])await this.database.migrate(this.legacy,[key],this.validate);
     const keys=Object.keys(changes),baseline=Object.create(null);
     for(const key of keys)if(Object.prototype.hasOwnProperty.call(this.raw,key))baseline[key]=this.raw[key];
     await this.database.compareAndSetMany(keys,baseline,changes);
     Object.assign(this.raw,changes);
     for(const key of [RECORDS,FAVORITES])await this.database.migrate(this.legacy,[key],this.validate);
    }catch(e){this.failure=e;throw e;}
   });
   this.tail=task.catch(()=>{});return task;
  }
  async flush(){await this.tail;if(this.failure)throw this.failure;}
  async refresh(){
   await this.flush();
   for(const key of [RECORDS,FAVORITES])await this.database.migrate(this.legacy,[key],this.validate);
   const snapshot=await this.database.snapshot([RECORDS,FAVORITES]);
   for(const [key,raw] of Object.entries(snapshot))this.validate(key,raw);
   this.raw=snapshot;return this.read();
  }
 }
 return {RECORDS,FAVORITES,open};
});
