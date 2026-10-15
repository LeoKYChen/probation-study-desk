"use strict";
/**
 * v2.7.1c round 3: independent signed-revision witness verifier.
 *
 * OFFLINE SAFETY CONTRACT. This module DOES NOT provide a signing service,
 * a monotonic storage service, network access, or court-data authorization.
 * Both are required externally before real data could ever be considered.
 *
 * Signed checkpoint:
 * {version:1, scope:"v271c-revocation-ledger", revision, issuedAt, expiresAt, signature}
 * signature = Ed25519 canonical message over the first five fields.
 */
const crypto=require("node:crypto");
const SCOPE="v271c-revocation-ledger";
const INT=n=>Number.isSafeInteger(n)&&n>=1;
function canonicalCheckpoint({version,scope,revision,issuedAt,expiresAt}={}){
  if(version!==1||scope!==SCOPE||!INT(revision)||
     !Number.isSafeInteger(issuedAt)||!Number.isSafeInteger(expiresAt)||
     expiresAt<=issuedAt||expiresAt-issuedAt>120000)
    throw Error("Malformed witness checkpoint");
  return Buffer.from(JSON.stringify([version,scope,revision,issuedAt,expiresAt]),"utf8");
}
function makeTrustedRevisionProvider({loadCheckpoint,loadIndependentFloor,publicKeySpki,clock=()=>Date.now()}={}){
  if(typeof loadCheckpoint!=="function"||typeof loadIndependentFloor!=="function")
    throw Error("Independent checkpoint and high-water providers required");
  if(typeof publicKeySpki!=="string"||!publicKeySpki.includes("BEGIN PUBLIC KEY"))
    throw Error("Trusted Ed25519 public key required");
  let key;
  try{key=crypto.createPublicKey(publicKeySpki)}
  catch{throw Error("Invalid trusted public key")}
  if(key.asymmetricKeyType!=="ed25519")throw Error("Expected Ed25519 trusted key");
  return async function trustedMinimumRevision(){
    const [checkpoint,floorRecord]=await Promise.all([loadCheckpoint(),loadIndependentFloor()]);
    if(!checkpoint||typeof checkpoint!=="object"||
       typeof checkpoint.signature!=="string"||
       !/^[A-Za-z0-9+/]+={0,2}$/.test(checkpoint.signature))
      throw Error("Signed witness unavailable");
    const message=canonicalCheckpoint(checkpoint);
    const valid=crypto.verify(null,message,key,Buffer.from(checkpoint.signature,"base64"));
    if(!valid)throw Error("Invalid witness signature");
    const now=clock();
    if(!Number.isSafeInteger(now)||checkpoint.issuedAt>now+5000||
       checkpoint.expiresAt<=now||checkpoint.issuedAt<now-125000)
      throw Error("Expired or future witness checkpoint");
    if(!floorRecord||floorRecord.scope!==SCOPE||!INT(floorRecord.revision)||
       floorRecord.revision>checkpoint.revision)
      throw Error("High-water checkpoint is missing, ahead, or inconsistent");
    if(floorRecord.independentAttestation!==true)
      throw Error("Independent floor is not authenticated");
    // The *calling infrastructure* MUST guarantee the floor is genuine,
    // monotonic, and independent. The boolean alone is NOT authentication.
    return Math.max(checkpoint.revision,floorRecord.revision);
  };
}
module.exports={SCOPE,canonicalCheckpoint,makeTrustedRevisionProvider};
