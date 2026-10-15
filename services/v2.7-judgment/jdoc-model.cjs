"use strict";
/**
 * v2.7.1b private-only JDoc normalization. Based on Judicial Yuan API spec
 * 114.08.22: https://opendata.judicial.gov.tw/api/Newses/42/file
 * JFULLX IS AN OBJECT, not a string.
 * No real court documents, data store, fetch, logging or public deployment here.
 */
const REMOVED=/查無資料[\s\S]*(未公開|移除|不再公開)/;
const PURGE_TARGETS=Object.freeze([
  "documentBody","primaryRecord","publicSearchIndex","summaries",
  "embeddings","edgeCache","snapshots","backupCopies"
]);
const FILE_HOST="data.judicial.gov.tw";
function safeJid(value) {
  if(typeof value!=="string"||value.trim()!==value||value.length<3||
     value.length>220||/[\x00-\x1f<>]/.test(value))
    throw Error("Invalid JID format");
  return value;
}
function safeJudicialFileUrl(value){
  if(typeof value!=="string"||!value)return null;
  let url;
  try{url=new URL(value)}catch{throw Error("Invalid judicial file URL")}
  if(url.protocol!=="https:"||url.hostname!==FILE_HOST||url.username||url.password||
     !url.pathname.startsWith("/jdg/api/J")||url.port)
    throw Error("Unexpected judicial file URL");
  return url.href;
}
function normaliseFullText(response){
  const full=response.JFULLX;
  if(!full||typeof full!=="object"||Array.isArray(full))
    throw Error("Missing JFULLX object");
  const kind=full.JFULLTYPE;
  if(kind!=="text"&&kind!=="file")throw Error("Unsupported JFULLTYPE");
  const body=typeof full.JFULLCONTENT==="string"?full.JFULLCONTENT.trim():null;
  const pdf=full.JFULLPDF? safeJudicialFileUrl(full.JFULLPDF) : null;
  if(kind==="text"&&(!body||pdf))
    throw Error("Invalid text type: full text required, pdf link must be empty");
  if(kind==="file"&&!pdf)
    throw Error("Invalid file type: official PDF URL required");
  return {
    fullTextType:kind==="text"?"plain-text":"file",
    fullText:kind==="text"?body:null,
    // JFULLCONTENT may contain a preview even in file mode. Not complete text.
    preview:kind==="file"?body:null,
    pdfUrl:kind==="file"?pdf:null,
    fullTextComplete:kind==="text"
  };
}
function planJDocAction(requestedJid, response){
  const jid=safeJid(requestedJid);
  if(!response||typeof response!=="object"||Array.isArray(response))
    throw Error("Invalid JDoc response");
  if(Object.hasOwn(response,"error")){
    if(typeof response.error==="string"&&REMOVED.test(response.error))
      return {kind:"withdraw",jid,publishable:false,privacyCritical:true,purgeTargets:[...PURGE_TARGETS]};
    throw Error("Judicial API returned an error; no data mutation allowed");
  }
  if(typeof response.JID!=="string"||response.JID!==jid)
    throw Error("Mismatched JID");
  for(const key of ["JYEAR","JCASE","JNO","JDATE","JTITLE"]){
    if(!["string","number"].includes(typeof response[key])||
       !String(response[key]).trim())
      throw Error("Incomplete JDoc metadata: "+key);
  }
  if(!/^\d{8}$/.test(String(response.JDATE)))
    throw Error("Unexpected JDATE format");
  const text=normaliseFullText(response);
  const attachments=response.ATTACHMENTS??[];
  if(!Array.isArray(attachments)||attachments.length>100)
    throw Error("Invalid ATTACHMENTS list");
  const safeAttachments=attachments.map(a=>{
    if(!a||typeof a.TITLE!=="string"||a.TITLE.length>250)
      throw Error("Invalid attachment metadata");
    return {title:a.TITLE,url:safeJudicialFileUrl(a.URL)};
  });
  return {
    kind:"upsert",jid,publishable:false,privacyCritical:true,
    record:{
      jid,year:String(response.JYEAR),caseType:String(response.JCASE),
      caseNo:String(response.JNO),judgmentDate:String(response.JDATE),
      title:String(response.JTITLE),...text,attachments:safeAttachments,
      publicationStatus:"not-yet-rechecked"
    }
  };
}
/** For unit tests ONLY. Real storage must support complete purging. */
function reduceSnapshot(snapshot,planned){
  if(!(snapshot instanceof Map))throw Error("Expected in-memory test Map");
  const next=new Map(snapshot);
  if(planned.kind==="withdraw")next.delete(planned.jid);
  else if(planned.kind==="upsert")next.set(planned.jid,planned.record);
  else throw Error("Unknown judgment mutation");
  return next;
}
module.exports={planJDocAction,reduceSnapshot,safeJid,safeJudicialFileUrl,PURGE_TARGETS};
