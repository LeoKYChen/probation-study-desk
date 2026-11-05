/**
 * Monthly question manifest reader/writer for manualSyncDailyQuestions().
 * Must be installed beside ManualDailyQuestions.gs and DailyResourcesSelective.gs.
 * Mutations are atomic Git-tree commits; unchanged shards are never re-uploaded.
 */
function manualQuestionReadMonthly_(cfg,index,head) {
  if(!index||index.schemaVersion!==2||!Array.isArray(index.months)||!index.months.length||
      !Array.isArray(index.catalog)||index.catalog.length!==index.count)
    throw new Error('月份題庫主索引不符，拒絕同步');
  var ids={},months={},paths={},all=[];
  index.months.forEach(function(m){
    if(!m||!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(m.month)||months[m.month]||
       !Array.isArray(m.shards)||!m.shards.length)throw new Error('月份題庫月份重複／不符');
    months[m.month]=true;var n=0;
    m.shards.forEach(function(shard){
      if(!shard||!/^question-shards\/[a-f0-9]{64}\.json$/.test(shard.path)||paths[shard.path]||
         !Number.isInteger(shard.bytes)||shard.bytes<1||shard.bytes>900000)
        throw new Error('月份題庫分檔路徑或大小不符');
      paths[shard.path]=true;
      var raw=manualQuestionRead_(cfg,'daily-simulation/'+shard.path,head,false);
      var bytes=Utilities.newBlob(raw.raw).getBytes();
      if(bytes.length!==shard.bytes)throw new Error('題庫分檔原文位元組數不符');
      var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)
        .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
      if(shard.path!=='question-shards/'+digest+'.json')throw new Error('題庫分檔 SHA-256 不符');
      var file=raw.data;
      if(file.schemaVersion!==1||!Array.isArray(file.questions)||file.questions.length!==shard.count)
        throw new Error('題庫分檔內容筆數不符');
      file.questions.forEach(function(q){
        if(!q||!q.id||ids[q.id]||!q.date||q.date.slice(0,7)!==m.month)
          throw new Error('題庫 ID 重複或來源月份錯誤');
        ids[q.id]=m.month;all.push(q);n++;
      });
    });
    if(n!==m.count)throw new Error('題庫月份分檔題數不符');
  });
  if(all.length!==index.count||Object.keys(ids).length!==index.catalog.length||
     index.catalog.some(function(q){return !q||ids[q.id]!==q.month;}))
    throw new Error('題庫總目錄與月份分檔不符');
  return {schemaVersion:1,updatedAt:index.updatedAt,count:all.length,questions:all,
    templates:index.templates||[],diagnostics:index.diagnostics||[]};
}
function manualQuestionCommitMonthly_(cfg,before,after,state) {
  if(!before||!before.index||before.index.schemaVersion!==2)throw new Error('題庫月份索引版本不符');
  manualQuestionValidate_(before.data,after);
  var orig=before.data,prior=before.index,writes=[],reused=0,created=0;
  var groups={},oldGroups={};
  orig.questions.forEach(function(q){
    var m=q.date.slice(0,7);
    (oldGroups[m]||(oldGroups[m]=[])).push(q);
  });
  after.questions.forEach(function(q){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(q.date))throw new Error('題目日期不符：'+q.id);
    var month=q.date.slice(0,7);
    if(!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(month))throw new Error('題目月份不符');
    (groups[month]||(groups[month]=[])).push(q);
  });
  var months=Object.keys(groups).sort().reverse(),oldByMonth={};
  prior.months.forEach(function(m){oldByMonth[m.month]=m;});
  var oldShards={};
  prior.months.forEach(function(m){m.shards.forEach(function(s){oldShards[s.path]=true;});});
  var toBytes=function(s){return Utilities.newBlob(s).getBytes();};
  var digest=function(raw){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');};
  function script(key,value,comment){
    var obj={};obj[key]=value;
    return comment+'\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+
      JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');})();\n';
  }
  var byId={},monthEntries=[];
  after.questions.forEach(function(q){byId[q.id]=q;});
  months.forEach(function(month){
    var current=groups[month],old=oldByMonth[month],shards=[],matched={},oldList=oldGroups[month]||[];
    function emit(items){
      var chunk=[];
      function flush(){
        if(!chunk.length)return;
        var obj={schemaVersion:1,questions:chunk},raw=JSON.stringify(obj),bin=toBytes(raw);
        if(bin.length>900000)throw new Error('題庫月份分檔超過900KB');
        var name='question-shards/'+digest(bin)+'.json',entry={path:name,count:chunk.length,bytes:bin.length};
        shards.push(entry);
        if(!oldShards[name]){
          writes.push({path:'daily-simulation/'+name,mode:'100644',type:'blob',content:raw});
          writes.push({path:'file-data/'+name.replace(/\.json$/,'.js'),mode:'100644',type:'blob',
            content:script('daily-simulation/'+name,obj,'/* GENERATED question shard; do not edit. */')});
          created++;
        }else reused++;
        chunk=[];
      }
      items.forEach(function(q){
        if(toBytes(JSON.stringify({schemaVersion:1,questions:[q]})).length>900000)
          throw new Error('單題超過 900KB 分檔限制：'+q.id);
        if(chunk.length&&toBytes(JSON.stringify({schemaVersion:1,questions:chunk.concat([q])})).length>900000)flush();
        chunk.push(q);
      });
      flush();
    }
    var offset=0;
    if(old){
      old.shards.forEach(function(part){
        var prior=oldList.slice(offset,offset+part.count);offset+=part.count;
        if(prior.length!==part.count)throw new Error('舊月份題數不符');
        var updated=prior.map(function(q){
          if(!byId[q.id])throw new Error('舊題號遺失：'+q.id);
          matched[q.id]=true;
          return byId[q.id];
        });
        if(JSON.stringify(prior)===JSON.stringify(updated)){shards.push(part);reused++;}
        else emit(updated);
      });
      if(offset!==oldList.length)throw new Error('舊月份分檔配對失敗');
    }
    // New source questions produce only new shard(s), preserving all existing hashes.
    emit(current.filter(function(q){return !matched[q.id];}));
    monthEntries.push({month:month,count:current.length,shards:shards,status:month===months[0]?'current':'archived'});
  });
  var sameQuestions=after.questions.length===orig.questions.length&&
    orig.questions.every(function(q){return byId[q.id]&&JSON.stringify(byId[q.id])===JSON.stringify(q);})&&
    JSON.stringify(after.templates||[])===JSON.stringify(orig.templates||[]);
  // Previously reviewed diagnostics must not disappear when only selected files were parsed.
  var diagnostics=Array.from(new Set((orig.diagnostics||[]).concat(after.diagnostics||[]))).sort();
  var catalog=after.questions.map(function(q){
    return {id:q.id,month:q.date.slice(0,7),date:q.date,subject:q.subject,
      title:String(q.question).replace(/\s+/g,' ').slice(0,110)};
  });
  var updated={schemaVersion:2,count:after.questions.length,updatedAt:after.updatedAt,
    activeMonth:months[0],months:monthEntries,catalog:catalog,templates:after.templates||[],diagnostics:diagnostics};
  // Keep current manifest byte-identical when there is no substantive change.
  if(!sameQuestions){
    writes.push({path:'daily-simulation/questions-monthly.json',mode:'100644',type:'blob',
      content:JSON.stringify(updated,null,2)+'\n'});
    writes.push({path:'file-data/questions-monthly.generated.js',mode:'100644',type:'blob',
      content:script('daily-simulation/questions-monthly.json',updated,'/* GENERATED question month manifest; do not edit. */')});
  }
  writes.push({path:PSD_DAILY_SOURCE_STATE_PATH_,mode:'100644',type:'blob',content:JSON.stringify(state,null,2)+'\n'});
  var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
  if(head!==before.head)throw new Error('題庫掃描期間 GitHub HEAD 已變動，拒絕覆寫');
  var pinned={repo:cfg.repo,branch:head,token:cfg.token};
  if(psdBridgeMeta_(pinned,'daily-simulation/questions-monthly.json').sha!==before.indexSha)
    throw new Error('題庫月份索引已被其他工作修改，拒絕覆寫');
  var base=psdBridgeApi_(cfg,'get','git/commits/'+head);
  var tree=psdBridgeApi_(cfg,'post','git/trees',{base_tree:base.tree.sha,tree:writes});
  var commit=psdBridgeApi_(cfg,'post','git/commits',{
    message:'chore(daily): manual question month delta and source checkpoint',
    tree:tree.sha,parents:[head]});
  psdBridgeApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:commit.sha,force:false});
  if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==commit.sha)
    throw new Error('GitHub 已提交但未核對成功；請查最新 SHA，勿盲目重試');
  return {sha:commit.sha,questionsChanged:!sameQuestions,newShards:created,reusedShards:reused,filesChanged:writes.length};
}

/**
 * Exceptional manual repair. Reads and validates monthly JSON, rebuilds only
 * missing/outdated ZIP JS representations; never rewrites any questions or IDs.
 */
function repairMonthlyQuestionOfflineBridge() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('已有題庫同步，離線修復暫停');
  try {
    var cfg=manualQuestionCfg_();
    var head=psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha;
    var pinned={repo:cfg.repo,branch:head,token:cfg.token};
    var manifest=manualQuestionRead_(cfg,'daily-simulation/questions-monthly.json',head,false);
    manualQuestionReadMonthly_(cfg,manifest.data,head); // Full SHA/ID/count integrity check.
    var outputs=[],index=manifest.data;
    function script(key,value,comment) {
      var obj={};obj[key]=value;
      return comment+'\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+
        JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');})();\n';
    }
    outputs.push({path:'file-data/questions-monthly.generated.js',
      content:script('daily-simulation/questions-monthly.json',index,'/* GENERATED question month manifest; do not edit. */')});
    index.months.forEach(function(m){m.shards.forEach(function(part){
      var key='daily-simulation/'+part.path;
      var shard=manualQuestionRead_(cfg,key,head,false).data;
      outputs.push({path:'file-data/'+part.path.replace(/\.json$/,'.js'),
        content:script(key,shard,'/* GENERATED question shard; do not edit. */')});
    });});
    var changes=[];
    outputs.forEach(function(f){
      var expect=psdBridgeSha1_(Utilities.newBlob(f.content).getBytes()),existing;
      try{existing=psdBridgeMeta_(pinned,f.path);}
      catch(e){if(e.httpStatus!==404)throw e;}
      if(!existing||existing.sha!==expect)
        changes.push({path:f.path,mode:'100644',type:'blob',content:f.content});
    });
    if(!changes.length){console.log('月份題庫離線 JS 全部正確，無需重新上傳。');return {changed:false,checked:outputs.length};}
    if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==head)
      throw new Error('核對期間 GitHub HEAD 更新，取消修復');
    var commit=psdBridgeApi_(cfg,'get','git/commits/'+head);
    var tree=psdBridgeApi_(cfg,'post','git/trees',{base_tree:commit.tree.sha,tree:changes});
    var next=psdBridgeApi_(cfg,'post','git/commits',{message:'build(daily): repair monthly questions ZIP wrappers',
      tree:tree.sha,parents:[head]});
    psdBridgeApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:next.sha,force:false});
    if(psdBridgeApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)).object.sha!==next.sha)
      throw new Error('修復已提交但未核對，勿盲目重試');
    var verified={repo:cfg.repo,branch:next.sha,token:cfg.token};
    changes.forEach(function(c){
      var meta=psdBridgeMeta_(verified,c.path);
      if(meta.sha!==psdBridgeSha1_(Utilities.newBlob(c.content).getBytes()))
        throw new Error('離線題庫回讀核對失敗：'+c.path);
    });
    console.log('月份題庫離線 JS 修復並回讀：'+changes.length+' 檔');
    return {changed:true,filesChanged:changes.length,commit:next.sha};
  } finally {lock.releaseLock();}
}
