"use strict";
/**
 * Internal-only, mock-authorized command dispatcher.
 * This is NOT a Cloudflare RPC entrypoint; it cannot receive HTTP requests.
 * Real requests require external auth, nonce persistence and approval.
 */
function makeInternalController({
  authorize,guardedService,reconcile,
  mode="disabled"
}={}){
  if(mode!=="synthetic-test")throw Error("Private controller disabled without synthetic-test mode");
  if(typeof authorize!=="function"||!guardedService||typeof reconcile!=="function")
    throw Error("Missing signed authority or guarded storage dependencies");
  return Object.freeze({
    async readMetadata(command,jid){
      const principal=await authorize(command,"metadata:read");
      if(!principal?.authenticated||principal.publicReadAllowed!==false)
        throw Error("Unsafe service identity");
      return guardedService.getPrivateMetadata(jid);
    },
    async writeSynthetic(command,record){
      const principal=await authorize(command,"metadata:write");
      if(!principal?.authenticated||principal.liveJudicialApiAllowed!==false)
        throw Error("Unsafe service identity");
      if(!String(record?.jid??"").startsWith("TEST_JID_SYNTHETIC_"))
        throw Error("Controller rejects non-synthetic judgments");
      return guardedService.putPrivate(record);
    },
    async simulateRestore(command){
      const principal=await authorize(command,"restore:simulate");
      if(!principal?.authenticated||principal.publicReadAllowed!==false)
        throw Error("Unsafe recovery authority");
      return reconcile();
    }
  });
}
module.exports={makeInternalController};
