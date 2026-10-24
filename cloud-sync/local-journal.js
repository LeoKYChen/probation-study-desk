/* Metadata-only, offline-first journal of local learning writes.
 * Each open page owns a DISTINCT localStorage slot per module, so simultaneous
 * browser tabs never read/modify/write the same queue key. No answer, note,
 * auth token, raw record or Firebase SDK is stored/imported here.
 *
 * This is a best-effort notification channel, NOT an atomic upload queue.
 * SHA-256 comparison against actual local data remains authoritative.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root&&root.document)root.PSDLocalJournal=api.browser(root);
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const PREFIX='psd-firebase-local-journal-v2:',
  BOUND='psd-firebase-local-data-bound-v1',
  RESTORE='psd-firebase-restore-login-v1';
 const SUPPORTED=new Set([
  'psd-ai-custom-rules-v1',
  'probation-study30-v251:v1',
  'probation-study-desk-v24',
  'probation-study-desk-v3',
  'probation-study-desk-v2',
  'probation-daily-github:records:v1',
  'daily-reading-test:saved',
  'psd-common-subjects-v1',
  'psd-staresto-link-coach-v06',
  'psd-staresto-daily-v04',
  'jj-bookmarks','jj-read','jj-font','psd-home-exam-countdown-v1',
  'psd-lecture-planner-v1','psd-unified-backup-conflicts-v1',
  'desk'
 ]);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function account(storage){
  if(storage.getItem(RESTORE)!=='yes')return null;
  let v;
  try{v=JSON.parse(storage.getItem(BOUND)||'null')}catch{return null}
  return v&&typeof v.uid==='string'&&/^[a-zA-Z0-9_-]{5,160}$/.test(v.uid)
    &&typeof v.projectId==='string'&&/^[a-z0-9][a-z0-9-]{2,100}$/.test(v.projectId)?v:null;
 }
 function keyOf(a){return PREFIX+a.projectId+':'+a.uid+':'}
 const validSlot=/^[a-zA-Z0-9_-]{6,110}$/;
 function create(storage,{token=()=>Math.random().toString(36).slice(2)+Date.now().toString(36),
  tabId='tab-'+Math.random().toString(36).slice(2)+Date.now().toString(36),
  signal=()=>{}}={}) {
  if(!validSlot.test(tabId))throw Error('無效的本機分頁標記');
  function slotKey(a,module){return keyOf(a)+encodeURIComponent(module)+':'+tabId;}
  function snapshot(){
   const a=account(storage);if(!a)return null;
   const prefix=keyOf(a),entries=Object.create(null),slots=[];
   try{
    // enumerate existing *individual* slots. Avoid a shared JSON index whose
    // updates can be lost when two independent tabs write at the same time.
    for(let i=0;i<storage.length;i++){
     const key=storage.key(i);
     if(typeof key!=='string'||!key.startsWith(prefix))continue;
     const remainder=key.slice(prefix.length),colon=remainder.lastIndexOf(':');
     if(colon<1)continue;
     const suffix=remainder.slice(colon+1);
     if(!validSlot.test(suffix))continue;
     let module;
     try{module=decodeURIComponent(remainder.slice(0,colon))}catch{continue}
     if(!SUPPORTED.has(module)||encodeURIComponent(module)!==remainder.slice(0,colon))continue;
     let record;
     try{record=JSON.parse(storage.getItem(key)||'null')}catch{continue}
     if(record?.version!==2||record.module!==module||
       typeof record.token!=='string'||record.token.length>110||!record.token)continue;
     entries[module]=record.token;
     slots.push({key,module,token:record.token});
    }
    return {key:prefix,entries,slots};
   }catch{
    // If the browser blocks storage enumeration, do not claim work was synced.
    return {key:prefix,entries:Object.create(null),slots:[],unavailable:true};
   }
  }
  function note(module){
   if(!SUPPORTED.has(module))return false;
   const a=account(storage);if(!a)return false;
   try{
    const id=String(token());
    if(!id||id.length>110)return false;
    storage.setItem(slotKey(a,module),JSON.stringify({version:2,module,token:id}));
    signal();return true;
   }catch{return false}
  }
  function acknowledge(previous){
   const a=account(storage);
   if(!a||!previous||previous.key!==keyOf(a)||previous.unavailable)return false;
   if(!Array.isArray(previous.slots))return false;
   let changed=false;
   for(const row of previous.slots){
    if(!row||typeof row.key!=='string'||typeof row.module!=='string'||typeof row.token!=='string'||
       !SUPPORTED.has(row.module)||!row.key.startsWith(keyOf(a))||
       row.key!==keyOf(a)+encodeURIComponent(row.module)+':'+row.key.slice(row.key.lastIndexOf(':')+1))
      continue;
    try{
     const record=JSON.parse(storage.getItem(row.key)||'null');
     if(record?.version===2&&record.module===row.module&&record.token===row.token){
      storage.removeItem(row.key);
      changed=true;
     }
    }catch{}
   }
   if(changed)signal();
   return changed;
  }
  return {note,snapshot,acknowledge};
 }
 function browser(root){
  let channel=null;
  function signal(){
   try{root.dispatchEvent(new Event('psd:local-change'))}catch{}
   try{
    if(!channel&&typeof root.BroadcastChannel==='function')channel=new root.BroadcastChannel('psd-learning-changes-v1');
    channel?.postMessage({type:'changed'}); // Never send identifiers or content.
   }catch{}
  }
  const secureId=()=>root.crypto?.randomUUID?.()||'tab-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  return create(root.localStorage,{tabId:secureId(),token:secureId,signal});
 }
 return {SUPPORTED,account,keyOf,create,browser};
});
