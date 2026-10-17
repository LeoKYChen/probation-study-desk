/* v0.6 lightweight link-only planner: no third-party question content or legacy storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.StarestoLinkCoach=api;
})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const STORAGE_KEY="psd-staresto-link-coach-v06";
const SOURCES={
  vocab:{title:"學測單字",url:"https://staresto-create.github.io/JCEE-vocab-questions/gsat/"},
  grammar:{title:"學測文法與克漏字",url:"https://staresto-create.github.io/grammar-cloze-test/"},
  reading:{title:"閱讀理解",url:"https://staresto-create.github.io/reading-comprehension/"},
  completion:{title:"文意選填",url:"https://staresto-create.github.io/passage-completion/"}
};
function today(now=new Date()){
  const p={};new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).forEach(x=>p[x.type]=x.value);
  return p.year+"-"+p.month+"-"+p.day;
}
function weekday(date){return new Date(date+"T00:00:00Z").getUTCDay()}
function createState(){return {schema:STORAGE_KEY,days:{},completed:{},excluded:{}}}
function plain(x){return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}
function normalize(value){
  if(!value||value.schema!==STORAGE_KEY)return createState();
  return {schema:STORAGE_KEY,days:plain(value.days),completed:plain(value.completed),excluded:plain(value.excluded)};
}
const units=[];
for(let year=115;year>=83;year--){
  for(const [a,b] of [[1,5],[6,10]]){
    units.push({id:"gsat-vocab-"+year+"-"+a+"-"+b,type:"vocab",year,title:year+"年學測單字｜第"+a+"～"+b+"題",instructions:"從原站「歷屆試題」選擇"+year+"年學測，依序練習第"+a+"～"+b+"題；挑出至少6個不熟的字詞寫進筆記。請勿用隨機出題。",count:5});
  }
  if(year>=100)units.push({id:"gsat-grammar-"+year+"-1",type:"grammar",year,title:year+"年學測克漏字｜第一組",instructions:"在原站選擇"+year+"年學測的第一組克漏字，完整讀完題組並查看解析。若該年沒有對應題組，使用「原站找不到，換一份」。",count:null});
  if(year>=102)units.push({id:"gsat-reading-"+year+"-1",type:"reading",year,title:year+"年閱讀理解｜第一篇",instructions:"請在原站選擇"+year+"年學測的第一篇閱讀；以文章為單位完成，避免只做片段。若原站不能精確指定這個範圍，請使用「換一份」，勿誤標完成。",count:null});
  if(year>=102)units.push({id:"gsat-completion-"+year+"-1",type:"completion",year,title:year+"年文意選填｜第一篇",instructions:"請在原站選擇"+year+"年學測的第一篇文意選填，整篇完成後才記錄。若該年沒有相應題組請改排。",count:null});
}
const byId=Object.fromEntries(units.map(x=>[x.id,x]));
function mainType(state,date){
  const day=weekday(date);
  if(day===1||day===3||day===0)return null;
  if(day===2)return "grammar";
  if(day===4)return "reading";
  if(day===6)return "completion";
  const scored=Object.values(state.completed).filter(x=>x&&x.correct!==null&&Number.isInteger(x.correct)&&Number.isInteger(x.total)&&x.total>0&&x.type!=="vocab");
  if(!scored.length)return "grammar";
  return [...new Set(["grammar","reading","completion"])].sort((a,b)=>{
    const avg=type=>{const xs=scored.filter(x=>x.type===type).slice(-6);return xs.length?xs.reduce((t,x)=>t+x.correct/x.total,0)/xs.length:1};
    return avg(a)-avg(b);
  })[0];
}
function unavailableIds(state){
  const used=new Set(Object.keys(state.completed).concat(Object.keys(state.excluded)));
  Object.values(state.days).forEach(day=>(day.tasks||[]).forEach(task=>used.add(task.id)));
  return used;
}
function pick(type,used){return units.find(x=>x.type===type&&!used.has(x.id))||null}
function planDay(state,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z")))throw Error("日期無效");
  if(state.days[date])return state.days[date];
  const used=unavailableIds(state),tasks=[];
  const vocab=pick("vocab",used);if(vocab){tasks.push({id:vocab.id,type:vocab.type});used.add(vocab.id)}
  const type=mainType(state,date);
  if(type){const second=pick(type,used);if(second)tasks.push({id:second.id,type:second.type})}
  const day={date,tasks,createdAt:new Date().toISOString()};
  state.days[date]=day;return day;
}
function markDone(state,date,id,score,at=new Date().toISOString()){
  const task=(state.days[date]?.tasks||[]).find(x=>x.id===id);
  if(!task||!byId[id]||state.completed[id])throw Error("任務不存在或已登記");
  let correct=null,total=null;
  if(score!==null&&score!==undefined&&score!==""){
    correct=Number(score.correct);total=Number(score.total);
    if(!Number.isInteger(correct)||!Number.isInteger(total)||total<1||correct<0||correct>total||total>100)throw Error("請輸入有效的答對題數與總題數");
  }
  state.completed[id]={id,date,type:task.type,correct,total,at};
  return state.completed[id];
}
function replacePreviouslyStudied(state,date,id,at=new Date().toISOString()){
  const day=state.days[date],idx=day?.tasks.findIndex(x=>x.id===id)??-1;
  if(idx<0||state.completed[id])throw Error("不能替換已完成的任務");
  state.excluded[id]={id,reason:"previously-studied-or-unavailable",at};
  const next=pick(day.tasks[idx].type,unavailableIds(state));
  if(next)day.tasks[idx]={id:next.id,type:next.type};
  else day.tasks.splice(idx,1);
  return next;
}
function recent(state){return Object.values(state.completed).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
function getUnit(id){return byId[id]||null}
return {STORAGE_KEY,SOURCES,today,weekday,createState,normalize,units,getUnit,planDay,markDone,replacePreviouslyStudied,recent};
});
