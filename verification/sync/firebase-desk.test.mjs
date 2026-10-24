import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore,emptyState} from '../../cloud-sync/core.js';
import {prepareDesk,commitDesk,MAX_DESK_PREVIEW_DOCS} from '../../cloud-sync/whole-desk-core.mjs';
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

test('derived recommendation audit remains local and is not uploaded',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 await guest.update(s=>{
  s.records['settings/recommendation-audit']={value:{kind:'local-audit',summary:'only the local UI needs this'},revision:0,deleted:false};
  s.records['attempt/answer']={value:{kind:'attempt',answer:'真正的考生作答'},revision:0,deleted:false};
 });
 const run=await sync(guest,cloud);
 assert.equal(run.result.uploaded,1);
 assert(!cloud.docs['settings/recommendation-audit']);
 assert.equal((await guest.read()).records['settings/recommendation-audit'].value.summary,'only the local UI needs this');
});
test('malformed remote attempt is rejected without mutating guest IndexedDB',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 await add(guest,'attempt/answer','原本的本機答卷');
 const before=await guest.read();
 cloud.docs['attempt/answer']={revision:1,raw:JSON.stringify({value:{kind:'attempt',answer:'remote'},deleted:'not-a-boolean'})};
 await assert.rejects(prepareDesk(await guest.read(),await cloud.api.readAll()),/雲端版本/);
 assert.deepEqual(await guest.read(),before);
});

test('oversized study-desk merges stop before Firestore writes or local mutation',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 for(let i=0;i<=MAX_DESK_PREVIEW_DOCS;i++){
  const id='attempt/'+i;
  guest.state.records[id]={value:{kind:'attempt',answer:'small synthetic answer'},deleted:false,revision:0};
 }
 const original=await guest.read();
 await assert.rejects(
  prepareDesk(await guest.read(),await cloud.api.readAll()),
  /備考書桌待合併紀錄超過/
 );
 assert.equal(Object.keys(cloud.docs).length,0);
 assert.deepEqual(await guest.read(),original);
});
test('study-desk supports exactly the maximum verified count',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 for(let i=0;i<MAX_DESK_PREVIEW_DOCS;i++)
  guest.state.records['attempt/'+i]={value:{kind:'attempt',answer:'synthetic'},deleted:false,revision:0};
 const plan=await prepareDesk(await guest.read(),await cloud.api.readAll());
 assert.equal(Object.keys(plan.uploads).length,MAX_DESK_PREVIEW_DOCS);
 assert.equal(Object.keys(cloud.docs).length,0,'preview must never upload');
});

test('conflict archives cannot push cloud above the 1000-record preview limit',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 for(let i=0;i<MAX_DESK_PREVIEW_DOCS;i++){
  const id='attempt/'+i;
  cloud.docs[id]={revision:1,raw:JSON.stringify({value:{kind:'attempt',answer:'雲端版本'},deleted:false})};
  guest.state.records[id]={revision:0,value:{kind:'attempt',answer:'本機不同版本'},deleted:false};
 }
 const local=await guest.read();
 await assert.rejects(
  prepareDesk(local,await cloud.api.readAll(),{},()=> '00000000-0000-4000-8000-000000000001'),
  /合併後備考書桌雲端紀錄將超過/
 );
 assert.equal(Object.keys(cloud.docs).length,MAX_DESK_PREVIEW_DOCS,'cloud records are untouched');
 assert.deepEqual(await guest.read(),local,'local conflicting answer remains intact');
});
test('no-op and upload-only sync do not rewrite guest IndexedDB',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 await add(guest,'attempt/noop','保留本機原稿');
 let writes=0;
 const wrapper={
  read:()=>guest.read(),
  update:fn=>{writes++;return guest.update(fn);}
 };
 const first=await prepareDesk(await wrapper.read(),await cloud.api.readAll());
 const sent=await commitDesk(wrapper,cloud.api,first);
 assert.equal(sent.uploaded,1);
 assert.equal(writes,0,'initial upload does not rewrite answers');
 const repeat=await prepareDesk(await wrapper.read(),await cloud.api.readAll(),sent.shadow);
 const result=await commitDesk(wrapper,cloud.api,repeat);
 assert.equal(result.uploaded,0);
 assert.equal(writes,0,'unchanged cloud data does not trigger another local save');
});

test('two different conflicts cannot silently share one immutable archive ID',async()=>{
 const cloud=backend(),guest=new MemoryStore(emptyState());
 for(const id of ['attempt/one','attempt/two']){
  cloud.docs[id]={revision:1,raw:JSON.stringify({value:{kind:'attempt',answer:'雲端版本'},deleted:false})};
  guest.state.records[id]={value:{kind:'attempt',answer:'本機重要原稿'},deleted:false,revision:0};
 }
 const original=await guest.read();
 const repeatedId=()=> '00000000-0000-4000-8000-000000000001';
 await assert.rejects(
  prepareDesk(await guest.read(),await cloud.api.readAll(),{},repeatedId),
  /保留版本識別碼重複/
 );
 assert.deepEqual(await guest.read(),original,'both original drafts must remain intact');
 assert.equal(Object.keys(cloud.docs).length,2,'no conflict archive was uploaded');
});
