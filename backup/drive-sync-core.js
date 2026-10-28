/* Local-first sync protocol. No tokens, OAuth secrets or private learning data are stored here. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDDriveSyncCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const FORMAT='psd-drive-sync-snapshot-v1',MAX_SNAPSHOTS=1000;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function assert(test,message){if(!test)throw Error(message);}
 function stateSignature(data){
  return JSON.stringify(Object.keys(data).sort().map(k=>[k,JSON.parse(data[k])]));
 }
 function snapshotPayload(backup,id,now,device){
  return {format:FORMAT,schemaVersion:1,id,createdAt:now,
   device,backup};
 }
 function checkSnapshot(snapshot,core){
  assert(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)&&
   snapshot.format===FORMAT&&snapshot.schemaVersion===1&&
   typeof snapshot.id==='string'&&snapshot.id.length<=200&&
   typeof snapshot.createdAt==='string'&&
   typeof snapshot.device==='string'&&snapshot.device.length<=200,
   'Google Drive 同步快照格式不符，已停止合併');
  core.validate(snapshot.backup);
  return snapshot.backup;
 }
 function bundle(core,data,origin,stamp){
  const result={format:core.FORMAT,schemaVersion:core.SCHEMA,
   exportedAt:stamp,sourceOrigin:origin,data};
  core.validate(result);
  return result;
 }
 function createEngine({core,storage,transport,origin,deviceId,clock=()=>new Date().toISOString(),newId}){
  assert(core&&typeof core.plan==='function'&&typeof core.apply==='function','缺少共用安全合併核心');
  assert(storage&&typeof storage.getItem==='function','缺少瀏覽器儲存空間');
  assert(transport&&typeof transport.ensureFolder==='function','缺少 Google Drive 傳輸介面');
  assert(typeof origin==='string'&&typeof deviceId==='string'&&deviceId.length>0,'同步裝置資訊格式錯誤');
  assert(typeof newId==='function','缺少安全的快照識別碼產生器');
  let busy=false;
  async function sync(onProgress=()=>{}){
   assert(!busy,'同步已在執行');
   busy=true;
   try{
    onProgress('正在確認 Google Drive 同步資料夾…');
    const folder=await transport.ensureFolder();
    const list=await transport.listSnapshots(folder);
    assert(Array.isArray(list)&&list.length<=MAX_SNAPSHOTS,
     '同步快照已超過 '+MAX_SNAPSHOTS+' 筆；請先手動完整備份，勿刪除歷史快照，等待安全封存功能');
    const sorted=list.slice().sort((a,b)=>
     String(a.createdTime||'').localeCompare(String(b.createdTime||''))||
     String(a.id).localeCompare(String(b.id)));
    let remote=Object.create(null);
    for(let i=0;i<sorted.length;i++){
     onProgress('讀取 Google Drive 快照 '+(i+1)+'／'+sorted.length+'…');
     const row=sorted[i];
     assert(row&&typeof row.id==='string'&&row.id,'雲端檔案識別碼錯誤');
     const snapshot=await transport.readSnapshot(row.id);
     const backup=checkSnapshot(snapshot,core);
     const next=core.plan(remote,backup);
     remote=Object.assign(Object.create(null),remote,next.changes);
    }
    // Read local data only after downloads; this also permits foreground practice
    // to continue while network operations occur.
    onProgress('檢查本機草稿與不同版本…');
    const before=core.storageSnapshot(storage);
    const stamp=clock();
    const plan=core.plan(before,bundle(core,remote,origin,stamp));
    const combined=Object.assign(Object.create(null),before,plan.changes);
    // Fails closed if another tab changes localStorage between plan and commit.
    if(Object.keys(plan.changes).length)core.apply(storage,plan);
    const after=core.storageSnapshot(storage);
    const needUpload=stateSignature(after)!==stateSignature(remote);
    let uploaded=null;
    if(needUpload){
     onProgress('上傳新的不可變同步快照…');
     const backup=core.collect(storage,origin);
     uploaded=await transport.writeSnapshot(folder,snapshotPayload(backup,newId(),clock(),deviceId));
    }
    const pendingLocalChanges=stateSignature(core.storageSnapshot(storage))!==stateSignature(after);
    return {folderId:folder,remoteSnapshots:sorted.length,appliedKeys:Object.keys(plan.changes).length,
     conflicts:plan.conflicts.length,uploaded:!!uploaded,changed:needUpload,pendingLocalChanges};
   }finally{busy=false;}
  }
  return {sync,isBusy:()=>busy};
 }
 return {FORMAT,MAX_SNAPSHOTS,stateSignature,checkSnapshot,snapshotPayload,createEngine};
});
