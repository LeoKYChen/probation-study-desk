/**
 * Daily question hand-operated delta sync (depends on DailyResourcesSelective.gs
 * and OfflineBridge.gs in the SAME Apps Script project).
 *
 * Nothing runs automatically. The first pass has no trusted per-source
 * history and must inspect old sources ONCE to establish a checkpoint.
 * Existing published questions, IDs and human corrections are never deleted.
 * A successful commit atomically stores the questions, nonpublic source-state,
 * and the matching offline JS entrypoint. Failed submissions keep the cursor.
 */
var PSD_DAILY_SOURCE_STATE_PATH_='scripts/sync-state/daily-question-sources.json';
var PSD_DAILY_CURSOR_KEY_='PSD_MANUAL_QUESTIONS_CURSOR';

function manualQuestionHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function manualQuestionCfg_() {
  var props=PropertiesService.getScriptProperties();
  var cfg=psdBridgeConfig_('daily');
  var google=(props.getProperty('SOURCE_FOLDER_ID')||'').trim();
  var markdown=(props.getProperty('MD_SOURCE_FOLDER_ID')||'').trim();
  if(!google||!markdown)throw new Error('必須設定 SOURCE_FOLDER_ID 和 MD_SOURCE_FOLDER_ID；未開始同步');
  return {repo:cfg.repo,branch:cfg.branch,token:cfg.token,google:google,markdown:markdown};
}
function manualQuestionRead_(cfg,path,ref,optional) {
  var pinned={repo:cfg.repo,branch:ref,token:cfg.token};
  var meta;
  try{meta=psdBridgeMeta_(pinned,path);}
  catch(e){if(optional&&e.httpStatus===404)return null;throw e;}
  var raw=Utilities.newBlob(psdBridgeBytes_(pinned,meta)).getDataAsString('UTF-8');
  return {sha:meta.sha,data:JSON.parse(raw),raw:raw};
}
function manualQuestionSourceKey_(kind,id) {
  return kind==='google'?mdGoogleId_(id,0).replace(/-0$/,''):mdOrigin_(id);
}
function manualQuestionStartCursor_(cfg) {
  var p=PropertiesService.getScriptProperties(),cursor=null;
  try{cursor=JSON.parse(p.getProperty(PSD_DAILY_CURSOR_KEY_)||'null');}
  catch(e){cursor=null;}
  if(!cursor||cursor.google!==cfg.google||cursor.markdown!==cfg.markdown||
    ['google','markdown'].indexOf(cursor.stage)<0)
    cursor={google:cfg.google,markdown:cfg.markdown,stage:'google',token:null};
  return cursor;
}
function manualQuestionSaveCursor_(cursor) {
  var p=PropertiesService.getScriptProperties();
  if(cursor)p.setProperty(PSD_DAILY_CURSOR_KEY_,JSON.stringify(cursor));
  else p.deleteProperty(PSD_DAILY_CURSOR_KEY_);
}
function resetManualQuestionScan() {
  manualQuestionSaveCursor_(null);
  console.log('已重設題庫掃描游標；GitHub 已記錄成功版本的來源仍會依修改時間略過。');
}
/**
 * Only Drive file metadata is inspected here. Do not read a file body.
 * A continuation token is saved ONLY after the corresponding state has
 * been committed successfully (or when the batch contains no changes).
 */
function manualQuestionScan_(cfg,known,maxChanges,maxMs) {
  var cursor=manualQuestionStartCursor_(cfg),chosen=[],skipped=0,checked=0,started=Date.now();
  while(cursor&&Date.now()-started<maxMs) {
    var folderId=cursor.stage==='google'?cfg.google:cfg.markdown;
    var files=cursor.token?DriveApp.continueFileIterator(cursor.token):
      cursor.stage==='google'?DriveApp.getFolderById(folderId).getFilesByType(MimeType.GOOGLE_DOCS):
      DriveApp.getFolderById(folderId).getFiles();
    var paused=false;
    while(files.hasNext()){
      if(chosen.length>=maxChanges||Date.now()-started>=maxMs){
        cursor.token=files.getContinuationToken();paused=true;break;
      }
      var f=files.next(),kind=cursor.stage;
      if(kind==='markdown'&&!/\.md$/i.test(f.getName()))continue;
      checked++;
      var key=manualQuestionSourceKey_(kind,f.getId());
      var current={kind:kind,modified:f.getLastUpdated().toISOString(),
        nameSha256:manualQuestionHash_(f.getName())};
      var prior=known[key];
      if(prior&&prior.kind===current.kind&&prior.modified===current.modified&&
        prior.nameSha256===current.nameSha256){skipped++;continue;}
      // Raw Drive IDs are kept in process memory only, never sent to GitHub.
      chosen.push({id:f.getId(),key:key,metadata:current});
    }
    if(paused)break;
    if(cursor.stage==='google'){cursor={google:cfg.google,markdown:cfg.markdown,stage:'markdown',token:null};}
    else cursor=null;
  }
  return {selected:chosen,cursor:cursor,checked:checked,skipped:skipped};
}
function manualQuestionValidate_(oldData,newData) {
  if(!oldData||!newData||!Array.isArray(oldData.questions)||!Array.isArray(newData.questions)||
    oldData.questions.length<125||newData.questions.length<oldData.questions.length||
    newData.count!==newData.questions.length)throw new Error('題庫筆數不完整，拒絕更新');
  var oldIds={},ids={};
  oldData.questions.forEach(function(q){
    if(!q||!q.id||oldIds[q.id])throw new Error('原有題號不完整或重複');
    oldIds[q.id]=q;
  });
  newData.questions.forEach(function(q){
    if(!q||!q.id||ids[q.id])throw new Error('新增題號不完整或重複');
    ids[q.id]=true;
  });
  oldData.questions.forEach(function(q){
    var fresh=newData.questions.find(function(d){return d.id===q.id;});
    if(!fresh||q.question!==fresh.question||q.date!==fresh.date||q.subject!==fresh.subject)
      throw new Error('已發佈的題號、題幹、日期或科目遭更動：'+q.id);
    if(q.qualityStatus==='待訂正'&&JSON.stringify(q)!==JSON.stringify(fresh))
      throw new Error('人工訂正題目不得被來源覆寫：'+q.id);
  });
}
function manualQuestionOffline_(questions,documents) {
  var data={'daily-simulation/questions.json':questions,'daily-simulation/documents.json':documents};
  var escaped=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  var code='/* GENERATED from committed JSON; do not hand-edit. */\n'+
    '(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+escaped+');})();\n';
  if(Utilities.newBlob(code).getBytes().length>10000000)throw new Error('離線題庫入口超過10MB，請先分檔');
  return code;
}
function manualQuestionCommit_(cfg,before,after,state) {
  manualQuestionValidate_(before.data,after);
  var pinned={repo:cfg.repo,branch:before.head,token:cfg.token};
  var changes=[],sameQuestions=
    JSON.stringify(after.questions)===JSON.stringify(before.data.questions)&&
    JSON.stringify(after.templates||[])===JSON.stringify(before.data.templates||[]);
  // If unchanged, only the private source-state gets a new checkpoint.
  if(sameQuestions)after=before.data;
  else {
    var contents=JSON.stringify(after,null,2)+'\n';
    changes.push({path:'daily-simulation/questions.json',mode:'100644',type:'blob',content:contents});
    var news=manualQuestionRead_(cfg,'daily-simulation/documents.json',before.head,false);
    changes.push({path:'file-data/daily.generated.js',mode:'100644',type:'blob',
      content:manualQuestionOffline_(after,news.data)});
  }
  var src=JSON.stringify(state,null,2)+'\n';
  changes.push({path:PSD_DAILY_SOURCE_STATE_PATH_,mode:'100644',type:'blob',content:src});
  var current=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
  if(current!==before.head)throw new Error('題庫掃描期間 GitHub 分支已變動，拒絕覆寫');
  // Validate the question file SHA even if the branch changed then was restored.
  var meta=psdBridgeMeta_(pinned,'daily-simulation/questions.json');
  if(meta.sha!==before.questionSha)throw new Error('題庫來源 SHA 已改變，拒絕覆寫');
  var base=psdBridgeApi_(cfg,'get','git/commits/'+before.head);
  var tree=psdBridgeApi_(cfg,'post','git/trees',{base_tree:base.tree.sha,tree:changes});
  var commit=psdBridgeApi_(cfg,'post','git/commits',
    {message:'chore(daily): checkpoint manual incremental sources',tree:tree.sha,parents:[before.head]});
  psdBridgeApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:commit.sha,force:false});
  if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==commit.sha)
    throw new Error('GitHub 提交結果待確認；請檢查最新 commit，勿盲目重做');
  return {sha:commit.sha,questionsChanged:!sameQuestions,filesChanged:changes.length};
}
/** Hand-executed only. Never install a timer for this function. */
function manualSyncDailyQuestions() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('題庫或新聞同步正在執行，請稍後手動重試');
  try{
    var cfg=manualQuestionCfg_();
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,true);
    var questions=monthly?{sha:monthly.sha,data:{questions:monthly.data.catalog}}:
      manualQuestionRead_(cfg,'daily-simulation/questions.json',head,false);
    var source=manualQuestionRead_(cfg,PSD_DAILY_SOURCE_STATE_PATH_,head,true);
    var state=source?source.data:{schemaVersion:1,sources:{}};
    if(!state||state.schemaVersion!==1||!state.sources||typeof state.sources!=='object'||
       Array.isArray(state.sources))throw new Error('來源進度紀錄不正確，拒絕繼續');
    var batch=manualQuestionScan_(cfg,state.sources,3,90000);
    if(!batch.selected.length){
      manualQuestionSaveCursor_(batch.cursor);
      var noop={mode:'unchanged',checked:batch.checked,skipped:batch.skipped,hasMore:!!batch.cursor};
      console.log('題庫沒有需要重新處理的來源：'+JSON.stringify(noop));
      return noop;
    }
    var selectedGoogle=new Set(),selectedMarkdown=new Set();
    batch.selected.forEach(function(s){
      if(s.metadata.kind==='google')selectedGoogle.add(s.id);
      else selectedMarkdown.add(s.id);
    });
    var original=monthly?manualQuestionReadMonthly_(cfg,monthly.data,head):questions.data;
    // Uses the original user-supplied parser, identity and human-correction rules.
    var parsed=mdCollect_({googleIds:selectedGoogle,mdIds:selectedMarkdown,strict:true,
      previousDataset:monthly?original:null});
    if(!parsed||!parsed.data||!Array.isArray(parsed.data.questions))
      throw new Error('題庫解析器沒有回傳可驗證的題目');
    var next=parsed.data;
    manualQuestionValidate_(original,next);
    var nextState={schemaVersion:1,sources:Object.assign({},state.sources),
      updatedAt:new Date().toISOString()};
    batch.selected.forEach(function(s){nextState.sources[s.key]=s.metadata;});
    var saved=monthly?
      manualQuestionCommitMonthly_(cfg,{head:head,indexSha:monthly.sha,index:monthly.data,data:original},next,nextState):
      manualQuestionCommit_(cfg,{head:head,questionSha:questions.sha,data:original},next,nextState);
    manualQuestionSaveCursor_(batch.cursor);
    var result={mode:'committed',processed:batch.selected.length,skipped:batch.skipped,
      hasMore:!!batch.cursor,questionsChanged:saved.questionsChanged,filesChanged:saved.filesChanged,
      commit:saved.sha};
    console.log('已提交 GitHub（網站發布狀態尚待核對）：'+JSON.stringify(result));
    return result;
  }finally{lock.releaseLock();}
}

/** Read-only preview: parses at most 3 changed sources, does NOT commit or advance cursor. */
function previewManualDailyQuestions() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('有同步執行中；本次預覽未執行');
  try{
    var cfg=manualQuestionCfg_();
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    var monthly=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,true);
    var questions=monthly?{sha:monthly.sha,data:{questions:monthly.data.catalog}}:
      manualQuestionRead_(cfg,'daily-simulation/questions.json',head,false);
    var progress=manualQuestionRead_(cfg,PSD_DAILY_SOURCE_STATE_PATH_,head,true);
    var state=progress?progress.data:{schemaVersion:1,sources:{}};
    if(state.schemaVersion!==1||!state.sources||Array.isArray(state.sources))
      throw new Error('來源進度資料格式不符');
    var batch=manualQuestionScan_(cfg,state.sources,3,90000);
    var result={mode:'preview',toProcess:batch.selected.length,skipped:batch.skipped,
      hasMore:!!batch.cursor,oldQuestions:questions.data.questions.length,
      sourceKeys:batch.selected.map(function(s){return s.key;})};
    if(batch.selected.length){
      var gd=new Set(),md=new Set();
      batch.selected.forEach(function(s){if(s.metadata.kind==='google')gd.add(s.id);else md.add(s.id);});
      var original=monthly?manualQuestionReadMonthly_(cfg,monthly.data,head):questions.data;
      var next=mdCollect_({googleIds:gd,mdIds:md,strict:true,previousDataset:monthly?original:null}).data;
      manualQuestionValidate_(original,next);
      var ids={};original.questions.forEach(function(q){ids[q.id]=true;});
      var added=next.questions.filter(function(q){return !ids[q.id];});
      result.newQuestions=added.map(function(q){return {id:q.id,date:q.date,subject:q.subject};});
      result.proposedCount=next.count;
    }else{
      result.newQuestions=[];result.proposedCount=questions.data.questions.length;
    }
    console.log('手動題庫預覽（不寫入、不更新游標）：'+JSON.stringify(result));
    return result;
  }finally{lock.releaseLock();}
}
