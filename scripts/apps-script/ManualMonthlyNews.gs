/**
 * 月份封存新聞的手動增量寫入器（只供 manualSyncReadingNews 呼叫）。
 *
 * 僅對修改過的月份建立新索引和新 SHA-256 shard，
 * 未變更月份及 shard 保留 GitHub 上的舊檔案，不再次提交。
 */
function manualNewsCommitMonthly_(cfg,previous,next) {
  if(previous.storageVersion!==3||!previous.monthlyIndex||!previous.monthlyGroups)
    throw new Error('目前不是月份封存格式；拒絕寫入。');
  readingNewsValidate_(next);
  var prior=previous.monthlyIndex,byId={},consumed={},shardsByMonth={},writes=[],oldMonths={},reused=0,newCount=0;
  prior.months.forEach(function(m){oldMonths[m.month]=m;});
  next.documents.forEach(function(d){
    if(byId[d.id])throw new Error('重複新聞 ID');
    byId[d.id]=d;
  });
  var validMonth=function(s){return /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(s);};
  var bytes=function(s){return Utilities.newBlob(s).getBytes();};
  var serialize=function(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');};
  var makeJs=function(data,comment){
    return comment+'\n(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+serialize(data)+');})();\n';
  };
  function emit(month,items) {
    if(!items.length)return;
    if(!shardsByMonth[month])shardsByMonth[month]=[];
    var chunk=[];
    function flush(){
      if(!chunk.length)return;
      var text=JSON.stringify({schemaVersion:1,documents:chunk}),raw=bytes(text);
      var sha=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)
        .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
      var name='news-shards/'+sha+'.json',path='daily-simulation/'+name,obj={};
      shardsByMonth[month].push({path:name,count:chunk.length});
      writes.push({path:path,mode:'100644',type:'blob',content:text});
      obj[path]=JSON.parse(text);
      writes.push({path:'file-data/'+name.replace(/\.json$/,'.js'),mode:'100644',type:'blob',
        content:makeJs(obj,'/* GENERATED news shard; do not hand-edit. */')});
      newCount++;chunk=[];
    }
    items.forEach(function(d){
      if(!validMonth(d.date.slice(0,7))||d.date.slice(0,7)!==month)throw new Error('月份日期不符');
      if(bytes(JSON.stringify({schemaVersion:1,documents:[d]})).length>1000000)
        throw new Error('單篇新聞超過 1MB 限制：'+d.id);
      if(chunk.length&&bytes(JSON.stringify({schemaVersion:1,documents:chunk.concat([d])})).length>1000000)flush();
      chunk.push(d);
    });
    flush();
  }
  // Only materialize changed groups; existing SHA-256 files remain immutable.
  previous.shardGroups.forEach(function(part){
    var month=part.month;
    if(!validMonth(month))throw new Error('舊分檔沒有月份資訊');
    if(!shardsByMonth[month])shardsByMonth[month]=[];
    var kept=[];
    part.documents.forEach(function(d){
      var updated=byId[d.id];
      if(updated&&updated.date.slice(0,7)===month){
        if(consumed[d.id])throw new Error('既有新聞重複');
        consumed[d.id]=true;kept.push(updated);
      }
    });
    if(!kept.length)return;
    var same=kept.length===part.documents.length&&
      kept.every(function(d,i){return JSON.stringify(d)===JSON.stringify(part.documents[i]);});
    if(same){shardsByMonth[month].push({path:part.path,count:kept.length});reused++;}
    else emit(month,kept);
  });
  var pending={};
  next.documents.forEach(function(d){
    if(consumed[d.id])return;
    var month=d.date.slice(0,7);
    if(!validMonth(month))throw new Error('新聞月份格式不符：'+d.id);
    if(!pending[month])pending[month]=[];
    pending[month].push(d);
  });
  Object.keys(pending).sort().forEach(function(month){emit(month,pending[month]);});
  var allMonths=Object.keys(shardsByMonth).filter(function(m){return shardsByMonth[m].length;}).sort().reverse();
  if(!allMonths.length)throw new Error('月份分檔內容不可為空');
  var total=0,monthEntries=[];
  allMonths.forEach(function(month){
    var parts=shardsByMonth[month],count=parts.reduce(function(n,part){return n+part.count;},0);
    total+=count;
    var destination='archives/'+month+'/index.json';
    monthEntries.push({month:month,status:month===allMonths[0]?'open':'archived',count:count,index:destination});
    var old=previous.monthlyGroups.find(function(x){return x.month===month;});
    var same=old&&old.shards.length===parts.length&&old.shards.every(function(x,i){
      return x.path===parts[i].path&&x.count===parts[i].count;
    });
    if(same)return;
    var content={schemaVersion:1,month:month,count:count,shards:parts},raw=JSON.stringify(content,null,2)+'\n';
    writes.push({path:'daily-simulation/'+destination,mode:'100644',type:'blob',content:raw});
    var obj={};obj['daily-simulation/'+destination]=content;
    writes.push({path:'file-data/'+destination.replace(/\.json$/,'.js'),mode:'100644',type:'blob',
      content:makeJs(obj,'/* GENERATED monthly news index; do not hand-edit. */')});
  });
  if(total!==next.documents.length)throw new Error('月份寫入總筆數不符');
  var catalog=next.documents.map(function(d){
    return {id:d.id,month:d.date.slice(0,7),date:d.date,title:d.title,modified:d.modified,mime:d.mime||'text/markdown',tags:d.tags,excerpt:d.excerpt||'',url:d.url};
  });
  var manifest={schemaVersion:3,count:next.documents.length,activeMonth:allMonths[0],
    sync:next.sync,months:monthEntries,catalog:catalog};
  var ref=readingNewsApi_(cfg,'get','git/ref/heads/'+encodeURIComponent(cfg.branch)),head=ref.object.sha;
  var origin=readingNewsApi_(cfg,'get','contents/'+cfg.path+'?ref='+encodeURIComponent(head));
  if(origin.sha!==previous.sha)throw new Error('GitHub 月份索引已被其他工作更新，停止提交');
  var q=readingNewsApi_(cfg,'get','contents/daily-simulation/questions.json?ref='+encodeURIComponent(head));
  if(!q.content||q.encoding!=='base64')q=readingNewsApi_(cfg,'get','git/blobs/'+q.sha);
  var questions=JSON.parse(Utilities.newBlob(Utilities.base64Decode(q.content.replace(/\s/g,''))).getDataAsString('UTF-8'));
  if(!questions||!Array.isArray(questions.questions)||questions.questions.length<125)throw new Error('題庫安全檢查不通過');
  var offline={'daily-simulation/questions.json':questions,'daily-simulation/documents.json':manifest};
  writes.push({path:cfg.path,mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'});
  writes.push({path:'file-data/daily.generated.js',mode:'100644',type:'blob',
    content:makeJs(offline,'/* GENERATED from committed JSON; do not hand-edit. */')});
  var commit=readingNewsApi_(cfg,'get','git/commits/'+head);
  var tree=readingNewsApi_(cfg,'post','git/trees',{base_tree:commit.tree.sha,tree:writes});
  var final=readingNewsApi_(cfg,'post','git/commits',{message:'chore(news): update monthly archive incrementally',tree:tree.sha,parents:[head]});
  readingNewsApi_(cfg,'patch','git/refs/heads/'+encodeURIComponent(cfg.branch),{sha:final.sha,force:false});
  return {sha:final.sha,reusedShards:reused,newShards:newCount};
}
