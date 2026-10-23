import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../../cloud-sync/local-journal.js',import.meta.url),'utf8');
const box={module:{exports:{}},globalThis:{}};
vm.runInNewContext(js,box,{filename:'local-journal.js'});
const api=box.module.exports;
function storage(){
 const m=new Map();
 return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
}
const bind=(s,uid='firebase_user_a')=>{
 s.setItem('psd-firebase-local-data-bound-v1',JSON.stringify({uid,projectId:'test-project-1'}));
 s.setItem('psd-firebase-restore-login-v1','yes');
};
test('guest local saves never trigger account outbox, and no content is duplicated',()=>{
 const s=storage(),events=[],journal=api.create(s,{token:()=> 'sample-1',signal:()=>events.push('changed')});
 assert.equal(journal.note('psd-lecture-planner-v1'),false);
 assert.equal(journal.snapshot(),null);
 assert.equal(s.m.size,0);
 bind(s);assert.equal(journal.note('psd-lecture-planner-v1'),true);
 const snap=journal.snapshot();
 assert.equal(snap.entries['psd-lecture-planner-v1'],'sample-1');
 assert(!JSON.stringify(snap).includes('學習答案'));
 assert.equal(s.m.size,3);
 assert.deepEqual(events,['changed']);
});
test('whitelist blocks unknown data and question answers themselves never enter journal',()=>{
 const s=storage();bind(s);
 const journal=api.create(s,{token:()=> 'token'});
 assert.equal(journal.note('my-secret-api-key'),false);
 assert.equal(journal.note('my-juvenile-case-details'),false);
 assert.equal(journal.note('psd-staresto-link-coach-v06'),true);
 const key=api.keyOf(api.account(s));
 const raw=s.getItem(key);
 assert(raw.includes('psd-staresto-link-coach-v06'));
 assert(!raw.includes('my-secret'));
});
test('acknowledge only the previous preview tokens, never newer offline edits',()=>{
 const s=storage();bind(s);
 let counter=0;const journal=api.create(s,{token:()=>String(++counter)});
 assert(journal.note('jj-read'));
 assert(journal.note('desk'));
 const preview=journal.snapshot();
 assert(journal.note('desk'),'user edits desk while sync operation was running');
 assert(journal.acknowledge(preview));
 const updated=journal.snapshot().entries;
 assert.equal(updated['jj-read'],undefined);
 assert.equal(updated.desk,'3');
 assert.equal(journal.acknowledge(preview),false);
});
test('explicit logout disables tracking and account switching never reuses old outbox',()=>{
 const s=storage();bind(s);
 const journal=api.create(s,{token:()=> 'x'});
 journal.note('jj-bookmarks');const old=journal.snapshot();
 s.removeItem('psd-firebase-restore-login-v1');
 assert.equal(journal.note('jj-read'),false);
 assert.equal(journal.snapshot(),null);
 bind(s,'firebase_user_b');
 assert.equal(Object.keys(journal.snapshot().entries).length,0);
 assert.equal(journal.acknowledge(old),false);
 assert(journal.note('jj-read'));
 assert.equal(journal.snapshot().entries['jj-read'],'x');
 bind(s,'firebase_user_a');
 assert.equal(journal.snapshot().entries['jj-bookmarks'],'x');
});
test('corrupt queue fails closed without deleting original source data',()=>{
 const s=storage();bind(s);
 const key=api.keyOf(api.account(s));
 s.setItem(key,'{not json}');
 const journal=api.create(s,{token:()=> 'safe-token'});
 assert(journal.note('desk'));
 assert.equal(journal.snapshot().entries.desk,'safe-token');
 assert.equal(journal.note('__proto__'),false);
});
