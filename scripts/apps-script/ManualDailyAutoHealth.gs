/**
 * TEST COPY ONLY. One manual start automatically inspects all source files.
 * Writes only TEST Script Properties and dedicated TEST time triggers.
 * Never commits to GitHub, edits source files, or modifies production triggers.
 *
 * Public entrypoints:
 *   startManualDailyAutoHealth()
 *   statusManualDailyAutoHealth()
 *   stopManualDailyAutoHealth()
 *
 * Dedicated continuation handler:
 *   continueManualDailyAutoHealth()
 */
var PSD_HEALTH_PREFIX_='PSD_DAILY_HEALTH_V1_';
var PSD_HEALTH_STATE_KEY_=PSD_HEALTH_PREFIX_+'STATE';
var PSD_HEALTH_HANDLER_='continueManualDailyAutoHealth';
var PSD_HEALTH_LIMIT_=6;

function manualDailyHealthGuard_() {
  var p=PropertiesService.getScriptProperties(),cfg=manualQuestionCfg_();
  if(p.getProperty('PSD_MANUAL_DAILY_MODE')!=='isolated' ||
     p.getProperty('PSD_MANUAL_DAILY_WRITE_ENABLED')!=='false' ||
     cfg.branch==='main' ||
     cfg.branch!==p.getProperty('PSD_MANUAL_DAILY_ISOLATED_BRANCH'))
    throw Error('僅允許明確關閉 GitHub 寫入的隔離測試副本');
  return cfg;
}
function manualDailyHealthSourceList_(cfg,kind) {
  var folder=DriveApp.getFolderById(kind==='google'?cfg.google:cfg.markdown);
  var iter=kind==='google'?folder.getFilesByType(MimeType.GOOGLE_DOCS):folder.getFiles();
  var files=[];
  while(iter.hasNext()){
    var f=iter.next();
    if(kind==='markdown'&&!/\.md$/i.test(f.getName()))continue;
    files.push({key:manualQuestionSourceKey_(kind,f.getId()),id:f.getId(),
      name:f.getName().slice(0,100)});
  }
  files.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
  return files;
}
function manualDailyHealthFingerprint_(list) {
  return manualQuestionHash_(list.map(function(x){return x.key;}).join('|'));
}
function manualDailyHealthRemoveOwnTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()===PSD_HEALTH_HANDLER_)ScriptApp.deleteTrigger(t);
  });
}
function manualDailyHealthSchedule_() {
  manualDailyHealthRemoveOwnTrigger_();
  ScriptApp.newTrigger(PSD_HEALTH_HANDLER_).timeBased().after(60000).create();
}
function manualDailyHealthState_() {
  var raw=PropertiesService.getScriptProperties().getProperty(PSD_HEALTH_STATE_KEY_);
  if(!raw)throw Error('尚未啟動完整來源健檢');
  var state=JSON.parse(raw);
  if(!state||state.version!==1)throw Error('健檢進度格式異常');
  return state;
}
function manualDailyHealthSave_(state) {
  PropertiesService.getScriptProperties().setProperty(PSD_HEALTH_STATE_KEY_,JSON.stringify(state));
}
function startManualDailyAutoHealth() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('有其他健檢作業正在執行');
  try{
    var cfg=manualDailyHealthGuard_(),p=PropertiesService.getScriptProperties();
    var prior=p.getProperty(PSD_HEALTH_STATE_KEY_);
    if(prior){
      var existing=JSON.parse(prior);
      if(existing.status==='running')throw Error('已有健檢正在進行；請先查看狀態，勿重複啟動');
    }
    // A new run is explicit; keep old per-batch records only until overwritten.
    Object.keys(p.getProperties()).forEach(function(k){
      if(k.indexOf(PSD_HEALTH_PREFIX_+'BATCH_')===0)p.deleteProperty(k);
    });
    manualDailyHealthRemoveOwnTrigger_();
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    if(!/^[0-9a-f]{40}$/.test(head))throw Error('GitHub HEAD 格式異常');
    var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,false);
    var original=manualQuestionReadMonthly_(cfg,monthly.data,head);
    manualQuestionValidate_(original,original);
    var google=manualDailyHealthSourceList_(cfg,'google');
    var markdown=manualDailyHealthSourceList_(cfg,'markdown');
    var state={version:1,status:'running',branch:cfg.branch,head:head,
      baseline:original.questions.length,stage:'google',offset:0,
      googleTotal:google.length,markdownTotal:markdown.length,
      googleFingerprint:manualDailyHealthFingerprint_(google),
      markdownFingerprint:manualDailyHealthFingerprint_(markdown),
      processed:0,parsed:0,needsReview:0,newCandidates:0,batches:0};
    manualDailyHealthSave_(state);
    // The first batch runs now, further batches use only the dedicated trigger.
    return manualDailyHealthBatch_();
  }finally{lock.releaseLock();}
}
function continueManualDailyAutoHealth() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return; // an overlapping trigger must not race state
  try{
    manualDailyHealthBatch_();
  }catch(e){
    // Stop the dedicated retry chain on unexpected failures; no endless triggers.
    var p=PropertiesService.getScriptProperties(),raw=p.getProperty(PSD_HEALTH_STATE_KEY_);
    if(raw){
      var state=JSON.parse(raw);
      state.status='stopped';
      state.reason=String((e&&e.message)||e).slice(0,180);
      manualDailyHealthSave_(state);
    }
    manualDailyHealthRemoveOwnTrigger_();
    console.error('自動健檢已安全停止：'+String((e&&e.message)||e).slice(0,180));
    throw e;
  }finally{lock.releaseLock();}
}
function manualDailyHealthBatch_() {
  var cfg=manualDailyHealthGuard_(),state=manualDailyHealthState_();
  if(state.status!=='running')return state;
  if(state.branch!==cfg.branch)throw Error('測試分支與健檢啟動時不同');
  var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
  if(state.head!==head) {
    state.status='stopped';state.reason='測試分支在健檢期間發生變更；請重新啟動';
    manualDailyHealthSave_(state);manualDailyHealthRemoveOwnTrigger_();
    throw Error(state.reason);
  }
  var kind=state.stage;
  var sources=manualDailyHealthSourceList_(cfg,kind);
  if(sources.length!==state[kind+'Total'] ||
     manualDailyHealthFingerprint_(sources)!==state[kind+'Fingerprint']){
    state.status='stopped';state.reason='來源清單在健檢期間異動；停止避免漏檢';
    manualDailyHealthSave_(state);manualDailyHealthRemoveOwnTrigger_();
    throw Error(state.reason);
  }
  var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,false);
  var baseline=manualQuestionReadMonthly_(cfg,monthly.data,head);
  if(baseline.questions.length!==state.baseline)throw Error('既有題庫數量改變，停止');
  manualQuestionValidate_(baseline,baseline);
  var known={};
  baseline.questions.forEach(function(q){known[q.id]=true;});
  var selected=sources.slice(state.offset,state.offset+PSD_HEALTH_LIMIT_);
  var records=[];
  selected.forEach(function(entry){
    var record={sourceKey:entry.key,fileName:entry.name};
    try{
      var ids=new Set([entry.id]);
      var collected=mdCollect_({googleIds:kind==='google'?ids:new Set(),
        mdIds:kind==='markdown'?ids:new Set(),
        previousDataset:baseline,strict:true}).data;
      manualQuestionValidate_(baseline,collected);
      var added=collected.questions.filter(function(q){return !known[q.id];});
      record.status='parsed';
      record.newCandidateCount=added.length;
      record.newCandidates=added.slice(0,5).map(function(q){
        return {id:q.id,date:q.date,subject:q.subject};
      });
      state.parsed++;
      state.newCandidates+=added.length;
    }catch(e){
      record.status='needs-review';
      record.reason=String((e&&e.message)||e).slice(0,180)
        .replace(/(?:github_pat_|ghp_|sk-proj-)[A-Za-z0-9_-]+/g,'[REDACTED]');
      state.needsReview++;
    }
    records.push(record);
  });
  var p=PropertiesService.getScriptProperties();
  // Each batch is kept under an independent property to avoid per-value size limits.
  p.setProperty(PSD_HEALTH_PREFIX_+'BATCH_'+('000'+state.batches).slice(-3),
    JSON.stringify({kind:kind,records:records}));
  state.processed+=selected.length;
  state.batches++;
  state.offset+=selected.length;
  if(state.offset>=sources.length){
    if(kind==='google'){state.stage='markdown';state.offset=0;}
    else{state.stage='complete';state.offset=0;state.status='complete';}
  }
  manualDailyHealthSave_(state);
  if(state.status==='running')manualDailyHealthSchedule_();
  else manualDailyHealthRemoveOwnTrigger_();
  console.log('全來源健檢進度（唯讀題庫）：'+JSON.stringify(state));
  return state;
}
function statusManualDailyAutoHealth() {
  var state=manualDailyHealthState_(),p=PropertiesService.getScriptProperties();
  var issues=[];
  for(var i=0;i<state.batches;i++){
    var raw=p.getProperty(PSD_HEALTH_PREFIX_+'BATCH_'+('000'+i).slice(-3));
    if(!raw)continue;
    JSON.parse(raw).records.forEach(function(r){
      if(r.status==='needs-review')issues.push(r);
    });
  }
  var report={status:state.status,branch:state.branch,head:state.head,
    total:state.googleTotal+state.markdownTotal,processed:state.processed,
    parsed:state.parsed,needsReview:state.needsReview,
    newCandidateObservations:state.newCandidates,
    batches:state.batches,remaining:state.googleTotal+state.markdownTotal-state.processed,
    errors:issues.slice(0,30),
    note:'新題候選為逐來源觀測，可能重複，不代表可發布新題數；僅列前30筆待確認來源。'};
  console.log('完整來源健檢狀態：'+JSON.stringify(report));
  return report;
}
function stopManualDailyAutoHealth() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('健檢批次正在執行，請稍後再停止');
  try{
    var state=manualDailyHealthState_();
    if(state.status==='running'){state.status='stopped';state.reason='使用者手動停止';manualDailyHealthSave_(state);}
    manualDailyHealthRemoveOwnTrigger_();
    console.log('已停止專用健檢觸發器；既有健檢紀錄保留');
    return state;
  }finally{lock.releaseLock();}
}
