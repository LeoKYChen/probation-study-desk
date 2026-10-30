'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 for(const file of ['./indexeddb.js','./study30-mixed-backup.js','./v25-operations.js','../v2.5/backup-core.js','../backup/unified-core.js'])await import(file);
 const core=PSDUnifiedBackup,db=await PSDLearningStorage.open(new IDBFactory()),study='probation-study-desk-v24',v3='probation-study-desk-v3',daily='probation-daily-github:records:v1',old=JSON.stringify({q1:{issue:'舊版答案'}}),map=new Map([[v3,old]]),legacy={getItem:k=>map.get(k)??null};
 const bridge=PSDStudy30MixedBackup.create({core,database:db,legacy,managedKeys:['probation-study30-v251:v1',core.CONFLICT_KEY,study,v3,'probation-study-desk-v2',daily,'daily-reading-test:saved']});let snapshot=await bridge.snapshot();
 const input=Backup25.create({q1:{issue:'匯入答案'},q2:{issue:'新增答案'}},{d1:{answer:'每日答案',review:false,updatedAt:'2099'}});
 const plan=PSDV25Operations.importPlan({core,backup:Backup25,snapshot,incoming:input,active:JSON.parse(old)});await bridge.apply(plan);snapshot=await bridge.snapshot();assert.equal(JSON.parse(snapshot[study]).q1.issue,'舊版答案');assert.equal(JSON.parse(snapshot[study]).q2.issue,'新增答案');assert.ok(snapshot[core.CONFLICT_KEY].includes('匯入答案'));assert.equal(legacy.getItem(v3),old);await assert.rejects(bridge.apply(plan),/重新預覽/);
 const clear=PSDV25Operations.clearPlan({core,snapshot});await bridge.apply(clear);snapshot=await bridge.snapshot();assert.deepEqual(JSON.parse(snapshot[study]),{});assert.deepEqual(JSON.parse(snapshot[daily]),{});
 const row=core.listV25Conflicts(snapshot).find(x=>x.key===study&&!x.path.length);assert.ok(row);const restore=core.planV25ConflictRestore(snapshot,row.index,'incoming');await bridge.apply(restore);assert.equal(JSON.parse(await db.get(study)).q1.issue,'舊版答案');await assert.rejects(bridge.apply(restore),/重新預覽/);
 db.close();console.log('PASS v2.5 import with older fallback, clear archive, recovery and stale guard');
})().catch(e=>{console.error(e);process.exitCode=1});
