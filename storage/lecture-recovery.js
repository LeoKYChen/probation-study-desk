/* Test-mode recovery for validated learning-management conflict versions. */
(function(root,factory){'use strict';const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PSDLectureRecovery=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';const KEY='psd-lecture-planner-v1',equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function list({core,lecture,snapshot}){
  if(!snapshot[KEY])return [];const state=lecture.normalize(core.parseValue(KEY,snapshot[KEY])),entries=snapshot[core.CONFLICT_KEY]?core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]).entries:[];
  return entries.flatMap((row,index)=>{
   if(!row||row.key!==KEY||!Array.isArray(row.path)||!Object.hasOwn(row,'existing')||!Object.hasOwn(row,'incoming'))return [];
   let main;const [section,id]=row.path;
   if(row.path.length===1&&['settings','plan'].includes(section))main=state[section]??null;
   else if(row.path.length===2&&['courses','lessons','activities'].includes(section)&&typeof id==='string'&&id.length>0&&id.length<=250)main=state[section].find(x=>x.id===id)??null;
   else return [];
   return [{index,path:structuredClone(row.path),main:structuredClone(main),existing:structuredClone(row.existing),incoming:structuredClone(row.incoming)}];
  });
 }
 function planRestore({core,lecture,snapshot,index,side}){
  if(!['existing','incoming'].includes(side))throw Error('請選擇版本');const row=list({core,lecture,snapshot}).find(x=>x.index===index);if(!row)throw Error('找不到學習管理衝突版本');
  const target=structuredClone(row[side]),old=structuredClone(row.main),state=lecture.normalize(core.parseValue(KEY,snapshot[KEY])),archive=core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]),changes={};
  if(!equal(target,old)){
   const [section,id]=row.path;
   if(row.path.length===1)state[section]=target;
   else{const rows=state[section],i=rows.findIndex(x=>x.id===id);if(target===null){if(i>=0)rows.splice(i,1);}else{if(!target||target.id!==id)throw Error('學習紀錄識別碼不符');if(i<0)rows.push(target);else rows[i]=target;}}
   // Validate the complete state, including course and activity references.
   const validated=lecture.normalize(state);changes[KEY]=JSON.stringify(validated);core.parseValue(KEY,changes[KEY]);
   if(!archive.entries.some(x=>x.key===KEY&&equal(x.path,row.path)&&equal(x.incoming,old)))archive.entries.push({key:KEY,path:row.path,existing:target,incoming:old});
  }
  changes[core.CONFLICT_KEY]=JSON.stringify(archive);core.parseValue(core.CONFLICT_KEY,changes[core.CONFLICT_KEY]);return {baseline:structuredClone(snapshot),changes};
 }
 return {KEY,list,planRestore};
});
