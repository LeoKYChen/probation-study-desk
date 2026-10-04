/* Source-linked core-concept diagnostics plus uncalibrated demand checks.
 * Trial lexical coverage is not correctness or an official exam score. */
(function(){
  const originalDiagnose=window.diagnoseTopicAnswer;
  const norm=s=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const explanation=/(?:是指|係指|因為|因此|因而|所以|使|讓|透過|通過|意味著|代表|屬於|可以|能夠|有助|依據|要件|若.*則|because|means)/i;
  const sources={
    'psy-reliability':{title:'OpenStax Psychology 2e：2.3 Analyzing Findings',url:'https://openstax.org/books/psychology-2e/pages/2-3-analyzing-findings',section:'信度的一致性、效度的測量意義'},
    'psy-operant':{title:'OpenStax Psychology 2e：6.3 Operant Conditioning',url:'https://openstax.org/books/psychology-2e/pages/6-3-operant-conditioning',section:'增強與懲罰、刺激增加與移除'},
    '少年法':{title:'臺北市法規查詢系統：少年事件處理法',url:'https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL001455',section:'供查核法規與沿革；未逐題校準歷史法及實務答案'},
    '刑法':{title:'法務部：中華民國刑法',url:'https://mojlaw.moj.gov.tw/LawContent.aspx?LSID=fl001424',section:'供查核法規與歷史版本；未逐題校準實務答案'},
    '保安處分':{title:'法務部：保安處分執行法',url:'https://mojlaw.moj.gov.tw/LawContent.aspx?LSID=FL010153',section:'供查核法規與沿革；仍須核對憲法判決與相關法律'}
  };
  window.isLegalTopic=(q,t)=>['少年法','刑法','刑事程序','保安處分'].includes(t.family)||/刑法|訴訟法|少年事件處理法/.test(q.subject);
  window.getTopicRubric=(q,t)=>{
    const key=t.id+'|'+q.id;
    if(window.TOPIC_RUBRICS[key])return {...window.TOPIC_RUBRICS[key],key};
    const standard=window.CONTENT_STANDARDS?.[t.id];
    if(standard){
      const legal=window.isLegalTopic(q,t);
      return {key,version:legal?'content-core-current-v2-20261002':'content-core-v1-20261002',mode:'content',legal,source:standard.source,errors:standard.errors,criteria:standard.criteria,
        prompt:`${legal?'依現行法作答（查核日2026-10-02）。':''}本次只練「${standard.focus}」。請依序說明：${standard.criteria.map(r=>r.label).join('、')}。可用原題相關事實或一個自擬例子說明。這是核心概念改編練習，不涵蓋原題全部理論、計算或個案結論。`,focus:standard.focus};
    }
    const terms=t.terms?.length?t.terms:[t.label];
    const legal=window.isLegalTopic(q,t);
    const source={title:'考選部原始試題：'+q.year+'年 '+q.subject+' 第'+q.questionNo+'題',url:q.sourceUrl,section:'題幹為練習範圍依據，不是官方答案'};
    const prompt=t.mappings?.[q.id]?.prompt||`本次只練「${t.label}」：${t.scope}。原題如有多個問題，先選與本考點有關的一項並在答案開頭註明；其餘部分留待完整原題。`;
    const criteria=[
      {label:'指定考點與作答範圍',weight:0,groups:[terms],hint:'先界定「'+t.label+'」，明示本次選擇的概念、行為人或步驟。'+t.scope+'。'},
      {label:legal?'規範與判斷理由':'概念與推論理由',weight:0,groups:[terms],hint:legal?'列出所採法源或要件，說明它為何適用於這部分；法條號碼本身不代表論證完整。':'說明概念之間如何連結；只列名稱或關鍵字，仍需要補上機制與理由。'},
      {label:legal?'事實涵攝或制度效果':'例子、比較或介入應用',weight:0,groups:[],hint:'依本次選定範圍，連結原題事實，或用一個自擬例子說明；概念題可改說明界線與限制。'},
      {label:'內容正確性與參考依據',weight:0,groups:[],hint:legal?'人工核對原題年度與現行法差異、判例或憲法判決；本檢查不判定法律結論正誤。':'人工核對教材的學者、定義與適用限制；本檢查不判定理論或臨床結論正誤。',manual:true}
    ];
    return {key,version:legal?'all-demand-current-v2-20261002':'all-demand-v1-20261002',mode:'requirements',prompt:legal?'依現行法作答（查核日2026-10-02）。'+prompt:prompt,criteria,source,extraSource:sources[t.id]||sources[t.family],legal,terms};
  };
  window.diagnoseTopicAnswer=(answer,key,rubric,legalVersion='current')=>{
    if(window.TOPIC_RUBRICS[key])return originalDiagnose(answer,key);
    if(!rubric)return null;
    if(rubric?.legal)legalVersion='current';
    const sentences=answer.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean);
    if(rubric.mode==='content'){
      const warnings=[];
      for(const error of rubric.errors){const re=new RegExp(error.pattern,'i');const hit=sentences.find(s=>re.test(norm(s))&&!/(?:錯誤說法|此說不正確|不能說|不是說|不應說|並非|不等於|不是|不必然|不一定|不保證|不代表)/.test(s));if(hit)warnings.push(error.hint+' 原句：'+hit);}
      const rows=rubric.criteria.map(row=>{
        const matches=s=>row.groups.every(g=>g.some(term=>norm(s).includes(norm(term))));
        const candidates=sentences.filter(matches);
        const evidence=candidates.find(s=>norm(s).length>=18&&explanation.test(s));
        const ambiguous=evidence&&/(?:不是|不會|不需要|無關|錯誤)/.test(evidence)&&!/(?:不代表|不保證|不必然|不等於|不是固定|不是只有)/.test(evidence);
        return {...row,status:warnings.length?'manual':evidence&&!ambiguous?'evidence':candidates.length?'partial':'missing',evidence:evidence||candidates[0]||''};
      });
      const provisionalScore=warnings.length||rubric.legal?null:rows.filter(r=>r.status==='evidence').reduce((a,r)=>a+r.weight,0);
      if(rubric.legal)warnings.unshift(legalVersion==='current'?'依2026-10-02查核來源提供概念提示；判例、修法及個案法律結論仍需覆核，暫不計分。':'原題年度法律尚未逐題核實：以下提示依目前查核來源，不直接判定當年答案正誤，暫不計分。');
      return {key,version:rubric.version,mode:'content',answer,rows,provisionalScore,manualReview:warnings.length>0,legalVersion,warnings,source:rubric.source,focus:rubric.focus,
        message:'依有來源的核心概念準則，顯示論述線索、可能缺漏與已設定的易混淆說法。涵蓋度不是正確率或國考分數；本表僅對應上方改編範圍。',
        confidence:'文字規則試作；已核對概念來源，並測試部分易混淆及否定表達，尚未經人工答案集校準。不同合理表達可能未辨識。',createdAt:new Date().toISOString()};
    }

    const related=s=>rubric.terms.some(term=>norm(s).includes(norm(term)));
    const found=sentences.find(related);
    const explained=sentences.find(s=>related(s)&&norm(s).length>=18&&explanation.test(s));
    const applied=sentences.find(s=>norm(s).length>=18&&/(?:本案|原題|例如|舉例|個案|少年甲|甲之|因而|相比|相較|限制|應用|措施|策略|介入|活動|效果)/.test(s));
    const rows=rubric.criteria.map((r,i)=>{const evidence=[found,explained,applied,''][i];return {...r,status:r.manual?'manual':evidence?(i===0&&!explanation.test(evidence)?'partial':'evidence'):'missing',evidence:evidence||''};});
    return {key,version:rubric.version,mode:'requirements',answer,rows,provisionalScore:null,manualReview:true,legalVersion,warnings:rubric.legal?['作答法規基準：'+(legalVersion==='current'?'現行法；須自行核對最新修法及實務':'原題年度；須核對該年度法律、施行日期及實務')+'。跨年度關聯不代表法律結論相同。']:[],message:'這是題幹要求與論述線索檢查，不計分。找到相關文字不代表內容正確；未辨識到也可能是不同表達，請依下列項目與教材覆核。',confidence:'尚未完成此子題的內容答案校準；正確性由人工覆核。',createdAt:new Date().toISOString()};
  };
})();
