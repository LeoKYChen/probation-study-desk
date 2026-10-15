"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {test}=require("node:test");
const {AUDIENCE,ISSUER,canonicalCommand,hashPayload,makeServiceAuthorizer}=require("./service-permissions.cjs");
const keys=crypto.generateKeyPairSync("ed25519");
const pem=keys.publicKey.export({type:"spki",format:"pem"});
const now=Date.parse("2026-10-15T04:15:00Z");
const PAYLOAD={jid:"TEST_JID_SYNTHETIC_001"};
function envelope(operation="metadata:read",role="synthetic-reader",overrides={},payload=PAYLOAD){
  const c={version:1,audience:AUDIENCE,issuer:ISSUER,subject:"svc:legal-private-controller",
    role,operation,nonce:"NONCE_SYNTHETIC_ABCD1234",payloadHash:hashPayload(payload),issuedAt:now-1000,expiresAt:now+10000,...overrides};
  return {...c,signature:crypto.sign(null,canonicalCommand(c),keys.privateKey).toString("base64")};
}
function fixture(){
 const used=new Set();
 const nonceStore={async consumeOnce(nonce){if(used.has(nonce))return false;used.add(nonce);return true}};
 return {used,nonceStore,auth:makeServiceAuthorizer({publicKeySpki:pem,nonceStore,clock:()=>now})};
}
test("valid signed synthetic reader gets only metadata:read",async()=>{
 const r=fixture();
 const p=await r.auth(envelope(),"metadata:read",PAYLOAD);
 assert.equal(p.authenticated,true);assert.equal(p.operation,"metadata:read");
 assert.equal(p.liveJudicialApiAllowed,false);assert.equal(p.publicReadAllowed,false);
});
test("attempting write or restore with reader role fails",async()=>{
 const r=fixture();
 await assert.rejects(r.auth(envelope(),"metadata:write",PAYLOAD),/lacks requested/);
 assert.throws(()=>envelope("restore:simulate","synthetic-reader"),/Invalid synthetic/);
});
test("signed synthetic operator may write metadata but never publish",async()=>{
 const r=fixture();
 const p=await r.auth(envelope("metadata:write","synthetic-operator"),"metadata:write",PAYLOAD);
 assert.equal(p.operation,"metadata:write");assert.equal(p.publicReadAllowed,false);
});
test("restore role is different from normal writer",async()=>{
 const r=fixture();
 const p=await r.auth(envelope("restore:simulate","synthetic-recovery-admin"),"restore:simulate",PAYLOAD);
 assert.equal(p.role,"synthetic-recovery-admin");
});
test("same signed nonce cannot be replayed after successful use",async()=>{
 const r=fixture(),cmd=envelope();
 await r.auth(cmd,"metadata:read",PAYLOAD);
 await assert.rejects(r.auth(cmd,"metadata:read",PAYLOAD),/replay/);
});
test("tampering role or operation after signing fails signature validation",async()=>{
 const r=fixture();
 await assert.rejects(r.auth({...envelope(),role:"synthetic-operator"},"metadata:read",PAYLOAD),/signature invalid/);
});
test("unknown audience and issuer rejected before use",async()=>{
 const r=fixture();
 await assert.rejects(r.auth({...envelope(),audience:"public"},"metadata:read",PAYLOAD),/Invalid synthetic/);
 await assert.rejects(r.auth({...envelope(),issuer:"outsider"},"metadata:read",PAYLOAD),/Invalid synthetic/);
});
test("expired or future request denied",async()=>{
 const r=fixture();
 const expired=envelope("metadata:read","synthetic-reader",{issuedAt:now-20000,expiresAt:now-5000});
 await assert.rejects(r.auth(expired,"metadata:read",PAYLOAD),/expired or from future/);
 const future=envelope("metadata:read","synthetic-reader",{issuedAt:now+5000,expiresAt:now+6000});
 await assert.rejects(r.auth(future,"metadata:read",PAYLOAD),/expired or from future/);
});
test("missing nonce store always rejects authorizer creation",()=>{
 assert.throws(()=>makeServiceAuthorizer({publicKeySpki:pem,clock:()=>now}),/nonce store required/);
});
test("nonce backend unavailable prevents permission grant",async()=>{
 const auth=makeServiceAuthorizer({publicKeySpki:pem,nonceStore:{
   async consumeOnce(){throw Error("nonce storage unavailable")}
 },clock:()=>now});
 await assert.rejects(auth(envelope(),"metadata:read",PAYLOAD),/nonce storage unavailable/);
});
test("unknown operation cannot be granted",async()=>{
 const r=fixture();
 await assert.rejects(r.auth(envelope(),"judgment:publish",PAYLOAD),/Operation not supported/);
});

test("valid signed identity cannot substitute the request body",async()=>{
 const r=fixture(),signed=envelope();
 await assert.rejects(r.auth(signed,"metadata:read",{jid:"TEST_JID_SYNTHETIC_OTHER"}),/payload mismatch/);
 assert.equal(r.used.size,0);
});
