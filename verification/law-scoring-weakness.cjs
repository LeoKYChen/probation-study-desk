/* 弱點地圖：計算規則檢查，不需瀏覽器。用模擬的自評紀錄，確認掌握度、排序與只讀不寫。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const ctx={window:w,localStorage:{getItem(){throw new Error('compute must not touch storage');},setItem(){throw new Error('weakness map must never write');}}};
const run=f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
run('law-scoring/data.js'); run('law-scoring/app.js'); run('law-scoring/weakness.js'); run('law-scoring/summaries/index.js'); run('law-scoring/summaries/juvenile.js');
const WK=w.LawScoringWeakness, score=w.LawScoring.score, d=w.LawScoringSummaries.items.juvenile;
const byId=new Map(w.LawScoringData.questions.map(q=>[q.id,q]));
assert(!/setItem|removeItem|innerHTML/.test(fs.readFileSync(path.join(root,'law-scoring/weakness.js'),'utf8')),'weakness.js never writes storage or HTML');

// 全對與全錯的模擬作答
const all=(q,on)=>{ const cols=w.LawScoring.COLS[q.kind].map(c=>c[0]); return {unlocked:true,answer:'x',checks:Object.fromEntries(q.rows.map((_,i)=>[i,Object.fromEntries(cols.map(c=>[c,on]))])),organize:Object.fromEntries(q.organize.map((_,i)=>[i,on]))}; };

// 沒有紀錄：不排名，全部歸到還沒練，依加權出題數排序
const empty=WK.compute(d,{},byId,score);
assert.equal(empty.gradedTotal,0); assert.equal(empty.ranked.length,0);
assert.equal(empty.chapters.reduce((a,c)=>a+c.total,0),d.total,'chapters cover every question once');
assert(empty.untried.length&&empty.untried.length<=WK.TOP);
for(let i=1;i<empty.untried.length;i++) assert(empty.untried[i-1].weight>=empty.untried[i].weight,'untried sorted by weighted frequency');
for(const c of empty.chapters){ assert.equal(c.weight,WK.GUAN_W*c.guan+(c.total-c.guan),'觀護人 weighted'); assert.equal(c.todo.length,c.total); assert.equal(c.avg,null); }

// 只展開沒作答、沒勾選：不算已自評
const peek={}; const A=empty.chapters[0], B=empty.chapters[1];
peek[d.links[A.todo[0]]]={unlocked:true,answer:'',checks:{},organize:{}};
assert.equal(WK.compute(d,peek,byId,score).gradedTotal,0,'peeking is not grading');

// A 章三題全錯、B 章三題全對：A 排第一、B 因掌握 100% 不列入；低分題列在 A
const store={};
A.todo.slice(0,3).forEach(t=>{ const id=d.links[t]; store[id]=all(byId.get(id),false); });
B.todo.slice(0,3).forEach(t=>{ const id=d.links[t]; store[id]=all(byId.get(id),true); });
const frozen=JSON.stringify(store);
const r=WK.compute(d,store,byId,score);
assert.equal(JSON.stringify(store),frozen,'records are not modified');
const a=r.bySection[A.section], b=r.bySection[B.section];
assert.equal(a.done,Math.min(3,A.total)); assert.equal(a.avg,0); assert.equal(a.low.length,a.done); assert.equal(a.priority,a.weight);
assert.equal(b.avg,100); assert.equal(b.low.length,0); assert.equal(b.priority,0);
assert.equal(r.ranked[0].section,A.section); assert(!r.ranked.some(c=>c.section===B.section),'fully mastered chapter is not ranked');
assert(!r.untried.some(c=>c.section===A.section||c.section===B.section));
assert.equal(a.todo.length+a.done,a.total);

// 只練一題的章（題數 ≥3）不排名
const one={}; const C=empty.chapters.find(c=>c.total>=3); one[d.links[C.todo[0]]]=all(byId.get(d.links[C.todo[0]]),false);
const r1=WK.compute(d,one,byId,score);
assert.equal(r1.ranked.length,0); assert(r1.bySection[C.section].done===1&&!r1.bySection[C.section].enough);

// 壞掉的紀錄不會讓計算失敗
assert.doesNotThrow(()=>WK.compute(d,{[d.links[A.todo[0]]]:{unlocked:true,answer:'x'},junk:5,__current:'x'},byId,score));
console.log('law-scoring weakness map: '+empty.chapters.length+' chapters checked');
