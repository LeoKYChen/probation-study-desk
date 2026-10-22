'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
(async()=>{
 const moduleText=read('study-desk/weakness.js');
 const mod=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
 assert.equal(mod.WEAKNESS_CATEGORIES.length,7);
 assert.equal(mod.validateWeaknessCategory('norm'),'norm');
 assert.throws(()=>mod.validateWeaknessCategory('invented'),/弱點類別/);
 const task={id:'attempt/1',subject:'心理學',question:{title:'心理測驗',topicKey:'心理學｜心理測驗'},due:'2026-10-25',
   feedback:[{id:'ai1',unverified:true,text:'AI 猜測存在問題'}],
   corrections:[{id:'c1',category:'norm',gap:'混淆信度與效度',text:'信度是測量一致性',at:'2026-10-22T12:00:00Z'}],recalls:[]};
 let items=mod.confirmedWeaknesses([task]);
 assert.equal(items.length,1,'only human-confirmed corrections count');
 assert.equal(items[0].category,'norm');
 assert.equal(mod.weaknessStats(items).total,1);
 assert.equal(mod.weaknessStats(items).subjects[0].subject,'心理學');
 assert.equal(mod.confirmedWeaknesses([{...task,corrections:[]}]).length,0,'AI-only feedback never counts');
 assert.equal(mod.confirmedWeaknesses([{...task,corrections:[{id:'bad',gap:'',text:'訂正'}]}]).length,0,'empty gaps do not count');
 items=mod.confirmedWeaknesses([{...task,corrections:[{id:'old',gap:'歷史缺口',text:'歷史訂正',at:'2025-01-01'}]}]);
 assert.equal(items[0].category,'other','old backups without categories remain readable');
 const app=read('study-desk/app.js'),html=read('study-desk/index.html'),sw=read('study-desk/sw.js');
 assert.match(html,/id="gap-category"/);assert.match(html,/id="track-weak-topic"/);assert.match(html,/id="weakness-board"/);
 assert.match(app,/confirmedBy:'user'/);assert.match(app,/if\(flag&&topicKey/);
 assert.match(app,/renderWeaknessBoard\(state\)/);
 assert.match(sw,/weakness\.js/);
 console.log('PASS: manual-only weakness categories, legacy compatibility, summary and offline shell');
})().catch(e=>{console.error(e);process.exitCode=1});
