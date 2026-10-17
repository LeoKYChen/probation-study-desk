// No external dependencies. Tests use synthetic data only, never actual user records.
'use strict';
const assert=require('node:assert/strict');
require('./unified-core.js');
const core=globalThis.PSDUnifiedBackup;
const key='probation-study30-v251:v1',essay='psd-common-subjects-v1',en='psd-staresto-link-coach-v06',old='psd-staresto-daily-v04';
function mock(seed={},opts={}){
 const map=new Map(Object.entries(seed)),writes=[];
 return {map,writes,getItem(k){if(opts.readFail)throw Error('read denied');return map.has(k)?map.get(k):null},
 setItem(k,v){if(opts.failKey===k)throw Error('quota denied');map.set(k,String(v));writes.push(k)},
 removeItem(k){map.delete(k)}};
}
const stringify=JSON.stringify;
function env(s){return{format:core.FORMAT,schemaVersion:1,exportedAt:'2026-10-17T00:00:00.000Z',sourceOrigin:'https://other-origin.test',data:s}}
function sessions(x){return stringify({version:1,sessions:x})}
function common(drafts){return stringify({schema:essay,drafts,english:{},englishHistory:{},dailySelections:{},externalPractice:{}})}
function english(completed){return stringify({schema:en,days:{},completed,excluded:{},wordDays:{},wordProgress:{},customWords:{}})}
function v04(days){return stringify({schema:'psd-staresto-v04',days,progress:{},cards:{},completedDays:{}})}
function legalReadOnly(){
 const s=mock({[key]:sessions({'2026-10-01':{date:'2026-10-01',essayDrafts:{a:{fullAnswer:'原答案'}}}})});
 const oldValue=s.map.get(key);
 const backup=core.collect(s,'https://local.test');
 assert.equal(backup.sourceOrigin,'https://local.test');
 assert.deepEqual(core.validate(JSON.parse(JSON.stringify(backup))),backup);
 assert.equal(s.writes.length,0);assert.equal(s.map.get(key),oldValue);
 assert.throws(()=>core.validate(env({[key]:'not-json'})),/JSON/);
 assert.throws(()=>core.validate({...backup,data:{unapproved:'{}'}}),/未支援/);
 assert.throws(()=>core.validate({...backup,format:'wrong'}),/完整學習紀錄/);
 assert.throws(()=>core.validate(env({[key]:'{"version":1,"sessions":{"__proto__":{"polluted":true}}}'})),/不安全/);
}
function mergeAcrossDevices(){
 const a=mock({[key]:sessions({'2026-10-17':{date:'2026-10-17',essayDrafts:{a:{fullAnswer:'Mac'}},unknown:{ok:true}}}),
 [essay]:common({'full:12':{text:'作文初稿',versions:[{text:'A',date:'2026-10-15'}]}}),
 [en]:english({'lesson-1':{at:'2026-10-14',correct:3}}),
 [old]:v04({'2026-09-30':{plan:{}}}),
 'jj-read':stringify(['a']), 'jj-font':'18'});
 const b=env({[key]:sessions({
  '2026-10-17':{date:'2026-10-17',essayDrafts:{a:{fullAnswer:'iPhone'}}},
  '2026-10-18':{date:'2026-10-18',essayDrafts:{b:{fullAnswer:'手機另一題'}}}
 }),[essay]:common({'full:12':{text:'作文手機改寫'},'full:13':{text:'新作文'}}),
 [en]:english({'lesson-1':{at:'2026-10-16',correct:5},'lesson-2':{at:'2026-10-16',correct:4}}),
 [old]:v04({'2026-10-16':{plan:{}}}),'jj-read':stringify(['a','b']),
 'probation-study-desk-v24':stringify({'question-1':{issue:'新考古題'}}),
 'psd-home-exam-countdown-v1':stringify({date:'2027-08-01',name:'考試'})});
 const before=a.map.get(key),plan=core.plan(core.storageSnapshot(a),b);
 assert.equal(plan.stats.find(x=>x.key===key).added,1);
 assert.equal(plan.stats.find(x=>x.key===essay).added,1);
 assert.equal(plan.conflicts.length,3);
 assert.equal(a.writes.length,0,'dry-run must never write');
 const touched=core.apply(a,plan);assert(touched>0);
 let data=JSON.parse(a.map.get(key));
 assert.equal(data.sessions['2026-10-17'].essayDrafts.a.fullAnswer,'Mac');
 assert.deepEqual(data.sessions['2026-10-17'].unknown,{ok:true});
 assert.equal(data.sessions['2026-10-18'].essayDrafts.b.fullAnswer,'手機另一題');
 const drafts=JSON.parse(a.map.get(essay)).drafts;
 assert.equal(drafts['full:12'].text,'作文初稿');
 assert.equal(drafts['full:13'].text,'新作文');
 const alternate=JSON.parse(a.map.get(core.CONFLICT_KEY)).entries;
 assert(alternate.some(x=>x.key===key&&x.incoming.essayDrafts.a.fullAnswer==='iPhone'));
 assert(alternate.some(x=>x.key===essay&&x.incoming.text==='作文手機改寫'));
 assert(alternate.some(x=>x.key===en));
 assert.deepEqual(JSON.parse(a.map.get('jj-read')),['a','b']);
 assert.equal(a.map.get('jj-font'),'18');
 assert.equal(JSON.parse(a.map.get(en)).completed['lesson-2'].correct,4);
 assert.equal(JSON.parse(a.map.get(old)).days['2026-10-16']!==undefined,true);
 assert.equal(core.collect(a,'https://current.test').data[core.CONFLICT_KEY],a.map.get(core.CONFLICT_KEY));
 const repeated=core.plan(core.storageSnapshot(a),b);
 assert.equal(repeated.archiveCount,alternate.length,'same versions should not create duplicates');
 assert.equal(repeated.changes[core.CONFLICT_KEY],undefined);
 assert.equal(before!==a.map.get(key),true);
}
function rollback(){
 const a=mock({'jj-read':stringify(['old'])}, {failKey:'jj-read'});
 const b=env({'jj-bookmarks':stringify(['new']), 'jj-read':stringify(['changed'])});
 const snapshot=core.storageSnapshot(a);
 const plan=core.plan(snapshot,b);
 assert.throws(()=>core.apply(a,plan),/恢復|保留/);
 assert.deepEqual(core.storageSnapshot(a),snapshot,'must roll back successfully written earlier keys');
}
function stalePrevention(){
 const a=mock({[key]:sessions({})});
 const plan=core.plan(core.storageSnapshot(a),env({[key]:sessions({'2026-10-17':{date:'2026-10-17'}})}));
 a.setItem('jj-read',stringify(['other-tab']));
 assert.throws(()=>core.apply(a,plan),/預覽後已有更新/);
 assert.equal(JSON.parse(a.getItem(key)).sessions['2026-10-17'],undefined);
}
function corruptAndPrototype(){
 const bad=JSON.stringify({schema:essay,drafts:{'__proto__':{evil:true}},english:{}});
 assert.throws(()=>core.validate(env({[essay]:bad})),/不安全/);
 const tooBig='x'.repeat(20*1024*1024+1);
 assert.throws(()=>core.validate(env({[essay]:tooBig})),/異常|20MB/);
 assert.throws(()=>core.collect(mock({[key]:'{'}),'x'),/JSON/);
}
legalReadOnly();mergeAcrossDevices();rollback();stalePrevention();
assert.throws(()=>core.validate(env({'psd-common-subjects-v1':'{"schema":"psd-common-subjects-v1","drafts":{"__proto__":{"evil":true}},"english":{}}'})),/格式|不安全/);
assert.throws(()=>core.validate(env({[essay]:'{' })),/JSON/);
assert.throws(()=>core.collect(mock({[key]:'{' }),'x'),/JSON/);
assert.equal(core.modules.length,13);
console.log('PASS unified JSON backup core: read-only export, schema validation, cross-device merge, alternate versions, idempotency, staleness guard, rollback');
