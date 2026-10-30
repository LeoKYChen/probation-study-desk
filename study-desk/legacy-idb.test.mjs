import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {indexedDB}=createRequire(import.meta.url)('fake-indexeddb');globalThis.indexedDB=indexedDB;
await import('../backup/unified-core.js');await import('../storage/indexeddb.js');await import('../storage/study30-mixed-backup.js');
const {legacyRecords}=await import('./legacy.js'),key='probation-study-desk-v24',daily='probation-daily-github:records:v1';
const original=JSON.stringify({q1:{issue:'舊答案'}}),dailyRaw=JSON.stringify({d1:{answer:'舊每日',review:false,updatedAt:'2099'}}),map=new Map([[key,original],[daily,dailyRaw]]),storage={getItem:k=>map.get(k)??null};
globalThis.PSD_STUDY30_IDB_TEST=true;globalThis.PSD_DAILY_IDB_TEST=true;globalThis.PSD_V25_IDB_TEST=true;
const db=await PSDLearningStorage.open();await db.migrate(storage,[key,'probation-study-desk-v3','probation-study-desk-v2'],PSDUnifiedBackup.parseValue);await db.migrate(storage,[daily],PSDUnifiedBackup.parseValue);await db.compareAndSet(key,original,JSON.stringify({q1:{issue:'新答案'}}));await db.compareAndSet(daily,dailyRaw,JSON.stringify({d1:{answer:'新每日',review:false,updatedAt:'2099'}}));
const result=await legacyRecords(storage,'https://example.test'),rows=Object.values(result).map(x=>x.value);assert.equal(rows.find(x=>x.key===key&&x.oldId==='q1').data.issue,'新答案');assert.equal(rows.find(x=>x.key===daily&&x.oldId==='d1').data.answer,'新每日');assert.equal(storage.getItem(key),original);assert.equal(storage.getItem(daily),dailyRaw);assert.deepEqual(await legacyRecords(storage,'https://example.test'),result);
db.close();console.log('PASS study desk imports migrated module snapshots, preserving originals and stable IDs');
