/* Reuse the ORIGINAL v2.5 past-paper sources only. 342 predicted questions are excluded. */
(function(root){
 'use strict';
 const valid=items=>Array.isArray(items)?items.filter(q=>q&&typeof q==='object'&&typeof q.id==='string'&&q.id.length&&typeof q.body==='string'&&q.body.length):[];
 function merge(primary,related){
  const a=valid(primary),b=valid(related),all=[],seen=new Set(),duplicates=[];
  for(const [items,origin] of [[a,'主要考古題'],[b,'相關類科考古題']]){
   for(const q of items){
    if(seen.has(q.id)){duplicates.push(q.id);continue;}
    seen.add(q.id);
    all.push({...q,sourceCategory:origin,examTypes:Array.isArray(q.examTypes)&&q.examTypes.length?q.examTypes.slice():[q.examType||'未註明類科']});
   }
  }
  return {all,primaryCount:a.length,relatedCount:b.length,total:all.length,duplicates};
 }
 const state=merge(root.QUESTION_BANK,root.RELATED_QUESTION_BANK);
 root.Study30QuestionSources={...state,expectedTotal:426,revision:'original-v25',predictedQuestionCount:0};
 function show(){
  const el=document.getElementById('questionSourceSummary');
  if(!el)return;
  const count=state.total,complete=count===426&&state.primaryCount===374&&state.relatedCount===52&&!state.duplicates.length;
  el.textContent=complete?
   '選題來源：原站 426 題（主要考古題 374＋相關類科 52）。':
   '題庫載入狀態：共 '+count+' 題（主要 '+state.primaryCount+'＋相關 '+state.relatedCount+'）；與已核對的原站 426 題版本不同，請檢查來源或更新版次。342 題預測題庫未納入。';
  el.dataset.complete=String(complete);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})(window);