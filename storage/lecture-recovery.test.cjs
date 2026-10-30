'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./study30-mixed-backup.js');await import('./lecture-recovery.js');await import('../backup/unified-core.js');await import('../lectures/core.js');
 const core=PSDUnifiedBackup,lecture=PSDLectureCore,db=await PSDLearningStorage.open(new IDBFactory()),key=lecture.KEY;
 const local=lecture.addCourse(lecture.empty(),'心理學','本機課程',1,60,'course'),other=structuredClone(local);other.courses[0].name='匯入課程';
 const legacy={getItem:k=>k===key?JSON.stringify(local):null},bridge=PSDStudy30MixedBackup.create({core,database:db,legacy,managedKeys:['probation-study30-v251:v1',core.CONFLICT_KEY,key]});
 let snapshot=await bridge.snapshot(),incoming={format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:new Date().toISOString(),sourceOrigin:'test',data:{[key]:JSON.stringify(other)}};
 await bridge.apply(await bridge.plan(incoming));snapshot=await bridge.snapshot();const row=PSDLectureRecovery.list({core,lecture,snapshot}).find(x=>x.path[0]==='courses');assert.ok(row);
 const choice=PSDLectureRecovery.planRestore({core,lecture,snapshot,index:row.index,side:'incoming'});await bridge.apply(choice);assert.equal(JSON.parse(await db.get(key)).courses[0].name,'匯入課程');assert.ok((await db.get(core.CONFLICT_KEY)).includes('本機課程'));await assert.rejects(bridge.apply(choice),/重新預覽/);
 snapshot=await bridge.snapshot();const archive=core.parseValue(core.CONFLICT_KEY,snapshot[core.CONFLICT_KEY]);const lesson=lecture.normalize(JSON.parse(snapshot[key])).lessons[0];archive.entries.push({key,path:['lessons',lesson.id],existing:lesson,incoming:{...lesson,courseId:'missing'}});snapshot[core.CONFLICT_KEY]=JSON.stringify(archive);
 assert.throws(()=>PSDLectureRecovery.planRestore({core,lecture,snapshot,index:archive.entries.length-1,side:'incoming'}),/格式錯誤/);
 db.close();console.log('PASS learning-management conflict recovery, stale guard and reference validation');
})().catch(e=>{console.error(e);process.exitCode=1});
