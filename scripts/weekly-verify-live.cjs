#!/usr/bin/env node
/* Poll GitHub Pages until the committed canonical weekly JSON is actually served. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {setTimeout:wait}=require('node:timers/promises');
const expected=fs.readFileSync(path.resolve(__dirname,'../juvenile-news/issues.json'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=digest(expected);
const url=process.env.WEEKLY_PUBLIC_URL||'https://leokychen.github.io/probation-study-desk/juvenile-news/issues.json';
const tries=Number(process.env.WEEKLY_PUBLISH_ATTEMPTS||36);
async function verify(){
 let last='';
 for(let n=1;n<=tries;n++){
  try{
   const check=new URL(url);
   check.searchParams.set('_weekly_verify',process.env.GITHUB_SHA||String(Date.now()));
   const r=await fetch(check,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const remote=Buffer.from(await r.arrayBuffer());
   JSON.parse(remote.toString('utf8'));
   const found=digest(remote);
   if(found===hash){console.log('PASS GitHub Pages serves exact canonical weekly JSON: SHA256 '+hash+', bytes '+remote.length);return;}
   last='deployed hash '+found+' differs from current '+hash;
  }catch(e){last=e.message;}
  console.log('Waiting for GitHub Pages publication ('+n+'/'+tries+'): '+last);
  if(n<tries)await wait(10000);
 }
 throw Error('Weekly Pages publication unverified after '+tries+' attempts: '+last);
}
verify().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1;});
