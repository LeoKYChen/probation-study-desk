"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {test}=require("node:test");
const {SCOPE,FLOOR_SCOPE,canonicalCheckpoint,makeTrustedRevisionProvider}=require("./trusted-witness.cjs");
const a=crypto.generateKeyPairSync("ed25519"),b=crypto.generateKeyPairSync("ed25519");
const now=Date.parse("2026-10-15T03:50:00Z");
const pem=key=>key.export({type:"spki",format:"pem"});
function signed(scope,revision,privateKey,overrides={}){
 const payload={version:1,scope,revision,issuedAt:now-1000,expiresAt:now+30000,...overrides};
 return {...payload,signature:crypto.sign(null,canonicalCheckpoint(payload,scope),privateKey).toString("base64")};
}
function provider(checkpoint=signed(SCOPE,12,a.privateKey),floor=signed(FLOOR_SCOPE,10,b.privateKey),opts={}){
 return makeTrustedRevisionProvider({
  loadCheckpoint:async()=>checkpoint,loadIndependentFloor:async()=>floor,
  checkpointPublicKey:pem(a.publicKey),floorPublicKey:pem(b.publicKey),
  clock:()=>now,...opts
 });
}
test("independent signed witnesses permit latest compatible revision",async()=>{
 assert.equal(await provider()(),12);
});
test("high-water rollback protection rejects ledger checkpoint behind external floor",async()=>{
 const stale=signed(SCOPE,9,a.privateKey);
 await assert.rejects(provider(stale,signed(FLOOR_SCOPE,10,b.privateKey))(),/behind independent/);
});
test("tampering revision invalidates Ed25519 signature",async()=>{
 await assert.rejects(provider({...signed(SCOPE,12,a.privateKey),revision:99})(),/Invalid witness signature/);
});
test("wrong signer cannot forge independent high-water certificate",async()=>{
 const fake=signed(FLOOR_SCOPE,10,a.privateKey);
 await assert.rejects(provider(signed(SCOPE,12,a.privateKey),fake)(),/Invalid witness signature/);
});
test("expired checkpoint and future checkpoint fail closed",async()=>{
 const expired=signed(SCOPE,12,a.privateKey,{issuedAt:now-90000,expiresAt:now-5000});
 await assert.rejects(provider(expired)(),/Expired or future/);
 const future=signed(SCOPE,12,a.privateKey,{issuedAt:now+6000,expiresAt:now+12000});
 await assert.rejects(provider(future)(),/Expired or future/);
});
test("identical keys for ledger and high-water authority rejected",()=>{
 assert.throws(()=>makeTrustedRevisionProvider({
  loadCheckpoint:async()=>null,loadIndependentFloor:async()=>null,
  checkpointPublicKey:pem(a.publicKey),floorPublicKey:pem(a.publicKey)
 }),/independent signing keys/);
});
test("missing independent floor refuses to return a revision",async()=>{
 await assert.rejects(provider(signed(SCOPE,12,a.privateKey),null)(),/Signed witness unavailable/);
});
test("malformed, mismatched scope and overlong certificate invalid",()=>{
 assert.throws(()=>canonicalCheckpoint({version:1,scope:"wrong",revision:2,issuedAt:now,expiresAt:now+1000},SCOPE),/Malformed/);
 assert.throws(()=>canonicalCheckpoint({version:1,scope:SCOPE,revision:2,issuedAt:now,expiresAt:now+3600000},SCOPE),/Malformed/);
});
test("two independent witness providers are both required",()=>{
 assert.throws(()=>makeTrustedRevisionProvider({loadCheckpoint:async()=>null}),/Two independent/);
});
