/* Common Subjects v0.4 -- pure, offline-testable planning and review logic. */
(function(root,factory){
  const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StarestoDailyEngine=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='psd-staresto-v04',TYPES=['vocab','grammar','reading','completion'];
function assert(cond,msg){if(!cond)throw Error(msg)}
function dayAdd(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function weekday(date){return new Date(date+'T00:00:00Z').getUTCDay()}
function taipeiDate(now=new Date()){const o={};new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).forEach(p=>o[p.type]=p.value);return o.year+'-'+o.month+'-'+o.day}
function defaultState(){return {schema:VERSION,days:{},progress:{},cards:{},completedDays:{}}}
function normalize(s){if(!s||typeof s!=='object'||s.schema!==VERSION||Array.isArray(s))return defaultState();return {schema:VERSION,days:s.days&&typeof s.days==='object'&&!Array.isArray(s.days)?s.days:{},progress:s.progress&&typeof s.progress==='object'&&!Array.isArray(s.progress)?s.progress:{},cards:s.cards&&typeof s.cards==='object'&&!Array.isArray(s.cards)?s.cards:{},completedDays:s.completedDays&&typeof s.completedDays==='object'&&!Array.isArray(s.completedDays)?s.completedDays:{}}}
function createBank(blobs){
 const questions=[],passages={},keys=new Set();
 for(const b of blobs){
  assert(b&&b.meta&&Array.isArray(b.questions),'Missing curated source');
  Object.assign(passages,b.passages||{});
  for(const q of b.questions){
   assert(q&&typeof q.id==='string'&&!keys.has(q.id),'Invalid/duplicate question ID: '+q?.id);
   assert(TYPES.includes(q.kind)&&q.exam==='學測'&&q.prompt&&q.options&&q.options[q.answer],'Invalid official question: '+q.id);
   assert(Object.keys(q.options).length===(q.kind==='completion'?10:4),'Unexpected answer count '+q.id);
   assert(/^https:\/\/staresto-create\.github\.io\/[a-zA-Z0-9/_.-]+\/?$/.test(q.sourceUrl),'Invalid source URL '+q.id);
   if(q.passageKey)assert(passages[q.passageKey]&&passages[q.passageKey].text,'Missing passage '+q.id);
   keys.add(q.id);questions.push(q);
  }
 }
 const byId=Object.fromEntries(questions.map(q=>[q.id,q])),kinds=Object.fromEntries(TYPES.map(t=>[t,questions.filter(q=>q.kind===t)]));
 return {questions,passages,byId,kinds};
}
function attempts(state,id){const a=state.progress[id]?.attempts;return Array.isArray(a)?a:[]}
function recent(state,id){const a=attempts(state,id);return a[a.length-1]||null}
function dueItems(bank,state,date,kind){
 return bank.questions.filter(q=>(!kind||q.kind===kind)&&attempts(state,q.id).length&&state.progress[q.id]?.due<=date).sort((a,b)=>String(state.progress[a.id].due).localeCompare(String(state.progress[b.id].due))||a.id.localeCompare(b.id));
}
function stage(state){
 const entries=Object.values(state.progress).filter(x=>Array.isArray(x.attempts)&&x.attempts.length);
 const total=entries.length,correct=entries.filter(x=>x.attempts[0].correct).length;
 const active=new Set(entries.flatMap(x=>x.attempts.map(a=>a.date)).filter(Boolean)).size;
 const recentEntries=entries.flatMap(x=>x.attempts).slice(-60),ratio=recentEntries.length?recentEntries.filter(x=>x.correct).length/recentEntries.length:0;
 const level=total>=120&&active>=18&&ratio>=.8?3:total>=45&&active>=9&&ratio>=.7?2:1;
 return {level,attempted:total,activeDays:active,firstAccuracy:total?Math.round(100*correct/total):null,recentAccuracy:recentEntries.length?Math.round(100*ratio):null};
}
function pseudoHash(s){let x=2166136261;for(let i=0;i<s.length;i++)x=Math.imul(x^s.charCodeAt(i),16777619);return x>>>0}
function desirable(q,level){
 const rate=q.accuracyRate;
 const n=typeof rate==='number'?(rate>=67?1:rate>=40?2:3):(q.level<=2?1:q.level<=4?2:3);
 return Math.abs(n-level);
}
function stablePick(items,n,date,level,state,excluded){
 return items.filter(q=>!excluded.has(q.id)).sort((a,b)=>{
 const ma=attempts(state,a.id).length?1:0,mb=attempts(state,b.id).length?1:0;
 return ma-mb||desirable(a,level)-desirable(b,level)||pseudoHash(date+a.id)-pseudoHash(date+b.id)||a.id.localeCompare(b.id);
 }).slice(0,n).map(q=>q.id);
}
function pickGroup(bank,type,date,level,state,excluded,previous=[]){
 const groups=new Map();
 for(const q of bank.kinds[type]){
  if(excluded.has(q.id))continue;
  const id=q.group||q.id;if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(q);
 }
 const candidates=[...groups.entries()].filter(([id,a])=>a.length>=(type==='completion'?8:type==='reading'?3:4));
 if(!candidates.length)return [];
 candidates.sort(([id,a],[ib,b])=>{
  const prior=previous.includes(id)?1:0,priorb=previous.includes(ib)?1:0;
  const studied=a.filter(q=>attempts(state,q.id).length).length/a.length;
  const studiedb=b.filter(q=>attempts(state,q.id).length).length/b.length;
  const diff=a.reduce((t,q)=>t+desirable(q,level),0)/a.length;
  const diffb=b.reduce((t,q)=>t+desirable(q,level),0)/b.length;
  return prior-priorb||studied-studiedb||diff-diffb||pseudoHash(date+id)-pseudoHash(date+ib);
 });
 const group=candidates[0][1].sort((a,b)=>(a.number||0)-(b.number||0));
 return group.map(q=>q.id);
}
function task(key,title,kind,ids,minutes){return {key,title,kind,ids,minutes}}
function buildDay(bank,state,date){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z')),'Invalid date');
 const existing=state.days[date];if(existing&&Array.isArray(existing.tasks))return existing;
 const lv=stage(state).level,w=weekday(date),excluded=new Set(),tasks=[];
 const usedGroups=Object.values(state.days).flatMap(d=>(d.tasks||[]).map(t=>t.group).filter(Boolean)).slice(-30);
 function add(key,title,kind,ids,minutes){ids.forEach(id=>excluded.add(id));if(ids.length)tasks.push(task(key,title,kind,ids,minutes))}
 function vocab(n){return stablePick(bank.kinds.vocab,n,date,lv,state,excluded)}
 function group(type){return pickGroup(bank,type,date,lv,state,excluded,usedGroups)}
 function cards(n){const prefer=bank.kinds.vocab.filter(q=>attempts(state,q.id).length>0);
 const pool=prefer.length>=n?prefer:bank.kinds.vocab;
 return stablePick(pool,n,date+'-card',lv,state,new Set()).slice(0,n)}
 if(w===1){add('vocab','歷屆學測單字 · 8題','quiz',vocab(8),10);add('cards','單字記憶卡 · 5個','cards',cards(5),5)}
 if(w===2){add('grammar','學測克漏字 · 1組','quiz',group('grammar'),20)}
 if(w===3){add('cards','字彙記憶卡 · 10個','cards',cards(10),10);add('vocab','易混淆單字 · 4題','quiz',vocab(4),8)}
 if(w===4){add('reading','學測閱讀理解 · 1篇','quiz',group('reading'),25)}
 if(w===5){add('grammar','文法補強 · 克漏字1組','quiz',group('grammar'),20)}
 if(w===6){add('completion','學測文意選填 · 1篇','quiz',group('completion'),25)}
 if(w===0){const due=dueItems(bank,state,date).slice(0,10).map(q=>q.id);
 const extras=due.length<5?vocab(5-due.length):[];
 add('review','本週錯題複習 · 最多10題','quiz',due.concat(extras),15);
 add('cards','本週單字回顧 · 5個','cards',cards(5),7)}
 const entry={date,weekday:w,stage:lv,tasks,created:new Date().toISOString()};
 state.days[date]=entry;return entry;
}
function recordAttempt(state,id,choice,answer,date){
 assert(typeof id==='string'&&/^[A-J]$/.test(choice)&&/^[A-J]$/.test(answer),'Invalid answer');
 const p=state.progress[id]||{attempts:[],streak:0,due:date};
 const ok=choice===answer,attempt={date,choice,correct:ok,at:new Date().toISOString()};
 p.attempts=[...(Array.isArray(p.attempts)?p.attempts:[]),attempt].slice(-150);
 p.streak=ok?(p.streak||0)+1:0;
 p.due=dayAdd(date,ok?(p.streak===1?3:p.streak===2?7:14):1);
 state.progress[id]=p;return attempt;
}
function recordCard(state,id,knew,date){
 const p=state.cards[id]||{attempts:[],streak:0,due:date};
 p.attempts=[...(Array.isArray(p.attempts)?p.attempts:[]),{date,knew:!!knew,at:new Date().toISOString()}].slice(-150);
 p.streak=knew?(p.streak||0)+1:0;p.due=dayAdd(date,knew?Math.min(14,Math.pow(2,p.streak)):1);
 state.cards[id]=p;
}
function completed(state,day,task){
 if(task.kind==='cards')return task.ids.filter(id=>(state.cards[id]?.attempts||[]).some(a=>a.date===day)).length;
 return task.ids.filter(id=>attempts(state,id).some(a=>a.date===day)).length;
}
function unfinished(state,date){return Object.entries(state.days).filter(([day])=>day<date&&day>=dayAdd(date,-14)).sort((a,b)=>b[0].localeCompare(a[0])).flatMap(([day,entry])=>(entry.tasks||[]).filter(t=>completed(state,day,t)<t.ids.length).map(t=>({date:day,task:t}))).slice(0,8)}
return {VERSION,TYPES,taipeiDate,dayAdd,weekday,defaultState,normalize,createBank,attempts,recent,dueItems,stage,buildDay,recordAttempt,recordCard,completed,unfinished};
});
