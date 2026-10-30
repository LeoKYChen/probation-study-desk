/* Experimental common-subjects storage; pages do not use it by default. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDCommonSubjectsRepository=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEYS=['psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04'];
 async function open({database,legacy,core,key}){
  if(!database||!legacy||!core||!KEYS.includes(key))throw Error('共同科目儲存服務或資料鍵不符');
  const validate=(k,raw)=>core.parseValue(k,raw);
  await database.migrate(legacy,[key],validate);
  const raw=await database.get(key);if(raw!==null)validate(key,raw);
  return new Repository(database,legacy,key,validate,raw);
 }
 class Repository{
  constructor(database,legacy,key,validate,raw){Object.assign(this,{database,legacy,key,validate,raw});this.tail=Promise.resolve();this.failure=null;}
  read(){return this.raw===null?null:JSON.parse(this.raw);}
  write(value){let raw;try{raw=JSON.stringify(value);this.validate(this.key,raw);}catch(e){return Promise.reject(e);}
   const task=this.tail.then(async()=>{if(this.failure)throw this.failure;try{await this.database.migrate(this.legacy,[this.key],this.validate);await this.database.compareAndSet(this.key,this.raw,raw);this.raw=raw;await this.database.migrate(this.legacy,[this.key],this.validate);}catch(e){this.failure=e;throw e;}});
   this.tail=task.catch(()=>{});return task;
  }
  async flush(){await this.tail;if(this.failure)throw this.failure;}
  async refresh(){await this.flush();await this.database.migrate(this.legacy,[this.key],this.validate);const raw=await this.database.get(this.key);if(raw!==null)this.validate(this.key,raw);this.raw=raw;return this.read();}
 }
 return {KEYS,open};
});
