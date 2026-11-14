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
// 失分類型：只用既有欄位；全錯 0%、全對 100%；樣本不到 3 次的類別不列；不改動紀錄
assert.equal(JSON.stringify(WK.LOSS_SLUGS),JSON.stringify(['criminal-law','criminal-procedure','juvenile']));
const L0=WK.lossTypes(d,{},byId); assert.equal(L0.graded,0); assert.equal(L0.enough,false); assert.equal(L0.items.length,0);
const ids3=[...new Set(Object.values(d.links))].slice(0,6);
const sOff={}, sOn={}; ids3.forEach(id=>{ sOff[id]=all(byId.get(id),false); sOn[id]=all(byId.get(id),true); });
const fz=JSON.stringify(sOff);
const Loff=WK.lossTypes(d,sOff,byId), Lon=WK.lossTypes(d,sOn,byId);
assert.equal(JSON.stringify(sOff),fz,'loss types do not modify records');
assert.equal(Loff.graded,6); assert(Loff.enough); assert(Loff.items.length>0,'some categories listed');
for(const x of Loff.items){ assert.equal(x.rate,0); assert.equal(x.hit,0); assert(x.total>=WK.MIN,'listed categories have enough samples'); assert(x.key!=='plain','baseline is not listed'); }
for(const x of Lon.items){ assert.equal(x.rate,100); assert.equal(x.hit,x.total); }
assert(Loff.items.some(x=>x.key.startsWith('org:')),'organize items are counted');
const rowsOf=ids3.flatMap(id=>byId.get(id).rows);
const dis=Loff.items.find(x=>x.key==='disputed'); if(rowsOf.filter(r=>r.disputed).length>=WK.MIN) assert.equal(dis.total,rowsOf.filter(r=>r.disputed).length,'disputed rows counted once each');
assert.equal(Loff.baseline.total,rowsOf.filter(r=>!r.disputed&&!/競合|罪數|併罰|定應執行/.test(r.point)).length);
// 一半有寫到：比例介於中間，且由低到高排序
const sMix={}; ids3.forEach((id,k)=>{ sMix[id]=all(byId.get(id),k%2===0); });
const Lm=WK.lossTypes(d,sMix,byId); for(let k=1;k<Lm.items.length;k++) assert(Lm.items[k-1].rate<=Lm.items[k].rate,'sorted from lowest rate');
// 只展開沒作答的題目不算
assert.equal(WK.lossTypes(d,peek,byId).graded,0);
// 限時表現：只算有限時紀錄的作答；至少 3 筆才列；已存檔的那一次不重複計；不改動紀錄
{
  const tid=[...new Set(Object.values(d.links))].slice(0,4), ts={};
  assert.equal(WK.timeStats(d,{}).items.length,0); assert.equal(WK.timeStats(d,{}).times,0);
  ts[tid[0]]={history:[{d:'2026-11-01',at:1,score:50,used:1700,limit:1800,steps:[2,4]},{d:'2026-11-09',at:2,score:70,used:2100,limit:1800,steps:[3,4]}]};
  ts[tid[1]]={history:[{d:'2026-11-02',at:3,score:60}]};                                  // 沒有限時紀錄，不算
  let T1=WK.timeStats(d,ts); assert.equal(T1.times,2); assert.equal(T1.items.find(x=>x.key==='time'),undefined,'少於 3 次不列用時'); const o1=T1.items.find(x=>x.key==='outline'); assert.equal(o1.hit,5); assert.equal(o1.total,8); assert.equal(o1.rate,63);
  ts[tid[2]]=Object.assign(all(byId.get(tid[2]),true),{timed:{t0:1000,t2:1000+2400*1000,limit:1800}});          // 已自評、未存檔：算一次，超時 600 秒
  const fzT=JSON.stringify(ts); T1=WK.timeStats(d,ts); assert.equal(JSON.stringify(ts),fzT,'timing stats do not modify records');
  const tm1=T1.items.find(x=>x.key==='time'); assert.equal(tm1.total,3); assert.equal(tm1.hit,1); assert.equal(tm1.rate,33); assert.equal(T1.avgOverMin,8,'(300+600)/2 秒 → 8 分鐘');
  ts[tid[2]].history=[{d:'2026-11-14',at:1000+2400*1000,score:80,used:2400,limit:1800}];                           // 同一次已存檔：不重複計
  assert.equal(WK.timeStats(d,ts).items.find(x=>x.key==='time').total,3);
  ts[tid[3]]={unlocked:false,timed:{t0:1,t2:5,limit:1800}}; assert.equal(WK.timeStats(d,ts).times,3,'沒自評的限時紀錄不算');
}
console.log('law-scoring weakness map: '+empty.chapters.length+' chapters checked');
