/* Experimental opt-in Drive protocol for full learning + desk backups. */
import * as full from './full-backup.mjs';
import {same} from '../cloud-sync/core.js';
export const FORMAT='psd-full-drive-snapshot-v1';
const LIMIT=1000;
function assert(ok,message){if(!ok)throw Error(message);}
function state(bundle){return {learning:bundle.learning.data,desk:bundle.desk.accounts.slice().sort((a,b)=>a.namespace.localeCompare(b.namespace))};}
function validateSnapshot(snapshot,core){
 assert(snapshot&&snapshot.format===FORMAT&&snapshot.schemaVersion===1&&typeof snapshot.id==='string'&&snapshot.id.length>0&&snapshot.id.length<=200&&typeof snapshot.device==='string'&&snapshot.device.length>0&&snapshot.device.length<=200&&typeof snapshot.createdAt==='string','完整同步快照格式不符');
 return full.validate(snapshot.backup,core);
}
export function create({core,learning,deskDatabase,transport,origin,deviceId,newId,clock=()=>new Date().toISOString()}){
 assert(core&&learning&&deskDatabase&&transport&&typeof transport.ensureFolder==='function'&&typeof newId==='function'&&typeof deviceId==='string'&&deviceId,'完整同步設定不符');
 let busy=false;
 const collect=()=>full.collect({core,learning,deskDatabase,origin,clock});
 async function sync(progress=()=>{}){
  assert(!busy,'同步已在執行');busy=true;let imported=0;
  try{
   progress('正在檢查測試同步資料夾…');const folder=await transport.ensureFolder(),list=await transport.listSnapshots(folder);
   assert(Array.isArray(list)&&list.length<=LIMIT,'同步快照過多或格式不符');
   const ordered=list.slice().sort((a,b)=>String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
   const remote=[];
   for(let i=0;i<ordered.length;i++){
    const row=ordered[i];assert(row&&typeof row.id==='string'&&row.id,'雲端檔案識別碼不符');
    progress('驗證雲端快照 '+(i+1)+'／'+ordered.length+'…');remote.push(validateSnapshot(await transport.readSnapshot(row.id),core));
   }
   // Check every payload and unsupported module before any write.
   for(const bundle of remote)await full.planRestore({bundle,core,learning,deskDatabase});
   let conflicts=0;
   for(const bundle of remote){
    progress('保留並合併雲端版本…');const plan=await full.planRestore({bundle,core,learning,deskDatabase});
    const result=await full.applyRestore({plan,learning,deskDatabase});imported++;conflicts+=result.conflicts.length+(plan.modulePlan.conflicts||[]).length;
   }
   // Different devices may deliberately retain different primary desk versions.
   // Compare against every immutable remote snapshot to avoid endless uploads.
   const local=await collect(),changed=!remote.some(snapshot=>same(state(local),state(snapshot)));
   if(changed){
    progress('上傳新的完整測試快照…');const id=newId(),createdAt=clock();
    const snapshot={format:FORMAT,schemaVersion:1,id,createdAt,device:deviceId,backup:local};validateSnapshot(snapshot,core);await transport.writeSnapshot(folder,snapshot);
   }
   const pendingLocalChanges=!same(state(await collect()),state(local));
   return {folderId:folder,remoteSnapshots:remote.length,importedSnapshots:imported,conflicts,uploaded:changed,pendingLocalChanges};
  }catch(e){if(imported){const error=Error('部分雲端版本已安全保留，後續同步未完成；請保留 JSON 備份並重試：'+e.message);error.cause=e;throw error;}throw e;}
  finally{busy=false;}
 }
 return {sync,isBusy:()=>busy};
}
