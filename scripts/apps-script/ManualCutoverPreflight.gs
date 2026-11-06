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
    oldTimeTriggers:[],writeAuthorized:false,safeToPreview:false,
    readyForProductionCutover:false,warnings:[],blockers:[]};
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
      // Confirm exact generated wrapper content; existence checks alone can
      // silently accept a previous month's offline answer bank.
      function expectedScript_(key,payload,comment){
        var obj={};obj[key]=payload;
        return comment+'\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+
          JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');})();\n';
      }
      var wrappers=[{path:'file-data/questions-monthly.generated.js',
        content:expectedScript_('daily-simulation/questions-monthly.json',master.data,
          '/* GENERATED question month manifest; do not edit. */')}];
      master.data.months.forEach(function(m){m.shards.forEach(function(shard){
        var key='daily-simulation/'+shard.path;
        var payload=manualQuestionRead_(cfg,key,head,false).data;
        wrappers.push({path:'file-data/'+shard.path.replace(/\.json$/,'.js'),
          content:expectedScript_(key,payload,'/* GENERATED question shard; do not edit. */')});
      });});
      wrappers.forEach(function(entry){
        var meta=psdBridgeMeta_(pinned,entry.path);
        var sha=psdBridgeSha1_(Utilities.newBlob(entry.content).getBytes());
        if(meta.sha!==sha)throw Error('ZIP 題庫檔案內容與月份來源不符');
      });
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
      report.warnings.push('目前執行者可見的舊時間觸發器尚在；不要在隔離驗收前停用');
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
    else if(/題庫|月份|分檔|SHA-256/.test(message))report.blockers.push('月份題庫內容或歷史題號核驗未通過');
    else if(/Drive|資料夾|SOURCE_FOLDER|MD_SOURCE/.test(message))report.blockers.push('Google Drive 資料夾或權限核驗未通過');
    else report.blockers.push('預檢讀取未完成；請核對 Apps Script 權限與來源資料');
  }
  report.safeToPreview=report.blockers.length===0&&report.monthlyIndexPresent&&
    report.fullArchiveVerified&&report.legacyBaselinePreserved&&report.offlineWrappersPresent&&
    report.sourceFoldersAccessible;
  report.readyForManualSync=report.safeToPreview&&report.writeAuthorized;
  report.readyForProductionCutover=report.readyForManualSync&&
    report.branch==='main'&&report.oldTimeTriggers.length===0;
  console.log('每日模擬題上線預檢（唯讀、不修改任何資料）：'+JSON.stringify(report));
  return report;
}
