// Google Drive REST requests are mocked; no credentials or network calls.
'use strict';
const assert=require('node:assert/strict');
require('./drive-transport.js');
const api=globalThis.PSDDriveTransport;
const TOKEN='synthetic_access_token_012345678901234567890';
const calls=[];
const json=body=>({ok:true,status:200,async json(){return body},
 async text(){return JSON.stringify(body)},headers:{get(){return null}}});
async function mock(url,options){
 const {method='GET',headers={},body}=options||{};
 assert.equal(headers.Authorization,'Bearer '+TOKEN);
 const u=new URL(url);
 calls.push({url,method});
 if(u.pathname==='/drive/v3/files'&&method==='GET'){
  const query=u.searchParams.get('q');
  assert(query?.includes('trashed = false'));
  if(query.includes('mimeType'))return json({files:[],nextPageToken:null});
  return json({files:[
   {id:'mock_file_12345678',name:'psd-sync-v1-example.json',mimeType:'application/json',createdTime:'2026-10-28T00:00:00Z'},
   {id:'mock_other_12345678',name:'unrelated.txt',mimeType:'text/plain'}
  ],nextPageToken:null});
 }
 if(u.pathname==='/drive/v3/files'&&method==='POST'){
  assert.deepEqual(JSON.parse(body),{name:api.FOLDER,mimeType:'application/vnd.google-apps.folder'});
  return json({id:'mock_folder_12345678',name:api.FOLDER});
 }
 if(u.pathname.endsWith('/mock_file_12345678')&&u.searchParams.get('alt')==='media')
  return json({format:'psd-drive-sync-snapshot-v1'});
 if(u.pathname==='/upload/drive/v3/files'&&method==='POST'){
  assert.equal(u.searchParams.get('uploadType'),'multipart');
  assert(headers['Content-Type'].startsWith('multipart/related;'));
  const text=await body.text();
  assert(text.includes('"parents":["mock_folder_12345678"]'));
  assert(text.includes('"format":"psd-drive-sync-snapshot-v1"'));
  assert(!text.includes(TOKEN),'token must never be embedded in upload payload');
  return json({id:'mock_uploaded_12345678',name:'psd-sync-v1-new.json'});
 }
 throw Error('Unexpected Drive request '+method+' '+url);
}
async function run(){
 const d=api.create({getToken:()=>TOKEN,createId:()=> 'mock-random-id',fetcher:mock});
 const folder=await d.ensureFolder();
 assert.equal(folder,'mock_folder_12345678');
 const list=await d.listSnapshots(folder);
 assert.equal(list.length,1);
 assert.equal(list[0].id,'mock_file_12345678');
 const data=await d.readSnapshot(list[0].id);
 assert.equal(data.format,'psd-drive-sync-snapshot-v1');
 const uploaded=await d.writeSnapshot(folder,{format:'psd-drive-sync-snapshot-v1',
  schemaVersion:1,id:'synthetic-snapshot',createdAt:'2026-10-28T01:00:00Z',backup:{data:{}}});
 assert.equal(uploaded.id,'mock_uploaded_12345678');
 assert.equal(calls.length,4);
 console.log('PASS Drive REST transport: folder creation, scope-limited listing, reading and append-only upload');
}
run().catch(e=>{console.error(e);process.exitCode=1});
