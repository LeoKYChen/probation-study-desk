'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./study30-mixed-backup.js');await import('../backup/unified-core.js');
 const core=PSDUnifiedBackup,db=await PSDLearningStorage.open(new IDBFactory()),key='lawScoring.v2',read='jj-read';
 const data=new Map([[key,JSON.stringify({q:{answer:'本機'}})],[read,JSON.stringify(['old'])]]);
 let failing=false;const legacy={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{if(failing&&k===read)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)};
 const opts={core,database:db,legacy,origin:'test',managedKeys:['probation-study30-v251:v1',core.CONFLICT_KEY],allowLegacyWrites:true};
 const bridge=PSDStudy30MixedBackup.create(opts),base=await bridge.collect();
 const imported={...base,data:{[key]:JSON.stringify({q:{answer:'雲端'},q2:{answer:'新增'}}),[read]:JSON.stringify(['old','new'])}};
 const plan=await bridge.plan(imported);await bridge.apply(plan);
 assert.equal(JSON.parse(data.get(key)).q.answer,'本機');assert.equal(JSON.parse(data.get(key)).q2.answer,'新增');assert.deepEqual(JSON.parse(data.get(read)),['old','new']);assert.ok((await db.get(core.CONFLICT_KEY)).includes('雲端'));
 const another={...base,data:{[key]:JSON.stringify({q3:{answer:'續增'}}),[read]:JSON.stringify(['third'])}},stale=await bridge.plan(another);
 data.set(read,JSON.stringify(['external']));await assert.rejects(bridge.apply(stale),/重新預覽/);assert.equal(JSON.parse(data.get(key)).q3,undefined);
 const retry=await bridge.plan(another),before=new Map(data);failing=true;await assert.rejects(bridge.apply(retry),/舊模組匯入未完成/);failing=false;assert.equal(data.get(key),before.get(key));assert.equal(data.get(read),before.get(read));
 db.close();console.log('PASS mixed legacy restore: merges, preserves conflicts, rejects stale data and rolls back quota errors');
})().catch(e=>{console.error(e);process.exitCode=1});
