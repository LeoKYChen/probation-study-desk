"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {ENDPOINTS,withinOfficialHours,parseListPayload,makeClient,makeHttpTransport}=
  require("./judicial-api-client.cjs");
const JID="TEST_JID_SYNTHETIC_DO_NOT_USE";
const DOC={JID,JYEAR:"999",JCASE:"測試",JNO:"001",JDATE:"20990101",JTITLE:"合成測試裁判",
  JFULLX:{JFULLTYPE:"text",JFULLCONTENT:"fake case fixture only",JFULLPDF:""},ATTACHMENTS:[]};
const openDate=new Date("2026-10-14T18:30:00Z"); // 02:30 Asia/Taipei
const closedDate=new Date("2026-10-15T03:30:00Z"); // 11:30 Asia/Taipei
function mockClient(){
 const calls=[];
 const transport=async ({url,body})=>{
   calls.push({url,body});
   if(url===ENDPOINTS.Auth)return {Token:"FAKE_TOKEN_SYNTHETIC"};
   if(url===ENDPOINTS.JList)return [{date:"2026-10-08",list:[JID,JID]}];
   if(url===ENDPOINTS.JDoc)return DOC;
   throw Error("unsupported endpoint");
 };
 const client=makeClient({transport,user:"FAKE_USER",password:"FAKE_PASSWORD",now:()=>openDate});
 return {client,calls};
}
test("service window uses Taipei, not UTC",()=>{
 assert.equal(withinOfficialHours(openDate),true);
 assert.equal(withinOfficialHours(closedDate),false);
});
test("new client cannot be constructed without credentials",()=>{
 assert.throws(()=>makeClient({transport:async()=>null,user:"",password:""}),/Credentials missing/);
});
test("mock Auth and JList send exact official payloads",async()=>{
 const {client,calls}=mockClient();
 const changes=await client.getChanges();
 assert.deepEqual(changes,[{date:"2026-10-08",jid:JID}]);
 assert.deepEqual(calls.map(x=>x.url),[ENDPOINTS.Auth,ENDPOINTS.JList]);
 assert.deepEqual(calls[0].body,{user:"FAKE_USER",password:"FAKE_PASSWORD"});
 assert.deepEqual(calls[1].body,{token:"FAKE_TOKEN_SYNTHETIC"});
});
test("reuses synthetic token for mock JDoc (never hits real API)",async()=>{
 const {client,calls}=mockClient();
 await client.getChanges();
 const p=await client.getJudgment(JID);
 assert.equal(p.kind,"upsert");
 assert.deepEqual(calls.map(x=>x.url),[ENDPOINTS.Auth,ENDPOINTS.JList,ENDPOINTS.JDoc]);
 assert.deepEqual(calls[2].body,{token:"FAKE_TOKEN_SYNTHETIC",j:JID});
 assert.equal(p.record.fullText,"fake case fixture only");
});
test("official JList error object fails without partial results",()=>{
 assert.throws(()=>parseListPayload({error:"驗證失敗"}),/rejected/);
});
test("malformed JList and wrong jid types rejected",()=>{
 assert.throws(()=>parseListPayload({list:[]}),/Unexpected JList/);
 assert.throws(()=>parseListPayload([{date:"2026-10-08",list:[3]}]),/Invalid JID/);
});
test("mock authentication errors do not continue to list/doc",async()=>{
 const calls=[];
 const client=makeClient({transport:async ({url})=>{calls.push(url);return {error:"驗證失敗"};},
   user:"test",password:"redacted",now:()=>openDate});
 await assert.rejects(client.getChanges(),/rejected/);
 assert.deepEqual(calls,[ENDPOINTS.Auth]);
});
test("outside service hours blocks mock transport completely",async()=>{
 let count=0;
 const client=makeClient({transport:async ()=>{count++;return {Token:"SYNTHETIC_TOKEN"}},
   user:"fake",password:"fake",now:()=>closedDate});
 await assert.rejects(client.getChanges(),/Outside Judicial Yuan API/);
 assert.equal(count,0);
});
test("live transport stays disabled by default",()=>{
 assert.throws(()=>makeHttpTransport(),/disabled pending/);
});
test("live transport requires explicit opt-in AND env flag",()=>{
 const prev=process.env.JUDICIAL_API_LIVE_ENABLED;
 process.env.JUDICIAL_API_LIVE_ENABLED="false";
 try{assert.throws(()=>makeHttpTransport({enabled:true}),/disabled pending/);}
 finally{
   if(prev===undefined)delete process.env.JUDICIAL_API_LIVE_ENABLED;
   else process.env.JUDICIAL_API_LIVE_ENABLED=prev;
 }
});
test("mock JDoc removed response returns withdraw action",async()=>{
 const client=makeClient({transport:async ({url})=>{
   if(url===ENDPOINTS.Auth)return {Token:"TEST_TOKEN_SYNTHETIC"};
   return {error:"查無資料，本裁判可能未公開或已從系統移除，若您曾經下載過本裁判，亦請您將其移除！謝謝！"};
 },user:"fake",password:"fake",now:()=>openDate});
 const action=await client.getJudgment(JID);
 assert.equal(action.kind,"withdraw");
 assert.equal(action.publishable,false);
});
