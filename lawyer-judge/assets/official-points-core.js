/* 考選部評分要點：共用計算（逐點項目、勾選紀錄、失分統計、骨架回想排程）。
   紀錄鍵：lsdesk-official-check-v1（逐點勾選）、lsdesk-outline-recall-v1（骨架回想）。只存在本機瀏覽器。 */
(function(root){
  'use strict';
  const CHECK_KEY='lsdesk-official-check-v1',RECALL_KEY='lsdesk-outline-recall-v1',INTERVALS=[1,3,7,14];
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
  const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  function read(key){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

  const N='[一二三四五六七八九十]+',D='[0-9０-９]{1,2}';
  // 標題樣式：出現的先後決定層級（各科寫法不同，不寫死「壹→一→（一）」）
  const STYLES=[
    ['A',new RegExp('^[壹貳參肆伍陸柒捌玖拾]、')],
    ['Q',new RegExp('^(?:【\\s*)?(?:第\\s*[（(]?\\s*(?:'+N+'|'+D+')\\s*[）)]?\\s*(?:小題|子題|部分)|(?:小題|子題)\\s*(?:'+N+'|'+D+'))')],
    ['B',new RegExp('^'+N+'、')],
    ['C',new RegExp('^(?:[（(]'+N+'[）)]|[㈠-㈩])')],
    ['D',new RegExp('^'+D+'\\s*[.、．](?![0-9])')],
    ['E',new RegExp('^(?:[（(]'+D+'[）)]|[⑴-⑽①-⑩])')]
  ];
  const MAX_ITEMS=16,TITLE_MAX=64;
  const styleOf=p=>{for(const [k,re] of STYLES)if(re.test(p))return k;return null;};
  const shorten=(t,n)=>{t=t.trim();if(t.length<=n)return t;const cut=t.slice(0,n),stop=Math.max(cut.lastIndexOf('。'),cut.lastIndexOf('：'),cut.lastIndexOf('？'));return (stop>=12?cut.slice(0,stop+1):cut+'…');};
  // 「壹、…之罪一、構成要件該當性」這類兩個標題黏在同一段的情況，拆成兩段
  function unglue(list){
    const out=[];
    for(const raw of list){const p=String(raw).trim();if(!p)continue;
      const m=p.match(/^([壹貳參肆伍陸柒捌玖拾]、[^。；]{2,80}?[^一二三四五六七八九十、。；])(一、[^。；]{0,40})$/);
      if(m)out.push(m[1],m[2]);else out.push(p);}
    return out;
  }
  /* 把「評分要點」段落整理成可勾選的項目。
     第一層標題各成一點；若第一層底下還有第二層標題，且拆開後不超過 MAX_ITEMS 點，就以第二層為一點。
     完全沒有標題的題目回傳 0 點（畫面改顯示全文）。 */
  function items(data){
    const paras=unglue((data&&data.points)||[]),levels=[],nodes=[],intro=[];
    let l1=null,l2=null;
    for(let i=0;i<paras.length;i++){
      const p=paras[i],st=p.charAt(0)==='「'?null:styleOf(p);
      let lv=-1;
      if(st){lv=levels.indexOf(st);if(lv<0&&levels.length<2){levels.push(st);lv=levels.length-1;}}
      if(lv===0){
        let title=p,body=[];
        // 只有編號、標題在下一段（例如單獨一行「貳、」）
        if(p.length<=4&&paras[i+1]&&!styleOf(paras[i+1])&&paras[i+1].length<=TITLE_MAX){title=p+paras[++i];}
        else if(p.length>TITLE_MAX){title=shorten(p,TITLE_MAX);body=[p];}
        l1={title,body,subs:[]};l2=null;nodes.push(l1);
      }else if(lv===1&&l1){
        let title=p,body=[];
        if(p.length<=6&&paras[i+1]&&!styleOf(paras[i+1])&&paras[i+1].length<=TITLE_MAX){title=p+paras[++i];}
        else if(p.length>TITLE_MAX){title=shorten(p,TITLE_MAX);body=[p];}
        l2={title,body};l1.subs.push(l2);
      }else if(l2)l2.body.push(p);else if(l1)l1.body.push(p);else intro.push(p);
    }
    const flat=nodes.map(n=>({title:n.title,body:[...n.body,...n.subs.flatMap(x=>x.body.length&&x.body[0].startsWith(x.title.replace(/…$/,''))?x.body:[x.title,...x.body])]}));
    const deep=[];
    for(const n of nodes){
      if(!n.subs.length){deep.push({title:n.title,body:n.body});continue;}
      const head=shorten(n.title,28);
      const full=head!==n.title&&!(n.body[0]||'').startsWith(n.title.replace(/…$/,''))?[n.title]:[];
      n.subs.forEach((x,j)=>deep.push({title:head+'｜'+x.title,body:j===0?[...full,...n.body,...x.body]:x.body}));
    }
    const use=deep.length>flat.length&&deep.length<=MAX_ITEMS?deep:flat;
    if(!use.length&&paras.length)return {intro:[],items:[{title:'本題評分要點（官方未分點，整題核對）',body:paras}]};
    return {intro,items:use};
  }

  function allChecks(){return read(CHECK_KEY);}
  function getCheck(id){const c=allChecks()[id];return c&&typeof c==='object'?c:null;}
  function setMark(id,index,mark,total){
    const all=allChecks(),c=all[id]&&typeof all[id]==='object'?all[id]:{marks:{}};
    c.marks=c.marks&&typeof c.marks==='object'?c.marks:{};
    if(mark)c.marks[index]=mark;else delete c.marks[index];
    c.n=total;c.at=today();
    if(Object.keys(c.marks).length)all[id]=c;else delete all[id];
    return write(CHECK_KEY,all);
  }
  // 逐題統計：hit／miss／未勾
  function score(id,total){
    const c=getCheck(id);if(!c)return null;
    let hit=0,miss=0;for(const k in c.marks){if(Number(k)>=total)continue;if(c.marks[k]==='hit')hit++;else if(c.marks[k]==='miss')miss++;}
    return hit+miss?{hit,miss,total,rate:hit/(hit+miss),at:c.at}:null;
  }
  // 失分清單：所有標為「漏掉」的項目
  function missed(points,bank){
    const byId=new Map((bank||[]).map(q=>[q.id,q])),checks=allChecks(),out=[];
    for(const id in checks){
      const data=points&&points[id];if(!data)continue;
      const list=items(data).items,c=checks[id];
      for(const k in c.marks||{}){if(c.marks[k]!=='miss')continue;const it=list[Number(k)];if(!it)continue;
        out.push({id,index:Number(k),title:it.title,body:it.body,subject:data.subject,year:data.year,questionNo:data.questionNo,at:c.at,question:byId.get(id)||null});}
    }
    return out.sort((a,b)=>String(b.at).localeCompare(String(a.at))||a.id.localeCompare(b.id)||a.index-b.index);
  }
  // 各科命中率（只算勾過的項目）
  function bySubject(points){
    const checks=allChecks(),m={};
    for(const id in checks){const data=points&&points[id];if(!data)continue;const s=score(id,items(data).items.length);if(!s)continue;
      const r=m[data.subject]||(m[data.subject]={subject:data.subject,hit:0,miss:0,questions:0});r.hit+=s.hit;r.miss+=s.miss;r.questions++;}
    return Object.values(m).map(r=>({...r,rate:r.hit/(r.hit+r.miss)}));
  }

  // 骨架回想排程：again→明天、回到第 0 級；ok→依 1、3、7、14 天往上；easy→多跳一級
  function allRecall(){return read(RECALL_KEY);}
  function rate(id,result,on){
    const all=allRecall(),day=on||today(),r=all[id]&&typeof all[id]==='object'?all[id]:{lvl:-1,n:0};
    let lvl=Number.isInteger(r.lvl)?r.lvl:-1;
    if(result==='again')lvl=0;else if(result==='easy')lvl=Math.min(INTERVALS.length-1,lvl+2);else lvl=Math.min(INTERVALS.length-1,lvl+1);
    all[id]={lvl,n:(r.n||0)+1,last:day,due:addDays(day,result==='again'?1:INTERVALS[lvl]),result};
    return write(RECALL_KEY,all)?all[id]:null;
  }
  // 出題順序：到期的舊卡（最早到期先）→ 沒做過的新卡（漏點多的題先，其次年度新的先）
  function queue(points,on){
    const day=on||today(),rec=allRecall(),ids=Object.keys(points||{}),due=[],fresh=[],later=[];
    for(const id of ids){const r=rec[id];if(!r)fresh.push(id);else if(r.due<=day)due.push(id);else later.push(id);}
    due.sort((a,b)=>rec[a].due.localeCompare(rec[b].due)||a.localeCompare(b));
    const missCount=id=>{const s=score(id,items(points[id]).items.length);return s?s.miss:0;};
    fresh.sort((a,b)=>missCount(b)-missCount(a)||points[b].year-points[a].year||a.localeCompare(b));
    later.sort((a,b)=>rec[a].due.localeCompare(rec[b].due));
    return {due,fresh,later,records:rec};
  }
  root.OfficialPoints={CHECK_KEY,RECALL_KEY,INTERVALS,today,addDays,items,allChecks,getCheck,setMark,score,missed,bySubject,allRecall,rate,queue};
})(typeof window!=='undefined'?window:this);
