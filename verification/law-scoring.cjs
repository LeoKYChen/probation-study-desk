/* 申論評分參考：資料完整性與分數換算，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
for(const f of ['law-scoring/data.js','law-scoring/app.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w},{filename:f});
const D=w.LawScoringData,S=w.LawScoring;
assert(S&&typeof S.score==='function','app exposes the scoring function without a DOM');
const KINDS=['essay','case','proc','theory'];
// 各類科收錄的科目與最低題數；法律科目已核對現行法，學科待對照教材。
const COVER={'觀護人':{少年事件處理法:31,刑法:31,刑事訴訟法與保安處分執行法:31,犯罪學:31,心理學:31,諮商與輔導:31},
  '監獄官':{刑法與少年事件處理法:32,犯罪學與再犯預測:32,諮商與矯正輔導:32},
  '薦任升等（矯正）':{刑法:16,心理測驗:16,犯罪學:16,諮商與輔導:16},
  '犯罪防治人員預防組':{刑法與刑事訴訟法:31,心理學:32,犯罪學與犯罪預防:32,諮商與輔導:32},
  '心理測驗員、心理輔導員、家事調查官':{少年事件處理法:28,心理學:24},
  '監所管理員':{犯罪學概要:24}};
const LAW=['少年事件處理法','刑法','刑事訴訟法與保安處分執行法','刑法與少年事件處理法','刑法與刑事訴訟法'];
const ids=new Set(),bySubject={};
for(const q of D.questions){
  assert(!ids.has(q.id),'duplicate id '+q.id);ids.add(q.id);
  const key=q.examType+'／'+q.subject;bySubject[key]=(bySubject[key]||0)+1;
  assert(COVER[q.examType]&&COVER[q.examType][q.subject],q.id+' exam type and subject are covered');
  assert(['觀護','矯正','犯罪防治','司法'].includes(q.focus),q.id+' focus');
  assert(KINDS.includes(q.kind),q.id+' kind');
  for(const k of ['exam','subject','title','overview','body','check'])assert(typeof q[k]==='string'&&q[k].trim(),q.id+' missing '+k);
  assert(Number.isInteger(q.year)&&Number.isInteger(q.no),q.id+' year/no');
  assert.equal(q.checkOk,LAW.includes(q.subject),q.id+' law questions are checked against current law; theory ones await textbook review');
  assert(q.rows.length>=3&&q.organize.length&&q.pitfalls.length,q.id+' rows/organize/pitfalls');
  for(const r of q.rows){
    assert(r.point&&r.detail&&Array.isArray(r.articles)&&r.articles.length,q.id+' row fields');
    assert(typeof r.devNote==='string'&&typeof r.approved==='boolean',q.id+' developer fields');
  }
  // 只在真正有學說實務爭議時才標示 disputed；沒有爭議列時「不同見解」只看條文引用。
  if(q.kind==='case')for(const r of q.rows)assert(r.disputed===undefined||typeof r.disputed==='boolean',q.id+' disputed flag');
  const weights=S.weights(q);
  assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),100,q.id+' weights sum to 100');
  assert.equal(S.score(q,{checks:{},organize:{}}).total,0,q.id+' empty self-check scores 0');
  const checks={},organize={};
  q.rows.forEach((_,i)=>checks[i]=Object.fromEntries(S.COLS[q.kind].map(([k])=>[k,true])));
  q.organize.forEach((_,i)=>organize[i]=true);
  assert.equal(S.score(q,{checks,organize}).total,100,q.id+' full self-check scores 100');
}
for(const t in COVER)for(const s in COVER[t])assert(bySubject[t+'／'+s]>=COVER[t][s],'subject coverage '+t+'／'+s);
const html=fs.readFileSync(path.join(root,'law-scoring/index.html'),'utf8');
assert(html.includes('非官方評分')&&!html.includes('fonts.googleapis'),'disclaimer present and no external fonts for offline use');
console.log('PASS law-scoring: '+D.questions.length+' questions, '+Object.keys(bySubject).length+' subjects');
// 考古題練習頁的入口：已收錄的題目都能連到存在的評分要點，其他類科不顯示連結。
const r={};vm.runInNewContext(fs.readFileSync(path.join(root,'v2.5/ai-simple-review-v254.js'),'utf8'),{window:r,globalThis:r},{filename:'ai-simple-review-v254.js'});
const bank={};for(const f of ['v2.5/questions.js','v2.5/related-questions.js','police-exams/questions.approved.js','police-exams/approved-loader.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:bank,globalThis:bank},{filename:f});
const linked=[...bank.QUESTION_BANK,...bank.RELATED_QUESTION_BANK,...bank.POLICE_ORIGINAL_QUESTION_BANK].map(q=>[q,r.AISimpleReview254.scoringHref(q)]).filter(([,h])=>h);
assert.equal(linked.length,D.questions.length,'every scoring entry is linked from the practice page');
for(const [q,h] of linked)assert(ids.has(decodeURIComponent(h.split('#')[1]))&&h.startsWith('../law-scoring/#'),'link target exists '+q.id);
assert.equal(D.questions.length,553,'every essay question on the site has scoring points');
assert.equal(r.AISimpleReview254.scoringHref({id:'x',subject:'刑法',year:114,examType:'監所管理員'}),null,'subjects outside an exam type are not linked');
assert.equal(r.AISimpleReview254.scoringHref({id:'x',subject:'心理學',year:114,examType:'監獄官'}),null,'subjects outside an exam type are not linked');
assert.equal(r.AISimpleReview254.scoringHref({id:'x',subject:'刑法',year:114,examType:'律師'}),null,'unknown exam types are not linked');
assert(fs.readFileSync(path.join(root,'v2.5/index.html'),'utf8').includes('href="../law-scoring/"'),'practice page nav links the scoring page');
console.log('PASS law-scoring links: '+linked.length+' practice questions');
// 失分回想卡：只讀自評勾選，漏寫列成為卡片，依 1／3／7／14／30 天間隔複習。
vm.runInNewContext(fs.readFileSync(path.join(root,'law-scoring/review.js'),'utf8'),{window:w},{filename:'review.js'});
const RV=w.LawScoringReview,T='2026-10-28';
const theory=D.questions.find(q=>q.kind==='theory'),cq=D.questions.find(q=>q.kind==='case'&&q.rows.some(r=>!r.disputed)&&q.rows.some(r=>r.disputed));
assert.equal(Object.keys(RV.syncCards({[theory.id]:{answer:'x',unlocked:false,checks:{},organize:{}}},{},T)).length,0,'questions not yet unlocked make no cards');
let deck=RV.syncCards({[theory.id]:{unlocked:true,checks:{},organize:{}}},{},T);
assert.equal(Object.keys(deck).length,theory.rows.length,'every missed row becomes a card');
assert(Object.values(deck).every(c=>c.box===1&&c.due===T&&!c.mastered),'new cards are due today in box 1');
const full=Object.fromEntries(theory.rows.map((_,i)=>[i,{found:true,theory:true,practice:true}]));
assert.equal(Object.keys(RV.syncCards({[theory.id]:{unlocked:true,checks:full,organize:{}}},deck,T)).length,0,'unreviewed cards disappear once the row is fully checked');
const id0=theory.id+'#0';
let c=RV.rate(deck[id0],'good',T);assert.equal([c.box,c.due].join(),'2,2026-10-31','good moves up a box');
c=RV.rate(c,'again','2026-10-31');assert.equal([c.box,c.due].join(),'1,2026-11-01','again returns to box 1 for tomorrow');
c=RV.rate(c,'partial','2026-11-01');assert.equal([c.box,c.due].join(),'1,2026-11-02','partial keeps the box and repeats tomorrow');
assert.equal(RV.rate({...c,box:5},'good',T).mastered,true,'good in box 5 masters the card');
deck[id0]=c;
assert(id0 in RV.syncCards({[theory.id]:{unlocked:true,checks:full,organize:{}}},deck,T),'reviewed cards are kept after the row is checked');
assert.equal(RV.dueCards(deck,T).length,theory.rows.length-1,'only cards due today are drawn');
const caseFull=Object.fromEntries(cq.rows.map((r,i)=>[i,{found:true,apply:true}]));
const caseDeck=RV.syncCards({[cq.id]:{unlocked:true,checks:caseFull,organize:{}}},{},T);
assert.equal(JSON.stringify(Object.keys(caseDeck).sort()),JSON.stringify(cq.rows.map((r,i)=>r.disputed?cq.id+'#'+i:null).filter(Boolean).sort()),'case views are required only on disputed rows');
assert(Object.values(caseDeck).every(x=>x.missed.join()==='views'),'cards record which part was missed');
const st=RV.stats({[theory.id]:{unlocked:true,checks:{},organize:{}}});
assert.equal(st.gradedCount,1);assert.equal(st.total.issues.miss,theory.rows.length);assert.equal(st.total.views.all,0,'theory questions have no views column');
assert.equal(st.total.organize.miss,theory.organize.length);
const html2=fs.readFileSync(path.join(root,'law-scoring/review.html'),'utf8');
assert(html2.includes('review.js')&&html2.includes('非官方評分')&&!html2.includes('fonts.googleapis'),'review page loads its script offline');
console.log('PASS law-scoring review cards');
