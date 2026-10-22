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
