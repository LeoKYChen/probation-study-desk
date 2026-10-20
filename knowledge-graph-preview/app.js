/* Isolated SVG relationship graph. No storage writes, no external libraries. */
(function(){
'use strict';
const M=window.KnowledgeGraphModel,data=M?M.visibleSubjects(window.STUDY_MAP_DATA||[]):[],bank=[...(window.QUESTION_BANK||[]),...(window.RELATED_QUESTION_BANK||[])];
const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg',W=1100,H=760;
const svg=$('graph'),viewport=$('viewport'),linkHost=$('links'),nodeHost=$('nodes');
let graph=null,chosen='少年事件處理法',selectedId='',scale=1,offsetX=0,offsetY=0;
let positions=new Map(),nodeEls=new Map(),edgeEls=[],gesture=null;
const element=(name,txt,cls)=>{const e=document.createElement(name);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
const sEl=(name,props)=>{const e=document.createElementNS(ns,name);Object.entries(props||{}).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;};
const link=(label,url)=>{const a=element('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
const safe=val=>M.safeUrl(val);
function base(id){const x=$(id);return x;}
function updateTransform(){
  viewport.setAttribute('transform','translate('+offsetX+' '+offsetY+') scale('+scale+')');
  $('zoomLabel').textContent=Math.round(scale*100)+'%';
}
function zoom(factor){
  const next=Math.min(3.1,Math.max(.55,scale*factor));
  const ratio=next/scale;
  offsetX=W/2-(W/2-offsetX)*ratio;
  offsetY=H/2-(H/2-offsetY)*ratio;
  scale=next;updateTransform();
}
function center(){scale=1;offsetX=0;offsetY=0;updateTransform();}
function fromEvent(e){
  const rect=svg.getBoundingClientRect();
  return {x:(e.clientX-rect.left)*W/rect.width,y:(e.clientY-rect.top)*H/rect.height};
}
function stableHash(s){
  let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}return h>>>0;
}
function layout(){
  positions=new Map();
  const subjectNodes=graph.nodes.filter(n=>n.type==='subject');
  const multi=subjectNodes.length>1;
  const anchors=multi?[{x:310,y:245},{x:790,y:245},{x:310,y:540},{x:790,y:540}]:
    [{x:550,y:365}];
  subjectNodes.forEach((s,i)=>positions.set(s.id,anchors[i]||{x:550,y:365}));
  for(const [i,s] of subjectNodes.entries()){
    const anchor=positions.get(s.id);
    const topics=graph.nodes.filter(n=>n.type==='topic'&&n.subject===s.subject);
    topics.forEach((topic,j)=>{
      const angle=j*Math.PI*2/Math.max(1,topics.length)-Math.PI/2;
      const r=multi?(topics.length>8?175:155):235;
      const wobble=(j%3-1)*18;
      positions.set(topic.id,{x:anchor.x+Math.cos(angle)*(r+wobble),
        y:anchor.y+Math.sin(angle)*(multi?r*.75:r*.89)});
    });
  }
  const questionNodes=graph.nodes.filter(n=>n.type==='question');
  questionNodes.forEach((q,i)=>{
    const edge=graph.edges.find(e=>e.target===q.id);
    const parent=edge?positions.get(edge.source):null;
    const anchor=positions.get('subject:'+q.subject)||{x:550,y:365};
    const centerPoint=parent||anchor;
    const h=stableHash(q.id);
    const angle=(h%360)*Math.PI/180;
    const radius=graph.cross?34+(h%34):52+(h%65);
    positions.set(q.id,{x:Math.max(32,Math.min(W-32,centerPoint.x+Math.cos(angle)*radius)),
      y:Math.max(38,Math.min(H-36,centerPoint.y+Math.sin(angle)*radius))});
  });
}
function edgesReposition(){
  for(const {edge,line} of edgeEls){
    const a=positions.get(edge.source),b=positions.get(edge.target);
    if(a&&b){line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);}
  }
}
function draw(){
  graph=M.buildGraph(data,bank,{cross:chosen==='cross',subject:chosen,search:$('search').value,
    maxTopics:chosen==='cross'?9:26,maxRowsPerTopic:chosen==='cross'?2:3});
  $('subjectStat').textContent=graph.stats.subjects;
  $('topicStat').textContent=graph.stats.topics;
  $('questionStat').textContent=graph.stats.questions;
  const stats=graph.stats;
  $('graphStatus').textContent=stats.matched+' 題已精確對應題庫｜'+(stats.questions-stats.matched)+' 題待對照';
  $('notices').textContent=(graph.cross?
    '跨科檢視：只有同一題庫 ID 在不同考科分類中出現時，才形成跨科連結。現在有 '+stats.sharedQuestions+
    ' 題共用題庫 ID；這不代表其爭點在法律上相同。':
    '連線表示既有考點分類與題次對應，不代表法律實體關係。')+
    ((stats.hiddenTopics||stats.hiddenRows)?' 為確保手機與電腦流暢，僅呈現部分節點（未顯示分類 '+stats.hiddenTopics+'、題次關聯 '+stats.hiddenRows+'）；請以搜尋縮小範圍。':'');
  linkHost.replaceChildren();nodeHost.replaceChildren();nodeEls=new Map();edgeEls=[];
  layout();
  for(const edge of graph.edges){
    const e=sEl('line',{});linkHost.append(e);edgeEls.push({edge,line:e});
  }
  edgesReposition();
  for(const n of graph.nodes){
    const p=positions.get(n.id);
    const g=sEl('g',{transform:'translate('+p.x+' '+p.y+')',tabindex:0,role:'button',
      'aria-label':n.type==='subject'?'考科 '+n.label:n.type==='topic'?'命題分類 '+n.label:'歷屆題目 '+n.label,
      'data-node-id':n.id});
    g.classList.add('graph-node',n.type);
    if(n.type==='question'&&!n.matched)g.classList.add('unmatched');
    const r=n.type==='subject'?24:n.type==='topic'?Math.min(15,7+Math.sqrt(n.count||1)*1.8):5.7;
    g.append(sEl('circle',{r}));
    if(n.type!=='question'){
      const t=sEl('text',{x:0,y:-r-11,'text-anchor':'middle'});
      const max=n.type==='subject'?16:15;
      t.textContent=n.label.length>max?n.label.slice(0,max-1)+'…':n.label;
      g.append(t);
    }
    const title=sEl('title');title.textContent=n.label;g.append(title);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);}});
    nodeHost.append(g);nodeEls.set(n.id,g);
  }
  const first=graph.nodes.find(n=>n.id===selectedId)||graph.nodes.find(n=>n.type==='subject');
  selectedId='';
  if(first)selectNode(first.id);else showEmpty('尚無符合條件的節點');
  center();
}
function sectionTitle(host,text){host.append(element('h3',text));}
function copyRows(host,rows){
  const ordered=rows.slice().sort((a,b)=>Number(b.year)-Number(a.year));
  sectionTitle(host,'歷屆題目與來源');
  if(!ordered.length){host.append(element('p','目前未有能精確定位的逐題資料。','empty'));return;}
  for(const row of ordered.slice(0,18)){
    const box=element('div',undefined,'record');
    box.append(element('strong',row.year+' 年第 '+row.no+' 題'));
    if(row.keywords)box.append(element('p',row.keywords));
    if(row.core||row.secondary)box.append(element('p','主考點：'+row.core+(row.secondary?'｜次考點：'+row.secondary:'')));
    box.append(element('p',row.matchStatus));
    const links=element('div',undefined,'record-links');
    if(row.questionId){
      links.append(link('進入正式站作答 ↗',
        'https://leokychen.github.io/probation-study-desk/v2.5/?q='+encodeURIComponent(row.questionId)));
    }
    if(safe(row.sourceUrl))links.append(link('查看題源 ↗',row.sourceUrl));
    if(!links.children.length)links.append(element('span','無已核實的題源連結','empty'));
    box.append(links);host.append(box);
  }
  if(ordered.length>18)host.append(element('p','為避免頁面過長，先顯示前 18 筆；請縮小搜尋範圍。'));
}
function showEmpty(message){const host=$('detailContent');host.replaceChildren(element('h2',message));}
function selectNode(id){
  const n=graph.nodes.find(item=>item.id===id);
  if(!n)return;selectedId=id;
  const around=new Set([id]);
  graph.edges.forEach(e=>{if(e.source===id)around.add(e.target);if(e.target===id)around.add(e.source);});
  for(const node of graph.nodes){
    const g=nodeEls.get(node.id);
    g.classList.toggle('selected',node.id===id);
    g.classList.toggle('faded',!around.has(node.id));
  }
  for(const item of edgeEls){
    const focus=item.edge.source===id||item.edge.target===id;
    item.line.classList.toggle('focus',focus);
    item.line.classList.toggle('faded',!focus);
  }
  const host=$('detailContent');host.replaceChildren();
  host.append(element('span',n.type==='subject'?'考科':n.type==='topic'?'命題分類':'歷屆題次','type'));
  host.append(element('h2',n.label));
  if(n.type==='subject'){
    const source=data.find(d=>d.subject===n.subject);
    host.append(element('p',source?.scope||'從考科出發，展開相關命題分類及歷屆題次。'));
    const stats=element('div',undefined,'stats');
    stats.append(element('span','已有分類 '+(source?.topics?.length||0)),
      element('span','整理題次 '+(source?.rows?.length||0)));
    host.append(stats);
    sectionTitle(host,'使用方式');
    host.append(element('p','在圖中選取分類節點，可查看歷屆命題內容。選取題次節點，可查閱對應來源與進入正式站練習。'));
  }else if(n.type==='topic'){
    if(n.detail)host.append(element('p','原始統計標示：'+n.detail));
    const stats=element('div',undefined,'stats');
    stats.append(element('span','整理計數 '+n.count),element('span','可定位題次 '+(n.rows?.length||0)));
    host.append(stats);
    if(n.rows?.length)copyRows(host,n.rows);
    else host.append(element('p','此分類尚無逐題定位資料。','empty'));
  }else{
    const records=n.rows||[];
    if(records.length>1){
      const groups=[...new Set(records.map(x=>x.subject))];
      host.append(element('p','此題次出現在 '+groups.join('、')+' 的既有分類資料中；並非系統自行推論跨科爭點。'));
    }
    copyRows(host,records);
  }
}
function startPointer(event){
  if(event.button!==0)return;
  const target=event.target.closest('.graph-node');
  const p=fromEvent(event);
  gesture={pointerId:event.pointerId,nodeId:target?.getAttribute('data-node-id')||null,
    startX:p.x,startY:p.y,oldX:offsetX,oldY:offsetY,
    position:target?{...positions.get(target.getAttribute('data-node-id'))}:null,moved:false};
  svg.setPointerCapture(event.pointerId);
  svg.classList.add('grabbing');
  event.preventDefault();
}
function movePointer(e){
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  const p=fromEvent(e),dx=p.x-gesture.startX,dy=p.y-gesture.startY;
  if(Math.abs(dx)+Math.abs(dy)>6)gesture.moved=true;
  if(!gesture.moved)return;
  if(gesture.nodeId&&gesture.position){
    const pos=positions.get(gesture.nodeId);
    pos.x=gesture.position.x+dx/scale;pos.y=gesture.position.y+dy/scale;
    nodeEls.get(gesture.nodeId).setAttribute('transform','translate('+pos.x+' '+pos.y+')');
    edgesReposition();
  }else{offsetX=gesture.oldX+dx;offsetY=gesture.oldY+dy;updateTransform();}
}
function endPointer(e){
  if(!gesture||gesture.pointerId!==e.pointerId)return;
  if(gesture.nodeId&&!gesture.moved)selectNode(gesture.nodeId);
  gesture=null;svg.classList.remove('grabbing');
}
function init(){
  if(!M||!data.length||!bank.length){showEmpty('重點整理或題庫資料載入失敗');$('graphStatus').textContent='載入失敗';return;}
  const select=$('subjectSelect');
  select.append(new Option('四科跨科題源檢視（僅核對既有資料）','cross'));
  data.forEach(s=>select.append(new Option(s.subject,s.subject)));
  select.value=chosen;
  select.onchange=()=>{chosen=select.value;selectedId='';draw();};
  $('search').addEventListener('input',()=>{selectedId='';draw();});
  $('reset').onclick=()=>{chosen='少年事件處理法';select.value=chosen;$('search').value='';selectedId='';draw();};
  $('zoomIn').onclick=()=>zoom(1.22);
  $('zoomOut').onclick=()=>zoom(1/1.22);
  $('zoomReset').onclick=center;
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
  svg.addEventListener('pointerdown',startPointer);
  svg.addEventListener('pointermove',movePointer);
  svg.addEventListener('pointerup',endPointer);
  svg.addEventListener('pointercancel',endPointer);
  draw();
}
try{init();}catch(err){console.error(err);showEmpty('關聯圖載入發生錯誤，請回報維護者。');$('graphStatus').textContent='載入發生錯誤';}
})();
