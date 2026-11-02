/* Versioned news archives. A failed shard never replaces the current view. */
(function(root){
'use strict';
const safe=/^news-shards\/[a-f0-9]{64}\.json$/;
async function load(fetcher){
 const response=await fetcher('./documents.json');
 if(!response.ok)throw Error('新聞索引 HTTP '+response.status);
 const index=await response.json();
 if(index.schemaVersion===1&&Array.isArray(index.documents))return index;
 if(index.schemaVersion!==2||!Array.isArray(index.shards)||!index.shards.length||!Number.isSafeInteger(index.count))throw Error('新聞索引格式不符');
 const seenPath=new Set(),seenId=new Set(),documents=[];
 for(const part of index.shards){
  if(!part||!safe.test(part.path)||seenPath.has(part.path)||!Number.isSafeInteger(part.count))throw Error('新聞分檔索引不符');
  seenPath.add(part.path);const res=await fetcher('./'+part.path);if(!res.ok)throw Error('新聞分檔讀取失敗');
  const raw=await res.text();if(!globalThis.crypto?.subtle)throw Error('無法驗證新聞分檔');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(part.path!=='news-shards/'+hex+'.json')throw Error('新聞分檔校驗失敗');
  const shard=JSON.parse(raw);if(shard.schemaVersion!==1||!Array.isArray(shard.documents)||shard.documents.length!==part.count)throw Error('新聞分檔格式不符');
  for(const d of shard.documents){if(!d||typeof d.id!=='string'||seenId.has(d.id))throw Error('新聞識別碼重複或缺失');seenId.add(d.id);documents.push(d);}
 }
 if(documents.length!==index.count)throw Error('新聞筆數不符');return {schemaVersion:1,documents,sync:index.sync};
}
root.NewsStorage={load};
})(typeof window==='undefined'?globalThis:window);
