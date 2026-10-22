/* 既有 426 題（原始主題庫374＋其他相關類科52）加上115年警察預防組四科16題之改編練習。 */
(function(root){
 'use strict';
 const valid=items=>Array.isArray(items)?items.filter(q=>q&&typeof q==='object'&&typeof q.id==='string'&&q.id.length&&typeof q.body==='string'&&q.body.length):[];
 function merge(primary,related){
  const a=valid(primary),b=valid(related),all=[],seen=new Set(),duplicates=[];
  for(const [items,origin] of [[a,'主要考古題'],[b,'相關類科考古題']]){
   for(const q of items){
    if(seen.has(q.id)){duplicates.push(q.id);continue;}
    seen.add(q.id);
    all.push({...q,sourceCategory:q.sourceKind?.includes('改編')?'115年警察預防組四科（改編）':origin,examTypes:Array.isArray(q.examTypes)&&q.examTypes.length?q.examTypes.slice():[q.examType||'未註明類科']});
   }
  }
  return {all,primaryCount:a.length,relatedCount:b.length,adaptedPoliceCount:b.filter(q=>q.sourceKind?.includes('考古題改編')&&q.id.startsWith('115-')).length,total:all.length,duplicates};
 }
 const state=merge(root.QUESTION_BANK,root.RELATED_QUESTION_BANK);
 root.Study30QuestionSources={...state,expectedTotal:442,originalTotal:426,revision:'v25+115-police-four-subjects-adapted',predictedQuestionCount:0};
 function show(){
  const el=document.getElementById('questionSourceSummary');if(!el)return;
  const complete=state.total===442&&state.primaryCount===374&&state.relatedCount===68&&state.adaptedPoliceCount===16&&!state.duplicates.length;
  el.textContent=complete?'題庫來源：既有426題＋115年警察預防組指定四科16題（依考古題改編，附原卷來源）。':
   '題庫載入狀態：共'+state.total+'題（主要'+state.primaryCount+'＋相關'+state.relatedCount+'，其中警察改編'+state.adaptedPoliceCount+'）；請檢查來源、重複題號或更新版次。';
  el.dataset.complete=String(complete);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();
})(window);
