(() => {
 'use strict';
 const data=window.STUDY_MAP_DATA, host=document.getElementById('studyMap');
 let subjectIndex=data.findIndex(s=>s.subject==='犯罪學'), topicIndex=0, mode='groups', lastQuestion=null;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,cls='btn')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/&lt;(https:\/\/[^\s]+?)&gt;/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
 function markdown(text){
  const block=el('div',undefined,'map-source');let table=null,tableBody=null,tableHead=null,columnCount=0,alignments=[],list=null,listType=null,paragraph=[],code=null;
  const flush=()=>{if(paragraph.length){const p=el('p');p.innerHTML=inline(paragraph.join(' '));block.append(p);paragraph=[];}};
  for(const line of text.replace(/^---\n[\s\S]*?---\n/,'').split('\n')){
   if(/^\s*```/.test(line)){flush();table=null;list=null;if(code){code=null;}else{const pre=el('pre');code=el('code','');pre.append(code);block.append(pre);}continue;}
   if(code){code.textContent+=line+'\n';continue;}
   if(/^\s*\|/.test(line)){
    flush();list=null;const cells=line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(s=>s.trim().replace(/\\\|/g,'|'));
    if(cells.every(s=>/^:?-+:?$/.test(s))){
     alignments=cells.map(s=>s.startsWith(':')&&s.endsWith(':')?'center':s.endsWith(':')?'right':'left');
     tableHead?.children[0]?.children&&Array.from(tableHead.children[0].children).forEach((td,i)=>td.style.textAlign=alignments[i]||'left');continue;
    }
    if(!table){
     columnCount=cells.length;alignments=[];const wrap=el('div',undefined,'map-table');table=el('table');table.style.minWidth=Math.max(440,columnCount*125)+'px';
     const cols=el('colgroup');cells.forEach((label,i)=>{const col=el('col');if(/^(年度|年份|排序|排名|題號|題次|次序)$/.test(label))col.style.width='80px';else if(columnCount>2&&i===0)col.style.width='22%';cols.append(col);});
     tableHead=el('thead');tableBody=el('tbody');table.append(cols,tableHead,tableBody);wrap.append(table);block.append(wrap);
     const tr=el('tr');cells.forEach(cell=>{const th=el('th');th.setAttribute('scope','col');th.innerHTML=inline(cell);tr.append(th);});tableHead.append(tr);continue;
    }
    const tr=el('tr');for(let i=0;i<columnCount;i++){const td=el('td');td.style.textAlign=alignments[i]||'left';td.innerHTML=inline(cells[i]||'');tr.append(td);}tableBody.append(tr);continue;
   }
   if(!line.trim()&&table)continue;
   table=null;if(!line.trim()||/^[-—]{3,}$/.test(line)){flush();list=null;listType=null;continue;}
   const h=line.match(/^(#{1,6})\s+(.+)/);if(h){flush();list=null;block.append(el('h'+Math.min(4,h[1].length+1),h[2]));continue;}
   const item=line.match(/^\s*(?:([-*])|\d+[.、])\s+(.+)/);
   if(item){flush();const type=item[1]?'ul':'ol';if(!list||listType!==type){list=el(type);listType=type;block.append(list);}const li=el('li');li.innerHTML=inline(item[2]);list.append(li);continue;}
   list=null;listType=null;if(/^>\s?/.test(line)){flush();const quote=el('blockquote');quote.innerHTML=inline(line.replace(/^>\s?/,''));block.append(quote);}else paragraph.push(line.trim());
  }flush();return block;
 }
 function findQuestion(s,r){return questionBank.find(q=>q.year===r.year&&q.questionNo===r.no&&(q.subject===(s.practiceSubject||s.subject) || (s.subject==='社會工作概論'&&q.subject==='社會工作'))&&q.examTypes.includes('觀護人'));}
 function openQuestion(q){
  lastQuestion=q.id;currentYear=q.year;currentSubject=q.subject;currentExamType='觀護人';currentId=q.id;currentFilter='all';
  document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
  refreshYearSelect();refreshSubjectSelect();render();
  document.getElementById('mapReturnBar').hidden=false;
  document.querySelector('.question-paper').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderMap(){
  const s=data[subjectIndex];host.replaceChildren();
  const heading=el('div',undefined,'map-heading');heading.append(el('h2','考科重點地圖'));host.append(heading);
  const intro=el('p','先看歷年熱點，複習核心考點，再進入相關考古題。已加入115年官方試題分析，統計範圍與目前練習題庫分別標示。','map-muted');host.append(intro);
  const controls=el('div',undefined,'map-controls');const label=el('label','選擇考科 '),select=el('select');select.id='mapSubject';
  data.forEach((d,i)=>{const o=el('option',d.subject);o.value=i;select.append(o);});select.value=subjectIndex;select.onchange=()=>{subjectIndex=Number(select.value);topicIndex=0;mode='groups';renderMap();};label.append(select);controls.append(label);host.append(controls);
  host.append(el('p',s.scope,'map-muted'));
  host.append(el('p','115年原題已核對，查核日：2026/10/4。章節優先順序供複習參考；題目與考點核對不代表完整答案校準。','map-note'));
  if(s.year115Rows?.length){
   const latest=el('details',undefined,'map-original');latest.open=false;
   latest.append(el('summary',`115年新增考點 · ${s.year115Rows.length}${s.subject==='國文'?'項（10題測驗＋2項作文任務）':'題'}`));
   if(s.subject==='心理學')latest.append(el('p','108–114年原檔是年度主題整理；以下4題已逐題核對，頻率尚不能當作完整8年統計。','map-muted'));
   const ul=el('ul');s.year115Rows.forEach(r=>{const li=el('li');li.append(el('strong',`第${r.no}題：${r.core}`),el('p',r.keywords));
    r.studyNotes?.forEach(note=>li.append(el('p',note,'map-muted')));
    const q=findQuestion(s,r);if(q)li.append(button('進入原題作答',()=>openQuestion(q),'btn'));
    ul.append(li);
   });latest.append(ul);
   const source=el('a','查看115年官方試題','btn');source.href=s.official115;source.target='_blank';source.rel='noopener noreferrer';latest.append(source);host.append(latest);
  }
  const section=el('div',undefined,'map-layout'),nav=el('div',undefined,'map-nav'),detail=el('article',undefined,'map-detail');section.append(nav,detail);host.append(section);
  const tabs=el('div',undefined,'map-tabs');
  tabs.append(button('命題分類',()=>{mode='groups';topicIndex=0;renderMap();},mode==='groups'?'btn primary':'btn'),button('逐題核心考點',()=>{mode='exact';topicIndex=0;renderMap();},mode==='exact'?'btn primary':'btn'));nav.append(tabs);
  let topics=s.topics;
  if(mode==='exact'){
   const groups=new Map();s.rows.forEach(r=>{if(!groups.has(r.core))groups.set(r.core,[]);groups.get(r.core).push(r);});
   topics=[...groups].map(([label,rows])=>({label,rows,count:rows.length,kind:'同一核心考點題數'})).sort((a,b)=>b.count-a.count);
  }
  if(!topics.length){
   nav.append(el('p','原檔以章節架構與年度主題整理，沒有可核對的逐題頻率表。'));
   const practice=el('details');practice.append(el('summary','相關心理學考古題（非逐題對照）'));
   questionBank.filter(q=>q.subject===s.subject&&q.examTypes.includes('觀護人')).forEach(q=>practice.append(button(`${q.year}年第${q.questionNo}題`,()=>openQuestion(q))));
   nav.append(practice);detail.append(el('h3','心理學章節與重點'),markdown(s.text));
  }
  else{
   nav.append(el('p',s.hasStatistics&&mode==='groups'?'沿用原檔分類；各類可能涉及同一題，合計不一定等於總題數。':'依原檔核心考點原文分組，名稱不同者尚未合併。','map-muted'));
   const list=el('div',undefined,'map-topic-list');nav.append(list);
   topics.forEach((t,i)=>{const added=t.rows.filter(r=>r.year===115).length;const b=button(t.label+' · '+t.count+'題'+(added?`（115年${added}題）`:''),()=>{topicIndex=i;renderMap();},'map-topic'+(topicIndex===i?' active':''));b.setAttribute('aria-pressed',topicIndex===i);list.append(b);});
   const t=topics[Math.min(topicIndex,topics.length-1)];detail.append(el('h3',t.label),el('p',`${t.kind}：${t.count}題｜${new Set(t.rows.map(r=>r.year)).size}個年度`,'map-count'));
   if(t.count!==t.rows.length)detail.append(el('p','原檔題數與可解析的題次不一致，以下只列有明確題次者，待覆核。','map-note'));
   detail.append(el('h4','核心觀念與命題要求'));
   const concept=el('ul');[...new Set(t.rows.map(r=>r.secondary))].forEach(x=>concept.append(el('li',x)));detail.append(concept);
   const abilities=[...new Set(t.rows.map(r=>r.ability).filter(Boolean))];if(abilities.length)detail.append(el('p','命題能力：'+abilities.join('；')));
   const guides=hintGuides[s.subject];if(guides){detail.append(el('h4','作答骨架'));const ol=el('ol');guides.skeleton.forEach(x=>ol.append(el('li',x.replace(/^[一二三四]、/,''))));detail.append(ol);}
   detail.append(el('h4','歷屆題目定位'));
   t.rows.forEach(r=>{const row=el('div',undefined,'map-question');row.append(el('strong',`${r.year}年第${r.no}題`),el('p',r.keywords),el('p','主考點：'+r.core+'｜次考點：'+r.secondary,'map-muted'));const q=findQuestion(s,r);
    r.studyNotes?.forEach(note=>row.append(el('p',note,'map-muted')));
    if(q)row.append(button('進入原題作答',()=>openQuestion(q),'btn primary'));
    else row.append(el('span',r.year===115?'115年原題已核對；本頁整理考點，未新增作答介面。':'原整理有記載；目前題庫尚未收錄此題。','map-muted'));
    if(r.sourceUrl){const a=el('a','官方原題','btn');a.href=r.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';row.append(a);}
    detail.append(row);
   });
  }
  if(topics.length){const original=el('details',undefined,'map-original');original.append(el('summary','查看完整重點整理、章節優先順序與來源'),markdown(s.text));host.append(original);}
  host.append(el('p','選單已收錄刑事訴訟法、少年事件處理法與保安處分執行法的完整考點筆記；刑訴與保安共用官方試卷，分科閱讀。','map-muted'));
 }
 window.studyMapQuestionChanged=()=>{
  const area=document.getElementById('mapQuestionLinks');if(!area)return;area.replaceChildren();
  const q=currentQuestion();if(!q)return;
  const links=[];data.forEach((s,si)=>{s.topics.forEach((t,ti)=>{if(t.rows.some(r=>findQuestion(s,r)?.id===q.id))links.push({s,si,t,ti});});});
  if(!links.length){area.hidden=false;area.append(el('p','本題尚無對應重點；可從考科重點地圖選科閱讀。','map-muted'));return;}area.hidden=false;area.append(el('strong','相關重點整理 '));
  links.forEach(({si,t,ti})=>area.append(button(t.label,()=>{subjectIndex=si;topicIndex=ti;mode='groups';renderMap();document.getElementById('studyMapPanel').open=true;host.scrollIntoView({behavior:'smooth',block:'start'});},'btn')));
 };
 document.getElementById('mapReturn').onclick=()=>{renderMap();document.getElementById('studyMapPanel').open=true;host.scrollIntoView({behavior:'smooth',block:'start'});};
 renderMap();window.studyMapQuestionChanged();
})();
