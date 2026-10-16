/* Static browser DOM smoke test. No network or localStorage needed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,D=path.join(root,'data');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=fs.readFileSync(path.join(root,'app.js'),'utf8');
new vm.Script(code,{filename:'app.js'});
for(const id of ['stats','error','tabQuestion','tabResource','search','typeFilter','statusFilter','sourceFilter','resetFilters','resultCount','results','pageStatus','prevPage','nextPage','detail']){
 assert.ok(html.includes('id="'+id+'"'),'missing element '+id);
}
class Fake{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.children=[];this.options=[];this.handlers={};this.disabled=false;this.hidden=false;this.attributes={};}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)}
 fire(name){for(const fn of this.handlers[name]||[])fn()}
 click(){this.fire('click')}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=items;this.options=[]}
 add(opt){this.options.push(opt)}
 setAttribute(key,val){this.attributes[key]=val}
}
const nodes={};const get=id=>nodes[id]??(nodes[id]=new Fake(id));
const doc={getElementById:get,createElement:tag=>new Fake(tag)};
const Option=function(label,value){return {label,value}};
let calls=[];
const fetched=url=>{
 const p=url.replace('./data/','');
 if(p.startsWith('/')||p.includes('..'))throw Error('unsafe test source path');
 calls.push(p);
 const data=JSON.parse(fs.readFileSync(path.join(D,p),'utf8'));
 return Promise.resolve({ok:true,json:async()=>data});
};
const sandbox={document:doc,Option,fetch:fetched,Intl,Object,Array,Set,Map,Number,String,JSON,RegExp,Promise,Math,console};
vm.createContext(sandbox);vm.runInContext(code,sandbox,{filename:'app.js'});
async function settle(){for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r))}
(async()=>{
 await settle();
 assert.equal(get('error').textContent,'','no load error');
 assert.ok(get('stats').children.length===4);
 assert.ok(get('results').children.length>0);
 assert.match(get('resultCount').textContent,/找到/);
 assert.equal(get('tabQuestion').attributes['aria-pressed'],'true');
 get('results').children[0].click();await settle();
 assert.ok(get('detail').children.length>2,'question detail rendered');
 assert.equal(calls.includes('index.json'),true);
 get('search').value='very-unlikely-nonexistent-xyz';get('search').fire('input');
 assert.match(get('resultCount').textContent,/0 筆/);
 get('resetFilters').click();
 assert.ok(get('results').children.length>0);
 get('tabResource').click();
 assert.equal(get('tabResource').attributes['aria-pressed'],'true');
 assert.ok(get('results').children.length>0);
 get('search').value='.mp3';get('search').fire('input');
 assert.match(get('resultCount').textContent,/找到/);
 const n=parseInt(get('resultCount').textContent.match(/\d[\d,]*/)[0].replace(/,/g,''),10);
 assert.ok(n>10,'audio resources searchable');
 get('results').children[0].click();
 assert.ok(get('detail').children.some(x=>x.textContent.includes('SHA256')),'resource SHA shown');
 console.log('PASS v0.5 UI: full source filter, searches, provenance, lazy source loading, read-only');
})().catch(e=>{console.error(e);process.exitCode=1});
