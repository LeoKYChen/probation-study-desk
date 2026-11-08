/**
 * Read-only inventory for the isolated daily-question trial.
 * Counts source files and compares metadata to the last committed source-state.
 * Does NOT parse document bodies, write GitHub/Drive/Script Properties,
 * advance scan cursors or expose source file names/IDs.
 *
 * "withoutCheckpoint" is not the same as "not yet published".
 */
function inventoryManualDailyQuestionSources() {
  var props=PropertiesService.getScriptProperties();
  var cfg=manualQuestionCfg_();
  if(props.getProperty('PSD_MANUAL_DAILY_MODE')!=='isolated'||
     props.getProperty('PSD_MANUAL_DAILY_WRITE_ENABLED')!=='false'||
     cfg.branch==='main')throw Error('來源盤點只允許隔離且明確關閉寫入的測試副本');
  var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
  if(!/^[0-9a-f]{40}$/.test(head))throw Error('GitHub HEAD 格式異常');
  var existing=manualQuestionRead_(cfg,PSD_DAILY_SOURCE_STATE_PATH_,head,true);
  var known=existing?existing.data:{schemaVersion:1,sources:{}};
  if(!known||known.schemaVersion!==1||!known.sources||
     typeof known.sources!=='object'||Array.isArray(known.sources))
    throw Error('來源進度資料格式不符');
  var result={mode:'read-only-inventory',branch:cfg.branch,head:head,
    sourceStatePresent:!!existing,google:{total:0,unchangedCheckpoint:0,changedCheckpoint:0,withoutCheckpoint:0},
    markdown:{total:0,unchangedCheckpoint:0,changedCheckpoint:0,withoutCheckpoint:0},
    total:0,remainingToInspect:0,notes:[
      '未建立檢查點不代表題目尚未發布；既有245題仍須依題號核對。',
      '本函式只讀取來源檔案中繼資料，不讀取題目內容，亦不更新掃描游標。'
    ]};
  function count_(iterator,kind,output) {
    while(iterator.hasNext()){
      var file=iterator.next();
      if(kind==='markdown'&&!/\.md$/i.test(file.getName()))continue;
      output.total++;
      var key=manualQuestionSourceKey_(kind,file.getId());
      var prior=known.sources[key];
      if(!prior){output.withoutCheckpoint++;continue;}
      var modified=file.getLastUpdated().toISOString();
      var nameSha256=manualQuestionHash_(file.getName());
      if(prior.kind===kind&&prior.modified===modified&&prior.nameSha256===nameSha256)
        output.unchangedCheckpoint++;
      else output.changedCheckpoint++;
    }
  }
  count_(DriveApp.getFolderById(cfg.google).getFilesByType(MimeType.GOOGLE_DOCS),'google',result.google);
  count_(DriveApp.getFolderById(cfg.markdown).getFiles(),'markdown',result.markdown);
  result.total=result.google.total+result.markdown.total;
  result.remainingToInspect=result.google.changedCheckpoint+result.google.withoutCheckpoint+
    result.markdown.changedCheckpoint+result.markdown.withoutCheckpoint;
  console.log('每日題庫來源盤點（唯讀）：'+JSON.stringify(result));
  return result;
}
