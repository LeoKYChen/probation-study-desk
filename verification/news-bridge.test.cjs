'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const sha=(s)=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
function runtime({legacy=false,weekly=false,monthly=false}={}){
 const part=JSON.stringify({schemaVersion:1,documents:[{id:'news-test',content:'</script>\u2028',date:'2026-11-01'}]});
 const name='news-shards/'+crypto.createHash('sha256').update(part).digest('hex')+'.json';
 const month='2026-11',monthlyPath='archives/'+month+'/index.json';
 const monthlyDocument={schemaVersion:3,count:1,activeMonth:month,months:[{month,status:'open',count:1,index:monthlyPath}],
  catalog:[{id:'news-test',month,date:month+'-01',title:'測試',tags:[]}]};
 const files={'daily-simulation/questions.json':JSON.stringify({questions:Array.from({length:125},(_,i)=>({id:String(i)}))}),
  'daily-simulation/documents.json':JSON.stringify(monthly?monthlyDocument:legacy?{schemaVersion:1,documents:[]}:{schemaVersion:2,count:1,shards:[{path:name,count:1}]}),
  ['daily-simulation/'+name]:part,'juvenile-news/issues.json':JSON.stringify({issues:[]})};
 if(monthly)files['daily-simulation/'+monthlyPath]=JSON.stringify({schemaVersion:1,month,count:1,shards:[{path:name,count:1}]});
 let head='head',pending=[],patches=0,race=false,denied=false;
 const ctx={console,Utilities:{DigestAlgorithm:{SHA_1:'sha1',SHA_256:'sha256'},newBlob:v=>{let b=Buffer.from(v);return {getBytes:()=>Array.from(b),getDataAsString:()=>b.toString()};},computeDigest:(a,b)=>Array.from(crypto.createHash(a).update(Buffer.from(b)).digest()),base64Decode:s=>Array.from(Buffer.from(s,'base64'))}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('scripts/apps-script/OfflineBridge.gs','utf8'),ctx);
 ctx.psdBridgeConfig_=()=>({repo:'test',branch:'main',token:'test'});
 ctx.psdBridgeApi_=(cfg,method,suffix,payload)=>{
  if(suffix==='git/ref/heads/main')return {object:{sha:race?'other':head}};
  if(suffix==='git/commits/'+head)return {tree:{sha:'tree'}};
  if(suffix==='git/trees'){pending=payload.tree;return {sha:'newtree'};}
  if(suffix==='git/commits')return {sha:'next'};
  if(suffix==='git/refs/heads/main'){assert.equal(payload.force,false);patches++;pending.forEach(x=>files[x.path]=x.content);head='next';return {};}
  if(suffix.startsWith('contents/')){
   assert.notEqual(cfg.branch,'main','every content read must be pinned');
   const path=decodeURIComponent(suffix.slice(9).split('?')[0]);
   if(denied&&path.startsWith('file-data/'))throw Object.assign(Error('forbidden'),{httpStatus:403});
   if(!(path in files))throw Object.assign(Error('missing'),{httpStatus:404});
   return {type:'file',sha:sha(files[path]),encoding:'base64',content:Buffer.from(files[path]).toString('base64')};
  }
  throw Error('unexpected '+suffix);
 };
 return {ctx,files,name,run:()=>ctx.psdSyncGeneratedBridge_(weekly?'weekly':'daily'),patches:()=>patches,setRace:()=>{let calls=0;const api=ctx.psdBridgeApi_;ctx.psdBridgeApi_=(...args)=>{if(args[2]==='git/ref/heads/main'&&++calls>1)race=true;return api(...args);};},deny:()=>denied=true};
}
test('creates missing main and shard bridge atomically; second pass makes no commit',()=>{let r=runtime();assert.equal(r.run().files,2);assert.equal(r.patches(),1);assert.equal(r.run().changed,false);assert.equal(r.patches(),1);});
test('repairs missing shard even when main generated file already matches',()=>{let r=runtime();r.run();delete r.files['file-data/'+r.name.replace('.json','.js')];assert.equal(r.run().changed,true);assert.equal(r.patches(),2);});
test('repairs incorrect offline shard bytes',()=>{let r=runtime();r.run();r.files['file-data/'+r.name.replace('.json','.js')]='broken';r.run();assert.equal(r.patches(),2);});
test('corrupt source hash prevents every write',()=>{let r=runtime();r.files['daily-simulation/'+r.name]+=' ';assert.throws(r.run,/雜湊/);assert.equal(r.patches(),0);});
test('missing source shard prevents every write',()=>{let r=runtime();delete r.files['daily-simulation/'+r.name];assert.throws(r.run,/missing/);assert.equal(r.patches(),0);});
test('source count mismatch prevents every write',()=>{let r=runtime();let m=JSON.parse(r.files['daily-simulation/documents.json']);m.count=2;r.files['daily-simulation/documents.json']=JSON.stringify(m);assert.throws(r.run,/總數/);assert.equal(r.patches(),0);});
test('branch movement prevents every ref update',()=>{let r=runtime();r.setRace();assert.throws(r.run,/分支已變動/);assert.equal(r.patches(),0);});
test('permission error is never treated as a missing output',()=>{let r=runtime();r.deny();assert.throws(r.run,/forbidden/);assert.equal(r.patches(),0);});
test('single-file news remains supported',()=>{let r=runtime({legacy:true});assert.equal(r.run().files,1);});
test('weekly bridge remains supported',()=>{let r=runtime({weekly:true});assert.equal(r.run().files,1);});

test('monthly archives generate matching main, month index and shard offline JS',()=>{
 const r=runtime({monthly:true});assert.equal(r.run().files,3);
 assert.equal(r.patches(),1);
 assert.equal(r.run().changed,false);
 assert.equal(r.patches(),1);
 assert(r.files['file-data/archives/2026-11/index.js']);
 assert(r.files['file-data/'+r.name.replace('.json','.js')]);
});
test('damaged monthly source index blocks all writes',()=>{
 const r=runtime({monthly:true}),index=JSON.parse(r.files['daily-simulation/archives/2026-11/index.json']);
 index.count=3;
 r.files['daily-simulation/archives/2026-11/index.json']=JSON.stringify(index);
 assert.throws(()=>r.run(),/月份內索引/);
 assert.equal(r.patches(),0);
});
