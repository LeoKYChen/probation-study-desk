/* Google Drive REST transport: only app-created Drive files, OAuth access token stays in memory. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDDriveTransport=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const BASE='https://www.googleapis.com/drive/v3/files';
 const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
 const FOLDER='觀護人學習平台-私人同步備份';
 const PREFIX='psd-sync-v1-';
 const FOLDER_MIME='application/vnd.google-apps.folder';
 const MAX_BYTES=24*1024*1024;
 function assert(t,s){if(!t)throw Error(s);}
 function create({getToken,fetcher=fetch,createId,folderName=FOLDER}){
  assert(typeof getToken==='function'&&typeof createId==='function','Drive 傳輸介面設定不完整');
  const esc=s=>String(s).replaceAll('\\','\\\\').replaceAll("'","\\'");
  async function request(url,options={}){
   const token=getToken();
   assert(typeof token==='string'&&token.length>20,'Google 授權已過期；請重新連線後同步');
   const response=await fetcher(url,{...options,headers:{
    ...(options.headers||{}),Authorization:'Bearer '+token
   },cache:'no-store'});
   if(!response.ok){
    let message='';
    try{const json=await response.json();message=json.error?.message||'';}catch{}
    if(response.status===401||response.status===403)throw Error('Google 授權不足或已到期（HTTP '+response.status+'）'+(message?'：'+message:''));
    throw Error('Google Drive 操作失敗（HTTP '+response.status+'）'+(message?'：'+message:''));
   }
   return response;
  }
  async function list(query,fields,pageSize=1000){
   let token,results=[],pages=0;
   do{
    assert(++pages<=20,'Google Drive 分頁數過多，已停止以避免不完整同步');
    const params=new URLSearchParams({q:query,fields:'nextPageToken,files('+fields+')',
     pageSize:String(pageSize),spaces:'drive'});
    if(token)params.set('pageToken',token);
    const response=await request(BASE+'?'+params.toString());
    const data=await response.json();
    assert(data&&Array.isArray(data.files),'Google Drive 檔案清單格式不符');
    results.push(...data.files);
    token=data.nextPageToken;
   }while(token);
   return results;
  }
  async function ensureFolder(){
   const folders=await list("trashed = false and mimeType = '"+FOLDER_MIME+"' and name = '"+esc(folderName)+"'",
    'id,name,mimeType,createdTime');
   if(folders.length>1)throw Error('找到多個同名同步資料夾，為防止分流，請先至 Google Drive 檢查並保留完整備份');
   if(folders.length===1)return folders[0].id;
   const response=await request(BASE+'?fields=id,name',{method:'POST',
    headers:{'Content-Type':'application/json;charset=utf-8'},
    body:JSON.stringify({name:folderName,mimeType:FOLDER_MIME})});
   const created=await response.json();
   assert(created&&typeof created.id==='string'&&created.id,'無法建立私人同步資料夾');
   return created.id;
  }
  async function listSnapshots(folderId){
   assert(typeof folderId==='string'&&folderId,'同步資料夾不存在');
   const rows=await list("trashed = false and '"+esc(folderId)+"' in parents and name contains '"+PREFIX+"'",
    'id,name,mimeType,createdTime,size');
   return rows.filter(x=>x.name?.startsWith(PREFIX)&&x.name.endsWith('.json')&&x.mimeType==='application/json');
  }
  async function readSnapshot(fileId){
   assert(typeof fileId==='string'&&/^[a-zA-Z0-9_-]{8,200}$/.test(fileId),'不安全的雲端檔案 ID');
   const response=await request(BASE+'/'+encodeURIComponent(fileId)+'?alt=media');
   const len=Number(response.headers.get('Content-Length')||0);
   assert(!len||len<=MAX_BYTES,'雲端快照超出大小限制');
   const raw=await response.text();
   assert(raw.length<=MAX_BYTES,'雲端快照超出大小限制');
   try{return JSON.parse(raw)}catch{throw Error('Google Drive 有無法解析的 JSON 快照；為避免遺失內容，已停止同步');}
  }
  async function writeSnapshot(folderId,payload){
   assert(typeof folderId==='string'&&folderId,'同步資料夾不存在');
   const json=JSON.stringify(payload);
   assert(json.length<=MAX_BYTES,'快照超過安全上限，請先下載 JSON 備份');
   const boundary='psdsync'+createId().replace(/[^a-zA-Z0-9]/g,'');
   const name=PREFIX+payload.createdAt.replace(/[^0-9TZ]/g,'')+'-'+payload.id+'.json';
   const metadata={name,mimeType:'application/json',parents:[folderId],
    description:'觀護人學習平台私人同步快照；不要公開分享'};
   const blob=new Blob([
    '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
    json,'\r\n--'+boundary+'--\r\n'
   ],{type:'multipart/related; boundary='+boundary});
   const response=await request(UPLOAD+'?uploadType=multipart&fields=id,name,size,createdTime',
    {method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:blob});
   const created=await response.json();
   assert(created&&typeof created.id==='string'&&created.id,'雲端儲存後未取得快照 ID');
   return created;
  }
  return {ensureFolder,listSnapshots,readSnapshot,writeSnapshot};
 }
 return {BASE,UPLOAD,FOLDER,PREFIX,create};
});
