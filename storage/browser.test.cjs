'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const { chromium, webkit } = require('playwright');
(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/indexeddb.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); return res.end(fs.readFileSync(__dirname+'/indexeddb.js')); }
    if (req.url === '/study30.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); return res.end(fs.readFileSync(__dirname+'/../professional/study30-idb-repository.js')); }
    if (req.url === '/daily-shared.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); return res.end(fs.readFileSync(__dirname+'/daily-shared-repository.js')); }
    if (req.url === '/model.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); return res.end(fs.readFileSync(__dirname+'/../daily-simulation/model.js')); }
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><script src="/indexeddb.js"></script><script src="/study30.js"></script><script src="/daily-shared.js"></script><script src="/model.js"></script>');
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  try {
    for (const engine of (process.env.STUDY30_CHROMIUM_ONLY ? [chromium] : [chromium,webkit])) {
      const launch={headless:true};if(process.env.STUDY30_CHROMIUM_PATH&&engine===chromium)launch.executablePath=process.env.STUDY30_CHROMIUM_PATH;
      const browser = await engine.launch(launch);
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const url = `http://127.0.0.1:${server.address().port}/`;
        await page.goto(url);
        const migrated = await page.evaluate(async () => {
          localStorage.setItem('essay','{"q1":"原始答案"}');
          window.store = await PSDLearningStorage.open();
          return store.migrate(localStorage,['essay'],(_key,raw) => JSON.parse(raw));
        });
        assert.equal(migrated.migrated,true);
        assert.equal(await page.evaluate(() => localStorage.getItem('essay')), '{"q1":"原始答案"}');
        const second = await context.newPage(); await second.goto(url);
        await second.evaluate(async () => { window.store = await PSDLearningStorage.open(); });
        await page.evaluate(() => store.compareAndSet('essay','{"q1":"原始答案"}','{"q1":"已修改"}'));
        assert.match(await second.evaluate(async () => { try { await store.compareAndSet('essay','{"q1":"原始答案"}','wrong'); return 'unexpected success'; } catch (e) { return e.message; } }), /其他分頁/);
        const batch = await page.evaluate(async () => {
          const base=await store.snapshot(['essay','extra']);
          await store.compareAndSetMany(['essay','extra'],base,{extra:'新增'});
          try { await store.compareAndSetMany(['essay','extra'],base,{essay:'覆蓋',extra:'覆蓋'}); return false; } catch (_) { return (await store.get('extra'))==='新增'; }
        });
        assert.equal(batch,true);
        await page.reload();
        assert.equal(await page.evaluate(async () => { const db=await PSDLearningStorage.open(); const value=await db.get('essay'); db.close(); return value; }), '{"q1":"已修改"}');
        const moduleResult=await page.evaluate(async () => {
          const key='probation-study30-v251:v1';
          const raw=JSON.stringify({version:1,sessions:{'2026-10-29':{questionId:'stable-id',notes:['舊稿']}}});
          localStorage.setItem(key,raw);
          const db=await PSDLearningStorage.open(), repo=await Study30IndexedRepository.open({database:db,legacy:localStorage});
          const value=repo.read();value.sessions['2026-10-29'].notes=['修改後'];await repo.write(value);await repo.flush();
          const preserved=localStorage.getItem(key)===raw;db.close();return preserved;
        });
        assert.equal(moduleResult,true);
        const shared=await page.evaluate(async()=>{
          const a='probation-daily-github:records:v1',b='daily-reading-test:saved';
          const original=JSON.stringify({'original-Q':{answer:'原稿',review:false,updatedAt:'2099'}});
          localStorage.setItem(a,original);localStorage.setItem(b,JSON.stringify(['original-Q']));
          const db=await PSDLearningStorage.open();
          const first=await PSDDailySharedRepository.open({database:db,legacy:localStorage,model:PracticeModel});
          const second=await PSDDailySharedRepository.open({database:db,legacy:localStorage,model:PracticeModel});
          const doc=first.read().records;doc['original-Q'].answer='新稿';await first.writeRecords(doc);
          await second.writeFavorites(['original-Q','另一題']);
          let rejected=false;try{await second.writeRecords(doc);}catch{rejected=true;}
          const result={rejected,record:JSON.parse(await db.get(a))['original-Q'].answer,original:localStorage.getItem(a)===original};db.close();return result;
        });
        assert.deepEqual(shared,{rejected:true,record:'新稿',original:true});
        await context.setOffline(true);
        const daily=await page.evaluate(async()=>{const db=await PSDLearningStorage.open();const repo=await Study30IndexedRepository.open({database:db,legacy:localStorage});const value=repo.read();db.close();return value;});
        assert.equal(daily.sessions['2026-10-29'].questionId,'stable-id');
        assert.equal(daily.sessions['2026-10-29'].notes[0],'修改後');
        assert.equal(await page.evaluate(async () => { const db=await PSDLearningStorage.open(); const value=await db.get('essay'); db.close(); return value; }), '{"q1":"已修改"}');
        await context.close();
        console.log(`PASS ${engine.name()}: migration, legacy retention, stale tab, reload, offline read`);
      } finally { await browser.close(); }
    }
  } finally { await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode=1; });
