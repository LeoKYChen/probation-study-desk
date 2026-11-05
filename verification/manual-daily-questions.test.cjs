'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const src=fs.readFileSync('scripts/apps-script/ManualDailyQuestions.gs','utf8');
const original=fs.readFileSync('scripts/apps-script/DailyResourcesSelective.gs','utf8');
const q=(id,question='Some long question')=>({id,question,date:'2026-11-05',subject:'心理學',qualityStatus:'已核對'});
const bank=()=>({schemaVersion:1,count:125,questions:Array.from({length:125},(_,i)=>q('q-'+i)),templates:[],diagnostics:[]});
const bytes=s=>Buffer.from(typeof s==='string'||Array.isArray(s)?s:JSON.stringify(s));
function runtime(extra={}){
 const properties=new Map([['SOURCE_FOLDER_ID','gd-folder'],['MD_SOURCE_FOLDER_ID','md-folder']]);
 const prop={getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)};
 const Utilities={
  Charset:{UTF_8:'UTF-8'},DigestAlgorithm:{SHA_256:'sha256'},
  computeDigest:(algo,source)=>Array.from(crypto.createHash(algo).update(Buffer.isBuffer(source)?source:typeof source==='string'?source:Buffer.from(source)).digest()),
  newBlob:value=>{const b=bytes(value);return {getBytes:()=>Array.from(b),getDataAsString:()=>b.toString('utf8')}}
 };
 const ctx={console,Utilities,MimeType:{GOOGLE_DOCS:'application/vnd.google-apps.document'},
  PropertiesService:{getScriptProperties:()=>prop},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  psdBridgeConfig_:()=>({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock'}),
  mdGoogleId_:(id,n)=>'gd-'+id+'-'+n,mdOrigin_:id=>'md-'+id,...extra};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {ctx,properties};
}
const file=(id,name,modified)=>({getId:()=>id,getName:()=>name,getLastUpdated:()=>new Date(modified)});
const iterator=(list,start=0)=>{let n=start;return {
 hasNext:()=>n<list.length,next:()=>list[n++],getContinuationToken:()=>String(n)
};};
const oldBank=bank();
test('selective uploaded v3.4.2 parser compiles and retains manual-only guarded path',()=>{
 assert.doesNotThrow(()=>new vm.Script(original));
 assert.match(original,/mdCollect_\(filter\)/);
 assert.match(original,/mdReadGoogleBank_\(previous, diagnostics, filter\)/);
 assert.match(original,/if \(filter && filter\.strict\) throw new Error/);
 assert.match(original,/PSD_ALLOW_LEGACY_FULL_SYNC/);
});
test('Drive metadata selection skips confirmed sources and resumes without reading document bodies',()=>{
 const {ctx,properties}=runtime();
 const names=[file('a','A','2026-11-05T00:00:00Z'),file('b','B','2026-11-05T01:00:00Z'),file('c','C','2026-11-05T02:00:00Z')];
 const docs=names.map(x=>({key:'gd-'+x.getId(),metadata:{
  kind:'google',modified:x.getLastUpdated().toISOString(),
  nameSha256:ctx.manualQuestionHash_(x.getName())}}));
 ctx.DriveApp={
  getFolderById:id=>id==='gd-folder'?
   {getFilesByType:()=>iterator(names)}:{getFiles:()=>iterator([])},
  continueFileIterator:token=>iterator(names,Number(token))
 };
 const cfg={google:'gd-folder',markdown:'md-folder'};
 const state={[docs[0].key]:docs[0].metadata};
 const first=ctx.manualQuestionScan_(cfg,state,1,90000);
 assert.equal(first.selected.length,1);assert.equal(first.selected[0].id,'b');
 assert.equal(first.skipped,1);assert.equal(first.cursor.stage,'google');
 assert.equal(first.cursor.token,'2');
 ctx.manualQuestionSaveCursor_(first.cursor);
 const resumed=ctx.manualQuestionScan_(cfg,{...state,[docs[1].key]:docs[1].metadata},1,90000);
 assert.equal(resumed.selected.length,1);assert.equal(resumed.selected[0].id,'c');
 assert.equal(resumed.skipped,0);
 ctx.manualQuestionSaveCursor_(resumed.cursor);
 const final=ctx.manualQuestionScan_(cfg,Object.fromEntries(docs.map(d=>[d.key,d.metadata])),1,90000);
 assert.equal(final.selected.length,0);
 assert.equal(final.cursor,null);
 assert.equal(properties.get('PSD_MANUAL_QUESTIONS_CURSOR'),undefined);
});
test('unmodified source-state fast path avoids parser, source body and GitHub commits',()=>{
 let parseCalls=0,gitWrites=0,bodyCalls=0;
 const qdata=bank(),updated='2026-11-05T00:00:00.000Z';
 const cfg={repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock',google:'gd-folder',markdown:'md-folder'};
 const {ctx}=runtime({mdCollect_:()=>{parseCalls++;throw Error('Parser must not run');}});
 const state={schemaVersion:1,sources:{'gd-a':{kind:'google',modified:updated,
  nameSha256:ctx.manualQuestionHash_('A')}}};
 const json={'daily-simulation/questions.json':qdata,'scripts/sync-state/daily-question-sources.json':state};
 ctx.psdBridgeApi_=(cfg,method,suffix)=>{
  if(method!=='get')gitWrites++;
  if(suffix==='git/ref/heads/main')return {object:{sha:'head'}};
  throw Error('API '+suffix);
 };
 ctx.psdBridgeMeta_=(cfg,path)=>({sha:'sha-'+path,path});
 ctx.psdBridgeBytes_=(cfg,meta)=>Array.from(bytes(JSON.stringify(json[meta.path])));
 ctx.DriveApp={getFolderById:id=>id==='gd-folder'?
  {getFilesByType:()=>iterator([Object.assign(file('a','A',updated),{getBlob:()=>{bodyCalls++;throw Error('Do not read');}})])}
  :{getFiles:()=>iterator([])}};
 const result=ctx.manualSyncDailyQuestions();
 assert.equal(result.mode,'unchanged');
 assert.equal(result.skipped,1);
 assert.equal(parseCalls,0);assert.equal(bodyCalls,0);assert.equal(gitWrites,0);
});
test('atomic commit checkpoints private state without rewriting unchanged published bank or offline JS',()=>{
 const {ctx}=runtime(),before=bank();
 let tree=null,patches=0;
 ctx.psdBridgeApi_=(cfg,method,suffix,payload)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:patches?'next':'head'}};
  if(suffix==='git/commits/head')return {tree:{sha:'original-tree'}};
  if(suffix==='git/trees'){tree=payload.tree;return {sha:'newtree'};}
  if(suffix==='git/commits')return {sha:'next'};
  if(suffix==='git/refs/heads/main'){assert.equal(payload.force,false);patches++;return {};}
  throw Error('Unexpected request '+suffix);
 };
 ctx.psdBridgeMeta_=(pinned,path)=>({sha:'question-sha'});
 const saved=ctx.manualQuestionCommit_({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock'},
  {head:'head',questionSha:'question-sha',data:before},structuredClone(before),
  {schemaVersion:1,sources:{'gd-a':{kind:'google',modified:'2026-11-05T00:00:00Z',nameSha256:'abc'}}});
 assert.equal(saved.questionsChanged,false);
 assert.equal(saved.filesChanged,1);
 assert.equal(tree.length,1);
 assert.equal(tree[0].path,'scripts/sync-state/daily-question-sources.json');
 assert.equal(patches,1);
});
test('new item goes into same atomic commit with questions, source-state and offline bridge',()=>{
 const {ctx}=runtime(),before=bank(),after=structuredClone(before);
 after.questions.push(q('q-new'));after.count++;
 let tree=null,patches=0;
 ctx.psdBridgeApi_=(cfg,method,suffix,payload)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:patches?'next':'head'}};
  if(suffix==='git/commits/head')return {tree:{sha:'original-tree'}};
  if(suffix==='git/trees'){tree=payload.tree;return {sha:'newtree'};}
  if(suffix==='git/commits')return {sha:'next'};
  if(suffix==='git/refs/heads/main'){patches++;return {};}
  throw Error('Unexpected request '+suffix);
 };
 ctx.psdBridgeMeta_=()=>({sha:'question-sha'});
 ctx.psdBridgeBytes_=()=>Array.from(bytes(JSON.stringify({schemaVersion:2,count:1,shards:[{path:'news-shards/'+'a'.repeat(64)+'.json',count:1}]})));
 const saved=ctx.manualQuestionCommit_({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock'},
  {head:'head',questionSha:'question-sha',data:before},after,
  {schemaVersion:1,sources:{'md-a':{kind:'markdown',modified:'2026-11-05T00:00:00Z',nameSha256:'abc'}}});
 assert.equal(saved.questionsChanged,true);
 assert.deepEqual(Array.from(tree,x=>x.path).sort(),['daily-simulation/questions.json',
  'file-data/daily.generated.js','scripts/sync-state/daily-question-sources.json'].sort());
 assert.equal(JSON.parse(tree[0].content).questions.length,126);
 assert.equal(patches,1);
});
test('human-corrected IDs and any old question identity must never be overwritten',()=>{
 const {ctx}=runtime(),before=bank(),after=structuredClone(before);
 before.questions[0].qualityStatus='待訂正';after.questions[0].qualityStatus='待訂正';
 after.questions[0].outline='Source erroneously overwrote correction';
 assert.throws(()=>ctx.manualQuestionValidate_(before,after),/人工訂正/);
 after.questions[0]=structuredClone(before.questions[0]);
 after.questions[1].question='Changed question under old ID';
 assert.throws(()=>ctx.manualQuestionValidate_(before,after),/題號/);
});
test('GitHub HEAD race aborts before writing any commit or source checkpoint',()=>{
 const {ctx}=runtime(),before=bank();
 let writes=0;
 ctx.psdBridgeApi_=(cfg,method,suffix)=>{
  if(method!=='get')writes++;
  if(suffix==='git/ref/heads/main')return {object:{sha:'other-head'}};
  throw Error('Unexpected request '+suffix);
 };
 assert.throws(()=>ctx.manualQuestionCommit_({repo:'LeoKYChen/probation-study-desk',branch:'main',token:'mock'},
  {head:'head',questionSha:'sha',data:before},before,{schemaVersion:1,sources:{}}),/已變動/);
 assert.equal(writes,0);
});
