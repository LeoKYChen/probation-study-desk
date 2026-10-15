"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const file=path.join(__dirname,"remote/provision-synthetic-d1.cjs");
const source=fs.readFileSync(file,"utf8");
const workflow=fs.readFileSync(path.join(__dirname,"../../.github/workflows/provision-v271c-synthetic-d1.yml"),"utf8");
test("synthetic provisioning refuses to start without explicit approval",()=>{
 const run=spawnSync(process.execPath,[file],{
  env:{PATH:process.env.PATH,CLOUDFLARE_ACCOUNT_ID:"SYNTHETIC_NO_NETWORK",
  CLOUDFLARE_API_TOKEN:"SYNTHETIC_NO_NETWORK"},
  encoding:"utf8",timeout:5000
 });
 assert.equal(run.status,1);
 assert.match(run.stderr,/explicit synthetic resource approval missing/);
});
test("synthetic provisioning refuses missing D1 credentials even if approval flag is forged",()=>{
 const run=spawnSync(process.execPath,[file],{
  env:{PATH:process.env.PATH,V271C_CREATE_SYNTHETIC_D1_ONLY:"YES_CREATE_2_SYNTHETIC_DB"},
  encoding:"utf8",timeout:5000
 });
 assert.equal(run.status,1);
 assert.match(run.stderr,/account-scoped token missing/);
});
test("remote provision script has no delete, restore or Worker deploy operations",()=>{
 for(const dangerous of [
   'wrangler d1 delete','wrangler deploy','time-travel restore',
   'd1 time-travel restore','jdg/api/JDoc','JUDICIAL_API_USER',
   'JUDICIAL_API_PASSWORD'
 ])assert.equal(source.includes(dangerous),false,dangerous);
 assert.match(source,/probation-v271c-metadata-synth-20261015/);
 assert.match(source,/probation-v271c-ledger-synth-20261015/);
});
test("remote workflow has no schedule or automatic trigger on ordinary commits",()=>{
 assert.match(workflow,/START_REMOTE_SYNTHETIC.md/);
 assert.doesNotMatch(workflow,/schedule:/);
 assert.doesNotMatch(workflow,/on:\s*push:\s*branches:/);
 assert.match(workflow,/CLOUDFLARE_D1_API_TOKEN/);
 assert.match(workflow,/JUDICIAL_API_LIVE_ENABLED: 'false'/);
});
