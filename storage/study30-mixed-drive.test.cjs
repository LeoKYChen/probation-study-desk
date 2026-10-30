'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./study30-mixed-backup.js');await import('./drive-sync.js');
 await import('../backup/unified-core.js');await import('../backup/drive-sync-core.js');
 const core=PSDUnifiedBackup,protocol=PSDDriveSyncCore,key='probation-study30-v251:v1',day='2099-01-01',q='Q-test';
 const raw=(answer,revision)=>JSON.stringify({version:1,sessions:{[day]:{date:day,questionId:q,notes:[answer],essayDrafts:{[q]:{outline:[answer],fullAnswer:answer}},_sync:{revision,device:revision,ancestors:['base']}}}});
 const local=value=>{const map=new Map(value?[[key,value]]:[]);return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)}};
 const snapshots=[];const transport={async ensureFolder(){return 'synthetic'},async listSnapshots(){return snapshots.map((x,i)=>({id:String(i),createdTime:x.createdAt}))},async readSnapshot(id){return snapshots[Number(id)]},async writeSnapshot(_folder,data){snapshots.push(data);return {id:String(snapshots.length-1)}}};
 let tick=0;const create=(backup,id)=>PSDIndexedDrive.create({core,protocol,backup,transport,deviceId:id,origin:'https://test.invalid',newId:()=>id+(++tick),clock:()=>new Date(Date.UTC(2099,0,1,0,0,tick++)).toISOString()});
 const a=await PSDLearningStorage.open(new IDBFactory()),b=await PSDLearningStorage.open(new IDBFactory());
 const oldA=raw('手機','a'),oldB=raw('電腦','b'),legacyA=local(oldA),legacyB=local(oldB);
 const ab=PSDStudy30MixedBackup.create({core,database:a,legacy:legacyA,origin:'test'}),bb=PSDStudy30MixedBackup.create({core,database:b,legacy:legacyB,origin:'test'});
 await create(ab,'A').sync();await create(bb,'B').sync();
 assert.equal(JSON.parse(await b.get(key)).sessions[day].essayDrafts[q].fullAnswer,'電腦');
 assert.ok((await b.get(core.CONFLICT_KEY)).includes('手機'));
 assert.equal(legacyA.getItem(key),oldA);assert.equal(legacyB.getItem(key),oldB);
 // Remote changes to modules still in localStorage must fail closed rather than
 // misrepresenting a partial merge as successful.
 const bundle=await ab.collect();bundle.data['probation-study-desk-v24']=JSON.stringify({other:{issue:'not yet migrated'}});
 snapshots.push(protocol.snapshotPayload(bundle,'external','2099-01-02T00:00:00.000Z','external'));
 const before=await b.get(key),count=snapshots.length;
 await assert.rejects(create(bb,'B').sync(),/只能匯入每日30分鐘/);
 assert.equal(await b.get(key),before);assert.equal(snapshots.length,count);
 a.close();b.close();console.log('PASS mixed-store synthetic Drive: conflict retention and unsupported-module fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
