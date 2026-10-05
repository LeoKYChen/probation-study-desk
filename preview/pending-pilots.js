/* Requirement and reference evidence only. Every new draft needs human calibration. */
(function(){
 const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 const explanatory=/(?:是指|係指|因為|因此|所以|透過|意味|代表|包括|屬於|應|須|得|不等於|不代表|不同|不能|避免|形成|影響|說明|有助|認為|依據|要件|比較|例如|本案|然而|故)/;
 window.gradePendingPilot=(answer,q)=>{
  const r=window.PENDING_PILOT_RUBRICS[q.id];if(!r)return null;
  const text=String(answer||''),units=text.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean);
  const warnings=['本題已有逐題參考答案綱要，仍待來源、實質結論與獨立人工校準；以下只提供逐項要求與文字線索，暫不給分。'];
  if(r.legalVersion)warnings.push('現行法是練習目標；本題的法規時點、實務見解及個案結論仍須人工核對。');
  for(const error of r.errors){const hit=units.find(s=>new RegExp(error.pattern,'i').test(normalize(s))&&!/(?:錯誤說法|此說不正確|不能說|不應說|並非|不等於|不必然|不一定|不保證|不代表)/.test(s));if(hit)warnings.push(error.hint+' 可能相關原句：'+hit+'（需覆核，未自動判錯）');}
  const evidence=r.criteria.map(row=>{
   // Empty or unknown concept groups are always manual, never an unconditional match.
   const candidates=row.groups.length?units.filter(s=>row.groups.every(g=>g.some(t=>normalize(s).includes(normalize(t))))):[];
   const hit=candidates.find(s=>normalize(s).length>=18&&explanatory.test(s));
   return {...row,status:hit?'reference-evidence':candidates.length?'partial':'manual',evidence:hit||candidates[0]||'',ratio:null};
  });
  return {scores:null,total:null,method:'pending-310-checklist-v1',rubricVersion:r.version,legalVersion:r.legalVersion,answer:text,evidence,warnings,manualReview:true,createdAt:new Date().toISOString(),characters:normalize(text).length,
   confidence:'逐題答案綱要已補齊，完整校準待覆核；文字命中只作參考，不是正確性判斷。',strengths:evidence.filter(e=>e.evidence).slice(0,4).map(e=>'找到待覆核的論述線索：'+e.label),improvements:r.requirements.map(x=>'原題要求：'+x.text).concat(warnings)};
 };
})();
