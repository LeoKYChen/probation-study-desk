/*
 * Firebase whole-site sync contract, storage-agnostic and independent of SDK.
 * The existing unified backup schema is the only supported localStorage allowlist.
 * All remote writes are version-checked; conflicts retain both alternatives.
 * No background writes: callers must review preview and download an external backup.
 */
const ARCHIVE = 'psd-unified-backup-conflicts-v1';
const MAX_DOC = 850_000; // Firestore's maximum document size is approx. 1 MiB.
const bytes = data => new TextEncoder().encode(JSON.stringify(data)).length;
const has = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
export function assertRemoteDoc(doc,key) {
  if (doc === null) return null;
  if (!doc || !Number.isSafeInteger(doc.revision) || doc.revision < 1
      || typeof doc.raw !== 'string' || bytes({revision:doc.revision,raw:doc.raw})>MAX_DOC)
    throw Error('雲端紀錄格式或大小不符：'+key);
  return doc;
}
export function assertFits(raw,key) {
  if(bytes({revision:999999,raw})>MAX_DOC)
    throw Error('「'+key+'」超過單一 Firestore 文件安全大小，已停止同步；請先匯出 JSON，待支援分段同步');
}
export async function fingerprint(raw) {
  if (typeof raw!=='string')return null;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
const envelope=(core,data,origin)=>({format:core.FORMAT,schemaVersion:core.SCHEMA,sourceOrigin:origin||'',exportedAt:new Date().toISOString(),data});
function remoteData(core,documents) {
  const result=Object.create(null);
  for(const {key} of core.modules)if(documents[key]!==null&&documents[key]!==undefined)
    result[key]=assertRemoteDoc(documents[key],key).raw;
  if(documents[core.CONFLICT_KEY])result[core.CONFLICT_KEY]=assertRemoteDoc(documents[core.CONFLICT_KEY],core.CONFLICT_KEY).raw;
  core.validate(envelope(core,result,'firebase'));
  return result;
}
function verifyShadow(shadow) {
  if(!shadow||typeof shadow!=='object'||Array.isArray(shadow))return {};
  return shadow;
}
/**
 * Prepare a non-mutating, non-uploading plan. The caller must preview this.
 * @param {object} core PSDUnifiedBackup
 * @param {object} local current storageSnapshot
 * @param {object} docs cloud document snapshots indexed by supported storage key
 * @param {object} shadow per account previously successful {key:{revision,hash}}
 */
export async function prepare(core,local,docs,shadow={}) {
  const current=envelope(core,local,'local');core.validate(current);
  const cloud=remoteData(core,docs),previous=verifyShadow(shadow),next=Object.assign(Object.create(null),cloud);
  const status=[],conflicted=Object.create(null),uploads=Object.create(null);
  for(const {key,name} of core.modules) {
    const mine=local[key],theirs=cloud[key],remote=docs[key],prior=previous[key];
    const myHash=await fingerprint(mine),remoteHash=await fingerprint(theirs);
    if(mine===undefined&&theirs===undefined){status.push({key,name,status:'empty'});continue;}
    if(mine===theirs){status.push({key,name,status:'same'});continue;}
    if(theirs===undefined) {
      next[key]=mine;uploads[key]={raw:mine,expected:0};status.push({key,name,status:'upload'});continue;
    }
    if(mine===undefined) {status.push({key,name,status:'download'});continue;}
    const matchesLocal=prior?.hash===myHash;
    const matchesRemote=Number.isSafeInteger(prior?.revision) && prior.revision===remote.revision;
    if(matchesRemote&&!matchesLocal) {
      // User changed only local, cloud is still at the observed revision.
      uploads[key]={raw:mine,expected:remote.revision};
      next[key]=mine;status.push({key,name,status:'upload'});continue;
    }
    if(matchesLocal&&!matchesRemote) {status.push({key,name,status:'download'});continue;}
    // Concurrent/first-device discrepancy: keep cloud primary; preserve local in archive.
    conflicted[key]=mine;status.push({key,name,status:'conflict'});
  }
  // Use the verified manual-backup merger to combine independent record IDs
  // and keep differences in its version archive. Even list/setting conflicts
  // must preserve the entire local version: a set union alone is not a backup.
  const remoteArchive=cloud[core.CONFLICT_KEY];
  const toMerge=Object.create(null);
  for(const [key,raw] of Object.entries(conflicted))toMerge[key]=raw;
  if(local[core.CONFLICT_KEY])toMerge[core.CONFLICT_KEY]=local[core.CONFLICT_KEY];
  if(Object.keys(toMerge).length) {
    const merger=core.plan(cloud,envelope(core,toMerge,'local-differences'));
    for(const key of Object.keys(conflicted))if(merger.changes[key]){
      next[key]=merger.changes[key];
      uploads[key]={raw:next[key],expected:docs[key].revision};
    }
    const archival=merger.changes[core.CONFLICT_KEY]||remoteArchive;
    const parsed=archival?core.parseValue(core.CONFLICT_KEY,archival):{schema:core.CONFLICT_KEY,entries:[]};
    const seen=new Set(parsed.entries.map(x=>JSON.stringify(x)));
    for(const [key,raw] of Object.entries(conflicted)){
      const record={key,path:[],existing:JSON.parse(cloud[key]),incoming:JSON.parse(raw)};
      const encoded=JSON.stringify(record);
      if(!seen.has(encoded)){parsed.entries.push(record);seen.add(encoded);}
    }
    const updated=JSON.stringify(parsed);
    core.parseValue(core.CONFLICT_KEY,updated);
    next[core.CONFLICT_KEY]=updated;
  }
  if(next[core.CONFLICT_KEY]!==remoteArchive && next[core.CONFLICT_KEY]!==undefined)
    uploads[core.CONFLICT_KEY]={raw:next[core.CONFLICT_KEY],expected:docs[core.CONFLICT_KEY]?.revision||0};
  const localChanges=Object.create(null);
  for(const [key,raw] of Object.entries(next))if(raw!==local[key])localChanges[key]=raw;
  // A cloud document may not exist, but the incoming local value must still
  // be validated and protected by the document size limit before any writes.
  for(const [key,op] of Object.entries(uploads))assertFits(op.raw,key);
  core.validate(envelope(core,next,'merged'));
  const count=status.reduce((n,x)=>n+(x.status==='conflict'),0);
  return {uploads,localChanges,status,conflicts:count,baseline:structuredClone(local),cloud:docs,next};
}
/**
 * Writes are deliberately sequential (archive first) to avoid overwriting the
 * only remaining copy. After a conflict, caller must re-preview and retry.
 * Upload adapter compareAndSet returns the new integer revision.
 */
export async function commit(core,storage,adapter,plan,assertCurrent=()=>{}) {
  // Synchronous caller guard: recheck consent/identity around asynchronous IO.
  assertCurrent();
  const before=core.storageSnapshot(storage);
  for(const key of new Set([...Object.keys(before),...Object.keys(plan.baseline)]))
    if(before[key]!==plan.baseline[key])throw Error('本機紀錄在預覽後已修改，請重新檢視；未寫入雲端');
  const revisions=Object.create(null);
  const entries=Object.entries(plan.uploads).sort(([a],[b])=>(a===ARCHIVE?-1:b===ARCHIVE?1:0));
  for(const [key,op] of entries){
    assertCurrent();
    assertFits(op.raw,key);
    revisions[key]=await adapter.compareAndSet(key,op.raw,op.expected);
    assertCurrent();
  }
  // Only now change localStorage, using the existing rollback + stale guard.
  assertCurrent();
  core.apply(storage,{changes:plan.localChanges,baseline:plan.baseline});
  const shadow=Object.create(null);
  for(const [key,raw] of Object.entries(plan.next)){
    const revision=revisions[key]||plan.cloud[key]?.revision;
    if(Number.isSafeInteger(revision))shadow[key]={revision,hash:await fingerprint(raw)};
  }
  return {shadow,uploaded:entries.length,downloaded:Object.keys(plan.localChanges).length,conflicts:plan.conflicts};
}
