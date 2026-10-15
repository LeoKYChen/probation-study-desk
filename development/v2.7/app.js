"use strict";
// Demo fallback retained only if full official-index download has not succeeded.
const DEMO_LAWS=[
 {id:"C0010011",law:"少年事件處理法",article:"第1條",body:"為保障少年健全之自我成長，調整其成長環境，並矯治其性格，特制定本法。",modified:"112年6月21日",topic:"立法目的"},
 {id:"C0010011",law:"少年事件處理法",article:"第2條",body:"本法稱少年者，謂十二歲以上十八歲未滿之人。",modified:"112年6月21日",topic:"少年定義"},
 {id:"C0010011",law:"少年事件處理法",article:"第3-1條",body:"詢問或訊問少年時，應通知其法定代理人、現在保護少年之人或其他適當之人陪同在場。但經合法通知，無正當理由不到場或有急迫情況者，不在此限。\n\n依法應於二十四小時內護送少年至少年法院之事件，等候前項陪同之人到場之時間不予計入，並應釋明其事由。但等候時間合計不得逾四小時。\n\n少年因精神或其他心智障礙無法為完全之陳述者，必要時，得請兒童及少年心理衛生或其他專業人士協助。\n少年不通曉詢問或訊問之人所使用之語言者，應由通譯傳譯之。其為聽覺、語言或多重障礙者，除由通譯傳譯外，並得以文字、手語或其他適當方式詢問或訊問，亦得許其以上開方式表達。",modified:"112年6月21日",topic:"詢問訊問程序保障"},
 {id:"I0030002",law:"保安處分執行法",article:"第1條",body:"執行保安處分，除法律別有規定外，依本法行之。",modified:"111年2月18日",topic:"適用範圍"},
 {"id":"C0010011","law":"少年事件處理法","article":"第3條","body":"下列事件，由少年法院依本法處理之：\n一、少年有觸犯刑罰法律之行為者。\n二、少年有下列情形之一，而認有保障其健全自我成長之必要者：\n（一）無正當理由經常攜帶危險器械。\n（二）有施用毒品或迷幻物品之行為而尚未觸犯刑罰法律。\n（三）有預備犯罪或犯罪未遂而為法所不罰之行為。\n前項第二款所指之保障必要，應依少年之性格及成長環境、經常往來對象、參與團體、出入場所、生活作息、家庭功能、就學或就業等一切情狀而為判斷。","modified":"112年6月21日","topic":"少年法院處理事件"},
 {"id":"I0030002","law":"保安處分執行法","article":"第2條","body":"保安處分執行處所如下：\n一、感化教育及強制工作處所。\n二、監護、禁戒及強制治療處所。\n前項保安處分執行處所，由法務部設置，必要時法務部得請行政院協調相關中央主管機關設置或委任、委託或委辦其他機關（構）設置或辦理。\n保安處分之實施，受法務部之指揮、監督。","modified":"111年2月18日","topic":"保安處分執行處所"}
];
let laws = DEMO_LAWS.map(x=>({...x,articleKey:normalizeArticle(x.article)}));
let datasetMode="sample",datasetMeta=null,mode="exam",limit=25;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function normalizeArticle(s){
  return String(s??"").replace(/第/g,"").replace(/條/g,"").replace(/之/g,"-").replace(/[\s　]/g,"");
}
function normalizeQuery(s){
  return String(s??"").toLowerCase().replace(/[\s　]/g,"").replace(/第/g,"").replace(/條/g,"").replace(/之/g,"-");
}
function render(){
  const q=normalizeQuery($("q").value),filter=$("lawFilter").value;
  const hits=laws.filter(x=>(!filter||filter===x.id)&&(!q||normalizeQuery(x.law+" "+x.article+" "+x.articleKey+" "+x.body).includes(q)));
  $("count").textContent="找到 "+hits.length+" 條／已收錄 "+laws.length+" 條（"+(datasetMode==="official"?"官方完整法規快照":"示範資料")+"）";
  $("results").innerHTML=hits.slice(0,limit).map(x=>{
    const u=(datasetMode==="official" && /^https:\/\/law\.moj\.gov\.tw\//.test(x.url))?x.url:("https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode="+encodeURIComponent(x.id));
    const hint=mode==="exam"?
      '<p class="meta">練習提示：先自行找出條文要件與例外，再核對官方法源。這不是已經人工驗收的國考考點。</p>':
      '<p class="meta">研究限制：僅為現行法文字快照；修正日期不等於各條施行日期，歷史適用仍須另行核對。</p>';
    return '<article class="result"><h2>'+esc(x.law)+' '+esc(x.article)+'</h2><p class="law">'+esc(x.body)+'</p>'+hint+
      '<p class="meta">法規修正日期：'+esc(x.modified || "來源未提供")+'｜版本：'+esc(datasetMode==="official"?(datasetMeta?.sourceUpdateDate??"來源未提供"):"示範快照")+'</p>'+
      '<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">至全國法規資料庫核對原文 ↗</a></article>';
  }).join("")+(hits.length>limit?'<button class="more" type="button" id="more">繼續顯示（剩餘 '+(hits.length-limit)+' 條）</button>':"");
  if(!hits.length) $("results").innerHTML='<div class="panel empty">已收錄資料中沒有符合結果。請改用官方資料庫查詢；沒有搜尋結果不代表法律不存在。</div>';
  const more=$("more");if(more)more.addEventListener("click",()=>{limit+=25;render()});
}
function switchMode(v){
  mode=v;
  $("modeExam").setAttribute("aria-pressed",String(v==="exam"));
  $("modeResearch").setAttribute("aria-pressed",String(v==="research"));
  $("modeDesc").textContent=v==="exam"?"國考學習：完整法條搜尋及自我練習提示（申論評分尚未接入）。":"專業研究：檢視條文及官方來源；函釋、裁判與歷史法仍待建置。";
  render();
}
async function loadOfficial(){
  try{
    const response=await fetch("./laws.json",{cache:"no-store"});
    if(!response.ok)throw Error("HTTP "+response.status);
    const data=await response.json();
    if(data.schemaVersion!==1||!Array.isArray(data.articles)||data.articles.length<80||!data.sourceUpdateDate)
      throw Error("格式或條文數量未通過驗證");
    if(!data.articles.every(x=>["C0010011","I0030002"].includes(x.id)&&typeof x.body==="string"&&x.body.length>0&&/^\d+(?:-\d+)?$/.test(x.articleKey)))
      throw Error("法條資料格式錯誤");
    const unique=new Set(data.articles.map(x=>x.id+":"+x.articleKey));
    if(unique.size!==data.articles.length)throw Error("條號重複");
    laws=data.articles;
    datasetMode="official";datasetMeta=data;
    $("dataInfo").textContent="已載入兩部完整現行法律之官方資料快照；來源更新時間："+data.sourceUpdateDate+"。本資料非即時，請核對條文施行日與修法沿革。";
  }catch(e){
    datasetMode="sample";
    $("dataInfo").textContent="尚未取得經驗證的完整法規資料，現使用6條示範條文。原因："+String(e.message||e)+"；請勿視為完整法規。";
  }
  render();
}
$("q").addEventListener("input",()=>{limit=25;render()});
$("lawFilter").addEventListener("change",()=>{limit=25;render()});
$("modeExam").addEventListener("click",()=>switchMode("exam"));
$("modeResearch").addEventListener("click",()=>switchMode("research"));
render();loadOfficial();
