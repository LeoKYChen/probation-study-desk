/* Source-grounded pilot diagnostics. Weights are developer practice weights,
 * not official examination marking schemes. No semantic model is called. */
(function () {
  const sources = {
    control:{title:'Tieman (1976), Social Control and Delinquent Behavior：OJP研究摘要',url:'https://www.ojp.gov/ncjrs/virtual-library/abstracts/social-control-and-delinquent-behavior',section:'Abstract；四種社會連結及研究限制'},
    rnr:{title:'Bonta & Andrews (2007), Public Safety Canada：RNR原則',url:'https://www.publicsafety.gc.ca/cnt/rsrcs/pblctns/rsk-nd-rspnsvty/',section:'Introduction；Offender rehabilitation'},
    routine:{title:'Cohen & Felson (1979), American Sociological Review：日常活動理論',url:'https://faculty.washington.edu/matsueda/courses/587/readings/Cohen%20and%20Felson%201979%20Routine%20Activities.pdf',section:'期刊頁588–589：三要素與時空聚合'}
  };
  const item=(label,weight,groups,hint)=>({label,weight,groups,hint});
  const bonds = [
    ['依附','依戀','attachment'],['承諾','奉獻','commitment'],['參與','涉入','involvement'],['信念','信仰','belief']
  ];
  const social = [
    item('社會連結與犯罪的機制',30,[['社會連結','社會鍵','社會聯繫','社會紐帶','social bond'],['弱化','削弱','減弱','薄弱','約束','抑制','牽制','失去','降低']], '說明連結如何約束行為，或連結弱化如何增加偏差的可能；避免把相關性寫成必然犯罪。'),
    ...bonds.map((group,i)=>item(['依附','承諾','參與','信念'][i]+'的意義',10,[group,[['情感','關心','父母','家人','關係','意見'],['投入','投資','損失','教育','工作','前途','成本'],['時間','活動','休閒','參加','機會'],['規範','法律','道德','正當','價值','認同']][i]],'不只列出名稱，補充此要素的意義。'))
  ];
  const rnrBase = [
    item('風險原則：評估與處遇強度相配',30,[['風險','risk'],['強度','高風險','低風險','程度'],['相配','配合','匹配','較高','較低','增加','減少','依據','依照']], '說明依再犯風險安排適當處遇強度。'),
    item('需求原則：犯罪相關需求',30,[['需求','need'],['犯罪相關','犯罪生成','犯罪基因','犯罪性','致犯罪','犯罪需求','動態']], '針對可改變、與犯罪有關的需求；不是所有需要都等同犯罪生成需求。'),
    item('回應性：方法適合個人',40,[['回應','反應','響應','responsivity'],['學習','能力','動機','特性','認知行為','認知行為治療','個別']], '說明方法如何配合個人學習能力與特性。')
  ];
  const routineBase=[
    item('有動機的行為人',25,[['動機','意圖','意願'],['犯罪者','犯罪人','行為人','加害人','加害者','犯人','offender']], '指出有動機的犯罪行為人，而不是只寫一般人口。'),
    item('適合的標的',25,[['標的','目標','target'],['適合','合適','可接近','脆弱','可得','價值','易接近','暴露']], '說明標的適合性或可接近性。'),
    item('缺乏有效守望',25,[['守望','監護','監督','看守','保護者','guardian'],['缺乏','不足','缺少','欠缺','不在','無法','失效','absence']], '指出有效守望的不足；守望者不僅限於警察。'),
    item('三要素在時空聚合',25,[['時空','時間','空間','同時','同地'],['聚合','匯聚','交會','重合','結合','集中','相遇','交集','convergence']], '將要素的時空交會連結到犯罪機會，而非只背三個名稱。')
  ];
  const q=(topic,questionId,prompt,criteria,extra={})=>({topic,questionId,prompt,criteria,source:sources[topic],version:'topic-diagnostic-v1-20261002',...extra});
  const records=[
    q('control','114-犯罪學-1','僅就社會控制學派，選一個具代表性的理論，說明它如何解釋青少年偏差或犯罪，並提出相應防治對策。社會結構學派部分暫不作答。',[
      ...social, item('青少年情境與防治',30,[['少年','青少年','學生','學校','家庭'],['預防','防治','促進','強化','支持','輔導','改善','建立']], '把選用理論連結少年情境與具體對策。')
    ],{alternativeTheory:true}),
    q('control','109-犯罪學-2','僅依Hirschi社會控制理論，說明如何有效預防少年犯罪。原題列舉五種家庭因素部分暫不作答。',[
      ...social,item('依理論提出少年防治措施',30,[['少年','青少年','家庭','父母','學校'],['強化','支持','輔導','促進','預防','改善','建立']], '提出能強化連結的措施，並交代理由。')
    ]),
    q('control','監所管理員-111-犯罪學概要-2','僅依Hirschi社會控制理論，說明理論內涵及家庭如何預防少年犯罪。',[
      ...social,item('家庭與少年犯罪預防',30,[['家庭','父母','親子','家長'],['少年','青少年','子女'],['強化','支持','預防','改善','建立','促進']], '連結家庭關係、理論機制與少年防治。')
    ]),
    q('control','薦任升等（矯正）-110-犯罪學-3','僅以Hirschi社會控制理論解釋原題老人犯罪的可能成因。一般化緊張理論部分暫不作答。',[
      ...social,item('老人情境的理論應用',30,[['老人','高齡','退休','老年'],['孤立','離開','失去','減少','弱化','疏離','支持','連結']], '指出老年生活變化如何影響社會連結，避免把年齡等同犯罪原因。')
    ]),
    q('rnr','115-犯罪學-2','僅說明RNR模型的回應性原則如何因應犯罪人的身心障礙或學習風格。模型整體介紹與四大核心風險列舉部分暫不作答。',[
      item('一般回應性：認知行為／社會學習方法',30,[['認知行為','認知社會學習','認知及行為','cognitive behavioural','cognitive behavioral']], '說明有效介入的方法取向。'),
      item('特殊回應性：配合個人特性',35,[['能力','身心障礙','學習風格','認知','動機'],['調整','配合','適合','個別','因應','量身']], '說明如何調整方法，而不只列特性名稱。'),
      item('具體的學習或障礙調整',35,[['圖像','視覺','口語','簡化','分段','重複','示範','演練','教材','支持','輔具'],['理解','學習','障礙','能力','風格']], '提出具體調整並連結學習或障礙需求；例子是試作設計，並非官方唯一答案。')
    ]),
    q('rnr','監獄官-113-犯罪學與再犯預測-3','僅運用RNR三原則，說明原題受刑人A的個別處遇安排。請保留原題個案事實；避免僅因刑期或犯罪名稱就斷定風險等級。',[
      ...rnrBase.map(x=>({...x,weight:25})),item('回應A的個案事實',25,[['待業','失業','離婚','憂鬱','父母','無藥酒癮','無子女'],['評估','確認','個別','配合','調整','安排','連結']], '將個案事實連結到評估與處遇；確定風險仍須評估。')
    ]),
    q('rnr','監獄官-111-犯罪學與再犯預測-3','僅說明RNR三原則的主要內涵。RNR模擬工具的專案分類部分暫不作答。',rnrBase),
    q('routine','108-犯罪學-1','僅說明日常生活理論三項時空因素及各項內涵。家庭暴力案例應用部分暫不作答。',routineBase),
    q('routine','監所管理員-112-犯罪學概要-2','僅說明新機會理論中的日常活動理論內涵。犯罪型態及理性選擇理論部分暫不作答。',routineBase),
    q('routine','112-犯罪學-2','僅以日常活動理論分析原題網路性侵害被害問題，並提出預防建議。生活模式理論部分暫不作答。',[
      ...routineBase.map(x=>({...x,weight:15})),
      item('網路情境的理論應用',20,[['網路','線上','平台','社群'],['接近','暴露','機會','監督','守望','標的','目標']], '說明線上活動如何改變接近標的或守望條件；原文三要素在此屬延伸應用。'),
      item('對應條件的預防建議',20,[['預防','防止','減少','降低','強化','增加','保護'],['監督','守望','平台','隱私','接觸','接近','檢舉','通報']], '提出與犯罪機會條件相對應的措施，避免責怪被害人。')
    ]),
    q('routine','薦任升等（矯正）-110-犯罪學-4','僅以日常生活理論解釋原題疫情封城期間搶劫、竊盜下降與家暴、網路犯罪上升。一般化緊張理論部分暫不作答。',[
      ...routineBase.map(x=>({...x,weight:15})),
      item('外出犯罪機會下降',20,[['搶劫','竊盜','外出','街頭'],['減少','下降','降低'],['機會','目標','標的','接觸','活動']], '說明封城如何改變外出與接觸機會。'),
      item('家暴與網路犯罪上升',20,[['家暴','家庭暴力'],['網路','線上'],['增加','上升','接觸','暴露','機會']], '分別解釋居家與線上活動的變化；勿只寫所有犯罪都增加。')
    ])
  ];
  window.TOPIC_RUBRICS=Object.fromEntries(records.map(r=>[`${r.topic}|${r.questionId}`,r]));
  function normalize(s){return String(s).normalize('NFKC').toLowerCase().replace(/[\s\u200b]+/g,'');}
  function matches(sentence,groups){const n=normalize(sentence);return groups.every(group=>group.some(term=>n.includes(normalize(term))));}
  const warnings={
    control:[[/社會(?:連結|鍵|聯繫)[^。；！？\n]{0,10}(?:越強|愈強|強化)[^。；！？\n]{0,10}(?:越容易犯罪|愈容易犯罪|犯罪越多|犯罪愈多)/,'社會連結與犯罪關係可能寫反，請覆核。']],
    rnr:[[/低風險[^。；！？\n]{0,18}(?:比高風險更|最高|最強|更高強度|高強度)/,'低風險與高強度處遇的關係可能不符合風險原則，請覆核。'],[/(?:所有|全部|任何)需求[^。；！？\n]{0,12}(?:都是|均是|等同)犯罪(?:生成|基因|相關)?需求/,'可能把所有需求等同犯罪相關需求，請覆核。']],
    routine:[[/守望者(?:只|僅)(?:有|能是|是)警察/,'守望者不限於警察，請覆核此句。'],[/(?:三|3)(?:個|項)?要素[^。；！？\n]{0,12}(?:必然|一定|必定)(?:會)?(?:發生)?犯罪/,'三要素聚合不宜直接寫成犯罪必然發生，請覆核。']]
  };
  function diagnose(answer,key){
    const rubric=window.TOPIC_RUBRICS[key];if(!rubric)return null;
    const text=String(answer||'');
    const sentences=text.split(/[。；！？\n]+/).map(s=>s.trim()).filter(Boolean);
    const flagged=(warnings[rubric.topic]||[]).filter(([re])=>sentences.some(sentence => re.test(normalize(sentence)) && !/不宜|不應|不該|不必然|不一定|不代表|並非|錯誤說法/.test(sentence))).map(([,note])=>note);
    const alternative=rubric.alternativeTheory && /自我控制|gottfredson|一般化犯罪|reckless|包容理論|遏制理論/i.test(text);
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
      message:alternative?'本題允許其他社會控制理論；目前表僅涵蓋Hirschi，請人工覆核，暫不計完成度。':flagged.length?'發現需覆核語句，暫不計完成度。':'分數僅表示規則找到的論述覆蓋度，不代表內容已證實正確。',
      answer:text,createdAt:new Date().toISOString(),confidence:'有限：本機文字規則，未經人工答案校準'};
  }
  window.diagnoseTopicAnswer=diagnose;
})();
