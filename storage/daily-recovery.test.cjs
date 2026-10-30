'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./study30-mixed-backup.js');await import('./daily-recovery.js');await import('../backup/unified-core.js');
 const core=PSDUnifiedBackup,api=PSDDailyRecovery,db=await PSDLearningStorage.open(new IDBFactory()),raw=JSON.stringify({'q-1':{answer:'原答案',review:false,updatedAt:'2099-01-01'}}),map=new Map([[api.KEY,raw]]),legacy={getItem:k=>map.get(k)??null};
 const bridge=PSDStudy30MixedBackup.create({core,database:db,legacy,managedKeys:['probation-study30-v251:v1',core.CONFLICT_KEY,api.KEY,'daily-reading-test:saved']});
 let snapshot=await bridge.snapshot(),plan=api.planImport({core,snapshot,incoming:{'q-1':{answer:'不同答案',review:false,updatedAt:'2099-01-02'},'q-2':{answer:'新增',review:true,updatedAt:'2099-01-02'}}});
 await bridge.apply(plan);snapshot=await bridge.snapshot();assert.equal(JSON.parse(snapshot[api.KEY])['q-1'].answer,'原答案');assert.ok(snapshot[core.CONFLICT_KEY].includes('不同答案'));assert.equal(JSON.parse(snapshot[api.KEY])['q-2'].answer,'新增');
 const clear=api.planClear({core,snapshot});assert.equal(clear.count,2);await bridge.apply(clear);const after=await bridge.snapshot();assert.deepEqual(JSON.parse(after[api.KEY]),{});assert.ok(after[core.CONFLICT_KEY].includes('原答案'));assert.equal(legacy.getItem(api.KEY),raw);
 await assert.rejects(bridge.apply(clear),/重新預覽/);
 const restore=api.planImport({core,snapshot:after,incoming:JSON.parse(raw)});await bridge.apply(restore);assert.equal(JSON.parse(await db.get(api.KEY))['q-1'].answer,'原答案');
 db.close();console.log('PASS daily import, conflict retention, clear archive, restore and stale guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
