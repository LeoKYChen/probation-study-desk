import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingChanges} from '../../cloud-sync/pending-detection.mjs';
import {fingerprint} from '../../cloud-sync/whole-site-core.mjs';
const core={modules:[{key:'jj-read'},{key:'psd-lecture-planner-v1'}],CONFLICT_KEY:'psd-unified-backup-conflicts-v1'};
const record=(answer)=>({value:{kind:'attempt',answer},deleted:false,revision:0});
test('local-only pending changes are counted without Firebase calls',async()=>{
 const current={'jj-read':JSON.stringify(['已讀文章'])},desk={records:{'attempt/example':record('第一稿')}};
 let result=await pendingChanges(core,current,desk);
 assert.deepEqual([result.modules,result.desk,result.total],[1,1,2]);
 const moduleShadow={'jj-read':{hash:await fingerprint(current['jj-read']),revision:1}};
 const rec=desk.records['attempt/example'];
 const deskShadow={'attempt/example':{hash:await fingerprint(JSON.stringify({value:rec.value,deleted:rec.deleted})),revision:1}};
 result=await pendingChanges(core,current,desk,moduleShadow,deskShadow);
 assert.equal(result.total,0);
 current['jj-read']=JSON.stringify(['已讀文章','新增']);
 desk.records['attempt/example']=record('第二稿');
 result=await pendingChanges(core,current,desk,moduleShadow,deskShadow);
 assert.deepEqual([result.modules,result.desk,result.total],[1,1,2]);
});
test('derived local audit is not counted as cloud work',async()=>{
 const answer=record('確定保留');
 const state={records:{'settings/recommendation-audit':record('derived'),'attempt/one':answer}};
 const synced={'attempt/one':{hash:await fingerprint(JSON.stringify({value:answer.value,deleted:answer.deleted}))}};
 const pending=await pendingChanges(core,{},state,{},synced);
 assert.equal(pending.total,0);
});
test('pending detector does not mutate original snapshots',async()=>{
 const current={'jj-read':JSON.stringify(['x'])};
 const desk={records:{'attempt/one':record('未上傳')}};
 const original=structuredClone({current,desk});
 await pendingChanges(core,current,desk);
 assert.deepEqual({current,desk},original);
});

test('locally missing previously-synced records show as differences; never delete cloud',async()=>{
 const shadow={['jj-read']:{hash:await fingerprint(JSON.stringify(['old'])),revision:2}};
 const deskShadow={'attempt/old':{hash:await fingerprint(JSON.stringify({value:{kind:'attempt',answer:'old'},deleted:false})),revision:1}};
 const result=await pendingChanges(core,{}, {records:{}}, shadow, deskShadow);
 assert.equal(result.modules,1);
 assert.equal(result.desk,1);
 assert.equal(result.total,2);
});
