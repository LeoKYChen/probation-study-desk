/* Regression tests for the standalone common-subjects practice module.
 * Run: node common-subjects/test-v02.cjs
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const extra=fs.readFileSync(path.join(root,'english-v02.js'),'utf8');
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
assert.equal(inline.length,1,'one inline script');
new vm.Script(extra,{filename:'english-v02.js'});
new vm.Script(inline[0],{filename:'index.html:inline.js'});
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'unique IDs');
for(const id of new Set([...inline[0].matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1])))
  assert.ok(ids.includes(id),'missing element: '+id);
class Node{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.hidden=false;this.children=[];this.options=[];this.handlers={};this.style={};this.disabled=false;this.classList={add(){},toggle(){}};this.files=null;}
 addEventListener(name,fn){this.handlers[name]=fn;}
 fire(name){return this.handlers[name]?.call(this,{target:this});}
 click(){return this.fire('click');}
 add(opt){this.options.push(opt);if(this.options.length===1)this.value=opt.value;}
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=xs;this.options=[];this.value='';this.textContent='';}
 remove(){}select(){}scrollIntoView(){}
}
const KEY='psd-common-subjects-v1';
const confirmQueue=[];

function make(db={}){
 const nodes={};const get=id=>nodes[id]??(nodes[id]=new Node(id));get('mode').value='sentence';get('filter').value='all';
 const doc={getElementById:get,createElement:t=>new Node(t),body:new Node('body'),addEventListener(){},execCommand:()=>true};
 const localStorage={getItem:k=>db[k]??null,setItem:(k,v)=>db[k]=v};
 const win={addEventListener(){}};
 const Opt=function(label,value){return {text:label,value}};
 const ctx={document:doc,window:win,localStorage,Option:Opt,navigator:{},Intl,Date,Array,Object,Set,Math,Number,String,JSON,RegExp,
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},confirm:()=>confirmQueue.length?confirmQueue.shift():true,
  URL:{createObjectURL:()=> '#',revokeObjectURL(){}},Blob:class {},FileReader:class{}};
 vm.createContext(ctx);vm.runInContext(extra,ctx,{filename:'english-v02.js'});vm.runInContext(inline[0],ctx,{filename:'index.html:inline.js'});
 return {get,db,ctx};
}
const a=make(),g=a.get;
assert.equal(g('prompt').options.length,12);
assert.equal(g('rubrics').children.length,4);
g('essayText').value='法律系畢業後，我轉入陌生的領域。';g('essayText').fire('input');g('saveVersion').click();
let data=JSON.parse(a.db[KEY]);assert.equal(data.drafts['sentence:0'].versions.length,1);
g('essayText').value='法律系畢業後，我投入網路領域，在反覆嘗試與修正中獲得成就感。';
g('essayText').fire('input');g('compareRefresh').click();
assert.match(g('compareOriginal').textContent,/轉入陌生的領域/);
assert.match(g('compareCurrent').textContent,/反覆嘗試/);
g('saveVersion').click();
data=JSON.parse(a.db[KEY]);assert.equal(data.drafts['sentence:0'].versions.length,2);
g('tabEnglish').click();
assert.equal(g('questionPick').options.length,80);
assert.equal(g('options').children.length,4);
g('options').children[0].click();
data=JSON.parse(a.db[KEY]);assert.equal(data.englishHistory.e0[0].correct,false);
g('retryQuestion').click();data=JSON.parse(a.db[KEY]);
assert.equal(data.english.e0,undefined);
assert.equal(data.englishHistory.e0.length,1);
g('options').children[1].click();data=JSON.parse(a.db[KEY]);
assert.equal(data.english.e0.correct,true);
assert.equal(data.englishHistory.e0.length,2);
g('tabRecords').click();
assert.equal(g('englishStat').textContent,'0%','first-attempt score must not inflate');
g('tabEnglish').click();g('startDaily').click();
assert.equal(g('questionPick').options.length,5);
const daily=g('questionPick').options.map(x=>x.value);
const refreshed=make(a.db);
refreshed.get('tabEnglish').click();
refreshed.get('filter').value='daily';refreshed.get('filter').fire('change');
assert.deepEqual(refreshed.get('questionPick').options.map(x=>x.value),daily,'daily selections stable after reload');
assert.match(refreshed.get('essayText').value,/反覆嘗試/);
refreshed.get('filter').value='cloze';refreshed.get('filter').fire('change');
assert.equal(refreshed.get('questionPick').options.length,10);
const previous=make({[KEY]:JSON.stringify({schema:'psd-common-subjects-v1',drafts:{'sentence:0':{text:'舊版草稿',versions:[],feedback:'',self:{},nextAction:'',updatedAt:''}},english:{e0:{choice:0,correct:false,at:'2026-10-01'}}})});
previous.get('tabRecords').click();assert.equal(previous.get('englishStat').textContent,'0%');
assert.equal(previous.get('essayText').value,'舊版草稿');
const many=make();many.get('essayText').value='這是最初版本';many.get('essayText').fire('input');many.get('saveVersion').click();
for(let n=0;n<44;n++){many.get('essayText').value='修訂第'+n+'次';many.get('essayText').fire('input');many.get('saveVersion').click();}
const saved=JSON.parse(many.db[KEY]).drafts['sentence:0'].versions;
assert.equal(saved.length,40,'cap essay history');
assert.equal(saved[0].text,'這是最初版本','preserve original despite version cap');
// Independent two-step reset of essay and legacy 80-question progress, without touching v0.4.
const SEPARATE='psd-staresto-daily-v04',OTHER='probation-specialty-progress';
const seeded={
 schema:KEY,
 drafts:{'sentence:0':{text:'不能遺失的作文初稿',feedback:'批改回饋',versions:[{text:'原稿',date:'2026-10-01'}],self:{expression:4},nextAction:'改進結構',updatedAt:'2026-10-01'}},
 english:{e0:{choice:1,correct:true,at:'2026-10-01'}},
 englishHistory:{e0:[{choice:0,correct:false,at:'2026-09-30'},{choice:1,correct:true,at:'2026-10-01'}]},
 dailySelections:{'2026-10-01':[1,2,3,4,5]},
 externalPractice:{'vocab-gsat':[{at:'2026-10-01',source:'external'}]}
};
const db={[KEY]:JSON.stringify(seeded),[SEPARATE]:'STARESTO-PROGRESS-MUST-SURVIVE',[OTHER]:'SPECIALTY-MUST-SURVIVE'};
const reset=make(db),rr=reset.get;reset.get('tabRecords').click();
const initialBackup=db[KEY];
confirmQueue.push(false);rr('clearEssayRecords').click();
assert.equal(db[KEY],initialBackup,'essay cancel at first confirmation');
confirmQueue.push(true,false);rr('clearEssayRecords').click();
assert.equal(db[KEY],initialBackup,'essay cancel at second confirmation');
confirmQueue.push(true,true);rr('clearEssayRecords').click();
let cleared=JSON.parse(db[KEY]);
assert.deepEqual(Object.keys(cleared.drafts),[],'clear all essay drafts and revisions');
assert.equal(rr('essayText').value,'','clear essay editor without re-saving old text');
assert.equal(rr('feedback').value,'','clear essay feedback');
assert.equal(rr('nextGoal').value,'','clear essay improvement goal');
assert.equal(rr('draftsStat').textContent,0,'essay stats refreshed');
assert.deepEqual(cleared.english,seeded.english,'original 80 answers retained after essay clear');
assert.deepEqual(cleared.englishHistory,seeded.englishHistory,'original 80 history retained');
assert.deepEqual(cleared.dailySelections,seeded.dailySelections,'original 80 schedule retained');
assert.deepEqual(cleared.externalPractice,seeded.externalPractice,'external practice retained');
assert.equal(db[SEPARATE],'STARESTO-PROGRESS-MUST-SURVIVE','Staresto module untouched');
assert.equal(db[OTHER],'SPECIALTY-MUST-SURVIVE','professional modules untouched');

// After essay reset, freshly written essay should survive an original-English reset.
rr('essayText').value='清除作文後新寫的內容';
rr('essayText').fire('input');rr('saveVersion').click();
const beforeEnglish=db[KEY];
confirmQueue.push(false);rr('clearOriginalEnglish').click();
assert.equal(db[KEY],beforeEnglish,'english cancel at first confirmation');
confirmQueue.push(true,false);rr('clearOriginalEnglish').click();
assert.equal(db[KEY],beforeEnglish,'english cancel at second confirmation');
confirmQueue.push(true,true);rr('clearOriginalEnglish').click();
cleared=JSON.parse(db[KEY]);
assert.deepEqual(cleared.english,{},'remove original 80 answers');
assert.deepEqual(cleared.englishHistory,{},'remove original 80 answer history');
assert.ok(!cleared.dailySelections['2026-10-01'],'remove previous daily selections');
assert.equal(cleared.drafts['sentence:0'].text,'清除作文後新寫的內容','essay preserved after english clear');
assert.equal(cleared.drafts['sentence:0'].versions.length,1,'essay versions preserved');
assert.equal(rr('englishStat').textContent,'—','English first-attempt stats cleared');
assert.deepEqual(cleared.externalPractice,seeded.externalPractice,'external count preserved after english clear');
assert.equal(db[SEPARATE],'STARESTO-PROGRESS-MUST-SURVIVE','Staresto remains isolated');
assert.equal(db[OTHER],'SPECIALTY-MUST-SURVIVE','other study keys remain isolated');
const restoredAfterReset=make(db);
assert.equal(restoredAfterReset.get('essayText').value,'清除作文後新寫的內容','essay saved across reload');
assert.equal(restoredAfterReset.get('answered').textContent,'0 / 80','original English progress empty on reload');

console.log('PASS common-subjects v0.2: syntax, 80 questions, draft versions, comparison, retry history, daily five, old records');
