/** 新聞全文同步（獨立模組；不改動 syncDailyResources 或 questions.json）。
 * Script Properties:
 * GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN（可沿用既有值）
 * NEWS_SOURCE_FOLDER_ID（只放已確認可公開全文的文件）
 * NEWS_PUBLICATION_ENABLED=true（手動確認此資料夾全文將發布到公開 GitHub）
 * NEWS_INCLUDE_SUBFOLDERS=true|false（預設 false）
 * 不需部署為網頁應用程式。
 */
function previewReadingNews() { return readingNewsRun_(false); }
function syncReadingNews() {
  if (typeof psdSyncGeneratedBridge_ !== 'function')
    throw new Error('尚未安裝 OfflineBridge.gs；未更新新聞資料。');
  return readingNewsRun_(true);
}

function readingNewsRun_(write) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('已有同步執行中，請稍後重試。');
  try {
    var cfg = readingNewsConfig_(), previous = readingNewsReadGithub_(cfg);
    var collected = readingNewsCollect_(cfg, previous.data);
    var next = collected.data;
    if (!next.documents.length) throw new Error('公開資料夾沒有可發布文件，未更新 GitHub；請先加入 Markdown／Google 文件。');
    var bytes = Utilities.newBlob(JSON.stringify(next)).getBytes().length;
    if (bytes > 8000000) throw new Error('新聞來源總量超過8MB保護上限；未更新，請檢查資料量。');
    Logger.log('公開來源支援文件：' + collected.sourceCount + ' 份；可呈現文件：' + next.documents.length + ' 份；讀取失敗：' + collected.errors.length + ' 份。');
    if (!write) {
      Logger.log('僅預覽，未更新 GitHub。請在 Google Drive 核對公開用資料夾的每份全文。');
      return {mode:'preview', count:next.documents.length, failed:collected.errors.length};
    }
    var equal = previous.storageVersion === 2 && JSON.stringify(previous.data.documents) === JSON.stringify(next.documents) &&
      JSON.stringify(previous.data.sync && previous.data.sync.errors || []) === JSON.stringify(next.sync.errors) &&
      (previous.data.sync && previous.data.sync.status) === next.sync.status;
    if (equal) { psdSyncGeneratedBridge_('daily'); Logger.log('新聞內容相同；已核對離線資料。'); return {mode:'no_change',count:next.documents.length}; }
    if (String(PropertiesService.getScriptProperties().getProperty('NEWS_PUBLICATION_ENABLED')).toLowerCase() !== 'true')
      throw new Error('公開設定已變動，未寫入。');
    readingNewsWriteGithub_(cfg, previous.sha, next);
    var verified = readingNewsReadGithub_(cfg).data;
    if (JSON.stringify(verified) !== JSON.stringify(next)) throw new Error('寫入後核對不符；請查看 GitHub 最新提交，不要重複盲目執行。');
    Logger.log('新聞全文與離線資料已更新並讀回核對：' + verified.documents.length + ' 份。狀態：' + next.sync.status + '。等待網站發布後重新讀取網頁。');
    return {mode:'updated',count:verified.documents.length,status:next.sync.status};
  } finally { lock.releaseLock(); }
}

function readingNewsConfig_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  if (String(p.NEWS_PUBLICATION_ENABLED).toLowerCase() !== 'true')
    throw new Error('新聞全文將發布至公開 GitHub。請先核對公開用資料夾，再把 NEWS_PUBLICATION_ENABLED 設為 true。');
  if (p.GITHUB_REPO !== 'LeoKYChen/probation-study-desk') throw new Error('GITHUB_REPO 必須為 LeoKYChen/probation-study-desk；未連到其他儲存庫。');
  var branch = String(p.GITHUB_BRANCH || 'main').trim();
  if (!/^[a-zA-Z0-9._\/-]{1,120}$/.test(branch)) throw new Error('分支設定格式不符。');
  if (!p.GITHUB_TOKEN || !/^[\w-]{10,150}$/.test(String(p.NEWS_SOURCE_FOLDER_ID || '').trim())) throw new Error('缺少 GitHub Token 或 NEWS_SOURCE_FOLDER_ID；不要把資料夾完整網址填入 ID。');
  return {repo:p.GITHUB_REPO,branch:branch,token:p.GITHUB_TOKEN,folderId:p.NEWS_SOURCE_FOLDER_ID.trim(),recursive:String(p.NEWS_INCLUDE_SUBFOLDERS).toLowerCase()==='true',path:'daily-simulation/documents.json',site:'https://leokychen.github.io/probation-study-desk/daily-simulation/',started:Date.now()};
}

function readingNewsApi_(cfg, method, suffix, payload) {
  var options={method:method,headers:{Authorization:'Bearer '+cfg.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},muteHttpExceptions:true};
  if (payload) { options.contentType='application/json'; options.payload=JSON.stringify(payload); }
  var response=UrlFetchApp.fetch('https://api.github.com/repos/'+cfg.repo+'/'+suffix,options), code=response.getResponseCode();
  if (code < 200 || code >= 300) {
    var note=code===409?'檔案同時被更新，未強制覆寫；請重新預覽後再同步。':code===401?'Token 過期或無效。':code===403?'檢查 Contents 寫入權限、分支限制或 API 配額。':code===404?'請核對儲存庫、分支、權限，以及已上傳的 documents.json。':'請查看服務狀態並稍後重試。';
    throw new Error('GitHub HTTP '+code+'：'+note);
  }
  return JSON.parse(response.getContentText());
}

function readingNewsReadGithub_(cfg) {
  var meta=readingNewsApi_(cfg,'get','contents/'+cfg.path+'?ref='+encodeURIComponent(cfg.branch));
  if (!meta.sha || meta.type !== 'file') throw new Error('新聞資料路徑不是已存在的檔案。');
  var raw=meta;
  if (!raw.content || raw.encoding !== 'base64') raw=readingNewsApi_(cfg,'get','git/blobs/'+meta.sha);
  if (raw.encoding !== 'base64' || !raw.content) throw new Error('無法讀取現有新聞 JSON，未覆寫。');
  var data=JSON.parse(Utilities.newBlob(Utilities.base64Decode(raw.content.replace(/\s/g,''))).getDataAsString('UTF-8'));
  var storageVersion=data.schemaVersion;
  if(data.schemaVersion===2){
    var idx=data, collected=[]; if(!Array.isArray(idx.shards)||!idx.shards.length)throw new Error('分檔索引異常');
    idx.shards.forEach(function(part){
      if(!part||!/^news-shards\/[a-f0-9]{64}\.json$/.test(part.path))throw new Error('分檔路徑不符');
      var m=readingNewsApi_(cfg,'get','contents/daily-simulation/'+part.path+'?ref='+encodeURIComponent(cfg.branch));
      var rawPart=m.content&&m.encoding==='base64'?m:readingNewsApi_(cfg,'get','git/blobs/'+m.sha);
      var rawBytes=Utilities.base64Decode(rawPart.content.replace(/\s/g,''));
      var hex=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,rawBytes).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
      if(part.path!=='news-shards/'+hex+'.json')throw new Error('分檔校驗失敗');
      var shard=JSON.parse(Utilities.newBlob(rawBytes).getDataAsString('UTF-8'));
      if(shard.schemaVersion!==1||!Array.isArray(shard.documents)||shard.documents.length!==part.count)throw new Error('分檔資料不符');
      collected=collected.concat(shard.documents);
    });
    if(collected.length!==idx.count)throw new Error('分檔總數不符');data={schemaVersion:1,documents:collected,sync:idx.sync};
  }
  readingNewsValidate_(data);
  return {sha:meta.sha,data:data,storageVersion:storageVersion};
}

function readingNewsWriteGithub_(cfg, sha, data) {
  readingNewsValidate_(data);
  var ref=readingNewsApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch));
  var head=ref.object.sha, commit=readingNewsApi_(cfg,'get','git/commits/'+head);
  var meta=readingNewsApi_(cfg,'get','contents/'+cfg.path+'?ref='+encodeURIComponent(head));
  if(meta.sha!==sha)throw new Error('來源資料已變動，未覆寫，請重試');
  var shards=[],current=[];
  function body(a){return JSON.stringify({schemaVersion:1,documents:a});}
  function flush(){if(!current.length)return;var text=body(current),bytes=Utilities.newBlob(text).getBytes();
    var hex=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
    shards.push({path:'news-shards/'+hex+'.json',count:current.length,body:text});current=[];}
  data.documents.forEach(function(d){
    if(Utilities.newBlob(body([d])).getBytes().length>1000000)throw new Error('單篇超過分檔安全上限');
    if(Utilities.newBlob(body(current.concat([d]))).getBytes().length>1000000)flush();current.push(d);
  });flush();
  var manifest={schemaVersion:2,count:data.documents.length,sync:data.sync,shards:shards.map(function(x){return {path:x.path,count:x.count};})};
  var q=readingNewsApi_(cfg,'get','contents/daily-simulation/questions.json?ref='+encodeURIComponent(head));
  if(!q.content||q.encoding!=='base64')q=readingNewsApi_(cfg,'get','git/blobs/'+q.sha);
  var questions=JSON.parse(Utilities.newBlob(Utilities.base64Decode(q.content.replace(/\s/g,''))).getDataAsString('UTF-8'));
  if(!questions||!Array.isArray(questions.questions)||questions.questions.length<125)throw new Error('題庫資料不符');
  var daily={'daily-simulation/questions.json':questions,'daily-simulation/documents.json':manifest};
  var serialize=function(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');};
  var js='/* GENERATED from committed JSON; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialize(daily)+');})();\n';
  var tree=[{path:cfg.path,mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'}, {path:'file-data/daily.generated.js',mode:'100644',type:'blob',content:js}];
  shards.forEach(function(part){var key='daily-simulation/'+part.path,payload=JSON.parse(part.body),obj={};obj[key]=payload;
    var out='/* GENERATED news shard; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialize(obj)+');})();\n';
    tree.push({path:key,mode:'100644',type:'blob',content:part.body});tree.push({path:'file-data/'+part.path.replace(/\.json$/,'.js'),mode:'100644',type:'blob',content:out});
  });
  var newTree=readingNewsApi_(cfg,'post','git/trees',{base_tree:commit.tree.sha,tree:tree});
  var newCommit=readingNewsApi_(cfg,'post','git/commits',{message:'更新分檔新聞與離線資料',tree:newTree.sha,parents:[head]});
  readingNewsApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:newCommit.sha,force:false});
  return newCommit;
}

function readingNewsValidate_(data) {
  if (!data || data.schemaVersion!==1 || !Array.isArray(data.documents)) throw new Error('现有新聞 JSON 格式不符，未覆寫。');
  var ids={};
  data.documents.forEach(function(d){
    if (!d || typeof d.id!=='string' || !(/^news-[a-f0-9]{64}$/.test(d.id) || d.id === 'news-library-libfile_3680a31f09dc8191a9c975a328b06add') || ids[d.id] || typeof d.title!=='string' || typeof d.content!=='string' || !Array.isArray(d.tags) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || typeof d.modified!=='string' || typeof d.url!=='string' || d.url.indexOf('https://leokychen.github.io/probation-study-desk/daily-simulation/?document=')!==0)
      throw new Error('新聞文件格式或公開連結不符，未覆寫。');
    ids[d.id]=true;
  });
}

function readingNewsCollect_(cfg, old) {
  var sources=[], seen={}, folders=[DriveApp.getFolderById(cfg.folderId)], oldBy={};
  old.documents.forEach(function(d){oldBy[d.id]=d;});
  while(folders.length) {
    if (Date.now()-cfg.started>200000) throw new Error('來源清單超時，未寫入；請縮小公開來源範圍。');
    var folder=folders.pop();if(seen[folder.getId()])continue;seen[folder.getId()]=true;
    var files=folder.getFiles();
    while(files.hasNext()) {
      var f=files.next(),mime=f.getMimeType(),name=f.getName();
      if (mime==='application/vnd.google-apps.document' || mime==='text/plain' || mime==='text/markdown' || /\.(md|txt)$/i.test(name)) sources.push(f);
      if(sources.length>300) throw new Error('支援文件超過300份，未寫入；請縮小公開來源資料夾。');
    }
    if(cfg.recursive){var child=folder.getFolders();while(child.hasNext())folders.push(child.next());}
    if(Object.keys(seen).length>100)throw new Error('子資料夾超過100個，未寫入。');
  }
  var result={}, errors=[];
  sources.forEach(function(file){
    var id=readingNewsId_(file.getId());
    try {
      if(Date.now()-cfg.started>240000)throw new Error('本次讀取時間不足，保留舊版。');
      var title=file.getName(),modified=file.getLastUpdated().toISOString(),mime=file.getMimeType(),before=oldBy[id];
      if(before&&before.title===title&&before.modified===modified&&before.mime===mime){result[id]=before;return;}
      var content=mime==='application/vnd.google-apps.document'?readingNewsReadDoc_(file.getId()):file.getBlob().getDataAsString('UTF-8');
      if(!content.trim() || content.length>250000)throw new Error('文件空白或超過250000字元。');
      if (/(?:docs|drive)\.google\.com/i.test(content) || /github_pat_|\bsk-proj-|\bgh[pousr]_[A-Za-z0-9]{15,}/.test(content)) throw new Error('含 Google Drive／Docs 連結或疑似憑證，請先移除後再公開。');
      var tags=readingNewsTags_(title,content);
      result[id]={id:id,title:title,content:content,url:cfg.site+'?document='+id,mime:mime,modified:modified,date:readingNewsDate_(title,content,modified),tags:tags,excerpt:content.replace(/https?:\/\/\S+/g,'').replace(/[#*_>|`\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,160)};
    } catch(e) {
      if(oldBy[id])result[id]=oldBy[id];
      errors.push({id:id,message:String(e.message||e).slice(0,180)});
    }
  });
  // 移出／刪除的已發布文件仍保留，避免誤刪舊資料；需要下架時請手動移除 JSON 項目。
  old.documents.forEach(function(d){if(!result[d.id])result[d.id]=d;});
  if(sources.length&&errors.length===sources.length)throw new Error('全部來源讀取失敗，未更新 GitHub；請核對權限及文件內容。');
  var docs=Object.keys(result).map(function(k){return result[k];}).sort(function(a,b){return b.date.localeCompare(a.date)||b.modified.localeCompare(a.modified)||a.id.localeCompare(b.id);});
  return {data:{schemaVersion:1,documents:docs,sync:{syncedAt:new Date().toISOString(),status:errors.length?'partial':'success',sourceCount:sources.length,errors:errors}},sourceCount:sources.length,errors:errors};
}

function readingNewsId_(id) { return 'news-'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,id,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function readingNewsDate_(title,content,modified) {
  var m=(title+' '+content.slice(0,180)).match(/(20\d{2})\s*[-_年]?\s*(\d{1,2})\s*[-_月]?\s*(\d{1,2})/);
  if(m){var s=m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2),d=new Date(s+'T00:00:00Z');if(!isNaN(d.getTime())&&d.toISOString().slice(0,10)===s)return s;}
  return Utilities.formatDate(new Date(modified),'Asia/Taipei','yyyy-MM-dd');
}
function readingNewsTags_(title,content) {
  var tags=[];
  if(/摘要|新聞|brief|digest/i.test(title))tags.push('晚間摘要');
  if(/考試|考題|申論|觀護人|複盤/.test(title+' '+content))tags.push('考試專區');
  ['少年事件處理法','保安處分執行法','刑事訴訟法','刑法','犯罪學','心理學','社會工作','諮商與輔導'].forEach(function(s){if(title.indexOf(s)>=0||content.split(s).length>2)tags.push(s);});
  if(/少年司法|CRC|北京規則|修復式司法/i.test(content))tags.push('少年司法與 CRC');
  if(/AI|人工智慧|程式開發/.test(content))tags.push('AI 與科技');return tags;
}

function readingNewsReadDoc_(id) {
  var doc=DocumentApp.openById(id),chunks=[];
  function bodyText(body){var lines=[];for(var i=0;i<body.getNumChildren();i++){var e=body.getChild(i),type=e.getType();if(type===DocumentApp.ElementType.TABLE){var t=e.asTable();for(var r=0;r<t.getNumRows();r++){var row=t.getRow(r),cells=[];for(var c=0;c<row.getNumCells();c++)cells.push(row.getCell(c).getText().replace(/\r?\n/g,' ').replace(/\|/g,'\\|'));lines.push('| '+cells.join(' | ')+' |');if(r===0)lines.push('| '+cells.map(function(){return '---';}).join(' | ')+' |');}lines.push('');}else if(type===DocumentApp.ElementType.PARAGRAPH||type===DocumentApp.ElementType.LIST_ITEM){var p=type===DocumentApp.ElementType.PARAGRAPH?e.asParagraph():e.asListItem(),text=readingNewsRichText_(p.editAsText());if(!text.trim()){lines.push('');continue;}var h=String(p.getHeading()).match(/^HEADING([1-6])$/),prefix=h?new Array(Number(h[1])+1).join('#')+' ':type===DocumentApp.ElementType.LIST_ITEM?'- ':'';lines.push(prefix+text);lines.push('');}}return lines.join('\n');}
  if(typeof doc.getTabs==='function'){var tabs=[];function walk(list){list.forEach(function(tab){tabs.push(tab);var children=tab.getChildTabs();if(children&&children.length)walk(children);});}walk(doc.getTabs());tabs.forEach(function(tab){var body=tab.asDocumentTab().getBody();if(tabs.length>1)chunks.push('# '+tab.getTitle()+'\n');chunks.push(bodyText(body));});}
  else chunks.push(bodyText(doc.getBody()));
  return chunks.join('\n\n');
}
function readingNewsRichText_(text) {
  var raw=text.getText(),starts=text.getTextAttributeIndices(),parts=[];
  for(var i=0;i<starts.length;i++){var start=starts[i],end=i+1<starts.length?starts[i+1]:raw.length,s=raw.slice(start,end),a=text.getAttributes(start),link=a[DocumentApp.Attribute.LINK_URL];if(link&&/^https?:\/\//i.test(String(link)))s='['+s.replace(/\]/g,'\\]')+']('+link+')';else if(a[DocumentApp.Attribute.BOLD]&&s.trim())s='**'+s+'**';parts.push(s);}return parts.join('');
}


function repairLegacyNewsLinkOnce() {
  var lock=LockService.getScriptLock(); if(!lock.tryLock(1000)) throw new Error('同步執行中');
  try {
    var cfg=readingNewsConfig_(), previous=readingNewsReadGithub_(cfg), meta={sha:previous.sha}, data=previous.data;
    var id='news-library-libfile_3680a31f09dc8191a9c975a328b06add';
    var matches=data.documents.filter(function(d){return d.id===id;});
    if(matches.length!==1) throw new Error('歷史項目不存在或重複，停止修復');
    var target=cfg.site+'?document='+id;
    if(matches[0].url!==target){matches[0].url=target;readingNewsWriteGithub_(cfg,meta.sha,data);}
    var verified=readingNewsReadGithub_(cfg); if(verified.data.documents.filter(function(d){return d.id===id&&d.url===target;}).length!==1) throw new Error('回讀驗證失敗');
    Logger.log('舊項目公開網址已修復並驗證');
  } finally {lock.releaseLock();}
}
