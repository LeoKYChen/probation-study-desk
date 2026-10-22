import {intervals,DEFAULT_INTERVALS,topicScope,planLimits} from './planning.js';
const EXCLUDED_SUBJECTS=new Set(['社會工作','國文','法學知識與英文']);
export const isSupportedSubject=subject=>!EXCLUDED_SUBJECTS.has(subject);
export const SUBJECTS=['少年事件處理法','刑法','刑事訴訟法','保安處分執行法','心理學','犯罪學','諮商與輔導','心理測驗'];
export const now = () => new Date().toISOString();
export function today(date=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function nextReview(rating,date=new Date(),settings=DEFAULT_INTERVALS) {
  const days=intervals(settings)[rating];
  if(!days) throw Error('請選擇回想狀態');
  const d=new Date(today(date)+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+days);return today(d);
}
export function attempts(state) { return Object.entries(state.records).filter(([id,r])=>id.startsWith('attempt/')&&!r.deleted&&r.value?.kind==='attempt').map(([id,r])=>({id,...r.value})); }
export function recommend(state,questions,preferences,skipped=[],context={}) {
  const all=attempts(state),day=today(context.date||new Date()),enabled=SUBJECTS.filter(s=>preferences.subjects?.[s]?.enabled);
  const {minutes,reviewLimit}=planLimits(preferences),lecture=Object.hasOwn(context,'lectures')?context.lectures:state.records['settings/lecture-progress']?.value?.data;
  const due=all.filter(a=>a.due&&a.due<=day&&!skipped.includes(a.id)&&enabled.includes(a.subject)).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
  const unfinished=all.filter(a=>!a.correctedAt&&!skipped.includes(a.id)&&enabled.includes(a.subject)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  const practiced=all.filter(a=>a.answeredAt||a.correctedAt||a.answer?.trim()||a.recalls?.length);
  const counts=Object.fromEntries(enabled.map(s=>[s,practiced.filter(a=>a.subject===s).length]));
  const recent=Object.fromEntries(enabled.map(s=>[s,practiced.filter(a=>a.subject===s).map(a=>a.updatedAt).sort().at(-1)||'']));
  const scope=new Map(questions.map(q=>[q.id,topicScope(q,preferences,lecture)]));
  const eligible=questions.filter(q=>enabled.includes(q.subject)&&q.topicKey&&scope.get(q.id).learned&&!skipped.includes(q.id));
  const questionLast=q=>practiced.filter(a=>a.question.id===q.id).map(a=>a.updatedAt).sort().at(-1)||'';
  eligible.sort((a,b)=>counts[a.subject]/(preferences.subjects[a.subject].weight||1)-counts[b.subject]/(preferences.subjects[b.subject].weight||1)||recent[a.subject].localeCompare(recent[b.subject])||Number(preferences.weakTopics?.includes(b.topicKey)||false)-Number(preferences.weakTopics?.includes(a.topicKey)||false)||questionLast(a).localeCompare(questionLast(b))||a.id.localeCompare(b.id));
  const audit={rulesVersion:2,date:day,minutes,reviewLimit,enabledSubjects:enabled,learnedCandidates:eligible.length,excluded:{disabled:questions.filter(q=>!enabled.includes(q.subject)).length,scopeUnknown:questions.filter(q=>enabled.includes(q.subject)&&!scope.get(q.id).learned).length,skipped:skipped.length}};
  let result;
  if(unfinished[0])result={type:'resume',attempt:unfinished[0],reason:'接續尚未'+(unfinished[0].answeredAt?'訂正':'作答')+'的練習'};
  else if(due[0])result={type:'review',attempt:due[0],reason:'這一題已到再次回想日期'};
  else if(eligible[0])result={type:'new',question:eligible[0],reason:scope.get(eligible[0].id).basis+'；兼顧各科權重、間隔及本人標記的弱點。題源沿用原題庫標示。'};
  else result={type:'empty',reason:'尚無符合已學主題的題目。請確認進度、手動選題，或先登錄自選題。'};
  const mainMinutes=result.type==='empty'?0:result.type==='review'?Math.min(10,minutes):Math.min(result.attempt?.minutes||30,minutes);
  const available=Math.max(0,minutes-mainMinutes),maxExtra=Math.min(reviewLimit,Math.floor(available/5));
  const extras=due.filter(a=>a.id!==result.attempt?.id);
  return {...result,due:extras.slice(0,maxExtra),deferredReviews:extras.length-maxExtra>0?extras.length-maxExtra:0,mainMinutes,audit:{...audit,selectedId:result.attempt?.id||result.question?.id||null,reason:result.reason}};
}
export function newAttempt(question,mode) {
  return {kind:'attempt',question:structuredClone(question),subject:question.subject,mode,minutes:mode==='short'?10:30,answer:'',revisions:[],feedback:[],corrections:[],recalls:[],updatedAt:now(),answeredAt:null,checkedAt:null,correctedAt:null,due:null};
}
export function markdown(a) {
 const lines=['# '+a.subject+'｜備考書桌','',a.question.body,'','來源：'+(a.question.sourceLabel||'使用者自選題，來源未查核'),a.question.sourceUrl||'','','## 目前作答','',a.answer||'（尚未作答）'];
 for(const r of a.revisions||[]) lines.push('','## 作答版本 '+r.at,'',r.text);
 for(const f of a.feedback||[]) lines.push('','## 回饋｜'+f.source+'｜'+f.date,(f.unverified?'待查證':'由使用者標記已核對'),'','對應答案版本：'+f.revision,'',f.text);
 for(const c of a.corrections||[]) lines.push('','## 訂正｜'+c.at,'','缺口：'+c.gap,'',c.text);
 for(const r of a.recalls||[]) lines.push('','## 再次回想｜'+r.at,'',r.text,'','自評：'+r.rating+(r.intervalDays?'；當次設定間隔：'+r.intervalDays+'天':''));
 if(a.due)lines.push('','下次回想日期：'+a.due);
 return lines.join('\n');
}
