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
