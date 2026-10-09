(function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function model(q,state,mode,outline=[]){
  if(!q)throw Error('請先選擇考古題');
  if(!['practice','review'].includes(mode))throw Error('列印類型不符');
  const base={mode,title:q.title,year:q.year,subject:q.subject,examTypes:q.examTypes||[q.examType||'觀護人'],body:q.body,source:q.sourceUrl||'',date:new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
  if(mode==='practice')return base;
  const a=state.assessment,feedback=state.pointFeedback||{};
  const criteria=(a?.evidence||[]).map((row,i)=>({...row,feedback:feedback[i+':'+row.label]||null}));
  return {...base,answer:state.issue||'',score:state.scoreSource==='adjusted'?Object.values(state.scores||{}).reduce((s,n)=>s+Number(n||0),0):a?.total??null,scoreSource:state.scoreSource,stale:!!a&&a.answer!==state.issue,criteria,improvements:a?.improvements||[],warnings:a?.warnings||[],outline,review:!!state.review,assessed:!!a};
 }
 function html(m){
  const h=escape;
  const title=m.mode==='practice'?'考古題練習卷':'考古題複習卷';
  const source=/^https?:\/\//i.test(m.source)?'<p class="source">原卷來源：'+h(m.source)+'</p>':'';
  let content='<h2>題目</h2><div class="text">'+h(m.body)+'</div>'+source;
  if(m.mode==='practice')content+='<h2>作答區</h2><p>姓名：＿＿＿＿＿＿　日期：＿＿＿＿＿＿　用時：＿＿＿＿</p><div class="lines">'+Array.from({length:18},()=>'<div class="line"></div>').join('')+'</div>';
  else{
   content+='<h2>我的作答</h2><div class="text">'+h(m.answer||'尚未作答')+'</div><h2>參考分數與覆核</h2><p>'+(m.score===null?'尚無可列示分數':h(m.score)+(m.scoreSource==='adjusted'?'／100 · 人工調整分數':'／100 · 系統參考分數'))+(m.stale?'；以下是上次判定，答案修改後尚未重新判定。':'')+'</p><p>分數僅供練習參考，非官方閱卷結果。</p>';
   const status={'reference-evidence':'找到參考線索（正確性待覆核）',evidence:'已辨識',partial:'部分辨識',missing:'未辨識',manual:'需人工核對'};
   content+='<h2>逐點核對與回饋</h2>';
   if(!m.criteria.length)content+='<p>尚無逐點核對結果。</p>';
   for(const r of m.criteria){content+='<section class="criterion"><h3>'+h(r.label)+' · '+h(status[r.status]||r.status||'待核對')+'</h3><p>'+h(r.hint)+'</p>'+(r.evidence?'<blockquote>'+h(r.evidence)+'</blockquote>':'');if(r.feedback)content+='<p>我的覆核：'+h(r.feedback.choice)+'；'+h(r.feedback.note)+(r.feedback.answerSnapshot&&r.feedback.answerSnapshot!==m.answer?'（舊稿回饋）':'')+'</p>';content+='</section>';}
   const weak=m.criteria.filter(r=>!r.feedback?.resolved&&(r.feedback?.weakness||['missing','partial','manual'].includes(r.status)));
   content+='<h2>本題補強項目</h2>'+(m.review?'<p>本題已標記待複習。</p>':'')+'<ul>'+[...m.improvements,...weak.map(r=>r.label+'：'+(r.hint||''))].filter((v,i,a)=>a.indexOf(v)===i).map(v=>'<li>'+h(v)+'</li>').join('')+'</ul>';
   if(!m.improvements.length&&!weak.length&&!m.review)content+='<p>目前沒有列出的補強項目。</p>';
   if(m.outline.length)content+='<h2>參考答題方向（待覆核）</h2><ol>'+m.outline.map(v=>'<li>'+h(v)+'</li>').join('')+'</ol>';
   if(m.warnings.length)content+='<h2>判定提醒</h2><ul>'+m.warnings.map(v=>'<li>'+h(v)+'</li>').join('')+'</ul>';
  }
  return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>'+h(title+'｜'+m.title)+'</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{color:#111;font:11pt/1.7 "Noto Sans CJK TC","Microsoft JhengHei",sans-serif;margin:0}h1{font-size:20pt;margin:0 0 5mm}h2{font-size:14pt;margin:8mm 0 3mm;break-after:avoid}h3{font-size:11pt;margin:3mm 0;break-after:avoid}header{border-bottom:1px solid #888;padding-bottom:4mm}p{margin:2mm 0}.text{white-space:pre-wrap;overflow-wrap:anywhere}.source{font-size:9pt;overflow-wrap:anywhere;color:#444}li{margin:2mm 0;overflow-wrap:anywhere}blockquote{border-left:2px solid #888;margin:3mm 0;padding:0 4mm;white-space:pre-wrap;overflow-wrap:anywhere}.line{height:10mm;border-bottom:1px solid #bbb;break-inside:avoid}footer{margin-top:7mm;border-top:1px solid #888;font-size:9pt;padding-top:3mm}</style></head><body><header><h1>'+h(title)+'</h1><strong>'+h(m.title)+'</strong><p>'+h(m.subject)+' · '+h(m.examTypes.join('／'))+' · 列印日期 '+h(m.date)+'</p></header>'+content+'<footer>觀護人練習臺 · '+h(title)+'</footer></body></html>';
 }
 root.StudyPrint25={model,html};if(!root.document)return;
 const app=root.Practice25;if(!app)return;
 const tools=document.querySelector('.topbar-tools');
 let busy=false;
 for(const [mode,label] of [['practice','列印練習卷'],['review','列印複習卷']]){
  const b=document.createElement('button');b.type='button';b.className='data-btn';b.textContent=label;
  b.onclick=()=>{if(busy)return;app.flush();const q=app.getQuestion();if(!q){alert('請先選擇考古題');return;}const state=app.getState(),outline=[...document.querySelectorAll('#directionList li')].map(n=>n.textContent);const m=model(q,state,mode,outline);const frame=document.createElement('iframe');frame.title=label;frame.style.cssText='position:fixed;left:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';busy=true;let started=false;
   const cleanup=()=>{busy=false;frame.remove();};
   frame.onload=async()=>{if(started)return;started=true;try{await frame.contentDocument.fonts.ready;frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});frame.contentWindow.focus();frame.contentWindow.print();}catch(error){cleanup();alert('列印未能啟動：'+error.message);}};
   frame.srcdoc=html(m);document.body.append(frame);
   // Some browsers omit afterprint; release the button for a later print attempt.
   setTimeout(()=>{busy=false;},30000);
  };tools.append(b);
 }
})(typeof window==='undefined'?globalThis:window);
