/* 複習總覽：只讀取既有紀錄（申論自評 probation-study30-v251:v1、選擇題 psd-mcq-v1、評分要點勾選 lsdesk-official-check-v1），不寫入任何紀錄。 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const h=(tag,attrs,...kids)=>{const e=document.createElement(tag);for(const k in attrs||{})e.setAttribute(k,attrs[k]);for(const c of kids.flat())if(c!=null)e.append(c);return e;};
  const taipeiToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
  function read(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
  function empty(host,text){host.replaceChildren(h('li',{'class':'empty-note'},text));}
  function emptyDiv(ul,text){const li=h('li',{'class':'empty-note',style:'display:block'},text);ul.replaceChildren(li);}
  function init(){
    const today=taipeiToday();
    // 申論：Study30Review.model 與每日30分鐘頁用同一套規則
    const bank=Array.isArray(window.QUESTION_BANK)?window.QUESTION_BANK:[];
    const s30=read('probation-study30-v251:v1');
    const sessions=s30&&s30.sessions&&typeof s30.sessions==='object'?s30.sessions:{};
    const essay=window.Study30Review?window.Study30Review.model(sessions,bank,today):{all:[],due:[],upcoming:[],weak:[],subjects:[]};
    // 選擇題
    const mc=read('psd-mcq-v1'),rec=mc&&mc.records&&typeof mc.records==='object'?mc.records:{};
    const mbank=Array.isArray(window.MCQ_BANK)?window.MCQ_BANK:[];
    const byId=new Map(mbank.map(q=>[q.id,q]));
    const scored=q=>q.status!=='incomplete';
    const mcqWrong=Object.entries(rec).filter(([id,r])=>r&&r.w&&byId.has(id));
    const mcqDue=mcqWrong.filter(([,r])=>r.d&&r.d<=today);
    const done=mbank.filter(q=>rec[q.id]);

    $('due-total').textContent=String(essay.due.length+mcqDue.length);
    $('due-detail').textContent=`申論 ${essay.due.length} 題・選擇題 ${mcqDue.length} 題`;
    $('go-review').href=mcqDue.length&&!essay.due.length?'../mcq/#wrong':'../professional/';
    $('go-review').textContent=essay.due.length+mcqDue.length?'開始複習':'去練習';
    $('essay-rated').textContent=String(essay.all.length);
    $('mcq-wrong').textContent=String(mcqWrong.length);
    $('mcq-done').textContent=String(done.length);

    // 申論各科掌握度（堆疊條）
    const em=$('essay-mastery');
    if(!essay.subjects.length)emptyDiv(em,'還沒有申論自評紀錄。在「每日30分鐘」或「考古題練習」完成自評後，這裡會出現各科掌握度。');
    else{
      em.replaceChildren(...essay.subjects.map(s=>{
        const t=s.studied||1,seg=(n,c)=>h('i',{'class':c,style:`width:${n/t*100}%`});
        const track=h('span',{'class':'track',role:'img','aria-label':`${s.label}：掌握 ${s.mastered}、不完整 ${s.partial}、需複習 ${s.review}`},seg(s.mastered,'seg-ok'),seg(s.partial,'seg-part'),seg(s.review,'seg-bad'));
        return h('li',{},h('span',{},s.label),track,h('span',{'class':'num'},`${s.mastered}／${s.partial}／${s.review}`));
      }));
      $('essay-legend').hidden=false;
    }
    // 選擇題各科
    const subjects=[...new Set(mbank.map(q=>q.subject))];
    const mm=$('mcq-mastery');
    const rows=subjects.map(s=>{
      const qs=mbank.filter(q=>q.subject===s&&scored(q)),mine=qs.filter(q=>rec[q.id]);
      const att=mine.reduce((t,q)=>t+rec[q.id].n,0),ok=mine.reduce((t,q)=>t+rec[q.id].c,0);
      return att?{s,att,pct:Math.round(ok/att*100)}:null;
    }).filter(Boolean).sort((a,b)=>a.pct-b.pct);
    if(!rows.length)emptyDiv(mm,mbank.length?'還沒有選擇題作答紀錄。':'尚未匯入選擇題題庫。');
    else{
      mm.replaceChildren(...rows.map(r=>{
        const weak=r.att>=10&&r.pct<60;
        const track=h('span',{'class':'track',role:'img','aria-label':`${r.s}：正確率 ${r.pct}%，作答 ${r.att} 次`},h('i',{'class':weak?'seg-bad':'seg-ok',style:`width:${r.pct}%`}));
        return h('li',{},h('span',{},r.s),track,h('span',{'class':'num'},`${r.pct}%・${r.att} 次`));
      }));
      $('mcq-legend').hidden=false;
    }
    // 到期清單（申論＋選擇題各取前幾筆）
    const dl=$('due-list'),items=[];
    essay.due.slice(0,4).forEach(r=>items.push(h('li',{},h('span',{'class':'row1'},h('b',{},r.subject+'・'+r.topic),h('span',{'class':'due'},r.daysUntil<0?`逾期 ${-r.daysUntil} 天`:'今天')),h('span',{'class':'sub'},r.cause?`上次：${r.cause}`:`上次自評：${{review:'需複習',partial:'不完整',mastered:'掌握'}[r.rating]||''}`))));
    mcqDue.slice(0,3).forEach(([id,r])=>{const q=byId.get(id);items.push(h('li',{},h('span',{'class':'row1'},h('b',{},`${q.subject}・${q.year} 年第 ${q.no} 題`),h('span',{'class':'due'},r.d<today?'逾期':'今天')),h('span',{'class':'sub'},'第一試選擇題・錯題本')));});
    if(items.length)dl.replaceChildren(...items);else dl.hidden=true;
    // 弱點地圖
    const pl=$('priority-list');
    if(pl&&window.WeaknessMap){
      const OP=window.OfficialPoints,pts=window.OFFICIAL_POINTS||{};
      const wm=window.WeaknessMap.compute({mcqBank:mbank,mcqRecords:rec,essayBank:bank,pointStats:OP?OP.bySubject(pts):[],selfStats:essay.subjects});
      if(!wm.ranked.length)emptyDiv(pl,'還沒有足夠的紀錄可以排序。選擇題同一科作答滿 10 次，或在評分要點勾選過、做過申論自評後，這裡會列出優先複習的科目。');
      else pl.replaceChildren(...wm.ranked.slice(0,5).map(r=>h('li',{},h('b',{},r.name),h('span',{'class':'why'},`掌握度 ${Math.round(r.mastery*100)}%・${r.parts.map(x=>x.text).join('；')}`))));
      const un=$('untouched');
      if(wm.untouched.length){un.hidden=false;un.textContent='還沒有紀錄的科目（依題數多到少）：'+wm.untouched.map(r=>r.name).join('、')+'。';}
    }
    // 最弱考點
    const wl=$('weak-list');
    if(!essay.weak.length)emptyDiv(wl,'還沒有被標為「需複習」或「不完整」的申論考點。');
    else wl.replaceChildren(...essay.weak.slice(0,5).map(r=>h('li',{},h('span',{'class':'row1'},h('b',{},r.subject+'・'+r.topic),h('span',{'class':r.rating==='review'?'due':'sub'},r.rating==='review'?'需複習':'不完整')),h('span',{'class':'sub'},`已練習 ${r.attempts} 次・下次 ${r.due}`))));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
