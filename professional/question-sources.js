/* Shared v2.5 official past-paper bank: retain 426 legacy IDs and extend with 127 source-reviewed police originals.
 * The 342 predicted questions remain excluded. Study sessions keep their existing storage key. */
(function(root){
 'use strict';
 const valid=items=>Array.isArray(items)?items.filter(q=>q&&typeof q==='object'&&typeof q.id==='string'&&q.id.length&&typeof q.body==='string'&&q.body.length):[];
 function merge(primary,related,police){
  const a=valid(primary),b=valid(related),c=valid(police),all=[],seen=new Set(),duplicates=[];
  for(const [items,origin] of [[a,'主要考古題'],[b,'相關類科考古題'],[c,'警察特考相關類科官方原題（AI輔助來源核對，待人工複核）']]){
   for(const q of items){
    if(seen.has(q.id)){duplicates.push(q.id);continue;}
    seen.add(q.id);
    all.push({...q,sourceCategory:origin,examTypes:Array.isArray(q.examTypes)&&q.examTypes.length?q.examTypes.slice():[q.examType||'未註明類科']});
   }
  }
  return {all,primaryCount:a.length,relatedCount:b.length,policeCount:c.length,total:all.length,duplicates};
 }
 const approved=root.PolicePastPaperIntegration?.approved||[];
 const rejected=root.PolicePastPaperIntegration?.rejected||[];
 const state=merge(root.QUESTION_BANK,root.RELATED_QUESTION_BANK,approved);
 const complete=state.total===553&&state.primaryCount===374&&state.relatedCount===52&&state.policeCount===127&&!state.duplicates.length&&!rejected.length;
 root.Study30QuestionSources={...state,expectedTotal:553,legacyTotal:426,revision:'official-553-v1',predictedQuestionCount:0,complete};
 function show(){
  const el=document.getElementById('questionSourceSummary');
  if(!el)return;
  el.textContent=complete?
   '選題來源：全站考古題 553 題（原有 426 題＋警察相關類科原題 127 題，後者待人工逐卷複核）。':
   '題庫載入不完整：目前 '+state.total+' 題（原有 '+(state.primaryCount+state.relatedCount)+' 題、新增 '+state.policeCount+' 題、重複 '+state.duplicates.length+' 題、拒收 '+rejected.length+' 題）。請連線更新，避免把缺漏資料當成完整題庫。';
  el.dataset.complete=String(complete);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})(window);
