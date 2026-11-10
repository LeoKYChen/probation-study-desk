/* 各科重點整理：資料完整性檢查，不需瀏覽器。 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),w={};
const run=f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w},{filename:f});
run('law-scoring/data.js'); run('law-scoring/summaries/index.js');
const S=w.LawScoringSummaries, ALL=new Set(w.LawScoringData.questions.map(q=>q.id));
const TOK=/(觀護|監獄|犯防|薦任|監所|家調)(\d{3})-(\d)/g;
const counted=new Map();
const SKELETON_REQUIRED=new Set(['criminal-law','criminal-procedure']); let skeletons=0;
assert(Array.isArray(S.list)&&S.list.length===6,'six subjects listed');
function texts(b,out){
  if(b.t==='p'||b.t==='h3') out.push(b.text);
  else if(b.t==='ul'||b.t==='ol') for(const it of b.items){ out.push(it.text); for(const s of it.sub||[]) texts(s,out); }
  else if(b.t==='table') for(const r of [b.head,...b.rows]) out.push(...r);
  else assert.equal(b.t,'chart','known block type '+b.t);
  return out;
}
for(const m of S.list){
  run('law-scoring/summaries/'+m.file);
  const d=S.items[m.slug];
  assert(d&&d.slug===m.slug,m.slug+' loaded');
  assert(d.sections.length>=5,m.slug+' sections');
  assert.equal(d.sections.filter(s=>s.blocks.some(b=>b.t==='chart')).length,1,m.slug+' has one ranking chart');
  const ids=new Set(d.sections.map(s=>s.id)); assert.equal(ids.size,d.sections.length,m.slug+' unique section ids');
  let total=0;
  for(const s of d.sections){
    assert(s.blocks.length,m.slug+' '+s.title+' has content');
    const all=s.blocks.flatMap(b=>texts(b,[]));
    for(const t of all){
      assert(!/待對照教材|請自行核對|<\/?[a-z]/i.test(t),m.slug+' no placeholders or raw HTML: '+t.slice(0,40));
      for(const k of t.matchAll(TOK)) assert(ALL.has(d.links[k[0]]),m.slug+' '+k[0]+' links to an existing question');
    }
    // 排行圖：只數「出題：」行，括號內的「另見」不算；每章題數要等於標題寫的題數。
    const seen=new Set();
    for(const b of s.blocks) if(b.t==='p'&&b.text.startsWith('出題：')) for(const k of b.text.replace(/（[^）]*）/g,'').matchAll(TOK)) seen.add(k[0]);
    if(s.count!=null){
      assert.equal(seen.size,s.count,m.slug+' '+s.title+' question count');
      const row=d.chart.find(r=>r.section===s.id); assert(row,m.slug+' chart row for '+s.title);
      assert.equal(row.guan+row.other,s.count,m.slug+' chart total for '+s.title);
      assert.equal(row.guan,[...seen].filter(t=>t.startsWith('觀護')).length,m.slug+' chart 觀護 count for '+s.title);
      total+=s.count;
      for(const t of seen){ const id=d.links[t]; assert(!counted.has(id),id+' counted once ('+m.slug+' and '+counted.get(id)+')'); counted.set(id,m.slug); }
    }
  }
  assert.equal(total,d.total,m.slug+' total'); assert.equal(m.total,d.total,m.slug+' index total');
  // 答題骨架：列在 SKELETON_REQUIRED 的科目，每個考點都要有且只有一行「**答題骨架**：A → B → C。」
  if(SKELETON_REQUIRED.has(m.slug)) for(const s of d.sections){
    if(s.count==null) continue;
    let cur=null; const groups=[];
    for(const b of s.blocks){ if(b.t==='h3'){ cur={title:b.text,lines:[]}; groups.push(cur); } else if(cur&&(b.t==='ul'||b.t==='ol')) for(const it of b.items) if(it.text.startsWith('**答題骨架**')) cur.lines.push(it.text); }
    for(const g of groups){
      assert.equal(g.lines.length,1,m.slug+' '+g.title+' has exactly one 答題骨架');
      assert(/^\*\*答題骨架\*\*：.+ → .+ → .+。$/.test(g.lines[0]),m.slug+' '+g.title+' skeleton has at least three steps');
      skeletons++;
    }
  }
}
// 六份合起來正好涵蓋網站 553 題，每題只歸一個主題。
assert.equal(counted.size,ALL.size,'every question appears in exactly one summary topic');
assert.equal(skeletons,41,'刑法 27 個、刑訴與保安處分 14 個考點都有答題骨架');
console.log('law-scoring summaries: '+S.list.length+' subjects, '+counted.size+' questions, '+skeletons+' required skeletons');
