/* 各科重點整理：依科目按需載入 summaries/ 的資料檔，用 DOM 組出內容（不使用 innerHTML）。只記住最後看的科目。 */
(function () {
'use strict';
const S = window.LawScoringSummaries;
const $ = id => document.getElementById(id);
const KEY = 'lawScoring.summaries.v1';
const TOK = /(觀護|監獄|犯防|薦任|監所|家調)(\d{3})-(\d)/g;
if (!S || !$('sum-root')) return;
const LIST = S.list || [];
const loading = {};
let current = null;

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

// 窄螢幕預設收合目錄，避免一進頁面就是長串清單。
try { if(window.matchMedia('(max-width:1023px)').matches) $('sum-toc').open=false; } catch (e) {}
const start=parseHash();
if(start) go(start.slug,start.section,true);
else go(meta(recalled())?recalled():(LIST[0]&&LIST[0].slug),null,false);
})();
