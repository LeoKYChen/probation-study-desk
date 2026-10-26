/* Local text-evidence diagnostics. No model, credentials, or network requests. */
(function (root) {
  'use strict';
  const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/臺/g,'台').replace(/汙/g,'污').replace(/佔/g,'占').replace(/[\s\p{P}\p{S}]/gu, '');
  const prose = /是|為|可|需|使|將|要求|區分|符合|結合|相互|顯示|原則|依第|因為|因此|所以|透過|意味|包括|應|須|得|不等於|不代表|不能|避免|形成|影響|說明|認為|依據|本案|例如|然而|故|先.+再|後.+即/;
  const negative = /並非|不是|不得|不能|無須|不必|不成立|不適用|沒有|不應|錯誤|相反|不正確|不具有|不會|不可能/;
  const positive = /成立|適用|具有|可以|應當|正確|必然/;
  const defs = [['issue', '考點／爭點', 30], ['rule', '法條／理論', 25], ['analysis', '分析／應用', 25], ['structure', '結構表達', 20]];
  function match(group, s) {return group.length > 0 && group.every(terms => terms.length && terms.some(t => norm(s).includes(norm(t))));}
  root.gradeProbationTrial = function (answer, question) {
    const r = root.PROBATION_TRIAL_RUBRICS?.[question.id];
    if (!r) return null;
    const text = String(answer || ''), compact = norm(text);
    const units = text.split(/[。；！？\n]+/).map(s => s.trim()).filter(Boolean);
    // Never combine unrelated paragraphs to manufacture a matched proposition.
    const conceptEvidence = r.coreGroups.map((group, i) => {
      const candidates = units.filter(s => match(group, s));
      const hit = candidates.find(s => norm(s).length >= 14 && prose.test(s));
      const reference = r.calibration.referenceParagraphs.find(s => match(group, s));
      return {label:'本題概念線索'+(i+1),category:'rule',hint:reference || '核對概念關係：'+group.map(g=>g.join('／')).join('＋')+'；同義表達或合理替代答案須人工覆核。',
        status:hit?'reference-evidence':candidates.length?'partial':'manual',evidence:hit || candidates[0] || '',ratio:hit?1:0,groupIndex:i};
    });
    const copied = compact.length > 0 && (norm(question.body).includes(compact) || compact === norm(question.title));
    const hasProse = units.filter(s=>norm(s).length>=14 && prose.test(s));
    const valid = !copied && compact.length >= 55 && hasProse.length >= 2 && conceptEvidence.some(e=>e.ratio);
    const coverage = conceptEvidence.length ? conceptEvidence.filter(e=>e.ratio).length/conceptEvidence.length : 0;
    const applicationUnits = hasProse.filter(s=>/本案|題示|個案|例如|因為|因此|然而|甲|乙|丙|少年|受害|被害|學生/.test(s));
    const conclusion = hasProse.find(s=>/綜上|結論|因此|從而|故|應認|不成立|成立|可見/.test(s));
    const heads = (text.match(/(?:^|\n)\s*(?:[一二三四五六七八九十]+、|\d+[.、]|[（(][一二三\d]+[）)])/g)||[]).length;
    const dimQuotes = {
      issue:conceptEvidence.filter(e=>e.evidence).map(e=>e.evidence),
      rule:conceptEvidence.filter(e=>e.ratio).map(e=>e.evidence),
      analysis:applicationUnits,
      structure:[...(heads ? ['辨識到'+heads+'個段落標記。'] : []), ...(conclusion ? [conclusion] : [])]
    };
    const warnings = ['四項數字僅是已辨識文字線索的練習權重，未經專家答案集校準；不得換算國考分數或正確率。'];
    const reasons = defs.map(([key,label,weight])=>{
      const row = r.criteria.find(x=>x.category===key);
      const quotes = [...new Set(dimQuotes[key])].slice(0,2);
      return {category:key,label,weight,status:valid && quotes.length?'reference-evidence':'manual',evidence:quotes.join('｜'),ratio:null,
        hint:row.hint+' '+(quotes.length ? '已找到待覆核原句，仍須判斷是否正確回應要求。' : '未完整辨識；不據此判為錯誤或否定其他合理答法。')};
    });
    const constraints = r.constraints.map(c=>({category:'analysis',label:'原題要求檢查：'+c.kind,hint:c.hint,status:'manual',evidence:'',ratio:null}));
    let blocked = !valid;
    if (!valid) warnings.push(copied ? '只複製原題不給參考分數，請加入自己的分析。' : '空白、短語或純關鍵字不給參考分數；目前未辨識足夠完整論述。');
    // Negation is a review trigger, never a correctness classifier. Correct
    // negative conclusions and quoted misconceptions remain acceptable answers.
    const polarityRisk = hasProse.filter(s=>negative.test(s));
    if (valid && polarityRisk.length) {blocked=true;warnings.push('答案有否定、反例或相反命題，需核對其對象及理由，暫停數字試評；這不代表該句錯誤。');}
    const contradictory = r.coreGroups.some(group=>{
      const hits=hasProse.filter(s=>match(group,s));
      return hits.some(s=>negative.test(s)) && hits.some(s=>positive.test(s)&&!negative.test(s));
    });
    if (contradictory) {blocked=true;warnings.push('同組概念出現正反表述，可能是比較、引述或矛盾，請覆核原句。');}
    for (const error of r.errors || []) {
      const hit = units.find(s=>new RegExp(error.pattern,'i').test(norm(s)));
      if (hit) {blocked=true;warnings.push(error.hint+'｜待覆核：'+hit);}
    }
    if (r.constraints.length) {blocked=true;warnings.push('本題有數量、選擇、比較、方案或數值要求；已列出檢查項目，完成度及結果需人工確認。');}
    if (r.contentStatus==='existing-outline-needs-source-review' || r.unresolvedSourceAliases.length) {
      blocked=true;warnings.push('本題仍有未完成來源核實的必要內容，暫不給總分；請依逐題來源與待查證事項覆核。');
    }
    if (question.id==='115-刑事訴訟法與保安處分執行法-1') {
      const lower=/(?:19|十九)\s*(?:個)?月|一年(?:又)?七(?:個)?月/.test(text);
      const upper=/(?:60|六十)\s*(?:個)?月|五年/.test(text);
      const bounds=/內部/.test(text)&&/外部/.test(text);
      constraints.push({category:'analysis',label:'更定執行刑結果',status:lower&&upper&&bounds?'reference-evidence':'manual',
        hint:'外部19至63月；內部上限60月，原定24月不是絕對下限。低於原定刑須具體理由，仍須人工核對數字語意。',evidence:units.filter(s=>/界限|下限|上限|19|63|60|十九|六十|五年|二年/.test(s)).join('｜'),ratio:null});
    }
    const scores = valid ? {issue:Math.round(30*coverage),rule:Math.round(25*coverage),analysis:Math.round(25*Math.min(coverage,applicationUnits.length/3)),structure:Math.round(Math.min(20,heads*2+Math.min(8,hasProse.length*2)+(conclusion?6:0))*coverage)} : null;
    if (!blocked && scores && coverage < 1) {blocked=true;warnings.push('有參考概念未辨識，可能是漏答或合理替代答案；先覆核，不直接判低分。');}
    return {scores:blocked?null:scores,total:blocked?null:Object.values(scores).reduce((a,b)=>a+b,0),method:'probation-190-trial-v1',rubricVersion:r.version,legalVersion:r.legalVersion,
      answer:text,characters:compact.length,checkedAt:r.checkedAt,createdAt:new Date().toISOString(),manualReview:true,dimensionReasons:reasons,
      evidence:[...reasons,...conceptEvidence,...constraints],warnings:[...warnings,...r.openIssues],
      confidence:'逐題四項試評；文字辨識非內容正確性判斷，來源及合理異說仍待覆核。',
      strengths:valid?conceptEvidence.filter(e=>e.ratio).slice(0,4).map(e=>'找到論述線索：'+e.evidence):[],
      improvements:[r.authoredTargets.application,...r.requirements.slice(0,4).map(x=>x.text),...r.openIssues].slice(0,8)};
  };
})(typeof window === 'undefined' ? globalThis : window);
