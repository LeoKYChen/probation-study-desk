/* v2.5.3 stage 5: explainable daily essay review priorities.
   Read-only ranking; opening a recommendation is the only interactive action.
   No AI assessment, writes, storage or mutation of existing schedules. */
(function(root){
 'use strict';
 const DAY=86400000;
 const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(Date.parse(s+'T00:00:00Z')).toISOString().slice(0,10)===s;
 const dayNum=s=>Date.parse(s+'T00:00:00Z')/DAY;
 const isValidRow=r=>r&&isDate(r.day)&&typeof r.subject==='string'&&Number.isFinite(r.score)&&Array.isArray(r.issues);
 function recommend(reviews,rows,today,todaySubject,limit=3){
  const empty={picks:[],fallback:[],dueCount:0,openableDue:0,hasHistory:false,recencyDays:30};
  if(!isDate(today))return empty;
  const safeRows=(Array.isArray(rows)?rows:[]).filter(r=>isValidRow(r)&&dayNum(r.day)<=dayNum(today));
  const recentRows=safeRows.filter(r=>dayNum(today)-dayNum(r.day)<30);
  const issueCount=new Map();
  for(const r of recentRows){
   for(const issue of new Set(r.issues.filter(s=>typeof s==='string'&&s.trim()))){
    const k=r.subject+'\u0000'+issue;
    const info=issueCount.get(k)||{subject:r.subject,issue,count:0,lastDay:r.day};
    info.count++;if(info.lastDay<r.day)info.lastDay=r.day;
    issueCount.set(k,info);
   }
  }
  const all=Array.isArray(reviews?.all)?reviews.all:[];
  const due=all.filter(r=>r&&Number.isFinite(r.daysUntil)&&r.daysUntil<=0);
  const candidates=due.filter(r=>r.canOpen&&typeof r.subject==='string'&&typeof r.id==='string')
   .map(r=>{
    const overdue=Math.min(30,Math.max(0,-r.daysUntil));
    const score=Number.isFinite(r.score)?r.score:100;
    const severity=score<60?35:score<80?20:5;
    const issues=Array.isArray(r.issues)?[...new Set(r.issues.filter(x=>typeof x==='string'))]:[];
    const frequency=Math.max(0,...issues.map(s=>issueCount.get(r.subject+'\u0000'+s)?.count||0));
    const sameSubject=!!todaySubject&&r.subject===todaySubject;
    const priority=100+2*overdue+severity+Math.min(3,frequency)*4+(issues.length?6:0)+(sameSubject?5:0);
    const reasons=[r.daysUntil<0?`已逾期 ${-r.daysUntil} 天`:'今天到期',score<60?'最近一次自評未達60分':score<80?'最近一次自評未達80分':'依原定日期複習'];
    if(frequency>=2)reasons.push(`相同失分原因近30天出現 ${frequency} 次`);
    if(sameSubject)reasons.push('符合今日固定科目');
    return {id:r.id,subject:r.subject,topic:String(r.topic||'申論練習'),due:r.due,daysUntil:r.daysUntil,score,priority,reasons,issues,improvement:String(r.nextStep||''),sameSubject};
   });
  candidates.sort((a,b)=>b.priority-a.priority||a.daysUntil-b.daysUntil||a.subject.localeCompare(b.subject,'zh-TW')||a.id.localeCompare(b.id));
  const fallback=[...issueCount.values()].sort((a,b)=>b.count-a.count||b.lastDay.localeCompare(a.lastDay)||a.subject.localeCompare(b.subject,'zh-TW')).slice(0,Math.max(1,limit));
  const safeLimit=Math.min(5,Math.max(1,Math.trunc(Number(limit)||3)));
  return {picks:candidates.slice(0,safeLimit),fallback,
   dueCount:due.length,openableDue:candidates.length,hasHistory:safeRows.length>0,recencyDays:30};
 }
 root.Study30WeaknessPriority={recommend};
})(window);

(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
 function render(){
  const api=window.Study30App,rev=window.Study30EssayReview,ana=window.Study30EssayAnalytics,model=window.Study30WeaknessPriority;
  if(!api?.getEssayReviewData||!rev?.model||!ana?.collect||!model?.recommend||!$('weaknessPriorityList'))return;
  let raw;
  try{raw=api.getEssayReviewData();}catch{return;}
  const {sessions,bank,today,todaySubject}=raw;
  const reviews=rev.model(sessions,bank,today,todaySubject);
  const rows=ana.collect(sessions,bank,today);
  const plan=model.recommend(reviews,rows,today,todaySubject);
  const host=$('weaknessPriorityList'),overview=$('weaknessPrioritySummary'),status=$('weaknessPriorityStatus');
  overview.textContent=`申論已到期 ${plan.dueCount} 題｜可一鍵開啟 ${plan.openableDue} 題｜參考最近 ${plan.recencyDays} 天的失分原因`;
  host.replaceChildren();
  if(plan.picks.length){
   for(const [i,r] of plan.picks.entries()){
    const item=node('article',undefined,'weakness-priority-item');
    item.append(node('h3',`${i+1}. ${r.subject}｜${r.topic}`));
    item.append(node('p',`優先理由：${r.reasons.join('；')}。`,'weakness-reasons'));
    if(r.issues.length)item.append(node('p',`自評待補強：${r.issues.join('、')}`,'muted tiny'));
    if(r.improvement)item.append(node('p',`上次改善目標：${r.improvement}`,'muted tiny'));
    const btn=node('button','開啟這題申論','secondary');btn.type='button';
    btn.addEventListener('click',()=>{
     if(api.openEssayReview?.(r.id,r.subject)){
      if($('essayEditor'))$('essayEditor').open=true;
      if($('essaySource'))$('essaySource').open=true;
      $('essayLab')?.scrollIntoView({block:'start',behavior:'smooth'});
      status.textContent=`已開啟「${r.subject}」申論題，請在下方作答。上方每日任務不變。`;
     }else status.textContent='無法開啟該題，請重新整理後再試。';
    });
    item.append(btn);host.append(item);
   }
  }else if(plan.dueCount){
   host.append(node('p','有到期紀錄，但題目來源不完整，暫時無法一鍵開啟。請先檢查該題科目與來源。','muted'));
  }else host.append(node('p','今天沒有到期的申論題；不會提前修改任何題目的複習日期。','muted'));
  const fb=$('weaknessPriorityFallback');fb.replaceChildren();
  if(plan.fallback.length){
   fb.append(node('h3','近30天經常標記的失分原因（供自主練習）'));
   const ul=node('ul');
   for(const item of plan.fallback){ul.append(node('li',`${item.subject}｜${item.issue}（${item.count} 次）`));}
   fb.append(ul);
  }else fb.append(node('p',plan.hasHistory?'近30天尚未標記失分原因；請依原定複習清單練習。':'尚無可用的完整申論自評。先完成一題申論及自評，才能產生個人化建議。','muted'));
  status.textContent='建議僅供自我安排，不會修改上方固定科目、計時器、草稿或複習到期日。';
 }
 function init(){
  if(!$('weaknessPriorityList'))return;
  window.addEventListener('study30:render',render);
  window.addEventListener('study30:essay-assessed',render);
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
