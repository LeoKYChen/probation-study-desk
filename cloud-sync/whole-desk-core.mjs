/*
 * Safe supplementary sync of study-desk IndexedDB (guest namespace).
 * All user data stays local unless the user explicitly previews, downloads
 * its JSON backup and approves migration. It does NOT synchronize outbox or
 * store cursors from the superseded Supabase prototype.
 */
import {validateId,validateValue,validateState} from './core.js';
import {assertFits,fingerprint,assertRemoteDoc} from './whole-site-core.mjs';

const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const canonical=record=>JSON.stringify({value:record.value,deleted:record.deleted});
function fromRaw(raw,id){
 let value;try{value=JSON.parse(raw)}catch{throw Error('書桌雲端資料無法解析：'+id)}
 if(!value || typeof value.deleted!=='boolean'||!has(value,'value'))throw Error('書桌雲端版本不正確：'+id);
 validateValue(value.value);return value;
}
export async function prepareDesk(local,documents,shadow={},uuid=()=>crypto.randomUUID()){
 validateState(local);
 const statuses=[],uploads=Object.create(null),changes=Object.create(null),archive=Object.create(null);
 const ids=new Set([...Object.keys(local.records),...Object.keys(documents)]);
 for(const id of ids){
  validateId(id);
  const mine=local.records[id],remote=documents[id]===undefined?null:assertRemoteDoc(documents[id],id);
  const theirs=remote?fromRaw(remote.raw,id):null;
  if(!mine&&!theirs)continue;
  const localRaw=mine?canonical(mine):null,cloudRaw=theirs?canonical(theirs):null;
  const previous=shadow?.[id],localHash=await fingerprint(localRaw);
  if(localRaw===cloudRaw){statuses.push({id,status:'same'});continue;}
  if(!theirs){
   assertFits(localRaw,id);uploads[id]={raw:localRaw,expected:0};statuses.push({id,status:'upload'});continue;
  }
  if(!mine){changes[id]=theirs;statuses.push({id,status:'download'});continue;}
  if(previous?.revision===remote.revision&&previous?.hash!==localHash){
   assertFits(localRaw,id);uploads[id]={raw:localRaw,expected:remote.revision};statuses.push({id,status:'upload'});continue;
  }
  if(previous?.hash===localHash&&previous?.revision!==remote.revision){
   changes[id]=theirs;statuses.push({id,status:'download'});continue;
  }
  // Conflicting concurrent/first-use edit: original local version is uploaded
  // as a new immutable archive document before changing the local main record.
  const archiveId='import/'+uuid();
  validateId(archiveId);
  if(has(documents,archiveId)||has(local.records,archiveId))throw Error('保留版本識別碼重複，請重試');
  const saved={value:{originalId:id,record:{value:structuredClone(mine.value),deleted:mine.deleted},
    importedAt:new Date().toISOString(),source:'firebase-conflict'},deleted:false};
  validateValue(saved.value);
  const archivedRaw=canonical(saved);
  assertFits(archivedRaw,archiveId);
  archive[archiveId]=saved;uploads[archiveId]={raw:archivedRaw,expected:0};
  changes[id]=theirs;statuses.push({id,status:'conflict'});
 }
 return {uploads,changes,archive,statuses,baseline:structuredClone(local),cloud:documents,
   conflicts:statuses.filter(x=>x.status==='conflict').length};
}
export async function commitDesk(store,adapter,plan){
 const before=await store.read();
 if(JSON.stringify(before)!==JSON.stringify(plan.baseline))
  throw Error('書桌紀錄在預覽後已變更，請停止同步並重新預覽');
 const remoteVersions=Object.create(null);
 // Save alternate versions before writing primary records; a partial failure
 // must never be able to erase the last known unique local answer.
 const entries=Object.entries(plan.uploads).sort(([a],[b])=>(a.startsWith('import/')?-1:b.startsWith('import/')?1:0));
 for(const [id,item] of entries){
  assertFits(item.raw,id);
  remoteVersions[id]=await adapter.compareAndSet(id,item.raw,item.expected);
 }
 await store.update(state=>{
  if(JSON.stringify(state)!==JSON.stringify(plan.baseline))
   throw Error('同步期間仍有其他分頁寫入書桌，未改動本機，請重新預覽');
  for(const [id,rec] of Object.entries(plan.changes))
   state.records[id]={value:structuredClone(rec.value),deleted:rec.deleted,revision:0};
  for(const [id,rec] of Object.entries(plan.archive))
   state.records[id]={value:structuredClone(rec.value),deleted:false,revision:0};
 });
 const updated=await store.read(),shadow=Object.create(null);
 for(const [id,rec] of Object.entries(updated.records)){
  const revision=remoteVersions[id]||plan.cloud[id]?.revision;
  if(Number.isSafeInteger(revision))
   shadow[id]={revision,hash:await fingerprint(canonical(rec))};
 }
 return {shadow,uploaded:entries.length,downloaded:Object.keys(plan.changes).length,conflicts:plan.conflicts};
}
