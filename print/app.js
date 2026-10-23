(function(){
 'use strict';
 const $=id=>document.getElementById(id), model=window.PSDEssayPrint;
 const chosen=new Set();let list=[],errors=[],fresh=[];
 const escapeCheck=uid=>chosen.has(uid);
 const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=String(text);return n;};
 function message(value,bad=false){$('notice').textContent=value;$('notice').dataset.error=bad?'true':'false';}
 function appendText(host,tag,cls,value){const n=el(tag,cls,value);host.append(n);return n;}
 async function dailyQuestions(){
  try{
   const response=await fetch('../daily-simulation/questions.json',{cache:'no-cache'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!Array.isArray(data.questions))throw Error('每日題庫格式不符');
   return data.questions;
  }catch(error){
   const raw=localStorage.getItem('daily-reading-test:dataset');
   if(raw){try{
    const cache=JSON.parse(raw);
    if(Array.isArray(cache.questions))return cache.questions;
   }catch{}}
   errors.push('每日模擬題題幹目前無法讀取：'+error.message+'。請恢復網路後重新讀取，避免列印沒有題幹的資料。');
   return [];
  }
 }
 const nonblank=r=>r.sections.some(s=>s.body.trim());
 function visible(){
  const module=$('module').value,q=$('search').value.trim().toLowerCase();
  return list.filter(r=>(module==='all'||r.category===module)&&(!q||[r.title,r.meta,r.categoryLabel,r.recordId].join(' ').toLowerCase().includes(q)));
 }
 function showList(){
  const rows=visible();const host=$('recordList');host.replaceChildren();
  for(const r of rows){
   const wrap=el('div','record-item'),label=el('label'),check=document.createElement('input');
   check.type='checkbox';check.checked=escapeCheck(r.uid);
   check.setAttribute('aria-label','選擇 '+r.title);
   check.addEventListener('change',()=>{if(check.checked){
    if(chosen.size>=30){check.checked=false;message('一次最多選擇30題，請先列印這一批。',true);return;}
    chosen.add(r.uid);
   }else chosen.delete(r.uid);
   $('count').textContent='已選 '+chosen.size+' 題';$('print').disabled=true;
   });
   wrap.append(check);appendText(label,'strong','',r.title);appendText(label,'small','',r.categoryLabel+' · '+r.meta);
   wrap.append(label);label.addEventListener('click',e=>{if(e.target!==label&&e.target.tagName==='A')return;check.click()});host.append(wrap);
  }
  if(!rows.length)appendText(host,'p','small','這個篩選條件下沒有已保存的答案。');
  $('count').textContent='可列印 '+rows.length+' 題 · 已選 '+chosen.size+' 題';
 }
 function createSheet(r){
  const sheet=el('article','print-sheet');
  appendText(sheet,'p','sheet-eyebrow','觀護人學習平台｜'+r.categoryLabel);
  appendText(sheet,'h2','',r.title);
  appendText(sheet,'p','meta',r.meta+(r.updatedAt?' · 最後保存：'+r.updatedAt.slice(0,16).replace('T',' '):''));
  const q=document.createElement('section');appendText(q,'h3','','題目');appendText(q,'div','body',r.question||'（無題目內容）');sheet.append(q);
  if(typeof r.source==='string'&&r.source.trim())appendText(sheet,'p','source','題庫來源：'+r.source);
  for(const part of r.sections){
   if(!part.body.trim())continue;
   if(part.group==='feedback'&&!$('includeFeedback').checked)continue;
   if(part.group==='review'&&!$('includeReview').checked)continue;
   if(part.group==='revision'&&!$('includeRevision').checked)continue;
   const block=document.createElement('section');
   appendText(block,'h3','',part.title);
   appendText(block,'div','body',part.body);
   sheet.append(block);
  }
  appendText(sheet,'p','foot','個人申論／作文學習紀錄；AI 評語及本站參考評量均非正式閱卷結果。');
  return sheet;
 }
 function preview(){
  const selected=list.filter(r=>chosen.has(r.uid));const paper=$('paper');
  if(!selected.length){paper.replaceChildren();$('print').disabled=true;message('請先勾選至少一題。',true);return;}
  if(selected.length>30){message('一次最多30題。',true);return;}
  paper.replaceChildren(...selected.map(createSheet));
  fresh=selected.map(r=>r.uid);
  $('print').disabled=false;
  message('已產生 '+selected.length+' 題 A4 紙本預覽。確認題目、答案和批改評語正確後，可列印或儲存 PDF。');
  paper.scrollIntoView({block:'start',behavior:'smooth'});
 }
 async function refresh(){
  $('reload').disabled=true;message('正在讀取題庫及本機學習紀錄…');
  try{
   errors=[];
   const daily=await dailyQuestions();
   const legacyPast=[...(window.QUESTION_BANK||[]),...(window.RELATED_QUESTION_BANK||[])];
   const approvedPolice=window.PolicePastPaperIntegration?.approved||[];
   const past=[...legacyPast,...approvedPolice];
   const essays=window.PSD_ESSAY_QUESTIONS||[];
   if(legacyPast.length!==426)errors.push('原有考古題題庫目前載入 '+legacyPast.length+' 題，預期426題；請重新整理，以免題幹不完整。');
   if(approvedPolice.length!==127)errors.push('警察預防組核准原題目前載入 '+approvedPolice.length+' 題，預期127題；請確認離線資料已更新。');
   if(new Set(past.map(q=>q.id)).size!==past.length)errors.push('題庫識別碼重複，為避免作答錯配請勿列印。');
   if(essays.length!==120)errors.push('國文作文改編題庫目前 '+essays.length+' 題，預期120題；請重新整理。');
   if(daily.length&&daily.length!==125)errors.push('每日模擬題目前讀取 '+daily.length+' 題，可能與原題庫不同。');
   const output=model.printRecords(localStorage,{past,daily,essays});
   list=output.records;errors.push(...output.errors);
   for(const id of [...chosen])if(!list.some(r=>r.uid===id))chosen.delete(id);
   $('paper').replaceChildren();$('print').disabled=true;showList();
   const msg='已讀取 '+list.length+' 筆有作答內容的紀錄。未儲存的新文字不會出現在這裡。';
   message(msg+(errors.length?'\n需要注意：'+errors.join('；'):''),!!errors.length);
  }catch(e){message('讀取失敗，沒有變更任何學習紀錄：'+e.message,true);}
  finally{$('reload').disabled=false;}
 }
 const fromLink=new URLSearchParams(location.search).get('module');
 if(['study30','past','daily','common'].includes(fromLink))$('module').value=fromLink;
 $('module').addEventListener('change',showList);
 $('search').addEventListener('input',showList);
 for(const id of ['includeFeedback','includeReview','includeRevision'])$(id).addEventListener('change',()=>{
  if(fresh.length){const selected=list.filter(r=>fresh.includes(r.uid));$('paper').replaceChildren(...selected.map(createSheet));}
 });
 $('selectVisible').addEventListener('click',()=>{for(const r of visible()){if(chosen.size>=30)break;chosen.add(r.uid);}showList();$('print').disabled=true;});
 $('selectNone').addEventListener('click',()=>{chosen.clear();showList();$('paper').replaceChildren();$('print').disabled=true;fresh=[];});
 $('preview').addEventListener('click',preview);
 $('print').addEventListener('click',()=>{
   if(!fresh.length)return;
   if(errors.length&&list.some(r=>fresh.includes(r.uid)&&r.question.startsWith('（題庫'))){message('有題目題幹無法讀取，為避免印出不完整的題目，請重新整理或補上題庫。',true);return;}
   window.print();
 });
 $('reload').addEventListener('click',refresh);
 refresh();
})();
