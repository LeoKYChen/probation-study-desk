'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('scripts/apps-script/ManualDailyBatchHealth.gs','utf8');
function fixture(flag='false') {
 const calls={writes:0,parsed:[]};
 const f=(id,name)=>({getId:()=>id,getName:()=>name});
 const sources=[f('b','b.md'),f('a','a.md'),f('c','c.md'),f('d','ignored.txt')];
 const iter=files=>{let i=0;return {hasNext:()=>i<files.length,next:()=>files[i++]};};
 const original={count:245,questions:Array.from({length:245},(_,i)=>({id:'q'+i}))};
 const ctx={
   console:{log:()=>{}},
   Number,Set,
   PropertiesService:{getScriptProperties:()=>({
     getProperty:key=>({PSD_MANUAL_DAILY_MODE:'isolated',PSD_MANUAL_DAILY_WRITE_ENABLED:flag})[key],
     setProperty:()=>{calls.writes++;throw Error('write')},
     deleteProperty:()=>{calls.writes++;throw Error('write')}
   })},
   LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
   manualQuestionCfg_:()=>({branch:'feature/manual-incremental-archive-20261105',google:'g',markdown:'m'}),
   psdBridgeApi_:(_cfg,verb)=>{if(verb!=='get')calls.writes++;return {object:{sha:'a'.repeat(40)}};},
   manualQuestionRead_:()=>({data:{}}),
   manualQuestionReadMonthly_:()=>original,
   manualQuestionValidate_:()=>{},
   manualQuestionSourceKey_:(kind,id)=>'md-'+id,
   mdCollect_:filters=>{
     const id=Array.from(filters.mdIds)[0];calls.parsed.push(id);
     if(id==='b')throw Error('沒有可獨立作答的完整題幹');
     const extra=id==='c'?[{id:'new-c',date:'2026-10-17',subject:'心理學'}]:[];
     return {data:{count:245+extra.length,questions:original.questions.concat(extra)}};
   },
   MimeType:{GOOGLE_DOCS:'gdoc'},
   DriveApp:{getFolderById:()=>({getFiles:()=>iter(sources)})}
 };
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {ctx,calls};
}
test('per-source errors are recorded without stopping subsequent sources or writing',()=>{
 const {ctx,calls}=fixture();
 const result=ctx.healthCheckManualDailySourceBatch();
 assert.equal(result.selected,3);
 assert.deepEqual(calls.parsed,['a','b','c']);
 assert.equal(result.counts.parsed,2);
 assert.equal(result.counts.needsReview,1);
 assert.equal(result.counts.newCandidates,1);
 assert.equal(result.files[1].status,'needs-review');
 assert.equal(result.files[2].newCandidateCount,1);
 assert.equal(result.oldQuestions,245);
 assert.equal(calls.writes,0);
});
test('health check rejects enabled write flag before opening sources',()=>{
 const {ctx,calls}=fixture('true');
 assert.throws(()=>ctx.healthCheckManualDailySourceBatch(),/只允許/);
 assert.deepEqual(calls.parsed,[]);
 assert.equal(calls.writes,0);
});
