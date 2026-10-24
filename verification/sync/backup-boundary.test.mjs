import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {FORMAT,LocalRecords,MemoryStore,validateState} from '../../cloud-sync/core.js';

const require=createRequire(import.meta.url);
const backup=require('../../backup/unified-core.js');
const KEY='probation-study-desk-v3';
function storage(initial={}) {
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
}
const engine=()=>new LocalRecords(new MemoryStore(),{uuid:randomUUID});

test('localStorage full backup does not pretend to contain IndexedDB study-desk records', async()=>{
  const local=storage({[KEY]:JSON.stringify({oldExam:{answer:'v2.5 曾有答案'}})});
  const desk=engine();
  await desk.save('attempt/legacy-426',{answer:'書桌獨立原稿',feedback:['合成評語']});
  const snapshot=backup.collect(local,'https://example.test');
  assert.equal(snapshot.format,backup.FORMAT);
  assert.equal(snapshot.data[KEY],local.getItem(KEY));
  assert.equal(Object.keys(snapshot.data).length,1);
  assert.notEqual(snapshot.format,FORMAT);
  assert.equal(JSON.stringify(snapshot).includes('書桌獨立原稿'),false);
  assert.equal((await desk.store.read()).records['attempt/legacy-426'].value.answer,'書桌獨立原稿');
});
test('existing localStorage JSON roundtrip restores a synthetic answer',()=>{
  const value=JSON.stringify({answer1:{draft:'第一版',updatedAt:'2026-10-24T10:00:00Z'}});
  const src=storage({[KEY]:value});
  const exported=JSON.parse(JSON.stringify(backup.collect(src,'https://example.test')));
  const dst=storage();
  const action=backup.plan(backup.storageSnapshot(dst),backup.validate(exported));
  assert(backup.apply(dst,action)>0);
  assert.deepEqual(JSON.parse(dst.getItem(KEY)),JSON.parse(value));
  const repeated=backup.plan(backup.storageSnapshot(dst),backup.validate(exported));
  assert.equal(Object.keys(repeated.changes).length,0);
});
test('study-desk record JSON roundtrip is non-destructive and idempotent',async()=>{
  const original=engine();
  await original.save('attempt/existing',{answer:'舊稿',feedback:[],correction:'已訂正'});
  await original.save('attempt/new',{answer:'新卷答案',feedback:['合成 AI 評語'],due:'2026-11-01'});
  const exported={format:FORMAT,schemaVersion:1,exportedAt:'2026-10-25T00:00:00Z',state:await original.store.read()};
  const imported=JSON.parse(JSON.stringify(exported));
  assert.equal(imported.format,FORMAT); validateState(imported.state);
  const restored=engine();
  await restored.importRecords(imported.state.records);
  assert.deepEqual((await restored.store.read()).records,imported.state.records);
  await restored.importRecords(imported.state.records);
  assert.equal(Object.keys((await restored.store.read()).records).length,2);
  await restored.importRecords({'attempt/existing':{value:{answer:'另一份不同稿'},deleted:false}});
  const after=await restored.store.read();
  assert.equal(after.records['attempt/existing'].value.answer,'舊稿');
  assert(Object.entries(after.records).some(([id,rec])=>id.startsWith('import/')&&rec.value.originalId==='attempt/existing'&&rec.value.record.value.answer==='另一份不同稿'));
});
test('corrupt source is rejected before touching existing data',async()=>{
  const desk=engine();
  await desk.save('attempt/safe',{answer:'安全原稿'});
  const before=await desk.store.read();
  assert.throws(()=>validateState({...before,schema:999}),/版本/);
  assert.throws(()=>backup.validate({format:'wrong',schemaVersion:1,exportedAt:'now',sourceOrigin:'local',data:{}}),/完整學習紀錄/);
  assert.deepEqual(await desk.store.read(),before);
});
