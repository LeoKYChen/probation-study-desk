import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkReadiness} from '../../cloud-sync/readiness.mjs';
function fake(overrides={}){
 let reads=0,writes=0;
 const localStorage={get length(){reads++;return 3},getItem(){throw Error('must not read answers')},
  setItem(){writes++;throw Error('must not write answers')}};
 return {ctx:{isSecureContext:true,localStorage,
  indexedDB:{open(){throw Error('must not open actual DB')}},
  crypto:{subtle:{digest:async()=>{throw Error('must not hash actual work')}}},
  TextEncoder:class TextEncoder{},navigator:{onLine:true},...overrides},
  counters:()=>({reads,writes})};
}
test('readiness checks APIs without reading or mutating any learning record',()=>{
 const {ctx,counters}=fake();
 const result=checkReadiness(ctx);
 assert.equal(result.ready,true);
 assert.equal(result.checks.length,5);
 assert.deepEqual(counters(),{reads:1,writes:0});
 assert.equal(result.authVerified,false);
 assert.equal(result.firestoreRulesVerified,false);
});
test('offline state is accurately reported without accessing any cloud account',()=>{
 const {ctx}=fake({navigator:{onLine:false}});
 const result=checkReadiness(ctx);
 assert.equal(result.ready,false);
 assert.equal(result.checks.find(r=>r.key==='online').ok,false);
 assert.equal(result.checks.find(r=>r.key==='storage').ok,true);
});
test('storage restrictions are caught rather than throwing or deleting data',()=>{
 let touched=0;
 const {ctx}=fake({localStorage:{get length(){touched++;throw Error('blocked by browser')}}});
 const result=checkReadiness(ctx);
 assert.equal(touched,1);
 assert.equal(result.ready,false);
 assert.equal(result.checks.find(r=>r.key==='storage').ok,false);
});
test('insecure context and missing crypto/IndexedDB are each explicit failures',()=>{
 const {ctx}=fake({isSecureContext:false,crypto:null,indexedDB:null,TextEncoder:null});
 const result=checkReadiness(ctx);
 assert.equal(result.ready,false);
 for(const key of ['secure','indexedDB','crypto'])assert.equal(result.checks.find(r=>r.key===key).ok,false);
});
