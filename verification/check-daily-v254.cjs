/* v2.5.4 daily practice regression checks, no external dependencies. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const root={};
function evaluate(path){vm.runInNewContext(read(path),{window:root,globalThis:root}, {filename:path,timeout:5000});}
evaluate('daily-simulation/model.js');
evaluate('v2.5/backup-core.js');
evaluate('v2.5/ai-simple-review-v254.js');
const M=root.PracticeModel,B=root.Backup25,A=root.AISimpleReview254;
assert.ok(M&&B&&A);
const d=M.dataset(JSON.parse(read('daily-simulation/questions.json')));
assert.equal(d.questions.length,d.count);
assert.ok(d.questions.length>0);
const sample=d.questions[0];
const old={answer:'初稿',review:false,updatedAt:'2026-10-17T00:00:00.000Z',questionSnapshot:M.signature(sample)};
const newer={...old,answer:'訂正答案',aiFeedback:'AI 批改示例'};
assert.equal(M.records({old}).old.answer,'初稿');
assert.equal(M.records({[sample.id]:newer})[sample.id].aiFeedback,'AI 批改示例');
const dailyFile={format:'probation-daily-github-records',schemaVersion:1,records:{[sample.id]:newer}};
assert.equal(M.backup(dailyFile)[sample.id].aiFeedback,'AI 批改示例');
const full=B.create({},{[sample.id]:newer});
assert.equal(B.validate(full).daily[sample.id].aiFeedback,'AI 批改示例');
const merged=B.merge(B.create({},{[sample.id]:old}),full);
assert.ok(merged.data.daily[sample.id]);
assert.deepEqual(Object.keys(merged.data.study),[],'每日題不得寫入考古題');
const script=read('v2.5/daily-practice.js');
const html=read('v2.5/daily-practice.html');
new vm.Script(script,{filename:'v2.5/daily-practice.js'});
const ids=[...script.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
for(const id of new Set(ids))assert.ok(html.includes('id="'+id+'"'),'missing UI node '+id);
const matchStart=script.indexOf('function promptFor(q,answer){');
const matchEnd=script.indexOf('async function copyAI(){',matchStart);
assert.ok(matchStart>=0&&matchEnd>matchStart);
const promptFor=vm.runInNewContext('('+script.slice(matchStart,matchEnd).trim()+')',{AI:A,M});
const law={...sample,id:'law',date:'2026-10-17',subject:'少年事件處理法',
 question:'分析少年事件處理法、刑法及刑事訴訟法的法律爭點。'};
const mixed={...sample,id:'mixed',subject:'少年事件處理法',
 question:'（一）依法分析保護處分（15分）。（二）運用心理學理論提出處遇（10分）。'};
assert.throws(()=>promptFor(law,''),/請先完成/);
const lawText=promptFor(law,'法律爭點分析答案');
assert.ok(lawText.includes(law.question)&&lawText.includes('法律爭點分析答案'));
assert.ok(lawText.includes('整題統一評分')&&lawText.includes('不要另列各法律科目分數'));
const mixedText=promptFor(mixed,'學理與法律分析答案');
assert.ok(mixedText.includes('非法律學科部分分別評分'));
assert.ok(mixedText.includes('15分')&&mixedText.includes('10分'));
assert.ok(!mixedText.includes('【參考考點（未獨立審定）】\n真實正解'),'未核對的來源不得冒充標準答案');
const manifest=JSON.parse(read('offline-manifest.json')),assets=manifest.assets.map(x=>x.url);
for(const path of ['v2.5/daily-practice.html','v2.5/daily-practice.css','v2.5/daily-practice.js'])
 assert.ok(assets.includes(path),'missing PWA asset '+path);
assert.equal(assets.length,new Set(assets).size,'duplicate PWA assets');
assert.ok(read('v2.5/index.html').includes('href="daily-practice.html"'));
assert.ok(html.includes('href="../daily-simulation/"'),'舊每日題瀏覽連結必須保留');
assert.ok(script.includes("const KEY='probation-daily-github:records:v1'"),'必須共用原每日題儲存鍵');
assert.ok(script.includes('persist({});records={};timers={};writeTimers()'),'只清每日題並重設計時');
console.log('Daily v2.5.4 regression checks passed ('+d.count+' questions).');
