/**
 * 手動增量新聞同步 v1（需與 ReadingNewsSync.gs 放在同一 Apps Script 專案）。
 *
 * 僅手動執行 manualSyncReadingNews；每次最多處理 3 份有變更的來源。
 * 不安裝觸發器、不自動發布、不複製已發布且未變更的新聞分檔。
 * GitHub 內容提交與 Cloudflare/網站部署為不同步驟。
 */
function manualSyncReadingNews() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('已有同步進行中，請稍後再手動執行。');
  try {
    var cfg=readingNewsConfig_(),old=readingNewsReadGithub_(cfg);
    var batch=manualNewsScan_(cfg,old.data,3,125000);
    if(!batch.changed.length) {
      manualNewsSaveCursor_(batch.cursor);
      var noop={mode:'unchanged',changed:0,skipped:batch.skipped,failed:batch.errors.length,hasMore:!!batch.cursor};
      Logger.log('沒有需要重新上傳的文件；'+JSON.stringify(noop));
      return noop;
    }
    var byId={};
    old.data.documents.forEach(function(d){byId[d.id]=d;});
    batch.changed.forEach(function(d){byId[d.id]=d;});
    var docs=Object.keys(byId).map(function(k){return byId[k];}).sort(function(a,b){
      return b.date.localeCompare(a.date)||b.modified.localeCompare(a.modified)||a.id.localeCompare(b.id);
    });
    var next={schemaVersion:1,documents:docs,sync:{
      syncedAt:new Date().toISOString(),status:batch.errors.length?'partial':'success',
      sourceCount:batch.checked,errors:batch.errors
    }};
    readingNewsValidate_(next);
    // 驗證並原子提交索引 + 有異動的分檔 + 離線 JS；未變更的分檔只保留路徑。
    var saved=manualNewsCommit_(cfg,old,next);
    var head=readingNewsApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch));
    if(head.object.sha!==saved.sha)throw new Error('已提交，但 GitHub 分支回讀不符；請先核對提交，勿盲目重試。');
    manualNewsSaveCursor_(batch.cursor);
    var result={mode:'committed',changed:batch.changed.length,skipped:batch.skipped,
      failed:batch.errors.length,hasMore:!!batch.cursor,newShards:saved.newShards,
      reusedShards:saved.reusedShards,commit:saved.sha};
    PropertiesService.getScriptProperties().setProperty('PSD_MANUAL_NEWS_LAST_RESULT',JSON.stringify(result));
    Logger.log('已提交 GitHub；網站是否發布須另外核對。'+JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}

// 只清除掃描位置，不修改已成功提交的新聞或任何作答紀錄。
function resetManualNewsScan() {
  PropertiesService.getScriptProperties().deleteProperty('PSD_MANUAL_NEWS_CURSOR');
  Logger.log('已重置掃描位置；下次仍會略過 GitHub 中未變動的文件。');
}
function manualNewsSaveCursor_(cursor) {
  var p=PropertiesService.getScriptProperties();
  if(cursor)p.setProperty('PSD_MANUAL_NEWS_CURSOR',JSON.stringify(cursor));
  else p.deleteProperty('PSD_MANUAL_NEWS_CURSOR');
}
function manualNewsScan_(cfg,old,maxChanges,maxMs) {
  var p=PropertiesService.getScriptProperties(),cursor;
  try{cursor=JSON.parse(p.getProperty('PSD_MANUAL_NEWS_CURSOR')||'null');}catch(e){cursor=null;}
  if(!cursor||cursor.root!==cfg.folderId||cursor.recursive!==cfg.recursive||
    !Array.isArray(cursor.pending)||!Array.isArray(cursor.seen))
    cursor={root:cfg.folderId,recursive:cfg.recursive,pending:[cfg.folderId],seen:[],current:null,token:null};
  var oldBy={},changed=[],errors=[],skipped=0,checked=0;
  old.documents.forEach(function(d){oldBy[d.id]=d;});
  while(cursor.current||cursor.pending.length) {
    if(Date.now()-cfg.started>maxMs)break;
    if(!cursor.current) {
      cursor.current=cursor.pending.pop();cursor.token=null;
      if(cursor.seen.indexOf(cursor.current)>=0){cursor.current=null;continue;}
    }
    var folder=DriveApp.getFolderById(cursor.current);
    var files=cursor.token?DriveApp.continueFileIterator(cursor.token):folder.getFiles();
    var paused=false;
    while(files.hasNext()) {
      if(changed.length>=maxChanges||Date.now()-cfg.started>maxMs){
        cursor.token=files.getContinuationToken();paused=true;break;
      }
      var f=files.next(),mime=f.getMimeType(),name=f.getName();
      if(mime!=='application/vnd.google-apps.document'&&mime!=='text/plain'&&mime!=='text/markdown'&&!/\.(md|txt)$/i.test(name))continue;
      checked++;
      var id=readingNewsId_(f.getId()),before=oldBy[id],modified=f.getLastUpdated().toISOString();
      if(before&&before.title===name&&before.modified===modified&&before.mime===mime){skipped++;continue;}
      try {
        var content=mime==='application/vnd.google-apps.document'?readingNewsReadDoc_(f.getId()):f.getBlob().getDataAsString('UTF-8');
        if(!content.trim()||content.length>250000)throw new Error('文件空白或超過 250000 字元。');
        if(/(?:docs|drive)\.google\.com/i.test(content)||/github_pat_|\bsk-proj-|\bgh[pousr]_[A-Za-z0-9]{15,}/.test(content))
          throw new Error('包含 Google Drive 連結或疑似憑證，尚未發布。');
        changed.push({id:id,title:name,content:content,url:cfg.site+'?document='+id,mime:mime,
          modified:modified,date:readingNewsDate_(name,content,modified),tags:readingNewsTags_(name,content),
          excerpt:content.replace(/https?:\/\/\S+/g,'').replace(/[#*_>|`\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,160)});
      }catch(e){
        errors.push({id:id,message:String(e.message||e).slice(0,180)});
      }
    }
    if(paused)break;
    cursor.token=null;
    if(cursor.seen.indexOf(cursor.current)<0)cursor.seen.push(cursor.current);
    if(cfg.recursive) {
      var children=folder.getFolders();
      while(children.hasNext()){
        var child=children.next().getId();
        if(cursor.seen.indexOf(child)<0&&cursor.pending.indexOf(child)<0)cursor.pending.push(child);
      }
      if(cursor.pending.length+cursor.seen.length>100)throw new Error('子資料夾超過 100 個，停止同步。');
    }
    cursor.current=null;
  }
  return {changed:changed,errors:errors,checked:checked,skipped:skipped,
    cursor:(cursor.current||cursor.pending.length)?cursor:null};
}

// 以內容雜湊為檔名：未變更的舊分檔只沿用索引，不重新提交。
function manualNewsCommit_(cfg,previous,next) {
  var oldMap={},nextMap={},used={},reused=0,writes=[],shards=[];
  previous.data.documents.forEach(function(d){oldMap[d.id]=d;});
  next.documents.forEach(function(d){nextMap[d.id]=d;});
  var byteLength=function(s){return Utilities.newBlob(s).getBytes().length;};
  var serialize=function(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');};
  function emit(items,month) {
    if(!items.length)return;
    var chunk=[];
    function flush() {
      if(!chunk.length)return;
      var body=JSON.stringify({schemaVersion:1,documents:chunk});
      var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Utilities.newBlob(body).getBytes())
        .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
      var path='news-shards/'+hash+'.json',item={path:path,count:chunk.length};
      if(month)item.month=month;
      shards.push(item);
      var key='daily-simulation/'+path,obj={};obj[key]=JSON.parse(body);
      writes.push({path:key,mode:'100644',type:'blob',content:body});
      writes.push({path:'file-data/'+path.replace(/\.json$/,'.js'),mode:'100644',type:'blob',
        content:'/* GENERATED news shard; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialize(obj)+');})();\n'});
      chunk=[];
    }
    items.forEach(function(d){
      if(byteLength(JSON.stringify({schemaVersion:1,documents:[d]}))>1000000)throw new Error('單篇新聞超過 1 MB 分檔上限');
      if(chunk.length&&byteLength(JSON.stringify({schemaVersion:1,documents:chunk.concat([d])}))>1000000)flush();
      chunk.push(d);
    });flush();
  }
  (previous.shardGroups||[]).forEach(function(part){
    var docs=part.documents.map(function(old){
      used[old.id]=true;return nextMap[old.id]||old;
    });
    var same=docs.length===part.documents.length&&docs.every(function(d,i){return JSON.stringify(d)===JSON.stringify(part.documents[i]);});
    if(same){
      var entry={path:part.path,count:part.documents.length};
      if(part.month)entry.month=part.month;
      shards.push(entry);reused++;
    }else emit(docs,part.month);
  });
  var byMonth={},months=[];
  next.documents.forEach(function(d){
    if(used[d.id])return;
    var month=/^\d{4}-\d{2}-\d{2}$/.test(d.date)?d.date.slice(0,7):'unknown';
    if(!byMonth[month]){byMonth[month]=[];months.push(month);}
    byMonth[month].push(d);
  });
  months.sort().forEach(function(month){emit(byMonth[month],month==='unknown'?null:month);});
  if(shards.reduce(function(n,s){return n+s.count;},0)!==next.documents.length)throw new Error('新舊分檔數量不一致，停止提交。');
  var manifest={schemaVersion:2,count:next.documents.length,sync:next.sync,shards:shards};
  var headRef=readingNewsApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch));
  var head=headRef.object.sha,meta=readingNewsApi_(cfg,'get','contents/'+cfg.path+'?ref='+encodeURIComponent(head));
  if(meta.sha!==previous.sha)throw new Error('GitHub 新聞已被其他工作更新，停止提交。');
  var questionMeta=readingNewsApi_(cfg,'get','contents/daily-simulation/questions.json?ref='+encodeURIComponent(head));
  if(!questionMeta.content||questionMeta.encoding!=='base64')
    questionMeta=readingNewsApi_(cfg,'get','git/blobs/'+questionMeta.sha);
  var questions=JSON.parse(Utilities.newBlob(Utilities.base64Decode(questionMeta.content.replace(/\s/g,''))).getDataAsString('UTF-8'));
  if(!questions||!Array.isArray(questions.questions)||questions.questions.length<125)throw new Error('題庫安全檢查未通過。');
  var all={'daily-simulation/questions.json':questions,'daily-simulation/documents.json':manifest};
  writes.push({path:cfg.path,mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'});
  writes.push({path:'file-data/daily.generated.js',mode:'100644',type:'blob',
    content:'/* GENERATED from committed JSON; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialize(all)+');})();\n'});
  var commit=readingNewsApi_(cfg,'get','git/commits/'+head);
  var tree=readingNewsApi_(cfg,'post','git/trees',{base_tree:commit.tree.sha,tree:writes});
  var output=readingNewsApi_(cfg,'post','git/commits',{message:'chore(news): manual incremental update',tree:tree.sha,parents:[head]});
  readingNewsApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:output.sha,force:false});
  return {sha:output.sha,newShards:(writes.length-2)/2,reusedShards:reused};
}

// 僅停用這兩個已知的每日資料同步觸發器。人工呼叫，不在安裝時自動執行。
function disableAutomaticDailySyncTriggers() {
  var names={syncDailyResources:true,syncReadingNews:true},removed=0;
  ScriptApp.getProjectTriggers().forEach(function(trigger){
    if(names[trigger.getHandlerFunction()]){ScriptApp.deleteTrigger(trigger);removed++;}
  });
  Logger.log('已停用 '+removed+' 個每日資料同步觸發器；其他排程未變更。');
  return {removed:removed};
}
