/* Experimental storage adapter; no production page is switched to it yet. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDLecturesRepository=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 async function open({database,legacy,core}){
  if(!database||!legacy||!core||typeof core.normalize!=='function'||typeof core.KEY!=='string')throw Error('缺少學習管理儲存服務');
  const key=core.KEY,validate=(_key,raw)=>core.normalize(JSON.parse(raw));
  await database.migrate(legacy,[key],validate);
  const raw=await database.get(key);
  if(raw!==null)validate(key,raw);
  return new Repository(database,legacy,core,validate,raw);
 }
 class Repository{
  constructor(database,legacy,core,validate,raw){this.database=database;this.legacy=legacy;this.core=core;this.validate=validate;this.raw=raw;this.tail=Promise.resolve();this.failure=null;}
  read(){return this.raw===null?this.core.empty():this.core.normalize(JSON.parse(this.raw));}
  write(value){
   let raw;try{raw=JSON.stringify(this.core.normalize(value));}catch(e){return Promise.reject(e);}
   const task=this.tail.then(async()=>{
    if(this.failure)throw this.failure;
    try{
     await this.database.migrate(this.legacy,[this.core.KEY],this.validate);
     await this.database.compareAndSet(this.core.KEY,this.raw,raw);
     this.raw=raw;
     await this.database.migrate(this.legacy,[this.core.KEY],this.validate);
    }catch(e){this.failure=e;throw e;}
   });
   this.tail=task.catch(()=>{});return task;
  }
  async flush(){await this.tail;if(this.failure)throw this.failure;}
  async refresh(){
   await this.flush();await this.database.migrate(this.legacy,[this.core.KEY],this.validate);
   const raw=await this.database.get(this.core.KEY);if(raw!==null)this.validate(this.core.KEY,raw);
   this.raw=raw;return this.read();
  }
 }
 return {open};
});
