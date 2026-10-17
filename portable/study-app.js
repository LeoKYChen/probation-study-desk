(function(){
'use strict';
const $=id=>document.getElementById(id);
const KEY='psd-portable-study-v1',FORMAT='psd-portable-study-v1';
const data=JSON.parse($('embedded-data').textContent);
const banks={past:data.past,daily:data.daily,essay:data.essays,news:data.news};
const fields=['issues','basis','analysis','conclusion','fullAnswer','feedback'];
let mode='past',subject='',query='',visible=[],position=0,activeKey='',dirty=false,saveTimer=0;
let storageAvailable=false,saved={format:FORMAT,schemaVersion:1,records:{},conflicts:[]};
const copy=x=>JSON.parse(JSON.stringify(x));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function showStatus(message,error=false){
 $('state').textContent=message+(storageAvailable?'\n本機自動儲存已啟用，但仍須下載 JSON 保護紀錄。':'\n此瀏覽器的檔案網址儲存不可用，請務必下載 JSON，否則關閉後可能遺失。');
 $('state').classList.toggle('error',error||!storageAvailable);
}
try{
 const temp='psd-portable-storage-test';
 localStorage.setItem(temp,'ok');
 storageAvailable=localStorage.getItem(temp)==='ok';
 localStorage.removeItem(temp);
 const raw=localStorage.getItem(KEY);
 if(raw){
  const val=JSON.parse(raw);
  if(val.format===FORMAT&&val.schemaVersion===1&&isObj(val.records)&&Array.isArray(val.conflicts))
   saved=val;
  else showStatus('偵測到無法辨識的本機資料格式，原始資料未修改，請檢查既有備份。',true);
 }
}catch(e){storageAvailable=false;}
function persist(){
 if(!storageAvailable){showStatus('目前作答只保留在本頁記憶體中，請下載 JSON。',true);return false;}
 try{localStorage.setItem(KEY,JSON.stringify(saved));showStatus('已將目前內容保存至本機。');return true;}
 catch(e){storageAvailable=false;showStatus('瀏覽器拒絕儲存：'+e.message+'。請立即下載 JSON。',true);return false;}
}
function uid(item){return mode+':'+item.id;}
function filterBank(){
 const list=banks[mode];
 let subjects=[...new Set(list.map(x=>x.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
 $('subject').replaceChildren();
 let all=document.createElement('option');all.value='';all.textContent='全部科目';$('subject').append(all);
 for(const x of subjects){const option=document.createElement('option');option.value=x;option.textContent=x;$('subject').append(option);}
 if(!subjects.includes(subject))subject='';
 $('subject').value=subject;
 applyFilter();
}
function applyFilter(){
 const q=$('search').value.trim().toLowerCase(),m=mode;
 visible=banks[m].filter(item=>(!subject||item.subject===subject)&&(!q||
   [item.title,item.subject,item.date,item.year,item.body].filter(Boolean).join(' ').toLowerCase().includes(q)));
 if(position>=visible.length)position=Math.max(0,visible.length-1);
 $('count').textContent='目前 '+visible.length+' 題／篇。已在這份離線檔保存 '+Object.keys(saved.records).length+' 份作答。';
 const list=$('resultList');list.replaceChildren();
 for(let i=0;i<Math.min(visible.length,150);i++){
  const q=visible[i],b=document.createElement('button');
  b.type='button';b.textContent=(i+1)+'. '+q.title;b.setAttribute('aria-current',i===position?'true':'false');
  b.onclick=()=>switchItem(i);
  list.append(b);
 }
 if(visible.length>150){const p=document.createElement('p');p.className='muted';p.textContent='目前先顯示前150筆；可搜尋或篩選科目縮小範圍。';list.append(p);}
 loadItem();
}
function item(){return visible[position]||null;}
function capture(){
 if(!activeKey||mode==='news')return;
 let record={};
 for(const f of fields)record[f]=$(f).value;
 const prior=saved.records[activeKey];
 const before=prior?fields.map(k=>prior[k]||'').join('\u0000'):'';
 const after=fields.map(k=>record[k]).join('\u0000');
 if(before!==after){
  record.updatedAt=new Date().toISOString();
  saved.records[activeKey]=record;
  dirty=false;persist();
 }
}
function autosave(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{capture();},450);}
function switchItem(index){
 clearTimeout(saveTimer);if(dirty)capture();
 position=index;loadItem();
}
function loadItem(){
 const q=item(),present=Boolean(q);activeKey=present?uid(q):'';
 $('practice').hidden=!present;
 if(!present)return;
 $('title').textContent=q.title;
 $('meta').textContent=[q.subject,q.year?q.year+'年':'',q.date,q.category].filter(Boolean).join(' · ');
 $('stem').textContent=q.body;
 $('position').textContent=(position+1)+'／'+visible.length;
 $('prev').disabled=position===0;$('next').disabled=position===visible.length-1;
 const news=mode==='news';
 $('editor').hidden=news;
 $('reference').hidden=true;
 $('reference').textContent=q.reference||'目前沒有另附參考重點。';
 const record=saved.records[activeKey]||{};
 for(const f of fields)$(f).value=record[f]||'';
 dirty=false;
 for(const el of $('resultList').querySelectorAll('button'))el.setAttribute('aria-current','false');
 const active=$('resultList').querySelectorAll('button')[position];if(active)active.setAttribute('aria-current','true');
}
function setMode(m){
 if(!banks[m])return;
 clearTimeout(saveTimer);if(dirty)capture();
 mode=m;subject='';position=0;$('search').value='';
 document.querySelectorAll('nav [data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m?'true':'false'));
 filterBank();
}
function saveAsJson(){
 clearTimeout(saveTimer);if(dirty)capture();
 const bundle={format:FORMAT,schemaVersion:1,exportedAt:new Date().toISOString(),source:'file:// offline study desk',records:copy(saved.records),conflicts:copy(saved.conflicts)};
 const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='觀護人離線練習紀錄-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 showStatus('已要求下載 JSON。請到「下載項目」實際確認檔案存在。');
}
function validRecord(r){
 return isObj(r)&&fields.every(f=>r[f]===undefined||(typeof r[f]==='string'&&r[f].length<=1000000));
}
function safeObj(v){
 if(v===null||['string','number','boolean'].includes(typeof v))return true;
 if(Array.isArray(v))return v.length<2500&&v.every(safeObj);
 return isObj(v)&&Object.keys(v).length<5000&&Object.entries(v).every(([k,val])=>
   !['__proto__','constructor','prototype'].includes(k)&&k.length<240&&safeObj(val));
}
async function importJson(event){
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 if(file.size>20*1024*1024){showStatus('檔案超過20MB，沒有匯入。',true);return;}
 try{
  const data=JSON.parse(await file.text());
  if(data.format!==FORMAT||data.schemaVersion!==1||!isObj(data.records)||!Array.isArray(data.conflicts)||
     Object.keys(data.records).length>3000||!safeObj(data))throw Error('只接受本離線版匯出的安全 JSON（非正式網站備份格式）');
  for(const [id,record] of Object.entries(data.records))
   if((!/^(past|daily|essay|news):.+$/u.test(id)||id.length>350)||!validRecord(record))throw Error('紀錄格式錯誤：'+id);
  clearTimeout(saveTimer);if(dirty)capture();
  if(!confirm('匯入前請先下載目前這份 JSON 備份。\n接下來只新增缺少的紀錄；不同答案將保留本機版本並另外保存衝突紀錄。確定已備份並繼續？'))return;
  const merged=copy(saved),seen=new Set(merged.conflicts.map(JSON.stringify));
  let added=0,conflicts=0;
  for(const [id,record] of Object.entries(data.records)){
   if(!own(merged.records,id)){merged.records[id]=copy(record);added++;}
   else if(JSON.stringify(merged.records[id])!==JSON.stringify(record)){
    const item={id,existing:copy(merged.records[id]),incoming:copy(record)};
    const check=JSON.stringify(item);
    if(!seen.has(check)){merged.conflicts.push(item);seen.add(check);conflicts++;}
   }
  }
  for(const record of data.conflicts){const v=JSON.stringify(record);if(!seen.has(v)){merged.conflicts.push(copy(record));seen.add(v);}}
  if(merged.conflicts.length>3500)throw Error('衝突紀錄過多，請先備份並分批匯入');
  saved=merged;persist();filterBank();
  showStatus('匯入完成：新增 '+added+' 筆、保留 '+conflicts+' 個不同答案版本。匯出 JSON 時會一併包含衝突版本。');
 }catch(e){showStatus('匯入取消，資料未被取代：'+e.message,true);}
}
for(const field of fields)$(field).addEventListener('input',autosave);
document.querySelectorAll('nav [data-mode]').forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
$('subject').onchange=()=>{if(dirty)capture();subject=$('subject').value;position=0;applyFilter();};
$('search').oninput=()=>{if(dirty)capture();position=0;applyFilter();};
$('prev').onclick=()=>switchItem(Math.max(0,position-1));
$('next').onclick=()=>switchItem(Math.min(visible.length-1,position+1));
$('save').onclick=()=>{clearTimeout(saveTimer);capture();showStatus('已執行保存；建議下載 JSON 備份。');};
$('export').onclick=saveAsJson;
$('import').onchange=importJson;
$('showReference').onclick=()=>{$('reference').hidden=!$('reference').hidden;};
$('copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('fullAnswer').value);showStatus('已複製答案。');}
 catch{showStatus('此瀏覽器在 file:// 無法使用剪貼簿權限，可直接選取答案文字複製。',true);}
};
$('print').onclick=()=>{if(dirty)capture();window.print();};
window.addEventListener('beforeunload',()=>{if(dirty)capture();});
setMode('past');
showStatus('離線版已載入，題庫已內嵌，不需要網路。');
})();