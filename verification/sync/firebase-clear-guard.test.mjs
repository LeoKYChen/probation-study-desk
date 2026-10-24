import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../../cloud-sync/local-clear-guard.js';
const guard=globalThis.PSDLocalClearGuard;
function storage(seed={}){
 const values=new Map(Object.entries(seed));
 return {
  getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>values.set(k,String(v)),
  removeItem:k=>values.delete(k)
 };
}
test('clearing marker is persistent, contains no learning records and requires explicit acknowledgement',()=>{
 const store=storage({'jj-read':'["私人的答案"]'});
 assert.equal(guard.read(store),null);
 const marker=guard.mark(store);
 assert.equal(guard.read(store),marker);
 assert.equal(JSON.parse(marker).schema,1);
 assert.equal(marker.includes('私人的答案'),false);
 assert.equal(store.getItem('jj-read'),'["私人的答案"]','marker never touches answers');
 assert.equal(guard.acknowledge(store,marker),true);
 assert.equal(guard.read(store),null);
 assert.equal(store.getItem('jj-read'),'["私人的答案"]');
});
test('another deletion after preview cannot be acknowledged using a stale token',()=>{
 const store=storage();
 const first=guard.mark(store),second=guard.mark(store);
 assert.notEqual(first,second);
 assert.throws(()=>guard.acknowledge(store,first),/已變更/);
 assert.equal(guard.read(store),second,'the latest clear guard remains');
});
test('corrupted or inaccessible clear marker fails closed',()=>{
 const store=storage({[guard.KEY]:'not-json'});
 assert.throws(()=>guard.read(store),/無法讀取/);
 const blocked={getItem:()=>null,setItem:()=>{throw Error('storage disabled')}};
 assert.throws(()=>guard.mark(blocked),/storage disabled/);
});
test('marker persistence verification catches browsers that silently discard writes',()=>{
 const discarded={getItem:()=>null,setItem:()=>{}};
 assert.throws(()=>guard.mark(discarded),/已停止清除/);
});
