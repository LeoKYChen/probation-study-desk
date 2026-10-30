'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./common-subjects-repository.js');await import('../backup/unified-core.js');await import('./study30-mixed-backup.js');
 const api=PSDCommonSubjectsRepository,core=PSDUnifiedBackup,db=await PSDLearningStorage.open(new IDBFactory());
 const samples=[{schema:api.KEYS[0],drafts:{'essay-0':'舊作文'},english:{}},{schema:api.KEYS[1],days:{},completed:{},excluded:{},wordDays:{},wordProgress:{},customWords:{}},{schema:'psd-staresto-v04',days:{},progress:{},cards:{},completedDays:{}}];
 const values=new Map(samples.map((v,i)=>[api.KEYS[i],JSON.stringify(v)])),legacy={getItem:k=>values.get(k)??null};
 for(const [i,key] of api.KEYS.entries()){
  const a=await api.open({database:db,legacy,core,key}),b=await api.open({database:db,legacy,core,key});assert.deepEqual(a.read(),samples[i]);
  const next=structuredClone(samples[i]);next.testMarker='新紀錄';await a.write(next);assert.equal(values.get(key),JSON.stringify(samples[i]));
  await assert.rejects(b.write(samples[i]),/其他分頁/);assert.equal(JSON.parse(await db.get(key)).testMarker,'新紀錄');
 }
 const bridge=PSDStudy30MixedBackup.create({core,database:db,legacy,managedKeys:['probation-study30-v251:v1',core.CONFLICT_KEY,...api.KEYS]});
 const bundle=await bridge.collect();for(const key of api.KEYS)assert.equal(JSON.parse(bundle.data[key]).testMarker,'新紀錄');
 values.set(api.KEYS[0],JSON.stringify({...samples[0],drafts:{'essay-0':'舊版新稿'}}));await assert.rejects(api.open({database:db,legacy,core,key:api.KEYS[0]}),/舊版頁面/);
 assert.equal(JSON.parse(await db.get(api.KEYS[0])).testMarker,'新紀錄');db.close();
 const broken=await PSDLearningStorage.open(new IDBFactory()),bad={getItem:()=>'{bad'};await assert.rejects(api.open({database:broken,legacy:bad,core,key:api.KEYS[1]}));assert.equal(await broken.get(api.KEYS[1]),null);broken.close();
 console.log('PASS common subjects: three legacy modules, retained sources and stale-write protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
