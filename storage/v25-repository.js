/* Experimental adapter. UI and backup callers are not switched yet. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDV25Repository=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='probation-study-desk-v24',V3='probation-study-desk-v3',V2='probation-study-desk-v2',KEYS=[KEY,V3,V2];
 async function open({database,legacy,backup}){
  if(!database||!legacy||!backup||typeof backup.records!=='function')throw Error('缺少考古題儲存服務');
  const validate=(_key,raw)=>{if(!backup.records(JSON.parse(raw)))throw Error('考古題紀錄格式不符');};
  await database.migrate(legacy,KEYS,validate);
  const snapshot=await database.snapshot(KEYS);for(const [key,raw] of Object.entries(snapshot))validate(key,raw);
  return new Repository(database,legacy,validate,snapshot);
 }
 class Repository{
  constructor(database,legacy,validate,snapshot){this.database=database;this.legacy=legacy;this.validate=validate;this.snapshot=snapshot;this.raw=snapshot[KEY]??null;this.tail=Promise.resolve();this.failure=null;}
  read(){
   const source=this.snapshot[KEY]?KEY:this.snapshot[V3]?V3:V2,records=JSON.parse(this.snapshot[source]||'{}');
   if(source===V2&&!this.snapshot[KEY]&&!this.snapshot[V3])for(const state of Object.values(records)){const old=state.scores||{};if(Math.max(...Object.values(old).map(Number),0)<=5){state.scores={issue:Math.round(Number(old.issue||0)*6),rule:Math.round(Number(old.rule||0)*5),analysis:Math.round(Number(old.analysis||0)*5),structure:Math.round(Number(old.structure||0)*4)};state.scoreSource='adjusted';state.assessment=null;}}
   return records;
  }
  write(records){let raw;try{raw=JSON.stringify(records);this.validate(KEY,raw);}catch(e){return Promise.reject(e);}
   const task=this.tail.then(async()=>{if(this.failure)throw this.failure;try{await this.database.migrate(this.legacy,KEYS,this.validate);await this.database.compareAndSet(KEY,this.raw,raw);this.raw=raw;this.snapshot[KEY]=raw;await this.database.migrate(this.legacy,KEYS,this.validate);}catch(e){this.failure=e;throw e;}});this.tail=task.catch(()=>{});return task;
  }
  async flush(){await this.tail;if(this.failure)throw this.failure;}
 }
 return {KEY,V3,V2,open};
});
