"use strict";
/** D1 metadata adapter: synthetic-only, no real courts, no full text.
 * D1 DELETE does NOT erase Time Travel history/backups. */
const {safeJid}=require("./jdoc-model.cjs");
const REQUIRED_PURGE=["primaryRecord","documentBody","publicSearchIndex","summaries","embeddings","edgeCache","snapshots","backupCopies"];
const LIVE_TABLES=["judgment_metadata","judgment_search_tokens","judgment_summaries","judgment_vectors"];
function jidFixture(jid){
  const id=safeJid(jid);
  if(!id.startsWith("TEST_JID_SYNTHETIC_"))
    throw Error("Storage accepts synthetic JIDs only; live ingestion forbidden");
  return id;
}
function makeD1MetadataAdapter(db,{clock=()=>new Date()}={}){
  if(typeof db?.prepare!=="function"||typeof db?.batch!=="function")
    throw Error("Requires D1 prepared statements and atomic batch");
  if(typeof clock!=="function")throw Error("Requires a clock");
  const iso=()=>clock().toISOString();
  const stmt=(sql,...params)=>db.prepare(sql).bind(...params);
  const access=async jid=>stmt("SELECT state FROM judgment_access WHERE jid=?",jid).first();
  async function blockPublicAccess(rawJid){
    const jid=jidFixture(rawJid);
    await stmt("INSERT INTO judgment_access(jid,state,changed_at) VALUES(?,'blocked',?) ON CONFLICT(jid) DO NOTHING",jid,iso()).run();
  }
  async function putPrivate(record){
    if(!record||typeof record!=="object")throw Error("Missing private metadata");
    const jid=jidFixture(record.jid);
    if(record.fullText!=null||record.preview!=null||record.pdfUrl!=null||
       (Array.isArray(record.attachments)&&record.attachments.length>0))
      throw Error("Full text, preview, attachments and PDF links forbidden in D1 metadata pilot");
    for(const name of ["year","caseType","caseNo","judgmentDate","title"]){
      if(typeof record[name]!=="string"||!record[name]||record[name].length>180)
        throw Error("Invalid synthetic metadata: "+name);
    }
    if(!record.title.includes("合成")&&!record.title.includes("TEST"))
      throw Error("Synthetic fixture title required");
    if(!Number.isSafeInteger(record.revision)||record.revision<1)
      throw Error("Missing positive revision");
    const state=await access(jid);
    if(state?.state!=="blocked")throw Error("Not blocked or previously revoked");
    const time=iso();
    const sql=[
      "INSERT INTO judgment_metadata",
      "(jid,case_year,case_type,case_no,judgment_date,title,revision,created_at,updated_at)",
      "VALUES(?,?,?,?,?,?,?,?,?)",
      "ON CONFLICT(jid) DO UPDATE SET",
      "case_year=excluded.case_year,case_type=excluded.case_type,",
      "case_no=excluded.case_no,judgment_date=excluded.judgment_date,",
      "title=excluded.title,revision=excluded.revision,updated_at=excluded.updated_at",
      "WHERE excluded.revision >= judgment_metadata.revision"
    ].join(" ");
    await db.batch([stmt(sql,jid,record.year,record.caseType,record.caseNo,
      record.judgmentDate,record.title,record.revision,time,time)]);
    return {jid,storedPrivate:true,publishable:false};
  }
  async function purgeEverywhere(rawJid,targetNames){
    const jid=jidFixture(rawJid);
    if(!Array.isArray(targetNames)||REQUIRED_PURGE.some(x=>!targetNames.includes(x)))
      throw Error("Incomplete purge targets");
    const state=await access(jid);
    if(!state)throw Error("Must block access first");
    await db.batch([
      stmt("UPDATE judgment_access SET state='revoked',changed_at=? WHERE jid=?",iso(),jid),
      stmt("DELETE FROM judgment_search_tokens WHERE jid=?",jid),
      stmt("DELETE FROM judgment_summaries WHERE jid=?",jid),
      stmt("DELETE FROM judgment_vectors WHERE jid=?",jid),
      stmt("DELETE FROM judgment_metadata WHERE jid=?",jid)
    ]);
    return {jid,removedLiveRows:true,historyErased:false};
  }
  async function liveRowsPurged(rawJid){
    const jid=jidFixture(rawJid);
    const gate=await access(jid);
    if(gate?.state!=="revoked")return false;
    for(const table of LIVE_TABLES){
      const row=await stmt("SELECT COUNT(*) AS n FROM "+table+" WHERE jid=?",jid).first();
      if(Number(row?.n)!==0)return false;
    }
    return true;
  }
  async function verifyPurged(jid,targets){
    if(!await liveRowsPurged(jid))return false;
    // A live D1 query cannot verify deletion from Time Travel / all caches.
    if(targets.some(x=>["snapshots","backupCopies","edgeCache"].includes(x)))return false;
    return true;
  }
  async function getPrivateMetadata(rawJid){
    const jid=jidFixture(rawJid);
    return (await stmt("SELECT m.* FROM judgment_metadata m JOIN judgment_access g ON g.jid=m.jid WHERE m.jid=? AND g.state='blocked'",jid).first())??null;
  }
  async function publicLookup(){return [];} // explicitly no public API
  return Object.freeze({blockPublicAccess,putPrivate,purgeEverywhere,verifyPurged,liveRowsPurged,getPrivateMetadata,publicLookup});
}
module.exports={makeD1MetadataAdapter,REQUIRED_PURGE,LIVE_TABLES};
