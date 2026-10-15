"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const crypto=require("node:crypto");
const {makeServiceAuthorizer,canonicalCommand,hashPayload,ISSUER,AUDIENCE}=require("./service-permissions.cjs");
const {makeInternalController}=require("./internal-controller.cjs");
const kp=crypto.generateKeyPairSync("ed25519");
const now=Date.parse("2026-10-15T04:30:00Z");
let nonceId=0;
function sign(operation,role,payload){
 const obj={version:1,issuer:ISSUER,audience:AUDIENCE,subject:"svc:metadata-controller",
 role,operation,payloadHash:hashPayload(payload),nonce:"UNIQUE_NONCE_"+String(++nonceId).padStart(20,"0"),
 issuedAt:now-1000,expiresAt:now+10000};
 return {...obj,signature:crypto.sign(null,canonicalCommand(obj),kp.privateKey).toString("base64")};
}
function fixture(){
 const seen=new Set(), calls=[];
 const authorize=makeServiceAuthorizer({
   publicKeySpki:kp.publicKey.export({format:"pem",type:"spki"}),
   clock:()=>now,
   nonceStore:{async consumeOnce(nonce){if(seen.has(nonce))return false;seen.add(nonce);return true}}
 });
 const guardedService={
   async getPrivateMetadata(jid){calls.push("read");return {jid,synthetic:true}},
   async putPrivate(record){calls.push("write");return {jid:record.jid}},
 };
 const ctl=makeInternalController({authorize,guardedService,reconcile:async()=>{
   calls.push("restore");return {quarantine:true}
 },mode:"synthetic-test"});
 return {ctl,calls};
}
test("controller cannot be constructed in default disabled mode",()=>{
 assert.throws(()=>makeInternalController({mode:"disabled"}),/disabled/);
 assert.throws(()=>makeInternalController(),/disabled/);
});
test("reader signed command can only call read, not write",async()=>{
 const {ctl,calls}=fixture();
 const read=sign("metadata:read","synthetic-reader",{jid:"TEST_JID_SYNTHETIC_ONLY"});
 const val=await ctl.readMetadata(read,"TEST_JID_SYNTHETIC_ONLY");
 assert.equal(val.synthetic,true);
 await assert.rejects(ctl.writeSynthetic(read,{jid:"TEST_JID_SYNTHETIC_ONLY"}),/lacks requested/);
 assert.deepEqual(calls,["read"]);
});
test("operator signed command can write only synthetic JID",async()=>{
 const {ctl,calls}=fixture();
 const cmd=sign("metadata:write","synthetic-operator",{jid:"REAL_JID"});
 await assert.rejects(ctl.writeSynthetic(cmd,{jid:"REAL_JID"}),/non-synthetic/);
 assert.deepEqual(calls,[]);
 const p=sign("metadata:write","synthetic-operator",{jid:"TEST_JID_SYNTHETIC_SAMPLE"});
 await ctl.writeSynthetic(p,{jid:"TEST_JID_SYNTHETIC_SAMPLE"});
 assert.deepEqual(calls,["write"]);
});
test("normal operator denied recovery; recovery-admin accepted",async()=>{
 const {ctl,calls}=fixture();
 await assert.rejects(ctl.simulateRestore(sign("metadata:write","synthetic-operator",{action:"synthetic-restore"})) ,/lacks requested/);
 const result=await ctl.simulateRestore(sign("restore:simulate","synthetic-recovery-admin",{action:"synthetic-restore"}));
 assert.equal(result.quarantine,true);
 assert.deepEqual(calls,["restore"]);
});
test("controller exposes no public HTTP or live court API methods",()=>{
 const {ctl}=fixture();
 assert.deepEqual(Object.keys(ctl).sort(),["readMetadata","simulateRestore","writeSynthetic"]);
 assert.equal(Object.hasOwn(ctl,"fetch"),false);
 assert.equal(Object.hasOwn(ctl,"publish"),false);
});
