// 首頁的 assets/schedule.js 必須和專業科目練習臺（professional/practice-session.js、professional/app.js）的每日安排一致。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..','..');
// 根目錄 package.json 是 type:module，.js 會被當 ESM；這裡用 vm 以瀏覽器方式載入
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'assets/schedule.js'),'utf8'),sandbox);
const home=sandbox.StudySchedule;
assert(home&&typeof home.subjectFor==='function','StudySchedule 未載入');
// 取出 professional 兩份程式裡的 subjectFor，用同一組日期比對
function extract(file){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const start=src.indexOf('const dayNumber');
  const end=src.indexOf('const SINGLE_SUBJECTS');
  assert(start>0&&end>start,'找不到 '+file+' 的排程程式');
  const ctx={};
  vm.createContext(ctx);
  vm.runInContext("const SUBJECTS=['','憲法與行政法','民法','民事訴訟法','刑法','刑事訴訟法','商事法'];"+src.slice(start,end)+";this.subjectFor=subjectFor;",ctx);
  return ctx.subjectFor;
}
const a=extract('professional/practice-session.js'),b=extract('professional/app.js');
let n=0;
for(let d=0;d<120;d++){
  const iso=new Date(Date.UTC(2026,8,1)+d*86400000).toISOString().slice(0,10);
  const h=home.subjectFor(iso);
  for(const f of [a,b]){const p=f(iso);assert.equal(h.label,p.label,iso+' label');assert.equal(h.target,p.target,iso+' target');assert.equal(h.sunday,p.sunday,iso+' sunday');}
  n++;
}
// 選試科目週：2026-11-07（週六）是四週一輪的第四週
assert.equal(home.subjectFor('2026-11-07').target,'智慧財產法');
console.log('PASS 首頁排程與專業科目練習臺一致（'+n+' 天，含週六四週輪替與選試科目）');
