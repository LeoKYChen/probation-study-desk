/* v2.5.3 Stage 2: retain v2.5.1 storage key, preserve existing session records. */
(() => {
  'use strict';
  const KEY = 'probation-study30-v251:v1';
  const $ = id => document.getElementById(id);
  const DAY_NAMES = ['日','一','二','三','四','五','六'];
  const SUBJECTS = {1:'心理學',2:'諮商與輔導',3:'犯罪學',4:'少年事件處理法',5:'刑法'};
  const ESSAY_SUBJECTS = ['心理學','諮商與輔導','犯罪學','少年事件處理法','刑法','刑事訴訟法','保安處分執行法'];
  const BANK = Array.isArray(window.Study30QuestionSources?.all) ? window.Study30QuestionSources.all : [];
  const Review = window.Study30Review;
  const two = n => String(n).padStart(2,'0');
  const isoTaipei = (date = new Date()) => {
    const p = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const field = type => p.find(x=>x.type===type).value;
    return `${field('year')}-${field('month')}-${field('day')}`;
  };
  const dayNumber = iso => new Date(iso+'T12:00:00+08:00').getUTCDay();
  const weekNumber = iso => Math.floor((Date.parse(iso+'T00:00:00Z')-Date.UTC(2026,9,12)) / (7*86400000));
  const dayIndex = iso => Math.floor(Date.parse(iso+'T00:00:00Z')/86400000);
  const subjectFor = iso => {
    const dow = dayNumber(iso);
    if(dow===0)return {day:dow,label:'綜合複習＋共同科目',target:'複習',sunday:true};
    if(dow===6){const alt=weekNumber(iso)%2===0?'刑事訴訟法':'保安處分執行法';return {day:dow,label:'刑事訴訟法與保安處分執行法',target:alt,sunday:false};}
    return {day:dow,label:SUBJECTS[dow],target:SUBJECTS[dow],sunday:false};
  };
  const normalSubject = s=>String(s||'').replace(/[（(].*?[）)]/g,'').trim();
  const hash = text => {let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
  const examIsProbation = q => String(q.examType||'').includes('觀護人') || (Array.isArray(q.examTypes)&&q.examTypes.includes('觀護人'));
  const candidateSubject = (q,target) => {
    const names=[normalSubject(q.subject),normalSubject(q.subjectGroup)];
    return names.some(name => name===target || (name==='刑事訴訟法與保安處分執行法'&&['刑事訴訟法','保安處分執行法'].includes(target)));
  };
  const pool = target => BANK.filter(q=>candidateSubject(q,target));
  const commonPool = () => BANK.filter(q=>/法學知識|英文|國文/.test(String(q.subject||'')));
  const pick = (list,seed) => list.length ? list[hash(seed)%list.length] : null;
  const durations = (iso,mode) => subjectFor(iso).sunday ? (String(mode)==='10'?[6,4]:[20,10]) : (String(mode)==='10'?[2,5,2,1]:[5,15,8,2]);
  const phaseTitles = (iso) => subjectFor(iso).sunday ? ['錯題重答與複習','共同科目'] : ['主動回想','理解與解題','申論架構','錯誤整理'];
  const blank = () => ({version:1,sessions:{}});
  let store=blank(),session=null,running=false,lastTickMs=0,canSave=true,selectedPracticeDate=null;
  const say = message=>{$('notice').textContent=message;$('notice').hidden=false;};
  function load(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.version===1&&parsed.sessions&&typeof parsed.sessions==='object'&&!Array.isArray(parsed.sessions))store=parsed;else throw Error('版本不符');}}catch(e){canSave=false;say('無法讀取30分鐘紀錄，未覆寫原資料。本次可練習，但離開前務必匯出備份。');}}
  function persist(){if(!canSave)return;try{localStorage.setItem(KEY,JSON.stringify(store));window.PSDLocalJournal?.note(KEY);}catch(e){canSave=false;say('目前瀏覽器無法保存30分鐘紀錄。請使用「匯出本模組紀錄 JSON」備份。');}}
  const priorRecords = () => Object.entries(store.sessions).sort(([a],[b])=>b.localeCompare(a));
  function newestRatingById(){const result=new Map();for(const [date,s] of priorRecords()){if(s?.questionId&&!result.has(s.questionId)&&s.rating)result.set(s.questionId,{rating:s.rating,date});}return result;}
  function reviewCandidate(target,iso){const ratings=newestRatingById();const eligible=pool(target).filter(q=>{const r=ratings.get(q.id);return r?.rating==='review'&&dayIndex(iso)-dayIndex(r.date)>=3;});return eligible.sort((a,b)=>dayIndex(ratings.get(a.id).date)-dayIndex(ratings.get(b.id).date))[0]||null;}
  function chooseQuestion(iso){const sub=subjectFor(iso);if(sub.sunday){const prior=priorRecords().filter(([d,s])=>d<iso&&s?.questionId);const rated=prior.filter(([d,s])=>s.rating==='review');const due=Review?.chooseDue(store.sessions,BANK,iso,null,true);const from=due||(rated[0]||prior[0])?.[1]?.questionId;return BANK.find(q=>q.id===from)||pick(pool('心理學'),iso+':sunday');}
    const due=Review?.chooseDue(store.sessions,BANK,iso,sub.target,false);
    return BANK.find(q=>q.id===due)||reviewCandidate(sub.target,iso)||pick(pool(sub.target),iso+':'+sub.target);
  }
  function newSession(iso,mode='30'){
    const q=chooseQuestion(iso),common=pick(commonPool(),iso+':common');
    return {date:iso,mode,questionId:q?.id||null,commonQuestionId:common?.id||null,phase:0,remaining:durations(iso,mode)[0]*60,elapsed:0,notes:[],rating:null,finished:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function loadToday(){const today=isoTaipei();session=store.sessions[today];if(!session){session=newSession(today);store.sessions[today]=session;persist();}return today;}
  function selectWeekPractice(iso){
    const today=isoTaipei(),start=dayIndex(today)-((dayNumber(today)+6)%7),index=dayIndex(iso);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(index)||index<start||index>dayIndex(today)){say('只能補練本週已過日期。');return;}
    pause();
    selectedPracticeDate=iso===today?null:iso;
    if(!store.sessions[iso]){
      const created=newSession(iso),subject=subjectFor(iso);
      // Use a date-seeded past-paper question rather than future rating data.
      const target=subject.sunday?'心理學':subject.target;
      const fallback=pick(pool(target),iso+':'+(subject.sunday?'sunday':target));
      created.questionId=fallback?.id||created.questionId;
      store.sessions[iso]=created;persist();
    }
    session=store.sessions[iso];
    render();
    if(iso!==today)say('已切換至 '+iso+' 的練習。這一天的作答、草稿及自評會獨立保存。');
    $('todayHeading').scrollIntoView({block:'start',behavior:'smooth'});
  }
  const currentQuestion=()=>BANK.find(q=>q.id===(subjectFor(session.date).sunday&&session.phase===1?session.commonQuestionId:session.questionId));
  // Essay practice is separate from the day's timed task, ratings and review queue.
  const essaySelectedSubject=()=>ESSAY_SUBJECTS.includes(session?.essayPracticeSubject)?session.essayPracticeSubject:'today';
  function essayQuestion(){
    const selected=essaySelectedSubject();
    if(selected==='today')return currentQuestion();
    const requested=session.essayReviewTargetId;
    if(requested&&!String(requested).startsWith('manual:')){const q=BANK.find(item=>item.id===requested);if(q&&candidateSubject(q,selected))return q;}
    if(requested&&String(requested).startsWith('manual:'))return null;
    return pick(pool(selected),`${session.date}:subject-essay:${selected}`);
  }
  function setEssaySubject(value){
    if(value!=='today'&&!ESSAY_SUBJECTS.includes(value))return;
    if(essaySelectedSubject()===value)return;
    // Do not mutate the day's actual questionId, notes, rating or timer.
    session.essayReviewTargetId=null;
    session.essayPracticeSubject=value;
    session.updatedAt=new Date().toISOString();
    persist();renderEssaySelection();
    window.dispatchEvent(new CustomEvent('study30:render'));
  }
  function renderEssaySelection(){
    const choice=essaySelectedSubject(),select=$('essayPracticeSubject');
    select.value=choice;
    $('essaySubjectNotice').textContent=choice==='today'?'跟隨今日題目；不更動原有每日練習流程。':`正在練習「${choice}」。草稿和自評按題目分開保存，不更動上方每日任務。`;
  }
  function saveEssayManualQuestion(id,text){
    const ctx=essayContext();
    if(!ctx||ctx.questionId!==id||!ctx.manual||!canSave||typeof text!=='string'||text.length>10000)return false;
    if(!session.essayCustomPrompts||typeof session.essayCustomPrompts!=='object'||Array.isArray(session.essayCustomPrompts))session.essayCustomPrompts={};
    session.essayCustomPrompts[id]=text;
    session.updatedAt=new Date().toISOString();persist();
    return canSave;
  }
  const hasEssayProgress=()=>Object.values(session?.essayDrafts||{}).some(d => !!(d && (String(d.fullAnswer||'').trim() || (Array.isArray(d.outline) && d.outline.some(x=>String(x||'').trim())))));
  const hasProgress=()=>session.elapsed>0||session.phase>0||session.notes.some(s=>String(s||'').trim())||session.finished||!!session.rating||!!session.errorCause||hasEssayProgress()||Object.keys(session?.essayAssessments||{}).length>0;
  const currentTotal=()=>durations(session.date,session.mode).length;
  function updateAnswer(){session.notes[session.phase]=$('answer').value;session.updatedAt=new Date().toISOString();persist();$('answerStatus').textContent='已保存於目前瀏覽器';renderControls();}
  function setMode(mode){if(hasProgress()){say('本日已有學習紀錄，為保留計時與草稿，不能中途更換訓練時間。');return;}session.mode=mode;session.remaining=durations(session.date,mode)[0]*60;persist();render();}
  function tick(){if(!running)return;const now=Date.now();const delta=Math.floor((now-lastTickMs)/1000);if(delta<=0)return;lastTickMs+=delta*1000;const spent=Math.min(delta,session.remaining);session.remaining-=spent;session.elapsed+=spent;session.updatedAt=new Date().toISOString();persist();$('timer').textContent=`${two(Math.floor(session.remaining/60))}:${two(session.remaining%60)}`;if(session.remaining===0){pause();say('這一段時間到了。先完成當前作答，再按「完成此步驟」前進。');}renderStats();}
  function pause(){tickIfNeeded();running=false;renderControls();}
  function tickIfNeeded(){if(!running)return;const now=Date.now(),delta=Math.floor((now-lastTickMs)/1000);if(delta>0){lastTickMs+=delta*1000;const used=Math.min(delta,session.remaining);session.remaining-=used;session.elapsed+=used;persist();}}
  function toggleTimer(){if(session.finished)return;if(running){pause();render();return;}if(session.remaining===0){say('本步驟時間已到，請按「完成此步驟」。');return;}running=true;lastTickMs=Date.now();$('notice').hidden=true;renderControls();}
  function nextPhase(){if(session.finished)return;pause();session.notes[session.phase]=$('answer').value;const previousRemaining=session.remaining;const isFinal=session.phase>=currentTotal()-1;if(isFinal){session.finished=true;session.completedAt=new Date().toISOString();session.remaining=0;}else{session.phase+=1;session.remaining=durations(session.date,session.mode)[session.phase]*60;}session.skippedSeconds=(session.skippedSeconds||0)+previousRemaining;session.updatedAt=new Date().toISOString();persist();render();if(isFinal)say('今日已自行標記完成，實際計時請看累計專注時間。記得選擇本題自評。');}
  function setRating(value){if(session.finished||['mastered','partial','review'].includes(value)){session.rating=value;session.updatedAt=new Date().toISOString();persist();renderStats();renderRatings();renderReviewPanel();renderControls();}}
  function setErrorCause(value){if(!session||!['','概念不熟','爭點辨識','案例涵攝','申論架構','法條或資料待查證','其他'].includes(value))return;session.errorCause=value;session.updatedAt=new Date().toISOString();persist();renderReviewPanel();}
  function renderErrorPanel(){const show=!!session&&['partial','review'].includes(session.rating);$('errorBox').hidden=!show;$('errorCause').value=session?.errorCause||'';}
  function questionHeading(q){return q?`${q.year||'歷年'}年｜${q.subject||''}｜第${q.questionNo||'?'}題`:'';}
  function renderQuestion(){const sub=subjectFor(session.date),q=currentQuestion(),isCommon=sub.sunday&&session.phase===1;
    $('subjectLabel').textContent=isCommon?'普通科目':q?(q.examTypes?.join('／')||q.examType||'歷屆試題'):sub.sunday?'週日錯題複習':'原站考古題';
    $('workTitle').textContent=q?questionHeading(q):(isCommon?'共同科目自主練習':'這一科暫無可對應的題目');
    $('questionText').textContent=q?.body|| (isCommon?'請前往考選部官方歷屆試題，選擇「法學知識與英文」一題練習，並自行記錄不熟悉的概念。':'原題庫沒有找到可直接對應的題目。請使用下方完整考古題入口選題。');
    const official=(q?.sourceUrl||'');$('originalSource').href=official&&/^https:\/\//.test(official)?official:'https://leokychen.github.io/probation-study-desk/v2.5/';$('originalSource').textContent=official?'考選部題源 ↗':'開啟原題庫 ↗';
    const titles=phaseTitles(session.date),phase=session.phase;
    $('promptTitle').textContent=titles[phase];
    let prompt='';
    if(sub.sunday){prompt=phase===0?'不看答案，重寫近期最不熟悉題目的核心爭點與分析，再檢查錯誤。':'完成一題共同科目練習，記下不熟悉的英文單字或法學概念；不另設每日英語提醒。';}
    else{prompt=[`在不看資料的情況下，寫出與「${sub.target}」相關的2至3個核心觀念、定義或法條。`,`閱讀本題題幹並嘗試作答。分辨題目要求、主要爭點與易混淆概念。`,`在8分鐘內列出國考申論架構：一、定義／規範；二、主要爭點；三、分析或涵攝；四、結論。`,`記下今天最容易犯的1至2個錯誤，以及下次要回想的問題。`][phase];}
    $('promptText').textContent=prompt;
    $('answer').value=session.notes[phase]||'';$('answer').disabled=!!session.finished;
    const ref=[];if(q?.points?.length)ref.push('【考點要求】\n'+q.points.join('\n'));if(q?.direction?.length)ref.push('【練習方向】\n'+q.direction.join('\n'));
    $('referenceContent').textContent=ref.length?ref.join('\n\n'):'本題尚無已核對的參考方向，請以教材及可靠來源核對。';$('referencePanel').open=false;
  }
  function renderRatings(){document.querySelectorAll('[data-rating]').forEach(b=>{const chosen=session.rating===b.dataset.rating;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});renderErrorPanel();}
  function renderControls(){const phaseTitlesNow=phaseTitles(session.date);$('sessionStatus').textContent=session.finished?'已標記完成':running?'計時中':session.elapsed>0||session.phase>0?'已暫停':'尚未開始';$('phaseLabel').textContent=phaseTitlesNow[session.phase]||'今日完成';$('timer').textContent=`${two(Math.floor(session.remaining/60))}:${two(session.remaining%60)}`;$('toggleTimer').textContent=running?'暫停計時':'開始／繼續';$('toggleTimer').disabled=!!session.finished;$('nextPhase').textContent=session.phase===currentTotal()-1?'標記今日完成':'完成此步驟';$('nextPhase').disabled=!!session.finished;for(const mode of ['30','10']){$('mode'+mode).setAttribute('aria-pressed',String(session.mode===mode));$('mode'+mode).disabled=hasProgress();}}
  function renderStats(){const today=isoTaipei(),w=weekNumber(today);let done=0,elapsed=0;const byId=new Map();for(const [day,s] of Object.entries(store.sessions)){if(weekNumber(day)===w&&s.finished)done+=1;elapsed+=Number(s.elapsed||0);if(s.questionId&&s.rating){const current=byId.get(s.questionId);if(!current||day>current.date)byId.set(s.questionId,{date:day,rating:s.rating});}}
    $('weeklyCount').textContent=`${done} / 7`;$('minuteCount').textContent=`${Math.floor(elapsed/60)} 分`;$('reviewCount').textContent=`${Review?Review.model(store.sessions,BANK,today).due.length:[...byId.values()].filter(x=>x.rating==='review').length} 題`;
    const weekStart=dayIndex(today)-((dayNumber(today)+6)%7);$('historyContent').replaceChildren();for(let i=0;i<7;i++){const d=new Date((weekStart+i)*86400000).toISOString().slice(0,10),s=store.sessions[d],cell=document.createElement('button');cell.type='button';cell.className='day-cell'+(d===today?' today':'')+(s?.finished?' finished':'')+(session?.date===d?' selected':'');cell.disabled=d>today;cell.setAttribute('aria-pressed',String(session?.date===d));cell.setAttribute('aria-label',d+' '+(s?.finished?'已完成':d>today?'尚未到來':'可進入練習'));cell.addEventListener('click',()=>selectWeekPractice(d));const strong=document.createElement('strong');strong.textContent='週'+'一二三四五六日'[i];const rest=document.createElement('span');rest.textContent=s?.finished?'完成':s?.elapsed?`${Math.floor(s.elapsed/60)}分`:'—';cell.append(strong,rest);$('historyContent').append(cell);} $('returnToday').hidden=session?.date===today; $('weekPracticeHint').textContent=session?.date===today?'點選本週已過日期，可補做或接續該日練習；未到日期不可提前作答。':'目前補練 '+session.date+'：進度、草稿及自評均按當天保存。';
  }
  function render(){const iso=isoTaipei();if(!selectedPracticeDate&&iso!==session.date){pause();loadToday();}const sub=subjectFor(session.date);$('todayDate').textContent=`${session.date}｜星期${DAY_NAMES[sub.day]}`;$('todayHeading').textContent=sub.label;$('todayDescription').textContent=sub.sunday?'錯題複習20分鐘＋共同科目10分鐘（快速版各6／4分鐘）':sub.day===6?`本週主攻：${sub.target}；下週交替。`:'今天只讀這一科，題目依科目從原站426題考古題庫選出（含相關類科）。';
    $('phases').replaceChildren();const lengths=durations(session.date,session.mode),names=phaseTitles(session.date);for(let i=0;i<names.length;i++){const li=document.createElement('li');li.className=i<session.phase?'done':i===session.phase?'active':'';li.setAttribute('aria-current',i===session.phase?'step':'false');const label=document.createElement('strong');label.textContent=names[i];const minutes=document.createElement('span');minutes.textContent=`${lengths[i]}分鐘`;li.append(label,minutes);$('phases').append(li);}
    renderControls();renderQuestion();renderRatings();renderStats();renderReviewPanel();renderEssaySelection();window.dispatchEvent(new CustomEvent('study30:render'));}
  function renderReviewPanel(){
    if(!Review)return;
    const model=Review.model(store.sessions,BANK,isoTaipei());
    $('dueCount').textContent=model.due.length+' 題';
    $('assessedCount').textContent=model.all.length+' 題';
    const mastered=model.all.filter(r=>r.rating==='mastered').length;
    $('masteryRate').textContent=model.all.length?Math.round(mastered*100/model.all.length)+'%':'—';
    const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
    const makeList=(id,list,empty,includeAction)=>{
      const host=$(id);host.replaceChildren();
      if(!list.length){host.append(make('p',empty,'empty-insight'));return;}
      for(const r of list.slice(0,8)){
        const card=make('div',undefined,'review-item');
        const head=make('div',undefined,'review-item-head');
        head.append(make('strong',r.subject+'｜'+r.topic),make('span',r.daysUntil<0?`逾期${-r.daysUntil}天`:r.daysUntil===0?'今天到期':`${r.daysUntil}天後`,'review-date'));
        card.append(head,make('p',r.rating==='review'?'上次自評：需要再複習':r.rating==='partial'?'上次自評：還不完整':'上次自評：能自行說明','muted tiny'));
        if(r.cause)card.append(make('p','補強原因：'+r.cause,'muted tiny'));
        if(includeAction){const b=make('button',session.questionId===r.id?'已安排為今日題目':'安排為今日題目','review-pick');b.type='button';b.disabled=hasProgress()||session.questionId===r.id;b.title=hasProgress()?'今日已開始或已自評，請先完成本日訓練':'不增加每天練習時間';b.addEventListener('click',()=>scheduleToday(r.id));card.append(b);}
        host.append(card);
      }
      if(list.length>8)host.append(make('p',`另有 ${list.length-8} 題，優先顯示最早到期者。`,'tiny muted'));
    };
    makeList('dueList',model.due,'目前沒有到期題。完成今日自評後，系統會安排下一次複習。',true);
    makeList('upcomingList',model.upcoming,'目前沒有已安排的未來複習題。',false);
    const subjectHost=$('subjectInsights');subjectHost.replaceChildren();
    if(!model.subjects.length)subjectHost.append(make('p','尚無自評資料，完成一題後會顯示。','empty-insight'));
    for(const s of model.subjects){
      const row=make('div',undefined,'insight-row'),label=make('span',s.label),count=make('strong',`掌握 ${s.mastered}/${s.studied} 題`);
      row.append(label,count);const meter=make('div',undefined,'meter'),fill=make('div');fill.style.width=(s.mastered/s.studied*100)+'%';meter.append(fill);row.append(meter,make('small',`待補強 ${s.partial+s.review} 題 · 到期 ${s.overdue} 題`));subjectHost.append(row);
    }
    const topicHost=$('topicInsights');topicHost.replaceChildren();
    const low=model.topics.filter(s=>s.review+s.partial>0);
    if(!low.length)topicHost.append(make('p','目前沒有標記為待補強的考點。','empty-insight'));
    for(const t of low.slice(0,6)){
      const row=make('div',undefined,'topic-row');row.append(make('strong',t.label),make('span',t.subject+' · 需補強 '+(t.review+t.partial)+' 題'));topicHost.append(row);
    }
  }
  function scheduleToday(id){
    if(hasProgress()){say('今天已有計時、草稿或自評，為避免覆寫紀錄，不能更換題目。');return;}
    const candidate=BANK.find(q=>q.id===id);
    if(!candidate)return;
    pause();
    session.questionId=id;
    session.notes=[];session.rating=null;session.errorCause='';session.essayDrafts={};session.essayAssessments={};session.phase=0;
    session.remaining=durations(session.date,session.mode)[0]*60;
    session.recommendedManually=true;session.updatedAt=new Date().toISOString();persist();render();
    say('已將「'+Review.topic(candidate)+'」安排為今天的訓練題目。');
    document.getElementById('todayHeading').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function exportData(){const backup={format:'probation-study30-v252',version:1,exportedAt:new Date().toISOString(),data:store};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`study30-backup-${isoTaipei()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function openClearRecords(){if(selectedPracticeDate){say('補練其他日期時不能清除紀錄，請先返回今天。');return;}
    pause();
    const dialog=$('clearRecordsDialog');
    $('clearRecordsForm').reset();
    $('clearConfirmation').value='';
    $('confirmClearRecords').disabled=true;
    dialog.showModal();
  }
  function clearRecords(event){
    event.preventDefault();
    if($('clearConfirmation').value.trim()!=='清除')return;
    const scope=document.querySelector('input[name="clearScope"]:checked')?.value;
    if(scope!=='today'&&scope!=='all')return;
    // Final irreversible-action confirmation, after the user has typed the phrase.
    const message=scope==='all'?'確定要刪除「每日30分鐘」全部日期的學習紀錄嗎？此操作無法復原。':'確定要重設今天的計時、作答及自評嗎？此操作無法復原。';
    if(!window.confirm(message))return;
    pause();
    try{
      if(scope==='all'){
        // Deleting only our namespaced key avoids changing any existing v2.5 data.
        localStorage.removeItem(KEY);
        window.PSDLocalJournal?.note(KEY);
        store=blank();
      }else{
        const next={...store,sessions:{...store.sessions}};
        delete next.sessions[isoTaipei()];
        localStorage.setItem(KEY,JSON.stringify(next));
        window.PSDLocalJournal?.note(KEY);
        store=next;
      }
    }catch(error){
      say('清除失敗：瀏覽器無法修改本機儲存空間，原本的紀錄仍保留。');
      $('clearRecordsDialog').close();
      return;
    }
    canSave=true;
    session=null;
    running=false;
    loadToday();
    render();
    $('clearRecordsDialog').close();
    say(scope==='all'?'已清除每日30分鐘模組的全部紀錄；今日任務重新開始。':'今天的學習紀錄已清除，可以重新開始。');
  }
  function start(){load();loadToday();if(!BANK.length)say('未能載入正式 v2.5 考古題。請確認網路連線與原站題庫是否正常；測試站需連線讀取既有題庫。');$('essayPracticeSubject').addEventListener('change',e=>setEssaySubject(e.target.value));$('mode30').addEventListener('click',()=>setMode('30'));$('mode10').addEventListener('click',()=>setMode('10'));$('toggleTimer').addEventListener('click',toggleTimer);$('nextPhase').addEventListener('click',nextPhase);$('answer').addEventListener('input',updateAnswer);document.querySelectorAll('[data-rating]').forEach(b=>b.addEventListener('click',()=>setRating(b.dataset.rating)));$('export').addEventListener('click',exportData);$('errorCause').addEventListener('change',e=>setErrorCause(e.target.value));$('openClearRecords').addEventListener('click',openClearRecords);$('returnToday').addEventListener('click',()=>selectWeekPractice(isoTaipei()));$('cancelClearRecords').addEventListener('click',()=>$('clearRecordsDialog').close());$('backupBeforeClear').addEventListener('click',exportData);$('clearConfirmation').addEventListener('input',()=>$('confirmClearRecords').disabled=$('clearConfirmation').value.trim()!=='清除');$('clearRecordsForm').addEventListener('submit',clearRecords);document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();render();}});window.addEventListener('pagehide',()=>{if(running)pause();});window.setInterval(()=>{tick();if(session&&!selectedPracticeDate&&isoTaipei()!==session.date&&!running)render();},250);render();}
  // v2.5.3 essay drafts stay within the existing session object, so JSON backup and
  // "clear today/all" cover them without creating a second storage key.
  function essayContext(){
    if(!session)return null;
    const selected=essaySelectedSubject(),q=essayQuestion();
    const id=q?.id||(session.essayReviewTargetId?.startsWith('manual:')?session.essayReviewTargetId:selected==='today'?`unassigned:${session.date}:${session.phase}`:`manual:${session.date}:${selected}`);
    const raw=session.essayDrafts?.[id];
    const draft=raw&&typeof raw==='object'?{
      template:raw.template==='law'||raw.template==='theory'?raw.template:null,
      outline:Array.isArray(raw.outline)?raw.outline.slice(0,4).map(x=>String(x||'')):['','','',''],
      fullAnswer:String(raw.fullAnswer||''),updatedAt:raw.updatedAt||null
    }:{template:null,outline:['','','',''],fullAnswer:'',updatedAt:null};
    return {date:session.date,sessionToken:session.createdAt||null,questionId:id,
      questionHeading:q?questionHeading(q):selected==='today'?'今日自主練習':`${selected}｜自選申論題`,
      questionBody:String(q?.body||''),questionSource:/^https:\/\//.test(String(q?.sourceUrl||''))?q.sourceUrl:'',
      subject:selected==='today'?(q?.subject||subjectFor(session.date).target):selected,
      manual:!q,customPrompt:String(session.essayCustomPrompts?.[id]||Object.values(store.sessions).find(s=>typeof s?.essayCustomPrompts?.[id]==='string')?.essayCustomPrompts?.[id]||''),
      finished:!!session.finished,mode:session.mode,phase:session.phase,draft};
  }
  function saveEssay(id,data){
    const current=essayContext();
    if(!current||current.questionId!==id||!canSave)return false;
    if(!data||!['law','theory'].includes(data.template)||!Array.isArray(data.outline)||data.outline.length!==4||!data.outline.every(x=>typeof x==='string')||typeof data.fullAnswer!=='string')return false;
    // Bound the maximum amount written to browser storage; do not truncate silently.
    if(data.fullAnswer.length>120000||data.outline.some(x=>x.length>30000))return false;
    if(!session.essayDrafts||typeof session.essayDrafts!=='object'||Array.isArray(session.essayDrafts))session.essayDrafts={};
    session.essayDrafts[id]={template:data.template,outline:data.outline.slice(),fullAnswer:data.fullAnswer,updatedAt:new Date().toISOString()};
    session.updatedAt=new Date().toISOString();
    persist();renderControls();
    return canSave;
  }
  // Rubric records are stored under the same day's study30 session.
  // This preserves all historical JSON backup behaviour and keeps v2.5 untouched.
  function essayAssessmentContext(){
    const ctx=essayContext();
    if(!ctx)return null;
    const raw=session.essayAssessments?.[ctx.questionId];
    const assessment=raw&&typeof raw==='object'&&!Array.isArray(raw)?structuredClone(raw):null;
    return {...ctx,assessment};
  }
  function saveEssayAssessment(id,data){
    const ctx=essayContext(),type=window.Study30Rubric?.subjectType(ctx?.subject);
    if(!ctx||ctx.questionId!==id||!canSave||!window.Study30Rubric?.validate(type,data))return false;
    if(!session.essayAssessments||typeof session.essayAssessments!=='object'||Array.isArray(session.essayAssessments))session.essayAssessments={};
    session.essayAssessments[id]={
      version:1,rubric:type,subject:ctx.subject,questionHeading:ctx.questionHeading,scores:{...data.scores},issues:data.issues.slice(),nextStep:data.nextStep,
      assessedAt:new Date().toISOString(),draftUpdatedAt:ctx.draft?.updatedAt||null
    };
    session.updatedAt=new Date().toISOString();
    persist();renderControls();
    return canSave;
  }
  function getEssayReviewData(){return {sessions:structuredClone(store.sessions),bank:BANK,today:isoTaipei(),todaySubject:subjectFor(isoTaipei()).target};}
 function openEssayReview(id,subject){
   if(!ESSAY_SUBJECTS.includes(subject)||typeof id!=='string'||id.length>300)return false;
   const valid=Object.values(store.sessions).some(s=>s?.essayAssessments&&Object.prototype.hasOwnProperty.call(s.essayAssessments,id));
   if(!valid)return false;
   const q=BANK.find(q=>q.id===id);
   if(q&&!candidateSubject(q,subject))return false;
   if(!q&&(!id.startsWith('manual:')||!id.endsWith(':'+subject)))return false;
   session.essayPracticeSubject=subject;
   session.essayReviewTargetId=id;
   session.updatedAt=new Date().toISOString();persist();renderEssaySelection();
   window.dispatchEvent(new CustomEvent('study30:render'));
   return true;
 }
 function prepareBackupRestore(){pause();}
 function saveAiReview(id,text) {
  if(!session||typeof id!=='string'||!id||id.length>300||typeof text!=='string'||text.length>120000)throw Error('AI評語格式或長度不符');
  if(!canSave)throw Error('本機儲存不可用');
  const prev=session.aiReviewTexts, prevTime=session.updatedAt;
  session.aiReviewTexts={...(prev||{}),[id]:text};
  session.updatedAt=new Date().toISOString();
  try { localStorage.setItem(KEY,JSON.stringify(store));window.PSDLocalJournal?.note(KEY); }
  catch(e){session.aiReviewTexts=prev;session.updatedAt=prevTime;throw e;}
}
function readAiReview(id) {
  if(!session||typeof id!=='string'||!id)return '';
  if(Object.prototype.hasOwnProperty.call(session.aiReviewTexts||{},id))return String(session.aiReviewTexts[id]||'');
  for(const [,rec] of Object.entries(store.sessions).sort((a,b)=>b[0].localeCompare(a[0])))
    if(rec?.aiReviewTexts&&Object.prototype.hasOwnProperty.call(rec.aiReviewTexts,id))return String(rec.aiReviewTexts[id]||'');
  return '';
}
function currentDailyQuestion(){return currentQuestion();}
window.Study30App={essayContext,saveEssay,saveEssayManualQuestion,essayAssessmentContext,saveEssayAssessment,getEssayReviewData,openEssayReview,prepareBackupRestore,saveAiReview,readAiReview,currentDailyQuestion};
  window.Study30Planner={isoTaipei,subjectFor,durations,normalSubject,candidateSubject,hash};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
