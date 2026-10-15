/**
 * v2.7.1c private Worker deployment template.
 * DO NOT DEPLOY. No API token, identity provider, D1 binding, ledger witness,
 * full-text encryption, or remote purge confirmation is provisioned.
 * No public HTTP endpoint is exposed by this entrypoint.
 */
export default {
  async fetch() {
    return new Response("Not Found",{
      status:404,
      headers:{
        "content-type":"text/plain;charset=utf-8",
        "cache-control":"no-store",
        "x-content-type-options":"nosniff",
        "referrer-policy":"no-referrer"
      }
    });
  },
  async scheduled(){
    throw new Error("Disabled: private storage, independent witness and deletion policy not verified");
  }
};
