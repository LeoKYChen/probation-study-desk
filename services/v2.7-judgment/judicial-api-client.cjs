"use strict";
/**
 * Judicial Yuan 114.08.22 API request contract.
 * Safe for import/test: does NOT make HTTP requests on import.
 * Real HTTP is explicitly locked until reviewed with user authorisation.
 */
const {planJDocAction,safeJid}=require("./jdoc-model.cjs");
const ENDPOINTS=Object.freeze({
  Auth:"https://data.judicial.gov.tw/jdg/api/Auth",
  JList:"https://data.judicial.gov.tw/jdg/api/JList",
  JDoc:"https://data.judicial.gov.tw/jdg/api/JDoc"
});
const MAX_JSON_BYTES=12*1024*1024;
function taipeiHour(date){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw Error("Invalid time");
  return Number(new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Taipei",hour:"2-digit",hourCycle:"h23"
  }).format(date));
}
function withinOfficialHours(date){const hour=taipeiHour(date);return hour>=0&&hour<6}
function assertApiErrorFree(value){
  if(value&&typeof value==="object"&&Object.hasOwn(value,"error"))
    throw Error("Judicial API rejected request or credentials");
  return value;
}
function parseListPayload(raw){
  const arr=assertApiErrorFree(raw);
  if(!Array.isArray(arr))throw Error("Unexpected JList shape");
  const out=[];const seen=new Set();
  for(const item of arr){
    if(!item||typeof item.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||
       !Array.isArray(item.list))throw Error("Invalid JList entry");
    for(const jid of item.list){
      const safe=safeJid(jid);
      if(!seen.has(safe)){seen.add(safe);out.push({date:item.date,jid:safe})}
    }
  }
  return out;
}
function makeClient({transport,user,password,now=()=>new Date()}){
  if(typeof transport!=="function")throw Error("Requires injected transport");
  if(typeof now!=="function")throw Error("Invalid clock");
  if(typeof user!=="string"||!user||typeof password!=="string"||!password)
    throw Error("Credentials missing; no judicial API call attempted");
  let token=null,issuedAt=0;
  async function call(action,body){
    if(!Object.hasOwn(ENDPOINTS,action))throw Error("Unsupported action");
    if(!withinOfficialHours(now()))throw Error("Outside Judicial Yuan API service window (00:00–06:00 Taiwan)");
    return await transport({url:ENDPOINTS[action],body});
  }
  async function auth(){
    const current=now().getTime();
    // Conservative refresh ahead of six-hour expiry. Never expose token publicly.
    if(token&&current-issuedAt>=0&&current-issuedAt<5.5*3600*1000)return token;
    const data=assertApiErrorFree(await call("Auth",{user,password}));
    if(!data||typeof data.Token!=="string"||data.Token.length<8)
      throw Error("Judicial API authentication did not return Token");
    token=data.Token;issuedAt=current;
    return token;
  }
  async function getChanges(){
    const t=await auth();
    return parseListPayload(await call("JList",{token:t}));
  }
  async function getJudgment(jid){
    const safe=safeJid(jid),t=await auth();
    const raw=await call("JDoc",{token:t,j:safe});
    return planJDocAction(safe,raw);
  }
  return Object.freeze({getChanges,getJudgment});
}
function makeHttpTransport({enabled=false,fetchImpl=globalThis.fetch}={}){
  // Double gate. GitHub CI / Cloudflare Pages do NOT set this env.
  if(enabled!==true||process.env.JUDICIAL_API_LIVE_ENABLED!=="true")
    throw Error("Live judicial API is disabled pending explicit authorization");
  if(typeof fetchImpl!=="function")throw Error("No HTTP implementation");
  return async function ({url,body}){
    if(!Object.values(ENDPOINTS).includes(url))throw Error("Non-whitelisted URL");
    const response=await fetchImpl(url,{
      method:"POST",redirect:"error",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(20000)
    });
    if(!response.ok)throw Error("Judicial API request failed (HTTP status "+response.status+")");
    const bytes=Number(response.headers?.get?.("content-length")||0);
    if(bytes>MAX_JSON_BYTES)throw Error("Oversized API response");
    const raw=await response.text();
    if(Buffer.byteLength(raw,"utf8")>MAX_JSON_BYTES)throw Error("Oversized API response");
    try{return JSON.parse(raw)}catch{throw Error("Malformed Judicial API JSON")}
  };
}
module.exports={ENDPOINTS,taipeiHour,withinOfficialHours,parseListPayload,makeClient,makeHttpTransport};
