/* Verified news shards; supports legacy archives and lazy monthly indexes. */
(function(root){
'use strict';
const shardPath=/^news-shards\/[a-f0-9]{64}\.json$/;
const monthPath=/^archives\/(20\d{2}-(?:0[1-9]|1[0-2]))\/index\.json$/;
const monthKey=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
async function request(fetcher,path){
 const response=await fetcher('./'+path);
 if(!response.ok)throw Error('閱讀檔案 HTTP '+response.status+'：'+path);
 return response;
}
async function verifiedShards(fetcher,parts,count){
 if(!Array.isArray(parts)||!parts.length||!Number.isSafeInteger(count)||count<1)throw Error('新聞分檔索引格式不符');
 const seenPath=new Set(),seenId=new Set(),documents=[];
 for(const part of parts){
  if(!part||!shardPath.test(part.path)||seenPath.has(part.path)||!Number.isSafeInteger(part.count)||part.count<1)throw Error('新聞分檔索引不符');
  seenPath.add(part.path);
  const raw=await (await request(fetcher,part.path)).text();
  if(!globalThis.crypto?.subtle)throw Error('無法驗證新聞分檔');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(part.path!=='news-shards/'+hex+'.json')throw Error('新聞分檔校驗失敗');
  const shard=JSON.parse(raw);
  if(shard.schemaVersion!==1||!Array.isArray(shard.documents)||shard.documents.length!==part.count)throw Error('新聞分檔格式不符');
  for(const d of shard.documents){
   if(!d||typeof d.id!=='string'||!d.id||seenId.has(d.id))throw Error('新聞識別碼重複或缺失');
   seenId.add(d.id);documents.push(d);
  }
 }
 if(documents.length!==count)throw Error('新聞筆數不符');
 return documents;
}
function validateIndex(index){
 if(!index||index.schemaVersion!==3||!Array.isArray(index.months)||!index.months.length||
   !Number.isSafeInteger(index.count)||index.count<1||!Array.isArray(index.catalog)||index.catalog.length!==index.count)
   throw Error('月份總索引格式不符');
 const months=new Set(),paths=new Set(),ids=new Set();let total=0;
 for(const m of index.months){
  if(!m||!monthKey.test(m.month)||!monthPath.test(m.index)||m.index!=='archives/'+m.month+'/index.json'||
     months.has(m.month)||paths.has(m.index)||!Number.isSafeInteger(m.count)||m.count<1)
   throw Error('月份索引路徑或數量不符');
  months.add(m.month);paths.add(m.index);total+=m.count;
 }
 if(total!==index.count)throw Error('月份總筆數不符');
 if(!months.has(index.activeMonth))throw Error('目前月份未建立索引');
 const counts=new Map();
 for(const entry of index.catalog){
  if(!entry||typeof entry.id!=='string'||!entry.id||ids.has(entry.id)||!months.has(entry.month)||
     typeof entry.title!=='string'||typeof entry.date!=='string'||!entry.date.startsWith(entry.month)||
     !Array.isArray(entry.tags))
   throw Error('新聞目錄格式不符');
  ids.add(entry.id);counts.set(entry.month,(counts.get(entry.month)||0)+1);
 }
 for(const month of index.months){if(counts.get(month.month)!==month.count)throw Error('月份目錄筆數不符');}
 return index;
}
async function loadMonth(fetcher,index,month){
 if(!index||index.schemaVersion!==3)throw Error('尚未建立月份封存');
 validateIndex(index);
 const entry=index.months.find(m=>m.month===month);
 if(!entry)throw Error('找不到指定月份：'+month);
 const group=await (await request(fetcher,entry.index)).json();
 if(!group||group.schemaVersion!==1||group.month!==entry.month||group.count!==entry.count)
  throw Error('月份檔案索引不符');
 const documents=await verifiedShards(fetcher,group.shards,entry.count);
 if(!documents.every(d=>typeof d.date==='string'&&d.date.startsWith(month)))throw Error('月份資料日期不符');
 const expected=new Set(index.catalog.filter(d=>d.month===month).map(d=>d.id));
 if(documents.some(d=>!expected.delete(d.id))||expected.size)throw Error('月份目錄與全文不符');
 return {schemaVersion:1,documents,sync:index.sync,month,index,totalCount:index.count,months:index.months,catalog:index.catalog};
}
async function load(fetcher,options={}){
 const index=await (await request(fetcher,'documents.json')).json();
 if(index.schemaVersion===1&&Array.isArray(index.documents))return index;
 if(index.schemaVersion===2){
  const documents=await verifiedShards(fetcher,index.shards,index.count);
  return {schemaVersion:1,documents,sync:index.sync};
 }
 validateIndex(index);
 const selected=index.months.some(m=>m.month===options.month)?options.month:index.activeMonth;
 return loadMonth(fetcher,index,selected);
}
root.NewsStorage={load,loadMonth,validateIndex};
})(typeof window==='undefined'?globalThis:window);
