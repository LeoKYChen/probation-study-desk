/* 各科重點整理：依科目按需載入 summaries/ 的資料檔，用 DOM 組出內容（不使用 innerHTML）。只記住最後看的科目。
   弱點地圖（weakness.js）：讀取申論評分參考的自評紀錄算出各章掌握度，只讀不寫。 */
(function () {
'use strict';
const S = window.LawScoringSummaries;
const $ = id => document.getElementById(id);
const KEY = 'lawScoring.summaries.v1';
const TOK = /(觀護|監獄|犯防|薦任|監所|家調)(\d{3})-(\d)/g;
// 考點回想（topic-recall.js）共用同一套內容繪製。
window.LawScoringSummaryRender = {renderBlocks, linkify};
if (!S || !$('sum-root')) return;
const LIST = S.list || [];
const loading = {};
let current = null;
// 弱點地圖需要題庫與計分函式；任何一項沒載入就整個不顯示，重點整理照常可用。
const WK = window.LawScoringWeakness, DATA = window.LawScoringData, SCORER = window.LawScoring && window.LawScoring.score;
const BY_ID = WK && DATA && SCORER ? new Map(DATA.questions.map(q=>[q.id,q])) : null;
let weak = null, weakRaw = '', loss = null;
function computeWeak(d){ if(!BY_ID){ weak=null; return; } weakRaw=WK.rawStore(); const st=WK.readStore(); try { weak=WK.compute(d, st, BY_ID, SCORER); } catch (e) { weak=null; } try { loss=WK.LOSS_SLUGS.includes(d.slug)?WK.lossTypes(d, st, BY_ID):null; } catch (e) { loss=null; } }
const practised = c => '已練 '+c.done+'／'+c.total+' 題';

function el(tag, attrs, text){ const n=document.createElement(tag); for(const k in (attrs||{})){ if(k==='class') n.className=attrs[k]; else n.setAttribute(k,attrs[k]); } if(text!=null) n.textContent=text; return n; }
function say(t){ $('sum-status').textContent=t; }
function remember(slug){ try { localStorage.setItem(KEY, slug); } catch (e) {} }
function recalled(){ try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
const meta = slug => LIST.find(x=>x.slug===slug);

// 題號（觀護112-3 等）轉成回到申論評分參考的連結；找不到對應題目時維持文字。
function linkify(parent, text, links){
  let last=0; TOK.lastIndex=0; let m;
  while((m=TOK.exec(text))){
    if(m.index>last) parent.appendChild(document.createTextNode(text.slice(last,m.index)));
    const id=links[m[0]];
    if(id){ const a=el('a',{href:'./#'+encodeURIComponent(id),class:'qref'+(m[1]==='觀護'?' guan':''),title:'到申論評分參考作答'},m[0]); parent.appendChild(a); }
    else parent.appendChild(document.createTextNode(m[0]));
    last=m.index+m[0].length;
  }
  if(last<text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}
// 只把 **…** 轉成粗體，其餘一律當文字。
function inline(parent, text, links){
  String(text).split(/\*\*/).forEach((part,i)=>{ if(!part) return; const host=i%2?parent.appendChild(el('strong')):parent; linkify(host,part,links); });
  return parent;
}

function renderChart(d){
  const box=el('figure',{class:'sum-chart'});
  const cap=el('figcaption');
  const guanTotal=d.chart.reduce((s,r)=>s+r.guan,0);
  cap.appendChild(el('strong',null,'各主題出題數'));
  cap.appendChild(document.createTextNode('：共 '+d.total+' 題，其中觀護人 '+guanTotal+' 題。點主題可跳到該節。'));
  const legend=el('p',{class:'sum-legend'});
  legend.appendChild(el('span',{class:'key guan','aria-hidden':'true'}));
  legend.appendChild(document.createTextNode('觀護人'));
  legend.appendChild(el('span',{class:'key other','aria-hidden':'true'}));
  legend.appendChild(document.createTextNode('其他類科'));
  box.appendChild(cap); box.appendChild(legend);
  const max=Math.max(1,...d.chart.map(r=>r.guan+r.other));
  const ol=el('ol',{class:'sum-bars'});
  d.chart.forEach(r=>{
    const li=el('li');
    const a=el('a',{href:'#'+d.slug+'/'+r.section,'data-section':r.section});
    a.appendChild(el('span',{class:'label'},r.theme));
    const track=el('span',{class:'track','aria-hidden':'true'});
    const g=el('span',{class:'fill guan'}); g.style.width=(r.guan/max*100)+'%';
    const o=el('span',{class:'fill other'}); o.style.width=(r.other/max*100)+'%';
    track.appendChild(g); track.appendChild(o);
    a.appendChild(track);
    a.appendChild(el('span',{class:'num'},(r.guan+r.other)+' 題（觀護 '+r.guan+'）'));
    const c=weak&&weak.gradedTotal?weak.bySection[r.section]:null;
    if(c){
      const m=el('span',{class:'mastery'});
      const bar=el('span',{class:'mbar','aria-hidden':'true'}); const fill=el('span',{class:'mfill'+(c.avg!=null&&c.avg<WK.LOW?' low':'')}); fill.style.width=(c.enough?c.avg:0)+'%'; bar.appendChild(fill);
      m.appendChild(bar);
      m.appendChild(el('span',{class:'mtext'},c.enough?'掌握度 '+c.avg+'%・'+practised(c):(c.done?practised(c)+'，還不夠算掌握度':'還沒練')));
      a.appendChild(m);
    }
    li.appendChild(a); ol.appendChild(li);
  });
  box.appendChild(ol);
  return box;
}

function renderBlocks(target, blocks, d){
  blocks.forEach(b=>{
    if(b.t==='p'){ const p=inline(el('p',b.text.startsWith('出題：')?{class:'sum-src'}:null),b.text,d.links); target.appendChild(p); return; }
    if(b.t==='h3'){ target.appendChild(inline(el('h3'),b.text,d.links)); return; }
    if(b.t==='chart'){ target.appendChild(renderChart(d)); return; }
    if(b.t==='table'){
      const wrap=el('div',{class:'table-scroll'}); const t=el('table',{class:'sum-table'});
      const th=el('thead'); const hr=el('tr'); b.head.forEach(h=>hr.appendChild(inline(el('th',{scope:'col'}),h,d.links))); th.appendChild(hr); t.appendChild(th);
      const tb=el('tbody');
      b.rows.forEach(r=>{ const tr=el('tr'); r.forEach((c,i)=>{ const td=el('td',{'data-label':b.head[i]||''}); inline(td,c,d.links); tr.appendChild(td); }); tb.appendChild(tr); });
      t.appendChild(tb); wrap.appendChild(t); target.appendChild(wrap); return;
    }
    if(b.t==='ul'||b.t==='ol'){
      const list=el(b.t);
      b.items.forEach(it=>{ const li=inline(el('li'),it.text,d.links); if(it.sub) renderBlocks(li,it.sub,d); list.appendChild(li); });
      target.appendChild(list);
    }
  });
}

// 每章開頭的練習狀況：還沒練與低分的題目，可直接點去作答。
function tokenList(tokens, d, suffix){
  const ul=el('ul',{class:'sum-qlist'});
  tokens.forEach(t=>{ const tok=typeof t==='string'?t:t.token; const li=el('li'); linkify(li,tok,d.links); if(suffix&&t.score!=null) li.appendChild(document.createTextNode('（'+t.score+' 分）')); ul.appendChild(li); });
  return ul;
}
function renderPractice(c, d){
  const box=el('details',{class:'sum-practice'});
  box.appendChild(el('summary',null,'練習狀況：'+practised(c)+(c.done?'，平均 '+c.avg+' 分':'')));
  if(c.low.length){ box.appendChild(el('p',{class:'sum-plabel'},'低於 '+WK.LOW+' 分（'+c.low.length+' 題）')); box.appendChild(tokenList(c.low,d,true)); }
  if(c.todo.length){ box.appendChild(el('p',{class:'sum-plabel'},'還沒練（'+c.todo.length+' 題）')); box.appendChild(tokenList(c.todo,d,false)); }
  if(!c.low.length&&!c.todo.length) box.appendChild(el('p',{class:'sum-plabel'},'這一章的題目都練過，而且都在 '+WK.LOW+' 分以上。'));
  return box;
}
function chapterLink(d, c){ return el('a',{href:'#'+d.slug+'/'+c.section,'data-section':c.section},c.title); }
// 失分類型：這一科已自評的題目裡，哪一類要點最常沒寫到（只在刑法、刑訴、少事法顯示）。
function renderLoss(box){
  if(!loss) return;
  box.appendChild(el('h3',null,'失分類型'));
  if(!loss.enough){ box.appendChild(el('p',null,'這一科至少自評 '+WK.MIN+' 題後，這裡會列出最常沒寫到的要點類型。')); return; }
  if(!loss.items.length){ box.appendChild(el('p',null,'目前各類要點的樣本都不到 '+WK.MIN+' 次，還列不出來。')); return; }
  const ul=el('ul',{class:'sum-weak-list sum-loss-list'});
  loss.items.forEach(x=>{ const li=el('li'); li.appendChild(el('span',{class:'name'},x.label)); li.appendChild(el('span',{class:'detail'},'做到 '+x.hit+'／'+x.total+'（'+x.rate+'%）')); ul.appendChild(li); });
  box.appendChild(ul);
  const base=loss.baseline&&loss.baseline.total>=WK.MIN?'對照：其他要點做到 '+loss.baseline.rate+'%。':'';
  box.appendChild(el('p',{class:'small muted'},'由低到高排列，比例越低越需要注意。'+base+'只統計這一科已自評的 '+loss.graded+' 題；同一類至少出現 '+WK.MIN+' 次才列出。依你勾選的「有寫到」、「並陳見解」與答題組織計算，紀錄只讀取。'));
}
function renderWeak(d){
  const box=$('sum-weak'); box.textContent='';
  if(!weak){ box.hidden=true; return; }
  box.hidden=false;
  box.appendChild(el('h2',{id:'sum-weak-h'},'優先複習'));
  if(!weak.gradedTotal){
    box.appendChild(el('p',null,'這一科還沒有自評紀錄。到申論評分參考作答並勾選評分要點後，這裡會排出常考又失分的主題。'));
    const top=d.chart[0]&&weak.bySection[d.chart[0].section];
    if(top){ const p=el('p',null,'可以從最常考的主題開始：'); p.appendChild(chapterLink(d,top)); box.appendChild(p); }
    return;
  }
  if(weak.ranked.length){
    const ol=el('ol',{class:'sum-weak-list'});
    weak.ranked.forEach(c=>{ const li=el('li'); li.appendChild(chapterLink(d,c)); li.appendChild(el('span',{class:'detail'},'掌握度 '+c.avg+'%・'+practised(c)+'・觀護人出過 '+c.guan+' 題')); ol.appendChild(li); });
    box.appendChild(ol);
  } else box.appendChild(el('p',null,'目前還排不出順序：一章至少要自評 '+WK.MIN+' 題才會列入。'));
  if(weak.untried.length){
    box.appendChild(el('h3',null,'常考但還沒練夠'));
    const ul=el('ul',{class:'sum-weak-list'});
    weak.untried.forEach(c=>{ const li=el('li'); li.appendChild(chapterLink(d,c)); li.appendChild(el('span',{class:'detail'},practised(c)+'・觀護人出過 '+c.guan+' 題')); ul.appendChild(li); });
    box.appendChild(ul);
  }
  renderLoss(box);
  box.appendChild(el('p',{class:'small muted'},'排序方式：出題次數（觀護人的題算 '+WK.GUAN_W+' 倍）乘上還沒掌握的比例。掌握度是該章已自評題目的平均分數；紀錄只讀取，不會被更動。'));
}

function renderSubjects(){
  const box=$('sum-subjects'); box.textContent='';
  LIST.forEach(x=>{
    const b=el('button',{type:'button',class:'sum-subject','aria-pressed':String(current===x.slug),'data-slug':x.slug});
    b.appendChild(el('span',{class:'name'},x.title));
    b.appendChild(el('span',{class:'count'},x.total+' 題'));
    b.addEventListener('click',()=>go(x.slug,null,false));
    box.appendChild(b);
  });
}

function render(slug){
  const d=S.items[slug]; if(!d) return;
  $('sum-error').hidden=true; $('sum-layout').hidden=false;
  computeWeak(d); renderWeak(d);
  $('sum-title').textContent=d.title;
  const codes=Object.entries(d.codes).map(([k,v])=>k+'＝'+v).join('；');
  $('sum-meta').textContent='共 '+d.total+' 題，依主題分 '+d.chart.length+' 章。題號代號：'+codes+'。';
  const toc=$('sum-toc-list'); toc.textContent='';
  const host=$('sum-sections'); host.textContent='';
  d.sections.forEach(sec=>{
    const sid=d.slug+'-'+sec.id;
    const li=el('li'); li.appendChild(el('a',{href:'#'+d.slug+'/'+sec.id,'data-section':sec.id},sec.title)); toc.appendChild(li);
    const s=el('section',{class:'sheet sum-section',id:sid,'aria-labelledby':sid+'-h'});
    s.appendChild(el('h2',{id:sid+'-h',tabindex:'-1'},sec.title));
    const c=weak&&weak.bySection[sec.id]; if(c) s.appendChild(renderPractice(c,d));
    renderBlocks(s,sec.blocks,d);
    const back=el('p',{class:'sum-back'}); const a=el('a',{href:'#sum-toc'},'↑ 回到目錄');
    a.addEventListener('click',e=>{ e.preventDefault(); const t=$('sum-toc'); t.open=true; t.scrollIntoView({block:'start'}); t.querySelector('summary').focus(); });
    back.appendChild(a); s.appendChild(back);
    host.appendChild(s);
  });
}

function jump(slug, section){
  const h=document.getElementById(slug+'-'+section+'-h');
  if(!h) return;
  h.closest('section').scrollIntoView({block:'start'});
  h.focus({preventScroll:true});
}

function setHash(slug, section){
  const h='#'+slug+(section?'/'+section:'');
  if(location.hash!==h){ try { history.replaceState(null,'',h); } catch (e) {} }
}

function go(slug, section, fromHash){
  const m=meta(slug); if(!m) return;
  current=slug; remember(slug); renderSubjects();
  if(!fromHash) setHash(slug, section);
  if(S.items[slug]){ render(slug); say(''); if(section) jump(slug,section); return; }
  $('sum-layout').hidden=true; $('sum-error').hidden=true;
  say('正在載入'+m.title+'重點整理…');
  if(loading[slug]) return;
  loading[slug]=true;
  const sc=document.createElement('script'); sc.src='summaries/'+m.file;
  sc.onload=()=>{ loading[slug]=false; if(current!==slug) return; if(!S.items[slug]){ fail(); return; } render(slug); say('已載入'+m.title+'重點整理，共 '+m.total+' 題。'); if(section) jump(slug,section); };
  sc.onerror=()=>{ loading[slug]=false; sc.remove(); if(current===slug) fail(); };
  document.head.appendChild(sc);
}
function fail(){ say(''); $('sum-layout').hidden=true; $('sum-error').hidden=false; }
$('sum-retry').addEventListener('click',()=>go(current,null,false));

function parseHash(){ let h=''; try { h=decodeURIComponent(location.hash.slice(1)); } catch (e) {} const [slug,section]=h.split('/'); return meta(slug)?{slug,section:/^s\d+$/.test(section||'')?section:null}:null; }
// 目錄、圖表的章節連結：同頁跳轉，不重新載入。
document.addEventListener('click',e=>{
  const a=e.target.closest && e.target.closest('a[data-section]'); if(!a||!current) return;
  e.preventDefault(); setHash(current,a.getAttribute('data-section')); jump(current,a.getAttribute('data-section'));
});
window.addEventListener('hashchange',()=>{ const p=parseHash(); if(p) go(p.slug,p.section,true); });

// 從申論評分參考回來時，自評紀錄若有變動就重畫，並留在原本的捲動位置。
function refreshWeak(){ if(!BY_ID||!current||!S.items[current]||WK.rawStore()===weakRaw) return; const y=window.scrollY; render(current); window.scrollTo(0,y); }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshWeak(); });
window.addEventListener('pageshow',refreshWeak);
window.addEventListener('storage',refreshWeak);

// 窄螢幕預設收合目錄，避免一進頁面就是長串清單。
try { if(window.matchMedia('(max-width:1023px)').matches) $('sum-toc').open=false; } catch (e) {}
const start=parseHash();
if(start) go(start.slug,start.section,true);
else go(meta(recalled())?recalled():(LIST[0]&&LIST[0].slug),null,false);
})();
