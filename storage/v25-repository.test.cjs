'use strict';
const assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
(async()=>{
 await import('./indexeddb.js');await import('./v25-repository.js');await import('../v2.5/backup-core.js');
 const api=PSDV25Repository,db=await PSDLearningStorage.open(new IDBFactory());
 const original=JSON.stringify({'existing-question-id':{issue:'原答案',scores:{issue:5,rule:4,analysis:3,structure:2},done:true}}),values=new Map([[api.V2,original]]),legacy={getItem:k=>values.get(k)??null};
 const a=await api.open({database:db,legacy,backup:Backup25}),b=await api.open({database:db,legacy,backup:Backup25});
 const data=a.read();assert.equal(data['existing-question-id'].scores.issue,30);data['existing-question-id'].issue='新答案';await a.write(data);
 assert.equal(values.get(api.V2),original);assert.equal(values.has(api.KEY),false);
 await assert.rejects(b.write(b.read()),/其他分頁/);assert.equal(JSON.parse(await db.get(api.KEY))['existing-question-id'].issue,'新答案');
 values.set(api.V2,JSON.stringify({other:{issue:'舊頁面新答案'}}));await assert.rejects(a.write(data),/舊版頁面/);
 assert.equal(JSON.parse(await db.get(api.KEY))['existing-question-id'].issue,'新答案');db.close();
 const broken=await PSDLearningStorage.open(new IDBFactory()),bad=new Map([[api.KEY,'broken']]);await assert.rejects(api.open({database:broken,legacy:{getItem:k=>bad.get(k)??null},backup:Backup25}));assert.equal(bad.get(api.KEY),'broken');assert.equal(await broken.get(api.KEY),null);broken.close();
 console.log('PASS v2.5 repository: legacy scores, IDs, migration retention and stale writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
