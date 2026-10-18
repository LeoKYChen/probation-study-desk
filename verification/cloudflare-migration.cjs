'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const playwright=require('playwright'),engine=process.env.UNIFIED_BROWSER_ENGINE||'chromium',root=path.resolve(process.argv[2]||'.');
const repository=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/cloudflare-before-sync/manifest.json')));
const files=new Map();for(const row of manifest.files){const file=path.join(repository,row.path);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),row.sha256,'frozen production asset '+row.name);files.set(row.name,file);}
let upgraded=false;
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);if(!name||name.endsWith('/'))name+='index.html';
 let file=!upgraded?files.get(name):path.resolve(root,name);
 if(!file||(!upgraded&&!files.has(name))||(upgraded&&!file.startsWith(root+path.sep))){res.writeHead(404).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}const type={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);});
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await playwright[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{const context=await browser.newContext({locale:'zh-TW',timezoneId:'Asia/Taipei',viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(15000);const base='http://127.0.0.1:'+server.address().port+'/';const key='probation-study30-v251:v1';
await page.goto(base);await page.waitForFunction(()=>window.Study30App&&window.Study30QuestionSources?.all?.length===426);
await page.locator('.daily-quick-notes summary').click();await page.locator('#answer').fill('舊 Cloudflare 的步驟速記');await page.locator('#essayEditor').evaluate(n=>n.open=true);await page.locator('#essayFullAnswer').fill('舊 Cloudflare 已寫下的完整申論答案。');
const originalId=await page.evaluate(()=>Study30App.essayContext().questionId);
const before=await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key));const today=Object.keys(value.sessions).sort().at(-1);value.sessions['2026-01-01']={...JSON.parse(JSON.stringify(value.sessions[today])),date:'2026-01-01',notes:['以前的作答'],unknownField:'必須保留'};localStorage.setItem(key,JSON.stringify(value));localStorage.setItem('another-module-record','其他科目的紀錄');return {raw:localStorage.getItem(key),past:value.sessions['2026-01-01']};},key);
upgraded=true;await page.goto(base);assert.equal(await page.locator('a.tile').count(),6);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before.raw,'new home does not rewrite old sessions');
await page.goto(base+'professional/');await page.waitForFunction(()=>window.Study30App);
assert.equal(await page.evaluate(()=>Study30App.essayContext().questionId),originalId);assert.equal(await page.locator('#answer').inputValue(),'舊 Cloudflare 的步驟速記');assert.equal(await page.locator('#essayFullAnswer').inputValue(),'舊 Cloudflare 已寫下的完整申論答案。');
await page.locator('#essayEditor').evaluate(n=>n.open=true);await page.locator('#daily30AiFeedback').fill('升級後新增的 AI 評語');await page.reload();await page.locator('#daily30AiFeedback').waitFor({state:'attached'});assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'升級後新增的 AI 評語');
assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).sessions['2026-01-01'],key),before.past);
// Local rollback simulation, without invoking Cloudflare APIs.
upgraded=false;await page.goto(base);assert.equal(await page.locator('#answer').inputValue(),'舊 Cloudflare 的步驟速記');await page.locator('.daily-quick-notes summary').click();await page.locator('#answer').fill('回復舊版後接續保存');
assert((await page.evaluate(key=>localStorage.getItem(key),key)).includes('升級後新增的 AI 評語'),'old app preserves added fields');
upgraded=true;await page.goto(base+'professional/');await page.locator('#daily30AiFeedback').waitFor({state:'attached'});assert.equal(await page.locator('#answer').inputValue(),'回復舊版後接續保存');assert.equal(await page.locator('#daily30AiFeedback').inputValue(),'升級後新增的 AI 評語');assert.equal(await page.evaluate(()=>localStorage.getItem('another-module-record')),'其他科目的紀錄');
await context.close();console.log('PASS Cloudflare legacy migration:',engine,'actual old deployment assets; same-origin home/professional transition; old question, notes, full answer, history, new AI fields survive upgrade and local rollback');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
