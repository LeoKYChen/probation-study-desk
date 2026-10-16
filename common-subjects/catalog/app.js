/* Read-only Staresto v0.5 source browser. No localStorage, no upstream code. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const node=(tag,value,cls)=>{
 const x=document.createElement(tag);
 if(value!==undefined)x.textContent=String(value);
 if(cls)x.className=cls;
 return x;
};
const state={mode:"question",questions:[],resources:[],meta:null,filtered:[],
 page:0,selected:null,details:new Map(),inflight:new Map()};
const PAGE=30;
function message(error){
 const el=$("error");el.hidden=!error;
 el.textContent=error?String(error):"";
}
function appendLine(parent,tag,value,cls){const x=node(tag,value,cls);parent.append(x);return x;}
function fillSelect(id,values){
 const sel=$(id),current=sel.value;
 sel.replaceChildren(new Option("全部",""));
 for(const val of [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant")))
  sel.add(new Option(val,val));
 sel.value=values.includes(current)?current:"";
}
function repopulate(){
 const records=state.mode==="question"?state.questions:state.resources;
 fillSelect("typeFilter",records.map(x=>state.mode==="question"?x.type:x.type));
 fillSelect("statusFilter",records.map(x=>state.mode==="question"?x.status:x.coverage));
 fillSelect("sourceFilter",records.map(x=>state.mode==="question"?x.source:x.repo));
 $("typeFilter").previousElementSibling; // document label already provides name
}
function filter(){
 const source=state.mode==="question"?state.questions:state.resources;
 const term=$("search").value.trim().toLocaleLowerCase();
 const category=$("typeFilter").value,status=$("statusFilter").value,repo=$("sourceFilter").value;
 state.filtered=source.filter(x=>{
  if(category&&(state.mode==="question"?x.type:x.type)!==category)return false;
  if(status&&(state.mode==="question"?x.status:x.coverage)!==status)return false;
  if(repo&&(state.mode==="question"?x.source:x.repo)!==repo)return false;
  if(!term)return true;
  const parts=state.mode==="question"?
   [x.preview,x.id,x.type,x.status,x.source,x.sourceItemId,x.year,x.exam,x.sourcePath]:
   [x.path,x.repo,x.type,x.coverage,x.description];
  return parts.some(y=>String(y||"").toLocaleLowerCase().includes(term));
 });
 state.page=0;state.selected=null;
 $("detail").replaceChildren(node("p","請選擇一筆資料檢視出處與內容。"));
 renderPage();
}
function toLabel(row){
 if(state.mode==="question")return (row.preview||row.id).slice(0,145);
 return row.path;
}
function renderPage(){
 const total=state.filtered.length,number=Math.max(1,Math.ceil(total/PAGE));
 state.page=Math.min(state.page,number-1);
 const start=state.page*PAGE,slice=state.filtered.slice(start,start+PAGE);
 const host=$("results");host.replaceChildren();
 for(let i=0;i<slice.length;i++){
  const x=slice[i],absolute=start+i;
  const btn=node("button",undefined,"result");
  btn.type="button";btn.setAttribute("aria-pressed",String(state.selected===absolute));
  const label=state.mode==="question"?(x.year?x.year+" · ":"")+x.type+" · "+x.source:x.type+" · "+x.repo;
  appendLine(btn,"div",label,"meta");
  appendLine(btn,"strong",toLabel(x));
  const subtitle=state.mode==="question"?x.status+" ｜ "+x.rights+" ｜ "+x.sourceItemId:
    x.coverage+" ｜ "+Math.round(x.size/1024)+" KB";
  appendLine(btn,"div",subtitle,"snippet");
  btn.addEventListener("click",()=>selectItem(absolute));
  host.append(btn);
 }
 if(!slice.length)host.append(node("p","沒有符合條件的結果，可取消篩選或嘗試其他關鍵字。"));
 $("resultCount").textContent="找到 "+total.toLocaleString()+" 筆（每頁 "+PAGE+" 筆）";
 $("pageStatus").textContent=state.page+1+" / "+number;
 $("prevPage").disabled=state.page===0;$("nextPage").disabled=state.page>=number-1;
}
function textUrl(parent,label,url){
 if(!/^https:\/\/github\.com\/staresto-create\/|^https:\/\/staresto-create\.github\.io\//.test(url||""))return;
 const a=node("a",label+" ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";
 parent.append(a);
}
async function loadShard(file){
 if(!/^[a-zA-Z0-9_./-]+\.json$/.test(file)||file.includes(".."))throw Error("題庫來源路徑不合法。");
 if(state.details.has(file))return state.details.get(file);
 if(state.inflight.has(file))return state.inflight.get(file);
 const promise=fetch("./data/shards/"+file).then(r=>{
  if(!r.ok)throw Error("無法載入原始題目資料："+file);
  return r.json();
 }).then(data=>{
  if(!Array.isArray(data.records)||data.source!==file)throw Error("原始題庫格式不符。");
  state.details.set(file,data);state.inflight.delete(file);return data;
 }).catch(e=>{state.inflight.delete(file);throw e});
 state.inflight.set(file,promise);
 return promise;
}
function detailResource(row){
 const host=$("detail");host.replaceChildren();
 appendLine(host,"h3",row.path);
 appendLine(host,"p","類型："+row.type+"｜來源："+row.repo,"meta");
 appendLine(host,"p","收錄方式："+row.coverage);
 appendLine(host,"p","原始大小："+row.size.toLocaleString()+" bytes");
 appendLine(host,"p","SHA256："+row.sha256,"meta");
 if(row.description)appendLine(host,"p",row.description,"q");
 const p=node("p");textUrl(p,"在原作者 GitHub 查看檔案",row.url);host.append(p);
 appendLine(host,"p","本項僅供索引與來源核對；著作權依原權利人聲明，不因此改為本站 GPL 授權。","meta");
}
function showDetail(row){
 const host=$("detail");host.replaceChildren();
 appendLine(host,"h3",row.type+"｜"+(row.year||"年份未明"));
 appendLine(host,"p",row.status+"｜"+row.rights,"meta");
 appendLine(host,"p",row.stem||"未提供可解析的題幹","q");
 if(row.passage&&row.passage.text){
  appendLine(host,"h3","篇章｜"+(row.passage.title||row.passage.passageId));
  appendLine(host,"div",row.passage.text,"long");
 }
 const options=row.options||{};
 const entries=Object.entries(options);
 if(entries.length){
  appendLine(host,"h3","原選項");
  const list=node("ul",undefined,"choices");
  for(const [key,val] of entries){const li=node("li",key+". "+val,key===row.answer?"correct":"");list.append(li)}
  host.append(list);
 }
 if(row.answer)appendLine(host,"p","答案／參考答案："+row.answer,"answer");
 if(row.translation){appendLine(host,"h3","中文翻譯");appendLine(host,"div",row.translation,"long")}
 if(row.explanation){appendLine(host,"h3","作者解析／備註");appendLine(host,"div",row.explanation,"long")}
 appendLine(host,"p","原始資料："+row.sourceItemId+"｜"+row.exam+"｜"+row.examType,"meta");
 appendLine(host,"p",row.copyright,"meta");
 const p=node("p");textUrl(p,"檢查鎖定的原始檔案",row.sourceUrl);host.append(p);
 if(row.status!=="選擇題可核對")appendLine(host,"p","這筆資料尚不符合直接選擇題作答條件，不能視為已驗收可用題目。","meta");
}
async function selectItem(i){
 state.selected=i;renderPage();
 const x=state.filtered[i];if(!x)return;
 if(state.mode==="resource"){detailResource(x);return}
 const host=$("detail");host.replaceChildren(node("p","讀取詳情中……"));
 const key=x.id;
 try{
  const data=await loadShard(x.shard);
  if(state.selected!==i||state.mode!=="question"||state.filtered[i]?.id!==key)return;
  const row=data.records[x.position];
  if(!row||row.id!==key)throw Error("來源資料與索引不一致，已停止顯示。");
  showDetail(row);
 }catch(e){if(state.selected===i){host.replaceChildren(node("p","無法載入詳情："+e.message));message(e.message)}}
}
function setMode(mode){
 state.mode=mode;
 $("tabQuestion").setAttribute("aria-pressed",String(mode==="question"));
 $("tabResource").setAttribute("aria-pressed",String(mode==="resource"));
 $("search").value="";
 $("typeFilter").value="";$("statusFilter").value="";$("sourceFilter").value="";
 repopulate();filter();
}
function setStats(){
 const m=state.meta,host=$("stats");host.replaceChildren();
 for(const [title,val] of [
  ["來源檔案",m.originalFiles.toLocaleString()],
  ["結構化資料",m.jsonFiles.toLocaleString()+" 份"],
  ["待核對候選項目",m.normalizedRecords.toLocaleString()+" 筆"],
  ["已產生題庫資料",m.shards.toLocaleString()+" 組"]
 ])host.append(node("span",title+"："+val));
}
async function init(){
 try{
  const [index,source]=await Promise.all(["index.json","resources.json"].map(async file=>{
   const res=await fetch("./data/"+file);
   if(!res.ok)throw Error("無法載入已核對索引："+file);
   return res.json();
  }));
  if(index.meta.schema!=="staresto-normalized-v05"||
     index.records.length!==index.meta.normalizedRecords||
     source.records.length!==source.total)throw Error("索引資料不一致，已拒絕載入。");
  state.questions=index.records;state.resources=source.records;state.meta=index.meta;
  setStats();setMode("question");
 }catch(e){message("資料檢查失敗："+e.message)}
}
$("tabQuestion").addEventListener("click",()=>setMode("question"));
$("tabResource").addEventListener("click",()=>setMode("resource"));
$("search").addEventListener("input",filter);
for(const id of ["typeFilter","statusFilter","sourceFilter"])$(id).addEventListener("change",filter);
$("resetFilters").addEventListener("click",()=>{ $("search").value="";for(const id of ["typeFilter","statusFilter","sourceFilter"])$(id).value="";filter()});
$("prevPage").addEventListener("click",()=>{state.page--;state.selected=null;renderPage()});
$("nextPage").addEventListener("click",()=>{state.page++;state.selected=null;renderPage()});
init();
})();
