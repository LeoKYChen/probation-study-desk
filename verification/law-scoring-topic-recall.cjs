/* 考點回想：卡片產生與排程規則檢查，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const ctx={window:w,localStorage:{getItem(){return null;},setItem(){throw new Error('pure functions must not write');}}};
const run=f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
['data.js','app.js','review.js','weakness.js','summaries/index.js','topic-recall.js'].forEach(f=>run('law-scoring/'+f));
const S=w.LawScoringSummaries, T=w.LawScoringTopicRecall, R=w.LawScoringReview, WK=w.LawScoringWeakness;
S.list.forEach(m=>run('law-scoring/summaries/'+m.file));
assert(!/lawScoring\.v2|innerHTML/.test(fs.readFileSync(path.join(root,'law-scoring/topic-recall.js'),'utf8').replace(/\/\*[\s\S]*?\*\//,'')),'topic recall never touches the scoring store directly');

// 每個考點（h3）都成為一張卡，id 不重複，都有內容與提示
const all=S.list.flatMap(m=>T.cardsOf(S.items[m.slug]));
const h3=S.list.reduce((a,m)=>a+S.items[m.slug].sections.filter(s=>s.count!=null).reduce((b,s)=>b+s.blocks.filter(x=>x.t==='h3').length,0),0);
assert.equal(all.length,h3,'one card per 考點'); assert(all.length>=150);
assert.equal(new Set(all.map(c=>c.id)).size,all.length,'card ids are unique');
for(const c of all){ assert(c.blocks.length&&c.hints.length,c.id+' has content and hints'); assert(!c.blocks.some(b=>b.t==='h3'||(b.t==='p'&&b.text===c.src)),c.id+' body excludes heading and source line'); }

// 新卡順序：弱點地圖排到的章最先
const byId=new Map(w.LawScoringData.questions.map(q=>[q.id,q])), d=S.items.juvenile;
const fill=(q,on)=>{ const cols=w.LawScoring.COLS[q.kind].map(c=>c[0]); return {unlocked:true,answer:'x',checks:Object.fromEntries(q.rows.map((_,i)=>[i,Object.fromEntries(cols.map(c=>[c,on]))])),organize:Object.fromEntries(q.organize.map((_,i)=>[i,on]))}; };
const chap=d.sections.filter(s=>s.count!=null), weakChap=chap[chap.length-1], store={};
WK.chapterTokens(weakChap).slice(0,3).forEach(t=>{ store[d.links[t]]=fill(byId.get(d.links[t]),false); });
const weak=Object.fromEntries(S.list.map(m=>[m.slug,WK.compute(S.items[m.slug],store,byId,w.LawScoring.score)]));
const ordered=T.orderNew(all,S.items,weak);
assert.equal(ordered.length,all.length); assert.equal(ordered[0].slug,'juvenile'); assert.equal(ordered[0].section,weakChap.id,'weak chapter comes first');
const firstChap=ordered.filter(c=>c.slug==='juvenile'&&c.section===weakChap.id); for(let i=1;i<firstChap.length;i++) assert(firstChap[i-1].guan>=firstChap[i].guan,'觀護人考過的考點先出');
assert.equal(T.orderNew(all,S.items,null).length,all.length,'ordering works without weakness data');

// 排程：每天最多 5 張新卡；到期舊卡全部出；可加開；科目篩選；已熟練不出
const today='2026-11-10'; let st={cards:{},subjects:null};
let q=T.queue(st,ordered,today,0);
assert.equal(q.due.length,0); assert.equal(q.fresh.length,T.NEW_PER_DAY); assert.equal(q.unseen,all.length);
const frozen=JSON.stringify(st); const st1=T.rateCard(st,q.fresh[0].id,'good',today,R.rate); assert.equal(JSON.stringify(st),frozen,'state is not mutated');
assert.deepEqual({box:st1.cards[q.fresh[0].id].box,due:st1.cards[q.fresh[0].id].due,added:today},{box:2,due:'2026-11-13',added:today});
st=st1; for(const c of q.fresh.slice(1)) st=T.rateCard(st,c.id,'again',today,R.rate);
q=T.queue(st,ordered,today,0); assert.equal(q.fresh.length,0,'daily cap reached'); assert.equal(q.due.length,0); assert.equal(q.addedToday,5);
assert.equal(T.queue(st,ordered,today,5).fresh.length,5,'extra cards on request');
q=T.queue(st,ordered,'2026-11-11',0); assert.equal(q.due.length,4,'cards rated again are due tomorrow'); assert.equal(q.fresh.length,5);
q=T.queue(st,ordered,'2026-11-13',0); assert.equal(q.due.length,5);
let m=st; const id=ordered[0].id; m={cards:{[id]:{box:5,due:today,added:'2026-10-01',reviews:[],mastered:false}},subjects:null}; m=T.rateCard(m,id,'good',today,R.rate);
assert(m.cards[id].mastered); assert.equal(T.queue(m,ordered,'2027-01-01',0).due.length,0,'mastered cards never return'); assert.equal(T.queue(m,ordered,today,0).mastered,1);
q=T.queue({cards:{},subjects:['psychology']},ordered,today,0); assert(q.fresh.every(c=>c.slug==='psychology')); assert.equal(q.unseen,all.filter(c=>c.slug==='psychology').length);
// 重點整理改版後已不存在的卡：不出題、紀錄保留
q=T.queue({cards:{'juvenile|已刪除的考點':{box:1,due:today,added:'2026-11-01',reviews:[],mastered:false}},subjects:null},ordered,today,0); assert.equal(q.due.length,0); assert.equal(q.reviewing,1);
assert.deepEqual(JSON.parse(JSON.stringify(T.readState())),{cards:{},subjects:null,tab:'miss'});
// 儲存格式：最上層是卡片紀錄，設定在 __ 開頭的鍵；壞資料不會進到卡片
const packed=T.pack({cards:st.cards,subjects:['psychology'],tab:'topic'});
assert.deepEqual(Object.keys(packed).filter(k=>!k.startsWith('__')).sort(),Object.keys(st.cards).sort());
assert.deepEqual(JSON.parse(JSON.stringify(T.unpack(Object.assign({junk:5,other:{x:1}},packed)))),JSON.parse(JSON.stringify({cards:st.cards,subjects:['psychology'],tab:'topic'})));
assert(/lawScoring\.topicRecall\.v1/.test(fs.readFileSync(path.join(root,'backup/unified-core.js'),'utf8'))&&/lawScoring\.topicRecall\.v1/.test(fs.readFileSync(path.join(root,'backup/app.js'),'utf8')),'backup includes topic recall');
console.log('law-scoring topic recall: '+all.length+' cards checked');
