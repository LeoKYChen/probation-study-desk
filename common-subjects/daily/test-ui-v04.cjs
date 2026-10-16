/* Headless DOM smoke test for the v0.4 static website. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=__dirname,engineSandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(dir,'engine.js'),'utf8'),engineSandbox,{filename:'engine.js'});
const Engine=engineSandbox.module.exports;
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const blobs=['vocab.json','grammar-1.json','grammar-2.json','grammar-3.json','reading.json','completion.json']
 .reduce((a,name)=>(a[name]=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),a),{});
class Fake{
 constructor(id=''){this.id=id;this.children=[];this.listeners={};this.style={};this.hidden=false;this.textContent='';this.value='';this.disabled=false;this.classList={add(){},remove(){}};this.files=[]}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
 click(){for(const fn of this.listeners.click||[])fn.call(this,{target:this})}
 append(...nodes){this.children.push(...nodes)}
 remove(){}
 replaceChildren(...nodes){this.children=nodes;this.textContent=''}
 setAttribute(name,val){this[name]=val}
 scrollIntoView(){}
}
const map={};const get=id=>map[id]??(map[id]=new Fake(id)),body=new Fake('body');
get('app').hidden=true;
const doc={getElementById:get,createElement:name=>new Fake(name),body};
const records={'psd-common-subjects-v1':'DO-NOT-TOUCH-LEGACY-DATA'};
const storage={getItem:key=>records[key]??null,setItem:(key,val)=>records[key]=val};
const confirmQueue=[];
const ctx={window:{StarestoDailyEngine:Engine},document:doc,localStorage:storage,
 fetch:async url=>({ok:!!blobs[url.replace('./','')],json:async()=>blobs[url.replace('./','')]}),
 Intl,Date,Math,Number,Object,String,JSON,Set,Array,RegExp,Promise,
 setTimeout:()=>1,clearTimeout(){},URL:{createObjectURL:()=> '#',revokeObjectURL(){}},Blob:class {},
 confirm:()=>confirmQueue.length?confirmQueue.shift():false,FileReader:class{},console};
vm.createContext(ctx);vm.runInContext(app,ctx,{filename:'app.js'});
(async()=>{
 for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 assert.equal(get('app').hidden,false,'app mounted');
 assert.equal(get('taskList').children.length,1,'Friday: grammar task');
 assert.match(get('phaseText').textContent,/668題/);
 get('taskList').children[0].click();
 assert.match(get('workTitle').textContent,/文法/);
 assert.ok(get('questionArea').children.length>1,'question rendered');
 const options=get('questionArea').children.find(x=>x.className==='options');
 assert.equal(options.children.length,4);
 options.children[0].click();
 assert.equal(get('questionArea').children.some(x=>x.className==='explanation'),true);
 const saved=JSON.parse(records['psd-staresto-daily-v04']);
 assert.ok(Object.keys(saved.progress).length===1,'answer stored');
 assert.equal(records['psd-common-subjects-v1'],'DO-NOT-TOUCH-LEGACY-DATA','legacy store isolated');
 get('next').click();
 assert.match(get('taskProgress').textContent,/2 \/ 5/);
 assert.match(get('questionSource').children[0].textContent,/staresto-create ZZSH/);
 // Clear progress is restricted to the Staresto v0.4 localStorage key.
 const savedBefore=records['psd-staresto-daily-v04'];
 confirmQueue.push(false);
 get('clearProgressBtn').click();
 assert.equal(records['psd-staresto-daily-v04'],savedBefore,'first cancellation preserves data');
 confirmQueue.push(true,false);
 get('clearProgressBtn').click();
 assert.equal(records['psd-staresto-daily-v04'],savedBefore,'second cancellation preserves data');
 confirmQueue.push(true,true);
 get('clearProgressBtn').click();
 const wiped=JSON.parse(records['psd-staresto-daily-v04']);
 assert.equal(Object.keys(wiped.progress).length,0,'progress cleared');
 assert.equal(Object.keys(wiped.cards).length,0,'flashcard history cleared');
 assert.equal(Object.keys(wiped.completedDays).length,0,'completion history cleared');
 assert.equal(Object.keys(wiped.days).length,1,'a fresh today plan remains');
 assert.equal(get('taskList').children.length,1,'today task rebuilt');
 assert.match(get('accuracyStat').textContent,/—/,'accuracy resets');
 assert.match(get('dueStat').textContent,/0題/,'review count resets');
 assert.equal(records['psd-common-subjects-v1'],'DO-NOT-TOUCH-LEGACY-DATA','legacy data preserved on reset');
 assert.equal(get('workTitle').textContent,'請先選擇任務','stale current question cleared');
 console.log('PASS v0.4 UI: fetch local snapshots, quiz interaction, explanation, provenance, isolated saves');
})().catch(e=>{console.error(e);process.exitCode=1});
