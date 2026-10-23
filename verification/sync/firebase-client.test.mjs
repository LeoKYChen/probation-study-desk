import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeDocumentId,decodeDocumentId,validateFirebaseConfig} from '../../cloud-sync/firebase-client.mjs';
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
