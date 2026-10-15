"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const workerUrl=pathToFileURL(path.join(__dirname,"private-worker.mjs")).href;
test("all public HTTP methods and paths remain closed",async()=>{
  const worker=(await import(workerUrl)).default;
  for(const method of ["GET","POST","PUT","DELETE","PATCH"]){
    for(const url of ["https://example.test/","https://example.test/api/judgments","https://example.test/admin/restore"]){
      const result=await worker.fetch(new Request(url,{method}));
      assert.equal(result.status,404);
      assert.equal(result.headers.get("cache-control"),"no-store");
      assert.equal(await result.text(),"Not Found");
    }
  }
});
test("scheduled entrypoint fails closed until complete policy authorization",async()=>{
  const worker=(await import(workerUrl)).default;
  await assert.rejects(worker.scheduled({},{},{}),/Disabled/);
});
