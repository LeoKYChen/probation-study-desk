import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeDocumentId,decodeDocumentId,validateFirebaseConfig,assertCurrentUser,createUserScopedAdapter,createPopupLogin,MAX_REMOTE_PREVIEW_DOCS} from '../../cloud-sync/firebase-client.mjs';
test('Firestore document IDs are reversible even for dotted and slashed keys',()=>{
 for(const key of ['.','..','attempt/1234','settings/preferences','jj-read','topic:2026','import/a%2Fb']){
  const encoded=encodeDocumentId(key);
  assert(encoded.startsWith('k~'));
  assert.notEqual(encoded,'.');assert.notEqual(encoded,'..');
  assert(!encoded.includes('/'));
  assert.equal(decodeDocumentId(encoded),key);
 }
});
test('remote aliases and malformed document IDs are rejected, not silently ignored',()=>{
 for(const key of ['.', '..', 'attempt/x']) {
  assert.throws(()=>decodeDocumentId(key),/識別碼/);
 }
 assert.throws(()=>decodeDocumentId('k~%2e'),/識別碼/);
 assert.throws(()=>decodeDocumentId('k~%ZZ'),/識別碼/);
 assert.throws(()=>encodeDocumentId(''),/資料鍵/);
});
test('Firebase accepts only public web app configuration with an official project host',()=>{
 const good={apiKey:'AIza'+ 'a'.repeat(32),authDomain:'sample-app.firebaseapp.com',projectId:'sample-app',appId:'1:123456789:web:abcdef12345'};
 assert.deepEqual(validateFirebaseConfig(good),good);
 assert.throws(()=>validateFirebaseConfig({...good,authDomain:'attacker.example'}),/設定格式/);
 assert.throws(()=>validateFirebaseConfig({...good,apiKey:'sb_secret_foo'}),/設定格式/);
});

test('Firebase adapter requires the same current uid before and after async operations',()=>{
 assert.doesNotThrow(()=>assertCurrentUser('firebase-user-A',{uid:'firebase-user-A'}));
 for(const changed of [null,undefined,{uid:'firebase-user-B'},{uid:''},{email:'example@test.invalid'}]){
  assert.throws(()=>assertCurrentUser('firebase-user-A',changed),/帳號在同步期間已變更/);
 }
 assert.throws(()=>assertCurrentUser('',{uid:'firebase-user-A'}),/帳號在同步期間已變更/);
});

function mockedSdk({readDocs=[],existing=null,onRead=()=>{},onGet=()=>{}}={}){
 const writes=[],refs=[];
 const fs={
  collection(_db,...path){return path.join('/')},
  query(base,constraint){return {base,constraint}},
  limit(n){return {max:n}},
  doc(base,id){const ref={base,id};refs.push(ref);return ref},
  async getDocsFromServer(query){
   await onRead(query);
   const max=query?.constraint?.max??Number.MAX_SAFE_INTEGER;
   return {docs:readDocs.slice(0,max)};
  },
  async runTransaction(_db,fn){
   let staged=null;
   const transaction={
    async get(){await onGet();return {exists:()=>existing!==null,data:()=>existing}},
    set(ref,record){staged={ref,record}}
   };
   const revision=await fn(transaction);
   if(staged)writes.push(staged);
   return revision;
  },
  serverTimestamp(){return 'server_timestamp_mock'}
 };
 return {fs,writes,refs};
}
test('user-bound Firestore client rejects read completion after another tab logs out',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const item={id:encodeDocumentId('jj-read'),data:()=>({revision:1,raw:'["hello"]'})};
 const {fs}=mockedSdk({readDocs:[item],onRead:async()=>{auth.currentUser=null}});
 const adapter=createUserScopedAdapter(fs,{},auth);
 await assert.rejects(adapter.readAll(),/帳號在同步期間已變更/);
});
test('user-bound Firestore client rejects writes when Google UID changes mid-transaction',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const fake=mockedSdk({existing:{revision:1},onGet:async()=>{auth.currentUser={uid:'another-google-user'}}});
 const adapter=createUserScopedAdapter(fake.fs,{},auth,'desk');
 await assert.rejects(adapter.compareAndSet('attempt/sensitive','{"answer":"private"}',1),/帳號在同步期間已變更/);
 assert.equal(fake.writes.length,0,'never stage a Firestore write under a stale auth session');
});
test('user-bound Firestore CAS requires same revision, writes encoded key and locks uid',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const fake=mockedSdk({existing:{revision:5}});
 const adapter=createUserScopedAdapter(fake.fs,{},auth,'modules');
 await assert.rejects(adapter.compareAndSet('jj-read','["new"]',4),/另一裝置已更新/);
 assert.equal(fake.writes.length,0);
 assert.equal(await adapter.compareAndSet('jj-read','["new"]',5),6);
 assert.equal(fake.writes.length,1);
 assert.equal(fake.writes[0].ref.base,'users/google-owner/modules');
 assert.equal(fake.writes[0].ref.id,encodeDocumentId('jj-read'));
 assert.deepEqual(fake.writes[0].record,{revision:6,raw:'["new"]',updatedAt:'server_timestamp_mock'});
 auth.currentUser={uid:'other-user'};
 await assert.rejects(adapter.readAll(),/帳號在同步期間已變更/);
});
test('Firestore adapter rejects other collections and malformed remote IDs',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const fake=mockedSdk({readDocs:[{id:'..',data:()=>({revision:1})}]});
 assert.throws(()=>createUserScopedAdapter(fake.fs,{},auth,'admins'),/不支援/);
 const adapter=createUserScopedAdapter(fake.fs,{},auth);
 await assert.rejects(adapter.readAll(),/識別碼/);
});

test('Firebase remote preview is bounded by a query limit and refuses partial merges',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const docs=Array.from({length:MAX_REMOTE_PREVIEW_DOCS+1},(_,i)=>({
  id:encodeDocumentId('attempt/'+String(i).padStart(4,'0')),data:()=>({raw:'[]',revision:1})
 }));
 let maximum=null;
 const fake=mockedSdk({readDocs:docs,onRead:async query=>{maximum=query?.constraint?.max}});
 const adapter=createUserScopedAdapter(fake.fs,{},auth,'desk');
 await assert.rejects(adapter.readAll(),/超過單次預覽上限/);
 assert.equal(maximum,MAX_REMOTE_PREVIEW_DOCS+1);
 assert.equal(fake.writes.length,0);
});
test('Firebase preview succeeds at the exact quota-aware collection boundary',async()=>{
 const auth={currentUser:{uid:'google-owner'}};
 const docs=Array.from({length:MAX_REMOTE_PREVIEW_DOCS},(_,i)=>({
  id:encodeDocumentId('attempt/'+String(i).padStart(4,'0')),data:()=>({raw:'[]',revision:1})
 }));
 const fake=mockedSdk({readDocs:docs});
 const result=await createUserScopedAdapter(fake.fs,{},auth,'desk').readAll();
 assert.equal(Object.keys(result).length,MAX_REMOTE_PREVIEW_DOCS);
});

test('Google popup begins synchronously within user click without awaiting SDK state',async()=>{
 const calls=[],auth={currentUser:{uid:'synthetic-user'}};
 const authLib={
  GoogleAuthProvider:class GoogleAuthProvider {},
  signInWithPopup(_auth,provider){
   calls.push('popup-started-now');
   assert.equal(_auth,auth);
   assert.equal(provider.constructor.name,'GoogleAuthProvider');
   return Promise.resolve({user:auth.currentUser});
  }
 };
 const login=createPopupLogin(auth,authLib);
 const future=login();
 assert.deepEqual(calls,['popup-started-now'],'opening the popup must be synchronous before the first await');
 assert.equal((await future).uid,'synthetic-user');
});
test('Google popup blocks are reported without falling back to unsafe redirect',async()=>{
 const auth={currentUser:null};
 const authLib={
  GoogleAuthProvider:class GoogleAuthProvider {},
  signInWithPopup(){
   return Promise.reject(Object.assign(Error('blocked'),{code:'auth/popup-blocked'}));
  }
 };
 await assert.rejects(createPopupLogin(auth,authLib)(),/阻擋 Google 登入視窗/);
});
