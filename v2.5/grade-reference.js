/* 2.5: reference scoring added to the GitHub 2.4 question-specific draft rubrics. */
(function(){
 const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,''),prose=/(因為|因此|應|須|得|透過|形成|影響|包括|是指|係指|比較|本案|例如|然而|故|說明|認為|依據)/;
 window.gradePendingPilot=(answer,question)=>{
  const rule=window.PENDING_PILOT_RUBRICS?.[question.id];if(!rule)return null;
  const calibration=window.ANSWER_CALIBRATIONS?.[question.id],text=String(answer||''),compact=norm(text),sentences=text.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean),groups=calibration?.coreGroups||[];
  const candidates=[...sentences,...text.split(/\n+/).filter(s=>norm(s).length<=1600)];
  const evidence=groups.map((group,index)=>{const matches=candidates.filter(s=>group.length&&group.every(terms=>terms.some(t=>norm(s).includes(norm(t))))),hit=matches.find(s=>norm(s).length>=25&&prose.test(s));return {label:'核心概念組'+(index+1),hint:group.map(terms=>terms.join('／')).join('＋')+'；需核對內容、涵攝及合理異說。',category:'rule',status:hit?'reference-evidence':matches.length?'partial':'missing',evidence:hit||matches[0]||'',ratio:hit?1:matches.length?.25:0};});
  const checklist=rule.criteria.map(row=>{const matches=row.groups.length?sentences.filter(s=>row.groups.every(terms=>terms.some(t=>norm(s).includes(norm(t))))):[],hit=matches.find(s=>norm(s).length>=25&&prose.test(s));return {...row,status:hit?'reference-evidence':matches.length?'partial':'manual',evidence:hit||matches[0]||'',ratio:0};});
  const copied=compact.length>0&&(norm(question.body||rule.questionBody).includes(compact)||compact===norm(question.title)),valid=!copied&&compact.length>=40&&/[。；！？\n]/.test(text)&&evidence.some(e=>e.ratio===1),coverage=groups.length?evidence.reduce((n,e)=>n+e.ratio,0)/groups.length:0;
  const scores={issue:0,rule:0,analysis:0,structure:0},warnings=['自動參考分數仍待人工校準；文字命中不代表法律或理論正確，也不是官方閱卷分數。',...(calibration?.openIssues||[])];
  if(valid){scores.issue=Math.round(30*coverage);scores.rule=Math.round(25*coverage);scores.analysis=Math.round(25*Math.min(coverage,sentences.filter(s=>norm(s).length>=25&&prose.test(s)&&/(本案|題示|個案|少年|例如|因為|因此|然而)/.test(s)).length/3));const heads=(text.match(/(?:^|\n)\s*(?:[一二三四五六七八九十]+、|\d+[.、]|[（(][一二三\d]+[）)])/g)||[]).length;scores.structure=Math.round(Math.min(20,heads*2+Math.min(8,Math.max(0,sentences.length-1)*2)+(/結論|綜上|因此|故/.test(text)?6:0))*Math.min(1,coverage*2));}
  if(!valid)warnings.push(copied?'題幹複製不給有效分數。':'未辨識到完整核心概念論述；空白或純關鍵字不給有效分數，漏判請逐點回饋。');
  let blocked=false;for(const error of rule.errors||[]){const hit=sentences.find(s=>new RegExp(error.pattern,'i').test(norm(s))&&!/(錯誤說法|此說不正確|不能說|不應說|並非|不等於|不必然|不一定|不保證|不代表)/.test(s));if(hit){blocked=true;warnings.push(error.hint+'｜待覆核原句：'+hit);}}
  return {scores:blocked?null:scores,total:blocked?null:Object.values(scores).reduce((a,b)=>a+b,0),method:'reference-310-v2.5',rubricVersion:rule.version,legalVersion:rule.legalVersion,answer:text,evidence:[...evidence,...checklist],warnings,manualReview:true,createdAt:new Date().toISOString(),characters:compact.length,confidence:'自動參考分數，非官方閱卷；仍需逐點核對',strengths:evidence.filter(e=>e.ratio===1).map(e=>e.label+'：'+e.evidence).slice(0,4),improvements:evidence.filter(e=>e.ratio!==1).map(e=>e.hint).concat(rule.requirements.map(r=>'原題要求：'+r.text)).slice(0,6)};
 };
})();
