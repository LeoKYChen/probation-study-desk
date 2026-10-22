// Only user-confirmed corrections count as learning weaknesses.
// AI feedback is unverified input and is never classified automatically.
export const WEAKNESS_CATEGORIES=Object.freeze([
 ['issue','爭點／問題辨識'],['norm','法規／理論知識'],['application','涵攝／實務應用'],
 ['reasoning','論證／方法'],['structure','結構與表達'],['evidence','來源查證'],['other','其他']
]);
const labels=new Map(WEAKNESS_CATEGORIES);
export const weaknessLabel=key=>labels.get(key)||labels.get('other');
export function validateWeaknessCategory(value){
 if(!labels.has(value))throw Error('請選擇有效的弱點類別');
 return value;
}
export function confirmedWeaknesses(attemptList){
 const groups=new Map();
 for(const a of attemptList){
  if(!a||!Array.isArray(a.corrections))continue;
  for(const c of a.corrections){
   if(!c||typeof c.gap!=='string'||!c.gap.trim()||typeof c.text!=='string'||!c.text.trim())continue;
   const category=labels.has(c.category)?c.category:'other';
   const key=a.id+'|'+c.id;
   if(groups.has(key))continue;
   groups.set(key,{id:key,attemptId:a.id,subject:a.subject||'未標示考科',
    question:a.question||{},category,label:weaknessLabel(category),gap:c.gap,
    at:c.at||'',due:a.due||null,recallCount:Array.isArray(a.recalls)?a.recalls.length:0,
    lastRecall:Array.isArray(a.recalls)&&a.recalls.length?a.recalls.at(-1).rating:null});
  }
 }
 return [...groups.values()].sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export function weaknessStats(items){
 const categories=WEAKNESS_CATEGORIES.map(([id,label])=>({id,label,count:items.filter(x=>x.category===id).length})).filter(x=>x.count);
 return {total:items.length,categories,subjects:[...new Set(items.map(x=>x.subject))].map(subject=>({subject,count:items.filter(x=>x.subject===subject).length})).sort((a,b)=>b.count-a.count||a.subject.localeCompare(b.subject))};
}

/**
 * Trends count distinct corrected attempts, not the number of AI suggestions or
 * multiple correction paragraphs in a single answer. A category across questions
 * is a recurring ERROR TYPE, not proof that the same knowledge point was missed.
 */
export function weaknessTrends(attemptList){
 const items=confirmedWeaknesses(attemptList);
 const groups=new Map();
 for(const item of items){
  const key=item.subject+'\u0000'+item.category;
  if(!groups.has(key))groups.set(key,{subject:item.subject,category:item.category,label:item.label,attemptIds:new Set(),questionIds:new Set(),examples:[]});
  const group=groups.get(key);
  group.attemptIds.add(item.attemptId);
  if(item.question.id)group.questionIds.add(item.question.id);
  if(group.examples.length<3&&!group.examples.includes(item.gap))group.examples.push(item.gap);
 }
 return [...groups.values()].map(g=>({
  subject:g.subject,category:g.category,label:g.label,
  correctedAttempts:g.attemptIds.size,distinctQuestions:g.questionIds.size,
  examples:g.examples,recurring:g.attemptIds.size>=2&&g.questionIds.size>=2
 })).sort((a,b)=>Number(b.recurring)-Number(a.recurring)||b.distinctQuestions-a.distinctQuestions||b.correctedAttempts-a.correctedAttempts||a.subject.localeCompare(b.subject)||a.category.localeCompare(b.category));
}
/**
 * A recall rating is for the WHOLE attempt, not an individual correction.
 * Report only a self-assessment trajectory; never infer objective mastery.
 */
export function recallTrajectory(attempt){
 const corrections=Array.isArray(attempt?.corrections)?attempt.corrections.filter(c=>c?.gap?.trim()&&c?.text?.trim()):[];
 if(!corrections.length)return {status:'not-corrected',label:'尚無人工訂正',count:0};
 const firstCorrection=corrections.map(c=>c.at).filter(Boolean).sort()[0]||'';
 const recalls=(Array.isArray(attempt?.recalls)?attempt.recalls:[])
   .filter(r=>r&&['again','hint','independent'].includes(r.rating)&&r.at&&(!firstCorrection||r.at>=firstCorrection))
   .sort((a,b)=>a.at.localeCompare(b.at)||String(a.id||'').localeCompare(String(b.id||'')));
 if(!recalls.length)return {status:'no-recall',label:'已訂正，尚未回想',count:0};
 const first=recalls[0].rating,last=recalls.at(-1).rating,rank={again:0,hint:1,independent:2};
 const status=recalls.length<2?'single':rank[last]>rank[first]?'improving':rank[last]<rank[first]?'declining':'stable';
 const names={again:'尚不會',hint:'需要提示',independent:'可獨立說明'};
 const label=recalls.length<2?'最近自評：'+names[last]+'（僅一次）':
  '自評'+({improving:'進步',declining:'退步',stable:'持平'}[status])+'：'+names[first]+' → '+names[last]+'（'+recalls.length+'次）';
 return {status,label,count:recalls.length,first,last};
}
