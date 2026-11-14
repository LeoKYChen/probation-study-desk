/* Current-law pilot reference outlines. Practice weights are not official marks.
 * Local text evidence cannot certify legal correctness; contradictions suspend scores. */
(function(){
  const checkedAt='2026-10-02',version='current-law-pilot-v1-20261002';
  const p=(category,label,weight,terms,hint,section)=>({category,label,weight,groups:terms.split('&').map(x=>x.split('/')),hint,section});
  const R={};
  function add(id,title,sections,rows,errors,changeNote,sources=[]){R[id]={title,version,checkedAt,legalVersion:'current',sections,criteria:rows,errors,changeNote,sources,sourceNote:'依現行法與原題建立參考要點；非官方擬答或配分。已作文字反例測試，尚未經法律專家答案集校準。'};}
  // 律司版：原觀護人題目的現行法評分要點已移除；新增時以 add(...) 登錄。
  for(const r of Object.values(R))r.errors=r.errors.map(([pattern,hint])=>[pattern.replace(/\(\?:應\|必須\)/g,'(?<!不|非)(?:應|必須)').replace(/\(\?:得\|可以\|有權\)/g,'(?<!不|非)(?:得|可以|有權)'),hint]);
  window.LEGAL_PILOT_RUBRICS=R;
  const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
  window.gradeLegalPilot=(answer,question)=>{
    const r=R[question.id];if(!r)return null;
    const text=String(answer||'');const sentences=text.split(/[。；！？\n]+/).map(x=>x.trim()).filter(Boolean);
    const warnings=[];
    for(const [pattern,hint] of r.errors){const hit=sentences.find(s=>new RegExp(pattern).test(norm(s))&&!/錯誤說法|不能說|不得認為|並非說/.test(s));if(hit)warnings.push(hint+' 原句：'+hit);}
    const explanatory=/(?:始有|門檻.{1,8}(?:年|歲)|為.{2,}(?:年|歲)|優先適用|仍須|例如.{4,}|以.{3,}為限制|是.{3,}|透過.{3,}|與.{3,}不同|是指|係指|因為|因此|所以|應(?:記載|兼顧|權衡|出庭|作成|以|依|由|先|確認|審查|傳喚|通知|結合|區分|核對|考量|分別|付|裁定)|須(?:移送|先|依|以|由|符合|確認|判斷|核對|區分|有|敘明|審查)|得(?:依|以|由|報請|許|諭知|先|請求|為)|不(?:應|得|能|再|適用)|原則不|受.{1,10}保障|可(?:徵詢|依|採|由|不令)|可以|包括|屬於|屬|是為|已有|作補充|有助|形成|連結|才能|才請求|仍受|而非|避免|由.{1,20}執行)/;
    const prose=s=>{const tokens=s.replace(/^[一二三四五六七八九十]+、/,'').trim().split(/\s+/);return !(tokens.length>=4&&tokens.filter(t=>t.length<=10).length/tokens.length>.8);};
    const evidence=r.criteria.map(row=>{const candidates=sentences.filter(s=>row.groups.every(g=>g.some(t=>norm(s).includes(norm(t)))));const found=candidates.find(s=>norm(s).length>=12&&prose(s)&&explanatory.test(s));return {...row,status:warnings.length?'manual':found?'evidence':candidates.length?'partial':'missing',evidence:found||candidates[0]||'',ratio:found?1:0};});
    const scores={issue:0,rule:0,analysis:0,structure:0};for(const e of evidence)if(e.status==='evidence')scores[e.category]+=e.weight;
    const covered=evidence.filter(e=>e.status==='evidence').length;
    // Structure earns points only when there is substantive evidence; padding/headings alone earn none.
    const headings=(text.match(/(?:^|\n)\s*(?:[一二三四五六七八九十]+、|\d+[.、]|[（(][一二三\d]+[）)])/g)||[]).length;
    const paragraphs=text.split(/\n+/).filter(x=>x.trim()).length;
    if(covered) scores.structure=Math.min(20,Math.min(8,headings*2)+Math.min(6,Math.max(0,paragraphs-1)*2)+(/綜上|結論|因此|故/.test(text)?6:0));
    const total=warnings.length?null:Object.values(scores).reduce((a,b)=>a+b,0);
    return {scores:warnings.length?null:scores,total,method:'current-law-pilot-v1',rubricVersion:version,legalVersion:'current',checkedAt,answer:text,characters:norm(text).length,evidence,warnings,manualReview:warnings.length>0,
      confidence:'文字規則試評：有法源及測試答案，未經法律專家校準。數字僅反映已辨識的答題要點與結構。',
      strengths:evidence.filter(e=>e.status==='evidence').slice(0,4).map(e=>'已辨識：'+e.label+'。'),
      improvements:[...warnings,...evidence.filter(e=>e.status!=='evidence').slice(0,4).map(e=>'補強：'+e.hint),...(covered?[]:['尚未辨識具體論述；僅列關鍵字或法條不給要點分。'])].slice(0,6),createdAt:new Date().toISOString()};
  };
})();
