/* 爭點骨架回想：看題目 → 三分鐘列爭點 → 對照考選部評分要點逐點勾選 → 自評，依 1、3、7、14 天間隔再出現。
   紀錄：lsdesk-outline-recall-v1（排程）、lsdesk-official-check-v1（逐點勾選，與考古題練習臺共用）。 */
(function(){
  'use strict';
  const OP=window.OfficialPoints,POINTS=window.OFFICIAL_POINTS||{},BANK=Array.isArray(window.QUESTION_BANK)?window.QUESTION_BANK:[];
  const byId=new Map(BANK.map(q=>[q.id,q])),app=document.getElementById('app'),LIMIT=180;
  const h=(tag,attrs,...kids)=>{const e=document.createElement(tag);for(const k in attrs||{}){if(k==='text')e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}for(const c of kids.flat())if(c!=null)e.append(c);return e;};
  const ids=Object.keys(POINTS).filter(id=>byId.has(id)&&OP.items(POINTS[id]).items.length);
  const usable=Object.fromEntries(ids.map(id=>[id,POINTS[id]]));
  let subject='',timer=null;
  const label=id=>{const d=POINTS[id];return `${d.year} 年${d.subject}第 ${d.questionNo} 題`;};
  function stopTimer(){if(timer){clearInterval(timer);timer=null;}}

  function home(){
    stopTimer();
    if(!ids.length){app.replaceChildren(h('p',{'class':'empty-note',text:'目前沒有可以回想的題目。這個功能只用「已收錄考選部評分要點」的題目；請到「複習 → 失分清單 → 收錄範圍」查看。'}));return;}
    const subjects=[...new Set(ids.map(id=>POINTS[id].subject))];
    const pool=Object.fromEntries(ids.filter(id=>!subject||POINTS[id].subject===subject).map(id=>[id,POINTS[id]]));
    const q=OP.queue(pool),next=q.due[0]||q.fresh[0]||null;
    const select=h('select',{id:'subject-filter'},h('option',{value:''},'全部科目'),subjects.map(s=>{const o=h('option',{value:s},s);if(s===subject)o.selected=true;return o;}));
    select.addEventListener('change',()=>{subject=select.value;home();});
    const start=h('button',{type:'button','class':'go'},q.due.length?'開始複習到期的題目':q.fresh.length?'開始新題':'提前複習');
    start.addEventListener('click',()=>ask(next||q.later[0],[...q.due,...q.fresh].slice(1)));
    const upcoming=q.later.slice(0,5).map(id=>h('li',{},h('span',{'class':'row1'},h('b',{},label(id)),h('span',{'class':'due'},q.records[id].due)),h('span',{'class':'sub'},`做過 ${q.records[id].n} 次`)));
    app.replaceChildren(
      h('div',{'class':'two-col'},
        h('div',{},
          h('div',{'class':'dark-panel'},h('span',{'class':'label'},'今日骨架回想'),h('div',{'class':'big'},h('b',{},String(q.due.length)),h('span',{},'題到期')),
            h('span',{style:'font-size:14px;color:#d9d1c3'},`還沒做過 ${q.fresh.length} 題・之後到期 ${q.later.length} 題`),start),
          h('p',{'class':'field-row'},h('label',{for:'subject-filter'},'科目'),select),
          h('p',{},h('a',{'class':'text-link',href:'../official/#checklist'},'作答前先看：閱卷委員常提的錯誤'))),
        h('aside',{'aria-label':'之後到期'},h('h2',{'class':'sec',style:'margin-top:0'},'之後到期'),
          upcoming.length?h('ul',{'class':'queue'},upcoming):h('p',{'class':'empty-note',text:'還沒有排定的題目。'}))));
  }

  function ask(id,rest){
    if(!id){home();return;}
    const q=byId.get(id),d=POINTS[id],started=Date.now();
    const clock=h('span',{'class':'clock',role:'timer','aria-live':'off'},'3:00');
    const area=h('textarea',{id:'outline-text',rows:'8',placeholder:'例：一、甲持槍取財 → 強盜未遂（凶器？）\n二、……'});
    const reveal=h('button',{type:'button','class':'primary'},'對照評分要點');
    stopTimer();
    timer=setInterval(()=>{const left=Math.max(0,LIMIT-Math.floor((Date.now()-started)/1000));clock.textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
      if(!left){stopTimer();clock.textContent='時間到';clock.classList.add('over');}},500);
    reveal.addEventListener('click',()=>check(id,rest,area.value));
    const back=h('button',{type:'button','class':'secondary'},'回到清單');back.addEventListener('click',home);
    app.replaceChildren(h('article',{'class':'recall-card'},
      h('p',{'class':'page-eyebrow'},label(id)),
      h('div',{'class':'recall-question'},String(q.body).split('\n').map(p=>h('p',{},p))),
      h('div',{'class':'recall-bar'},h('label',{for:'outline-text'},'列出爭點與審查順序（不必寫完整答案）'),clock),
      area,
      h('div',{'class':'actions'},reveal,back)));
    area.focus();
  }

  function check(id,rest,mine){
    stopTimer();
    const d=POINTS[id],parsed=OP.items(d),total=parsed.items.length,marks=(OP.getCheck(id)||{marks:{}}).marks||{};
    const status=h('p',{'class':'op-status',role:'status'});
    const update=()=>{const s=OP.score(id,total);status.textContent=s?`已勾 ${s.hit+s.miss}／${total} 點：有列到 ${s.hit}、漏掉 ${s.miss}。`:`共 ${total} 點，逐點勾選你剛才有沒有列到。`;};
    const list=h('ol',{'class':'op-items'},parsed.items.map((it,i)=>{
      const radio=(value,text)=>{const input=h('input',{type:'radio',name:'op-'+i,value});if(marks[i]===value)input.checked=true;
        input.addEventListener('change',()=>{OP.setMark(id,i,value,total);update();});return h('label',{'class':'op-mark op-'+value},input,text);};
      return h('li',{},h('p',{'class':'op-title'},it.title),h('div',{'class':'op-marks',role:'group','aria-label':'這一點'},radio('hit','有列到'),radio('miss','漏掉')),
        it.body.length?h('details',{'class':'op-body'},h('summary',{},'看這一點的說明'),it.body.map(p=>h('p',{},p))):null);}));
    const rateBtn=(result,text,cls)=>{const b=h('button',{type:'button','class':cls},text);b.addEventListener('click',()=>{const r=OP.rate(id,result);done(id,rest,r);});return b;};
    app.replaceChildren(h('article',{'class':'recall-card'},
      h('p',{'class':'page-eyebrow'},label(id)+'・對照評分要點'),
      mine.trim()?h('details',{'class':'op-body',open:''},h('summary',{},'你剛才列的'),h('pre',{'class':'mine'},mine)):h('p',{'class':'muted',text:'你沒有寫下內容。'}),
      status,list,
      d.commentary&&d.commentary.length?h('details',{'class':'op-body'},h('summary',{},'閱卷委員的話'),d.commentary.map(p=>h('p',{},p))):null,
      h('h2',{'class':'sec'},'整體來說，這題的骨架'),
      h('div',{'class':'actions rate'},rateBtn('again','大半沒想到（明天再來）','secondary'),rateBtn('ok','大致有，漏了一些','secondary'),rateBtn('easy','幾乎都列到','primary'))));
    update();window.scrollTo(0,0);
  }

  function done(id,rest,r){
    const nextBtn=rest.length?h('button',{type:'button','class':'primary'},`下一題（還有 ${rest.length} 題）`):null;
    if(nextBtn)nextBtn.addEventListener('click',()=>ask(rest[0],rest.slice(1)));
    const back=h('button',{type:'button','class':'secondary'},'回到清單');back.addEventListener('click',home);
    app.replaceChildren(h('article',{'class':'recall-card'},h('p',{'class':'page-eyebrow'},label(id)),
      h('p',{role:'status',text:r?`已記錄，下次出現：${r.due}。`:'紀錄沒有存成功（瀏覽器儲存空間可能已滿或被停用）。'}),
      h('div',{'class':'actions'},nextBtn,back,h('a',{'class':'text-link',href:'../official/'},'看失分清單'))));
  }
  if(!OP){app.textContent='載入失敗，請重新整理。';return;}
  home();
})();
