/* Source-grounded pilot diagnostics. Weights are developer practice weights,
 * not official examination marking schemes. No semantic model is called. */
(function () {
  const item=(label,weight,groups,hint)=>({label,weight,groups,hint});
  const records=[]; // 律司版：原觀護人主題評分已移除
  window.TOPIC_RUBRICS=Object.fromEntries(records.map(r=>[`${r.topic}|${r.questionId}`,r]));
  function normalize(s){return String(s).normalize('NFKC').toLowerCase().replace(/[\s\u200b]+/g,'');}
  function matches(sentence,groups){const n=normalize(sentence);return groups.every(group=>group.some(term=>n.includes(normalize(term))));}
  const warnings={};
  function diagnose(answer,key){
    const rubric=window.TOPIC_RUBRICS[key];if(!rubric)return null;
    const text=String(answer||'');
    const sentences=text.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean);
    const flagged=(warnings[rubric.topic]||[]).filter(([re])=>sentences.some(sentence => re.test(normalize(sentence)) && !/不宜|不應|不該|不必然|不一定|不代表|並非|錯誤說法/.test(sentence))).map(([,note])=>note);
    const alternative=!!(rubric.alternativeTheory && rubric.alternativePattern && new RegExp(rubric.alternativePattern,'i').test(text));
    const rows=rubric.criteria.map(c=>{
      const related=sentences.filter(s=>c.groups.some(group=>group.some(term=>normalize(s).includes(normalize(term)))));
      const candidates=sentences.filter(s=>matches(s,c.groups));
      const explained=candidates.find(s=>normalize(s).length>=18 && /(?:是指|係指|因為|因此|因而|使|讓|透過|通過|意味著|代表|屬於|以便|從而|應根據|依.{1,20}(?:調整|配合|匹配)|為了|可以|可(?:強化|改善|建立|調整|透過|運用|降低|減少|增加|促進)|來(?:預防|降低|減少|改善)|能夠|有助|會(?:減|增|抑|約|配|提|占)|because|means)/i.test(s));
      // A potentially negated explanation must be reviewed, never endorsed.
      const negated=explained && /不(?:是|需要|包含|影響|會|能)|無關|無須|錯誤|相反/.test(explained);
      const status=alternative?'manual':explained&&!negated&&!flagged.length?'evidence':related.length?'partial':'missing';
      return {label:c.label,weight:c.weight,status,evidence:(explained||related[0]||'').slice(0,240),hint:c.hint};
    });
    const provisionalScore=alternative||flagged.length?null:rows.reduce((sum,r)=>sum+(r.status==='evidence'?r.weight:0),0);
    return {version:rubric.version,key,source:rubric.source,rows,provisionalScore,
      warnings:flagged,manualReview:!!alternative||!!flagged.length,
      message:alternative?'本題允許其他見解；目前規則未涵蓋，請人工覆核，暫不計完成度。':flagged.length?'發現需覆核語句，暫不計完成度。':'分數僅表示規則找到的論述覆蓋度，不代表內容已證實正確。',
      answer:text,createdAt:new Date().toISOString(),confidence:'有限：本機文字規則，未經人工答案校準'};
  }
  window.diagnoseTopicAnswer=diagnose;
})();
