/* Local record deletion must never be mistaken for approval to restore old
 * Firestore copies. The guard holds only a random token/time, never answers.
 * It is deliberately outside the 15 allowlisted backup/sync data keys.
 */
(function(root){
 'use strict';
 const KEY='psd-firebase-local-clear-guard-v1';
 let serial=0;
 function read(storage){
  const raw=storage.getItem(KEY);
  if(raw===null)return null;
  let value;
  try{value=JSON.parse(raw)}catch{throw Error('本機清除紀錄的安全標記無法讀取；已停止雲端同步');}
  if(!value||value.schema!==1||typeof value.at!=='string'||typeof value.token!=='string'||!value.token)
   throw Error('本機清除紀錄的安全標記格式不符；已停止雲端同步');
  return raw;
 }
 function mark(storage){
  // Do this BEFORE destructive local clearing. If persistence is blocked,
  // the caller must not proceed with clearing any original study records.
  const token=typeof root.crypto?.randomUUID==='function'
   ?root.crypto.randomUUID():String(Date.now())+'-'+(++serial);
  const raw=JSON.stringify({schema:1,at:new Date().toISOString(),token});
  storage.setItem(KEY,raw);
  if(storage.getItem(KEY)!==raw)throw Error('無法保存本機清除紀錄的雲端恢復警示，已停止清除');
  return raw;
 }
 function acknowledge(storage,expected){
  if(!expected)return false;
  if(read(storage)!==expected)throw Error('清除紀錄的安全標記在同步期間已變更，請重新預覽');
  storage.removeItem(KEY);
  if(storage.getItem(KEY)!==null)throw Error('無法更新清除紀錄的雲端恢復警示，請重新檢查');
  return true;
 }
 root.PSDLocalClearGuard=Object.freeze({KEY,read,mark,acknowledge});
})(typeof window!=='undefined'?window:globalThis);
