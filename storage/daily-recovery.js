/* Test-mode plans; callers must apply through the mixed backup transaction. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDDailyRecovery=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='probation-daily-github:records:v1';
 function planImport({core,snapshot,incoming,origin='test'}){
  if(!core||!snapshot||!incoming)throw Error('缺少每日題資料');
  const raw=JSON.stringify(incoming);core.parseValue(KEY,raw);
  return core.plan(snapshot,{format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:origin,data:{[KEY]:raw}});
 }
 function planClear({core,snapshot}){
  if(!core||!snapshot)throw Error('缺少每日題資料');
  const previous=snapshot[KEY]?core.parseValue(KEY,snapshot[KEY]):{};
  if(!Object.keys(previous).length)return {baseline:structuredClone(snapshot),changes:{},count:0};
  const archive=snapshot[core.CONFLICT_KEY]?core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]):{schema:core.CONFLICT_KEY,entries:[]};
  archive.entries.push({key:KEY,path:[],existing:{},incoming:previous,reason:'manual-clear'});
  const changes={[KEY]:'{}',[core.CONFLICT_KEY]:JSON.stringify(archive)};
  if(changes[core.CONFLICT_KEY].length>20*1024*1024)throw Error('清除前保留紀錄超過上限，請先分開備份');
  for(const [key,raw] of Object.entries(changes))core.parseValue(key,raw);
  return {baseline:structuredClone(snapshot),changes,count:Object.keys(previous).length};
 }
 return {KEY,planImport,planClear};
});
