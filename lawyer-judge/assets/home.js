/* 首頁：今日任務、倒數、學習概況。只讀取既有紀錄；唯一會寫入的是倒數設定 psd-home-exam-countdown-v1。 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const taipeiIso=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
  function read(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}

  /* ---------- 今日任務 ---------- */
  function renderToday(){
    const iso=taipeiIso(),sub=window.StudySchedule.subjectFor(iso);
    const wd='日一二三四五六'[sub.day],[y,m,d]=iso.split('-');
    $('home-date').textContent=`${y}.${m}.${d} · 星期${wd}`;
    $('today-heading').textContent=sub.sunday?'綜合複習＋共同科目':`今天專心 30 分鐘：${sub.label}`;
    if(sub.sunday){
      $('today-kicker').textContent='今日任務 · 複習日';
      $('today-desc').textContent='錯題複習 20 分鐘、共同科目 10 分鐘（快速版各 6／4 分鐘）。';
      $('today-steps').hidden=true;$('today-time').textContent='約 30 分鐘';
    }else{
      $('today-kicker').textContent='今日任務 · '+sub.target;
      $('today-desc').textContent=sub.day===1?`本週主攻：${sub.target}；憲法與行政法隔週交替。`:sub.day===6?`本週主攻：${sub.target}；公司法、保險法、證券交易法與選試科目每週輪替。`:'題目依科目，從你匯入的題庫選出。';
    }
  }

  /* ---------- 學習概況 ---------- */
  function renderStats(){
    const iso=taipeiIso();
    // 每日30分鐘：與 professional/ 相同的週數與完成規則
    const wk=s=>Math.floor((Date.parse(s+'T00:00:00Z')-Date.UTC(2026,9,12))/(7*86400000));
    const s30=read('probation-study30-v251:v1'),sessions=s30&&s30.sessions&&typeof s30.sessions==='object'?s30.sessions:{};
    let done=0,elapsed=0;
    for(const [day,s] of Object.entries(sessions)){if(!s||typeof s!=='object')continue;if(wk(day)===wk(iso)&&s.finished)done++;elapsed+=Number(s.elapsed||0);}
    $('stat-week').textContent=`${done} / 7 天`;
    $('stat-minutes').textContent=elapsed>=3600?`${(elapsed/3600).toFixed(1)} 小時`:`${Math.floor(elapsed/60)} 分鐘`;
    // 到期複習：選擇題錯題本（此頁不載入題庫，用紀錄裡的到期日）＋申論自評（需題庫，改到複習頁精確計算）
    const mc=read('psd-mcq-v1'),rec=mc&&mc.records&&typeof mc.records==='object'?mc.records:{};
    const mcqDue=Object.values(rec).filter(r=>r&&r.w&&r.d&&r.d<=iso).length;
    const dueEl=$('stat-due').querySelector('a');
    dueEl.textContent=mcqDue?`${mcqDue} 題（選擇題）`:'到複習頁查看';
    // 函授
    const lec=read('psd-lecture-planner-v1');
    if(lec&&Array.isArray(lec.lessons)&&lec.lessons.length){
      const ok=lec.lessons.filter(l=>l&&l.watchedMinutes>=l.durationMinutes).length;
      $('stat-lessons').querySelector('a').textContent=`${ok} / ${lec.lessons.length} 堂`;
    }
  }

  /* ---------- 倒數（儲存鍵與格式沿用） ---------- */
  const STORE_KEY='psd-home-exam-countdown-v1';
  const card=$('countdown-card'),value=$('countdown-value'),eventLabel=$('countdown-event-label'),dateCaption=$('countdown-date-caption'),settings=$('countdown-settings'),form=$('countdown-form'),nameInput=$('event-name'),dateInput=$('exam-date'),message=$('settings-message');
  let config=null,extra={style:'standard',accent:'mint'};
  function parseCivilDate(input){
    if(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input))return null;
    const [year,month,day]=input.split('-').map(Number);
    if(year<2000||year>2100)return null;
    const d=new Date(Date.UTC(year,month-1,day));
    if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
    return {year,month,day,serial:Date.UTC(year,month-1,day)/86400000};
  }
  function todaySerial(){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day))/86400000;
  }
  function normalize(raw){
    if(!raw||!parseCivilDate(raw.date))return null;
    return {date:raw.date,name:typeof raw.name==='string'?raw.name.trim().slice(0,24)||'律師／司法官考試':'律師／司法官考試',style:raw.style==='large'?'large':'standard',accent:['mint','emerald','cream'].includes(raw.accent)?raw.accent:'mint'};
  }
  function renderCountdown(){
    value.classList.toggle('is-empty',!config||false);
    if(!config){eventLabel.textContent='考試倒數';dateCaption.textContent='';value.textContent='尚未設定考試日期';return;}
    const exam=parseCivilDate(config.date),days=exam.serial-todaySerial();
    eventLabel.textContent=`距離${config.name}`;
    dateCaption.textContent=`${exam.year}/${String(exam.month).padStart(2,'0')}/${String(exam.day).padStart(2,'0')}`;
    value.classList.toggle('is-empty',false);
    value.textContent=days>0?`${days} 天`:days===0?'就是今天！':`已結束 ${Math.abs(days)} 天`;
  }
  function fill(){nameInput.value=config?config.name:'律師／司法官考試';dateInput.value=config?config.date:'';}
  try{config=normalize(JSON.parse(localStorage.getItem(STORE_KEY)||'null'));}catch{config=null;}
  if(config)extra={style:config.style,accent:config.accent};
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const next=normalize({date:dateInput.value,name:nameInput.value,style:extra.style,accent:extra.accent});
    if(!next){message.textContent='請填入有效日期（2000年至2100年）。';return;}
    try{localStorage.setItem(STORE_KEY,JSON.stringify(next));config=next;renderCountdown();settings.open=false;message.textContent='倒數以臺灣日期計算，設定只儲存在目前瀏覽器，不會影響作答紀錄。';}
    catch{config=next;renderCountdown();message.textContent='已更新本次畫面，但瀏覽器無法儲存設定；重新開啟後可能需要重設。';}
  });
  $('reset-countdown').addEventListener('click',()=>{
    try{localStorage.removeItem(STORE_KEY);}catch{message.textContent='瀏覽器無法清除已儲存設定。';return;}
    config=null;fill();renderCountdown();settings.open=false;
  });
  function refresh(){renderToday();renderStats();renderCountdown();}
  fill();refresh();
  setInterval(refresh,60000);
  window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
