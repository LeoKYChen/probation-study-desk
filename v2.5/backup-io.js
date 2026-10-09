(function(root){
 'use strict';
 const core=root.Backup25;
 function normalize(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||!core.safe(data))throw Error('備份內容不是有效的紀錄物件');
  if(data.format==='probation-study-desk-sync')return core.validate(data);
  if(data.format==='probation-study-desk-backup'){
   if(Number(data.schemaVersion)>4)throw Error('備份版本比本版更新');
   return core.create(data.records,{});
  }
  if(data.format==='probation-daily-github-records'){
   if(data.schemaVersion!==1)throw Error('模擬題備份版本不相容');
   return core.create({},data.records);
  }
  if(data.format)throw Error('不支援此備份格式：'+data.format);
  if(!core.records(data))throw Error('找不到相容的學習紀錄');
  const values=Object.values(data);
  if(values.length&&values.every(r=>typeof r.answer==='string'&&typeof r.review==='boolean'&&typeof r.updatedAt==='string'))return core.create({},data);
  if(values.every(r=>['issue','scores','assessment','done','review','updatedAt','pointFeedback'].some(k=>Object.hasOwn(r,k))))return core.create(data,{});
  throw Error('無法辨識舊版紀錄，請保留原檔並回報');
 }
 root.BackupIO25={normalize};
 if(!root.document)return;
 const $=id=>document.getElementById(id),daily=!!$('upload'),input=$(daily?'upload':'importFile');
 function status(message){if(daily)$('notice').textContent=message;else{let n=$('backupIOStatus');if(!n){n=document.createElement('p');n.id='backupIOStatus';n.setAttribute('role','status');n.style.cssText='padding:12px 18px;background:#edf4e8;color:#244738';document.querySelector('.topbar').after(n);}n.textContent=message;}}
 function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 $(daily?'export':'exportButton').addEventListener('click',e=>{e.stopImmediatePropagation();try{root.Practice25?.flush();const data=core.local();download(data,'probation-all-records-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');status('已匯出考古題與模擬題的完整備份；兩個練習頁皆可匯入。');}catch(error){status('匯出失敗：'+error.message+'；現有紀錄未修改。');}},true);
 input.addEventListener('change',async e=>{e.stopImmediatePropagation();try{const f=input.files[0];if(!f)return;if(f.size>20*1024*1024)throw Error('檔案超過20MB');const incoming=normalize(JSON.parse(await f.text()));const n=Object.keys(incoming.study).length+Object.keys(incoming.daily).length;if(!n){status('備份讀取成功，但沒有作答紀錄；現有紀錄未修改。');return;}if(!confirm('匯入考古題 '+Object.keys(incoming.study).length+' 筆、模擬題 '+Object.keys(incoming.daily).length+' 筆。保留現有紀錄，衝突答案另存為替代稿。是否繼續？'))return;root.Practice25?.flush();const before=core.local();const merged=core.merge(before,incoming);core.apply(merged.data);status('已匯入 '+n+' 筆。'+(merged.conflicts.length?'其中 '+merged.conflicts.length+' 筆有差異，已保留現有答案與替代稿。':'')+'匯入前紀錄也已暫存備份。');}catch(error){status('匯入失敗：'+error.message+'；請保留備份原檔。');}finally{input.value='';}},true);

 function renderDrafts(){
  if(!root.Practice25)return;
  let panel=$('savedDrafts25');if(!panel){panel=document.createElement('details');panel.id='savedDrafts25';panel.style.cssText='margin:18px;padding:18px;border:1px solid #ccd7ca;border-radius:12px;background:white';document.querySelector('.topbar').after(panel);}
  panel.replaceChildren();const summary=document.createElement('summary');summary.textContent='查看已保存作答與匯入替代稿';panel.append(summary);
  const bank=root.Practice25.getQuestions(),records=root.Practice25.getRecords();let count=0;
  for(const [id,record] of Object.entries(records)){
   const text=record.issue||record.assessment?.answer||'';const alternatives=(record.syncAlternatives||[]).filter(a=>a.record?.issue||a.record?.assessment?.answer);
   if(!text&&!alternatives.length)continue;count++;const box=document.createElement('details');const label=document.createElement('summary');const q=bank.find(q=>q.id===id);label.textContent=(q?.title||id)+' · '+(text?text.length+' 字':'目前答案空白')+' · 替代稿 '+alternatives.length+' 份';box.append(label);
   function show(value,choose){const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit';pre.textContent=value;box.append(pre);const b=document.createElement('button');b.type='button';b.textContent=choose?'恢復此稿為目前答案':'開啟這題與答案';b.onclick=()=>{try{if(choose){if(!confirm('恢復此稿？目前版本仍會保存為替代稿。'))return;const data=core.local(),old=data.study[id],target=choose.record||{...old,issue:value};const rest=(old.syncAlternatives||[]).filter(a=>a!==choose&&JSON.stringify(a.record)!==JSON.stringify(target));data.study[id]={...target,issue:value,syncAlternatives:[...rest,{record:{...old,syncAlternatives:undefined},savedAt:old.updatedAt||null}],updatedAt:new Date().toISOString()};core.apply(core.clone(data));}if(q){root.Practice25.select(id);$('issueInput')?.scrollIntoView({behavior:'smooth',block:'center'});status('已開啟 '+(q.title||id)+'；作答欄 '+(root.Practice25.getState().issue||'').length+' 字。');}else status('此稿已保留，但目前題庫無對應題目。');}catch(error){status('恢復失敗：'+error.message+'；原稿仍保留。');}};box.append(b);}
   if(text)show(text,record.issue?null:{record:{...record,issue:text}});
   for(const alt of alternatives)show(alt.record.issue||alt.record.assessment.answer,alt);
   panel.append(box);
  }
  if(!count){const p=document.createElement('p');p.textContent='目前沒有已保存的作答內容。';panel.append(p);}
 }
 root.addEventListener('practice25:render',renderDrafts);root.addEventListener('practice25:changed',renderDrafts);root.addEventListener('backup25:applied',renderDrafts);renderDrafts();
})(typeof window==='undefined'?globalThis:window);
