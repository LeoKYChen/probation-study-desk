"use strict";
/**
 * Offline-only Ed25519 service-command authorization. No network listener.
 *
 * A future internal Worker/service binding must call this before any action.
 * The public Worker continues to return 404 for every HTTP path.
 *
 * nonceStore.consumeOnce() MUST be an atomic independent durable operation,
 * not an in-memory Set in production. No such real service is deployed.
 */
const crypto=require("node:crypto");
const AUDIENCE="v271c-private-court-metadata-synthetic-only";
const ISSUER="v271c-internal-controller";
const PERMISSIONS=Object.freeze({
  "metadata:read":Object.freeze(["synthetic-reader","synthetic-operator"]),
  "metadata:write":Object.freeze(["synthetic-operator"]),
  "restore:simulate":Object.freeze(["synthetic-recovery-admin"])
});
function canonicalCommand(c){
 if(!c||c.version!==1||c.audience!==AUDIENCE||c.issuer!==ISSUER||
   typeof c.subject!=="string"||!/^svc:[a-z][a-z0-9-]{2,63}$/.test(c.subject)||
   !Object.hasOwn(PERMISSIONS,c.operation)||!PERMISSIONS[c.operation].includes(c.role)||
   typeof c.nonce!=="string"||!/^[a-zA-Z0-9_-]{16,100}$/.test(c.nonce)||
   !Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||
   c.expiresAt<=c.issuedAt||c.expiresAt-c.issuedAt>30000)
   throw Error("Invalid synthetic service command envelope");
 return Buffer.from(JSON.stringify([c.version,c.audience,c.issuer,c.subject,c.role,
   c.operation,c.nonce,c.issuedAt,c.expiresAt]),"utf8");
}
function makeServiceAuthorizer({publicKeySpki,nonceStore,clock=()=>Date.now()}={}){
 if(typeof nonceStore?.consumeOnce!=="function")
   throw Error("Atomic independently durable nonce store required");
 if(typeof publicKeySpki!=="string")throw Error("Missing trusted signer");
 let key;
 try{key=crypto.createPublicKey(publicKeySpki)}catch{throw Error("Invalid signer public key")}
 if(key.asymmetricKeyType!=="ed25519")throw Error("Ed25519 signer required");
 return async function authorize(command,requestedOperation){
   if(!Object.hasOwn(PERMISSIONS,requestedOperation))throw Error("Operation not supported");
   const msg=canonicalCommand(command);
   if(command.operation!==requestedOperation)throw Error("Command lacks requested capability");
   const now=clock();
   if(!Number.isSafeInteger(now)||command.issuedAt>now+2000||command.expiresAt<=now||
      command.issuedAt<now-32000)throw Error("Service command expired or from future");
   if(typeof command.signature!=="string"||!/^[A-Za-z0-9+/]+={0,2}$/.test(command.signature)||
      !crypto.verify(null,msg,key,Buffer.from(command.signature,"base64")))
     throw Error("Service command signature invalid");
   // Persist atomically outside the operational D1. A recovered local DB could
   // otherwise permit a previous signature/nonce to be replayed.
   const consumed=await nonceStore.consumeOnce(command.nonce,command.expiresAt);
   if(consumed!==true)throw Error("Service command replay or nonce store unavailable");
   return Object.freeze({
     subject:command.subject,operation:command.operation,role:command.role,
     audience:AUDIENCE,authenticated:true,
     // This is NOT permission to connect judicial API or publish cases.
     liveJudicialApiAllowed:false,publicReadAllowed:false
   });
 };
}
module.exports={AUDIENCE,ISSUER,PERMISSIONS,canonicalCommand,makeServiceAuthorizer};
