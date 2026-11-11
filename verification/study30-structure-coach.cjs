'use strict';
// No browser dependencies: checks the model, backup compatibility and script syntax.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(read('professional/structure-coach-model.js'),ctx);
const M=ctx.window.Study30StructureCoachModel;
const empty=M.empty();
assert.equal(M.valid(empty),true);
assert.equal(M.hasActivity(empty),false,'empty preselected task is not progress');
assert.equal(M.readyForPhase(0,empty),false);
const first=M.normalize(empty);
first.facts='甲受賄；乙另交付項鍊給丙';
first.coreQuestion='法院得否依職權命丙參與沒收程序？';
first.prerequisites='第三人財產受影響的條件、參與必要性';
assert.equal(M.readyForPhase(0,first),true);
assert.equal(M.hasActivity(first),true);
assert.equal(M.readyForPhase(1,first),false);
first.outline=[{title:'第三人財產',question:'是否受沒收程序影響？',role:'premise'},{title:'法院職權',question:'法定要件是否符合？',role:'issue'}];
assert.equal(M.readyForPhase(1,first),true);
first.paragraph={issue:'法院有無權限',rule:'適用規範待查',application:'本題具體事實如何適用',conclusion:'本段結論待檢驗',combined:''};
assert.equal(M.readyForPhase(2,first),true);
first.weakness='涵攝不足';
first.nextGoal='下次每段對照一項具體事實';
assert.equal(M.readyForPhase(3,first),true);
assert.equal(M.valid(first),true);
const bad=M.normalize({...first,outline:[{title:'a',question:'b',role:'invented'}]});
assert.equal(bad.outline[0].role,'issue','unknown outline roles normalized');
assert.equal(M.valid({...first,facts:'X'.repeat(12001)}),false);
assert.equal(M.valid({...first,checks:[true]}),false);
// Import conserves optional new fields and legacy study30 sessions.
vm.runInNewContext(read('professional/backup-import.js'),ctx);
const importer=ctx.window.Study30BackupImport;
const sample={version:1,sessions:{
  '2026-11-13':{date:'2026-11-13',mode:'30',practiceMode:'structure',questionId:'sample',
    phase:2,elapsed:175,remaining:100,notes:[],structureCoach:first,finished:false},
  '2026-11-10':{date:'2026-11-10',mode:'30',phase:0,elapsed:0,notes:[],finished:false}
}};
const decoded=importer.parse(JSON.stringify({format:'probation-study30-v252',version:1,data:sample}));
assert.equal(decoded.sessions['2026-11-13'].practiceMode,'structure');
assert.equal(decoded.sessions['2026-11-13'].structureCoach.paragraph.application,'本題具體事實如何適用');
assert.equal(decoded.sessions['2026-11-10'].practiceMode,undefined);
const merged=importer.merge(sample,decoded,'merge');
assert.equal(merged.skipped,2);
const html=read('professional/index.html');
for(const id of ['practiceNormal','practiceStructure','practiceModeHint','structureCoachPanel'])
  assert(html.includes('id="'+id+'"'),'missing DOM control '+id);
assert(html.indexOf('structure-coach-model.js')<html.indexOf('practice-session.js'));
assert(html.indexOf('practice-session.js')<html.indexOf('structure-coach.js'));
const session=read('professional/practice-session.js');
assert(session.includes('hasCoachProgress(record)'),'coach activity must count as real progress');
assert(session.includes('structureCoachContext,saveStructureCoach'),'coach API is not exposed');
assert(session.includes("iso>='2026-11-11'"),'legacy simulated dates should retain original workflow');
for(const file of ['professional/structure-coach-model.js','professional/structure-coach.js',
  'professional/practice-session.js','professional/progress-calendar.js']){
  const check=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(check.status,0,file+' invalid JavaScript: '+check.stderr);
}
console.log('PASS structure coach: phase validation, real activity, legacy backup, scripts and UI integration');
