'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/apps-script/ManualDailyReadOnlyPages.gs','utf8');
function runtime(flag='false'){
 const events={writes:0,parsed:0};
 const file=(id,name)=>({getId:()=>id,getName:()=>name});
 const iterator=files=>{let n=0;return {hasNext:()=>n<files.length,next:()=>files[n++]};};
 const original={count:245,questions:Array.from({length:245},(_,i)=>({id:'q-'+i}))};
 const ctx={
  console:{log:()=>{}},
  PropertiesService:{getScriptProperties:()=>({
    getProperty:k=>({PSD_MANUAL_DAILY_MODE:'isolated',PSD_MANUAL_DAILY_WRITE_ENABLED:flag})[k],
    setProperty:()=>{events.writes++;throw Error('unexpected property write');},
    deleteProperty:()=>{events.writes++;throw Error('unexpected property delete');}
  })},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  manualQuestionCfg_:()=>({branch:'feature/manual-incremental-archive-20261105',google:'g',markdown:'m'}),
  psdBridgeApi_:(_cfg,method)=>{if(method!=='get')events.writes++;return {object:{sha:'a'.repeat(40)}};},
  manualQuestionRead_:()=>({data:{}}),manualQuestionReadMonthly_:()=>original,
  manualQuestionValidate_:()=>{},
  manualQuestionSourceKey_:(kind,id)=>kind+'-'+id,
  mdCollect_:filter=>{
   events.parsed++;
   assert.equal(filter.googleIds.size,0);
   assert.deepEqual(Array.from(filter.mdIds).sort(),['a','b','c']);
   return {data:{count:245,questions:original.questions,diagnostics:[]}};
  },
  MimeType:{GOOGLE_DOCS:'gdoc'},
  DriveApp:{getFolderById:id=>id==='m'?{getFiles:()=>iterator([
    file('c','c.md'),file('x','ignore.txt'),file('b','b.md'),file('a','a.md'),file('d','d.md')
  ])}:{getFilesByType:()=>iterator([])}},
  Set
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,events};
}
test('read-only pages choose stable first markdown page and never update state',()=>{
 const {ctx,events}=runtime(),result=ctx.previewManualDailySourcePage();
 assert.equal(result.mode,'read-only-source-page');
 assert.equal(result.totalSources,4);
 assert.equal(result.totalPages,2);
 assert.equal(result.selected,3);
 assert.equal(result.oldQuestions,245);
 assert.equal(result.proposedCount,245);
 assert.equal(events.parsed,1);
 assert.equal(events.writes,0);
});
test('read-only pages cannot run when write flag is enabled',()=>{
 const {ctx,events}=runtime('true');
 assert.throws(()=>ctx.previewManualDailySourcePage(),/僅限/);
 assert.equal(events.parsed,0);
 assert.equal(events.writes,0);
});
