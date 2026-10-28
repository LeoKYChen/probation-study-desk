// Browser acceptance for stage2 JSON import/restore, conflict versions and essay snapshots.
'use strict';
const assert=require('node:assert/strict');
const KEY='probation-study30-v251:v1',ARC='psd-unified-backup-conflicts-v1',DAY='2026-10-28';
const session={date:DAY,mode:'30',questionId:'synthetic-Q1',phase:0,remaining:300,elapsed:0,
 notes:[],rating:null,finished:false};
const envelope=(origin,row)=>({format:'psd-unified-learning-backup',schemaVersion:1,
 exportedAt:'2026-10-28T01:00:00.000Z',sourceOrigin:origin,
 data:{[KEY]:JSON.stringify({version:1,sessions:{[DAY]:row}})}});
module.exports=async function(browser,origin){
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844},
  timezoneId:'Asia/Taipei',locale:'zh-TW',serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 try{
  await page.clock.install({time:new Date('2026-10-28T12:00:00+08:00')});
  await page.goto(origin+'/backup/');
  await page.evaluate(({key,day,record})=>localStorage.setItem(key,JSON.stringify({version:1,sessions:{[day]:record}})),
   {key:KEY,day:DAY,record:session});
  await page.reload();
  async function importData(payload){
   await page.locator('#importFile').setInputFiles({name:'study.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(payload))});
   await page.locator('#preview').waitFor({state:'visible'});
   const before=page.waitForEvent('download');
   await page.locator('#backupBefore').click();await before;
   await page.locator('#confirmSafe').check();
   await page.locator('#confirmTabs').check();
   await page.locator('#restore').click();
   await page.waitForFunction(()=>document.querySelector('#preview')?.hidden===true);
  }
  const phone={...session,essayDrafts:{'synthetic-Q1':{outline:['Merton','Agnew','',''],fullAnswer:'早上草稿'}}};
  await importData(envelope(origin,phone));
  let records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(records.sessions[DAY].essayDrafts['synthetic-Q1'].fullAnswer,'早上草稿');
  // Divergent new incoming text must not overwrite an existing working answer.
  const desk={...phone,essayDrafts:{'synthetic-Q1':{outline:['結構理論','','',''],fullAnswer:'公司答案'}}};
  await page.evaluate(({key,row,day})=>{
   const item=JSON.parse(localStorage.getItem(key));item.sessions[day]=row;
   localStorage.setItem(key,JSON.stringify(item));
  },{key:KEY,row:desk,day:DAY});
  await page.reload();
  await importData(envelope(origin,phone));
  records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(records.sessions[DAY].essayDrafts['synthetic-Q1'].fullAnswer,'公司答案');
  let archive=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),ARC);
  assert(archive.entries.some(x=>x.key===KEY&&x.incoming?.essayDrafts?.['synthetic-Q1']?.fullAnswer==='早上草稿'));
  const panel=page.locator('#study30ConflictList details').first();
  await panel.locator('summary').click();
  assert.match(await panel.innerText(),/早上草稿/);
  const protection=page.waitForEvent('download');
  await page.locator('#study30ConflictBackup').click();await protection;
  await page.locator('#study30ConflictConfirmed').check();
  await panel.locator('button.restoreStudy30').nth(1).click();
  records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(records.sessions[DAY].essayDrafts['synthetic-Q1'].fullAnswer,'早上草稿');
  archive=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),ARC);
  assert(archive.entries.some(x=>x.incoming?.essayDrafts?.['synthetic-Q1']?.fullAnswer==='公司答案'));
  // Saved drafts can be snapshotted repeatedly on the same day without changing the timer.
  await page.goto(origin+'/professional/');
  await page.locator('#saveEssayVersion').waitFor();
  await page.locator('#essayField0').fill('Merton緊張理論');
  await page.locator('#saveEssayVersion').click();
  await page.locator('#essayField0').fill('Agnew一般化緊張理論');
  await page.locator('#saveEssayVersion').click();
  records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(Object.keys(records.sessions[DAY].essayVersions||{}).length,2);
  assert.equal(records.sessions[DAY].elapsed,0,'save version must not invent timed minutes');
  assert.deepEqual(errors,[],'no uncaught stage2 browser errors');
  console.log('PASS stage2 browser: safe JSON merge, conflict restore, same-day drafts and timer preserved');
 }finally{await ctx.close()}
};
