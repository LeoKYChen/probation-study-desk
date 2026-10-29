/* Site-wide learning storage. Nothing switches to this store until explicitly integrated. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PSDLearningStorage = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const DB_NAME = 'psd-learning-storage-v1', VERSION = 1;
  function open(indexedDBImpl = globalThis.indexedDB) {
    if (!indexedDBImpl) return Promise.reject(Error('IndexedDB 不可用，原有資料未變更'));
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDBImpl.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records');
        if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata');
      };
      request.onerror = () => reject(request.error || Error('無法開啟 IndexedDB'));
      request.onblocked = () => { blocked = true; reject(Error('資料庫被其他分頁封鎖，請關閉其他分頁後重試')); };
      request.onsuccess = () => { const db = request.result; if (blocked) { db.close(); return; } db.onversionchange = () => db.close(); resolve(new Store(db)); };
    });
  }
  class Store {
    constructor(db) { this.db = db; }
    close() { this.db.close(); }
    get(key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('records', 'readonly');
        const request = tx.objectStore('records').get(key);
        let value;
        request.onsuccess = () => { value = request.result === undefined ? null : request.result; };
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(tx.error || Error('讀取失敗'));
        tx.onerror = () => {};
      });
    }
    // Capture all requested keys in one read transaction, including absence.
    snapshot(keys) {
      if (!Array.isArray(keys) || new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string' || !k)) return Promise.reject(Error('讀取鍵清單不正確'));
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('records', 'readonly'), store = tx.objectStore('records');
        const result = Object.create(null);
        for (const key of keys) {
          const request = store.get(key);
          request.onsuccess = () => { if (request.result !== undefined) result[key] = request.result; };
        }
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || Error('讀取失敗'));
        tx.onerror = () => {};
      });
    }
    // Check the complete baseline and write all changes in a single transaction.
    compareAndSetMany(keys, baseline, changes) {
      const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
      if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string' || !k) || !baseline || !changes || typeof baseline !== 'object' || typeof changes !== 'object') return Promise.reject(Error('資料格式不正確'));
      const allowed = new Set(keys);
      if (Object.keys(baseline).some(k => !allowed.has(k) || typeof baseline[k] !== 'string') || Object.keys(changes).some(k => !allowed.has(k) || (changes[k] !== null && typeof changes[k] !== 'string'))) return Promise.reject(Error('資料格式不正確'));
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('records','readwrite'), store = tx.objectStore('records');
        let remaining = keys.length, failure;
        for (const key of keys) {
          const request = store.get(key);
          request.onsuccess = () => {
            const current = request.result === undefined ? null : request.result;
            const expected = own(baseline,key) ? baseline[key] : null;
            if (current !== expected) { failure = Error('其他分頁已有更新，請重新檢查'); tx.abort(); return; }
            if (--remaining === 0) {
              for (const [k,value] of Object.entries(changes)) {
                if (value === null) store.delete(k); else store.put(value,k);
              }
            }
          };
        }
        tx.oncomplete = () => resolve(Object.keys(changes).length);
        tx.onabort = () => reject(failure || tx.error || Error('交易失敗，資料未變更'));
        tx.onerror = () => {};
      });
    }
    // Atomic compare-and-swap prevents a stale tab overwriting a committed edit.
    compareAndSet(key, expected, value) {
      if (typeof key !== 'string' || !key || (value !== null && typeof value !== 'string')) return Promise.reject(Error('資料格式不正確'));
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('records', 'readwrite'), store = tx.objectStore('records');
        let failure;
        const request = store.get(key);
        request.onsuccess = () => {
          const current = request.result === undefined ? null : request.result;
          if (current !== expected) { failure = Error('其他分頁已有更新，請重新整理'); tx.abort(); return; }
          if (value === null) store.delete(key); else store.put(value, key);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(failure || tx.error || Error('儲存失敗，原有資料未變更'));
        tx.onerror = () => {};
      });
    }
    // Copies validated raw strings in one transaction. Legacy values are never deleted.
    migrate(legacy, keys, validate = () => {}) {
      if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string' || !k)) return Promise.reject(Error('遷移鍵清單不正確'));
      let snapshot;
      try {
        snapshot = keys.map(key => [key, legacy.getItem(key)]);
        for (const [key, raw] of snapshot) if (raw !== null) validate(key, raw);
      } catch (e) { return Promise.reject(e); }
      const marker = 'legacy:' + JSON.stringify(keys.slice().sort());
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['records', 'metadata'], 'readwrite');
        const records = tx.objectStore('records'), metadata = tx.objectStore('metadata');
        let failure, migrated = false;
        const mark = metadata.get(marker);
        mark.onsuccess = () => {
          if (mark.result) {
            if (!Array.isArray(mark.result.legacySnapshot) || mark.result.legacySnapshot.some(([key,raw]) => legacy.getItem(key) !== raw)) { failure = Error('舊版頁面已修改原資料，請先保留並處理不同版本'); tx.abort(); }
            return;
          }
          try {
            for (const [key, raw] of snapshot) if (legacy.getItem(key) !== raw) throw Error('舊資料在遷移期間變更，請重試');
            // Refuse to overwrite a pre-existing record if migration metadata is missing.
            let remaining = snapshot.length;
            for (const [key, raw] of snapshot) {
              const request = records.get(key);
              request.onsuccess = () => {
                if (request.result !== undefined) { failure = Error('IndexedDB 已有資料，停止遷移以避免覆寫'); tx.abort(); return; }
                if (raw !== null) records.put(raw, key);
                if (--remaining === 0) {
                  // Read every inserted value back before the marker is committed.
                  let pending = snapshot.length;
                  for (const [k, expected] of snapshot) {
                    const verify = records.get(k);
                    verify.onsuccess = () => {
                      const actual = verify.result === undefined ? null : verify.result;
                      if (actual !== expected) { failure = Error('遷移校驗失敗'); tx.abort(); return; }
                      if (--pending === 0) {
                        try {
                          for (const [oldKey, oldRaw] of snapshot) if (legacy.getItem(oldKey) !== oldRaw) throw Error('舊資料在遷移期間變更，請重試');
                          metadata.put({ completedAt: new Date().toISOString(), keys: keys.slice(), legacySnapshot: snapshot }, marker);
                          migrated = true;
                        } catch (e) { failure = e; tx.abort(); }
                      }
                    };
                  }
                }
              };
            }
          } catch (e) { failure = e; tx.abort(); }
        };
        tx.oncomplete = () => resolve({ migrated });
        tx.onabort = () => reject(failure || tx.error || Error('遷移失敗，原有資料未變更'));
        tx.onerror = () => {};
      });
    }
  }
  return { open, DB_NAME };
});
