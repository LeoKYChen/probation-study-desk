'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('scripts/apps-script/ManualDailySourceInventory.gs','utf8');
function fixture({mode='isolated',enabled='false',state=null}={}){
 const actions={writes:0,reads:0};
 const properties=new Map([['PSD_MANUAL_DAILY_MODE',mode],['PSD_MANUAL_DAILY_WRITE_ENABLED',enabled]]);
 const make=(id,name,modified)=>({getId:()=>id,getName:()=>name,getLastUpdated:()=>new Date(modified)});
 const docs=[make('a','first','2026-11-01T00:00:00Z'),make('b','second','2026-11-02T00:00:00Z')];
 const md=[make('c','notes.md','2026-11-03T00:00:00Z'),make('d','ignore.txt','2026-11-03T00:00:00Z')];
 const iterator=arr=>{let i=0;return {hasNext:()=>i<arr.length,next:()=>arr[i++]};};
 const ctx={
   console:{log:()=>{}},
   PropertiesService:{getScriptProperties:()=>({
     getProperty:k=>properties.get(k)||null,
     setProperty:()=>{actions.writes++;throw Error('write')},
     deleteProperty:()=>{actions.writes++;throw Error('write')}
   })},
   manualQuestionCfg_:()=>({branch:'feature/manual-incremental-archive-20261105',google:'g',markdown:'m'}),
   PSD_DAILY_SOURCE_STATE_PATH_:'scripts/sync-state/daily-question-sources.json',
   psdBridgeApi_:(_cfg,verb)=>{if(verb!=='get')actions.writes++;return {object:{sha:'a'.repeat(40)}};},
   manualQuestionRead_:()=>{actions.reads++;return state?{data:state}:null;},
   manualQuestionSourceKey_:(kind,id)=>kind==='google'?'gd-'+id:'md-'+id,
   manualQuestionHash_:name=>'hash-'+name,
   MimeType:{GOOGLE_DOCS:'gdoc'},
   DriveApp:{getFolderById:id=>id==='g'?{getFilesByType:()=>iterator(docs)}:{getFiles:()=>iterator(md)}}
 };
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {ctx,actions};
}
test('inventory is read-only and counts only Docs and Markdown sources',()=>{
 const {ctx,actions}=fixture();
 const result=ctx.inventoryManualDailyQuestionSources();
 assert.equal(result.mode,'read-only-inventory');
 assert.equal(result.total,3);
 assert.equal(result.google.total,2);
 assert.equal(result.markdown.total,1);
 assert.equal(result.remainingToInspect,3);
 assert.equal(result.sourceStatePresent,false);
 assert.equal(actions.writes,0);
 assert.equal(actions.reads,1);
 assert.equal(JSON.stringify(result).includes('notes.md'),false);
 assert.equal(JSON.stringify(result).includes('gd-a'),false);
});
test('inventory distinguishes unchanged, changed and missing checkpoints without modifying cursor',()=>{
 const known={schemaVersion:1,sources:{
   'gd-a':{kind:'google',modified:'2026-11-01T00:00:00.000Z',nameSha256:'hash-first'},
   'gd-b':{kind:'google',modified:'2026-11-01T00:00:00.000Z',nameSha256:'hash-second'}
 }};
 const {ctx,actions}=fixture({state:known});
 const result=ctx.inventoryManualDailyQuestionSources();
 assert.equal(result.google.unchangedCheckpoint,1);
 assert.equal(result.google.changedCheckpoint,1);
 assert.equal(result.google.withoutCheckpoint,0);
 assert.equal(result.markdown.withoutCheckpoint,1);
 assert.equal(result.remainingToInspect,2);
 assert.equal(actions.writes,0);
});
test('inventory refuses execution outside isolated mode or when write flag enabled',()=>{
 for(const opts of [{mode:'production'},{enabled:'true'}]){
   const {ctx,actions}=fixture(opts);
   assert.throws(()=>ctx.inventoryManualDailyQuestionSources(),/只允許隔離/);
   assert.equal(actions.reads,0);
   assert.equal(actions.writes,0);
 }
});
