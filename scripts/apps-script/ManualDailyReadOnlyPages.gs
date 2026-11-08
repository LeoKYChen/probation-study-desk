/**
 * Read-only, reproducible pages of source documents. No cursor updates.
 * For initial verification leave KIND='markdown' and PAGE=0.
 * Change only these two local constants when reviewing further pages.
 * Never logs raw Drive IDs, filenames or question text.
 */
function previewManualDailySourcePage() {
  var KIND='markdown'; // 'google' or 'markdown'
  var PAGE=0;          // zero-based; page 0 is the first three files
  var LIMIT=3;
  if(['google','markdown'].indexOf(KIND)<0||!Number.isInteger(PAGE)||PAGE<0||LIMIT!==3)
    throw Error('唯讀來源分頁參數不正確');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('有其他題庫處理正在執行');
  try {
    var props=PropertiesService.getScriptProperties(),cfg=manualQuestionCfg_();
    if(props.getProperty('PSD_MANUAL_DAILY_MODE')!=='isolated'||
       props.getProperty('PSD_MANUAL_DAILY_WRITE_ENABLED')!=='false'||
       cfg.branch==='main')throw Error('此功能僅限明確停用寫入的隔離測試副本');
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    if(!/^[0-9a-f]{40}$/.test(head))throw Error('GitHub HEAD 格式異常');
    var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,false);
    var original=manualQuestionReadMonthly_(cfg,monthly.data,head);
    manualQuestionValidate_(original,original);
    var folder=DriveApp.getFolderById(KIND==='google'?cfg.google:cfg.markdown);
    var iterator=KIND==='google'?folder.getFilesByType(MimeType.GOOGLE_DOCS):folder.getFiles();
    var sources=[];
    while(iterator.hasNext()){
      var file=iterator.next();
      if(KIND==='markdown'&&!/\.md$/i.test(file.getName()))continue;
      sources.push({id:file.getId(),key:manualQuestionSourceKey_(KIND,file.getId())});
    }
    sources.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    var selected=sources.slice(PAGE*LIMIT,(PAGE+1)*LIMIT);
    var result={mode:'read-only-source-page',branch:cfg.branch,head:head,kind:KIND,
      page:PAGE+1,pageSize:LIMIT,totalSources:sources.length,
      totalPages:Math.ceil(sources.length/LIMIT),selected:selected.length,
      oldQuestions:original.questions.length,sourceKeys:selected.map(function(s){return s.key;})};
    if(selected.length){
      var ids=new Set(selected.map(function(s){return s.id;}));
      var next=mdCollect_({googleIds:KIND==='google'?ids:new Set(),
        mdIds:KIND==='markdown'?ids:new Set(),
        strict:true,previousDataset:original}).data;
      manualQuestionValidate_(original,next);
      var previousIds={};
      original.questions.forEach(function(q){previousIds[q.id]=true;});
      result.newQuestions=next.questions.filter(function(q){return !previousIds[q.id];})
        .map(function(q){return {id:q.id,date:q.date,subject:q.subject};});
      result.proposedCount=next.count;
      result.diagnosticCount=(next.diagnostics||[]).length;
    }else{
      result.newQuestions=[];
      result.proposedCount=original.questions.length;
      result.diagnosticCount=0;
    }
    console.log('每日題庫來源分頁預覽（唯讀、不更新游標）：'+JSON.stringify(result));
    return result;
  }finally{lock.releaseLock();}
}
