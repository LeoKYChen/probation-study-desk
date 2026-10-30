'use strict';
const assert = require('node:assert/strict');
const { indexedDB, IDBObjectStore } = require('fake-indexeddb');

const legacy = initial => {
  const data = new Map(Object.entries(initial));
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k,v) => data.set(k,v) };
};
(async () => {
  await import('./indexeddb.js');
  const { open } = globalThis.PSDLearningStorage;
  const source = legacy({a:'{"answer":"原始答案"}', b:'[1,2]'});
  const db = await open(indexedDB);
  let result = await db.migrate(source, ['a','b'], (_, raw) => JSON.parse(raw));
  assert.equal(result.migrated, true);
  assert.equal(await db.get('a'), source.getItem('a'));
  assert.equal(source.getItem('b'), '[1,2]');
  await db.compareAndSet('a', source.getItem('a'), '{"answer":"新答案"}');
  await assert.rejects(db.compareAndSet('a', source.getItem('a'), 'stale'), /其他分頁/);
  assert.equal(await db.get('a'), '{"answer":"新答案"}');
  result = await db.migrate(source, ['a','b']);
  assert.equal(result.migrated, false);
  assert.equal(await db.get('a'), '{"answer":"新答案"}');
  assert.equal(source.getItem('a'), '{"answer":"原始答案"}');
  source.setItem('a','{"answer":"舊分頁更新"}');
  await assert.rejects(db.migrate(source,['a','b']),/舊版頁面/);
  assert.equal(await db.get('a'),'{"answer":"新答案"}');
  await assert.rejects(db.migrate(legacy({c:'valid', d:'bad'}), ['c','d'], (key) => { if (key === 'd') throw Error('invalid'); }), /invalid/);
  assert.equal(await db.get('c'), null);
  await db.compareAndSet('e', null, 'existing');
  await assert.rejects(db.migrate(legacy({e:'legacy', f:'legacy'}), ['e','f']), /避免覆寫/);
  assert.equal(await db.get('e'), 'existing');
  assert.equal(await db.get('f'), null);
  const changing = legacy({g:'first'}); let reads = 0;
  const unstable = { getItem(k) { reads++; return reads === 1 ? changing.getItem(k) : 'changed'; } };
  await assert.rejects(db.migrate(unstable, ['g']), /變更/);
  assert.equal(await db.get('g'), null);
  await db.compareAndSet('multi1', null, 'old1');
  await db.compareAndSet('multi2', null, 'old2');
  const baseline=await db.snapshot(['multi1','multi2']);
  await db.compareAndSetMany(['multi1','multi2'],baseline,{multi1:'new1',multi2:'new2'});
  await assert.rejects(db.compareAndSetMany(['multi1','multi2'],baseline,{multi1:'bad',multi2:'bad'}),/其他分頁/);
  assert.equal(await db.get('multi1'),'new1'); assert.equal(await db.get('multi2'),'new2');
  const originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,key){if(key==='quota2')throw new DOMException('full','QuotaExceededError');return originalPut.call(this,value,key);};
  try {
    await assert.rejects(db.compareAndSetMany(['quota1','quota2'],{}, {quota1:'first',quota2:'second'}));
    assert.equal(await db.get('quota1'),null); assert.equal(await db.get('quota2'),null);
  } finally { IDBObjectStore.prototype.put=originalPut; }
  await db.compareAndSet('h', null, 'saved');
  db.close();
  const reopened = await open(indexedDB);
  assert.equal(await reopened.get('h'), 'saved');
  reopened.close();
  console.log('PASS IndexedDB migration, preservation, idempotence, rollback, stale-tab CAS, reopen');
})().catch(e => { console.error(e); process.exitCode = 1; });
