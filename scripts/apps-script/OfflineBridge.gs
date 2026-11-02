/**
 * GitHub 離線 ZIP 資料橋接同步 v1.0（僅同步已存在的 JSON 到 JS 產生檔）。
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
    throw new Error('離線資料橋接：GitHub HTTP '+status+'（'+why+'）。本次未覆寫其他檔案。');
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
  var inputPaths=kind==='weekly'?['juvenile-news/issues.json']:
    ['daily-simulation/questions.json','daily-simulation/documents.json'];
  var target='file-data/'+kind+'.generated.js';
  var data={};
  inputPaths.forEach(function(path){data[path]=psdBridgeReadJson_(cfg,path);});
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
  var existing=psdBridgeMeta_(cfg,target);
  var sha=psdBridgeSha1_(bytes);
  if(existing.sha===sha) {
    console.log('離線資料已同步：'+target+'（無須寫入）');
    return {kind:kind,changed:false,sha:sha};
  }
  psdBridgeApi_(cfg,'put','contents/'+target,{message:'build: update '+kind+' offline file-data bridge',branch:cfg.branch,sha:existing.sha,content:Utilities.base64Encode(bytes)});
  var confirmed=psdBridgeMeta_(cfg,target);
  if(confirmed.sha!==sha) throw new Error('離線資料已嘗試寫入，但 GitHub SHA 驗證失敗：'+target);
  console.log('離線資料寫入核對成功：'+target);
  return {kind:kind,changed:true,sha:sha};
}

// 人工修復入口：若題庫 JSON 已先成功更新，但 offline bridge 遺漏，可安全重跑（不改題目）。
function repairDailyOfflineBridge() { return psdSyncGeneratedBridge_('daily'); }
function repairWeeklyOfflineBridge() { return psdSyncGeneratedBridge_('weekly'); }
