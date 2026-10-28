// Stage 2 regression tests: synthetic study data only.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('./unified-core.js');
const core=globalThis.PSDUnifiedBackup,KEY='probation-study30-v251:v1',DAY='2026-10-28';
const wrap=sessions=>JSON.stringify({version:1,sessions});
const current=(sessions,entries=[])=>({[KEY]:wrap(sessions),
 [core.CONFLICT_KEY]:JSON.stringify({schema:core.CONFLICT_KEY,entries})});
const backup=(sessions)=>({format:core.FORMAT,schemaVersion:core.SCHEMA,
 exportedAt:'2026-10-28T09:00:00Z',sourceOrigin:'https://example.test',data:{[KEY]:wrap(sessions)}});
const phone={date:DAY,questionId:'Q',elapsed:0,notes:[],essayDrafts:{Q:{outline:['Merton','Agnew'],fullAnswer:''}}};
const office={...phone,essayDrafts:{Q:{outline:['Merton','Agnew'],fullAnswer:'中午補充'}}};
const officeConflict={...phone,essayDrafts:{Q:{outline:['不同答案'],fullAnswer:'另一說'}}};
function loadImporter(){
 const source=fs.readFileSync('professional/backup-import.js','utf8');
 const context={window:{PSDUnifiedBackup:core},document:{readyState:'loading',addEventListener(){}},
  location:{origin:'https://example.test'},console};
 vm.runInNewContext(source,context,{filename:'professional/backup-import.js'});
 return context.window.Study30BackupImport;
}
const api=loadImporter();
const oldFile=JSON.stringify({format:'probation-study30-v252',version:1,data:JSON.parse(wrap({[DAY]:phone}))});
assert.equal(api.parse(oldFile).sessions[DAY].essayDrafts.Q.outline[1],'Agnew');
assert.equal(api.parse(JSON.stringify(backup({[DAY]:office}))).sessions[DAY].essayDrafts.Q.fullAnswer,'中午補充');
assert.throws(()=>api.merge({version:1,sessions:{}},{version:1,sessions:{}},'replace'),/安全合併/);
const empty={date:DAY,questionId:'Q',elapsed:0,notes:[],finished:false};
const merged=api.merge({version:1,sessions:{[DAY]:empty}},api.parse(oldFile),'merge');
assert.equal(merged.result.sessions[DAY].essayDrafts.Q.outline[1],'Agnew');
assert.equal(merged.conflicts,0);
const divergent=api.merge({version:1,sessions:{[DAY]:phone}},
 {version:1,sessions:{[DAY]:officeConflict}},'merge');
assert.equal(divergent.conflicts,1);
assert.equal(divergent.result.sessions[DAY].essayDrafts.Q.outline[0],'Merton');
const entry=divergent.plan.conflicts[0];
const initial=current({[DAY]:phone},[entry]);
const listed=core.listStudy30Conflicts(initial);
assert.equal(listed.length,1);
assert.equal(listed[0].incoming.essayDrafts.Q.outline[0],'不同答案');
const selection=core.planStudy30ConflictRestore(initial,0,'incoming');
assert.equal(JSON.parse(selection.changes[KEY]).sessions[DAY].essayDrafts.Q.fullAnswer,'另一說');
const archived=JSON.parse(selection.changes[core.CONFLICT_KEY]).entries;
assert.equal(archived.length,2);
assert.equal(archived[1].incoming.essayDrafts.Q.outline[0],'Merton');
const memory=new Map(Object.entries(initial));
const storage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
core.apply(storage,selection);
assert.equal(JSON.parse(memory.get(KEY)).sessions[DAY].essayDrafts.Q.fullAnswer,'另一說');
assert.throws(()=>core.apply(storage,selection),/預覽後已有更新/);
assert.throws(()=>core.planStudy30ConflictRestore(initial,999,'incoming'),/找不到/);
// Independent attempts with distinct ids survive merges without double-counting timer.
const one={...phone,elapsed:200,essayVersions:{'attempt-1':{questionId:'Q',savedAt:'2026-10-28T07:30:00Z',
 draft:{outline:['Merton'],fullAnswer:'早上'}}}};
const two={...phone,elapsed:220,essayVersions:{'attempt-2':{questionId:'Q',savedAt:'2026-10-28T12:30:00Z',
 draft:{outline:['Agnew'],fullAnswer:'中午'}}}};
const planned=core.plan({[KEY]:wrap({[DAY]:one})},backup({[DAY]:two}));
const result=JSON.parse(planned.changes[KEY]).sessions[DAY];
assert.equal(Object.keys(result.essayVersions).length,2);
assert.equal(result.elapsed,220);
assert.equal(planned.conflicts.length,0);
for(const path of ['professional/essay-version-history.js','backup/app.js','professional/practice-session.js'])
 new vm.Script(fs.readFileSync(path,'utf8'),{filename:path});
console.log('PASS stage2: standalone/full import, safe conflict restore, snapshots, counter and script syntax');
