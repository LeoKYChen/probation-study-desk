/* Offline-first, metadata-only journal of local learning writes.
 * Never stores an answer, AI response, auth token or raw record in the queue.
 * The persisted localStorage/IndexedDB data is the source of truth, NOT this
 * best-effort queue. This module does not import Firebase or make requests.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root&&root.document)root.PSDLocalJournal=api.browser(root);
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const PREFIX='psd-firebase-local-journal-v1:',
  BOUND='psd-firebase-local-data-bound-v1',
  RESTORE='psd-firebase-restore-login-v1',
  MAX_EVENTS=16;
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
 function keyOf(a){return PREFIX+a.projectId+':'+a.uid}
 function read(storage,a) {
  try{
   const v=JSON.parse(storage.getItem(keyOf(a))||'null');
   if(v?.version!==1||!v.entries||typeof v.entries!=='object'||Array.isArray(v.entries))
    return Object.create(null);
   const result=Object.create(null);
   for(const [k,token] of Object.entries(v.entries))
    if(SUPPORTED.has(k)&&typeof token==='string'&&token.length<=110)result[k]=token;
   return result;
  }catch{return Object.create(null)}
 }
 function create(storage,{token=()=>Math.random().toString(36).slice(2)+Date.now().toString(36),
  signal=()=>{}}={}) {
  function snapshot(){
   const a=account(storage);
   return a?{key:keyOf(a),entries:read(storage,a)}:null;
  }
  function note(module) {
   if(!SUPPORTED.has(module))return false;
   const a=account(storage);if(!a)return false;
   try{
    const entries=read(storage,a);
    const id=String(token());
    if(!id||id.length>110)return false;
    entries[module]=id;
    const items=Object.entries(entries);
    if(items.length>MAX_EVENTS)for(const [k] of items.slice(0,items.length-MAX_EVENTS))delete entries[k];
    storage.setItem(keyOf(a),JSON.stringify({version:1,entries}));
    signal();return true;
   }catch{return false}
  }
  function acknowledge(previous){
   const current=snapshot();
   if(!current||!previous||previous.key!==current.key)return false;
   try{
    const entries=current.entries;
    let changed=false;
    for(const [k,old] of Object.entries(previous.entries||{})){
     if(own(entries,k)&&entries[k]===old){delete entries[k];changed=true;}
    }
    if(changed)storage.setItem(current.key,JSON.stringify({version:1,entries}));
    if(changed)signal();
    return changed;
   }catch{return false}
  }
  return {note,snapshot,acknowledge};
 }
 function browser(root){
  let channel=null;
  function signal(){
   try{root.dispatchEvent(new Event('psd:local-change'))}catch{}
   try{
    if(!channel&&typeof root.BroadcastChannel==='function')channel=new root.BroadcastChannel('psd-learning-changes-v1');
    channel?.postMessage({type:'changed'}); // No user data or keys.
   }catch{}
  }
  const api=create(root.localStorage,{token:()=>root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2),signal});
  return api;
 }
 return {SUPPORTED,account,keyOf,create,browser};
});
