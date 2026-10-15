"use strict";
/**
 * OFFLINE CONTRACT ONLY. Two independent signature authorities are REQUIRED:
 * a short-lived signed ledger checkpoint, plus an independently signed
 * monotonic high-water mark. Neither authority is provisioned by this repo.
 * This code never makes a network call or authenticates real court records.
 */
const crypto=require("node:crypto");
const SCOPE="v271c-revocation-ledger";
const FLOOR_SCOPE="v271c-independent-highwater";
const int=n=>Number.isSafeInteger(n)&&n>=1;
function canonicalCheckpoint(value,expectedScope){
  const {version,scope,revision,issuedAt,expiresAt}=value||{};
  if(version!==1||scope!==expectedScope||!int(revision)||
     !Number.isSafeInteger(issuedAt)||!Number.isSafeInteger(expiresAt)||
     expiresAt<=issuedAt||expiresAt-issuedAt>120000)
    throw Error("Malformed witness checkpoint");
  return Buffer.from(JSON.stringify([version,scope,revision,issuedAt,expiresAt]),"utf8");
}
function loadPublicKey(pem){
  if(typeof pem!=="string"||!pem.includes("BEGIN PUBLIC KEY"))
    throw Error("Ed25519 public key PEM required");
  let key;
  try{key=crypto.createPublicKey(pem)}catch{throw Error("Invalid witness public key")}
  if(key.asymmetricKeyType!=="ed25519")throw Error("Ed25519 public key required");
  return key;
}
function verifySigned(raw,scope,key,now){
  if(!raw||typeof raw!=="object"||typeof raw.signature!=="string"||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.signature))
    throw Error("Signed witness unavailable");
  const message=canonicalCheckpoint(raw,scope);
  if(!crypto.verify(null,message,key,Buffer.from(raw.signature,"base64")))
    throw Error("Invalid witness signature");
  if(!Number.isSafeInteger(now)||raw.issuedAt>now+5000||
     raw.expiresAt<=now||raw.issuedAt<now-125000)
    throw Error("Expired or future witness checkpoint");
  return raw.revision;
}
function makeTrustedRevisionProvider({
  loadCheckpoint,loadIndependentFloor,checkpointPublicKey,floorPublicKey,
  clock=()=>Date.now()
}={}){
  if(typeof loadCheckpoint!=="function"||typeof loadIndependentFloor!=="function")
    throw Error("Two independent witness providers required");
  const first=loadPublicKey(checkpointPublicKey);
  const second=loadPublicKey(floorPublicKey);
  if(first.export({type:"spki",format:"der"}).equals(second.export({type:"spki",format:"der"})))
    throw Error("Witnesses must use independent signing keys");
  return async function trustedMinimumRevision(){
    const [checkpoint,floor]=await Promise.all([loadCheckpoint(),loadIndependentFloor()]);
    const now=clock();
    const rev=verifySigned(checkpoint,SCOPE,first,now);
    const floorRev=verifySigned(floor,FLOOR_SCOPE,second,now);
    if(floorRev>rev)throw Error("Ledger checkpoint behind independent high-water mark");
    // Caller MUST guarantee signing authorities cannot both be rolled back
    // and that the floor signer persists monotonic high-water revisions.
    return rev;
  };
}
module.exports={SCOPE,FLOOR_SCOPE,canonicalCheckpoint,makeTrustedRevisionProvider};
