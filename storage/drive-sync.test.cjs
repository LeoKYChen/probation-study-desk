'use strict';
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js'); await import('./backup-bridge.js'); await import('./drive-sync.js');
 await import('../backup/unified-core.js'); await import('../backup/drive-sync-core.js');
 const core=globalThis.PSDUnifiedBackup,protocol=globalThis.PSDDriveSyncCore;
 const storeA=await PSDLearningStorage.open(new IDBFactory()), storeB=await PSDLearningStorage.open(new IDBFactory());
 const backupA=PSDIndexedBackup.create(core,storeA,'https://example.test'), backupB=PSDIndexedBackup.create(core,storeB,'https://example.test');
 const snapshots=[]; const transport={
  async ensureFolder(){return 'folder'}, async listSnapshots(){return snapshots.map((s,i)=>({id:String(i),createdTime:s.createdAt}))},
  async readSnapshot(id){return snapshots[Number(id)]}, async writeSnapshot(_folder,payload){snapshots.push(payload);return {id:String(snapshots.length-1)}}
 };
 let sequence=0;
 const engine=(backup,id)=>PSDIndexedDrive.create({core,protocol,backup,transport,deviceId:id,origin:'https://example.test',newId:()=>id+'-'+(++sequence),clock:()=>new Date(Date.UTC(2026,9,29,0,0,sequence++)).toISOString()});
 const key='probation-study-desk-v24';
 await storeA.compareAndSet(key,null,JSON.stringify({Q1:{issue:'版本甲'}}));
 assert.equal((await engine(backupA,'A').sync()).uploaded,true);
 assert.equal((await engine(backupB,'B').sync()).uploaded,false);
 assert.equal(JSON.parse(await storeB.get(key)).Q1.issue,'版本甲');
 const oldA=await storeA.get(key),oldB=await storeB.get(key);
 await storeA.compareAndSet(key,oldA,JSON.stringify({Q1:{issue:'手機版本'}}));
 await storeB.compareAndSet(key,oldB,JSON.stringify({Q1:{issue:'電腦版本'}}));
 await engine(backupA,'A').sync(); await engine(backupB,'B').sync();
 assert.equal(JSON.parse(await storeB.get(key)).Q1.issue,'電腦版本');
 assert.ok(JSON.stringify(JSON.parse(await storeB.get(core.CONFLICT_KEY)).entries).includes('手機版本'));
 assert.ok(snapshots.length>=3);
 const before=await storeB.get(key); snapshots.push({bad:true,createdAt:'2026-12-01'});
 await assert.rejects(engine(backupB,'B').sync());
 assert.equal(await storeB.get(key),before);
 // Restoring an archived daily session must survive older cloud snapshots and a fresh device.
 snapshots.length=0;
 const studyKey='probation-study30-v251:v1',day='2099-12-31',question='Q-synthetic';
 const daily=letter=>JSON.stringify({version:1,sessions:{[day]:{date:day,questionId:question,notes:[letter],essayDrafts:{[question]:{template:'theory',outline:[letter],fullAnswer:letter}},_sync:{revision:'rev-'+letter,device:letter,ancestors:['base']}}}});
 const phone=await PSDLearningStorage.open(new IDBFactory()),office=await PSDLearningStorage.open(new IDBFactory()),fresh=await PSDLearningStorage.open(new IDBFactory());
 const phoneBackup=PSDIndexedBackup.create(core,phone,'test'),officeBackup=PSDIndexedBackup.create(core,office,'test'),freshBackup=PSDIndexedBackup.create(core,fresh,'test');
 await phone.compareAndSet(studyKey,null,daily('A'));await office.compareAndSet(studyKey,null,daily('B'));
 await engine(phoneBackup,'phone').sync();await engine(officeBackup,'office').sync();await engine(freshBackup,'fresh').sync();
 const conflicts=await freshBackup.listStudy30Conflicts();
 const found=conflicts.flatMap(c=>[[c.index,c.existing,'existing'],[c.index,c.incoming,'incoming']]).find(([,v])=>v?.essayDrafts?.[question]?.fullAnswer==='B');
 assert.ok(found,'B remains available in conflict archive');
 await freshBackup.apply(await freshBackup.planStudy30Restore(found[0],found[2],'restore-synthetic-B'));
 await engine(freshBackup,'fresh').sync();
 const newDb=await PSDLearningStorage.open(new IDBFactory()),newBackup=PSDIndexedBackup.create(core,newDb,'test');
 await engine(newBackup,'new').sync();
 assert.equal(JSON.parse(await newDb.get(studyKey)).sessions[day].essayDrafts[question].fullAnswer,'B');
 assert.ok((await newBackup.listStudy30Conflicts()).length,'archive survives sync');
 phone.close();office.close();fresh.close();newDb.close();
 storeA.close();storeB.close();
 console.log('PASS synthetic IndexedDB Drive roundtrip, divergence, append-only and corrupt snapshot protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
