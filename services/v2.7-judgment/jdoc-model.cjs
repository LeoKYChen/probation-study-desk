"use strict";
/**
 * v2.7.1b judicial API *data-model only*. No network requests or credentials.
 * Never publish JDoc results into static Git or Pages assets.
 * Official API reference: https://opendata.judicial.gov.tw/api/Newses/42/file
 */
const WITHDRAWN=/查無資料[\s\S]*(未公開|移除)/;
function planJDocAction(requestedJid, response) {
  const jid=String(requestedJid||"").trim();
  if(!jid||jid.length>220||/[\r\n<>]/.test(jid))throw Error("Invalid jid input");
  if(!response||typeof response!=="object"||Array.isArray(response))throw Error("Invalid JDoc response");
  if(typeof response.error==="string") {
    if(WITHDRAWN.test(response.error))return {
      kind:"withdraw",jid,privacyCritical:true,
      purgeTargets:["documentBody","publicSearchIndex","summaries","embeddings","edgeCache","snapshots","backupCopies"],
      publishable:false
    };
    throw Error("Upstream JDoc error; preserve no new content and alert operator");
  }
  if(typeof response.JID!=="string"||response.JID!==jid)throw Error("Mismatched JID");
  const fields=["JYEAR","JCASE","JNO","JDATE","JTITLE"];
  if(fields.some(k=>typeof response[k]!=="string"&&typeof response[k]!=="number"))
    throw Error("Incomplete JDoc metadata");
  const fullText=typeof response.JFULLX==="string"?response.JFULLX.trim():"";
  const fullTextAvailable=fullText.length>0;
  return {
    kind:"upsert",jid,privacyCritical:true,publishable:false,
    record:{
      jid,year:String(response.JYEAR),caseType:String(response.JCASE),
      caseNo:String(response.JNO),judgmentDate:String(response.JDATE),
      title:String(response.JTITLE),fullTextType:fullTextAvailable?"plain-text":"not-available",
      // Never write this private transport object into a public repository.
      fullText:fullTextAvailable?fullText:null
    }
  };
}
/**
 * Deterministic in-memory test reducer; production adapters MUST additionally
 * delete primary storage, search index, vectors, caches and all derived copies.
 */
function reduceSnapshot(snapshot, planned) {
  const next=new Map(snapshot);
  if(planned.kind==="withdraw") {
    next.delete(planned.jid);
  } else if(planned.kind==="upsert") {
    next.set(planned.jid,planned.record);
  } else throw Error("Unknown judgment mutation");
  return next;
}
module.exports={planJDocAction,reduceSnapshot};