/* Verified monthly question archive (legacy v1 compatible). */
(function(root){
'use strict';
const MAX=900000;
const validMonth=/^20\d{2}-(?:0[1-9]|1[0-2])$/;
const validShard=/^question-shards\/([a-f0-9]{64})\.json$/;
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
const rr=(x,n)=>x>>>n|x<<(32-n);
function fallbackSha256(buffer){
 const d=Array.from(buffer),len=d.length*8;d.push(128);while(d.length%64!==56)d.push(0);
 for(let j=7;j>=0;j--)d.push(Math.floor(len/2**(j*8))&255);
 let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 for(let off=0;off<d.length;off+=64){
  const w=new Array(64);
  for(let i=0;i<16;i++){const p=off+4*i;w[i]=(d[p]<<24|d[p+1]<<16|d[p+2]<<8|d[p+3])>>>0;}
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=((rr(b,17)^rr(b,19)^b>>>10)+w[i-7]+(rr(a,7)^rr(a,18)^a>>>3)+w[i-16])>>>0;}
  let [a,b,c,d0,e,f,g,h]=H;
  for(let i=0;i<64;i++){
   const t1=(h+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
   const t2=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   h=g;g=f;f=e;e=(d0+t1)>>>0;d0=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  H=H.map((x,i)=>(x+[a,b,c,d0,e,f,g,h][i])>>>0);
 }
 return H.map(x=>x.toString(16).padStart(8,'0')).join('');
}
async function digest(raw){
 const bytes=new TextEncoder().encode(raw);
 if(bytes.length>MAX)throw Error('題庫分檔超過 900KB');
 if(root.crypto&&root.crypto.subtle){
  const result=await root.crypto.subtle.digest('SHA-256',bytes);
  return hex(new Uint8Array(result));
 }
 return fallbackSha256(bytes); // file:// browsers may not expose SubtleCrypto
}
function validate(index){
 if(!index||index.schemaVersion!==2||!Number.isSafeInteger(index.count)||index.count<1||
   !Array.isArray(index.months)||!index.months.length||!Array.isArray(index.catalog)||
   index.catalog.length!==index.count||!validMonth.test(index.activeMonth))
  throw Error('題庫月份索引格式不符');
 const months=new Set(),ids=new Set();let total=0;
 for(const m of index.months){
  if(!m||!validMonth.test(m.month)||months.has(m.month)||!Number.isSafeInteger(m.count)||m.count<1||
     !Array.isArray(m.shards)||!m.shards.length)throw Error('題庫月份或筆數不符');
  months.add(m.month);total+=m.count;
  for(const part of m.shards){
   if(!part||!validShard.test(part.path)||!Number.isSafeInteger(part.count)||part.count<1||
      !Number.isSafeInteger(part.bytes)||part.bytes<=0||part.bytes>MAX)
    throw Error('題庫分檔索引不符');
  }
 }
 if(total!==index.count||!months.has(index.activeMonth))throw Error('題庫月份總數不符');
 const count=new Map();
 for(const entry of index.catalog){
  if(!entry||typeof entry.id!=='string'||!entry.id||ids.has(entry.id)||
     !months.has(entry.month)||typeof entry.date!=='string'||entry.date.slice(0,7)!==entry.month||
     typeof entry.title!=='string'||typeof entry.subject!=='string')
    throw Error('題庫目錄重複或不符');
  ids.add(entry.id);count.set(entry.month,(count.get(entry.month)||0)+1);
 }
 for(const m of index.months)if(count.get(m.month)!==m.count)throw Error('題庫月份目錄數量不符');
 return index;
}
async function fetchJson(fetcher,path){
 const r=await fetcher('./'+path);
 if(!r.ok){const e=new Error('HTTP '+r.status+'：'+path);e.httpStatus=r.status;throw e;}
 return r;
}
async function readMonth(fetcher,index,month,globalIds){
 const m=index.months.find(m=>m.month===month);
 if(!m)throw Error('不存在的題庫月份：'+month);
 const qs=[];
 for(const part of m.shards){
  const res=await fetchJson(fetcher,part.path),raw=await res.text();
  if(new TextEncoder().encode(raw).length!==part.bytes||
     await digest(raw)!==part.path.match(validShard)[1])throw Error('題庫分檔校驗失敗');
  const file=JSON.parse(raw);
  if(file.schemaVersion!==1||!Array.isArray(file.questions)||file.questions.length!==part.count)
    throw Error('題庫分檔筆數不符');
  for(const q of file.questions){
   if(!q||typeof q.id!=='string'||!q.id||q.date.slice(0,7)!==month||globalIds.has(q.id))
    throw Error('歷史題號重複或月份錯誤');
   globalIds.add(q.id);qs.push(q);
  }
 }
 if(qs.length!==m.count)throw Error('題庫月份題數不符');
 const expected=new Set(index.catalog.filter(x=>x.month===month).map(x=>x.id));
 for(const q of qs)if(!expected.delete(q.id))throw Error('月份題庫與目錄不符');
 if(expected.size)throw Error('月份題庫有缺漏');
 return qs;
}
async function load(fetcher,options={}){
 let response;
 try{response=await fetchJson(fetcher,'questions-monthly.json');}
 catch(e){
  if(e.httpStatus!==404)throw e;
  const legacy=await (await fetchJson(fetcher,'questions.json')).json();
  return legacy;
 }
 const index=validate(await response.json()),ids=new Set(),questions=[];
 const months=options.month?[options.month]:index.months.map(m=>m.month);
 for(const month of months)questions.push(...await readMonth(fetcher,index,month,ids));
 if(!options.month&&questions.length!==index.count)throw Error('歷史題庫未完整載入');
 return {schemaVersion:1,updatedAt:index.updatedAt,count:questions.length,questions,
  templates:index.templates||[],diagnostics:index.diagnostics||[],monthlyIndex:index};
}
root.QuestionStorage={load,validate,fallbackSha256};
})(typeof window==='undefined'?globalThis:window);
