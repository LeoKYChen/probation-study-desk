import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepare,commit,assertFits} from '../../cloud-sync/whole-site-core.mjs';
const require=createRequire(import.meta.url);
require('../../backup/unified-core.js');
const core=globalThis.PSDUnifiedBackup;
function storage(seed={}){
 const map=new Map(Object.entries(seed));
 return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),
  removeItem:k=>map.delete(k),snapshot:()=>core.storageSnapshot({getItem:k=>map.has(k)?map.get(k):null})};
}
function backend(){
 const docs=Object.create(null);
 return {docs,adapter:{
  async readAll(){return structuredClone(docs)},
  async compareAndSet(key,raw,expected){
   const prev=docs[key];const rev=prev?.revision||0;
   if(rev!==expected)throw Error('另一裝置已更新');
   docs[key]={revision:rev+1,raw};return rev+1;
  }
 }};
}
async function sync(from,service,shadow={}){
 const plan=await prepare(core,from.snapshot(),await service.adapter.readAll(),shadow);
 return {plan,result:await commit(core,from,service.adapter,plan)};
}
const key='jj-read',read=value=>JSON.parse(value.getItem(key));
test('15 allowlisted modules, initial upload, empty device download and incremental merge',async()=>{
 assert.equal(core.modules.length,15);
 const a=storage({[key]:JSON.stringify(['one'])}),b=storage();
 const cloud=backend();
 const first=await sync(a,cloud);
 assert.equal(first.result.uploaded,1);
 assert.equal(cloud.docs[key].revision,1);
 const second=await sync(b,cloud);
 assert.deepEqual(read(b),['one']);
 assert.equal(second.result.uploaded,0);
 b.setItem(key,JSON.stringify(['one','two']));
 const third=await sync(b,cloud,second.result.shadow);
 assert.equal(third.plan.status.find(x=>x.key===key).status,'upload');
 assert.equal(cloud.docs[key].revision,2);
 const fourth=await sync(a,cloud,first.result.shadow);
 assert.deepEqual(read(a),['one','two']);
 assert.equal(fourth.plan.status.find(x=>x.key===key).status,'download');
 assert.equal(fourth.result.uploaded,0);
});
test('concurrent device changes retain both versions and converge to cloud primary',async()=>{
 const cloud=backend(),a=storage({[key]:JSON.stringify(['start'])}),b=storage();
 const a0=await sync(a,cloud),b0=await sync(b,cloud);
 a.setItem(key,JSON.stringify(['start','phone']));
 b.setItem(key,JSON.stringify(['start','laptop']));
 const a1=await sync(a,cloud,a0.result.shadow);
 assert.equal(a1.result.uploaded,1);
 const bplan=await prepare(core,b.snapshot(),await cloud.adapter.readAll(),b0.result.shadow);
 assert.equal(bplan.conflicts,1);
 const b1=await commit(core,b,cloud.adapter,bplan);
 assert(b1.uploaded>=1);
 assert.deepEqual(read(b),['start','phone','laptop']);
 const archive=JSON.parse(b.getItem(core.CONFLICT_KEY));
 assert(archive.entries.some(x=>x.key===key&&x.path.length===0&&x.incoming.includes('laptop')));
 assert(archive.entries.some(x=>x.key===key&&x.path.length===0&&x.existing.includes('phone')));
 const a2=await sync(a,cloud,a1.result.shadow);
 assert.deepEqual(read(a),['start','phone','laptop']);
 assert.equal(a2.plan.conflicts,0);
 assert.equal(a2.result.uploaded,0,'no endless upload ping-pong');
});
test('local changes after preview abort before any cloud write',async()=>{
 const a=storage({[key]:JSON.stringify(['one'])}),cloud=backend();
 const preview=await prepare(core,a.snapshot(),await cloud.adapter.readAll(),{});
 a.setItem(key,JSON.stringify(['one','new']));
 await assert.rejects(commit(core,a,cloud.adapter,preview),/預覽後已修改/);
 assert.equal(Object.keys(cloud.docs).length,0);
 assert.deepEqual(read(a),['one','new']);
});
test('cloud compare-and-swap refuses concurrent publication without overwriting local',async()=>{
 const cloud=backend(),a=storage({[key]:JSON.stringify(['one'])});
 const plan=await prepare(core,a.snapshot(),await cloud.adapter.readAll(),{});
 cloud.docs[key]={revision:1,raw:JSON.stringify(['remote'])};
 await assert.rejects(commit(core,a,cloud.adapter,plan),/另一裝置已更新/);
 assert.deepEqual(read(a),['one']);
 assert.equal(cloud.docs[key].raw,JSON.stringify(['remote']));
});
test('Firestore document limit blocks oversized modules rather than truncating answers',async()=>{
 const many=JSON.stringify(Array.from({length:4500},(_,i)=>String(i).padStart(4,'0')+'x'.repeat(245)));
 assert.throws(()=>assertFits(many,'jj-read'),/超過/);
 const a=storage({[key]:many}),cloud=backend();
 await assert.rejects(prepare(core,a.snapshot(),await cloud.adapter.readAll()),/超過/);
 assert.equal(Object.keys(cloud.docs).length,0);
});
test('unknown storage keys stay local, and other accounts are not mixed into the planner',async()=>{
 const a=storage({[key]:JSON.stringify(['allowed']),'unrelated-secret-token':'no-sync'});
 const cloud=backend(),first=await sync(a,cloud);
 assert.equal(first.result.uploaded,1);
 assert.equal(Object.hasOwn(cloud.docs,'unrelated-secret-token'),false);
 assert.equal(a.getItem('unrelated-secret-token'),'no-sync');
});
