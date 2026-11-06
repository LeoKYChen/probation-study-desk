/**
 * Read-only deployment preflight for the user's actual Apps Script project.
 * This function NEVER writes to GitHub, Drive, Script Properties or triggers.
 * No token, Drive ID or source filename is returned or logged.
 *
 * Run preflightManualDailyQuestions() before installing / enabling the
 * production manual writer. A passing preflight does NOT replace a real
 * previewManualDailyQuestions() run or site browser acceptance.
 */
function preflightManualDailyQuestions() {
  var report={mode:'read-only',readyForManualSync:false,sourceFoldersAccessible:false,
    monthlyIndexPresent:false,fullArchiveVerified:false,legacyBaselinePreserved:false,
    offlineWrappersPresent:false,sourceStatePresent:false,
    oldTimeTriggers:[],writeAuthorized:false,blockers:[]};
  var p=PropertiesService.getScriptProperties();
  try{
    var cfg=manualQuestionCfg_();
    report.branch=cfg.branch;
    report.isolated=cfg.branch!=='main';
    DriveApp.getFolderById(cfg.google);
    DriveApp.getFolderById(cfg.markdown);
    report.sourceFoldersAccessible=true;
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    if(!/^[0-9a-f]{40}$/.test(head))throw Error('GitHub HEAD 版本格式異常');
    report.head=head;
    var master=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,true);
    if(!master){report.blockers.push('目標分支尚未發布月份題庫索引；不可使用新同步器寫入');}
    else{
      report.monthlyIndexPresent=true;
      report.monthlyCount=master.data.count;
      // Reject stale or corrupted data before considering any production write.
      var full=manualQuestionReadMonthly_(cfg,master.data,head);
      report.fullArchiveVerified=true;
      var baseline=manualQuestionRead_(cfg,'daily-simulation/questions.json',head,false);
      manualQuestionValidate_(baseline.data,full);
      report.legacyBaselinePreserved=true;
      report.originalCount=baseline.data.count;
      var pinned={repo:cfg.repo,branch:head,token:cfg.token};
      var wrappers=['file-data/questions-monthly.generated.js'];
      master.data.months.forEach(function(m){m.shards.forEach(function(shard){
        wrappers.push('file-data/'+shard.path.replace(/\.json$/,'.js'));
      });});
      wrappers.forEach(function(path){psdBridgeMeta_(pinned,path);});
      report.offlineWrappersPresent=true;
      report.offlineFileCount=wrappers.length;
      if(master.data.count<245)report.blockers.push('月份題庫題數少於最初的 245 題');
    }
    var state=manualQuestionRead_(cfg,PSD_DAILY_SOURCE_STATE_PATH_,head,true);
    if(state){
      if(!state.data||state.data.schemaVersion!==1||!state.data.sources||
         typeof state.data.sources!=='object'||Array.isArray(state.data.sources))
        report.blockers.push('來源成功檢查點結構不符');
      else{
        report.sourceStatePresent=true;
        report.checkpointedSources=Object.keys(state.data.sources).length;
      }
    }
    // This only inspects project metadata; it does not remove or update triggers.
    report.oldTimeTriggers=ScriptApp.getProjectTriggers().filter(function(trigger){
      var type=trigger.getEventType();
      return type===ScriptApp.EventType.CLOCK&&
        ['syncDailyResources','syncReadingNews','syncDailyNews'].indexOf(trigger.getHandlerFunction())>=0;
    }).map(function(trigger){return trigger.getHandlerFunction();});
    if(report.oldTimeTriggers.length)
      report.blockers.push('舊的時間觸發器仍在；驗收前不得將新同步視為正式取代');
    try{
      if(master)manualQuestionWriteGate_(cfg,head,master);
      else throw Error('未完成月份索引');
      report.writeAuthorized=true;
    }catch(e){
      // Lack of approval is expected in preflight; no side effect.
      report.writeAuthorized=false;
      report.writeBlockReason=String(e.message||e).slice(0,140);
    }
    if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==head)
      report.blockers.push('預檢過程中 GitHub HEAD 改變，請重新預檢');
  }catch(e){
    // Never disclose a property value, source title, repo token or Drive ID.
    var message=String(e&&e.message||e);
    if(/(?:Token|[Tt]oken|403|401)/.test(message))report.blockers.push('GitHub 憑證或權限核驗失敗');
    else report.blockers.push('讀取核驗未完成：'+message.slice(0,100));
  }
  report.readyForManualSync=report.blockers.length===0&&report.monthlyIndexPresent&&
    report.fullArchiveVerified&&report.legacyBaselinePreserved&&report.offlineWrappersPresent&&
    report.sourceFoldersAccessible&&report.writeAuthorized;
  console.log('每日模擬題上線預檢（唯讀、不修改任何資料）：'+JSON.stringify(report));
  return report;
}
