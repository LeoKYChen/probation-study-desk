/* Shared sync contract. No credentials, network, or browser globals. */
export const FORMAT = 'psd-study-desk-v1';
const clone = value => structuredClone(value);
export const same = (a,b) => stable(a) === stable(b);
function stable(v) {
  if (Array.isArray(v)) return '['+v.map(stable).join(',')+']';
  if(v && typeof v === 'object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
export function validateValue(value) {
  function check(v, depth=0) {
    if(depth>35) throw Error('資料層次過深');
    if(v===null || typeof v==='string' || typeof v==='boolean') return;
    if(typeof v==='number' && Number.isFinite(v)) return;
    if(!v || typeof v!=='object' || Object.getPrototypeOf(v)!==Object.prototype && !Array.isArray(v)) throw Error('資料格式不符');
    if(Object.keys(v).length>10000) throw Error('資料筆數過多');
    for(const [key,item] of Object.entries(v)) {
      if(['__proto__','constructor','prototype'].includes(key)) throw Error('不安全的資料欄位');
      check(item,depth+1);
    }
  }
  check(value);
  if(new TextEncoder().encode(JSON.stringify(value)).length>1000000) throw Error('單筆資料超過1MB，請分段保存');
}
export function validateId(id) {
  if(typeof id!=='string' || (Object.hasOwn(Object.prototype,id)||id==='prototype') || !/^[a-zA-Z0-9_:/.-]{1,240}$/.test(id)) throw Error('紀錄識別碼不符');
}
export function emptyState() { return {schema:1,records:{},outbox:{},conflicts:{},cursor:0}; }
export function validateState(state) {
  if(!state || state.schema!==1 || !Number.isSafeInteger(state.cursor) || state.cursor<0) throw Error('書桌備份版本不符');
  for(const kind of ['records','outbox','conflicts']) {
    if(!state[kind] || Array.isArray(state[kind]) || typeof state[kind]!=='object') throw Error('書桌資料不符');
    for(const id of Object.keys(state[kind])) validateId(id);
  }
  for(const rec of Object.values(state.records)) {
    if(!rec || !Number.isSafeInteger(rec.revision) || rec.revision<0 || typeof rec.deleted!=='boolean') throw Error('紀錄版本不符');
    validateValue(rec.value);
  }
  for(const [id,op] of Object.entries(state.outbox)) {
    if(!state.records[id] || op.id!==id || typeof op.opId!=='string' || !/^[0-9a-f-]{36}$/i.test(op.opId) || !Number.isSafeInteger(op.baseRevision) || op.baseRevision<0 || typeof op.deleted!=='boolean') throw Error('待同步紀錄不符');
    validateValue(op.value);
  }
  for(const [id,c] of Object.entries(state.conflicts)) {
    if(!state.records[id] || !c || !c.remote || !Number.isSafeInteger(c.remote.revision) || c.remote.revision<1 || typeof c.remote.deleted!=='boolean') throw Error('衝突紀錄不符');
    validateValue(c.remote.value);
  }
  return state;
}
export class MemoryStore {
  constructor(seed=emptyState()) { this.state=clone(seed); }
  async read() { return clone(this.state); }
  async update(fn) { const next=clone(this.state); const result=fn(next); this.state=next; return result; }
}
export class SyncEngine {
  constructor(store, {uuid=()=>crypto.randomUUID()}={}) { this.store=store; this.uuid=uuid; this.running=null; }
  async save(id,value,deleted=false) {
    validateId(id); validateValue(value);
    return this.store.update(s=>this.queue(s,id,value,deleted));
  }
  queue(s,id,value,deleted=false) {
    validateId(id); validateValue(value);
    const old=s.records[id] || {revision:0};
    s.records[id]={value:clone(value),deleted,revision:old.revision};
    if(!s.conflicts[id]) s.outbox[id]={id,opId:this.uuid(),baseRevision:old.revision,value:clone(value),deleted};
  }
  async resolve(id,choice) {
    if(!['local','remote'].includes(choice)) throw Error('請選擇要繼續編輯的版本');
    return this.store.update(s=>{
      const c=s.conflicts[id]; if(!c) throw Error('衝突已處理，請重新整理');
      const local=clone(s.records[id]), remote=clone(c.remote);
      const archiveId='conflict/'+this.uuid();
      this.queue(s,archiveId+'/local',local.value,local.deleted);
      this.queue(s,archiveId+'/remote',remote.value,remote.deleted);
      this.queue(s,archiveId+'/meta',{id,local:{id:archiveId+'/local',revision:local.revision,deleted:local.deleted},remote:{id:archiveId+'/remote',revision:remote.revision,deleted:remote.deleted},resolvedAt:new Date().toISOString(),choice});
      delete s.conflicts[id]; delete s.outbox[id];
      s.records[id]=remote;
      const chosen=choice==='local'?local:remote;
      this.queue(s,id,chosen.value,chosen.deleted);
    });
  }
  sync(transport) {
    if(this.running) return this.running;
    this.running=this.exchange(transport).finally(()=>{this.running=null;});
    return this.running;
  }
  async exchange(transport) {
    const pending=Object.values((await this.store.read()).outbox);
    for(const op of pending) {
      // An immutable copy is sent; edits during the request get another operation ID.
      const result=await transport.push(clone(op));
      if(!result || !['ok','conflict'].includes(result.status)) throw Error('同步服務回應不符');
      const remote=result.record;
      if(!remote || !Number.isSafeInteger(remote.revision) || remote.revision<1 || typeof remote.deleted!=='boolean') throw Error('伺服器紀錄版本不符');
      validateValue(remote.value);
      await this.store.update(s=>{
        const current=s.outbox[op.id]; if(!current) return;
        if(result.status==='conflict') {
          s.conflicts[op.id]={remote:clone(remote)}; delete s.outbox[op.id];
        } else {
          s.records[op.id].revision=remote.revision;
          if(current.opId===op.opId) delete s.outbox[op.id];
          else current.baseRevision=remote.revision;
        }
      });
    }
    let more=true;
    while(more) {
      const before=await this.store.read();
      const page=await transport.pull(before.cursor);
      if(!page || !Array.isArray(page.changes) || page.changes.length>200) throw Error('同步清單格式不符');
      let last=before.cursor;
      for(const change of page.changes) {
        validateId(change.id); validateValue(change.value);
        if(!Number.isSafeInteger(change.sequence) || change.sequence<=last || !Number.isSafeInteger(change.revision) || change.revision<1 || typeof change.deleted!=='boolean') throw Error('同步游標格式不符');
        last=change.sequence;
      }
      if(typeof page.more!=='boolean' || page.more && !page.changes.length) throw Error('同步分頁格式不符');
      await this.store.update(s=>{
        for(const change of page.changes) {
          const remote={value:clone(change.value),revision:change.revision,deleted:change.deleted};
          const local=s.records[change.id];
          if(local && change.revision<=local.revision) continue;
          if(s.conflicts[change.id]) s.conflicts[change.id].remote=remote;
          else if(s.outbox[change.id]) {
            s.conflicts[change.id]={remote}; delete s.outbox[change.id];
          } else s.records[change.id]=remote;
        }
        s.cursor=last;
      });
      more=page.more;
    }
    return this.store.read();
  }
  async importRecords(records) {
    if(!records || Array.isArray(records) || typeof records!=='object') throw Error('匯入紀錄不符');
    const entries=Object.entries(records);
    if(entries.length>10000) throw Error('匯入筆數過多');
    for(const [id,rec] of entries) { validateId(id); if(!rec || typeof rec.deleted!=='boolean') throw Error('匯入紀錄不符'); validateValue(rec.value); }
    await this.store.update(s=>{
      for(const [id,rec] of entries) {
        const old=s.records[id];
        if(old && same(old.value,rec.value) && old.deleted===rec.deleted) continue;
        // An import is a local edit, never a trusted remote revision or cursor.
        if(old) {
          const copyId='import/'+this.uuid();
          this.queue(s,copyId,{originalId:id,record:clone(rec),importedAt:new Date().toISOString()});
        } else this.queue(s,id,rec.value,rec.deleted);
      }
    });
  }
}

/* Local-only mode: keep persistence and import/version safeguards, without
   generating a cloud outbox or accepting network transports. */
export class LocalRecords extends SyncEngine {
  queue(state,id,value,deleted=false) {
    super.queue(state,id,value,deleted);
    delete state.outbox[id];
  }
  sync() { return Promise.reject(Error('跨裝置同步目前暫停，此版本僅在本機保存')); }
}
