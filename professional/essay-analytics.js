/* v2.5.3 stage 4: read-only essay learning analytics; self-ratings, NOT exam grades. */
(function(root){
 'use strict';
 const SUBJECTS=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法'];
 const DAY=86400000;
 const validDay=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(Date.parse(s+'T00:00:00Z')).toISOString().slice(0,10)===s;
 const dayValue=s=>Date.parse(s+'T00:00:00Z')/DAY;
 const previous=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')-n*DAY).toISOString().slice(0,10);
 function collect(sessions,bank,today){
  const rubric=root.Study30Rubric;
  if(!rubric||!validDay(today))return [];
  const questionMap=new Map((Array.isArray(bank)?bank:[]).filter(q=>q&&q.id!==undefined).map(q=>[String(q.id),q]));
  const rows=[];
  for(const [day,session] of Object.entries(sessions||{}).sort(([a],[b])=>a.localeCompare(b))){
   if(!validDay(day)||day>today||!session||typeof session!=='object')continue;
   const entries=session.essayAssessments;
   if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
   for(const [id,entry] of Object.entries(entries)){
    if(!entry||typeof entry!=='object')continue;
    const q=questionMap.get(String(id));
    const subj=typeof entry.subject==='string'&&SUBJECTS.includes(entry.subject)?entry.subject:
      q&&SUBJECTS.includes(q.subjectGroup)?q.subjectGroup:
      q&&SUBJECTS.includes(q.subject)?q.subject:
      String(id).startsWith('manual:')?String(id).slice(String(id).indexOf(':',7)+1):null;
    if(!SUBJECTS.includes(subj))continue;
    const type=rubric.subjectType(subj);
    if(!rubric.validate(type,entry))continue;
    const score=rubric.score(type,entry.scores);
    if(score===null)continue;
    rows.push({day,id:String(id),subject:subj,score,issues:entry.issues.slice(),nextStep:entry.nextStep||'',
      criteria:rubric.RULES[type].criteria.map(c=>({id:c.id,label:c.label,weight:c.weight,value:entry.scores[c.id]}))});
   }
  }
  return rows;
 }
 function summarize(rows,today,days,subject){
  if(!validDay(today))return {count:0,activeDays:0,average:null,perSubject:[],trend:[],weaknesses:[],improved:0,declined:0,unchanged:0,repeatPairs:0,criteria:[]};
  const start=days==='all'?null:previous(today,(String(days)==='7'?7:30)-1);
  const selected=rows.filter(r=>(!start||r.day>=start)&&(subject==='all'||r.subject===subject));
  const avg=x=>x.length?Math.round(x.reduce((s,v)=>s+v,0)/x.length):null;
  const perSubject=SUBJECTS.map(name=>{
   const items=selected.filter(r=>r.subject===name);
   return {subject:name,count:items.length,average:avg(items.map(x=>x.score)),activeDays:new Set(items.map(x=>x.day)).size};
  });
  const byDay=new Map(),issueCounts=new Map(),crit=new Map(),byQuestion=new Map();
  for(const r of selected){
   if(!byDay.has(r.day))byDay.set(r.day,[]);
   byDay.get(r.day).push(r.score);
   for(const s of r.issues)issueCounts.set(s,(issueCounts.get(s)||0)+1);
   for(const c of r.criteria){const key=r.subject+'|'+c.id;let x=crit.get(key);if(!x){x={subject:r.subject,id:c.id,label:c.label,sum:0,total:0,count:0};crit.set(key,x);}x.sum+=c.value;x.total+=4;x.count++;}
   const key=r.subject+'|'+r.id;
   if(!byQuestion.has(key))byQuestion.set(key,[]);
   byQuestion.get(key).push(r);
  }
  let improved=0,declined=0,unchanged=0,repeatPairs=0;
  for(const items of byQuestion.values()){
   items.sort((a,b)=>a.day.localeCompare(b.day));
   for(let i=1;i<items.length;i++){
    if(items[i].day===items[i-1].day)continue;
    repeatPairs++;
    if(items[i].score>items[i-1].score)improved++;
    else if(items[i].score<items[i-1].score)declined++;
    else unchanged++;
   }
  }
  return {count:selected.length,activeDays:byDay.size,average:avg(selected.map(x=>x.score)),
   perSubject,trend:[...byDay.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,x])=>({day,average:avg(x),count:x.length})),
   weaknesses:[...issueCounts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW')).slice(0,8),
   criteria:[...crit.values()].map(x=>({subject:x.subject,label:x.label,percent:Math.round(x.sum/x.total*100),count:x.count})).sort((a,b)=>a.percent-b.percent||b.count-a.count).slice(0,8),
   improved,declined,unchanged,repeatPairs};
 }
 root.Study30EssayAnalytics={SUBJECTS,collect,summarize};
})(window);

(function(){
 'use strict';
 const $=id=>document.getElementById(id),make=(tag,content,cls)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=String(content);if(cls)el.className=cls;return el;};
 const display=v=>v===null?'—':String(v);
 function render(){
  const api=window.Study30App,core=window.Study30EssayAnalytics;
  if(!api?.getEssayReviewData||!core||!$('essayAnalyticsSummary'))return;
  const {sessions,bank,today}=api.getEssayReviewData();
  const rows=core.collect(sessions,bank,today);
  const days=$('essayAnalyticsDays').value;
  const subject=$('essayAnalyticsSubject').value;
  const data=core.summarize(rows,today,days,subject);
  $('essayAnalyticsSummary').textContent=`完整自評 ${data.count} 筆｜練習 ${data.activeDays} 天｜平均個人自評 ${display(data.average)}／100`;
  $('essayAnalyticsNote').textContent=data.repeatPairs?
   `同題跨日複習比較：進步 ${data.improved} 次、下降 ${data.declined} 次、持平 ${data.unchanged} 次（共 ${data.repeatPairs} 次）。`:
   '目前尚無同題跨日複習比較；至少需在不同日期完成同題自評。';
  const subjectHost=$('essayAnalyticsSubjects');subjectHost.replaceChildren();
  for(const s of data.perSubject.filter(x=>x.count)){
   const line=make('div',undefined,'essay-analytics-line');line.append(make('span',s.subject),make('strong',`${s.count} 筆 · 平均 ${s.average} 分`));subjectHost.append(line);
  }
  if(!subjectHost.childNodes.length)subjectHost.append(make('p','尚無完整申論自評紀錄。','muted tiny'));
  const trend=$('essayAnalyticsTrend');trend.replaceChildren();
  for(const d of data.trend.slice(-14)){
   const item=make('div',undefined,'essay-trend-item');
   const top=make('div',undefined,'essay-trend-label');top.append(make('span',d.day.slice(5)),make('strong',`${d.average} 分／${d.count} 筆`));
   const track=make('div',undefined,'essay-trend-track');const bar=make('div',undefined,'essay-trend-bar');bar.style.width=`${d.average}%`;track.append(bar);
   item.append(top,track);trend.append(item);
  }
  if(!trend.childNodes.length)trend.append(make('p','完成自評後，這裡會顯示每日平均自評分數。','muted tiny'));
  const weak=$('essayAnalyticsWeaknesses');weak.replaceChildren();
  for(const w of data.weaknesses.slice(0,5))weak.append(make('li',`${w.name}：${w.count} 次`));
  if(!weak.childNodes.length)weak.append(make('li','尚未標記失分原因。'));
  const criteria=$('essayAnalyticsCriteria');criteria.replaceChildren();
  for(const c of data.criteria.slice(0,5))criteria.append(make('li',`${c.subject}｜${c.label}：平均自評達成率 ${c.percent}%（${c.count} 筆）`));
  if(!criteria.childNodes.length)criteria.append(make('li','目前尚無可比較的評分指標。'));
 }
 function start(){
  if(!$('essayAnalyticsSummary'))return;
  $('essayAnalyticsDays').addEventListener('change',render);
  $('essayAnalyticsSubject').addEventListener('change',render);
  window.addEventListener('study30:render',render);
  window.addEventListener('study30:essay-assessed',render);
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();