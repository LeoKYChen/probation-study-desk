/**
 * Read-only batch health-check. Install only in an isolated Apps Script TEST
 * copy. Pages are stable by hashed source key; no cursor is saved.
 *
 * For the first run: KIND='markdown', PAGE=0, LIMIT=6.
 * To reproduce the known October 8 failure: KIND='markdown', PAGE=0
 * (the second old 3-file page will appear in this first 6-file batch).
 *
 * This is a diagnostic scan, NOT authorization to publish or skip bad sources.
 * A per-source parse failure is recorded, rather than aborting all sources.
 */
function healthCheckManualDailySourceBatch() {
  var KIND='markdown'; // 'markdown' or 'google'
  var PAGE=0;          // zero-based page, change after inspecting each batch
  var LIMIT=6;         // at most 6 source files per Apps Script execution
  if(['markdown','google'].indexOf(KIND)<0||
      !Number.isInteger(PAGE)||PAGE<0||LIMIT<1||LIMIT>6)
    throw Error('批次健檢參數不符合安全限制');

  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('其他題庫作業正在執行，請勿重複啟動');
  try {
    var props=PropertiesService.getScriptProperties(),cfg=manualQuestionCfg_();
    if(props.getProperty('PSD_MANUAL_DAILY_MODE')!=='isolated'||
       props.getProperty('PSD_MANUAL_DAILY_WRITE_ENABLED')!=='false'||
       cfg.branch==='main')
      throw Error('健檢只允許明確停用寫入的隔離測試副本');
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    if(!/^[0-9a-f]{40}$/.test(head))throw Error('GitHub HEAD 格式異常');
    var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,false);
    var baseline=manualQuestionReadMonthly_(cfg,monthly.data,head);
    manualQuestionValidate_(baseline,baseline);

    var folder=DriveApp.getFolderById(KIND==='google'?cfg.google:cfg.markdown);
    var iterator=KIND==='google'?folder.getFilesByType(MimeType.GOOGLE_DOCS):folder.getFiles();
    var all=[];
    while(iterator.hasNext()){
      var f=iterator.next();
      if(KIND==='markdown'&&!/\.md$/i.test(f.getName()))continue;
      all.push({id:f.getId(),key:manualQuestionSourceKey_(KIND,f.getId()),file:f});
    }
    all.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
    var selected=all.slice(PAGE*LIMIT,(PAGE+1)*LIMIT);
    var result={mode:'read-only-batch-health',branch:cfg.branch,head:head,
      kind:KIND,page:PAGE+1,pageSize:LIMIT,totalSources:all.length,
      totalPages:Math.ceil(all.length/LIMIT),selected:selected.length,
      oldQuestions:baseline.questions.length,
      counts:{parsed:0,needsReview:0,nonQuestionConfirmed:0,newCandidates:0},
      files:[],hasMore:(PAGE+1)*LIMIT<all.length,
      notes:[
        '解析成功並非法律內容已核對；無新題也不代表來源已入庫。',
        '來源無完整題幹只標記需人工確認，不自動認定非題目來源。',
        '此次沒有執行任何寫入、建立檢查點或更新掃描游標。'
      ]};
    var baselineIds={};
    baseline.questions.forEach(function(q){baselineIds[q.id]=true;});

    selected.forEach(function(entry){
      var record={sourceKey:entry.key,fileName:entry.file.getName().slice(0,100)};
      try {
        var idSet=new Set([entry.id]);
        var collected=mdCollect_({
          googleIds:KIND==='google'?idSet:new Set(),
          mdIds:KIND==='markdown'?idSet:new Set(),
          strict:true,previousDataset:baseline
        }).data;
        manualQuestionValidate_(baseline,collected);
        var extra=collected.questions.filter(function(q){return !baselineIds[q.id];});
        record.status='parsed';
        record.newCandidateCount=extra.length;
        record.newCandidates=extra.slice(0,6).map(function(q){
          return {id:q.id,date:q.date,subject:q.subject};
        });
        result.counts.parsed++;
        result.counts.newCandidates+=extra.length;
      } catch(e) {
        // A missing independent question can also mean an older heading style.
        // Never silently treat this as a confirmed non-question document.
        record.status='needs-review';
        record.reason=String((e&&e.message)||e).slice(0,180)
          .replace(/(?:github_pat_|ghp_|sk-proj-)[A-Za-z0-9_-]+/g,'[REDACTED]');
        result.counts.needsReview++;
      }
      result.files.push(record);
      console.log('唯讀來源健檢進度：'+JSON.stringify(record));
    });
    console.log('每日題庫批次健檢摘要（唯讀）：'+JSON.stringify(result));
    return result;
  }finally{
    lock.releaseLock();
  }
}
