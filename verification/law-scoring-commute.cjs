/* 通勤模式與理論卡：卡片產生、排程、上次位置與頁面接線檢查，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const ctx={window:w,localStorage:{getItem(){return null;},setItem(){throw new Error('pure functions must not write');}}};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const run=f=>vm.runInNewContext(read(f),ctx,{filename:f});
['data.js','app.js','review.js','weakness.js','summaries/index.js','topic-recall.js','theory-cards.js','commute.js'].forEach(f=>run('law-scoring/'+f));
const S=w.LawScoringSummaries,T=w.LawScoringTopicRecall,TH=w.LawScoringTheoryCards,R=w.LawScoringReview,C=w.LawScoringCommute;
S.list.forEach(m=>run('law-scoring/summaries/'+m.file));
const code=f=>read(f).replace(/\/\*[\s\S]*?\*\//g,'');
assert(!/innerHTML/.test(code('law-scoring/commute.js')+code('law-scoring/theory-cards.js')),'content is built with DOM nodes only');
assert(!/lawScoring\.v2/.test(code('law-scoring/commute.js')+code('law-scoring/theory-cards.js')),'the scoring store is never named, so it cannot be written');

// 要點卡（原理論卡）：六科每個有粗體標題的條列項目一張卡，id 不重複，內容原樣取自重點整理
assert.deepEqual([...TH.SUBJECTS],['criminology','psychology','counseling','criminal-law','criminal-procedure','juvenile']);
const all=TH.SUBJECTS.flatMap(s=>TH.cardsOf(S.items[s]));
const expected=TH.SUBJECTS.reduce((a,s)=>a+S.items[s].sections.filter(x=>x.count!=null).reduce((b,x)=>b+x.blocks.filter(k=>k.t==='ul'||k.t==='ol').reduce((c,k)=>c+k.items.filter(it=>/^\*\*[^*]+\*\*/.test(it.text)).length,0),0),0);
assert.equal(all.length,expected,'one card per labelled bullet'); assert(all.length>=400);
assert.equal(new Set(all.map(c=>c.id)).size,all.length,'card ids are unique');
// 法律三科也產生卡片；答題骨架各成一張卡（三科共 72 張）；原有三科的卡排在前面、順序不變
const LAW3=['criminal-law','criminal-procedure','juvenile'];
for(const sl of LAW3) assert(all.some(c=>c.slug===sl),sl+' has point cards');
assert.equal(all.filter(c=>LAW3.includes(c.slug)&&c.label==='答題骨架').length,72,'every law skeleton is a card');
const firstLaw=all.findIndex(c=>LAW3.includes(c.slug)); assert(all.slice(0,firstLaw).every(c=>!LAW3.includes(c.slug))&&all.slice(firstLaw).every(c=>LAW3.includes(c.slug)),'theory subjects come first');
assert(firstLaw>=400,'the original theory cards are all still there');
// 範圍設定：只練法律三科時，新卡只出法律科；設定存在 __subjects，不動卡片紀錄
{ const lawOnly=TH.unpack({'__subjects':LAW3}); assert.deepEqual([...lawOnly.subjects],LAW3);
  const ql=T.queue(lawOnly,T.orderNew(all,S.items,null),'2026-11-11',TH.NEW_PER_DAY-T.NEW_PER_DAY); assert.equal(ql.fresh.length,10); assert(ql.fresh.every(c=>LAW3.includes(c.slug)),'law scope shows only law cards');
  assert.equal(JSON.stringify(TH.pack(lawOnly)),JSON.stringify({__subjects:LAW3})); }
const cmHtml=fs.readFileSync(path.join(root,'law-scoring/commute.html'),'utf8'); for(const k of ['all','theory','law']) assert(cmHtml.includes('data-scope="'+k+'"'),'scope button '+k);
for(const c of all){
  assert(c.label&&c.chapter&&c.item&&c.item.text.startsWith('**'+c.label),c.id+' keeps the original bullet');
  const sec=S.items[c.slug].sections.find(x=>x.id===c.section); assert(sec&&sec.count!=null,c.id+' belongs to a real chapter');
  assert(sec.blocks.some(b=>(b.t==='ul'||b.t==='ol')&&b.items.includes(c.item)),c.id+' is the same object as in the summary');
  if(c.topic) assert(sec.blocks.some(b=>b.t==='h3'&&b.text===c.topic),c.id+' topic is a real heading');
}
assert(all.some(c=>c.guan>0)&&all.some(c=>!c.topic),'covers both headed and heading-less chapters');
const again=TH.SUBJECTS.flatMap(s=>TH.cardsOf(S.items[s])); assert.deepEqual(again.map(c=>c.id),all.map(c=>c.id),'ids are stable between runs');

// 排程沿用考點回想：每天 10 張新卡、到期舊卡全部出、可加開、熟練不出
const bonus=TH.NEW_PER_DAY-T.NEW_PER_DAY, ordered=T.orderNew(all,S.items,null), day='2026-11-10';
assert.equal(ordered.length,all.length);
let st=TH.unpack(null); assert.deepEqual(Object.keys(st.cards),[]); assert.equal(st.subjects,null);
let q=T.queue(st,ordered,day,bonus); assert.equal(q.fresh.length,10); assert.equal(q.due.length,0); assert.equal(q.unseen,all.length);
st=T.rateCard(st,q.fresh[0].id,'good',day,R.rate); st=T.rateCard(st,q.fresh[1].id,'again',day,R.rate);
q=T.queue(st,ordered,day,bonus); assert.equal(q.fresh.length,8,'rated new cards use up today\'s allowance'); assert.equal(q.due.length,0);
assert.equal(T.queue(st,ordered,day,bonus+10).fresh.length,18,'more new cards on request');
q=T.queue(st,ordered,'2026-11-11',bonus); assert.equal(q.due.length,1,'only the failed card is due the next day'); assert.equal(q.fresh.length,10);
assert.equal(T.queue(st,ordered,'2026-11-13',bonus).due.length,2,'the remembered card comes back after three days');
const packed=TH.pack(st); assert.deepEqual(Object.keys(packed).sort(),Object.keys(st.cards).sort(),'storage is a plain id → record map');
assert.deepEqual(JSON.parse(JSON.stringify(TH.unpack(JSON.parse(JSON.stringify(packed))).cards)),JSON.parse(JSON.stringify(st.cards)),'round trip keeps every record');
assert.deepEqual(Object.keys(TH.unpack({'x|y|z':{due:1},'__subjects':['criminology','nope'],bad:null}).cards),[],'malformed records are ignored');
assert.deepEqual([...TH.unpack({'__subjects':['criminology','nope']}).subjects],['criminology']);
let m=st; for(let i=0;i<5;i++) m=T.rateCard(m,ordered[0].id,'good','2026-12-0'+(i+1),R.rate);
assert(m.cards[ordered[0].id].mastered); assert(!T.queue(m,ordered,'2027-06-01',bonus).due.some(c=>c.id===ordered[0].id),'mastered cards never return');

// 上次位置：格式不對就退回預設值
assert.deepEqual({...C.normalize(null)},{deck:'',id:'',stage:'front',font:1,at:''});
assert.deepEqual({...C.normalize({deck:'theory',id:'a',stage:'back',font:3,at:'t'})},{deck:'theory',id:'a',stage:'back',font:3,at:'t'});
assert.deepEqual({...C.normalize({deck:'nope',id:5,stage:'x',font:9,at:1})},{deck:'',id:'',stage:'front',font:1,at:''});
assert.deepEqual({...C.normalize([1,2])},{deck:'',id:'',stage:'front',font:1,at:''});
// 點卡片的翻面順序
assert.equal(C.nextStage('front',true),'hints'); assert.equal(C.nextStage('front',false),'back'); assert.equal(C.nextStage('hints',true),'back');
// 今天的順序：跳過的排最後（依跳過先後），上次停在的那張排最前
const L=['a','b','c','d'].map(id=>({id})), ids=x=>x.map(i=>i.id).join('');
assert.equal(ids(C.arrange(L,[],'')),'abcd'); assert.equal(ids(C.arrange(L,['a'],'')),'bcda'); assert.equal(ids(C.arrange(L,['b','a'],'')),'cdba');
assert.equal(ids(C.arrange(L,[],'c')),'cabd'); assert.equal(ids(C.arrange(L,['a'],'zzz')),'bcda'); assert.equal(ids(C.arrange(L,['gone'],'')),'abcd');
assert.equal(C.arrange(L,['a'],'a')[0].id,'a','a resumed card is shown even if it was skipped');

// 頁面接線：通勤頁載入所需模組；四個頁面的主導覽一致；離線清單、線上優先清單與完整備份都有登記
const html=read('law-scoring/commute.html');
for(const f of ['data.js','app.js','review.js','weakness.js','summaries/index.js','summaries.js','topic-recall.js','theory-cards.js','commute.js','commute.css',...S.list.map(x=>'summaries/'+x.file)]) assert(html.includes('"'+f+'"'),'commute.html loads '+f);
const order=f=>html.indexOf('"'+f+'"'); assert(order('review.js')<order('topic-recall.js')&&order('topic-recall.js')<order('theory-cards.js')&&order('theory-cards.js')<order('commute.js')&&order('summaries.js')<order('commute.js'),'modules load before commute.js');
for(const id of ['commute-root','cm-card','cm-title','cm-context','cm-sub','cm-hints','cm-back','cm-content','cm-empty','cm-bar','cm-reveal','cm-hint','cm-undo','cm-skip','cm-rate3','cm-status','cm-font-up','cm-font-down',...C.DECKS.map(k=>'cm-count-'+k)]) assert(html.includes('id="'+id+'"'),'commute.html has #'+id);
assert.equal((html.match(/data-deck="/g)||[]).length,C.DECKS.length); assert(!/<textarea|<input/.test(html),'no typing needed'); assert(!/english|psd-staresto/i.test(html+code('law-scoring/commute.js')),'the English records are not touched from this page');
const nav=f=>/<nav class="nav-five" aria-label="主要導覽">(.*?)<\/nav>/.exec(read('law-scoring/'+f))[1].replace(/ aria-current="page"/,'');
const navs=['index.html','summaries.html','review.html','commute.html'].map(nav); assert(navs.every(n=>n===navs[0])&&navs[0].includes('href="commute.html"'),'same five-item nav on every page');
const manifest=new Set(JSON.parse(read('offline-manifest.json')).assets.map(a=>a.url)), sw=read('sw.js');
for(const f of ['law-scoring/commute.html','law-scoring/commute.js','law-scoring/commute.css','law-scoring/theory-cards.js']){ assert(manifest.has(f),'offline manifest has '+f); assert(sw.includes("'"+f+"'"),'service worker fetches '+f+' network-first'); }
assert(read('backup/unified-core.js').includes("key:'"+TH.KEY+"'")&&read('backup/app.js').includes("'"+TH.KEY+"'"),'theory card records are in the full backup');
assert.equal(R.COL_LABEL.found,'有寫到'); assert.equal(R.CARD_KEY,'lawScoring.recall.v1');
console.log('PASS law-scoring commute: '+all.length+' theory cards, scheduling, resume position and page wiring');

// 今日清單（申論評分參考最上方）：純計算、不寫入；沒有紀錄時也給得出建議新題；二刷只列到期的題目
{
  const LS=w.LawScoring, DATA=w.LawScoringData, WK=w.LawScoringWeakness, today='2026-11-14';
  const env=(store,extra)=>Object.assign({store,cardStore:{},today,data:DATA,summaries:S,R,TR:T,TH,WK,score:LS.score,topicState:T.unpack({}),theoryState:TH.unpack({})},extra||{});
  const p0=LS.todayPlan(env({}));
  assert.equal(p0.miss,0); assert.equal(p0.topic.due,0); assert.equal(p0.topic.fresh,T.NEW_PER_DAY); assert.equal(p0.theory.fresh,TH.NEW_PER_DAY); assert.equal(p0.redo.length,0);
  assert(p0.next&&DATA.questions.some(q=>q.id===p0.next.id),'suggests a question even with no records'); assert(p0.next.token.startsWith('觀護'),'prefers a 觀護人 question'); assert.equal(p0.next.why,'常考但還沒練夠的章');
  // 二刷：到期才列；80 分以上不列；依到期日排序；仍在自評中的題目也列
  const qs=DATA.questions.slice(0,4), store={};
  store[qs[0].id]={history:[{d:'2026-11-01',score:40}]};            // 11/08 到期
  store[qs[1].id]={history:[{d:'2026-11-10',score:40}]};            // 11/17 還沒到
  store[qs[2].id]={history:[{d:'2026-10-20',score:70}]};            // 11/03 到期
  store[qs[3].id]={history:[{d:'2026-10-01',score:90}]};            // 不排
  const fz=JSON.stringify(store), p1=LS.todayPlan(env(store));
  assert.equal(JSON.stringify(store),fz,'today plan does not modify records');
  assert.equal(JSON.stringify(p1.redo.map(r=>r.id)),JSON.stringify([qs[2].id,qs[0].id])); assert.equal(p1.redo[0].score,70);
  assert(p1.next&&!store[p1.next.id],'does not suggest a question that already has attempt history');
  // 已有作答歷程的題目不會被當成建議新題
  const s2={}; s2[p0.next.id]={history:[{d:'2026-11-13',score:85}]}; assert.notEqual(LS.todayPlan(env(s2)).next.id,p0.next.id);
  // 少了某個模組時該列回傳 null，其餘照常
  const p3=LS.todayPlan(env({}, {R:null})); assert.equal(p3.miss,null); assert(p3.topic&&p3.next);
  const page=read('law-scoring/index.html'); for(const id of ['today','today-list','today-status']) assert(page.includes('id="'+id+'"'),'page has #'+id);
  console.log('PASS law-scoring today list');
}
