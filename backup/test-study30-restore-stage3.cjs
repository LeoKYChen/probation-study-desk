// Stage 3 acceptance: explicit A/B restore survives all older Drive snapshots.
'use strict';
const assert=require('node:assert/strict');
require('./unified-core.js');
require('./drive-sync-core.js');
const core=globalThis.PSDUnifiedBackup, protocol=globalThis.PSDDriveSyncCore;
const KEY='probation-study30-v251:v1',DATE='2099-12-31',Q='SYNTHETIC-CONFLICT-TEST-ONLY';
const store=(start={})=>{
 const m=new Map(Object.entries(start));
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
};
const session=(letter,legacy=false)=>({
 date:DATE,questionId:Q,notes:['【合成 '+letter+'】'],
 essayDrafts:{[Q]:{template:'theory',outline:['【合成 '+letter+'】'],fullAnswer:'【合成 '+letter+'】'}},
 ...(!legacy?{_sync:{revision:'synthetic-'+letter,device:letter,ancestors:['synthetic-base']}}:{})
});
const val=record=>JSON.stringify({version:1,sessions:{[DATE]:record}});
const main=s=>JSON.parse(s.getItem(KEY)).sessions[DATE];
const answer=record=>record.essayDrafts[Q].fullAnswer;
const bundle=(data,exportedAt)=>({format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt,
 sourceOrigin:'https://synthetic.test',data});
const cloud=()=>{
 const files=[];
 return {files,transport:{
  async ensureFolder(){return 'fake-folder'},
  async listSnapshots(){return files.map((s,i)=>({id:'fake_'+i,createdTime:s.createdAt}))},
  async readSnapshot(id){return files[Number(id.replace('fake_',''))]},
  async writeSnapshot(folder,payload){
   assert.equal(folder,'fake-folder');files.push(payload);return {id:'fake_'+(files.length-1)};
  }
 }};
};
let tick=0;
const clock=()=>new Date(Date.UTC(2026,9,29,0,tick++)).toISOString();
const engine=(s,c,id)=>protocol.createEngine({core,storage:s,transport:c.transport,
 origin:'https://synthetic.test',deviceId:id,clock,newId:()=>id+'-id-'+tick++});
function restore(s,letter){
 const snap=core.storageSnapshot(s),found=core.listStudy30Conflicts(snap);
 const record=found.map(x=>[x.index,x.existing,'existing']).concat(found.map(x=>[x.index,x.incoming,'incoming']))
  .find(([,data])=>answer(data)==='【合成 '+letter+'】');
 assert(record,'old '+letter+' is available in conflict history');
 const plan=core.planStudy30ConflictRestore(snap,record[0],record[2],'manual-restore-'+letter+'-'+tick++);
 assert.equal(plan.changed,true);
 core.apply(s,plan);
 assert.equal(answer(main(s)),'【合成 '+letter+'】');
 assert.throws(()=>core.apply(s,plan),/預覽後已有更新/,'stale restore must be rejected');
 const archive=core.listStudy30Conflicts(core.storageSnapshot(s));
 assert(archive.some(x=>answer(x.incoming)==='【合成 A】'||answer(x.existing)==='【合成 A】'));
 assert(archive.some(x=>answer(x.incoming)==='【合成 B】'||answer(x.existing)==='【合成 B】'));
}
async function scenario(legacy){
 const c=cloud(),phone=store({[KEY]:val(session('A',legacy))}),office=store({[KEY]:val(session('B',legacy))});
 await engine(phone,c,'phone').sync();
 await engine(office,c,'office').sync();
 const fresh=store();
 await engine(fresh,c,'fresh').sync();
 assert.equal(core.listStudy30Conflicts(core.storageSnapshot(fresh)).length>0,true);
 restore(fresh,'B');
 await engine(fresh,c,'fresh').sync();
 assert.equal(answer(main(fresh)),'【合成 B】','cloud sync cannot undo explicit B restore');
 const newDevice=store();
 const noUpload=await engine(newDevice,c,'new-device').sync();
 assert.equal(answer(main(newDevice)),'【合成 B】','other browser must recover B primary');
 assert.equal(noUpload.uploaded,false,'unchanged new browser must not write another snapshot');
 assert(core.listStudy30Conflicts(core.storageSnapshot(newDevice)).length>=1,'A preserved in history');
 restore(fresh,'A');
 await engine(fresh,c,'fresh').sync();
 const other=store();
 await engine(other,c,'other-device').sync();
 assert.equal(answer(main(other)),'【合成 A】','A must be recoverable even after B restored');
 assert(core.listStudy30Conflicts(core.storageSnapshot(other)).length>=1,'B preserved in history');
 const after=c.files.length;
 await engine(other,c,'other-device').sync();
 assert.equal(c.files.length,after,'unchanged restore should not upload duplicates');
 return c.files.length;
}
Promise.all([scenario(false),scenario(true)]).then(counts=>{
 console.log('PASS Stage3 restores: tracked & legacy A → B → A; cloud snapshots, fresh browsers, archive retention, stale guard, idempotence; snapshots='+counts.join(','));
}).catch(e=>{console.error(e);process.exitCode=1});
