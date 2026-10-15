"use strict";
/**
 * Deployment-readiness audit: DOCUMENTATION/DRY RUN ONLY.
 * It cannot perform a remote action and cannot confer authorization.
 */
const REQUIRED=Object.freeze([
 ["ownerApproval","Owner explicitly approved private pilot with synthetic data only"],
 ["isolatedOperationalD1","Metadata D1 is isolated from existing live websites"],
 ["isolatedRevocationD1","Revocation D1 uses distinct database ID and restore boundary"],
 ["ledgerSigner","Ledger signed checkpoint provider is independently operated"],
 ["highWaterSigner","High-water signing service has different key and operator"],
 ["durableHighWater","External monotonic floor cannot roll back alongside either D1"],
 ["atomicNonceStore","Private service commands use independent atomic nonce persistence"],
 ["keySecretsProvisioned","Keys are in secure secrets, never Git/Pages/logs"],
 ["authenticatedServiceBinding","Only an authenticated internal service can invoke mutations"],
 ["backupRestorePolicy","Time Travel and backup erasure policy approved"],
 ["purgeReplayDrill","Remote synthetic restore-and-purge drill passed"],
 ["incidentResponse","Alerting, owner sign-off, and emergency public lockdown tested"],
 ["dataScopeReview","Court API license, public scope and removal conditions reviewed"]
]);
function assessPrivatePilot(config={}){
 const missing=REQUIRED.filter(([key])=>config[key]!==true)
   .map(([key,label])=>({key,label}));
 if(config.metadataDatabaseId&&config.metadataDatabaseId===config.ledgerDatabaseId)
   missing.push({key:"distinctBindings",label:"Operational and revocation databases must differ"});
 if(config.liveJudicialApiEnabled===true)
   missing.push({key:"noLiveJudicialApi",label:"Real court API is forbidden in this phase"});
 if(config.publicSearchEnabled===true)
   missing.push({key:"noPublicSearch",label:"Public judgment search is forbidden in this phase"});
 return Object.freeze({
   phase:"v2.7.1c-offline-only",
   missing,
   verifiedByCodeOnly:false,
   remoteDeploymentPerformed:false,
   // A favorable self-reported checklist is NOT technical authorization.
   allowedToUseRealCourtDocuments:false,
   allowedToEnablePublicJudgmentSearch:false,
   recommendation:missing.length?
     "Not ready: complete prerequisites with independently verified evidence":
     "Checklist only: external security review and explicit owner approval still required"
 });
}
module.exports={REQUIRED,assessPrivatePilot};
