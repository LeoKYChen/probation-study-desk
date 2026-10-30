/* Native Staresto practice: source-attributed exam questions, local-only progress. */
(function(){
'use strict';
const E=window.StarestoDailyEngine,STORE='psd-staresto-daily-v04',$=id=>document.getElementById(id);
const node=(tag,text,cls)=>{let e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
const names={vocab:'單字',grammar:'文法／克漏字',reading:'閱讀理解',completion:'文意選填'};
const files=['vocab.json','grammar-1.json','grammar-2.json','grammar-3.json','reading.json','completion.json'];
let bank,state,today,shownDate,task=null,index=0,revealed=false,idbRepo=null,storageBusy=false,storageFailed=false;
const idbTest=window.PSD_COMMON_IDB_TEST===true;
function notice(msg,error){const x=$('status');x.hidden=false;x.textContent=msg;x.className=error?'status error':'status';if(!error)setTimeout(()=>{if(x.textContent===msg)x.hidden=true},4200)}
function load(){try{return E.normalize(JSON.parse(localStorage.getItem(STORE)||'null'))}catch(_){return E.defaultState()}}
async function save(next=state){if(storageBusy||storageFailed)return false;try{if(idbTest){storageBusy=true;await idbRepo.write(next);}else localStorage.setItem(STORE,JSON.stringify(next));state=next;return true}catch(e){if(idbTest)storageFailed=true;notice('本機儲存失敗，請先保留作答並檢查儲存空間：'+e.message,true);return false}finally{storageBusy=false}}
function taskDone(t,date){return E.completed(state,date,t)}
function sumDone(plan,date){return plan.tasks.reduce((n,t)=>n+taskDone(t,date),0)}
function sumSize(plan){return plan.tasks.reduce((n,t)=>n+t.ids.length,0)}
function buttonFor(t,date){
 const b=node('button',undefined,'task');b.type='button';b.setAttribute('aria-pressed',String(task&&task.key===t.key&&shownDate===date));
 b.append(node('strong',t.title),node('span',taskDone(t,date)+'／'+t.ids.length+' 項 · 建議 '+t.minutes+'分鐘'));
 b.addEventListener('click',()=>openTask(t,date));return b;
}
function renderPlan(){
 const plan=state.days[today],host=$('taskList');host.replaceChildren();
 $('todayCount').textContent=sumDone(plan,today)+' / '+sumSize(plan);
 $('planHint').textContent='本日預計 '+plan.tasks.reduce((n,t)=>n+t.minutes,0)+' 分鐘；較長文章可分次作答。題單當日固定，不會自動跳題。';
 plan.tasks.forEach(t=>host.append(buttonFor(t,today)));
 const missed=E.unfinished(state,today),p=$('backlogPanel');p.hidden=missed.length===0;
 const list=$('backlogList');list.replaceChildren();
 missed.forEach(row=>{const e=node('div');e.append(node('small',row.date),buttonFor(row.task,row.date));list.append(e)});
}
function renderSummary(){
 const s=E.stage(state),levels=['基礎建立','能力累積','綜合提升'];
 $('stageStat').textContent=levels[s.level-1];
 $('stageDetail').textContent='已練 '+s.attempted+' 題，練習 '+s.activeDays+' 天';
 $('accuracyStat').textContent=s.firstAccuracy===null?'—':s.firstAccuracy+'%';
 $('accuracyDetail').textContent='每題首次作答正確率；重練不洗分';
 const due=E.dueItems(bank,state,today);$('dueStat').textContent=due.length+'題';
 $('dueDetail').textContent='到期題目會在週日優先安排複習';
 const wrong={vocab:0,grammar:0,reading:0,completion:0};
 bank.questions.forEach(q=>{const last=E.recent(state,q.id);if(last&&!last.correct)wrong[q.kind]++});
 const host=$('weakList');host.replaceChildren();
 for(const k of E.TYPES)host.append(node('p',names[k]+'：'+wrong[k]+'題最近仍答錯','weak-row'));
}
function openTask(t,date){
 if(!t?.ids?.length)return;
 shownDate=date;task=t;revealed=false;
 const k=t.ids.findIndex(id=>t.kind==='cards'?!(state.cards[id]?.attempts||[]).some(a=>a.date===date):!E.attempts(state,id).some(a=>a.date===date));
 index=k<0?0:k;
 renderPlan();renderQuestion();$('workPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function itemAttempt(q){return E.attempts(state,q.id).findLast(a=>a.date===shownDate)}
function origin(q){
 const area=$('questionSource');area.replaceChildren();area.hidden=false;
 area.append(node('span','來源：staresto-create ZZSH｜'+q.year+'年學測第'+q.number+'題｜'));
 const link=node('a','原作者題目與解析 ↗');link.href=q.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';area.append(link);
}
async function answer(q,key){
 if(itemAttempt(q)||storageBusy||storageFailed)return;
 const next=structuredClone(state);E.recordAttempt(next,q.id,key,q.answer,shownDate);if(await save(next)){renderQuestion();renderPlan();renderSummary();}
}
async function knowCard(q,known){
 if(storageBusy||storageFailed||(state.cards[q.id]?.attempts||[]).some(a=>a.date===shownDate))return;
 const next=structuredClone(state);E.recordCard(next,q.id,known,shownDate);if(await save(next)){renderQuestion();renderPlan();renderSummary();}
}
function flashcard(q,host){
 const card=node('section',undefined,'flashcard');
 card.append(node('p','請先想想英文單字的意思：','muted'),node('div',q.options[q.answer],'flash-word'),node('p','原題例句：'+q.prompt));
 const saved=(state.cards[q.id]?.attempts||[]).findLast(a=>a.date===shownDate);
 if(revealed||saved){
  card.append(node('div',q.translation,'flash-back'));
  const detail=q.explanation.split('\n').find(s=>s.startsWith('正確詞義：'));if(detail)card.append(node('p',detail,'muted'));
  if(saved)card.append(node('p','今日已標記：'+(saved.knew?'認得':'還不熟'),'result'));
  else{
   const actions=node('div',undefined,'buttons');
   for(const row of [[true,'我認得'],[false,'還不熟，加入複習']]){
    const b=node('button',row[1],row[0]?'primary':'subtle');b.type='button';b.addEventListener('click',()=>knowCard(q,row[0]));actions.append(b);
   }card.append(actions);
  }
 }else{
  const reveal=node('button','翻開字卡看中文釋義','primary');reveal.type='button';reveal.addEventListener('click',()=>{revealed=true;renderQuestion()});card.append(reveal);
 }
 host.append(card);
}
function renderQuestion(){
 const host=$('questionArea');host.replaceChildren();
 if(!task?.ids?.length){host.append(node('p','請先點選任務。'));return}
 const q=bank.byId[task.ids[index]];
 if(!q){host.append(node('p','題目不存在，請重新載入。'));return}
 $('workEyebrow').textContent=task.kind==='cards'?'VOCABULARY CARDS':'OFFICIAL PAST EXAM EXERCISE';
 $('workTitle').textContent=task.title;
 $('taskDate').textContent=shownDate+'｜'+q.year+'年學測第'+q.number+'題';
 $('taskProgress').textContent=(index+1)+' / '+task.ids.length;
 $('prev').disabled=index===0;$('next').disabled=index===task.ids.length-1;
 origin(q);
 if(task.kind==='cards'){flashcard(q,host);return}
 if(q.passageKey){
  const p=bank.passages[q.passageKey];
  if(p){const d=node('details',undefined,'passage');d.open=true;d.append(node('summary','閱讀文章｜'+p.title));
   d.append(node('div',p.text.replace(/\[(\d+)\]/g,(whole,n)=>'（第'+n+'格）'),'passage-text'));host.append(d);}
 }
 const prompt=q.kind==='grammar'?q.prompt.replace(new RegExp('\\b'+q.number+'\\b'),'＿＿＿'):q.prompt;
 host.append(node('h3',prompt));
 const box=node('div',undefined,'options'),prev=itemAttempt(q);
 for(const k of Object.keys(q.options).sort()){
  const b=node('button','('+k+') '+q.options[k],'option');b.type='button';b.disabled=!!prev;
  if(prev&&k===q.answer)b.classList.add('correct');
  if(prev&&!prev.correct&&prev.choice===k)b.classList.add('incorrect');
  if(!prev)b.addEventListener('click',()=>answer(q,k));
  box.append(b);
 }host.append(box);
 if(prev){
  const exp=node('section',undefined,'explanation');
  exp.append(node('strong',(prev.correct?'答對！':'這次答錯了。')+' 正解：('+q.answer+') '+q.options[q.answer]));
  if(q.translation)exp.append(node('p','中文：'+q.translation));
  exp.append(node('p','原作者解析：'+q.explanation));
  exp.append(node('small','建議下次複習日：'+(state.progress[q.id]?.due||'待安排')));
  host.append(exp);
 }else host.append(node('p','先選答案，系統才會顯示原作者解析。','muted'));
}
function showIdle(){
 $('workTitle').textContent='請先選擇任務';$('taskProgress').textContent='0 / 0';
 $('questionSource').hidden=true;$('prev').disabled=true;$('next').disabled=true;
 $('questionArea').replaceChildren(node('p','點上方任務，即可在本站直接作答。'));
}
function download(){
 if(storageBusy){notice('資料仍在儲存，請稍候再匯出。',true);return;}
 const payload=JSON.stringify(state,null,2),blob=new Blob([payload],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='staresto-v04-'+today+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 notice('已產生本模組備份檔。');
}
async function clearProgress(){
 if(idbTest){notice('測試模式尚未整合本模組清除與衝突復原。',true);return;}
 const first='確定清除 Staresto 每日英文的全部學習紀錄嗎？\n\n將刪除：每日任務、作答歷史、錯題複習、字卡與學習階段。\n\n此操作不影響國文作文、原創80題或其他練習站。請先用「匯出 JSON 備份」保留資料。';
 if(!confirm(first))return;
 if(!confirm('最後確認：清除後無法直接復原，確定要重新開始 Staresto 每日英文學習嗎？'))return;
 const previous=state;
 const fresh=E.defaultState();
 E.buildDay(bank,fresh,today);
 state=fresh;
 if(!(await save())){state=previous;notice('清除失敗：無法寫入本機儲存空間，原本的紀錄仍保留。',true);return}
 task=null;shownDate=today;index=0;revealed=false;
 renderPlan();renderSummary();showIdle();
 notice('已清除 Staresto 每日英文學習紀錄，今天的任務已重新建立。');
}
function importData(event){
 if(idbTest){notice('測試模式尚未整合本模組匯入與衝突復原。',true);event.target.value='';return;}
 const f=event.target.files?.[0];if(!f)return;
 if(f.size>5e6){notice('備份超過5MB，請檢查來源。',true);return}
 const reader=new FileReader();
 reader.onload=async()=>{try{
  const data=JSON.parse(String(reader.result));
  if(data?.schema!==E.VERSION||!data.days||!data.progress||!data.cards)throw Error('非v0.4備份');
  if(!confirm('匯入會取代本模組紀錄。建議先匯出備份，確定匯入嗎？'))return;
  state=E.normalize(data);E.buildDay(bank,state,today);if(!(await save()))return;
  shownDate=today;task=null;index=0;renderPlan();renderSummary();showIdle();notice('已還原v0.4紀錄。');
 }catch(e){notice('匯入失敗：'+e.message,true)}finally{event.target.value=''}};
 reader.readAsText(f);
}
async function init(){
 try{
  const payload=await Promise.all(files.map(async file=>{const response=await fetch('./'+file);if(!response.ok)throw Error('無法讀取：'+file);return response.json()}));
  bank=E.createBank(payload);today=E.taipeiDate();
  if(idbTest){const database=await window.PSDLearningStorage.open();idbRepo=await window.PSDCommonSubjectsRepository.open({database,legacy:localStorage,core:window.PSDUnifiedBackup,key:STORE});state=E.normalize(idbRepo.read());}
  else state=load();
  const initial=structuredClone(state);E.buildDay(bank,initial,today);if(!(await save(initial)))throw Error('無法保存今日安排');shownDate=today;
  $('dateText').textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  $('phaseText').textContent='第一批原作者授權練習資料 '+bank.questions.length+'題，依個人表現循序安排。';
  $('status').hidden=true;$('app').hidden=false;renderPlan();renderSummary();showIdle();
  $('prev').addEventListener('click',()=>{if(task&&index>0){index--;revealed=false;renderQuestion()}});
  $('next').addEventListener('click',()=>{if(task&&index<task.ids.length-1){index++;revealed=false;renderQuestion()}});
  $('backupBtn').addEventListener('click',download);$('importFile').addEventListener('change',importData);
  $('clearProgressBtn').addEventListener('click',clearProgress);
 }catch(e){notice('來源資料載入或驗證失敗。沒有變更原有紀錄。'+e.message,true)}
}
window.addEventListener('beforeunload',e=>{if(idbTest&&storageBusy){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(idbTest&&e.key===STORE){storageFailed=true;notice('舊版分頁已修改資料，已停止寫入；請保留原資料並重新整理。',true);}});
if(!E){notice('練習引擎讀取失敗，請重新整理。',true);return}
init();
})();
