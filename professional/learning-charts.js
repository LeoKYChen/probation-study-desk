/* Read-only SVG views of existing self-assessments. No storage or scoring writes. */
(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const PALETTE=['#7651a3','#1d6c9c','#a65e11','#a13e62','#28705c','#735326','#435caa'];
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const svg=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 function radar(host,axes,{title,onSelect,selected}={}){
  host.replaceChildren();
  const chart=svg('svg',{viewBox:'0 0 660 560',class:'learning-radar',role:onSelect?'group':'img','aria-label':title});
  chart.append(svg('title',{},title));
  const point=(i,r)=>{const a=-Math.PI/2+2*Math.PI*i/axes.length;return [330+Math.cos(a)*r,270+Math.sin(a)*r];};
  const points=scale=>axes.map((_,i)=>point(i,155*scale).join(',')).join(' ');
  for(const level of [1,.75,.5,.25]){
   chart.append(svg('polygon',{points:points(level),class:'radar-grid'}));
   chart.append(svg('text',{x:336,y:270-155*level-3,class:'radar-scale'},String(level*100)));
  }
  for(let i=0;i<axes.length;i++){const p=point(i,155);chart.append(svg('line',{x1:330,y1:270,x2:p[0],y2:p[1],class:'radar-grid'}));}
  const valid=a=>Number.isFinite(a.value);
  // A missing self-assessment is never plotted as zero or bridged by a filled shape.
  if(axes.every(valid))chart.append(svg('polygon',{points:axes.map((a,i)=>point(i,155*a.value/100).join(',')).join(' '),class:'radar-area'}));
  if(!axes.every(valid))axes.forEach((a,i)=>{const next=(i+1)%axes.length;if(valid(a)&&valid(axes[next])){const p=point(i,155*a.value/100),q=point(next,155*axes[next].value/100);chart.append(svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'radar-segment'}));}});
  axes.forEach((a,i)=>{
   if(valid(a)){
    const [x,y]=point(i,155*a.value/100),dot=svg('circle',{cx:x,cy:y,r:5,class:'radar-dot',style:'--axis-color:'+PALETTE[i%PALETTE.length]});
    dot.append(svg('title',{},a.label+'：'+a.value+'%'));chart.append(dot);
   }
   const [x,rawY]=point(i,205),y=rawY-(i===0?24:0),text=svg('text',{x,y,'text-anchor':'middle',style:'--axis-color:'+PALETTE[i%PALETTE.length],class:'radar-label'+(selected===a.label?' selected':'')});
   const chunks=a.label.length>8?[a.label.slice(0,7),a.label.slice(7)]:[a.label];
   chunks.forEach((t,j)=>text.append(svg('tspan',{x,dy:j?19:0},t)));
   text.append(svg('tspan',{x,dy:21,class:'radar-value'},valid(a)?a.value+'%':'尚無資料'));
   if(onSelect){
    text.setAttribute('role','button');text.setAttribute('tabindex','0');text.setAttribute('aria-label','查看'+a.label+'指標');
    text.addEventListener('click',()=>onSelect(a.label));
    text.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(a.label);}});
   }
   chart.append(text);
  });
  host.append(chart);
  const list=node('div',undefined,'radar-values');
  for(const [index,a] of axes.entries()){
   const item=node(onSelect?'button':'div',undefined,'radar-value-item');
   item.style.setProperty('--axis-color',PALETTE[index%PALETTE.length]);
   item.append(node('span',a.label),node('strong',valid(a)?a.value+'%':'尚無資料'));
   if(onSelect){item.type='button';item.setAttribute('aria-pressed',String(selected===a.label));item.addEventListener('click',()=>onSelect(a.label));}
   list.append(item);
  }
  host.append(list);
 }
 function subjectAxes(subject,rows,today,days){
  const rubric=root.Study30Rubric,rule=rubric.RULES[rubric.subjectType(subject)];
  const limit=days==='all'?null:new Date(Date.parse(today+'T00:00:00Z')-(Number(days)-1)*86400000).toISOString().slice(0,10);
  const selected=rows.filter(r=>r.subject===subject&&r.day<=today&&(!limit||r.day>=limit));
  return rule.criteria.map(c=>{
   const values=selected.flatMap(r=>r.criteria.filter(x=>x.id===c.id).map(x=>x.value));
   return {label:c.label,value:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length/4*100):null};
  });
 }
 root.Study30LearningCharts={radar,subjectAxes};
})(window);
