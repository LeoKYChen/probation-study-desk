'use strict';
const crypto=require('node:crypto');
function split(documents, maxBytes=1000000){
 if(!Array.isArray(documents)||!Number.isInteger(maxBytes)||maxBytes<100) throw Error('invalid input');
 const seen=new Set(),parts=[]; let current=[];
 function encode(items){return JSON.stringify({schemaVersion:1,documents:items});}
 function push(){if(!current.length)return; const body=encode(current); parts.push({name:'news-shards/'+crypto.createHash('sha256').update(body).digest('hex')+'.json',body});current=[];}
 for(const d of documents){
  if(!d||typeof d.id!=='string'||seen.has(d.id))throw Error('missing or duplicate ID');seen.add(d.id);
  if(Buffer.byteLength(encode([d]))>maxBytes)throw Error('single record exceeds shard limit');
  if(Buffer.byteLength(encode([...current,d]))>maxBytes)push();current.push(d);
 }
 push();return parts;
}
module.exports={split};
