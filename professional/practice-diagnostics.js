/* v2.5.4 stage 1 — read-only learning diagnostics from the original 426-question site.
 * Daily self-ratings, essay self-ratings and spaced-review status stay SEPARATE.
 * No predicted question bank, data writes, grade prediction or automated scheduling. */
(function(root){
  'use strict';
  const SUBJECTS=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法'];
  const VALID_RATINGS=['review','partial','mastered'], DAY=86400000;
  const dateIndex=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
    Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(Date.parse(s+'T00:00:00Z')).toISOString().slice(0,10)===s?
      Date.parse(s+'T00:00:00Z')/DAY:NaN;
  const clean=s=>String(s||'').replace(/[（(].*?[）)]/g,'').trim();
  function subjectsOf(q){
    if(!q)return [];
    const names=[q.subjectGroup,q.subject,...(Array.isArray(q.mappedSubjects)?q.mappedSubjects:[])].map(clean);
    const ret=new Set();
    for(const s of names){
      if(SUBJECTS.includes(s))ret.add(s);
      if(s==='刑事訴訟法與保安處分執行法'){ret.add('刑事訴訟法');ret.add('保安處分執行法');}
    }
    return [...ret];
  }
  const before=(date,today,days)=>{
    const n=dateIndex(date),t=dateIndex(today);
    return Number.isFinite(n)&&Number.isFinite(t)&&n<=t&&(days==='all'||t-n<days);
  };
  function analyze(sessions,bank,essayRows,reviewRows,today,days=30){
    const period=days==='all'?'all':[7,30,90].includes(Number(days))?Number(days):30;
    const questions=new Map((Array.isArray(bank)?bank:[]).filter(q=>q&&typeof q.id==='string').map(q=>[q.id,q]));
    const daily=[],essay=[],history=new Map();
    const normalized=root.Study30Review?.attempts(sessions,bank,today)||[];
    for(const row of normalized){
      const {date:day,id,q,rating,cause}=row;
      const attempt={day,id,subjects:row.explicit?[row.subject]:subjectsOf(q),rating,cause:cause.trim(),title:String(q.title||id)};
      const key=id;
      if(!history.has(key))history.set(key,[]);
      history.get(key).push(attempt);
      if(before(day,today,period))daily.push(attempt);
    }
    for(const row of Array.isArray(essayRows)?essayRows:[]){
      if(!row||!SUBJECTS.includes(row.subject)||!before(row.day,today,period)||!Number.isFinite(row.score))continue;
      essay.push({day:row.day,id:String(row.id),subject:row.subject,score:row.score,
        issues:Array.isArray(row.issues)?row.issues.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[]});
    }
    const due=[...new Map((Array.isArray(reviewRows)?reviewRows:[]).filter(r=>r&&typeof r.id==='string'&&
      typeof r.subject==='string'&&Number.isFinite(r.daysUntil)&&r.daysUntil<=0).map(r=>[r.id+'|'+r.subject,r])).values()];
    const latest=[...history.values()].map(h=>h[h.length-1]);
    const repeatWeak=[];
    for(const attempts of history.values()){
      // Consecutive different-day reviews of the *same original question*.
      for(let i=1;i<attempts.length;i++){
        const a=attempts[i-1],b=attempts[i];
        if(a.day===b.day||!before(b.day,today,period))continue;
        repeatWeak.push({id:b.id,subjects:b.subjects,day:b.day,from:a.rating,to:b.rating,
          change:VALID_RATINGS.indexOf(b.rating)-VALID_RATINGS.indexOf(a.rating)});
      }
    }
    const essayHistory=new Map();
    // Compare same-question attempts from the full available history, so a review on
    // the first day of this range can be compared against the prior day outside it.
    for(const row of Array.isArray(essayRows)?essayRows:[]){
      if(!row||!SUBJECTS.includes(row.subject)||!before(row.day,today,'all')||!Number.isFinite(row.score))continue;
      const key=row.subject+'\u0000'+String(row.id);
      if(!essayHistory.has(key))essayHistory.set(key,[]);
      essayHistory.get(key).push(row);
    }
    const essayComparisons=[];
    for(const attempts of essayHistory.values()){
      attempts.sort((a,b)=>a.day.localeCompare(b.day));
      for(let i=1;i<attempts.length;i++){
        const a=attempts[i-1],b=attempts[i];
        if(a.day!==b.day&&before(b.day,today,period))
          essayComparisons.push({subject:b.subject,id:String(b.id),day:b.day,diff:b.score-a.score});
      }
    }
    const grouped=SUBJECTS.map(subject=>{
      const ds=daily.filter(x=>x.subjects.includes(subject)), es=essay.filter(x=>x.subject===subject);
      const latestItems=latest.filter(x=>x.subjects.includes(subject));
      const dsDue=due.filter(r=>r.explicitSubject?r.subject===subject:subjectsOf(questions.get(r.id)).includes(subject)||(!questions.has(r.id)&&r.subject===subject));
      const transitions=repeatWeak.filter(x=>x.subjects.includes(subject));
      const esCmp=essayComparisons.filter(x=>x.subject===subject);
      const reasons=new Map(),questionWeak=new Map();
      // Distinct dates per weakness — repeats across separate study days.
      for(const item of ds)if(item.cause&&item.rating!=='mastered'){
        const key='題目自評｜'+item.cause,dates=reasons.get(key)||new Set();dates.add(item.day);reasons.set(key,dates);
      }
      for(const item of es)for(const cause of new Set(item.issues)){
        const key='申論自評｜'+cause,dates=reasons.get(key)||new Set();dates.add(item.day);reasons.set(key,dates);
      }
      for(const x of ds.filter(x=>x.rating!=='mastered')){
        const set=questionWeak.get(x.id)||new Set();set.add(x.day);questionWeak.set(x.id,set);
      }
      const repeatedReasons=[...reasons].map(([label,dates])=>({label,count:dates.size}))
        .filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-TW'));
      const recurringQuestions=[...questionWeak].filter(([,v])=>v.size>=2).length;
      const essayAverage=es.length?Math.round(es.reduce((s,x)=>s+x.score,0)/es.length):null;
      return {subject,dailyAttempts:ds.length,dailyQuestions:new Set(ds.map(x=>x.id)).size,
        mastered:latestItems.filter(x=>x.rating==='mastered').length,
        needsWork:latestItems.filter(x=>x.rating!=='mastered').length,
        due:dsDue.length, essayAttempts:es.length,essayAverage,
        dailyBetter:transitions.filter(x=>x.change>0).length,
        dailyWorse:transitions.filter(x=>x.change<0).length,
        dailySame:transitions.filter(x=>x.change===0).length,
        essayBetter:esCmp.filter(x=>x.diff>0).length,
        essayWorse:esCmp.filter(x=>x.diff<0).length,
        essaySame:esCmp.filter(x=>x.diff===0).length,
        recurringQuestions,repeatedReasons};
    });
    // Guidance is evidence-led, no guesses for unstudied subjects and no change to schedules.
    const ranked=grouped.filter(x=>x.dailyAttempts||x.essayAttempts||x.due)
      .map(x=>({...x,priority:x.due*5+x.recurringQuestions*3+
        x.repeatedReasons.reduce((s,r)=>s+r.count,0)*2+x.needsWork}))
      .sort((a,b)=>b.priority-a.priority||b.due-a.due||SUBJECTS.indexOf(a.subject)-SUBJECTS.indexOf(b.subject));
    return {period,subjects:grouped,priorities:ranked.slice(0,3),
      totals:{uniqueBankQuestions:questions.size,dailyAttempts:daily.length,
        essayAttempts:essay.length,dueQuestions:new Set(due.map(x=>x.id)).size,
        dailyBetter:repeatWeak.filter(x=>x.change>0).length,
        essayBetter:essayComparisons.filter(x=>x.diff>0).length}};
  }
  root.Study30V254Diagnostics={SUBJECTS,subjectsOf,analyze};
})(window);

/* Presentation only; no changes to study sessions, rating buttons or question pickers. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const el=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=String(t);if(cls)n.className=cls;return n;};
  const display=n=>n===null?'尚無資料':String(n);
  function render(){
    const api=window.Study30App,core=window.Study30V254Diagnostics;
    if(!api?.getEssayReviewData||!core||!$('v254StudySummary'))return;
    const {sessions,bank,today}=api.getEssayReviewData();
    const essays=window.Study30EssayAnalytics?.collect(sessions,bank,today)||[];
    const reviews=window.Study30Review?.model(sessions,bank,today)?.all||[];
    const days=$('v254Days').value,chosen=$('v254Subject').value;
    const data=core.analyze(sessions,bank,essays,reviews,today,days);
    const visible=chosen==='all'?data.subjects:data.subjects.filter(x=>x.subject===chosen);
    $('v254StudySummary').textContent='分析來源：原站 '+data.totals.uniqueBankQuestions+
      ' 題｜期間內題目自評 '+data.totals.dailyAttempts+' 筆、申論自評 '+data.totals.essayAttempts+
      ' 筆｜目前到期的原題 '+data.totals.dueQuestions+' 題。';
    const list=$('v254SubjectCards');list.replaceChildren();
    for(const row of visible){
      const card=el('article',undefined,'v254-subject-card');
      card.append(el('h3',row.subject));
      card.append(el('p','題目自評：'+row.dailyAttempts+' 次／涉及 '+row.dailyQuestions+' 題；目前掌握 '+
        row.mastered+' 題、待補強 '+row.needsWork+' 題；到期 '+row.due+' 題。'));
      card.append(el('p','申論自評：'+row.essayAttempts+' 次，平均 '+display(row.essayAverage)+
        (row.essayAverage===null?'':'／100')+'（個人自評，非國考成績）。'));
      card.append(el('p','同題跨日比較：題目自評提升 '+row.dailyBetter+' 次、下降 '+row.dailyWorse+
        ' 次；申論分數提高 '+row.essayBetter+' 次、降低 '+row.essayWorse+' 次。'));
      if(row.recurringQuestions)card.append(el('p','在所選期間內重複標記「待補強」的原題：'+row.recurringQuestions+' 題。','v254-attention'));
      const reasons=el('div',undefined,'v254-reasons');
      if(row.repeatedReasons.length){
        reasons.append(el('strong','反覆弱點（至少2個不同練習日）'));
        const ul=el('ul');
        for(const issue of row.repeatedReasons.slice(0,4))ul.append(el('li',issue.label+'：'+issue.count+' 天'));
        reasons.append(ul);
      }else reasons.append(el('p','尚無跨日重複的失分原因；不代表已完全掌握。','muted tiny'));
      card.append(reasons);list.append(card);
    }
    const priorities=$('v254Priorities');priorities.replaceChildren();
    const top=data.priorities.filter(x=>chosen==='all'||x.subject===chosen);
    if(!top.length)priorities.append(el('p','目前沒有足夠的已保存自評紀錄；請先依原定每日科目練習。','muted'));
    for(const row of top){
      const item=el('li',row.subject+'：'+
        [row.due?row.due+' 題已到期':null,row.recurringQuestions?row.recurringQuestions+' 題反覆待補強':null,
          row.repeatedReasons.length?row.repeatedReasons[0].label+'重複 '+row.repeatedReasons[0].count+' 天':null]
          .filter(Boolean).join('；')+
        (!row.due&&!row.recurringQuestions&&!row.repeatedReasons.length?'近期已有練習，持續依原排程複習':''));
      priorities.append(item);
    }
    $('v254Disclaimer').textContent='每日題目的「掌握／待補強」和申論分數分別統計；跨題平均只描述個人自評，不代表考試通過率。'+
      '能力指標為既有紀錄的描述，沒有新增評分或變更複習日期。';
  }
  function init(){
    if(!$('v254StudySummary'))return;
    $('v254Days').addEventListener('change',render);
    $('v254Subject').addEventListener('change',render);
    window.addEventListener('study30:render',render);
    window.addEventListener('study30:essay-assessed',render);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();