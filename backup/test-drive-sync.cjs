// Stage 3 Google Drive protocol tests: synthetic data; NO Google API or OAuth network traffic.
'use strict';
const assert=require('node:assert/strict');
require('./unified-core.js');
const backup=globalThis.PSDUnifiedBackup;
require('./drive-sync-core.js');
const protocol=globalThis.PSDDriveSyncCore;
const KEY='probation-study30-v251:v1',DAY='2026-10-28';
const store=initial=>{
 const entries=new Map(Object.entries(initial||{}));
 return {getItem:k=>entries.has(k)?entries.get(k):null,
  setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
};
const json=x=>JSON.stringify(x);
const day=(answer,rev='A',ancestors=[])=>
 ({date:DAY,questionId:'strain-Q',mode:'30',phase:0,remaining:300,elapsed:0,notes:[],
  essayDrafts:{'strain-Q':{template:'theory',outline:[answer,'','',''],fullAnswer:''}},
  _sync:{revision:rev,device:'synthetic',ancestors}});
const local=(record)=>store({[KEY]:json({version:1,sessions:{[DAY]:record}})});
const lookup=(storage)=>JSON.parse(storage.getItem(KEY)).sessions[DAY];
function cloud(){
 const snapshots=[];
 return {snapshots,transport:{
  async ensureFolder(){return 'synthetic-folder'},
  async listSnapshots(){return snapshots.map((s,i)=>({id:'file_'+(i+10000000),createdTime:s.createdAt}))},
  async readSnapshot(id){const n=Number(id.split('_')[1])-10000000;return snapshots[n]},
  async writeSnapshot(folder,payload){assert.equal(folder,'synthetic-folder');snapshots.push(payload);return {id:'file_'+(snapshots.length+9999999)};}
 }};
}
let tick=0;
const clock=()=>new Date(Date.UTC(2026,9,28,0,tick++)).toISOString();
const make=(s,c,id)=>protocol.createEngine({core:backup,storage:s,
 transport:c.transport,origin:'https://synthetic.test',deviceId:id,newId:()=>id+'-'+tick++,clock});
async function run(){
 const remote=cloud(),phone=local(day('Merton','A1')),office=store();
 let p=await make(phone,remote,'phone').sync();
 assert.equal(p.uploaded,true);assert.equal(remote.snapshots.length,1);
 let q=await make(office,remote,'office').sync();
 assert.equal(q.uploaded,false);assert.equal(lookup(office).essayDrafts['strain-Q'].outline[0],'Merton');
 // Office continues from the morning version; that descendant becomes current on phone.
 office.setItem(KEY,json({version:1,sessions:{[DAY]:day('Merton + Agnew','B2',['A1'])}}));
 q=await make(office,remote,'office').sync();
 assert.equal(q.uploaded,true);
 p=await make(phone,remote,'phone').sync();
 assert.equal(lookup(phone).essayDrafts['strain-Q'].outline[0],'Merton + Agnew');
 assert.equal(p.uploaded,false);
 const count=remote.snapshots.length;
 await make(phone,remote,'phone').sync();assert.equal(remote.snapshots.length,count,'unchanged sync is idempotent');
 // Independent same-field edits are archived, rather than deleted by last writer.
 const phoneEdit=day('手機延伸論證','phone-3',['B2']);
 phone.setItem(KEY,json({version:1,sessions:{[DAY]:phoneEdit}}));
 const officeEdit=day('公司延伸論證','office-3',['B2']);
 office.setItem(KEY,json({version:1,sessions:{[DAY]:officeEdit}}));
 await make(phone,remote,'phone').sync();
 await make(office,remote,'office').sync();
 assert.equal(lookup(office).essayDrafts['strain-Q'].outline[0],'公司延伸論證');
 let archive=JSON.parse(office.getItem(backup.CONFLICT_KEY));
 assert(archive.entries.some(e=>e.incoming?.essayDrafts?.['strain-Q']?.outline[0]==='手機延伸論證'),
  'divergent phone version is recoverable');
 await make(phone,remote,'phone').sync();
 archive=JSON.parse(phone.getItem(backup.CONFLICT_KEY));
 assert(archive.entries.some(e=>e.incoming?.essayDrafts?.['strain-Q']?.outline[0]==='公司延伸論證'),
  'divergent office version is recoverable');
 assert(remote.snapshots.length>=4,'append-only snapshots must persist all sync rounds');
 // An invalid cloud file stops sync without writing anything back to local storage.
 const invalid=cloud(),s=local(day('原內容'));
 invalid.snapshots.push({format:protocol.FORMAT,schemaVersion:1,id:'bad',device:'x',
  createdAt:'2026-10-28T00:00:00Z',backup:{invalid:true}});
 const before=s.getItem(KEY);
 await assert.rejects(make(s,invalid,'unsafe').sync(),/備份|格式|JSON|無效/);
 assert.equal(s.getItem(KEY),before);
 assert.equal(invalid.snapshots.length,1);
 // With no token or transport method, the engine must refuse to start.
 assert.throws(()=>protocol.createEngine({core:backup,storage:s,transport:{},origin:'x',
  deviceId:'x',newId:()=>1}),/傳輸介面/);
 console.log('PASS Drive sync stage3: phone-office roundtrip, idempotence, divergence, append-only, corrupt-file protection');
}
run().catch(e=>{console.error(e);process.exitCode=1});
