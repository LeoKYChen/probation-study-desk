/**
 * GitHub 離線 ZIP 資料橋接同步 v1.1（僅同步已存在的 JSON 到 JS 產生檔）。
 * 需與 MarkdownTest／JuvenileWeeklySync／ReadingNewsSync 放在同一 Apps Script 專案。
 * 不重建題目、不刪除作答、絕不讀取本機瀏覽器資料。
 * Script Properties: daily 使用 GITHUB_*；weekly 使用 JW_GITHUB_*。
 */
function psdBridgeConfig_(kind) {
  var p=PropertiesService.getScriptProperties();
  var prefix=kind==='weekly'?'JW_GITHUB_':'GITHUB_';
  var repo=(p.getProperty(prefix+'REPO')||'').trim();
  var branch=(p.getProperty(prefix+'BRANCH')||'main').trim();
  var token=(p.getProperty(prefix+'TOKEN')||'').trim();
  if(repo!=='LeoKYChen/probation-study-desk'||branch!=='main'||!token)
    throw new Error('離線資料橋接：請確認 '+prefix+'REPO / BRANCH / TOKEN，分支必須是 main。');
  return {repo:repo,branch:branch,token:token};
}
function psdBridgeApi_(cfg,method,suffix,payload) {
  var u='https://api.github.com/repos/'+cfg.repo+'/'+suffix;
  var options={method:method,headers:{Authorization:'Bearer '+cfg.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},muteHttpExceptions:true,followRedirects:false};
  if(payload){options.contentType='application/json';options.payload=JSON.stringify(payload);}
  var res=UrlFetchApp.fetch(u,options),status=res.getResponseCode();
  if(status<200||status>=300){
    var why=status===401?'Token 無效':status===403?'缺少權限或分支保護':status===404?'找不到 GitHub 路徑':status===409||status===422?'分支或 SHA 衝突':'請查看 GitHub 執行紀錄';
    var error=new Error('離線資料橋接：GitHub HTTP '+status+'（'+why+'）。');
    error.httpStatus=status;throw error;
  }
  return JSON.parse(res.getContentText());
}
function psdBridgeMeta_(cfg,path) {
  var suffix='contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(cfg.branch);
  var r=psdBridgeApi_(cfg,'get',suffix);
  if(r.type!=='file'||!r.sha) throw new Error('離線資料橋接：來源不是 GitHub 檔案：'+path);
  return r;
}
function psdBridgeBytes_(cfg,meta) {
  // GitHub Contents API 大於 1 MB 時可能不提供內嵌 content，此時依 blob SHA 讀取。
  var body=meta;
  if(!body.content||body.encoding!=='base64') body=psdBridgeApi_(cfg,'get','git/blobs/'+encodeURIComponent(meta.sha));
  if(!body.content||body.encoding!=='base64') throw new Error('離線資料橋接：無法取得 base64 內容');
  return Utilities.base64Decode(body.content.replace(/\s/g,''));
}
function psdBridgeReadJson_(cfg,path) {
  var meta=psdBridgeMeta_(cfg,path);
  var text=Utilities.newBlob(psdBridgeBytes_(cfg,meta)).getDataAsString('UTF-8');
  return JSON.parse(text);
}
function psdBridgeSha1_(bytes) {
  // Git blob object id = SHA1("blob <byteLength>\\0" + 原始檔案 bytes)。
  var prefix=Utilities.newBlob('blob '+bytes.length+'\x00').getBytes();
  var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,prefix.concat(bytes));
  return digest.map(function(x){return ('0'+(x&255).toString(16)).slice(-2);}).join('');
}
function psdSyncGeneratedBridge_(kind) {
  if(kind!=='weekly'&&kind!=='daily') throw new Error('離線資料橋接：kind 只能是 weekly/daily');
  var cfg=psdBridgeConfig_(kind);
  var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
  var pinned={repo:cfg.repo,branch:head,token:cfg.token};
  var inputPaths=kind==='weekly'?['juvenile-news/issues.json']:
    ['daily-simulation/questions.json','daily-simulation/documents.json'];
  var target='file-data/'+kind+'.generated.js';
  var data={};
  inputPaths.forEach(function(path){data[path]=psdBridgeReadJson_(pinned,path);});
  if(kind==='weekly') {
    if(!data['juvenile-news/issues.json']||!Array.isArray(data['juvenile-news/issues.json'].issues)) throw new Error('週報格式錯誤');
  } else {
    var q=data['daily-simulation/questions.json'];
    if(!q||!Array.isArray(q.questions)||q.questions.length<125) throw new Error('題庫數量異常，停止更新離線橋接');
    var ids={};
    q.questions.forEach(function(x){if(!x.id||ids[x.id]) throw new Error('題目 ID 重複');ids[x.id]=1;});
  }
  // 與 repo scripts/generate-file-data.cjs 的產生格式逐位元相同。
  var serialized=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  var code='/* GENERATED from committed JSON; do not hand-edit. */\n'+
    '(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialized+');})();\n';
  var bytes=Utilities.newBlob(code,'application/javascript').getBytes();
  if(bytes.length>10000000) throw new Error('離線資料產生檔超過 10MB，請調整檔案結構。');
  var outputs=[{path:target,content:code}], news=data['daily-simulation/documents.json'];
  if(kind==='daily'&&news&&news.schemaVersion===2) {
    if(!Array.isArray(news.shards)||!news.shards.length||!Number.isInteger(news.count)||news.count<1)throw new Error('新聞分檔索引異常');
    var paths={},ids={},count=0;
    news.shards.forEach(function(part){
      if(!part||!/^news-shards\/[a-f0-9]{64}\.json$/.test(part.path)||paths[part.path]||!Number.isInteger(part.count)||part.count<1)throw new Error('新聞分檔路徑或數量異常');
      paths[part.path]=true;
      var key='daily-simulation/'+part.path,meta=psdBridgeMeta_(pinned,key),raw=psdBridgeBytes_(pinned,meta);
      var hex=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
      if(part.path!=='news-shards/'+hex+'.json')throw new Error('新聞分檔雜湊不符');
      var payload=JSON.parse(Utilities.newBlob(raw).getDataAsString('UTF-8'));
      if(payload.schemaVersion!==1||!Array.isArray(payload.documents)||payload.documents.length!==part.count)throw new Error('新聞分檔內容或筆數不符');
      payload.documents.forEach(function(d){if(!d||typeof d.id!=='string'||!d.id||ids[d.id])throw new Error('新聞 ID 缺漏或重複');ids[d.id]=true;});
      count+=payload.documents.length;
      var obj={};obj[key]=payload;
      var serializedPart=JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
      outputs.push({path:'file-data/'+part.path.replace(/\.json$/,'.js'),content:'/* GENERATED news shard; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serializedPart+');})();\n'});
    });
    if(count!==news.count)throw new Error('新聞分檔總數不符');
  } else if(kind==='daily'&&news&&news.schemaVersion===3) {
    if(!Array.isArray(news.months)||!news.months.length||!Array.isArray(news.catalog)||news.catalog.length!==news.count)
      throw new Error('月份總索引格式不符');
    var monthIds={},monthNames={},filePaths={},monthlyCount=0;
    news.months.forEach(function(m){
      if(!m||!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(m.month)||m.index!=='archives/'+m.month+'/index.json'||monthNames[m.month])
        throw new Error('月份名稱／路徑重複或不符');
      monthNames[m.month]=true;
      var name='daily-simulation/'+m.index,monthly=psdBridgeReadJson_(pinned,name);
      if(monthly.schemaVersion!==1||monthly.month!==m.month||monthly.count!==m.count||
        !Array.isArray(monthly.shards)||!monthly.shards.length)
        throw new Error('月份內索引格式或筆數不符');
      var obj={};obj[name]=monthly;
      var serializedMonth=JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
      outputs.push({path:'file-data/'+m.index.replace(/\.json$/,'.js'),
        content:'/* GENERATED monthly news index; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serializedMonth+');})();\n'});
      var n=0;
      monthly.shards.forEach(function(part){
        if(!part||!/^news-shards\/[a-f0-9]{64}\.json$/.test(part.path)||filePaths[part.path]||!Number.isInteger(part.count)||part.count<1)
          throw new Error('月份分檔路徑／數量不符');
        filePaths[part.path]=true;
        var key='daily-simulation/'+part.path,meta=psdBridgeMeta_(pinned,key),raw=psdBridgeBytes_(pinned,meta);
        var hex=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)
          .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
        if(part.path!=='news-shards/'+hex+'.json')throw new Error('月份分檔雜湊不符');
        var payload=JSON.parse(Utilities.newBlob(raw).getDataAsString('UTF-8'));
        if(payload.schemaVersion!==1||!Array.isArray(payload.documents)||payload.documents.length!==part.count)
          throw new Error('月份分檔內容不符');
        payload.documents.forEach(function(d){
          if(!d||typeof d.id!=='string'||!d.id||monthIds[d.id]||typeof d.date!=='string'||d.date.slice(0,7)!==m.month)
            throw new Error('月份新聞 ID 或日期錯誤');
          monthIds[d.id]=m.month;
        });
        n+=payload.documents.length;monthlyCount+=payload.documents.length;
        var obj={};obj[key]=payload;
        var serializedPart=JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
        outputs.push({path:'file-data/'+part.path.replace(/\.json$/,'.js'),
          content:'/* GENERATED news shard; do not hand-edit. */\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serializedPart+');})();\n'});
      });
      if(n!==m.count)throw new Error('月份內分檔總數不符');
    });
    if(monthlyCount!==news.count||Object.keys(monthIds).length!==news.catalog.length||
      news.catalog.some(function(d){return !d||monthIds[d.id]!==d.month;}))
      throw new Error('月份總索引與全文不符');
  } else if(kind==='daily'&&(!news||news.schemaVersion!==1||!Array.isArray(news.documents)))throw new Error('新聞格式錯誤');
  var changes=[];
  outputs.forEach(function(file){
    var existing;
    try {existing=psdBridgeMeta_(pinned,file.path);}catch(e){if(e.httpStatus!==404)throw e;}
    var sha=psdBridgeSha1_(Utilities.newBlob(file.content).getBytes());
    file.sha=sha;
    if(!existing||existing.sha!==sha)changes.push({path:file.path,mode:'100644',type:'blob',content:file.content});
  });
  if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==head)throw new Error('來源分支已變動，請重試；未寫入離線資料');
  if(!changes.length){console.log('全部離線資料已核對（含新聞分檔）');return {kind:kind,changed:false,files:outputs.length};}
  var commit=psdBridgeApi_(cfg,'get','git/commits/'+head);
  var tree=psdBridgeApi_(cfg,'post','git/trees',{base_tree:commit.tree.sha,tree:changes});
  var next=psdBridgeApi_(cfg,'post','git/commits',{message:'build: repair '+kind+' offline files',tree:tree.sha,parents:[head]});
  psdBridgeApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:next.sha,force:false});
  var verified={repo:cfg.repo,branch:next.sha,token:cfg.token};
  outputs.forEach(function(file){if(psdBridgeMeta_(verified,file.path).sha!==file.sha)throw new Error('離線資料回讀核對失敗：'+file.path);});
  console.log('全部離線資料寫入並核對成功（含新聞分檔）：'+outputs.length+' 檔');
  return {kind:kind,changed:true,files:outputs.length,commit:next.sha};
}

// 人工修復入口：若題庫 JSON 已先成功更新，但 offline bridge 遺漏，可安全重跑（不改題目）。
function repairDailyOfflineBridge() { return psdSyncGeneratedBridge_('daily'); }
function repairWeeklyOfflineBridge() { return psdSyncGeneratedBridge_('weekly'); }
