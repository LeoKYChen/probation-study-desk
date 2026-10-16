/* GitHub external English resource integration regression. Run with Node >=22. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'staresto-integration.js'),'utf8');
const records=fs.readFileSync(path.join(root,'staresto-resources.js'),'utf8');
const english=fs.readFileSync(path.join(root,'english-v02.js'),'utf8');
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
assert.equal(inline.length,1,'one inline script');
for(const [i,c] of [js,records,english,inline[0]].entries())new vm.Script(c,{filename:'script-'+i});
assert.ok(html.includes('./staresto-integration.js'),'integration loaded');
assert.ok(html.includes('./staresto-resources.js'),'data loaded');
assert.ok(html.includes('externalRecordsStat'),'record summary exists');
const hiddenStart=html.indexOf('<div id="legacy80Practice" hidden aria-hidden="true">');
const starestoExternal=html.indexOf('<section class="panel" id="starestoPanel"');
const nextPanel=html.indexOf('<section id="panelRecords"');
assert.ok(hiddenStart>0 && starestoExternal>hiddenStart && nextPanel>starestoExternal,
  'legacy practice hidden before visible Staresto links and records');
const legacyOnly=html.slice(hiddenStart,starestoExternal);
for(const id of ['startDaily','answered','questionPick','options','nextQuestion','retryQuestion'])
  assert.ok(legacyOnly.includes('id="'+id+'"'),'legacy UI still in DOM: '+id);
assert.ok(legacyOnly.includes('</div>\n'),'hidden wrapper closed');
assert.ok(!legacyOnly.includes('id="starestoPanel"'),'Staresto resources outside hidden wrapper');
assert.ok(html.includes('href="./daily/"'),'v0.4 daily Staresto remains visible');
assert.ok(html.includes('<section id="panelEssay"'),'essay module remains present');
class Node{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.children=[];this.options=[];this.handlers={};this.style={};this.className='';this.hidden=false;this.disabled=false;this.classList={toggle(){},add(){}};}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 fire(name){for(const fn of this.handlers[name]||[])fn.call(this,{target:this});}
 click(){this.fire('click');}
 add(opt){this.options.push(opt);if(this.options.length===1)this.value=opt.value;}
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=xs;this.options=[];this.value='';}
 select(){}remove(){}scrollIntoView(){}
}
const KEY='psd-common-subjects-v1';
function boot(saved={}){
 const nodes={};const get=id=>nodes[id]??(nodes[id]=new Node(id));
 get('mode').value='sentence';get('filter').value='all';get('resourceFilter').value='all';
 const doc={getElementById:get,createElement:t=>new Node(t),body:new Node('body'),addEventListener(){},execCommand:()=>true};
 const store={getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v};
 const Option=function(text,value){return {text,value};};
 const ctx={document:doc,window:{addEventListener(){}},localStorage:store,Option,navigator:{},Date,Intl,Array,Object,Number,String,JSON,Math,Set,RegExp,
 setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},confirm:()=>true,
 URL:{createObjectURL:()=> '#',revokeObjectURL(){}},Blob:class{},FileReader:class{}};
 vm.createContext(ctx);
 for(const text of [english,records,inline[0],js])vm.runInContext(text,ctx);
 return {get,saved,ctx};
}
const a=boot(),g=a.get;
g('tabEnglish').click();
assert.equal(g('resourceCards').children.length,9,'nine author links');
const c=g('resourceCards').children[0];
const buttons=c.children.find(x=>x.className==='ext-actions').children;
assert.ok(buttons[0].href.startsWith('https://staresto-create.github.io/'),'only source site');
assert.equal(buttons[0].target,'_blank','external site opens new tab');
assert.equal(buttons[0].rel,'noopener noreferrer','secure links');
buttons[1].click();
let data=JSON.parse(a.saved[KEY]);
assert.equal(data.externalPractice['vocab-gsat'].length,1);
g('tabRecords').click();
assert.match(g('externalRecordsStat').textContent,/1 次/);
const reload=boot(a.saved);
reload.get('tabEnglish').click();
assert.match(reload.get('resourceCount').textContent,/1 次/,'reload retains manual count');
const old=boot({[KEY]:JSON.stringify({schema:KEY,drafts:{'sentence:0':{text:'舊草稿',versions:[],feedback:'',self:{},nextAction:'',updatedAt:''}},english:{e0:{choice:1,correct:false,at:'2026-10-01'}},englishHistory:{},dailySelections:{}})});
old.get('tabEnglish').click();
assert.match(old.get('resourceRecommendation').textContent,/單字/);
assert.equal(old.get('essayText').value,'舊草稿','old data still readable');
for(const link of g('resourceCards').children){const actions=link.children.find(x=>x.className==='ext-actions');assert.ok(actions.children[0].href.startsWith('https://staresto-create.github.io/'));}
console.log('PASS Staresto: 9 attribution links, safe target, manual record, reload, old data, weakness suggestion');
