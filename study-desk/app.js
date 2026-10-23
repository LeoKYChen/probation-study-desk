import {SyncEngine,validateState,same,FORMAT} from '../cloud-sync/core.js';
import {setupCloudUI} from './cloud-ui.js';
import {IDBStore} from '../cloud-sync/idb.js';
import {SUBJECTS,isSupportedSubject,today,now,attempts,recommend,newAttempt,markdown,nextReview} from './domain.js';
import {intervals,topicScope,validateMapping,readLectures,planLimits,validatePreferences} from './planning.js';
import {legacyRecords,convertibleAttempts} from './legacy.js';
import {clearedLearningState,assertLearningEpoch} from './reset.js';
import {confirmedWeaknesses,weaknessStats,weaknessTrends,recallTrajectory,validateWeaknessCategory} from './weakness.js';
let currentEpoch=null;
class DeskRecords extends SyncEngine {
 constructor(store,{cloud=false}={}){super(store,{uuid:uid});this.cloud=cloud;}
 queue(state,id,value,deleted=false){assertLearningEpoch(state,currentEpoch);super.queue(state,id,value,deleted);if(!this.cloud || id==='settings/recommendation-audit')delete state.outbox[id];}
}
const $=id=>document.getElementById(id), clone=v=>structuredClone(v);
let store,engine,cloudControl,current=null,currentId=null,baseline=null,preferences={subjects:{},learnedTopics:[]},preferencesFormDirty=false,timer,saveTail=Promise.resolve(),skipped=[],recommendation,lectureData=null,lectureSource=null;
const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
function report(text,bad=false) { $('status').textContent=text;$('status').classList.toggle('error',bad); }
const canonical=s=>s.startsWith('犯罪學')?'犯罪學':s==='諮商與矯正輔導'?'諮商與輔導':s;
const questions=[...(globalThis.QUESTION_BANK||[]),...(globalThis.RELATED_QUESTION_BANK||[]),...(globalThis.POLICE_ORIGINAL_QUESTION_BANK||[])].map(q=>({id:q.id,subject:canonical(q.subject),body:q.body,title:q.title,topicKey:q.subject+'｜'+q.title,sourceUrl:q.sourceUrl||'',sourceLabel:(q.source||'題源未確認')+'｜'+q.year+'年｜'+(q.examType||q.examTypes?.join('／')||'考試類別未記載')+'｜第'+q.questionNo+'題（沿用原題庫標示，未於本次重新查核）'}));
// Composite subjects keep their original names; no invented split into individual questions.
for(const q of questions) if(isSupportedSubject(q.subject)&&!SUBJECTS.includes(q.subject)) SUBJECTS.push(q.subject);
function wrap(id,fn) { $(id).addEventListener('click',async()=>{const b=$(id);if(b.disabled)return;b.disabled=true;try{await action(fn);}finally{b.disabled=false;}}); }
async function action(fn) {try{await fn();cloudControl?.scheduleSync();}catch(e){report(e.message,true);}}
function download(name,data,type) { const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function text(tag,value,parent) {const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function button(label,parent,fn) {const b=text('button',label,parent);b.type='button';b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;try{await action(fn);}finally{b.disabled=false;}});return b;}
async function openNamespace(name,{cloud=false}={}) {
 if(engine) await flush();
 store?.close();store=await IDBStore.open(name);engine=new DeskRecords(store,{cloud});current=null;currentId=null;baseline=null;preferencesFormDirty=false;
 const initial=await store.read();currentEpoch=initial.clearedEpoch||null;
 preferences=validatePreferences(initial.records['settings/preferences']?.value || {subjects:{},learnedTopics:[]});
 $('editor').hidden=true;$('question-body').textContent='從今日任務或手動選題開始。';$('practice-title').textContent='作答與訂正';$('source-label').textContent='';
 $('account').textContent=cloud?'帳號書桌｜資料先存此裝置':'此裝置的本機書桌';
 $('clear-learning').disabled=cloud;
 $('refresh-lectures').textContent=cloud?'匯入此裝置函授進度至帳號（需確認）':'更新函授進度並保存備份快照';
 $('clear-learning').title=cloud?'帳號同步中禁止直接清除，避免遠端資料重新出現。可先登出，再處理本機資料。':'';
 await loadLectureProgress();await refresh(); renderPreferences();renderQuestionOptions();report(cloud?'帳號書桌已開啟；作答先存本機，再與雲端同步。':'本機書桌已開啟，資料保存在此瀏覽器。');
}
function renderPreferences() {
 const rule=intervals(preferences.reviewIntervals),limits=planLimits(preferences);
 for(const key of ['again','hint','independent'])$('interval-'+key).value=rule[key];
 $('planning-minutes').value=limits.minutes;$('review-limit').value=limits.reviewLimit;
 updateRecallLabels();
 $('subjects').replaceChildren();
 for(const subject of SUBJECTS) {
   const row=text('div','',$('subjects'));row.className='subject-row';row.dataset.subject=subject;
   const active=text('label','',$('subjects').lastChild);active.className='check';const check=document.createElement('input');check.type='checkbox';check.className='enabled';check.checked=!!preferences.subjects[subject]?.enabled;active.append(check,document.createTextNode(subject));
   const learned=text('span','已學主題：'+questions.filter(q=>q.subject===subject&&topicScope(q,preferences,lectureData).learned).length,row);learned.className='subject-scope';
   const weight=document.createElement('input');weight.type='number';weight.min=1;weight.max=10;weight.value=preferences.subjects[subject]?.weight||1;weight.className='weight';weight.setAttribute('aria-label',subject+'推薦權重');row.append(weight);
 }
}
function selectedQuestion() {return questions.find(q=>q.id===$('question').value);}
function renderQuestionOptions() {
 const previous=$('subject').value;
 $('subject').replaceChildren();for(const s of SUBJECTS){const o=text('option',s,$('subject'));o.value=s;}if(SUBJECTS.includes(previous))$('subject').value=previous;
 fillQuestions();
}
function fillQuestions() {
 $('question').replaceChildren();for(const q of questions.filter(q=>q.subject===$('subject').value)){const o=text('option',q.title,$('question'));o.value=q.id;}
 describeQuestion();
}
async function loadLectureProgress() {
 try {
  // localStorage belongs to the browser origin, not to the authenticated user.
  // In account mode only the current account's saved snapshot is trusted.
  const live=engine?.cloud?null:readLectures(localStorage,globalThis.PSDLectureCore);
  const saved=(await store.read()).records['settings/lecture-progress'];
  const snapshot=saved&&!saved.deleted?saved.value:null;
  lectureData=live || (snapshot?globalThis.PSDLectureCore.normalize(snapshot.data):null);
  lectureSource=live?{origin:location.origin,live:true}:snapshot||null;
  const label=live?'目前網址的函授紀錄':engine?.cloud?'此帳號已保存的函授快照':'使用備份中的函授快照（可能較舊）';
  $('lecture-status').textContent=lectureData?label+'：'+lectureData.courses.length+'門課／'+lectureData.lessons.length+'堂；只有本人確認對應的已完課主題會納入推薦。':engine?.cloud?'此帳號尚無函授進度快照；可手動確認已學主題，或按下方按鈕確認匯入此裝置的函授紀錄。':'尚無函授紀錄；仍可手動確認已學主題。';
 } catch(error) {lectureData=null;lectureSource=null;$('lecture-status').textContent='函授進度無法讀取：'+error.message+'。請先至函授管理檢查；未採用舊快照。';}
}
function lectureSnapshot() {return lectureData?{data:{...clone(lectureData),plan:null},capturedAt:lectureSource?.live?now():lectureSource?.capturedAt||null,origin:lectureSource?.origin||location.origin}:null;}
function updateRecallLabels() {
 const rules=intervals(preferences.reviewIntervals);
 for(const [key,label] of [['again','尚不會'],['hint','需要提示'],['independent','可獨立說明']])$('rating').querySelector('[value="'+key+'"]').textContent=label+'，'+rules[key]+'天後回想';
}
function describeQuestion() {
 const q=selectedQuestion();$('question-source').textContent=q?.sourceLabel||'此科尚無可直接選用的題目，可登錄自選題。';
 $('learned-topic').checked=!!q&&preferences.learnedTopics.includes(q.topicKey);$('learned-topic').disabled=!q;
 $('weak-topic').checked=!!q&&!!preferences.weakTopics?.includes(q.topicKey);$('weak-topic').disabled=!q;
 $('topic-lesson').replaceChildren();const empty=text('option','尚未指定',$('topic-lesson'));empty.value='';
 const mapping=q&&preferences.topicLessons?.[q.topicKey];
 if(q&&lectureData)for(const lesson of lectureData.lessons){
  const course=lectureData.courses.find(c=>c.id===lesson.courseId);
  if(!course||!(canonical(course.subject)===q.subject||q.subject.includes(course.subject)||mapping?.lessonId===lesson.id))continue;
  const option=text('option',course.name+'／'+lesson.title+'（'+lesson.watchedMinutes+'／'+lesson.durationMinutes+'分鐘）',$('topic-lesson'));option.value=lesson.id;
 }
 if(mapping)$('topic-lesson').value=mapping.lessonId;
 $('topic-scope').textContent=q?topicScope(q,preferences,lectureData).basis:'';
 $('save-topic-lesson').disabled=!q||!lectureData;
}
function renderWeaknessBoard(state){
 const all=confirmedWeaknesses(attempts(state)),stats=weaknessStats(all);
 $('weakness-summary').textContent=stats.total
   ?'共 '+stats.total+' 項人工確認的訂正；'+stats.categories.map(x=>x.label+' '+x.count).join('、')+'。AI 評語不會自動納入。'
   :'尚未建立人工確認的訂正。AI 批改意見不會自動算成弱點。';
 const trends=$('weakness-trends');trends.replaceChildren();
 const recurring=weaknessTrends(attempts(state)).filter(x=>x.recurring);
 if(!recurring.length)text('p','目前尚無跨不同題目的同類錯誤紀錄。',trends);
 for(const g of recurring.slice(0,12)){
  const row=text('div','',trends);row.className='note';
  text('strong',g.subject+'｜'+g.label+'｜'+g.distinctQuestions+' 道不同題目',row);
  text('p','共有 '+g.correctedAttempts+' 份已訂正作答；這是重複的錯誤類型，不等於同一知識點。',row);
 }
 const trajectories=$('recall-trends');trajectories.replaceChildren();
 const corrected=attempts(state).filter(a=>a.corrections?.length).map(a=>({attempt:a,trajectory:recallTrajectory(a)}))
  .filter(x=>x.trajectory.count>0).sort((a,b)=>b.attempt.updatedAt.localeCompare(a.attempt.updatedAt));
 if(!corrected.length)text('p','尚無訂正後的回想自評。',trajectories);
 for(const item of corrected.slice(0,12)){
  const row=text('div','',trajectories);row.className='note';
  text('strong',item.attempt.subject+'｜'+item.attempt.question.title,row);
  text('p',item.trajectory.label,row);
  button('查看這份作答',row,()=>loadAttempt(item.attempt.id));
 }
 const board=$('weakness-board');board.replaceChildren();
 for(const item of all.slice(0,30)){
  const row=text('div','',board);row.className='note';
  text('strong',item.subject+'｜'+item.label,row);
  text('p',item.gap,row);
  text('p','題目：'+(item.question.title||'自選題')+(item.due?'｜下次回想 '+item.due:''),row);
  button('回到原題訂正／再練',row,()=>loadAttempt(item.attemptId));
 }
 if(all.length>30)text('p','僅顯示最近 30 項；完整紀錄保存在下方筆記及 JSON 備份中。',board);
}
async function refresh() {
 const state=await store.read();for(const row of $('subjects').children){const label=row.querySelector('.subject-scope');if(label)label.textContent='已學主題：'+questions.filter(q=>q.subject===row.dataset.subject&&topicScope(q,preferences,lectureData).learned).length;} recommendation=recommend(state,questions,preferences,skipped,{lectures:lectureData});
 $('recommendation-audit').textContent=['已納入考科：'+(recommendation.audit.enabledSubjects.join('、')||'尚未啟用'), '符合已學範圍的候選題：'+recommendation.audit.learnedCandidates+'題', '進度尚未確認而排除：'+recommendation.audit.excluded.scopeUnknown+'題', '本次時間預算：'+recommendation.audit.minutes+'分鐘；主要任務約'+recommendation.mainMinutes+'分鐘', '推薦規則：'+recommendation.audit.rankingPolicy.join(' → '), '新題候選比較（前3題）：'+(recommendation.audit.topEligible.map((x,i)=>(i+1)+'. '+x.subject+'／'+x.questionId+'；已練'+x.subjectPracticeCount+'題、權重'+x.subjectWeight+'、負荷比'+x.normalizedSubjectLoad.toFixed(2)+'、'+(x.explicitWeakTopic?'本人標記弱點':'未標記弱點')).join('；')||'無符合條件的題目'), '推薦理由：'+recommendation.reason].join('\n');
 if(!same(state.records['settings/recommendation-audit']?.value,recommendation.audit))await engine.save('settings/recommendation-audit',recommendation.audit);
 $('recommendation').textContent=(recommendation.attempt?.question.title||recommendation.question?.title||'先確認進度')+'｜'+recommendation.reason+(recommendation.mainMinutes?'（本次約'+recommendation.mainMinutes+'分鐘）':'');
 $('start-recommended').disabled=recommendation.type==='empty';
 $('due-list').textContent=recommendation.due.length?'另有到期複習：'+recommendation.due.map(a=>a.subject+' '+a.question.title).join('；'):'';
 if(recommendation.deferredReviews)$('due-list').textContent+=' 另有'+recommendation.deferredReviews+'題到期，因時間或題數限制暫緩。';
 renderWeaknessBoard(state);
 $('notes').replaceChildren();
 const notes=attempts(state).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 if(!notes.length)text('p','第一份作答會留在這裡。',$('notes'));
 for(const a of notes){const row=text('div','',$('notes'));row.className='note';row.dataset.attemptId=a.id;text('strong',a.subject+'｜'+a.question.title,row);text('p',(a.correctedAt?'已訂正／待回想':a.answeredAt?'已作答':'草稿')+(a.due?' · 下次回想 '+a.due:''),row);button('接續這題',row,()=>loadAttempt(a.id));}
 $('conflicts').replaceChildren();
 for(const [id,c] of Object.entries(state.conflicts)) {
   const row=text('div','',$('conflicts'));row.className='conflict';text('h3','同一紀錄有兩個版本',row);text('pre',JSON.stringify(state.records[id].value,null,2),row);text('pre',JSON.stringify(c.remote.value,null,2),row);
   for(const [choice,label] of [['local','以此裝置版本接續'],['remote','以另一版本接續']])button(label+'（雙方都留存）',row,async()=>{await flush();await engine.resolve(id,choice);if(id===currentId){current=null;currentId=null;$('editor').hidden=true;}await refresh();report('差異已處理；雙版本另存於保留紀錄。');});
 }
 if(!Object.keys(state.conflicts).length)text('p','目前沒有衝突。',$('conflicts'));
 $('legacy-list').replaceChildren();
 for(const [id,r] of Object.entries(state.records))if(!r.deleted&&/^(legacy|import|conflict)\//.test(id)) {
   const d=text('details','',$('legacy-list'));text('summary',r.value.key||r.value.originalId||'版本保留紀錄',d);text('pre',JSON.stringify(r.value,null,2),d);
   if(r.value.kind==='legacy'){
    const converted=convertibleAttempts(id,r.value,questions),receipt='conversion/'+id.split('/')[1];
    if(state.records[receipt])text('p','這份快照已整理為可接續筆記。',d);
    else if(converted.length)button('整理為可接續筆記（'+converted.length+'份）',d,async()=>{
     if(!confirm('將可辨識的作答整理成'+converted.length+'份筆記？保留原始快照，不推定已核對、已訂正或掌握。'))return;
     await store.update(s=>{if(s.records[receipt])return;for(const item of converted)if(!Object.hasOwn(s.records,item.id))engine.queue(s,item.id,item.value);engine.queue(s,receipt,{snapshotId:id,attemptIds:converted.map(x=>x.id),at:now()});});
     await refresh();report('舊作答已整理為可接續筆記；原始快照保留。');
    });
   }
 }
 const conflicts=Object.keys(state.conflicts).length;
 $('save-status').textContent=conflicts?'已存此裝置；有版本差異待處理':'已存此裝置；可匯出 JSON 備份';
}
function paintAttempt() {
 $('editor').hidden=false;$('practice-title').textContent=current.subject+'｜'+current.question.title;$('question-body').textContent=current.question.body;$('source-label').textContent=current.question.sourceLabel||'自選題，來源未查核';
 $('answer').value=current.answer;$('mode').value=current.mode;$('minutes').value=current.minutes;
 $('answer-hint').textContent=/刑|少年|保安|法學/.test(current.subject)?'可按「爭點、規範、涵攝、結論」作答。':'可按「概念、理論、應用、結論」作答。';
 $('gap').value='';$('correction').value='';$('recall').value='';$('gap-category').value='issue';$('track-weak-topic').checked=false;
 $('track-weak-topic').disabled=!current.question.topicKey;renderHistory();
}
function renderHistory() {
 $('milestones').textContent=['已作答：'+(current.answeredAt?'✓':'—'),'已核對：'+(current.checkedAt?'✓':'—'),'已訂正：'+(current.correctedAt?'✓':'—')].join('　');
 $('feedback-revision').replaceChildren();for(const r of current.revisions){const o=text('option',r.at,$('feedback-revision'));o.value=r.id;}if(current.revisions.length)$('feedback-revision').value=current.revisions.at(-1).id;
 $('feedback-list').replaceChildren();for(const f of current.feedback){const row=text('div','',$('feedback-list'));row.className='feedback';text('strong',f.source+'｜'+f.date+(f.unverified?'｜待查證':''),row);text('pre',f.text,row);}
 $('history').replaceChildren();text('pre',markdown(current),$('history'));
}
async function loadAttempt(id) {await flush();const rec=(await store.read()).records[id];if(!rec||rec.deleted||rec.value.kind!=='attempt')throw Error('題目紀錄已變更');currentId=id;current=clone(rec.value);baseline=clone(current);paintAttempt();$('practice').scrollIntoView({behavior:'smooth'});}
async function start(q,allocation) {if(!q)throw Error('請先選題');await flush();currentId='attempt/'+uid();current=newAttempt(q,allocation?(allocation<=10?'short':'full'):$('mode').value);if(allocation)current.minutes=allocation;baseline=null;await persist();paintAttempt();await refresh();$('practice').scrollIntoView({behavior:'smooth'});}
function formToCurrent() {if(!current)return;current.answer=$('answer').value;current.mode=$('mode').value;const m=Number($('minutes').value);if(!Number.isInteger(m)||m<1||m>240)throw Error('練習時間須為1到240分鐘');current.minutes=m;}
async function persist() {
 if(!current || baseline && same(current,baseline))return;
 const value=clone(current),expected=clone(baseline),id=currentId;
 value.updatedAt=now();
 const savedId=await store.update(s=>{
   assertLearningEpoch(s,currentEpoch);
   const actual=s.records[id]?.value;
   // Another tab/remote editor changed the record: save this form as a separate attempt.
   const target=actual && expected && !same(actual,expected)?'attempt/'+uid():id;
   if(target!==id)value.forkedFrom=id;
   engine.queue(s,target,value);
   return target;
 });
 currentId=savedId;current=value;baseline=clone(value);$('save-status').textContent='已存此裝置';cloudControl?.scheduleSync();
}
function reconcileVisibleAttempt(state) {
 if(!current || !currentId)return;
 if(state.conflicts[currentId]){
  report('這題在不同裝置有版本差異，原本作答仍在本機。請至「我的筆記」檢視後決定接續版本。',true);
  return;
 }
 const saved=state.records[currentId];
 if(!saved || saved.deleted || saved.value?.kind!=='attempt')return;
 if(same(saved.value,baseline))return;
 // Autosave and the correction/feedback forms are independent: never repaint while
 // someone is typing or has an unsent analysis/correction in another field.
 const dirty=timer || $('answer').value!==current.answer ||
   $('mode').value!==current.mode || Number($('minutes').value)!==current.minutes ||
   ['feedback-text','gap','correction','recall'].some(id=>$(id).value.trim());
 if(dirty){
  report('已取得另一裝置的新版本，但這頁仍有未送出的文字；為避免覆蓋編輯內容，請先保存或複製，再重新開啟這題。',true);
  return;
 }
 current=clone(saved.value);baseline=clone(saved.value);paintAttempt();
 report('已讀取另一裝置更新的作答版本；本頁沒有未保存內容。');
}
async function flush() {clearTimeout(timer);timer=null;await saveTail;if(current){formToCurrent();await persist();}}
function scheduleSave(){clearTimeout(timer);timer=setTimeout(()=>{timer=null;saveTail=saveTail.then(async()=>{formToCurrent();await persist();}).catch(e=>report(e.message,true));},400);}
async function edit(fn) {await flush();if(!current)throw Error('請先開始一題');fn();await persist();renderHistory();await refresh();}
async function exportBackup() {await flush();await loadLectureProgress();const snapshot=lectureSnapshot();if(snapshot)await engine.save('settings/lecture-progress',snapshot);const s=await store.read();download(today()+'_備考書桌.json',JSON.stringify({format:FORMAT,schemaVersion:1,exportedAt:now(),state:s},null,2),'application/json');}
async function clearLearning() {
 if(engine?.cloud)throw Error('雲端帳號模式不允許直接清除；請先匯出帳號備份並登出。');
 if($('clear-confirm-text').value!=='清除')return;
 // Drain pending autosaves before replacing the namespace atomically.
 await flush();
 const epoch=uid();
 await store.update(s=>Object.assign(s,clearedLearningState(s,epoch)));
 current=null;currentId=null;baseline=null;currentEpoch=epoch;skipped=[];
 const s=await store.read();preferences=validatePreferences(s.records['settings/preferences']?.value||{subjects:{},learnedTopics:[]});
 $('editor').hidden=true;$('answer').value='';$('question-body').textContent='從今日任務或手動選題開始。';$('practice-title').textContent='作答與訂正';$('source-label').textContent='';
 await loadLectureProgress();renderPreferences();describeQuestion();await refresh();
 $('clear-dialog').close();report('已清除本機備考書桌的學習紀錄；設定與舊模組原始資料均保留。');
}
async function setup() {
 await openNamespace('guest');
 cloudControl=setupCloudUI({
  getStore:()=>store,getEngine:()=>engine,
  openAccount:id=>openNamespace('account/'+id,{cloud:true}),
  openGuest:()=>openNamespace('guest'),beforeSwitch:flush,report,
  afterSync:async()=>{
   const s=await store.read();
   currentEpoch=s.clearedEpoch||null;
   preferences=validatePreferences(s.records['settings/preferences']?.value||{subjects:{},learnedTopics:[]});
   await loadLectureProgress();if(!preferencesFormDirty)renderPreferences();renderQuestionOptions();await refresh();
   reconcileVisibleAttempt(s);
  }
 });
 await cloudControl.init();
 $('feedback-date').value=today();
 $('settings').addEventListener('input',event=>{
  if(event.target.closest('#subjects') || ['planning-minutes','review-limit','interval-again','interval-hint','interval-independent'].includes(event.target.id))preferencesFormDirty=true;
 });
 $('subject').addEventListener('change',fillQuestions);$('question').addEventListener('change',describeQuestion);
 $('learned-topic').addEventListener('change',()=>action(async()=>{const q=selectedQuestion();if(!q)return;const next=clone(preferences);next.learnedTopics=next.learnedTopics.filter(x=>x!==q.topicKey);if($('learned-topic').checked)next.learnedTopics.push(q.topicKey);await engine.save('settings/preferences',next);preferences=next;describeQuestion();await refresh();}));
 for(const id of ['answer','mode','minutes'])$(id).addEventListener('input',scheduleSave);
 wrap('save',async()=>{await flush();await refresh();report('草稿已存此裝置。');});
 wrap('start-selected',()=>start(selectedQuestion()));
 wrap('start-recommended',async()=>{if(recommendation.attempt){await loadAttempt(recommendation.attempt.id);$('minutes').value=recommendation.mainMinutes;$('mode').value=recommendation.mainMinutes<=10?'short':'full';await flush();}else await start(recommendation.question,recommendation.mainMinutes);});
 wrap('skip-task',async()=>{const id=recommendation.attempt?.id||recommendation.question?.id;if(id)skipped.push(id);await refresh();});
 wrap('start-custom',()=>{const body=$('custom-question').value.trim();if(!body)throw Error('請填寫題幹');return start({id:'custom/'+uid(),subject:$('subject').value,body,title:'自選練習題',sourceLabel:$('custom-source').value.trim()||'使用者自選題，來源未查核'});});
 wrap('save-preferences',async()=>{
  const next=clone(preferences);
  for(const row of $('subjects').children){const weight=Number(row.querySelector('.weight').value);if(!Number.isInteger(weight)||weight<1||weight>10)throw Error('科目權重須為1到10');next.subjects[row.dataset.subject]={enabled:row.querySelector('.enabled').checked,learned:questions.some(q=>q.subject===row.dataset.subject&&topicScope(q,next,lectureData).learned),weight};}
  next.reviewIntervals=intervals(Object.fromEntries(['again','hint','independent'].map(k=>[k,Number($('interval-'+k).value)])));
  next.planning={minutes:Number($('planning-minutes').value),reviewLimit:Number($('review-limit').value)};planLimits(next);
  await engine.save('settings/preferences',next);preferences=next;preferencesFormDirty=false;updateRecallLabels();await refresh();report('考科、時間預算與複習間隔已保存；原有到期日期維持原樣。');
 });
 wrap('refresh-lectures',async()=>{
  if(engine.cloud){
   // The browser's shared lecture manager is deliberately outside account isolation.
   // Require a fresh user decision before importing it into the cloud account.
   const live=readLectures(localStorage,globalThis.PSDLectureCore);
   if(live){
    if(!confirm('此裝置的函授管理紀錄並非帳號專屬。確定將這 '+live.courses.length+' 門課、'+live.lessons.length+' 堂課的進度複製到目前登入的雲端帳號嗎？原本的函授管理不會被修改。'))return;
    lectureData=live;lectureSource={origin:location.origin,live:true};
    await engine.save('settings/lecture-progress',lectureSnapshot());
   } else await loadLectureProgress();
  }else await loadLectureProgress();
  const snapshot=lectureSnapshot();
  if(!engine.cloud && snapshot)await engine.save('settings/lecture-progress',snapshot);
  if(engine.cloud)await loadLectureProgress();
  describeQuestion();await refresh();
  report(snapshot?'函授進度及備份快照已更新。':'尚無有效函授資料，可手動確認已學主題。');
 });
 wrap('save-topic-lesson',async()=>{
  const q=selectedQuestion();if(!q)throw Error('請先選題');const mapping=validateMapping(q,$('topic-lesson').value,lectureData),next=clone(preferences);next.topicLessons={...next.topicLessons,[q.topicKey]:mapping};
  await store.update(s=>{engine.queue(s,'settings/preferences',next);engine.queue(s,'settings/lecture-progress',lectureSnapshot());});preferences=next;describeQuestion();await refresh();report('堂次與主題的對應已確認；完課後才會依此納入已學範圍。');
 });
 $('weak-topic').addEventListener('change',()=>action(async()=>{const q=selectedQuestion();if(!q)return;const next=clone(preferences);next.weakTopics=(next.weakTopics||[]).filter(x=>x!==q.topicKey);if($('weak-topic').checked)next.weakTopics.push(q.topicKey);await engine.save('settings/preferences',next);preferences=next;await refresh();}));
 wrap('submit-answer',()=>edit(()=>{if(!current.answer.trim())throw Error('請先寫下答案');current.revisions.push({id:uid(),text:current.answer,at:now()});current.answeredAt=now();}));
 wrap('checked',()=>edit(()=>{if(!current.answeredAt)throw Error('請先保存作答版本');current.checkedAt=now();}));
 wrap('add-feedback',()=>edit(()=>{const content=$('feedback-text').value.trim(),revision=$('feedback-revision').value;if(!content||!current.revisions.some(r=>r.id===revision))throw Error('請填寫回饋，並選擇已保存的答案版本');if(!/^\d{4}-\d{2}-\d{2}$/.test($('feedback-date').value))throw Error('請填取得日期');current.feedback.push({id:uid(),source:$('feedback-source').value.trim()||'來源／模型未知',date:$('feedback-date').value,revision,text:content,unverified:$('feedback-unverified').checked});$('feedback-text').value='';}));
 wrap('correct',async()=>{
  const category=validateWeaknessCategory($('gap-category').value);
  const flag=$('track-weak-topic').checked;
  const topicKey=current?.question.topicKey;
  if(flag&&!topicKey)throw Error('自選題尚無題庫主題鍵，請先取消優先主題勾選；分類與訂正仍可保存');
  await edit(()=>{if(!current.checkedAt)throw Error('請先完成作答與核對');const gap=$('gap').value.trim(),content=$('correction').value.trim();if(!gap||!content)throw Error('請填寫具體缺口與訂正內容');current.corrections.push({id:uid(),gap,category,text:content,at:now(),revision:current.revisions.at(-1)?.id,feedbackIds:current.feedback.map(f=>f.id),confirmedBy:'user'});current.correctedAt=now();current.due=nextReview('again',new Date(),preferences.reviewIntervals);$('gap').value='';$('correction').value='';});
  if(flag&&topicKey&&!preferences.weakTopics?.includes(topicKey)){
    const next=clone(preferences);next.weakTopics=[...(next.weakTopics||[]),topicKey];
    await engine.save('settings/preferences',next);preferences=next;await refresh();
    report('已保存人工確認的訂正與弱點分類；此主題列入後續選題參考。');
  }
});
 wrap('save-recall',()=>edit(()=>{const content=$('recall').value.trim();if(!current.correctedAt||!content)throw Error('請完成訂正後，再寫下獨立回想');const rating=$('rating').value;current.recalls.push({id:uid(),at:now(),text:content,rating,intervalDays:intervals(preferences.reviewIntervals)[rating]});current.due=nextReview(rating,new Date(),preferences.reviewIntervals);$('recall').value='';}));
 wrap('export-note',async()=>{await flush();if(!current)throw Error('請先選題');download(today()+'_備考筆記.md',markdown(current),'text/markdown;charset=utf-8');});
 wrap('copy-prompt',async()=>{await flush();if(!current?.answer.trim())throw Error('請先作答');const prompt=globalThis.AIPromptCustom.enhance('請以繁體中文批改下列'+(current.mode==='short'?'短練習，不評完整申論分數':'申論')+'。先辨識題意，再指出一項具體缺口，提示我自行訂正。不得杜撰法條或考古題來源。\n科目：'+current.subject+'\n題源：'+current.question.sourceLabel+'\n題目：'+current.question.body+'\n我的答案：'+current.answer,{subject:current.subject,mode:current.mode==='short'?'direction':'full'});await navigator.clipboard.writeText(prompt);report('已複製題目、作答與批改提示詞。');});
 wrap('open-dual-ai',()=>{
    if(!currentId||!current)throw Error('請先開始一道練習題');
    const answer=$('answer').value;
    if(!answer.trim())throw Error('請先作答，再送交雙 AI 審查');
    const revision=[...current.revisions].reverse().find(r=>r.text===answer);
    if(!revision)throw Error('請先按「保存作答版本」，確保雙 AI 評語能對應不變的答案版本');
    const id=currentId,revisionId=revision.id,sourceText=answer;
    const instruction=globalThis.AIPromptCustom.enhance(
      '請擔任臺灣司法特考三等觀護人申論題批改助教。依實際題意及科目檢查爭點、規範／學理、涵攝、結構；先辨識題源有無查證，再以具體理由提出缺漏、誤解及引導訂正的問題。短練習只評答題方向，不給完整申論分數。法條、裁判、研究與國考題次不能杜撰，未驗證須註明。',
      {subject:current.subject,mode:current.mode==='short'?'direction':'full'});
    const documentText=['【科目】'+current.subject,'【題源（僅沿用原紀錄，並非已查證）】'+current.question.sourceLabel,'【題目】'+current.question.body,'【本次已保存的作答版本】'+revisionId,'【我的答案】'+answer].join('\n\n');
    globalThis.PSDDualAI.start({payload:{title:'觀護人申論｜'+current.question.title,instruction,documentText},onResult:async review=>{
      await flush();
      await store.update(state=>{
        assertLearningEpoch(state,currentEpoch);
        const record=state.records[id];
        if(!record||record.deleted||record.value?.kind!=='attempt'||!record.value.revisions.some(r=>r.id===revisionId&&r.text===sourceText))throw Error('原始作答版本不存在或已變更，為避免錯配未自動寫入');
        const value=clone(record.value);
        value.feedback.push({id:uid(),source:'雙 AI 協作工作臺（交叉審查）',date:today(),revision:revisionId,text:review,unverified:true});
        value.updatedAt=now();
        engine.queue(state,id,value);
      });
      if(currentId===id){
        const updated=(await store.read()).records[id].value;
        current=clone(updated);baseline=clone(updated);paintAttempt();
      }
      await refresh();
      report('雙 AI 意見已附加至原本的作答版本，標示為待查證，舊紀錄保留。');
    }});
  });
 wrap('export-backup',exportBackup);
 $('choose-backup').addEventListener('click',()=>$('import-backup').click());
 $('clear-learning').addEventListener('click',()=>{$('clear-confirm-text').value='';$('clear-confirm').disabled=true;$('clear-dialog').showModal();});
 $('clear-confirm-text').addEventListener('input',()=>{$('clear-confirm').disabled=$('clear-confirm-text').value!=='清除';});
 $('clear-cancel').addEventListener('click',()=>$('clear-dialog').close());
 wrap('clear-backup',exportBackup);
 wrap('clear-confirm',clearLearning);
 $('import-backup').addEventListener('change',()=>action(async()=>{try{const f=$('import-backup').files[0];if(!f)return;if(f.size>20*1024*1024)throw Error('備份超過20MB');const data=JSON.parse(await f.text());if(data.format!==FORMAT||data.schemaVersion!==1)throw Error('書桌備份格式不符');validateState(data.state);if(data.state.records['settings/preferences'])validatePreferences(data.state.records['settings/preferences'].value);if(!confirm('匯入'+Object.keys(data.state.records).length+'筆書桌紀錄？相同ID的差異版本會另外保留；不會覆寫原稿。'))return;await flush();await engine.importRecords(data.state.records);preferences=validatePreferences((await store.read()).records['settings/preferences']?.value||preferences);await loadLectureProgress();renderPreferences();describeQuestion();await refresh();report('已匯入書桌紀錄；差異版本可在筆記區查看。');}finally{$('import-backup').value='';}}));
 wrap('import-legacy',async()=>{const records=await legacyRecords(localStorage,location.origin);if(!confirm('此網址找到'+Object.keys(records).length+'筆舊模組快照。匯入後可在書桌查看及備份；不會寫回舊模組。是否繼續？'))return;await engine.importRecords(records);await refresh();report('舊模組快照已匯入；原有資料保持完整。');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)action(flush);else action(async()=>{await loadLectureProgress();describeQuestion();await refresh();});});
 window.addEventListener('beforeunload',e=>{if(timer){e.preventDefault();e.returnValue='';}});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>report('離線資源快取未完成；草稿仍保存於此裝置。',true));
}
setup().catch(e=>report('書桌無法開啟：'+e.message,true));
