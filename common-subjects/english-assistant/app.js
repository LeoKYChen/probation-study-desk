/* Isolated Staresto resource-link study coach, phase 1. */
(function(){
"use strict";
const core=window.StarestoLinkCoach;if(!core)return;
const $=id=>document.getElementById(id),el=(tag,t,cls)=>{const x=document.createElement(tag);if(t!==undefined)x.textContent=String(t);if(cls)x.className=cls;return x};
const date=core.today(),labels=["星期日・本週複習","星期一・單字","星期二・文法","星期三・單字","星期四・閱讀","星期五・弱點補強","星期六・文意選填"];
let state=core.createState(),readOnly=false;
function notice(s){$("alert").hidden=!s;$("alert").textContent=s||""}
function load(){
  try{
    const raw=localStorage.getItem(core.STORAGE_KEY);
    if(raw){const obj=JSON.parse(raw);if(obj.schema!==core.STORAGE_KEY)throw Error("版本不符");state=core.normalize(obj)}
  }catch(err){readOnly=true;notice("無法讀取既有 v0.6 學習紀錄；為避免覆蓋，已停用修改。請先保存瀏覽器資料。")}
}
function save(draft){
  if(readOnly)return false;
  try{localStorage.setItem(core.STORAGE_KEY,JSON.stringify(draft));state=draft;return true}
  catch(err){readOnly=true;notice("無法儲存學習紀錄。可能是瀏覽器儲存被阻擋或空間不足；操作未保存。");render();return false}
}
function clone(){return JSON.parse(JSON.stringify(state))}
function btn(text,style,fn){const b=el("button",text,"btn "+(style||""));b.type="button";b.disabled=readOnly;b.addEventListener("click",fn);return b}
function renderTask(day,ref,host){
  const u=core.getUnit(ref.id);if(!u)return;
  const result=state.completed[u.id],card=el("article",undefined,"card"+(result?" done":""));
  card.append(el("small",u.type==="vocab"?"每日固定｜學6個新單字":"當日主要題型"));
  card.append(el("h3",u.title));card.append(el("p",u.instructions));
  const actions=el("div",undefined,"buttons"),link=el("a","前往 Staresto 練習 ↗","btn primary");
  link.href=core.SOURCES[u.type].url;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);
  if(result){actions.append(el("span","✓ 已記錄完成"+(result.correct!==null?"，"+result.correct+"/"+result.total+" 題":"")))}
  else{
    const score=el("div",undefined,"score"),correct=el("input"),total=el("input");
    for(const input of [correct,total]){input.type="number";input.min="0";input.max="100";input.step="1";input.placeholder="選填"}
    correct.setAttribute("aria-label","答對題數");total.setAttribute("aria-label","總題數");total.min="1";
    score.append(el("span","答對"),correct,el("span","／ 共"),total,el("span","題（可不填）"));card.append(score);
    actions.append(btn("我已完成","",function(){
      let data=null;
      if(correct.value.trim()||total.value.trim()){
        if(!correct.value.trim()||!total.value.trim()){notice("填寫成績時，請同時填答對與總題數。");return}
        data={correct:correct.value,total:total.value};
      }
      try{const draft=clone();core.markDone(draft,day,u.id,data);if(save(draft)){notice("");render()}}
      catch(err){notice(err.message)}
    }));
    actions.append(btn("已做過／找不到，換一份","",function(){
      try{const draft=clone(),next=core.replacePreviouslyStudied(draft,day,u.id);if(save(draft)){notice(next?"已更換為未安排過的新範圍。":"此類型的候選任務已排完，請勿重設舊紀錄。");render()}}
      catch(err){notice(err.message)}
    }));
  }
  card.append(actions);host.append(card);
}
function render(){
  $("todayDate").textContent=date;$("dayLabel").textContent=labels[core.weekday(date)];
  const tasks=state.days[date]?.tasks||[],done=tasks.filter(x=>state.completed[x.id]).length;
  $("progress").textContent=done+"／"+tasks.length+" 項已完成";
  const host=$("tasks");host.replaceChildren();
  if(!tasks.length)host.append(el("p","今日暫無新的題組，先複習筆記中的單字，不要重設學習紀錄。"));
  tasks.forEach(x=>renderTask(date,x,host));
  if(core.weekday(date)===0)host.append(el("p","週日可另外複習曾經答錯的題目；這是刻意複習，不算新題。","muted"));
  const rows=core.recent(state);$("count").textContent=rows.length;$("days").textContent=new Set(rows.map(x=>x.date)).size;
  const history=$("history");history.replaceChildren();
  if(!rows.length)history.append(el("p","尚未完成任何任務。","muted"));
  rows.slice(0,30).forEach(x=>{const line=el("div",undefined,"record"),u=core.getUnit(x.id);
    line.append(el("span",u?.title||x.id),el("small",x.date+(x.correct===null?" · 完成":" · "+x.correct+"/"+x.total)));history.append(line)});
}
$("export").addEventListener("click",function(){
  try{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="staresto-v06-"+date+".json";document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(err){notice("匯出備份失敗，請檢查瀏覽器權限。")}
});
load();
if(!readOnly&&!state.days[date]){const draft=clone();core.planDay(draft,date);save(draft)}
render();
})();