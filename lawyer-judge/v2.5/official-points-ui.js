/* 在「判定後的方向」面板顯示考選部公布的評分要點（若該題有收錄），並可逐點勾選「有寫到／漏掉」。
   勾選紀錄存在 lsdesk-official-check-v1；不影響系統初評分數。 */
(function(){
  const OP=window.OfficialPoints;
  const h=(tag,attrs,...kids)=>{const e=document.createElement(tag);for(const k in attrs||{})e.setAttribute(k,attrs[k]);for(const c of kids.flat())if(c!=null)e.append(c);return e;};
  function render(){
    const panel=document.getElementById('directionPanel'),title=document.getElementById('questionTitle');
    if(!OP||!panel||!title||!window.OFFICIAL_POINTS||!window.QUESTION_BANK)return;
    let box=document.getElementById('officialPoints');
    const q=window.QUESTION_BANK.find(x=>x.title===title.textContent),data=q&&window.OFFICIAL_POINTS[q.id];
    if(!data){if(box)box.remove();return;}
    const wasOpen=box?box.open:false;
    if(!box){box=h('details',{id:'officialPoints','class':'official-points'});panel.appendChild(box);}
    const parsed=OP.items(data),check=OP.getCheck(q.id),marks=(check&&check.marks)||{},total=parsed.items.length;
    const status=h('p',{'class':'op-status',role:'status'});
    const updateStatus=()=>{const s=OP.score(q.id,total);status.textContent=s?`已勾 ${s.hit+s.miss}／${total} 點：有寫到 ${s.hit}、漏掉 ${s.miss}。漏掉的會列在「複習 → 失分清單」。`:`共 ${total} 點。寫完答案後逐點勾選，漏掉的會列進失分清單。`;};
    const list=h('ol',{'class':'op-items'},parsed.items.map((it,i)=>{
      const name='op-'+i;
      const radio=(value,label)=>{const input=h('input',{type:'radio',name,value});if(marks[i]===value)input.checked=true;
        input.addEventListener('click',()=>{ // 再點一次同一個選項＝取消
          const cur=(OP.getCheck(q.id)||{marks:{}}).marks[i];
          if(cur===value){input.checked=false;OP.setMark(q.id,i,null,total);}else OP.setMark(q.id,i,value,total);
          updateStatus();});
        return h('label',{'class':'op-mark op-'+value},input,label);};
      return h('li',{},h('p',{'class':'op-title'},it.title),
        h('div',{'class':'op-marks',role:'group','aria-label':'這一點我的答案'},radio('hit','有寫到'),radio('miss','漏掉')),
        it.body.length?h('details',{'class':'op-body'},h('summary',{},'看這一點的說明'),it.body.map(p=>h('p',{},p))):null);
    }));
    const block=(label,paras)=>paras&&paras.length?h('details',{'class':'op-body'},h('summary',{},label),paras.map(p=>h('p',{},p))):null;
    box.replaceChildren(...[
      h('summary',{},`考選部公布的評分要點（${data.year} 年）・逐點核對`),
      h('p',{'class':'muted'},'摘自考選部公布文件，由 PDF 轉出，段落可能有切分誤差，請以原文件為準；這是評分參考，不是唯一答案。勾選只記錄你的自我檢核，不計分。'),
      status,
      block('總題說明',data.overview),block('評分要點前言',parsed.intro),
      total?list:h('p',{},'這一題的評分要點沒有可逐點勾選的小標，請直接閱讀下方內容。'),
      total?null:block('評分要點',data.points),
      block('閱卷委員的話',data.commentary)].filter(Boolean));
    box.open=wasOpen;updateStatus();
  }
  window.addEventListener('practice25:render',render);
  document.addEventListener('DOMContentLoaded',render);
})();
