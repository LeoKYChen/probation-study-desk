/* Draft IndexedDB adapter for the existing append-only Drive snapshot protocol. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDIndexedDrive=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function create({core,protocol,backup,transport,origin,deviceId,newId,clock=()=>new Date().toISOString()}){
  if(!core || !protocol || !backup || !transport || typeof transport.ensureFolder!=='function' || typeof newId!=='function' || typeof deviceId!=='string' || !deviceId)throw Error('同步設定不完整');
  let busy=false;
  const bundle=data=>({format:core.FORMAT,schemaVersion:core.SCHEMA,exportedAt:clock(),sourceOrigin:String(origin||''),data});
  async function sync(onProgress=()=>{}){
   if(busy)throw Error('同步已在執行');
   busy=true;
   try{
    onProgress('正在確認 Google Drive 同步資料夾…');
    const folder=await transport.ensureFolder(), list=await transport.listSnapshots(folder);
    if(!Array.isArray(list)||list.length>protocol.MAX_SNAPSHOTS)throw Error('同步快照過多或格式不符');
    const sorted=list.slice().sort((a,b)=>String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
    let remote=Object.create(null);
    for(let i=0;i<sorted.length;i++){
     onProgress('讀取 Google Drive 快照 '+(i+1)+'／'+sorted.length+'…');
     const row=sorted[i]; if(!row || typeof row.id!=='string' || !row.id)throw Error('雲端檔案識別碼錯誤');
     const incoming=protocol.checkSnapshot(await transport.readSnapshot(row.id),core);
     const plan=core.plan(remote,incoming);
     remote=Object.assign(Object.create(null),remote,plan.changes);
    }
    onProgress('檢查本機草稿與不同版本…');
    const plan=await backup.plan(bundle(remote));
    if(Object.keys(plan.changes).length)await backup.apply(plan);
    const localBundle=await backup.collect(), signature=protocol.stateSignature(localBundle.data);
    const changed=signature!==protocol.stateSignature(remote);
    if(changed){
     onProgress('上傳新的不可變同步快照…');
     await transport.writeSnapshot(folder,protocol.snapshotPayload(localBundle,newId(),clock(),deviceId));
    }
    const pendingLocalChanges=protocol.stateSignature((await backup.collect()).data)!==signature;
    return {folderId:folder,remoteSnapshots:sorted.length,appliedKeys:Object.keys(plan.changes).length,conflicts:plan.conflicts.length,uploaded:changed,changed,pendingLocalChanges};
   }finally{busy=false;}
  }
  return {sync,isBusy:()=>busy};
 }
 return {create};
});
