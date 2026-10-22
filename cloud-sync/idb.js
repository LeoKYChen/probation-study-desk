import {emptyState} from './core.js';
export class IDBStore {
  static async open(namespace) {
    if(typeof namespace!=='string' || !namespace) throw Error('缺少本機帳號範圍');
    const request=indexedDB.open('psd-study-desk-sync-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('accounts');
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('請關閉舊書桌分頁後重試'));});
    return new IDBStore(db,namespace);
  }
  constructor(db,namespace) { this.db=db; this.namespace=namespace; }
  close() { this.db.close(); }
  read() { return this.transaction('readonly',state=>structuredClone(state)); }
  update(fn) { return this.transaction('readwrite',fn); }
  transaction(mode,fn) {
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('accounts',mode), store=tx.objectStore('accounts');
      let result, failure;
      const read=store.get(this.namespace);
      read.onsuccess=()=>{
        try {
          const state=read.result || emptyState(); result=fn(state);
          if(result && typeof result.then==='function') throw Error('本機交易不可包含非同步操作');
          if(mode==='readwrite') store.put(state,this.namespace);
        } catch(e) {failure=e;tx.abort();}
      };
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(failure || tx.error || Error('本機儲存交易失敗，請先匯出文字'));
      tx.onerror=()=>{ failure ||= tx.error; };
    });
  }
}
