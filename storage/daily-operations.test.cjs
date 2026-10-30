'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 for(const file of ['./indexeddb.js','./study30-mixed-backup.js','./daily-shared-repository.js','./daily-recovery.js','./daily-operations.js','../backup/unified-core.js','../daily-simulation/model.js'])await import(file);
 const database=await PSDLearningStorage.open(new IDBFactory()),values=new Map(),legacy={getItem:k=>values.get(k)??null};
 const repository=await PSDDailySharedRepository.open({database,legacy,model:PracticeModel}),other=await PSDDailySharedRepository.open({database,legacy,model:PracticeModel});
 const base={'q':{answer:'原答案',review:false,updatedAt:'2099-01-01'}};await repository.writeRecords(base);
 const args={core:PSDUnifiedBackup,database,legacy,repository,recovery:PSDDailyRecovery,mixedApi:PSDStudy30MixedBackup};
 const merged=await PSDDailyOperations.run({...args,action:'import',incoming:{q:{answer:'另一答案',review:false,updatedAt:'2099-01-02'}}});assert.equal(merged.conflicts,1);assert.equal(merged.data.records.q.answer,'原答案');
 await assert.rejects(PSDDailyOperations.run({...args,repository:other,action:'clear'}),/其他分頁/);
 const result=await PSDDailyOperations.run({...args,action:'clear'});assert.equal(result.count,1);assert.deepEqual(result.data.records,{});
 const archive=JSON.parse(await database.get(PSDUnifiedBackup.CONFLICT_KEY));assert.ok(JSON.stringify(archive).includes('原答案'));assert.ok(JSON.stringify(archive).includes('另一答案'));
 await PSDDailyOperations.run({...args,action:'import',incoming:base});assert.equal(repository.read().records.q.answer,'原答案');
 assert.equal(legacy.getItem(PSDDailyRecovery.KEY),null);database.close();console.log('PASS daily operations: import, preserved conflicts, clear and stale editor');
})().catch(e=>{console.error(e);process.exitCode=1;});
