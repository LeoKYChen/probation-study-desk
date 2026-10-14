/* v2.5.1 study30: independent localStorage namespace, no writes to v2.5 data. */
(() => {
  'use strict';
  const KEY = 'probation-study30-v251:v1';
  const $ = id => document.getElementById(id);
  const DAY_NAMES = ['日','一','二','三','四','五','六'];
  const SUBJECTS = {1:'心理學',2:'諮商與輔導',3:'犯罪學',4:'少年事件處理法',5:'刑法'};
  const BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
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
  const pool = target => BANK.filter(q=>examIsProbation(q)&&candidateSubject(q,target));
  const commonPool = () => BANK.filter(q=>examIsProbation(q)&&/法學知識|英文|國文/.test(String(q.subject||'')));
  const pick = (list,seed) => list.length ? list[hash(seed)%list.length] : null;
  const durations = (iso,mode) => subjectFor(iso).sunday ? (String(mode)==='10'?[6,4]:[20,10]) : (String(mode)==='10'?[2,5,2,1]:[5,15,8,2]);
  const phaseTitles = (iso) => subjectFor(iso).sunday ? ['錯題重答與複習','共同科目'] : ['主動回想','理解與解題','申論架構','錯誤整理'];
  const blank = () => ({version:1,sessions:{}});
  let store=blank(),session=null,running=false,lastTickMs=0,canSave=true;
  const say = message=>{$('notice').textContent=message;$('notice').hidden=false;};
  function load(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.version===1&&parsed.sessions&&typeof parsed.sessions==='object'&&!Array.isArray(parsed.sessions))store=parsed;else throw Error('版本不符');}}catch(e){canSave=false;say('無法讀取30分鐘紀錄，未覆寫原資料。本次可練習，但離開前務必匯出備份。');}}
  function persist(){if(!canSave)return;try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){canSave=false;say('目前瀏覽器無法保存30分鐘紀錄。請使用「匯出本模組紀錄 JSON」備份。');}}
  const priorRecords = () => Object.entries(store.sessions).sort(([a],[b])=>b.localeCompare(a));
  function newestRatingById(){const result=new Map();for(const [date,s] of priorRecords()){if(s?.questionId&&!result.has(s.questionId)&&s.rating)result.set(s.questionId,{rating:s.rating,date});}return result;}
  function reviewCandidate(target,iso){const ratings=newestRatingById();const eligible=pool(target).filter(q=>{const r=ratings.get(q.id);return r?.rating==='review'&&dayIndex(iso)-dayIndex(r.date)>=3;});return eligible.sort((a,b)=>dayIndex(ratings.get(a.id).date)-dayIndex(ratings.get(b.id).date))[0]||null;}
  function chooseQuestion(iso){const sub=subjectFor(iso);if(sub.sunday){const prior=priorRecords().filter(([d,s])=>d<iso&&s?.questionId);const rated=prior.filter(([d,s])=>s.rating==='review');const from=(rated[0]||prior[0])?.[1]?.questionId;return BANK.find(q=>q.id===from)||pick(pool('心理學'),iso+':sunday');}
    return reviewCandidate(sub.target,iso)||pick(pool(sub.target),iso+':'+sub.target);
  }
  function newSession(iso,mode='30'){
    const q=chooseQuestion(iso),common=pick(commonPool(),iso+':common');
    return {date:iso,mode,questionId:q?.id||null,commonQuestionId:common?.id||null,phase:0,remaining:durations(iso,mode)[0]*60,elapsed:0,notes:[],rating:null,finished:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function loadToday(){const today=isoTaipei();session=store.sessions[today];if(!session){session=newSession(today);store.sessions[today]=session;persist();}return today;}
  const currentQuestion=()=>BANK.find(q=>q.id===(subjectFor(session.date).sunday&&session.phase===1?session.commonQuestionId:session.questionId));
  const hasProgress=()=>session.elapsed>0||session.phase>0||session.notes.some(s=>String(s||'').trim())||session.finished;
  const currentTotal=()=>durations(session.date,session.mode).length;
  function updateAnswer(){session.notes[session.phase]=$('answer').value;session.updatedAt=new Date().toISOString();persist();$('answerStatus').textContent='已保存於目前瀏覽器';renderControls();}
  function setMode(mode){if(hasProgress()){say('本日已有學習紀錄，為保留計時與草稿，不能中途更換訓練時間。');return;}session.mode=mode;session.remaining=durations(session.date,mode)[0]*60;persist();render();}
  function tick(){if(!running)return;const now=Date.now();const delta=Math.floor((now-lastTickMs)/1000);if(delta<=0)return;lastTickMs+=delta*1000;const spent=Math.min(delta,session.remaining);session.remaining-=spent;session.elapsed+=spent;session.updatedAt=new Date().toISOString();persist();$('timer').textContent=`${two(Math.floor(session.remaining/60))}:${two(session.remaining%60)}`;if(session.remaining===0){pause();say('這一段時間到了。先完成當前作答，再按「完成此步驟」前進。');}renderStats();}
  function pause(){tickIfNeeded();running=false;renderControls();}
  function tickIfNeeded(){if(!running)return;const now=Date.now(),delta=Math.floor((now-lastTickMs)/1000);if(delta>0){lastTickMs+=delta*1000;const used=Math.min(delta,session.remaining);session.remaining-=used;session.elapsed+=used;persist();}}
  function toggleTimer(){if(session.finished)return;if(running){pause();render();return;}if(session.remaining===0){say('本步驟時間已到，請按「完成此步驟」。');return;}running=true;lastTickMs=Date.now();$('notice').hidden=true;renderControls();}
  function nextPhase(){if(session.finished)return;pause();session.notes[session.phase]=$('answer').value;const previousRemaining=session.remaining;const isFinal=session.phase>=currentTotal()-1;if(isFinal){session.finished=true;session.completedAt=new Date().toISOString();session.remaining=0;}else{session.phase+=1;session.remaining=durations(session.date,session.mode)[session.phase]*60;}session.skippedSeconds=(session.skippedSeconds||0)+previousRemaining;session.updatedAt=new Date().toISOString();persist();render();if(isFinal)say('今日已自行標記完成，實際計時請看累計專注時間。記得選擇本題自評。');}
  function setRating(value){session.rating=value;session.updatedAt=new Date().toISOString();persist();renderStats();renderRatings();}
  function questionHeading(q){return q?`${q.year||'歷年'}年｜${q.subject||''}｜第${q.questionNo||'?'}題`:'';}
  function renderQuestion(){const sub=subjectFor(session.date),q=currentQuestion(),isCommon=sub.sunday&&session.phase===1;
    $('subjectLabel').textContent=isCommon?'普通科目':sub.sunday?'週日錯題複習':'觀護人考畢試題';
    $('workTitle').textContent=q?questionHeading(q):(isCommon?'共同科目自主練習':'這一科暫無可對應的題目');
    $('questionText').textContent=q?.body|| (isCommon?'請前往考選部官方歷屆試題，選擇「法學知識與英文」一題練習，並自行記錄不熟悉的概念。':'原題庫沒有找到可直接對應的題目。請使用下方完整考古題入口選題。');
    const official=(q?.sourceUrl||'');$('originalSource').href=official&&/^https:\/\//.test(official)?official:'../v2.5/';$('originalSource').textContent=official?'考選部題源 ↗':'開啟原題庫 ↗';
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
  function renderRatings(){document.querySelectorAll('[data-rating]').forEach(b=>{const chosen=session.rating===b.dataset.rating;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});}
  function renderControls(){const phaseTitlesNow=phaseTitles(session.date);$('sessionStatus').textContent=session.finished?'已標記完成':running?'計時中':session.elapsed>0||session.phase>0?'已暫停':'尚未開始';$('phaseLabel').textContent=phaseTitlesNow[session.phase]||'今日完成';$('timer').textContent=`${two(Math.floor(session.remaining/60))}:${two(session.remaining%60)}`;$('toggleTimer').textContent=running?'暫停計時':'開始／繼續';$('toggleTimer').disabled=!!session.finished;$('nextPhase').textContent=session.phase===currentTotal()-1?'標記今日完成':'完成此步驟';$('nextPhase').disabled=!!session.finished;for(const mode of ['30','10']){$('mode'+mode).setAttribute('aria-pressed',String(session.mode===mode));$('mode'+mode).disabled=hasProgress();}}
  function renderStats(){const today=isoTaipei(),w=weekNumber(today);let done=0,elapsed=0;const byId=new Map();for(const [day,s] of Object.entries(store.sessions)){if(weekNumber(day)===w&&s.finished)done+=1;elapsed+=Number(s.elapsed||0);if(s.questionId&&s.rating){const current=byId.get(s.questionId);if(!current||day>current.date)byId.set(s.questionId,{date:day,rating:s.rating});}}
    $('weeklyCount').textContent=`${done} / 7`;$('minuteCount').textContent=`${Math.floor(elapsed/60)} 分`;$('reviewCount').textContent=`${[...byId.values()].filter(x=>x.rating==='review').length} 題`;
    const weekStart=dayIndex(today)-((dayNumber(today)+6)%7);$('historyContent').replaceChildren();for(let i=0;i<7;i++){const d=new Date((weekStart+i)*86400000).toISOString().slice(0,10),s=store.sessions[d],cell=document.createElement('div');cell.className='day-cell'+(d===today?' today':'')+(s?.finished?' finished':'');const strong=document.createElement('strong');strong.textContent='週'+'一二三四五六日'[i];const rest=document.createElement('span');rest.textContent=s?.finished?'完成':s?.elapsed?`${Math.floor(s.elapsed/60)}分`:'—';cell.append(strong,rest);$('historyContent').append(cell);}
  }
  function render(){const iso=isoTaipei();if(iso!==session.date){pause();loadToday();}const sub=subjectFor(session.date);$('todayDate').textContent=`${session.date}｜星期${DAY_NAMES[sub.day]}`;$('todayHeading').textContent=sub.label;$('todayDescription').textContent=sub.sunday?'錯題複習20分鐘＋共同科目10分鐘（快速版各6／4分鐘）':sub.day===6?`本週主攻：${sub.target}；下週交替。`:'今天只讀這一科，題目從既有觀護人考古題庫選出。';
    $('phases').replaceChildren();const lengths=durations(session.date,session.mode),names=phaseTitles(session.date);for(let i=0;i<names.length;i++){const li=document.createElement('li');li.className=i<session.phase?'done':i===session.phase?'active':'';li.setAttribute('aria-current',i===session.phase?'step':'false');const label=document.createElement('strong');label.textContent=names[i];const minutes=document.createElement('span');minutes.textContent=`${lengths[i]}分鐘`;li.append(label,minutes);$('phases').append(li);}
    renderControls();renderQuestion();renderRatings();renderStats();}
  function exportData(){const backup={format:'probation-study30-v251',version:1,exportedAt:new Date().toISOString(),data:store};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`study30-backup-${isoTaipei()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function start(){load();loadToday();if(!BANK.length)say('未載入 v2.5 考古題，請確認 study30 目錄與 v2.5 同層部署。');$('mode30').addEventListener('click',()=>setMode('30'));$('mode10').addEventListener('click',()=>setMode('10'));$('toggleTimer').addEventListener('click',toggleTimer);$('nextPhase').addEventListener('click',nextPhase);$('answer').addEventListener('input',updateAnswer);document.querySelectorAll('[data-rating]').forEach(b=>b.addEventListener('click',()=>setRating(b.dataset.rating)));$('export').addEventListener('click',exportData);document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();render();}});window.addEventListener('pagehide',()=>{if(running)pause();});window.setInterval(()=>{tick();if(session&&isoTaipei()!==session.date&&!running)render();},250);render();}
  window.Study30Planner={isoTaipei,subjectFor,durations,normalSubject,candidateSubject,hash};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
