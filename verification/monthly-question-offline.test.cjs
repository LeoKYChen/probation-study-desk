'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),legacy=JSON.parse(fs.readFileSync(path.join(root,'daily-simulation/questions.json'),'utf8'));
function localZip({omit}={}){
 const href=new URL('file://'+path.join(root,'daily-simulation/index.html')).href;
 const loaded=[];
 const document={
  readyState:'loading',addEventListener:()=>{},
  createElement:()=>({remove:()=>{}}),
  head:{appendChild:script=>{
   const local=new URL(script.src);
   const file=decodeURIComponent(local.pathname);
   loaded.push(path.relative(root,file));
   if(omit&&file.includes(omit)){script.onerror();return;}
   vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
   script.onload();
  }}
 };
 const window={fetch:()=>Promise.reject(new Error('native file fetch must not be used'))};
 const ctx={window,document,location:{protocol:'file:',href,pathname:new URL(href).pathname},
   URL,Response,TextEncoder,Uint8Array,console};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'file-compat.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'daily-simulation/question-storage.js'),'utf8'),ctx);
 return {window,loaded};
}
test('file:// ZIP loads all 245 questions from manifest + five generated shard scripts',async()=>{
 const env=localZip();
 const data=await env.window.QuestionStorage.load(path=>env.window.fetch(path));
 assert.equal(data.count,245);
 const oldIds=new Set(legacy.questions.map(q=>q.id)),current=new Set(data.questions.map(q=>q.id));
 assert.deepEqual(current,oldIds);
 assert.equal(env.loaded.filter(f=>f.startsWith('file-data/question-shards/')).length,5);
 assert(env.loaded.includes('file-data/questions-monthly.generated.js'));
});
test('missing archived question file in ZIP fails without returning truncated or fake questions',async()=>{
 const env=localZip({omit:'6bdd4959d83b04d4aa23a8d6e537c3a30f08408d2958a1386647fc5a8b5b8fcb'});
 await assert.rejects(env.window.QuestionStorage.load(path=>env.window.fetch(path)),/缺少月份題庫檔/);
});
test('ZIP loader supports isolated historical month without reading the current archive',async()=>{
 const env=localZip();
 const data=await env.window.QuestionStorage.load(path=>env.window.fetch(path),{month:'2026-09'});
 assert.equal(data.count,6);
 assert(data.questions.every(q=>q.date.startsWith('2026-09')));
 assert.equal(env.loaded.filter(f=>f.startsWith('file-data/question-shards/')).length,1);
});
