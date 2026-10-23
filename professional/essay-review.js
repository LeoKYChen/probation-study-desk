/* v2.5.3 stage 3: essay weakness -> spaced review, never mutates daily training. */
(function(root){
  'use strict';
  const MS=86400000, ratings={review:1,partial:3,mastered:7};
  const localDay = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')) && !Number.isNaN(Date.parse(iso+'T00:00:00Z')) && new Date(Date.parse(iso+'T00:00:00Z')).toISOString().slice(0,10)===iso;
  const index = iso => localDay(iso)?Date.parse(iso+'T00:00:00Z')/MS:NaN;
  const addDays = (iso,n)=>new Date((index(iso)+n)*MS).toISOString().slice(0,10);
  const typeOf = s => root.Study30Rubric?.subjectType(s)||'general';
  const rubric = root.Study30Rubric;
  function inferSubject(id,assessment,session,questions){
    if(typeof assessment?.subject==='string'&&assessment.subject.length<=100)return assessment.subject;
    if(id.startsWith('manual:'))return id.slice(id.indexOf(':',7)+1);
    const q=questions.get(id);
    if(q)return String(q.subjectGroup||q.subject||'');
    if(id.startsWith('unassigned:'))return String(session?.essayPracticeSubject||'自主練習');
    return '';
  }
  function ratingFrom(score,issues){
    if(score<60)return 'review';
    if(score<80||(issues||[]).length>0)return 'partial';
    return 'mastered';
  }
  function model(sessions,bank,today,todaySubject){
    if(!localDay(today))return {all:[],due:[],upcoming:[],incomplete:0};
    const questions=new Map((Array.isArray(bank)?bank:[]).map(q=>[String(q.id),q]));
    const history=new Map(); let incomplete=0;
    for(const [day,session] of Object.entries(sessions||{}).sort(([a],[b])=>a.localeCompare(b))){
      if(!localDay(day)||index(day)>index(today)||!session||typeof session!=='object')continue;
      for(const [id,entry] of Object.entries(session.essayAssessments||{})){
        if(!entry||typeof entry!=='object'||!entry.scores||!rubric)continue;
        const subject=inferSubject(id,entry,session,questions);
        const type=typeOf(subject);
        if(!rubric.validate(type,entry)){incomplete++;continue;}
        const score=rubric.score(type,entry.scores);
        if(score===null){incomplete++;continue;}
        const rating=ratingFrom(score,entry.issues);
        const prev=history.get(id);
        const interval=rating==='mastered'&&prev?.rating==='mastered'?(prev.interval>=14?30:14):ratings[rating];
        const q=questions.get(id),manual=id.startsWith('manual:');
        const mappedSubjects=Array.isArray(q?.mappedSubjects)?q.mappedSubjects:[];
        // Keep official subject in the record but navigate to an actual practice subject.
        const practiceSubject=['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法'].includes(subject)?subject:
          (mappedSubjects.includes(todaySubject)?todaySubject:mappedSubjects[0]||'');
        const label=String(entry.questionHeading||q?.title||`自主練習｜${subject||'科目待辨識'}`).slice(0,120);
        history.set(id,{id,subject,practiceSubject,mappedSubjects,topic:label,score,rating,interval,date:day,due:addDays(day,interval),
          issues:entry.issues.slice(),nextStep:String(entry.nextStep||''),attempts:(prev?.attempts||0)+1,
          canOpen:!!practiceSubject&&(manual||!!q),manual});
      }
    }
    const all=[...history.values()].map(r=>({...r,daysUntil:index(r.due)-index(today),todayMatch:r.subject===todaySubject||r.mappedSubjects.includes(todaySubject)}));
    const sort=(a,b)=>a.daysUntil-b.daysUntil||Number(b.todayMatch)-Number(a.todayMatch)||a.date.localeCompare(b.date)||a.id.localeCompare(b.id);
    const due=all.filter(r=>r.daysUntil<=0).sort(sort),upcoming=all.filter(r=>r.daysUntil>0).sort(sort);
    return {all,due,upcoming,incomplete};
  }
  root.Study30EssayReview={model,ratingFrom,addDays};
})(window);

/* UI: independent essay review queue, does not alter upper daily task or timer. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const mk=(tag,txt,cls)=>{const el=document.createElement(tag);if(txt!==undefined)el.textContent=txt;if(cls)el.className=cls;return el;};
  function render(){
    const api=window.Study30App,core=window.Study30EssayReview;if(!api?.getEssayReviewData||!core||!$('essayReviewDue'))return;
    const {sessions,bank,today,todaySubject}=api.getEssayReviewData();
    const m=core.model(sessions,bank,today,todaySubject);
    $('essayReviewSummary').textContent=`已排程 ${m.all.length} 題｜今天到期 ${m.due.length} 題｜尚未評完 ${m.incomplete} 筆`;
    const makeList=(id,items,empty)=>{
      const host=$(id);host.replaceChildren();
      if(!items.length){host.append(mk('p',empty,'muted tiny'));return;}
      for(const r of items.slice(0,12)){
        const item=mk('article',undefined,'essay-review-card');
        const head=mk('div',undefined,'essay-review-head');
        head.append(mk('strong',r.subject+'｜'+r.topic),mk('span',r.daysUntil<0?`逾期${-r.daysUntil}天`:r.daysUntil===0?'今日到期':`${r.daysUntil}天後`,'review-date'));
        item.append(head,mk('p',`個人自評 ${r.score}／100 · ${r.rating==='review'?'需要再複習':r.rating==='partial'?'還不完整':'能自行說明'} · 間隔 ${r.interval} 天`,'muted tiny'));
        if(r.issues.length)item.append(mk('p','待補強：'+r.issues.join('、'),'muted tiny'));
        if(r.nextStep)item.append(mk('p','改善目標：'+r.nextStep,'muted tiny'));
        const button=mk('button','開啟這題申論複習','secondary');button.type='button';button.disabled=!r.canOpen;
        button.title=r.canOpen?'不更動上方每日任務、計時與自評':'題目來源或科目無法辨識，暫不能開啟';
        button.addEventListener('click',()=>{if(api.openEssayReview(r.id,r.practiceSubject)){
          $('essayEditor').open=true;$('essaySource').open=true;
          $('essayLab').scrollIntoView({block:'start',behavior:'smooth'});
          $('essayReviewStatus').textContent=`已開啟「${r.subject}」申論複習。完成新答案及自評後，系統會重新計算複習日期。`;
        }else $('essayReviewStatus').textContent='此題無法開啟，請重新整理後再試。';});
        item.append(button);host.append(item);
      }
      if(items.length>12)host.append(mk('p',`另有 ${items.length-12} 題，先顯示最早到期者。`,'muted tiny'));
    };
    makeList('essayReviewDue',m.due,'目前沒有到期的申論題。完成各項自評後才會建立排程。');
    makeList('essayReviewUpcoming',m.upcoming,'目前沒有已排定的未來申論複習。');
  }
  function start(){
    window.addEventListener('study30:render',render);
    window.addEventListener('study30:essay-assessed',render);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
