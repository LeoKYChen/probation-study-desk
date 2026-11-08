/* 申論評分參考：資料完整性與分數換算，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
for(const f of ['law-scoring/data.js','law-scoring/exam-design/index.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w},{filename:f});
// 測試時一次載入所有分檔；頁面上則依科目按需載入。
const DESIGN_FILES=Object.values(w.LawScoringExamDesign.files);
for(const f of DESIGN_FILES)vm.runInNewContext(fs.readFileSync(path.join(root,'law-scoring/exam-design',f),'utf8'),{window:w},{filename:f});
vm.runInNewContext(fs.readFileSync(path.join(root,'law-scoring/app.js'),'utf8'),{window:w},{filename:'app.js'});
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
let deck=RV.syncCards({[theory.id]:{answer:'寫了答案',unlocked:true,checks:{},organize:{}}},{},T);
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
const st=RV.stats({[theory.id]:{answer:'寫了答案',unlocked:true,checks:{},organize:{}}});
assert.equal(st.gradedCount,1);assert.equal(st.total.issues.miss,theory.rows.length);assert.equal(st.total.views.all,0,'theory questions have no views column');
assert.equal(st.total.organize.miss,theory.organize.length);
const html2=fs.readFileSync(path.join(root,'law-scoring/review.html'),'utf8');
assert(html2.includes('review.js')&&html2.includes('非官方評分')&&!html2.includes('fonts.googleapis'),'review page loads its script offline');
assert.equal(RV.isGraded({answer:'',answerUrl:'',unlocked:true,checks:{0:{found:false}},organize:{}}),false,'peeking without answering or ticking is not counted');
assert.equal(RV.isGraded({answer:'',unlocked:true,checks:{0:{found:true}},organize:{}}),true,'answers written on paper count once a row is ticked');
assert.equal(RV.stats({[theory.id]:{unlocked:true,checks:{},organize:{}}}).gradedCount,0,'peeked questions stay out of the statistics');
const cleared=RV.clearQuestion({[theory.id]:{answer:'x',answerUrl:'https://a.b',unlocked:true,checks:full,organize:{0:true},devNotes:{0:'保留'},approved:{0:true}},keep:{answer:'y'}},deck,theory.id);
assert.equal(JSON.stringify([cleared.store[theory.id].answer,cleared.store[theory.id].answerUrl,cleared.store[theory.id].unlocked,cleared.store[theory.id].devNotes[0],cleared.store[theory.id].approved[0],cleared.store.keep.answer]),JSON.stringify(['','',false,'保留',true,'y']),'clearing resets one question and keeps developer notes and other questions');
assert.equal(Object.keys(cleared.cards).length,0,'clearing a question removes all of its cards, reviewed ones included');
const appSrc=fs.readFileSync(path.join(root,'law-scoring/app.js'),'utf8');
assert(!/disabled=n<50/.test(appSrc),'the scoring points open without a minimum answer length');
console.log('PASS law-scoring review cards');
// 命題者視角拆解：索引列出的每一科都要完整覆蓋該科全部題目；題幹要求在作答前顯示，命題結構與意圖在作答後且預設收合。
const ED=w.LawScoringExamDesign,QT={A:'個案題',B:'概念題',C:'理論＋應用',D:'案例題',E:'論述題',F:'爭議題'};
assert(ED&&ED.items&&ED.note.includes('非'),'exam design data loads with a non-official note');
assert(ED.version&&Object.keys(ED.files).length,'exam design index lists subject files');
let designTotal=0;
for(const [key,file] of Object.entries(ED.files)){
  assert(/^[a-z-]+\.js$/.test(file),key+' file name');
  const [type,subject]=key.split('／');
  const target=D.questions.filter(q=>q.examType===type&&q.subject===subject).map(q=>q.id).sort();
  const got=Object.keys(ED.items).filter(id=>{const q=D.questions.find(x=>x.id===id);return q&&q.examType===type&&q.subject===subject;}).sort();
  assert(target.length>0,key+' has questions');
  assert.equal(JSON.stringify(got),JSON.stringify(target),key+' exam design covers every question of the subject');
  assert.equal(S.designFile(D.questions.find(q=>q.id===target[0])),file,key+' file lookup');
  designTotal+=target.length;
}
assert.equal(Object.keys(ED.items).length,designTotal,'no exam design entry outside listed subjects');
const blockOk=(b,id)=>{assert(['p','ul','ol'].includes(b.t),id+' block type');const ts=b.t==='p'?[b.text]:b.items;assert(ts.length&&ts.every(t=>typeof t==='string'&&t.trim()&&!/[<>]/.test(t)&&(t.match(/\*\*/g)||[]).length%2===0),id+' block text is plain with balanced bold');};
for(const [id,d] of Object.entries(ED.items)){
  assert.equal(QT[d.qtype],d.qtypeLabel,id+' question type label');assert(typeof d.topic==='string'&&d.topic.trim(),id+' topic');
  for(const k of ['demands','structure','intent']){assert(Array.isArray(d[k])&&d[k].length,id+' '+k);d[k].forEach(b=>blockOk(b,id+' '+k));}
  const dem=S.blocksText(d.demands);
  assert(!/理論核對|法條核對|命題意圖|參考答案/.test(dem)&&!dem.includes('**'),id+' demands reveal no answer section and print as plain text');
  assert(/題幹可確認/.test(S.blocksText(d.intent))&&/合理推論/.test(S.blocksText(d.intent)),id+' intent separates confirmed abilities from inference');
  assert(/變化題/.test(S.blocksText(d.structure)),id+' structure includes a variant-question design');
  assert.equal(S.design(D.questions.find(q=>q.id===id)),d,id+' design lookup');
}
const PSY=['測驗與衡鑑','認知、記憶、智力','異常心理、治療、犯罪成因','發展與青少年','社會心理','情緒、壓力、成癮','人格'];
const psy=Object.entries(ED.items).filter(([id])=>/^1\d\d-心理學-\d$/.test(id));
assert.equal(psy.length,32,'probation psychology 108–115');
assert(psy.every(([,d])=>PSY.includes(d.topic)&&'ABC'.includes(d.qtype)),'psychology topics and types');
assert.equal(psy.filter(([,d])=>d.qtype==='A').length,2,'two pure case questions in psychology');
const noDesign=D.questions.find(q=>!S.designFile(q));
assert.equal(S.design(noDesign),null,'questions without a breakdown keep the original page');
const ih=fs.readFileSync(path.join(root,'law-scoring/index.html'),'utf8');
assert(ih.indexOf('exam-design/index.js')>0&&ih.indexOf('exam-design/index.js')<ih.indexOf('src="app.js"'),'exam design index loads before app.js');
assert(!/exam-design\/[a-z-]+\.js/.test(ih.replace('exam-design/index.js','')),'subject files are loaded on demand, not from the page');
assert(/<details class="design-details" id="intent-details">/.test(ih),'intent is collapsed by default');
assert(ih.indexOf('id="demands-sheet"')<ih.indexOf('id="ans-heading"')&&ih.indexOf('id="structure-sheet"')>ih.indexOf('id="graded"'),'demands before answering; structure and intent after unlocking');
for(const f of ['sw.js','offline-manifest.json']){const t=fs.readFileSync(path.join(root,f),'utf8');for(const x of ['index.js',...DESIGN_FILES])assert(t.includes('law-scoring/exam-design/'+x),f+' caches '+x);assert(!t.includes('law-scoring/exam-design.js'),f+' drops the old single file');}
assert.equal(fs.readdirSync(path.join(root,'law-scoring/exam-design')).sort().join(),['index.js',...DESIGN_FILES].sort().join(),'every file in exam-design is listed in the index');
assert.equal(Object.keys(ED.items).filter(id=>/^1\d\d-少年事件處理法-\d$/.test(id)).length,32,'probation juvenile law 108–115');
assert.equal(Object.keys(ED.items).filter(id=>/^1\d\d-刑法-\d$/.test(id)).length,31,'probation criminal law 108–115');
assert.equal(Object.keys(ED.items).filter(id=>/^1\d\d-刑事訴訟法與保安處分執行法-\d$/.test(id)).length,32,'probation criminal procedure 108–115');
assert.equal(Object.keys(ED.items).filter(id=>/^1\d\d-犯罪學-\d$/.test(id)).length,32,'probation criminology 108–115');
assert(Object.entries(ED.items).filter(([id])=>/^1\d\d-犯罪學-\d$/.test(id)).every(([,d])=>'ABC'.includes(d.qtype)),'criminology uses theory question types');
assert.equal(Object.keys(ED.items).filter(id=>/^1\d\d-諮商與輔導-\d$/.test(id)).length,31,'probation counseling 108–115');
assert.equal(Object.keys(ED.files).filter(k=>k.startsWith('觀護人／')).length,6,'all six probation subjects have breakdowns');
assert.equal(Object.keys(ED.items).filter(id=>/^監獄官-1\d\d-刑法與少年事件處理法-\d$/.test(id)).length,32,'prison officer criminal & juvenile law 108–115');
assert.equal(Object.keys(ED.items).filter(id=>/^監獄官-1\d\d-犯罪學與再犯預測-\d$/.test(id)).length,32,'prison officer criminology 108–115');
assert.equal(Object.keys(ED.items).filter(id=>/^監獄官-1\d\d-諮商與矯正輔導-\d$/.test(id)).length,32,'prison officer counseling 108–115');
assert.equal(Object.keys(ED.files).filter(k=>k.startsWith('監獄官／')).length,3,'all three prison officer subjects have breakdowns');
const LAWD=Object.entries(ED.items).filter(([id])=>LAW.includes(D.questions.find(q=>q.id===id).subject));
assert(LAWD.length>=95,'law subjects have breakdowns');
assert(LAWD.every(([,d])=>'DEF'.includes(d.qtype)&&/法條核對/.test(S.blocksText(d.intent))),'law questions use law types and verified-article sections');
assert(LAWD.every(([,d])=>!/請以條文|作答前請核對/.test(S.blocksText(d.intent))),'law breakdowns leave no unverified placeholders');
console.log('PASS law-scoring exam design: '+designTotal+' questions in '+DESIGN_FILES.length+' subject files');
