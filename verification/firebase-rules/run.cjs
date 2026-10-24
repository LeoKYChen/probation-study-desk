'use strict';
// No live project, credential or Firebase console is used in these tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {collection,getDocs,doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({
  projectId:'demo-psd-rules',
  firestore:{host:'127.0.0.1',port:8084,rules:fs.readFileSync('firestore.rules','utf8')}
 });
 try{
  const alice=env.authenticatedContext('user-alice').firestore();
  const bob=env.authenticatedContext('user-bob').firestore();
  const guest=env.unauthenticatedContext().firestore();
  const a=doc(alice,'users/user-alice/modules/k~jj-read');
  const b=doc(bob,'users/user-alice/modules/k~jj-read');
  const g=doc(guest,'users/user-alice/modules/k~jj-read');
  const unknown=doc(alice,'unapproved/other-data');
  const create={raw:JSON.stringify(['第一份練習']),revision:1,updatedAt:serverTimestamp()};
  await assertFails(getDoc(g));
  await assertFails(getDoc(b));
  await assertFails(setDoc(b,create));
  await assertFails(setDoc(doc(alice,'users/user-alice/modules/without-prefix'),create));
  await assertFails(setDoc(doc(alice,'users/user-alice/modules/k~unapproved-module'),create));
  await assertFails(setDoc(doc(alice,'users/user-alice/desk/without-prefix'),create));
  await assertFails(setDoc(doc(alice,'users/user-alice/desk/k~attempt%ZZinvalid'),create));
  await assertSucceeds(setDoc(a,create));
  const ownCollection=await assertSucceeds(getDocs(collection(alice,'users/user-alice/modules')));
  assert.equal(ownCollection.docs.length,1,'owner may safely list its own module records');
  await assertFails(getDocs(collection(bob,'users/user-alice/modules')));
  await assertFails(getDocs(collection(guest,'users/user-alice/modules')));
  const owned=await assertSucceeds(getDoc(a));
  assert.equal(owned.data().revision,1);
  assert.equal(owned.data().raw,create.raw);
  await assertFails(deleteDoc(a));
  await assertFails(getDoc(unknown));
  await assertFails(setDoc(unknown,create));
  await assertFails(updateDoc(a,{revision:1,raw:'[]',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(a,{revision:3,raw:'[]',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(a,{revision:2,raw:'[]',updatedAt:serverTimestamp(),unapproved:'extra field'}));
  await assertFails(updateDoc(a,{revision:2,raw:23,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(a,{revision:2,raw:'[]',updatedAt:new Date()}));
  await assertSucceeds(updateDoc(a,{revision:2,raw:'["訂正後"]',updatedAt:serverTimestamp()}));
  assert.equal((await assertSucceeds(getDoc(a))).data().revision,2);
  const desk=doc(alice,'users/user-alice/desk/k~attempt%2Fquestion-1');
  await assertSucceeds(setDoc(desk,{revision:1,raw:JSON.stringify({value:{kind:'attempt',answer:'合成答案'},deleted:false}),updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(bob,'users/user-alice/desk/k~attempt%2Fquestion-1')));
  await assertFails(deleteDoc(desk));
  await assertFails(setDoc(doc(guest,'users/user-alice/desk/k~attempt%2Fquestion-2'),create));
  await assertFails(setDoc(doc(alice,'users/user-alice/modules/k~oversize'),{revision:1,raw:'z'.repeat(850001),updatedAt:serverTimestamp()}));
  console.log('PASS Firestore emulator rules: own-only reads/writes, anon denied, revision CAS, safe schema, size limit, no deletes');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
