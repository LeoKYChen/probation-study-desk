'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=['scripts/apps-script/ManualDailyQuestions.gs','scripts/apps-script/ManualCutoverPreflight.gs']
  .map(p=>fs.readFileSync(p,'utf8')).join('\n');
const HEAD='a'.repeat(40),BRANCH='feature/manual-incremental-archive-20261105';
function build({isolated=false,write=false,approved=false,monthly=true,oldTimers=false}={}){
  let apiWrites=0,scriptWrites=0,folderReads=0,fileReads=0;
  const properties=new Map([
    ['SOURCE_FOLDER_ID','google-id'],['MD_SOURCE_FOLDER_ID','markdown-id'],
    ['GITHUB_BRANCH','main'],['PSD_MANUAL_DAILY_MODE',isolated?'isolated':'production'],
    ['PSD_MANUAL_DAILY_ISOLATED_BRANCH',isolated?BRANCH:''],
    ['PSD_MANUAL_DAILY_WRITE_ENABLED',write?'true':'false'],
    ['PSD_MANUAL_DAILY_PRODUCTION_APPROVED_SHA',approved?HEAD:'']
  ]);
  const props={
    getProperty:k=>properties.get(k)||null,
    setProperty:()=>{scriptWrites++;throw Error('Read-only preflight wrote properties');},
    deleteProperty:()=>{scriptWrites++;throw Error('Read-only preflight deleted properties');}
  };
  const ctx={
    console:{log(){}},PropertiesService:{getScriptProperties:()=>props},
    DriveApp:{getFolderById:()=>{folderReads++;return {}}},
    ScriptApp:{EventType:{CLOCK:'CLOCK'},getProjectTriggers:()=>oldTimers?[
      {getEventType:()=> 'CLOCK',getHandlerFunction:()=> 'syncDailyResources'},
      {getEventType:()=> 'ON_EDIT',getHandlerFunction:()=> 'syncReadingNews'}
    ]:[]},
    psdBridgeConfig_:()=>({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'secret-not-to-log'}),
    psdBridgeApi_:(cfg,verb,path)=>{if(verb!=='get')apiWrites++;if(path.startsWith('git/ref/heads/'))return {object:{sha:HEAD}};throw Error('Unexpected API path '+path)},
    psdBridgeMeta_:(cfg,p)=>{if(!p.startsWith('file-data/'))throw Error('Unexpected GitHub path');return {sha:'blob'}},
    manualQuestionRead_:(cfg,p,sha,optional)=>{
      fileReads++;
      if(p==='daily-simulation/questions-monthly.json')
        return monthly?{sha:'master-hash',data:{schemaVersion:2,count:245,months:[{shards:[{path:'question-shards/'+'b'.repeat(64)+'.json'}]}]}}:null;
      if(p==='daily-simulation/questions.json')return {data:{count:245,questions:Array.from({length:245},(_,i)=>({id:'q-'+i,date:'2026-11-05',subject:'心理學',question:'Question '+i}))}};
      if(p==='scripts/sync-state/daily-question-sources.json')return null;
      throw Error('Unexpected requested path '+p);
    },
    manualQuestionReadMonthly_:()=>({count:245,questions:Array.from({length:245},(_,i)=>({
      id:'q-'+i,date:'2026-11-05',subject:'心理學',question:'Question '+i
    }))}),
    manualQuestionValidate_:()=>{}
  };
  const fixtureRead=ctx.manualQuestionRead_;
  vm.createContext(ctx);vm.runInContext(source,ctx);
  // Override the production GitHub fetcher with this isolated, read-only fixture.
  ctx.manualQuestionRead_=fixtureRead;
  return {ctx,properties,stats:()=>({apiWrites,scriptWrites,folderReads,fileReads})};
}
test('manual cutover preflight is strictly read-only and blocks missing monthly manifest',()=>{
 const a=build({monthly:false,oldTimers:true});
 const r=a.ctx.preflightManualDailyQuestions();
 assert.equal(r.readyForManualSync,false);
 assert.equal(r.monthlyIndexPresent,false);
 assert.equal(r.sourceFoldersAccessible,true);
 assert.equal(r.oldTimeTriggers.length,1);
 assert(r.blockers.some(x=>x.includes('月份題庫')));
 assert.equal(a.stats().apiWrites,0);assert.equal(a.stats().scriptWrites,0);
});
test('valid isolated branch is allowed only with explicit isolated mode and write flag',()=>{
 const a=build({isolated:true,write:true});
 const r=a.ctx.preflightManualDailyQuestions();
 assert.equal(r.branch,BRANCH);
 assert.equal(r.readyForManualSync,true,JSON.stringify(r.blockers));
 assert.equal(r.legacyBaselinePreserved,true);
 assert.equal(r.offlineFileCount,2);
 assert.equal(a.stats().apiWrites,0);assert.equal(a.stats().scriptWrites,0);
});
test('production main is blocked until explicitly approved with exact current commit SHA',()=>{
 const a=build({write:true});
 const pre=a.ctx.preflightManualDailyQuestions();
 assert.equal(pre.writeAuthorized,false);
 assert.equal(pre.readyForManualSync,false);
 assert(pre.blockers.length>0||typeof pre.writeBlockReason==='string','Preflight must explain denial');
 assert.throws(()=>a.ctx.manualQuestionWriteGate_({branch:'main'},HEAD,{data:{schemaVersion:2,count:245}}),/main/);
 const b=build({write:true,approved:true});
 const accepted=b.ctx.preflightManualDailyQuestions();
 assert.equal(accepted.writeAuthorized,true,JSON.stringify(accepted));
 assert.equal(accepted.readyForManualSync,true,JSON.stringify(accepted.blockers));
});
test('writer guard rejects no monthly archive, missing approval and mismatched branch',()=>{
 const a=build({write:true,approved:true});
 const v={data:{schemaVersion:2,count:245}};
 assert.throws(()=>a.ctx.manualQuestionWriteGate_({branch:'main'},HEAD,null),/月份索引/);
 assert.equal(a.ctx.manualQuestionWriteGate_({branch:'main'},HEAD,v),true);
 const b=build({isolated:true,write:true});
 assert.throws(()=>b.ctx.manualQuestionWriteGate_({branch:'release/other'},HEAD,v),/隔離分支/);
 assert.equal(b.ctx.manualQuestionWriteGate_({branch:BRANCH},HEAD,v),true);
});
