/* Shared question bank: merges the main bank and the related bank imported by the user
 * (scripts/import-questions.mjs). Counts come from the data; nothing is hard-coded.
 * Study sessions keep their existing storage key. */
(function(root){
 'use strict';
 const valid=items=>Array.isArray(items)?items.filter(q=>q&&typeof q==='object'&&typeof q.id==='string'&&q.id.length&&typeof q.body==='string'&&q.body.length):[];
 function merge(primary,related){
  const a=valid(primary),b=valid(related),all=[],seen=new Set(),duplicates=[];
  for(const [items,origin] of [[a,'主要題庫'],[b,'相關題庫']]){
   for(const q of items){
    if(seen.has(q.id)){duplicates.push(q.id);continue;}
    seen.add(q.id);
    all.push({...q,sourceCategory:origin,examTypes:Array.isArray(q.examTypes)&&q.examTypes.length?q.examTypes.slice():[q.examType||'未註明考試']});
   }
  }
  return {all,primaryCount:a.length,relatedCount:b.length,policeCount:0,total:all.length,duplicates};
 }
 const loaded=Array.isArray(root.QUESTION_BANK)&&Array.isArray(root.RELATED_QUESTION_BANK);
 const state=merge(root.QUESTION_BANK,root.RELATED_QUESTION_BANK);
 // 「完整」只表示題庫檔已載入且沒有重複 ID；不代表題目已經過官方來源核對。
 const complete=loaded&&!state.duplicates.length;
 root.Study30QuestionSources={...state,expectedTotal:state.total,legacyTotal:state.total,revision:'user-import-v1',predictedQuestionCount:0,complete,empty:state.total===0};
 function show(){
  const el=document.getElementById('questionSourceSummary');
  if(!el)return;
  el.textContent=!loaded?
   '題庫檔沒有載入：請確認網路連線或重新整理頁面。':
   state.total===0?
   '題庫尚未匯入：請用 scripts/import-questions.mjs 匯入你自備的題目。':
   state.duplicates.length?
   '題庫有 '+state.duplicates.length+' 個重複的題目 ID，已略過重複的題目。目前可練習 '+state.total+' 題。':
   '選題來源：你匯入的題庫，共 '+state.total+' 題（主要 '+state.primaryCount+' 題、相關 '+state.relatedCount+' 題）。題目來源請自行核對。';
  el.dataset.complete=String(complete);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})(window);
