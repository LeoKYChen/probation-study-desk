"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const {DatabaseSync}=require("node:sqlite");

const {ENDPOINTS,makeClient}=require("../../services/v2.7-judgment/judicial-api-client.cjs");
const {makeD1MetadataAdapter}=require("../../services/v2.7-judgment/d1-metadata-adapter.cjs");
const {makeRevocationLedger}=require("../../services/v2.7-judgment/revocation-ledger.cjs");
const {makeGuardedMetadataService}=require("../../services/v2.7-judgment/restore-guard.cjs");
const {makeSyntheticDeltaRunner,expectedChangeDate,scrubMetadata}=require("./stage3c-synthetic-delta.cjs");

const A="TEST_JID_SYNTHETIC_DELTA_A",B="TEST_JID_SYNTHETIC_DELTA_B";
const WHEN=new Date("2026-10-14T18:30:00Z"); // 02:30 Taiwan, Oct 15
const REMOVED={
  error:"查無資料，本裁判可能未公開或已從系統移除，若您曾經下載過本裁判，亦請您將其移除！謝謝！"
};
function makeDoc(jid,title="合成裁判甲",body="合成測試專用裁判內容"){
  return {
    JID:jid,JYEAR:"999",JCASE:"測試",JNO:"001",
    JDATE:"20990101",JTITLE:title,ATTACHMENTS:[],
    JFULLX:{JFULLTYPE:"text",JFULLCONTENT:body,JFULLPDF:""}
  };
}
function mkDb(migration){
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(fs.readFileSync(path.join(__dirname,"../../services/v2.7-judgment/migrations",migration),"utf8"));
  const d1={
    prepare(sql){return{bind(...values){return{
      async run(){return db.prepare(sql).run(...values)},
      async first(){return db.prepare(sql).get(...values)??null},
      async all(){return{results:db.prepare(sql).all(...values)}}
    }}}},
    async batch(statements){
      db.exec("BEGIN IMMEDIATE");
      try{for(const stmt of statements)await stmt.run();db.exec("COMMIT")}
      catch(e){db.exec("ROLLBACK");throw e}
    }
  };
  return {db,d1};
}
function rig(){
  const live=mkDb("0001_private_metadata.sql");
  const independent=mkDb("0002_separate_revocation_ledger.sql");
  const operational=makeD1MetadataAdapter(live.d1,{clock:()=>WHEN});
  const ledger=makeRevocationLedger(independent.d1,{clock:()=>WHEN});
  let witness=1, revision=0, clock=WHEN;
  let list=[{date:"2026-10-08",list:[A]}];
  let docMap=new Map([[A,makeDoc(A)]]);
  let transportError=null;
  const calls=[];
  const mockTransport=async ({url,body})=>{
    calls.push({action:url.split("/").at(-1)});
    if(transportError) return {error:transportError};
    if(url===ENDPOINTS.Auth)return {Token:"MOCK_ONLY_TOKEN_NO_REAL_CREDENTIALS"};
    if(url===ENDPOINTS.JList)return list;
    if(url===ENDPOINTS.JDoc)return docMap.get(body.j)||{error:"暫時性服務故障"};
    throw Error("Unexpected mock action");
  };
  const client=makeClient({
    transport:mockTransport,user:"FAKE_USER_ONLY",password:"FAKE_PASSWORD_ONLY",
    now:()=>clock
  });
  const trustedMinimumRevision=async()=>witness;
  const guarded=makeGuardedMetadataService({operational,ledger,trustedMinimumRevision});
  const runner=makeSyntheticDeltaRunner({
    client,guarded,operational,ledger,trustedMinimumRevision,
    advanceWitness:async value=>{witness=value},
    nextRevision:async()=>++revision,
    clock:()=>clock
  });
  return {
    live,independent,operational,ledger,guarded,runner,calls,
    setList:value=>{list=value},
    setDoc:(jid,value)=>{docMap.set(jid,value)},
    setTransportError:value=>{transportError=value},
    setClock:value=>{clock=value},
    setWitness:value=>{witness=value},
    witness:()=>witness,
    close:()=>{live.db.close();independent.db.close()}
  };
}
async function withRig(callback){
  const r=rig();
  try{await callback(r)}finally{r.close()}
}
test("T-7 day is based on Taipei calendar, including day boundary",()=>{
  assert.equal(expectedChangeDate(WHEN),"2026-10-08");
  assert.equal(expectedChangeDate(new Date("2026-10-14T15:59:59Z")),"2026-10-07");
});
test("complete mock JList→JDoc ingestion stores metadata only, never exposes records",async()=>{
  await withRig(async r=>{
    const result=await r.runner.runOneMockCycle();
    assert.equal(result.changes_read,1);
    assert.equal(result.stored_private,1);
    assert.equal(result.public_search_enabled,false);
    assert.equal(result.source_api_called_with_actual_credentials,false);
    const row=await r.guarded.getPrivateMetadata(A);
    assert.equal(row.title,"合成裁判甲");
    assert.equal(Object.keys(row).some(k=>/full|preview|pdf|attachment/i.test(k)),false);
    assert.deepEqual(await r.operational.publicLookup(),[]);
    assert.deepEqual(r.calls.map(x=>x.action),["Auth","JList","JDoc"]);
  });
});
test("repeated JID uses newer mock JDoc metadata, does not duplicate",async()=>{
  await withRig(async r=>{
    await r.runner.runOneMockCycle();
    r.setDoc(A,makeDoc(A,"合成修正新版","不同的合成文字"));
    await r.runner.runOneMockCycle();
    const doc=await r.guarded.getPrivateMetadata(A);
    assert.equal(doc.title,"合成修正新版");
    assert.equal(doc.revision,2);
    assert.equal(r.live.db.prepare("SELECT COUNT(*) AS n FROM judgment_metadata WHERE jid=?").get(A).n,1);
  });
});
test("duplicates from JList collapse to one JDoc request",async()=>{
  await withRig(async r=>{
    r.setList([{date:"2026-10-08",list:[A,A,A]}]);
    const x=await r.runner.runOneMockCycle();
    assert.equal(x.changes_read,1);
    assert.equal(r.calls.filter(c=>c.action==="JDoc").length,1);
  });
});
test("official removal tombstones before deletion, purges live indexes and prevents re-ingest",async()=>{
  await withRig(async r=>{
    await r.runner.runOneMockCycle();
    for(const [table,column] of [
      ["judgment_search_tokens","token"],["judgment_summaries","summary"],["judgment_vectors","vector_ref"]
    ]){
      r.live.db.prepare("INSERT INTO "+table+"(jid,"+column+") VALUES(?,?)").run(A,"SYNTHETIC_ONLY");
    }
    r.setDoc(A,REMOVED);
    const x=await r.runner.runOneMockCycle();
    assert.equal(x.revoked_live_rows,1);
    assert.equal(x.withdrawal_fully_verified,false);
    assert.equal(await r.ledger.isRevoked(A,r.witness()),true);
    assert.equal(await r.operational.liveRowsPurged(A),true);
    assert.equal(await r.guarded.getPrivateMetadata(A),null);
    await assert.rejects(r.guarded.putPrivate({
      jid:A,year:"999",caseType:"測試",caseNo:"1",
      judgmentDate:"20990101",title:"合成誤匯回",revision:900
    }),/independently revoked/);
    assert.deepEqual(await r.guarded.publicLookup(),[]);
  });
});
test("withdrawal affects only its JID, leaves unrelated synthetic record private",async()=>{
  await withRig(async r=>{
    r.setList([{date:"2026-10-08",list:[A,B]}]);
    r.setDoc(B,makeDoc(B,"合成裁判乙"));
    await r.runner.runOneMockCycle();
    r.setDoc(A,REMOVED);
    const x=await r.runner.runOneMockCycle();
    assert.equal(x.revoked_live_rows,1);
    assert.equal(x.stored_private,1);
    assert.equal(await r.guarded.getPrivateMetadata(A),null);
    assert.equal((await r.guarded.getPrivateMetadata(B)).title,"合成裁判乙");
  });
});
test("unknown JDoc API error is NOT withdrawal and does not delete prior data",async()=>{
  await withRig(async r=>{
    await r.runner.runOneMockCycle();
    r.setDoc(A,{error:"驗證失敗"});
    await assert.rejects(r.runner.runOneMockCycle(),/API returned an error/);
    assert.equal((await r.guarded.getPrivateMetadata(A)).title,"合成裁判甲");
    assert.equal(await r.ledger.isRevoked(A,r.witness()),false);
  });
});
test("Auth/JList failure halts before any mutation",async()=>{
  await withRig(async r=>{
    r.setTransportError("驗證失敗");
    await assert.rejects(r.runner.runOneMockCycle(),/rejected/);
    assert.equal(await r.operational.getPrivateMetadata(A),null);
    assert.equal(r.calls.filter(c=>c.action==="JDoc").length,0);
  });
});
test("JList wrong date fails BEFORE obtaining JDoc or changing metadata",async()=>{
  await withRig(async r=>{
    r.setList([{date:"2026-10-01",list:[A]}]);
    await assert.rejects(r.runner.runOneMockCycle(),/T-7 window/);
    assert.equal(r.calls.some(c=>c.action==="JDoc"),false);
    assert.equal(await r.operational.getPrivateMetadata(A),null);
  });
});
test("realistic JIDs rejected by mock-only gate without JDoc request",async()=>{
  await withRig(async r=>{
    r.setList([{date:"2026-10-08",list:["TPSM,114,台抗,2605,20251231,1"]}]);
    await assert.rejects(r.runner.runOneMockCycle(),/synthetic JIDs/);
    assert.equal(r.calls.some(x=>x.action==="JDoc"),false);
    assert.deepEqual(await r.operational.publicLookup(),[]);
  });
});
test("untrusted ledger witness stops all source and storage operations",async()=>{
  await withRig(async r=>{
    r.setWitness(10);
    await assert.rejects(r.runner.runOneMockCycle(),/rolled back/);
    assert.equal(r.calls.length,0);
  });
});
test("preflight every JDoc before any upsert: second broken item prevents partial import",async()=>{
  await withRig(async r=>{
    r.setList([{date:"2026-10-08",list:[A,B]}]);
    r.setDoc(B,{error:"暫時無法取得資料"});
    await assert.rejects(r.runner.runOneMockCycle(),/API returned an error/);
    assert.equal(await r.operational.getPrivateMetadata(A),null);
    assert.equal(await r.operational.getPrivateMetadata(B),null);
  });
});
test("PDF-type JDoc preview cannot leak into metadata or be labeled full text",async()=>{
  await withRig(async r=>{
    r.setDoc(A,{
      ...makeDoc(A),
      JFULLX:{
        JFULLTYPE:"file",
        JFULLCONTENT:"合成預覽",
        JFULLPDF:"https://data.judicial.gov.tw/jdg/api/JFile/TEST_ONLY.pdf"
      }
    });
    const x=await r.runner.runOneMockCycle();
    assert.equal(x.stored_private,1);
    const row=await r.guarded.getPrivateMetadata(A);
    assert.equal(Object.hasOwn(row,"fullText"),false);
    assert.equal(Object.hasOwn(row,"preview"),false);
    assert.equal(Object.hasOwn(row,"pdfUrl"),false);
  });
});
test("malformed JDoc wrong JID is rejected without touching storage",async()=>{
  await withRig(async r=>{
    r.setDoc(A,{...makeDoc(A),JID:B});
    await assert.rejects(r.runner.runOneMockCycle(),/Mismatched JID/);
    assert.equal(await r.operational.getPrivateMetadata(A),null);
  });
});
test("scrubMetadata rejects real titles and raw full text is never copied",()=>{
  assert.throws(()=>scrubMetadata({
    kind:"upsert",publishable:false,record:{
      jid:A,title:"真實裁判",year:"999",caseType:"x",caseNo:"1",judgmentDate:"20990101"
    }},1),/Only synthetic title/);
  const p={kind:"upsert",publishable:false,record:{
    jid:A,title:"合成測試",year:"999",caseType:"x",caseNo:"1",judgmentDate:"20990101",
    fullText:"SECRET_FIXTURE_DO_NOT_COPY"
  }};
  const result=scrubMetadata(p,4);
  assert.equal(JSON.stringify(result).includes("SECRET_FIXTURE"),false);
});
