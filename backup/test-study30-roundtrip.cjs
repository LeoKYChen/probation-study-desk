// Regression cases use synthetic data; no real student records or network access.
'use strict';
const assert=require('node:assert/strict');
require('./unified-core.js');
const core=globalThis.PSDUnifiedBackup;
const KEY='probation-study30-v251:v1',DAY='2026-10-28';
const wrap=days=>JSON.stringify({version:1,sessions:days});
const pack=days=>({format:core.FORMAT,schemaVersion:1,exportedAt:'2026-10-28T00:00:00.000Z',
 sourceOrigin:'https://test.example',data:{[KEY]:wrap(days)}});
const snapshot=days=>({[KEY]:wrap(days)});
function merge(local,remote,archive){
 const previous=snapshot(local);
 if(archive)previous[core.CONFLICT_KEY]=JSON.stringify({schema:core.CONFLICT_KEY,entries:archive});
 const action=core.plan(previous,pack(remote));
 const sessions=JSON.parse(action.changes[KEY]||previous[KEY]).sessions;
 return {action,sessions};
}
const empty={date:DAY,questionId:'auto-Q',mode:'30',phase:0,remaining:300,
 elapsed:0,finished:false,notes:[],rating:null};
const drafted={...empty,questionId:'strain-Q',essayDrafts:{'strain-Q':{
 template:'theory',outline:['Merton','Agnew'],fullAnswer:''}},rating:'review',errorCause:'概念不熟'};
// An automatically created empty date must not block a later phone backup.
let x=merge({[DAY]:empty},{[DAY]:drafted});
assert.equal(x.sessions[DAY].questionId,'strain-Q');
assert.equal(x.sessions[DAY].essayDrafts['strain-Q'].outline[1],'Agnew');
assert.equal(x.action.conflicts.length,0);
// Field-level union preserves both handwritten notes and separate essay subfields.
const withNotes={...drafted,notes:['我的例子'],rating:null,errorCause:null,essayDrafts:{'strain-Q':{outline:['Merton']}}};
x=merge({[DAY]:withNotes},{[DAY]:drafted});
assert.equal(x.sessions[DAY].notes[0],'我的例子');
assert.equal(x.sessions[DAY].essayDrafts['strain-Q'].outline[1],'Agnew');
assert.equal(x.sessions[DAY].rating,'review');
assert.equal(x.action.conflicts.length,0);
// Same-field unrelated edits are not silently replaced, but the incoming
// complete version remains downloadable in the conflict archive.
const local={...drafted,essayDrafts:{'strain-Q':{fullAnswer:'不同裝置的原始答案'}}};
const remote={...drafted,essayDrafts:{'strain-Q':{fullAnswer:'另一裝置的改寫'}}};
x=merge({[DAY]:local},{[DAY]:remote});
assert.equal(x.sessions[DAY].essayDrafts['strain-Q'].fullAnswer,'不同裝置的原始答案');
assert.equal(x.action.conflicts.length,1);
assert.equal(x.action.conflicts[0].incoming.essayDrafts['strain-Q'].fullAnswer,'另一裝置的改寫');
// Repeated imports cannot grow the archive indefinitely.
let rerun=merge({[DAY]:x.sessions[DAY]},{[DAY]:remote},x.action.conflicts);
assert.equal(rerun.action.conflicts.length,0);
// A revised backup descended from a morning revision must update the main draft.
const morning={...drafted,_sync:{revision:'A-0730',device:'phone',ancestors:[]}};
const noon={...morning,essayDrafts:{'strain-Q':{template:'theory',
 outline:['Merton','Agnew','公司補充論證'],fullAnswer:'完整答案'}},
 _sync:{revision:'B-1230',device:'office',ancestors:['A-0730']}};
x=merge({[DAY]:morning},{[DAY]:noon});
assert.equal(x.sessions[DAY].essayDrafts['strain-Q'].fullAnswer,'完整答案');
assert.equal(x.action.conflicts.length,0);
const evening={...noon,essayDrafts:{'strain-Q':{template:'theory',
 outline:['Merton','Agnew','公司補充論證','晚上訂正'],fullAnswer:'完整修訂'}},
 _sync:{revision:'C-2000',device:'home',ancestors:['A-0730','B-1230']}};
x=merge({[DAY]:morning},{[DAY]:evening});
assert.equal(x.sessions[DAY].essayDrafts['strain-Q'].fullAnswer,'完整修訂');
assert.equal(x.action.conflicts.length,0);
// Cumulative minutes cannot be summed across imports, and unrelated dates stay.
const timed={...empty,elapsed:150,remaining:150};
x=merge({[DAY]:timed,'2026-10-27':{date:'2026-10-27',notes:['保留前一日']}},
 {[DAY]:{...timed,elapsed:200,remaining:100}});
assert.equal(x.sessions[DAY].elapsed,200);
assert.equal(x.sessions['2026-10-27'].notes[0],'保留前一日');
console.log('PASS study30 safe JSON roundtrip: empty, drafts, conflict archive, lineage, idempotency, time');
