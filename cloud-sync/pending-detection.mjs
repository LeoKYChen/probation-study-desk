/*
 * Read-only local dirty detector. No Firebase SDK or network I/O.
 * A "pending" record means the browser's persisted value differs from its
 * LAST SUCCESSFUL sync baseline; it does not claim remote availability.
 */
import {fingerprint} from './whole-site-core.mjs';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const deskCanonical=r=>JSON.stringify({value:r.value,deleted:r.deleted});
const ignoreDesk=id=>id==='settings/recommendation-audit';
export async function pendingChanges(core,localStorageState,deskState,modulesShadow={},deskShadow={}){
 if(!core?.modules || !core?.CONFLICT_KEY)throw Error('找不到完整備份模組清單');
 const supported=new Set([...core.modules.map(x=>x.key),core.CONFLICT_KEY]);
 let modules=0,desk=0,knownModule=0,knownDesk=0;
 for(const key of supported){
  const raw=localStorageState?.[key];
  const baseline=modulesShadow?.[key];
  if(raw===undefined){
   // We do not automatically delete remote data; this counts as a difference
   // which must be resolved through explicit preview.
   if(typeof baseline?.hash==='string')modules++;
   continue;
  }
  if(typeof baseline?.hash==='string')knownModule++;
  if((await fingerprint(raw))!==baseline?.hash)modules++;
 }
 const currentRecords=deskState?.records||{};
 for(const [id,record] of Object.entries(currentRecords)){
  if(ignoreDesk(id))continue;
  const baseline=deskShadow?.[id];
  if(typeof baseline?.hash==='string')knownDesk++;
  if((await fingerprint(deskCanonical(record)))!==baseline?.hash)desk++;
 }
 for(const [id,baseline] of Object.entries(deskShadow||{}))
  if(!ignoreDesk(id)&&!own(currentRecords,id)&&typeof baseline?.hash==='string')
   desk++;
 return {modules,desk,total:modules+desk,knownModule,knownDesk,
  status:(knownModule||knownDesk)?'has-baseline':'first-sync'};
}
