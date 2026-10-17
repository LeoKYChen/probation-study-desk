/* v2.5.4: daily simulation 30-minute writing practice. GPL-3.0-only.
   Shares the exact daily answer key and backup format with daily-simulation/.
   AI grading is clipboard-based; no external API and no records uploaded. */
(function(){
'use strict';
const M=window.PracticeModel, AI=window.AISimpleReview254;
const KEY='probation-daily-github:records:v1';
const DATA_KEY='daily-reading-test:dataset';
const TIMER_KEY='probation-daily-30min:session:v1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bank=null,records={},current='',storageOK=true,dirty=false,saveJob=0,timers={};
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function getQuestion(){return bank?.questions.find(q=>q.id===current)||null;}
function readRecords(){
  try{records=M.records(JSON.parse(localStorage.getItem(KEY)||'{}'));storageOK=true;}
  catch(error){storageOK=false;notice('本機作答紀錄無法正常讀取，已暫停寫入，避免覆蓋原紀錄。請先保留原備份。',true);}
}
function loadTimers(){
  try{const v=JSON.parse(sessionStorage.getItem(TIMER_KEY)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))timers=v;}catch{timers={};}
}
function writeTimers(){try{sessionStorage.setItem(TIMER_KEY,JSON.stringify(timers));}catch{ /* Timer still works in this open page. */ }}
function persist(next){if(!storageOK)throw Error('原本紀錄不可讀，為防止覆蓋已停止寫入');M.records(next);localStorage.setItem(KEY,JSON.stringify(next));}
const DRAFT_FIELDS=[['draftIssue','issues','一、題目爭點'],['draftBasis','basis','二、法律或學理依據'],['draftAnalysis','analysis','三、涵攝與實務應用'],['draftConclusion','conclusion','四、結論']];
function recordFor(id){return records[id]||{answer:'',review:false,updatedAt:''};}
function readDrafts(){
  return Object.fromEntries(DRAFT_FIELDS.map(([element,key])=>[key,$(element).value]));
}
function draftsFor(record){
  const drafts=record?.essayDrafts;
  return drafts&&typeof drafts==='object'&&!Array.isArray(drafts)?drafts:{};
}
function updateDraftCount(){
  const count=DRAFT_FIELDS.reduce((n,[element])=>n+$(element).value.length,0);
  $('draftWordCount').textContent='草稿 '+count+' 字';
}
function updateSummary(){
  if(!bank)return;
  $('count').textContent=bank.questions.length;
  $('written').textContent=bank.questions.filter(q=>(records[q.id]?.answer||'').trim()).length+' 題已有作答';
}
function title(q){return M.title(q);}
function renderList(){
  if(!bank)return;
  const subject=$('subject').value,query=$('search').value.trim().toLowerCase();
  const list=[...bank.questions].filter(q=>(!subject||M.subject(q)===subject)&&(!query||[q.date,q.subject,q.question,q.issues,q.outline].join(' ').toLowerCase().includes(query)))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  $('matches').textContent='符合條件 '+list.length+' 題';
  $('questionList').innerHTML=list.map(q=>{
    const r=records[q.id],s=r?.review?'★ 待複習':r?.answer.trim()?'✓ 已作答':'尚未作答';
    return '<button type="button" class="question-entry '+(q.id===current?'active':'')+'" data-id="'+esc(q.id)+'" aria-pressed="'+String(q.id===current)+'">'+
      '<small>'+esc(q.date)+' · '+esc(M.subject(q))+'</small><strong>'+esc(title(q))+'</strong><small>'+esc(s)+'</small></button>';
  }).join('')||'<p class="subtle">沒有符合條件的題目。</p>';
  updateSummary();
}
function flush(){
  if(!dirty)return;
  if(saveJob){clearTimeout(saveJob);saveJob=0;}
  const q=getQuestion();if(!q)return;
  const old=recordFor(current);
  const candidate={...old,answer:$('answer').value,essayDrafts:readDrafts(),review:$('review').checked,aiFeedback:$('aiFeedback').value,updatedAt:new Date().toISOString(),questionSnapshot:M.signature(q)};
  try{
    persist({...records,[current]:candidate});
    records[current]=candidate;dirty=false;
    $('saved').textContent='已保存';
    $('feedbackStatus').textContent=candidate.aiFeedback?'本題 AI 評語已保存':'';
    renderList();
  }catch(error){
    $('saved').textContent='尚未保存';
    $('feedbackStatus').textContent='儲存失敗：'+error.message+'。請複製文字另存，勿關閉頁面。';
    notice('儲存失敗，現有紀錄未覆蓋：'+error.message,true);
  }
}
function scheduleSave(){dirty=true;$('saved').textContent='儲存中…';clearTimeout(saveJob);saveJob=setTimeout(()=>{saveJob=0;flush();},250);}
function showQuestion(id){
  if(current===id&&getQuestion())return;
  if(dirty)flush();
  if(dirty){notice('上一題尚未成功保存；請先備份或複製作答，避免遺失。',true);return;}
  const q=bank?.questions.find(x=>x.id===id);if(!q)return;
  current=id;
  const record=recordFor(id);
  $('empty').hidden=true;$('workspace').hidden=false;
  $('meta').textContent=q.date+' · '+M.subject(q)+' · 模擬題（非官方試題）';
  $('questionTitle').textContent=title(q);
  $('questionText').textContent=q.question;
  $('answer').value=record.answer||'';
  const drafts=draftsFor(record);
  for(const [element,key] of DRAFT_FIELDS)$(element).value=typeof drafts[key]==='string'?drafts[key]:'';
  updateDraftCount();
  $('review').checked=!!record.review;
  $('aiFeedback').value=record.aiFeedback||'';
  $('wordCount').textContent=$('answer').value.length+' 字';
  $('saved').textContent=record.updatedAt?'已讀取既有作答':'尚未作答';
  $('copyStatus').textContent='';
  $('exportEssayStatus').textContent='';
  $('feedbackStatus').textContent=record.aiFeedback?'已載入本題 AI 評語':'';
  $('issues').textContent=q.issues||'題庫未提供。';
  $('outline').textContent=q.outline||'題庫未提供。';
  $('browseSource').href='../daily-simulation/?subject='+encodeURIComponent(M.subject(q));
  $('answer').setAttribute('aria-label','完整答案：'+title(q));
  if(record.questionSnapshot&&record.questionSnapshot!==M.signature(q)){
    notice('注意：本題題幹或參考內容曾更新，原答案與 AI 評語仍保留，請重新核對。');
  }
  renderList();updateTimer();
  $('workspace').scrollIntoView({block:'start',behavior:'smooth'});
}
function formatSeconds(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function updateTimer(){
  if(!current)return;
  const timer=timers[current],active=timer&&Number.isFinite(timer.deadline);
  const left=active?Math.max(0,Math.ceil((timer.deadline-Date.now())/1000)):1800;
  $('timer').textContent=formatSeconds(left);
  $('timer').classList.toggle('expired',!!active&&!left);
  $('timerStatus').textContent=!active?'尚未開始計時；也可自由練習。':left?'倒數進行中，重新整理不會重設時間。':'30分鐘已到；作答仍可編輯並自動儲存。';
  $('startTimer').disabled=!!active;
  $('startTimer').textContent=active?'已開始計時':'開始30分鐘';
  $('resetTimer').disabled=!active;
}
function startTimer(){
  if(!current)return;
  if(timers[current])return;
  timers[current]={deadline:Date.now()+30*60*1000};
  writeTimers();updateTimer();notice('已開始30分鐘練習，作答會自動保存。');
}
function resetTimer(){
  if(!current||!timers[current])return;
  if(!confirm('確定將本題計時重設為30分鐘？作答和AI評語都會保留。'))return;
  delete timers[current];writeTimers();updateTimer();notice('計時已重設，作答未刪除。');
}
function promptFor(q,answer){
  if(!answer.trim())throw Error('請先完成本題作答，再複製 AI 批改指令。');
  if(!AI||typeof AI.buildPrompt!=='function')throw Error('既有 AI 批改模組尚未載入');
  const base=AI.buildPrompt({
    id:q.id,year:'116',subject:M.subject(q),examTypes:['觀護人每日模擬題（非官方）'],
    questionNo:1,title:q.date+' 每日模擬題',body:q.question,points:[],direction:[]
  },answer);
  const prefix=[
    '【每日模擬題補充閱卷原則：優先於下方一般性建議】',
    '先逐小題整理原題實際要求，再核對考生是否逐項回答。主要依題意掌握、回答完整性、論證合理性及法律／學理正確性給分；題目難度不穩定不得當成扣分理由。',
    '若題目同時涉及少年事件處理法、刑法、刑事訴訟法、保安處分執行法等多門法律科目，仍採整題統一評分；逐一檢視法律爭點，但不要另列各法律科目分數。',
    '若題目同時要求法律分析與心理學、犯罪學或諮商輔導等學理、處遇方法，則按題目要求將法律部分及非法律學科部分分別評分，最後加總；純學科題採整題評分。',
    '以各小題明示配分為準。若僅有總分，根據各設問比重合理暫分並註明估計；若完全沒有可信配分，請提供文字評語或明示假設的示例得分，不得冒充官方評分。',
    '下方一般提示的30／25／25／20為評語構面比例，並不表示所有題目都固定是100分；實際總分必須與題目可查明的配分相同。',
    '題庫的參考解答可能尚未人工審定，本次不提供參考答案給你以免先入為主；請先獨立依原題判斷，合理異說不得機械扣分。',
    '請在評語中清楚寫出：題意要求、已回答內容、未回答內容、評分及原因、最值得補強的爭點、精簡訂正示範。切勿杜撰法條、學說、裁判或考題出處。',
    '本題日期：'+q.date+'；非考選部官方試題。'
  ];
  return prefix.join('\n')+'\n\n'+base;
}
async function copyAI(){
  flush();if(dirty){$('copyStatus').textContent='作答尚未保存；請先處理儲存問題。';return;}
  const q=getQuestion();if(!q)return;
  let prompt;
  try{prompt=promptFor(q,$('answer').value);}
  catch(error){$('copyStatus').textContent=error.message;return;}
  try{
    if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
    await navigator.clipboard.writeText(prompt);
    $('copyStatus').textContent='已複製題目、作答及批改規則，請貼到 ChatGPT。';
  }catch(error){
    const box=document.createElement('textarea');box.value=prompt;
    box.setAttribute('readonly','');box.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(box);box.focus();box.select();
    let copied=false;
    try{copied=document.execCommand('copy');}catch{}
    box.remove();
    if(copied)$('copyStatus').textContent='已使用相容模式複製，請貼到 ChatGPT。';
    else{
      window.prompt('瀏覽器未允許自動複製，請手動選取並複製以下內容：',prompt);
      $('copyStatus').textContent='自動複製未成功；請確認已手動複製。';
    }
  }
}
function download(data,name){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function essayMarkdown(q,record){
  const drafts=draftsFor(record),pieces=[
    '# 每日模擬題｜'+title(q),
    '',
    '- 日期：'+q.date,
    '- 科目：'+M.subject(q),
    '- 題目 ID：'+q.id,
    '',
    '## 題目',
    '',
    q.question,
    '',
    '## 四格草稿'
  ];
  for(const [,key,label] of DRAFT_FIELDS)pieces.push('','### '+label,'',drafts[key]||'（尚未填寫）');
  pieces.push('','## 完整答案','',record.answer||'（尚未填寫）');
  if(record.aiFeedback?.trim())pieces.push('','## AI 批改結果','',record.aiFeedback);
  return pieces.join('\n')+'\n';
}
function exportEssay(){
  flush();
  if(dirty){$('exportEssayStatus').textContent='作答尚未保存，請先處理儲存問題。';return;}
  const q=getQuestion();if(!q)return;
  const rec=recordFor(current);
  const safeId=q.id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55);
  const filename=q.date+'-'+safeId+'-申論練習紀錄.md';
  try{
    const url=URL.createObjectURL(new Blob([essayMarkdown(q,rec)],{type:'text/markdown;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    $('exportEssayStatus').textContent='已匯出本題 Markdown。';
  }catch(error){$('exportEssayStatus').textContent='Markdown 匯出失敗：'+error.message;}
}
function backup(){return {format:'probation-daily-github-records',schemaVersion:1,exportedAt:new Date().toISOString(),records};}
function exportBackup(){
  flush();if(dirty){notice('仍有未儲存的編輯，請先複製重要內容。',true);return false;}
  try{download(backup(),'daily-simulation-records-'+new Date().toISOString().slice(0,10)+'.json');notice('已啟動每日模擬題備份下載；考古題不包含在這份檔案。');return true;}
  catch(error){notice('備份下載失敗：'+error.message,true);return false;}
}
async function importBackup(){
  const input=$('importFile'),file=input.files?.[0];if(!file)return;
  try{
    if(file.size>4*1024*1024)throw Error('檔案超過4MB');
    if(!storageOK)throw Error('既有紀錄無法安全讀取，暫停匯入');
    flush();if(dirty)throw Error('有未儲存的編輯，請先處理');
    const incoming=M.backup(JSON.parse(await file.text()));
    const count=Object.keys(incoming).length;
    if(!count)throw Error('備份沒有每日模擬題作答紀錄');
    if(!confirm('將匯入 '+count+' 筆每日模擬題紀錄。同題以匯入的答案為主，先保留目前本機備份；考古題不受影響。確定繼續？'))return;
    localStorage.setItem('daily-reading-test:before-import',JSON.stringify(records));
    const next={...records,...incoming};
    persist(next);records=next;
    if(current){const id=current;current='';showQuestion(id);}else renderList();
    notice('已匯入 '+count+' 筆紀錄，原每日模擬題頁面也可讀取。');
  }catch(error){notice('匯入失敗，原紀錄未主動覆蓋：'+error.message,true);}
  finally{input.value='';}
}
function clearRecords(){
  if(!storageOK){notice('本機紀錄無法正常讀取，禁止清除以免遺失資料。',true);return;}
  flush();if(dirty){notice('作答尚未成功保存，暫停清除。',true);return;}
  const n=Object.keys(records).length;
  if(!n){notice('每日模擬題目前沒有需要清除的作答紀錄。');return;}
  if(!confirm('即將清除 '+n+' 筆「每日模擬題」作答、AI評語與待複習標記；426題考古題不會刪除。是否先下載備份？'))return;
  if(!exportBackup())return;
  if(!confirm('已啟動備份下載。請確認有保存下載檔案。\n確定清除每日模擬題全部學習紀錄？此操作無法自動復原。'))return;
  try{
    persist({});records={};timers={};writeTimers();
    // Clearing daily study also discards the old pre-import snapshot on this origin.
    try{localStorage.removeItem('daily-reading-test:before-import');}catch{}
    if(current){const id=current;current='';showQuestion(id);}else renderList();
    notice('每日模擬題作答與 AI 評語已清除；考古題及題庫未變更。');
  }catch(error){notice('清除失敗，原紀錄保留：'+error.message,true);}
}
async function fetchDataset(){
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),15000);
  try{
    const response=await fetch('../daily-simulation/questions.json',{cache:'no-store',signal:ctl.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    return M.dataset(await response.json());
  }finally{clearTimeout(timeout);}
}
async function load(force=false){
  $('reload').disabled=true;
  try{
    let next,source='正式每日題庫';
    try{next=await fetchDataset();try{localStorage.setItem(DATA_KEY,JSON.stringify(next));}catch{}}
    catch(error){
      if(force)throw error;
      const cached=localStorage.getItem(DATA_KEY);
      if(!cached)throw error;
      next=M.dataset(JSON.parse(cached));source='上次讀取的本機題庫';
    }
    if(dirty)flush();
    if(dirty)throw Error('作答尚未保存，無法切換題庫');
    const previous=current;bank=next;
    const subjects=[...new Set(bank.questions.map(M.subject))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
    const oldSubject=$('subject').value;
    $('subject').innerHTML='<option value="">全部科目</option>'+subjects.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
    $('subject').value=subjects.includes(oldSubject)?oldSubject:'';
    renderList();
    const first=bank.questions.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))[0];
    current='';showQuestion(previous&&bank.questions.some(q=>q.id===previous)?previous:first.id);
    notice('已載入 '+bank.questions.length+' 題（'+source+'）。兩個每日模擬題頁面共用同一份學習紀錄。');
  }catch(error){notice('每日模擬題載入失敗：'+error.message,true);}
  finally{$('reload').disabled=false;}
}
if(!M||typeof M.dataset!=='function'){
  notice('找不到每日題資料模型，請重新整理並確認離線資源已更新。',true);
  return;
}
readRecords();loadTimers();
$('questionList').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)showQuestion(b.dataset.id);});
$('subject').addEventListener('change',renderList);
$('search').addEventListener('input',renderList);
$('reload').addEventListener('click',()=>load(true));
$('startTimer').addEventListener('click',startTimer);
$('resetTimer').addEventListener('click',resetTimer);
$('answer').addEventListener('input',()=>{$('wordCount').textContent=$('answer').value.length+' 字';scheduleSave();});
for(const [element] of DRAFT_FIELDS)$(element).addEventListener('input',()=>{updateDraftCount();scheduleSave();});
$('exportEssay').addEventListener('click',exportEssay);
$('review').addEventListener('change',scheduleSave);
$('aiFeedback').addEventListener('input',scheduleSave);
$('copyAI').addEventListener('click',copyAI);
$('export').addEventListener('click',exportBackup);
$('import').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',importBackup);
$('clear').addEventListener('click',clearRecords);
window.addEventListener('beforeunload',()=>{if(dirty)flush();});
window.addEventListener('storage',e=>{
  if(e.key!==KEY||dirty)return;
  readRecords();
  if(!storageOK)return;
  const id=current;current='';
  if(id&&bank)showQuestion(id);else renderList();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateTimer();});
setInterval(updateTimer,1000);
load();
})();