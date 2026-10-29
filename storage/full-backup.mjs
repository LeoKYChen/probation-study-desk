/* Draft full-backup envelope: existing module backup plus every desk namespace.
   Export only. Do not present as a restorable complete backup until restore is integrated. */
import {FORMAT as DESK_FORMAT,validateState,same} from '../cloud-sync/core.js';
export const FORMAT='psd-full-learning-backup-v2';
function assert(test,message){if(!test)throw Error(message);}
export function validate(bundle,core){
 assert(bundle&&typeof bundle==='object'&&!Array.isArray(bundle)&&bundle.format===FORMAT&&bundle.schemaVersion===2,'完整備份格式不符');
 assert(typeof bundle.exportedAt==='string'&&typeof bundle.sourceOrigin==='string','備份日期或來源不符');
 core.validate(bundle.learning);
 assert(bundle.desk&&bundle.desk.format===DESK_FORMAT&&bundle.desk.schemaVersion===1&&Array.isArray(bundle.desk.accounts)&&bundle.desk.accounts.length<=100,'備考書桌備份格式不符');
 const seen=new Set();
 for(const row of bundle.desk.accounts){
  assert(row&&typeof row.namespace==='string'&&row.namespace.length>0&&row.namespace.length<=500&&!seen.has(row.namespace),'書桌範圍不符');
  seen.add(row.namespace);validateState(row.state);
 }
 return bundle;
}
function accounts(database){
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('accounts','readonly'),store=tx.objectStore('accounts');
  const names=store.getAllKeys(),values=store.getAll();let result;
  tx.oncomplete=()=>{
   try{
    assert(names.result.length===values.result.length,'書桌資料讀取不完整');
    result=names.result.map((namespace,i)=>({namespace,state:values.result[i]}));
    for(const row of result){assert(typeof row.namespace==='string'&&row.namespace.length>0&&row.namespace.length<=500,'書桌範圍不符');validateState(row.state);}
    resolve(result);
   }catch(e){reject(e);}
  };
  tx.onabort=()=>reject(tx.error||Error('無法讀取備考書桌'));
  tx.onerror=()=>{};
 });
}
export async function collect({core,learning,deskDatabase,origin,clock=()=>new Date().toISOString()}){
 assert(core&&learning&&typeof learning.collect==='function'&&deskDatabase,'缺少完整備份來源');
 const before=await learning.collect(),deskBefore=await accounts(deskDatabase);
 const deskAfter=await accounts(deskDatabase),after=await learning.collect();
 assert(same(before.data,after.data)&&same(deskBefore,deskAfter),'備份期間資料已變更，請關閉其他編輯分頁後重試');
 const result={format:FORMAT,schemaVersion:2,exportedAt:clock(),sourceOrigin:String(origin||''),learning:after,desk:{format:DESK_FORMAT,schemaVersion:1,accounts:deskAfter}};
 return validate(result,core);
}

// Stage desk imports in the existing accounts database without overwriting a
// different local namespace. Conflicting full states remain in a distinct
// deterministic archive namespace; UI for inspection/recovery is not yet wired.
export async function planDeskImport(bundle,core,deskDatabase){
 validate(bundle,core);
 const current=await accounts(deskDatabase),known=new Map(current.map(row=>[row.namespace,row.state]));
 const writes=[],conflicts=[],baseline=new Map();
 for(const row of bundle.desk.accounts){
  const existing=known.get(row.namespace);
  if(existing===undefined){baseline.set(row.namespace,null);writes.push({namespace:row.namespace,state:structuredClone(row.state)});continue;}
  baseline.set(row.namespace,structuredClone(existing));
  if(same(existing,row.state))continue;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.namespace,row.state])));
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const archive='backup-archive:'+hash, previous=known.get(archive);
  if(previous!==undefined&&!same(previous,row.state))throw Error('書桌封存識別碼衝突，已停止匯入');
  baseline.set(archive,previous===undefined?null:structuredClone(previous));
  if(previous===undefined)writes.push({namespace:archive,state:structuredClone(row.state)});
  conflicts.push({namespace:row.namespace,archive});
 }
 return {baseline:[...baseline].map(([namespace,state])=>({namespace,state})),writes,conflicts};
}
export function applyDeskImport(plan,deskDatabase){
 assert(plan&&Array.isArray(plan.baseline)&&Array.isArray(plan.writes)&&Array.isArray(plan.conflicts),'書桌匯入計畫不符');
 const baseline=new Map();
 for(const row of plan.baseline){
  assert(row&&typeof row.namespace==='string'&&row.namespace.length>0&&row.namespace.length<=500&&!baseline.has(row.namespace),'書桌範圍不符');
  if(row.state!==null)validateState(row.state);baseline.set(row.namespace,row.state);
 }
 const seen=new Set();
 for(const row of plan.writes){
  assert(row&&typeof row.namespace==='string'&&baseline.has(row.namespace)&&!seen.has(row.namespace),'書桌寫入範圍不符');
  validateState(row.state);seen.add(row.namespace);
  // An import must never replace a pre-existing namespace.
  assert(baseline.get(row.namespace)===null,'不得覆寫既有書桌資料');
 }
 if(!baseline.size)return Promise.resolve(0);
 return new Promise((resolve,reject)=>{
  const tx=deskDatabase.transaction('accounts','readwrite'),store=tx.objectStore('accounts');
  let left=baseline.size,failure;
  for(const [namespace,expected] of baseline){
   const request=store.get(namespace);
   request.onsuccess=()=>{
    const actual=request.result===undefined?null:request.result;
    if(!same(actual,expected)){failure=Error('書桌資料在預覽後已變更，請重新預覽');tx.abort();return;}
    if(--left===0){
     try{for(const row of plan.writes)store.put(row.state,row.namespace);}
     catch(e){failure=e;tx.abort();}
    }
   };
  }
  tx.oncomplete=()=>resolve(plan.writes.length);
  tx.onabort=()=>reject(failure||tx.error||Error('書桌匯入交易失敗'));
  tx.onerror=()=>{};
 });
}
