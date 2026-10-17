/* Forecast the reader's existing records only. No demo data or storage writes. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),core=window.Study30Review,planner=window.Study30Planner;
 const bank=Array.isArray(window.Study30QuestionSources?.all)?window.Study30QuestionSources.all:[];
 const labels={mastered:'能自行說明',partial:'還不完整',review:'需要再複習'};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function readOnlySessions(){try{const parsed=JSON.parse(localStorage.getItem('probation-study30-v251:v1')||'null');return parsed?.version===1&&parsed.sessions&&typeof parsed.sessions==='object'&&!Array.isArray(parsed.sessions)?parsed.sessions:{};}catch{return {};}}
 function eligible(row,subject){return subject.sunday||row.subject===subject.target||(row.subject==='刑事訴訟法與保安處分執行法'&&['刑事訴訟法','保安處分執行法'].includes(subject.target));}
 function recommendation(sessions,date){const subject=planner.subjectFor(date),data=core.model(sessions,bank,date);return {subject,data,match:data.due.find(row=>eligible(row,subject))};}
 let current=null;
 function render(){
  if(!core||!planner){$('simOutput').textContent='尚未載入複習紀錄，請重新整理後再試。';return;}
  const base=planner.isoTaipei(),offset=Number($('simDays').value),date=core.addDays(base,offset),sessions=readOnlySessions();
  const {subject,data,match}=recommendation(sessions,date);current={base,date,sessions,match};
  $('simNext').textContent='';$('simRerateArea').hidden=!match;$('simNextEligible').hidden=true;
  const host=$('simOutput');host.replaceChildren();
  host.append(el('span',`${date}｜星期${'日一二三四五六'[subject.day]}｜${subject.label}`,'sim-date'));
  if(!data.all.length){host.append(el('p','目前尚無已自評的複習紀錄。'));return;}
  host.append(el('h4',`已到期 ${data.due.length} 題；尚未到期 ${data.upcoming.length} 題`));
  if(data.due.length){const list=el('ul');for(const row of data.due.slice(0,6))list.append(el('li',`${row.subject}｜${row.topic}（${row.due} 到期）`));host.append(list);if(data.due.length>6)host.append(el('p',`另有 ${data.due.length-6} 題到期。`));}
  else host.append(el('p','此日期尚無到期題目。'));
  if(match)host.append(el('p',`當日優先推薦：${match.subject}｜${match.topic}`));
  else if(data.due.length){
   host.append(el('p',`當日安排${subject.label}，其他科目依輪替日期複習。`));
   for(let step=1;step<=7;step++){
    const next=core.addDays(date,step),result=recommendation(sessions,next);
    if(result.match?.id===data.due[0].id){current.jumpDate=next;$('simNextEligible').hidden=false;break;}
   }
  }
 }
 function rerate(){
  if(!current?.match)return;
  const {date,sessions,match}=current,rating=$('simRerate').value;
  const preview={...sessions,[date]:{questionId:match.id,rating,finished:true}};
  const next=core.model(preview,bank,date).all.find(row=>row.id===match.id);
  $('simNext').textContent=next?`預覽：${date} 自評「${labels[rating]}」，下次複習為 ${next.due}（${next.interval} 天後）。`:'無法預覽，原紀錄保持不變。';
 }
 function start(){
  if(!$('reviewSimulator'))return;
  $('simDays').addEventListener('change',render);$('simPreview').addEventListener('click',render);$('simRetry').addEventListener('click',rerate);
  $('simNextEligible').addEventListener('click',()=>{
   if(!current?.jumpDate)return;const offset=core.dateIndex(current.jumpDate)-core.dateIndex(current.base),select=$('simDays');
   if(!Array.from(select.options).some(o=>Number(o.value)===offset)){const option=el('option',offset+'天後');option.value=String(offset);select.append(option);}
   select.value=String(offset);render();
  });
  window.addEventListener('study30:render',render);render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
