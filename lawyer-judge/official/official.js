/* 失分清單、閱卷委員的話、收錄範圍。只讀取 lsdesk-official-check-v1，不寫入。 */
(function(){
  'use strict';
  const OP=window.OfficialPoints,POINTS=window.OFFICIAL_POINTS||{},BANK=Array.isArray(window.QUESTION_BANK)?window.QUESTION_BANK:[];
  const $=id=>document.getElementById(id);
  const h=(tag,attrs,...kids)=>{const e=document.createElement(tag);for(const k in attrs||{}){if(k==='text')e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}for(const c of kids.flat())if(c!=null)e.append(c);return e;};
  const label=d=>`${d.year} 年${d.subject}第 ${d.questionNo} 題`;
  const tabs=['missed','checklist','commentary','coverage'];
  function show(name){tabs.forEach(t=>{$('tab-'+t).setAttribute('aria-selected',String(t===name));$('panel-'+t).hidden=t!==name;});try{history.replaceState(null,'','#'+name);}catch{}}
  tabs.forEach(t=>$('tab-'+t).addEventListener('click',()=>show(t)));

  function missed(){
    const host=$('panel-missed'),list=OP.missed(POINTS,BANK),stats=OP.bySubject(POINTS).sort((a,b)=>a.rate-b.rate);
    if(!list.length&&!stats.length){host.replaceChildren(h('p',{'class':'empty-note',text:'還沒有勾選紀錄。到「考古題練習」寫完一題後，在考選部評分要點逐點勾選；或用「爭點骨架回想」三分鐘練一題。'}),
      h('p',{'class':'actions'},h('a',{'class':'btn-link',href:'../outline/'},'開始骨架回想'),h('a',{'class':'text-link',href:'../v2.5/'},'去考古題練習')));return;}
    const groups=new Map();list.forEach(m=>{if(!groups.has(m.subject))groups.set(m.subject,[]);groups.get(m.subject).push(m);});
    host.replaceChildren(
      h('h2',{'class':'sec',style:'margin-top:20px'},'各科命中率（只算勾過的點）'),
      h('ul',{'class':'mastery'},stats.map(s=>h('li',{},h('span',{},s.subject),
        h('span',{'class':'track',role:'img','aria-label':`${s.subject}：有寫到 ${s.hit} 點、漏掉 ${s.miss} 點`},h('i',{'class':'seg-ok',style:`width:${s.rate*100}%`}),h('i',{'class':'seg-bad',style:`width:${(1-s.rate)*100}%`})),
        h('span',{'class':'num'},`${Math.round(s.rate*100)}%・${s.questions} 題`)))),
      h('h2',{'class':'sec'},`漏掉的爭點（${list.length} 點）`),
      ...(list.length?[...groups].map(([subject,rows])=>h('section',{},h('h3',{'class':'sub-head'},`${subject}（${rows.length}）`),
        h('ul',{'class':'queue'},rows.map(m=>h('li',{},h('span',{'class':'row1'},h('b',{},m.title),h('span',{'class':'due'},m.at||'')),
          h('span',{'class':'sub'},label(m)),
          m.body.length?h('details',{'class':'op-body'},h('summary',{},'看評分要點的說明'),m.body.map(p=>h('p',{},p))):null))))):[h('p',{'class':'empty-note',text:'目前沒有標為「漏掉」的點。'})]),
      h('p',{'class':'actions'},h('a',{'class':'btn-link',href:'../outline/'},'用骨架回想複習'),h('a',{'class':'text-link',href:'../v2.5/'},'去考古題練習')));
  }

  function commentary(){
    const host=$('panel-commentary'),rows=Object.entries(POINTS).filter(([,d])=>d.commentary&&d.commentary.length).sort((a,b)=>a[1].subject.localeCompare(b[1].subject,'zh-Hant')||b[1].year-a[1].year||a[1].questionNo-b[1].questionNo);
    if(!rows.length){host.replaceChildren(h('p',{'class':'empty-note',text:'尚未收錄閱卷委員的話。'}));return;}
    const subjects=[...new Set(rows.map(([,d])=>d.subject))];
    const select=h('select',{id:'c-subject'},h('option',{value:''},'全部科目'),subjects.map(s=>h('option',{value:s},s)));
    const search=h('input',{id:'c-search',type:'search',placeholder:'例：涵攝、條號、競合',autocomplete:'off'});
    const out=h('div',{}),count=h('p',{'class':'muted',role:'status'});
    function draw(){
      const s=select.value,k=search.value.trim();let n=0;
      const blocks=rows.filter(([,d])=>!s||d.subject===s).map(([id,d])=>{
        const paras=d.commentary.filter(p=>!k||p.includes(k));if(!paras.length)return null;n+=paras.length;
        return h('section',{'class':'c-block'},h('h3',{'class':'sub-head'},label(d)),paras.map(p=>h('p',{},p)));}).filter(Boolean);
      count.textContent=k?`找到 ${n} 段含「${k}」的內容。`:`共 ${rows.filter(([,d])=>!s||d.subject===s).length} 題的閱卷委員的話。`;
      out.replaceChildren(...(blocks.length?blocks:[h('p',{'class':'empty-note',text:'沒有符合的內容。'})]));
    }
    select.addEventListener('change',draw);search.addEventListener('input',draw);
    host.replaceChildren(h('div',{'class':'filters'},h('p',{'class':'field-row'},h('label',{for:'c-subject'},'科目'),select),h('p',{'class':'field-row'},h('label',{for:'c-search'},'搜尋關鍵字'),search)),count,out);draw();
  }

  function checklist(){
    const host=$('panel-checklist'),CT=window.CommentaryThemes;
    if(!CT){host.replaceChildren(h('p',{'class':'empty-note',text:'載入失敗，請重新整理。'}));return;}
    const subjects=[...new Set(Object.values(POINTS).map(d=>d.subject))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    const select=h('select',{id:'k-subject'},h('option',{value:''},'全部科目'),subjects.map(s=>h('option',{value:s},s)));
    const out=h('div',{}),note=h('p',{'class':'muted',role:'status'});
    function draw(){
      const r=CT.analyze(POINTS,select.value);
      note.textContent=`${select.value||'全部科目'}：${r.total} 題有閱卷委員的話。題數＝原文出現相關用語的題目數，由關鍵字比對得出，可能多算或漏算。`;
      const max=Math.max(1,...r.themes.map(t=>t.questions));
      out.replaceChildren(h('ol',{'class':'theme-list'},r.themes.map(t=>h('li',{},
        h('p',{'class':'theme-name'},h('b',{},t.name),h('span',{'class':'num'},`${t.questions} 題`)),
        h('span',{'class':'track',role:'img','aria-label':`${t.name}：${t.questions} 題`},h('i',{style:`width:${t.questions/max*100}%`})),
        h('p',{'class':'theme-ask'},'作答前自問：'+t.ask),
        t.hits.length?h('details',{'class':'op-body'},h('summary',{},`看原文（${t.hits.length} 段）`),t.hits.map(x=>h('p',{},h('span',{'class':'src'},`${x.year} 年${x.subject}第 ${x.questionNo} 題｜`),x.text))):null))));
    }
    select.addEventListener('change',draw);
    host.replaceChildren(h('p',{},'閱卷委員歷年反覆提到的失分情形。類型名稱與「作答前自問」是整理時歸納的用語；展開後看到的段落都是考選部原文。'),
      h('div',{'class':'filters'},h('p',{'class':'field-row'},h('label',{for:'k-subject'},'科目'),select)),note,out);draw();
  }

  function coverage(){
    const host=$('panel-coverage'),m=new Map();
    BANK.forEach(q=>{const key=q.subject+'|'+q.year;const r=m.get(key)||{subject:q.subject,year:q.year,total:0,have:0};r.total++;if(POINTS[q.id])r.have++;m.set(key,r);});
    const rows=[...m.values()].sort((a,b)=>a.subject.localeCompare(b.subject,'zh-Hant')||b.year-a.year),have=rows.reduce((t,r)=>t+r.have,0),total=rows.reduce((t,r)=>t+r.total,0);
    host.replaceChildren(h('p',{text:`題庫 ${total} 題中，${have} 題已收錄考選部評分要點。`}),
      h('div',{'class':'table-wrap',tabindex:'0',role:'region','aria-label':'各科各年度收錄情形'},h('table',{},h('thead',{},h('tr',{},h('th',{scope:'col'},'科目'),h('th',{scope:'col'},'年度'),h('th',{scope:'col'},'已收錄／題數'))),
        h('tbody',{},rows.map(r=>h('tr',{'class':r.have?'':'none'},h('th',{scope:'row'},r.subject),h('td',{},String(r.year)),h('td',{},`${r.have}／${r.total}`)))))));
  }
  if(!OP){$('panel-missed').textContent='載入失敗，請重新整理。';return;}
  missed();checklist();commentary();coverage();
  const want=location.hash.slice(1);if(tabs.includes(want))show(want);
})();
