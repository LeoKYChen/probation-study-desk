"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {REQUIRED,assessPrivatePilot}=require("./deployment-preflight.cjs");
test("default remote preflight is not cleared and never grants real court access",()=>{
 const r=assessPrivatePilot();
 assert.equal(r.missing.length,REQUIRED.length);
 assert.equal(r.remoteDeploymentPerformed,false);
 assert.equal(r.allowedToUseRealCourtDocuments,false);
 assert.equal(r.allowedToEnablePublicJudgmentSearch,false);
});
test("same D1 binding for metadata and tombstones fails",()=>{
 const r=assessPrivatePilot({metadataDatabaseId:"same",ledgerDatabaseId:"same"});
 assert.ok(r.missing.some(x=>x.key==="distinctBindings"));
});
test("live API enabled blocks preflight",()=>{
 assert.ok(assessPrivatePilot({liveJudicialApiEnabled:true}).missing.some(x=>x.key==="noLiveJudicialApi"));
});
test("public judgment index proposed blocks preflight",()=>{
 assert.ok(assessPrivatePilot({publicSearchEnabled:true}).missing.some(x=>x.key==="noPublicSearch"));
});
test("even completed self-attested checklist is not authorization to deploy real data",()=>{
 const flags=Object.fromEntries(REQUIRED.map(([k])=>[k,true]));
 const r=assessPrivatePilot({...flags,metadataDatabaseId:"synthetic-a",ledgerDatabaseId:"synthetic-b"});
 assert.equal(r.missing.length,0);
 assert.equal(r.verifiedByCodeOnly,false);
 assert.equal(r.allowedToUseRealCourtDocuments,false);
 assert.equal(r.allowedToEnablePublicJudgmentSearch,false);
 assert.match(r.recommendation,/external security review/);
});
