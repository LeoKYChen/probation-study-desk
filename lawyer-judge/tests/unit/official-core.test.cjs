// 評分要點共用計算：逐點項目、勾選統計、失分清單、骨架回想排程、弱點地圖。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..','..');
const mem={};const ctx={window:{},localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);}},Intl,Date,JSON,console};
ctx.window.localStorage=ctx.localStorage;vm.createContext(ctx);
for(const f of ['v2.5/official-points.js','v2.5/questions.js','mcq/bank.js','assets/official-points-core.js','assets/weakness.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const OP=ctx.window.OfficialPoints,P=ctx.window.OFFICIAL_POINTS,WM=ctx.window.WeaknessMap,bank=ctx.window.QUESTION_BANK;
const id1='lawplayer-112-criminal-law-procedure-1',id2='lawplayer-112-criminal-law-procedure-2';
// 項目切分（以 112 年刑法與刑訴為準：第 1 題 12 點、第 2 題 4 點）
const a=OP.items(P[id1]),b=OP.items(P[id2]);
assert.equal(a.items.length,12);assert.equal(b.items.length,4);
assert(a.items[0].title.startsWith('壹、甲的部分｜一、'));assert(a.items[11].title.startsWith('肆、'));
assert.equal(b.items.map(x=>x.title.slice(0,6)).join(),'第(一)子題,第(二)子題,第(二)子題,第(三)子題');
for(const it of [...a.items,...b.items])assert(it.body.length>0,'每一點都有說明：'+it.title);
// 每個收錄的題目都在題庫裡，而且文字沒有在切分時遺失
const ids=new Set(bank.map(q=>q.id));
const orphans=Object.keys(P).filter(id=>!ids.has(id));
assert.deepEqual(orphans,[1,2,3,4].map(n=>'lawplayer-114-海商法與海洋法-'+n),'只有 114 年海商法與海洋法（題庫沒有題目）可以對不到題庫');
const law=bank.filter(q=>q.subject!=='國文');assert.equal(law.filter(q=>!P[q.id]).length,0,'法律科目每一題都有評分要點');
for(const q of law)assert.equal(P[q.id].questionNo,q.questionNo,'題號與題庫一致：'+q.id);
assert.equal(bank.find(q=>q.id==='moex-112-constitutional-administrative-law-1').questionNo,1);
for(const [id,d] of Object.entries(P)){const r=OP.items(d);assert(r.items.length>=1&&r.items.length<=20,'點數合理：'+id+' '+r.items.length);
  const joined=[...r.intro,...r.items.flatMap(x=>[x.title.split('｜').pop(),...x.body])].join('')+OP.items({points:d.points.flatMap(p=>p.match(/^([壹貳參肆伍陸柒捌玖拾]、.{2,80}?)(一、.{0,40})$/)?[]:[])}).intro.join('');
  for(const p of d.points){const core=p.replace(/^第[（(][一二三四五六七八九十]+[）)]子題/,'');if(core.length>30)assert(joined.replace(/…/g,'').includes(core.replace(/…/g,'').slice(-12)),'段落遺失：'+id+' '+p.slice(0,30));}}
// 勾選、統計、失分清單
assert.equal(OP.score(id1,12),null);
OP.setMark(id1,0,'hit',12);OP.setMark(id1,1,'miss',12);OP.setMark(id1,5,'miss',12);OP.setMark(id2,0,'hit',4);
assert.deepEqual([OP.score(id1,12).hit,OP.score(id1,12).miss],[1,2]);
const missed=OP.missed(P,bank);assert.equal(missed.length,2);assert(missed.every(m=>m.id===id1&&m.question));
const stats=OP.bySubject(P);assert.equal(stats.length,1);assert.deepEqual([stats[0].hit,stats[0].miss,stats[0].questions],[2,2,2]);
OP.setMark(id1,1,null,12);assert.equal(OP.missed(P,bank).length,1,'取消勾選後不再列入');
// 骨架回想排程
const P2={[id1]:P[id1],[id2]:P[id2]};
let q=OP.queue(P2,'2026-11-10');assert.deepEqual([q.due.length,q.fresh.length],[0,2]);assert.equal(q.fresh[0],id1,'漏點多的題先出');
assert.equal(OP.rate(id1,'ok','2026-11-10').due,'2026-11-11');assert.equal(OP.rate(id1,'ok','2026-11-11').due,'2026-11-14');
assert.equal(OP.rate(id1,'ok','2026-11-14').due,'2026-11-21');assert.equal(OP.rate(id1,'ok','2026-11-21').due,'2026-12-05');
assert.equal(OP.rate(id1,'ok','2026-12-05').due,'2026-12-19','最長間隔 14 天');
assert.equal(OP.rate(id1,'again','2026-12-19').due,'2026-12-20','again 回到隔天');
assert.equal(OP.rate(id2,'easy','2026-11-10').due,'2026-11-13','easy 多跳一級');
q=OP.queue(P2,'2026-12-20');assert.equal(q.due.join(),[id2,id1].join());
// 弱點地圖
const mb=ctx.window.MCQ_BANK,rec={};
mb.filter(x=>x.subject==='民法'&&x.status!=='incomplete').slice(0,20).forEach((x,i)=>rec[x.id]={n:1,c:i<5?1:0});   // 25%
mb.filter(x=>x.subject==='刑法'&&x.status!=='incomplete').slice(0,20).forEach((x,i)=>rec[x.id]={n:1,c:i<18?1:0}); // 90%
mb.filter(x=>x.subject==='票據法'&&x.status!=='incomplete').slice(0,5).forEach(x=>rec[x.id]={n:1,c:0});            // 不足 10 次
const wm=WM.compute({mcqBank:mb,mcqRecords:rec,essayBank:bank,pointStats:OP.bySubject(P),selfStats:[]});
assert.equal(wm.ranked[0].name,'民法與民事訴訟法');assert.equal(Math.round(wm.ranked[0].mastery*100),25);
const crim=wm.ranked.find(r=>r.name==='刑法與刑事訴訟法');assert.equal(crim.parts.map(p=>p.kind).join(),'mcq,points');
assert(wm.untouched.some(r=>r.name==='票據法'),'作答未滿 10 次不排名');
assert(wm.ranked.every(r=>r.priority>=0)&&wm.ranked.every((r,i,a)=>!i||a[i-1].priority>=r.priority));
assert.equal(WM.compute({mcqBank:mb,mcqRecords:{},essayBank:bank}).ranked.length,0);
// 常見錯誤類型：每一類都要有原文支持，且段落確實含關鍵用語
vm.runInContext(fs.readFileSync(path.join(root,'assets/commentary-themes.js'),'utf8'),ctx);
const CT=ctx.window.CommentaryThemes,ct=CT.analyze(P);
assert.equal(ct.themes.length,9);assert(ct.total>=180);
for(const t of ct.themes){assert(t.questions>=8,'原文支持不足：'+t.name+' '+t.questions);const re=CT.THEMES.find(x=>x.id===t.id).re;assert(t.hits.every(x=>re.test(x.text)));}
assert(ct.themes.every((t,i,a)=>!i||a[i-1].questions>=t.questions),'依題數排序');
assert(CT.analyze(P,'財稅法').total<ct.total);
console.log('PASS 評分要點共用計算：項目切分、勾選統計、失分清單、骨架回想間隔、弱點地圖排序');
