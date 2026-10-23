import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore,emptyState} from '../../cloud-sync/core.js';
import {prepareDesk,commitDesk} from '../../cloud-sync/whole-desk-core.mjs';
function backend(){
 const docs=Object.create(null);
 return {docs,api:{
  readAll:async()=>structuredClone(docs),
  compareAndSet:async(id,raw,expected)=>{
   const revision=docs[id]?.revision||0;
   if(revision!==expected)throw Error('另一裝置已更新');
   docs[id]={revision:revision+1,raw};return revision+1;
  }
 }};
}
async function sync(store,service,shadow={}){
 const plan=await prepareDesk(await store.read(),await service.api.readAll(),shadow);
 return {plan,result:await commitDesk(store,service.api,plan)};
}
async function add(store,id,text){
 await store.update(s=>{s.records[id]={value:{kind:'attempt',answer:text},deleted:false,revision:0};});
}
test('guest IndexedDB: first device upload, new device download, subsequent edit',async()=>{
 const cloud=backend(),a=new MemoryStore(emptyState()),b=new MemoryStore(emptyState());
 await add(a,'attempt/demo','手機答案');
 const first=await sync(a,cloud);assert.equal(first.result.uploaded,1);
 const second=await sync(b,cloud);assert.equal(second.result.downloaded,1);
 assert.equal((await b.read()).records['attempt/demo'].value.answer,'手機答案');
 await add(b,'attempt/demo','電腦改稿');
 const third=await sync(b,cloud,second.result.shadow);
 assert.equal(third.result.uploaded,1);
 await sync(a,cloud,first.result.shadow);
 assert.equal((await a.read()).records['attempt/demo'].value.answer,'電腦改稿');
});
test('concurrent corrections archive original record before accepting remote',async()=>{
 const cloud=backend(),a=new MemoryStore(emptyState()),b=new MemoryStore(emptyState());
 await add(a,'attempt/demo','最初版本');
 const first=await sync(a,cloud),second=await sync(b,cloud);
 await add(a,'attempt/demo','手機訂正甲');
 await add(b,'attempt/demo','電腦訂正乙');
 const updated=await sync(a,cloud,first.result.shadow);
 const plan=await prepareDesk(await b.read(),await cloud.api.readAll(),second.result.shadow,()=> '00000000-0000-4000-8000-000000000001');
 assert.equal(plan.conflicts,1);
 const settled=await commitDesk(b,cloud.api,plan);
 assert.equal(settled.conflicts,1);
 const stored=await b.read();
 assert.equal(stored.records['attempt/demo'].value.answer,'手機訂正甲');
 assert.equal(stored.records['import/00000000-0000-4000-8000-000000000001'].value.record.value.answer,'電腦訂正乙');
 assert(Object.keys(cloud.docs).some(id=>id.startsWith('import/')));
 const final=await sync(a,cloud,updated.result.shadow);
 assert.equal(final.plan.conflicts,0);
 assert.equal((await a.read()).records['attempt/demo'].value.answer,'手機訂正甲');
});
test('stale preview refuses to overwrite a draft edited in another tab',async()=>{
 const cloud=backend(),local=new MemoryStore(emptyState());
 await add(local,'attempt/x','前一版');
 const plan=await prepareDesk(await local.read(),await cloud.api.readAll());
 await add(local,'attempt/x','新草稿尚未上傳');
 await assert.rejects(commitDesk(local,cloud.api,plan),/預覽後已變更/);
 assert.equal(cloud.docs['attempt/x'],undefined);
 assert.equal((await local.read()).records['attempt/x'].value.answer,'新草稿尚未上傳');
});
test('cloud version changes before CAS, no loss of local answer',async()=>{
 const cloud=backend(),local=new MemoryStore(emptyState());
 await add(local,'attempt/demo','此裝置');
 const plan=await prepareDesk(await local.read(),await cloud.api.readAll());
 cloud.docs['attempt/demo']={revision:1,raw:JSON.stringify({value:{kind:'attempt',answer:'別的裝置'},deleted:false})};
 await assert.rejects(commitDesk(local,cloud.api,plan),/另一裝置已更新/);
 assert.equal((await local.read()).records['attempt/demo'].value.answer,'此裝置');
});
