"use strict";
/* Official-link-only MOJ interpretation index. No interpretation full texts or current-validity claims. */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=s=>String(s??"").toLowerCase().replace(/[\s　（）()]/g,"").replace(/第/g,"").replace(/條/g,"").replace(/之/g,"-");
  let docs=[],loaded=false,page=0;
  const legalNames={"C0010011":"少年事件處理法","I0030002":"保安處分執行法"};
  const kind=$("kindFilter"),query=$("q"),law=$("lawFilter"),section=$("interpretationSection");
  if(!kind||!query||!law||!section){return;}
  function syncVisibility(){
    const k=kind.value;
    $("lawResultsSection").hidden=(k==="interpretation");
    section.hidden=(k==="statute");
  }
  function render(){
    syncVisibility();
    const q=norm(query.value),selectedLaw=legalNames[law.value]||"",mode=$("modeResearch").getAttribute("aria-pressed")==="true"?"research":"exam";
    const hits=docs.filter(d=>(!selectedLaw||d.relatedLaw===selectedLaw)&&(!q||
      norm([d.title,d.issuingAgency,d.officialDocumentNo,d.sourceRecordId,d.summary,d.relatedLaw,d.relatedArticle].join(" ")).includes(q)));
    $("interpCount").textContent=(loaded?"函釋索引："+hits.length+"筆符合（已收錄"+docs.length+"筆）":"函釋索引資料載入中…");
    $("interpResults").innerHTML=hits.slice(0,15+page*15).map(d=>{
      const caution=mode==="research"?
        "研究提醒：須確認該函釋是否停止適用、遭變更或受後續修法影響；僅有歷史索引不能證明現行效力。":
        "國考提醒：舊函釋只供歷史實務與爭點比較，答題須先查明現行法及最新實務見解。";
      return '<article class="result"><span class="tag">法務部系統：行政函釋索引</span> <span class="tag">現行效力未確認</span>'+
        '<h2>'+esc(d.title)+'</h2><p class="meta">發文機關：'+esc(d.issuingAgency)+'｜發文日期：'+esc(d.issuedAt)+
        '｜文號：'+esc(d.officialDocumentNo)+'</p><p>'+esc(d.summary)+'</p>'+
        '<p class="meta">索引關聯：'+esc(d.relatedLaw)+'、第'+esc(d.relatedArticle)+'條（未核對現行條號）</p>'+
        '<p class="meta">'+esc(caution)+' 本站僅提供人工編寫的索引摘要，非函釋原文。</p>'+
        '<a href="'+esc(d.sourceUrl)+'" target="_blank" rel="noopener noreferrer">至法務部主管法規查詢系統核對原函釋 ↗</a></article>';
    }).join("")+(hits.length>15+page*15?'<button type="button" class="more" id="interpMore">顯示更多函釋索引</button>':"");
    if(loaded&&!hits.length)$("interpResults").innerHTML='<div class="panel empty">此試點目前未收錄符合條件的函釋。請至法務部官方系統擴大查詢，不能因本試點無結果便推斷無相關函釋。</div>';
    const more=$("interpMore");if(more)more.addEventListener("click",()=>{page++;render()});
  }
  async function load(){
    try{
      const resp=await fetch("./interpretations.json",{cache:"no-store"});
      if(!resp.ok)throw Error("HTTP "+resp.status);
      const json=await resp.json();
      if(json.schemaVersion!==1||json.claimsOfCurrentValidity!==false||!Array.isArray(json.records)||json.records.length<10)throw Error("資料集格式或範圍異常");
      const seen=new Set();
      for(const d of json.records){
        if(d.kind!=="interpretation"||!/^moj:FE\d+$/.test(d.id)||seen.has(d.id)||
          !d.title||!d.officialDocumentNo||!d.issuedAt||!d.issuingAgency||d.validityReview!=="unverified"||
          !/^https:\/\/mojlaw\.moj\.gov\.tw\/LawContentExShow\.aspx\?id=FE\d+&type=E$/.test(d.sourceUrl))
            throw Error("索引來源或識別碼異常");
        seen.add(d.id);
      }
      docs=json.records;loaded=true;
      $("sourceInfo").textContent="函釋：收錄"+docs.length+"筆與少事法、保安處分執行法有關的歷史公文索引；發文效力未確認，僅顯示非原文摘要。";
    }catch(e){
      docs=[];loaded=true;$("sourceInfo").textContent="函釋索引讀取失敗（"+String(e.message||e)+"），法條仍可獨立搜尋。";
    }
    render();
  }
  function update(){page=0;render()}
  [kind,query,law,$("modeResearch"),$("modeExam")].forEach(x=>x.addEventListener(x===query?"input":"change",update));
  // Mode buttons are click-driven, not change-driven.
  $("modeResearch").addEventListener("click",update);
  $("modeExam").addEventListener("click",update);
  render();load();
})();