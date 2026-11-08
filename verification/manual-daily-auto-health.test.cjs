'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('scripts/apps-script/ManualDailyAutoHealth.gs','utf8');
function build(){
 const properties=new Map([['PSD_MANUAL_DAILY_MODE','isolated'],['PSD_MANUAL_DAILY_WRITE_ENABLED','false'],['PSD_MANUAL_DAILY_ISOLATED_BRANCH','feature/manual-incremental-archive-20261105']]);
 const calls={gitWrites:0,triggerCreates:0,parsed:[],triggers:[]};
 const file=(id,name)=>({getId:()=>id,getName:()=>name});
 const it=a=>{let n=0;return {hasNext:()=>n<a.length,next:()=>a[n++]};};
 const md=[file('c','c.md'),file('b','b.md'),file('a','a.md'),file('other','skip.txt')];
 const google=[file('g','g')];
 const old={count:245,questions:Array.from({length:245},(_,i)=>({id:'q-'+i}))};
 const ctx={
   console:{log:()=>{},error:()=>{}},
   PropertiesService:{getScriptProperties:()=>({
     getProperty:k=>properties.get(k)||null,
     setProperty:(k,v)=>properties.set(k,v),
     deleteProperty:k=>properties.delete(k),
     getProperties:()=>Object.fromEntries(properties)
   })},
   LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
   manualQuestionCfg_:()=>({branch:'feature/manual-incremental-archive-20261105',google:'gd',markdown:'md'}),
   psdBridgeApi_:(_cfg,method)=>{if(method!=='get')calls.gitWrites++;return {object:{sha:'a'.repeat(40)}};},
   manualQuestionRead_:()=>({data:{}}),manualQuestionReadMonthly_:()=>old,manualQuestionValidate_:()=>{},
   manualQuestionSourceKey_:(kind,id)=>kind+'-'+id,
   manualQuestionHash_:v=>'digest-'+String(v).length+'-'+String(v).slice(-6),
   mdCollect_:filter=>{
     const id=Array.from(filter.mdIds.size?filter.mdIds:filter.googleIds)[0];
     calls.parsed.push(id);
     if(id==='b')throw Error('沒有可獨立作答的完整題幹');
     return {data:old};
   },
   ScriptApp:{
     getProjectTriggers:()=>calls.triggers.slice(),
     deleteTrigger:t=>{calls.triggers=calls.triggers.filter(x=>x!==t)},
     newTrigger:handler=>({timeBased:()=>({after:()=>({create:()=>{
       calls.triggerCreates++;
       calls.triggers.push({getHandlerFunction:()=>handler});
     }})})})
   },
   MimeType:{GOOGLE_DOCS:'gdoc'},
   DriveApp:{getFolderById:id=>id==='gd'?{getFilesByType:()=>it(google)}:{getFiles:()=>it(md)}}
 };
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {ctx,calls,properties};
}
test('a single start runs first stage, then dedicated continuation completes the batch safely',()=>{
 const {ctx,calls,properties}=build();
 const started=ctx.startManualDailyAutoHealth();
 assert.equal(started.processed,1);
 assert.equal(started.stage,'markdown');
 assert.equal(calls.triggers.length,1);
 const done=ctx.continueManualDailyAutoHealth();
 assert.equal(ctx.statusManualDailyAutoHealth().status,'complete');
 assert.equal(ctx.statusManualDailyAutoHealth().total,4);
 assert.equal(ctx.statusManualDailyAutoHealth().processed,4);
 assert.equal(ctx.statusManualDailyAutoHealth().needsReview,1);
 assert.equal(ctx.statusManualDailyAutoHealth().parsed,3);
 assert.equal(calls.triggers.length,0);
 assert.equal(calls.gitWrites,0);
 assert.deepEqual(calls.parsed,['g','a','b','c']);
});
test('starting with write enabled fails before creating triggers',()=>{
 const {ctx,calls,properties}=build();
 properties.set('PSD_MANUAL_DAILY_WRITE_ENABLED','true');
 assert.throws(()=>ctx.startManualDailyAutoHealth(),/僅允許/);
 assert.equal(calls.triggers.length,0);
 assert.equal(calls.gitWrites,0);
});
