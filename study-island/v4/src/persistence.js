// IndexedDB 存檔（probation-study-island-v4）。不讀寫 v1 小島或任何考古題資料。
// mutate() 在單一 readwrite 交易內「讀取最新存檔 → 套用動作 → 寫回」，
// IndexedDB 會將同一 store 的 readwrite 交易排隊，因此兩個分頁同時撿同一個貝殼只有一邊成功。
import { normalizeSave, applyAction, SCHEMA } from './state.js';

export const DB_NAME = SCHEMA;
const STORE = 'save';
const KEY = 'main';

function openDB(idb) {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

// 以 IndexedDB 為主；無法開啟時退回只存在本頁記憶體的版本，並以 persistent=false 告知介面。
export async function openStore({ idb = globalThis.indexedDB } = {}) {
  if (idb) {
    try {
      const db = await openDB(idb);
      return idbStore(db);
    } catch (e) {
      return memoryStore(e);
    }
  }
  return memoryStore(new Error('IndexedDB unavailable'));
}

function idbStore(db) {
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(DB_NAME) : null;
  const listeners = new Set();
  if (channel) channel.onmessage = () => listeners.forEach(fn => fn());
  return {
    persistent: true,
    load() {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(normalizeSave(req.result));
        tx.onerror = () => reject(tx.error);
      });
    },
    mutate(action, now = new Date()) {
      return new Promise((resolve, reject) => {
        let save, result;
        const tx = db.transaction(STORE, 'readwrite');
        const os = tx.objectStore(STORE);
        const req = os.get(KEY);
        req.onsuccess = () => {
          save = normalizeSave(req.result);
          result = applyAction(save, action, now);
          if (result.changed) os.put(save, KEY);
        };
        // 只有交易真正 commit 後才回報成功；失敗時介面不得假裝已入袋。
        tx.oncomplete = () => {
          if (result.changed && channel) channel.postMessage('changed');
          resolve({ save, result });
        };
        tx.onerror = () => reject(tx.error || new Error('transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
      });
    },
    onExternalChange(fn) { listeners.add(fn); }
  };
}

function memoryStore(error) {
  let save = normalizeSave(null);
  return {
    persistent: false,
    error,
    async load() { return structuredClone(save); },
    async mutate(action, now = new Date()) {
      const next = structuredClone(save);
      const result = applyAction(next, action, now);
      save = next;
      return { save: structuredClone(save), result };
    },
    onExternalChange() {}
  };
}
