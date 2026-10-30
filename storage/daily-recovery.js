/* Test-mode plans; callers must apply through the mixed backup transaction. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDDailyRecovery=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='probation-daily-github:records:v1';
 function planImport({core,snapshot,incoming,favorites,origin='test'}){
  if(!core||!snapshot||!incoming)throw Error('缺少每日題資料');
  const raw=JSON.stringify(incoming);core.parseValue(KEY,raw);
  const data={[KEY]:raw};
  if(favorites!==undefined){const fav=JSON.stringify(favorites);core.parseValue('daily-reading-test:saved',fav);data['daily-reading-test:saved']=fav;}
  return core.plan(snapshot,{format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:origin,data});
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
 function listConflicts({core,snapshot}){
  const entries=snapshot[core.CONFLICT_KEY]?core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]).entries:[],active=snapshot[KEY]?core.parseValue(KEY,snapshot[KEY]):{};
  return entries.flatMap((row,index)=>{
   if(!row||row.key!==KEY||!Array.isArray(row.path)||row.path.length>1||row.path.some(x=>typeof x!=='string'||!x||x.length>=260||['__proto__','prototype','constructor'].includes(x))||!row.existing||typeof row.existing!=='object'||Array.isArray(row.existing)||!row.incoming||typeof row.incoming!=='object'||Array.isArray(row.incoming))return [];
   const main=row.path.length?active[row.path[0]]??null:active;
   return [{index,path:structuredClone(row.path),existing:structuredClone(row.existing),incoming:structuredClone(row.incoming),main:structuredClone(main)}];
  });
 }
 function planRestore({core,snapshot,index,side}){
  if(!['existing','incoming'].includes(side))throw Error('請選擇版本');
  const row=listConflicts({core,snapshot}).find(x=>x.index===index);if(!row)throw Error('找不到每日題衝突版本');
  const target=structuredClone(row[side]),old=structuredClone(row.main),data=snapshot[KEY]?core.parseValue(KEY,snapshot[KEY]):{},archive=core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]);
  const changes={};if(JSON.stringify(old)!==JSON.stringify(target)){
   const next=row.path.length?(data[row.path[0]]=target,data):target;
   changes[KEY]=JSON.stringify(next);core.parseValue(KEY,changes[KEY]);
   if(old!==null&&!archive.entries.some(x=>x.key===KEY&&JSON.stringify(x.path)===JSON.stringify(row.path)&&JSON.stringify(x.incoming)===JSON.stringify(old)))archive.entries.push({key:KEY,path:row.path,existing:target,incoming:old});
  }
  changes[core.CONFLICT_KEY]=JSON.stringify(archive);core.parseValue(core.CONFLICT_KEY,changes[core.CONFLICT_KEY]);
  return {baseline:structuredClone(snapshot),changes};
 }
 return {KEY,planImport,planClear,listConflicts,planRestore};
});
