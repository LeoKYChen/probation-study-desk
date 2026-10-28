// Browser UX acceptance with mocked GIS + Drive REST. Never contacts real Google.
'use strict';
const assert=require('node:assert/strict');
module.exports=async function(browser,origin){
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',
  locale:'zh-TW',timezoneId:'Asia/Taipei'});
 await ctx.route('https://accounts.google.com/**',route=>route.abort());
 await ctx.addInitScript(()=>{
  const TOKEN='synthetic_access_token_not_real_01234567890123456';
  const folderId='fakefolder_12345678',files=[];
  window.__mockDriveFiles=files;
  window.google={accounts:{oauth2:{
   initTokenClient({callback}){return {requestAccessToken(){callback({
    access_token:TOKEN,expires_in:3600,scope:'https://www.googleapis.com/auth/drive.file'
   });}};},
   hasGrantedAllScopes:()=>true,revoke:(token,done)=>done?.()
  }}};
  const nativeFetch=window.fetch;
  const respond=data=>new Response(JSON.stringify(data),{status:200,
   headers:{'Content-Type':'application/json'}});
  window.fetch=async(url,options={})=>{
   const address=String(url);
   if(!address.startsWith('https://www.googleapis.com/'))return nativeFetch(url,options);
   if(options.headers?.Authorization!=='Bearer '+TOKEN)throw Error('missing/misplaced Google access token');
   const target=new URL(address),method=options.method||'GET';
   if(target.pathname==='/drive/v3/files'&&method==='GET'){
    const q=target.searchParams.get('q')||'';
    if(q.includes('mimeType'))return respond({files:window.__mockFolder?[{id:folderId,name:window.__mockFolder}]:[]});
    return respond({files:files.map((row,i)=>({id:row.id,name:row.name,mimeType:'application/json',
     createdTime:row.createdTime,size:500}))});
   }
   if(target.pathname==='/drive/v3/files'&&method==='POST'){
    const data=JSON.parse(options.body);
    window.__mockFolder=data.name;
    return respond({id:folderId,name:data.name});
   }
   if(target.pathname.startsWith('/drive/v3/files/')&&method==='GET'){
    const id=target.pathname.split('/').at(-1),row=files.find(x=>x.id===id);
    if(!row)return new Response('{}',{status:404});
    return respond(row.snapshot);
   }
   if(target.pathname==='/upload/drive/v3/files'&&method==='POST'){
    const body=await options.body.text();
    if(body.includes(TOKEN))throw Error('access token leaked into snapshot');
    const first=body.indexOf('{"format":"psd-drive-sync-snapshot-v1"');
    const end=body.indexOf('\r\n--',first);
    if(first<0||end<0)throw Error('invalid snapshot multipart');
    const snapshot=JSON.parse(body.slice(first,end));
    const id='fakefile_'+String(files.length+12345678);
    files.push({id,name:'psd-sync-v1-test-'+files.length+'.json',createdTime:snapshot.createdAt,snapshot});
    return respond({id,name:files.at(-1).name});
   }
   throw Error('unexpected Drive request '+method+' '+address);
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(origin+'/backup/');
  await page.evaluate(()=>{
   localStorage.setItem('probation-study30-v251:v1',JSON.stringify({version:1,sessions:{
    '2026-10-28':{date:'2026-10-28',notes:['Merton 假資料'],elapsed:0,
      essayDrafts:{Q:{outline:['Merton','Agnew','',''],fullAnswer:'純測試文字'}},
      _sync:{revision:'synthetic-seed',device:'seed',ancestors:[]}}
   }}));
  });
  await page.reload();
  await page.locator('#driveClientId').fill('12345678-synthetic.apps.googleusercontent.com');
  await page.locator('#driveConnect').click();
  await page.waitForFunction(()=>document.querySelector('#driveSyncStatus')?.textContent.includes('雲端已完成本次傳輸'),{timeout:25000});
  assert.equal(await page.evaluate(()=>window.__mockDriveFiles.length),1);
  const snapshot=await page.evaluate(()=>window.__mockDriveFiles[0].snapshot);
  assert(snapshot.backup.data['probation-study30-v251:v1'].includes('Merton'));
  const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  assert(!JSON.stringify(stored).includes('synthetic_access_token_not_real'));
  assert(!JSON.stringify(snapshot).includes('synthetic_access_token_not_real'));
  await page.locator('#driveSyncNow').click();
  await page.waitForFunction(()=>document.querySelector('#driveSyncStatus')?.textContent.includes('未產生新快照'));
  assert.equal(await page.evaluate(()=>window.__mockDriveFiles.length),1,
   'repeated unchanged sync should not append another snapshot');
  // Regression: an independent sibling A stored remotely and local sibling B
  // must become a visible conflict in the SAME open backup tab after sync.
  await page.evaluate(()=>{
   const key='probation-study30-v251:v1',files=window.__mockDriveFiles;
   const a=JSON.parse(files[0].snapshot.backup.data[key]);
   const day='2026-10-28';
   a.sessions[day].notes=['【手機版A】Merton'];
   a.sessions[day].essayDrafts.Q.outline[0]='【手機版A】緊張理論';
   a.sessions[day]._sync={revision:'synthetic-A',device:'A',ancestors:['synthetic-seed']};
   const cloud=JSON.parse(JSON.stringify(files[0].snapshot));
   cloud.id='cloud-A';cloud.createdAt=new Date(Date.now()+1000).toISOString();
   cloud.backup.data[key]=JSON.stringify(a);
   files.push({id:'fakefile_87654321',name:'psd-sync-v1-A.json',
    createdTime:cloud.createdAt,snapshot:cloud});
   const b=JSON.parse(localStorage.getItem(key));
   b.sessions[day].notes=['【電腦版B】Agnew'];
   b.sessions[day].essayDrafts.Q.outline[0]='【電腦版B】一般化緊張理論';
   b.sessions[day]._sync={revision:'synthetic-B',device:'B',ancestors:['synthetic-seed']};
   localStorage.setItem(key,JSON.stringify(b));
  });
  assert.match(await page.locator('#study30ConflictSummary').textContent(),/目前沒有/,
   'test precondition: conflict list is stale before sync');
  await page.locator('#driveSyncNow').click();
  await page.waitForFunction(()=>document.querySelector('#driveSyncStatus')?.textContent.includes('雲端已完成本次傳輸'));
  await page.waitForFunction(()=>/找到 [1-9]/.test(document.querySelector('#study30ConflictSummary')?.textContent||''));
  const conflicts=await page.locator('#study30ConflictList').textContent();
  assert.match(conflicts,/2026-10-28/);
  const archive=await page.evaluate(()=>localStorage.getItem('psd-unified-backup-conflicts-v1'));
  assert.match(archive,/手機版A/);
  assert.match(archive,/電腦版B/);
  assert.deepEqual(errors,[],'no uncaught errors during mocked Google Drive OAuth');
  console.log('PASS browser Drive UX: OAuth, append-only sync, sibling A/B conflicts displayed live, no token leakage');
 }finally{await ctx.close();}
};
