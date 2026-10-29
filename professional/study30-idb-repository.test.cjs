'use strict';
const assert=require('node:assert/strict');
const {IDBFactory,IDBObjectStore}=require('fake-indexeddb');
(async()=>{
 await import('../storage/indexeddb.js');await import('./study30-idb-repository.js');
 const api=globalThis.Study30IndexedRepository, db=await PSDLearningStorage.open(new IDBFactory());
 const old=JSON.stringify({version:1,sessions:{'2026-10-29':{questionId:'original-id',notes:['原內容']}}});
 const data=new Map([[api.KEY,old]]), legacy={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const repo=await api.open({database:db,legacy});
 assert.equal(repo.read().sessions['2026-10-29'].questionId,'original-id');
 const first=repo.read();first.sessions['2026-10-29'].notes=['第一次'];
 const second=structuredClone(first);second.sessions['2026-10-29'].notes=['第二次'];
 await Promise.all([repo.write(first),repo.write(second)]);await repo.flush();
 assert.equal(JSON.parse(await db.get(api.KEY)).sessions['2026-10-29'].notes[0],'第二次');
 assert.equal(legacy.getItem(api.KEY),old,'legacy is not overwritten or removed');
 const another=await api.open({database:db,legacy});
 const next=repo.read();next.sessions['2026-10-29'].notes=['第三次'];await repo.write(next);
 await assert.rejects(another.write(second),/其他分頁/);
 assert.equal(JSON.parse(await db.get(api.KEY)).sessions['2026-10-29'].notes[0],'第三次');
 legacy.setItem(api.KEY,JSON.stringify({version:1,sessions:{oldTab:{notes:['舊版更新']}}}));
 await assert.rejects(repo.write(second),/舊版頁面/);
 await assert.rejects(repo.flush(),/舊版頁面/);
 assert.equal(JSON.parse(await db.get(api.KEY)).sessions['2026-10-29'].notes[0],'第三次');
 assert.ok(JSON.parse(legacy.getItem(api.KEY)).sessions.oldTab);
 db.close();
 const damagedDb=await PSDLearningStorage.open(new IDBFactory());
 const invalidLegacy={getItem:()=>'{broken'};
 await assert.rejects(api.open({database:damagedDb,legacy:invalidLegacy}));
 assert.equal(await damagedDb.get(api.KEY),null);
 damagedDb.close();
 // A legacy page racing exactly after the IDB transaction is detected after
 // commit; both copies remain available and the operation is reported failed.
 const raceDb=await PSDLearningStorage.open(new IDBFactory());
 const raceMap=new Map([[api.KEY,old]]), raceLegacy={getItem:k=>raceMap.get(k)??null,setItem:(k,v)=>raceMap.set(k,v)};
 const raceRepo=await api.open({database:raceDb,legacy:raceLegacy}), cas=raceDb.compareAndSet.bind(raceDb);
 raceDb.compareAndSet=async(...args)=>{await cas(...args);raceLegacy.setItem(api.KEY,JSON.stringify({version:1,sessions:{oldPage:{notes:['舊頁面新稿']}}}));};
 const raceDraft=raceRepo.read();raceDraft.sessions['2026-10-29'].notes=['新頁面稿'];
 await assert.rejects(raceRepo.write(raceDraft),/舊版頁面/);
 assert.ok((await raceDb.get(api.KEY)).includes('新頁面稿'));
 assert.ok(raceLegacy.getItem(api.KEY).includes('舊頁面新稿'));
 raceDb.close();
 const fullDb=await PSDLearningStorage.open(new IDBFactory());
 const emptyLegacy={getItem:()=>null};
 const fullRepo=await api.open({database:fullDb,legacy:emptyLegacy});
 const put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(value,key){if(key===api.KEY)throw new DOMException('full','QuotaExceededError');return put.call(this,value,key);};
 try {
  await assert.rejects(fullRepo.write({version:1,sessions:{Q:{notes:['未保存']}}}));
  await assert.rejects(fullRepo.flush());
  assert.equal(await fullDb.get(api.KEY),null);
 } finally {IDBObjectStore.prototype.put=put; fullDb.close();}
 console.log('PASS daily 30 IndexedDB repository: migration, ordered saves, stale tabs and legacy divergence');
})().catch(e=>{console.error(e);process.exitCode=1;});
