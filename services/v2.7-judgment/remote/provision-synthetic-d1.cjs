#!/usr/bin/env node
"use strict";
/**
 * Manual-gated, synthetic-only, D1 remote test, no Worker and no court API.
 * DANGER: creates exactly TWO NEW TEST D1 DBs if and only if account has space
 * and neither reserved name already exists. Never touches existing DB names.
 * No delete/restore operations. Not designed for repeated execution.
 */
const cp=require("node:child_process");
const path=require("node:path");
const BASE=path.resolve(__dirname,"..");
const M="probation-v271c-metadata-synth-20261015";
const L="probation-v271c-ledger-synth-20261015";
function fail(message){throw Error("REMOTE PILOT BLOCKED: "+message)}
function wrangler(args){
  try{
    return cp.execFileSync("npx",["wrangler",...args],{
      encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"],
      maxBuffer:6*1024*1024,env:process.env
    });
  }catch(e){fail("Cloudflare/Wrangler operation failed; see restricted workflow output and inspect only these two test DBs")}
}
function parseResults(stdout){
  let raw;
  try{raw=JSON.parse(stdout)}catch{fail("Cloudflare returned unrecognized JSON")}
  if(!Array.isArray(raw))fail("Cloudflare returned non-list JSON");
  return raw;
}
function queryCount(db,sql){
  const raw=parseResults(wrangler(["d1","execute",db,"--remote","--json","--command",sql]));
  const rows=raw[0]?.results;
  const n=Number(rows?.[0]?.n);
  if(!Number.isSafeInteger(n))fail("Unrecognized remote SQL results");
  return n;
}
function main(){
  if(process.env.V271C_CREATE_SYNTHETIC_D1_ONLY!=="YES_CREATE_2_SYNTHETIC_DB")
    fail("explicit synthetic resource approval missing");
  if(!process.env.CLOUDFLARE_ACCOUNT_ID||!process.env.CLOUDFLARE_API_TOKEN)
    fail("D1 account-scoped token missing");
  if(process.env.JUDICIAL_API_LIVE_ENABLED==="true")
    fail("Real judicial API must remain disabled");
  const dbs=parseResults(wrangler(["d1","list","--json"]));
  if(dbs.some(d=>[M,L].includes(d.name)))
    fail("A reserved DB already exists; refuse to modify it, manual review required");
  // 10 is the published Free limit. Fail conservatively if cannot fit both.
  if(dbs.length>8)fail("Account has insufficient headroom for two D1 Free databases");
  if(dbs.some(d=>!d.uuid&&!d.id))fail("Unknown Cloudflare D1 list format");
  console.log("Preflight OK: two dedicated synthetic D1 resources can be created");
  wrangler(["d1","create",M,"--location","apac"]);
  console.log("Created isolated metadata synthetic database");
  wrangler(["d1","create",L,"--location","apac"]);
  console.log("Created isolated revocation synthetic database");
  const files=[
    [M,"migrations/0001_private_metadata.sql"],
    [L,"migrations/0002_separate_revocation_ledger.sql"],
    [M,"remote/metadata-synthetic-smoke.sql"],
    [L,"remote/ledger-synthetic-smoke.sql"]
  ];
  for(const [db,file] of files){
    wrangler(["d1","execute",db,"--remote","--yes","--file",path.join(BASE,file)]);
    console.log("Applied synthetic-only SQL fixture step: "+file);
  }
  const meta=queryCount(M,"SELECT COUNT(*) AS n FROM judgment_metadata WHERE jid='TEST_JID_SYNTHETIC_REMOTE_20261015'");
  const tomb=queryCount(L,"SELECT COUNT(*) AS n FROM judgment_tombstones WHERE jid='TEST_JID_SYNTHETIC_REMOTE_20261015'");
  const blocked=queryCount(M,"SELECT COUNT(*) AS n FROM judgment_access WHERE jid='TEST_JID_SYNTHETIC_REMOTE_20261015' AND state='blocked'");
  if(meta!==1||tomb!==1||blocked!==1)
    fail("Remote synthetic schema or tombstone smoke test failed");
  console.log("SUCCESS: remote D1 stores are separate and synthetic fixture counts are verified.");
  console.log("No Worker, public endpoints, real court records, or Time Travel restores were created.");
}
try{main()}catch(e){console.error(e.message);process.exitCode=1}
