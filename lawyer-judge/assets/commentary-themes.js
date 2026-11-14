/* 閱卷委員的話：跨年度常見失分類型。
   類型名稱與「作答前自問」是整理者依原文歸納的用語；歸類方式是關鍵字比對，可能多算或漏算。
   畫面上列出的段落一律是考選部原文。 */
(function(root){
  'use strict';
  const THEMES=[
    {id:'question',name:'沒答到題目問的',ask:'每個子題問的是什麼？我的每一段有沒有對著提問回答？',
     re:/答非所問|離題|文不對題|偏離(題意|提問|題旨)|未(能)?(適切)?(掌握|理解|看清|注意|緊扣).{0,6}(題意|題旨|提問|問題意識)|誤解(題意|案例事實|題目)|未清楚閱讀|未(能)?緊扣/},
    {id:'issue',name:'漏掉主要爭點，或把篇幅花在非重點',ask:'這題配分最重的爭點是哪幾個？有沒有哪個只寫了一兩行，或把篇幅花在題目沒問的地方？',
     re:/(遺漏|漏未|忽略|未(能)?(發現|意識到?|察覺|注意到?|掌握)).{0,12}(爭點|問題|規定|要件)|並非本題(答題)?(之)?重點|(大量|相當|過多|大)(試卷)?篇幅/},
    {id:'article',name:'沒引條文、引錯條號、請求權基礎不明',ask:'每個結論前面有沒有寫出條、項、款？請求權基礎或處罰依據講清楚了嗎？',
     re:/未(能)?(正確|明確|具體|精確)?(引用|引述|指出|援引|引出).{0,8}(條文|法條|條號|規定|依據)|條號|條、項、款|條項款|請求權基礎|錯引|誤引|錯誤(援引|引用)/},
    {id:'subsume',name:'只寫抽象法理，沒有把事實套進要件',ask:'我有沒有把題目給的事實一項一項對到要件？還是只背了定義和法條？',
     re:/涵攝|(僅|只|純粹)(止於)?(抽象|羅列|背誦|抄錄)|羅列法條|空泛|泛泛|想當然耳|未(能)?(結合|扣緊|依據|針對)(本題|題示|個案|案例)?事實/},
    {id:'reason',name:'只給結論、說理不足或前後矛盾',ask:'每個結論後面有沒有「因為」？前後的判斷有沒有互相打架？',
     re:/(僅|只)(有|寫|提出|回答|給|作出)?.{0,4}結論|結論性判斷|未(附|說明|敘明|交代).{0,6}理由|理由(不備|不足|欠缺)|說理|前後(矛盾|衝突)|斷言/},
    {id:'practice',name:'不知道或沒提到重要的實務見解',ask:'這個爭點有沒有重要的判決、決議、大法官解釋或憲法法庭判決？我提到了嗎？',
     re:/不知實務|(不熟|未(能)?(掌握|注意|引用|提及|知悉|援引|論及)|忽略|欠缺).{0,14}(實務|最高法院|大法官|釋字|憲法法庭|判決|判例|決議|大法庭|解釋)/},
    {id:'dispute',name:'爭議沒交代清楚就下結論',ask:'這裡真的有爭議嗎？有的話，我有沒有先說明爭議在哪、各說理由，再表明採哪一說？',
     re:/(未|沒有|欠缺|忽略).{0,14}(學說|不同見解|爭議)|僅(採|就|以).{0,10}(一說|通說|實務)|爭議(點|所在)|不同(意見|見解)/},
    {id:'structure',name:'子題分配不均、層次與結構混亂',ask:'各子題的篇幅有沒有照配分分配？有沒有分點、照審查順序寫？',
     re:/分配不均|時間(分配|不足|不夠)|未及作答|分項|分點|層次(不清|混亂|分明|不明)|條理|(答題|作答|解題|論述|審查)(之|的)?(順序|架構|結構|層次)|混雜|一貫性/},
    {id:'concept',name:'基本觀念混淆、要件記錯',ask:'這題用到的幾個概念，我分得清楚彼此的差別和各自的要件嗎？',
     re:/混淆|基本(概念|觀念|法條|規定).{0,14}(不|欠|錯|未|誤)|觀念(不清|錯誤|模糊)|誤(認|以為|用)|不(甚|太|夠)?(清楚|熟悉|瞭解|了解)/}
  ];
  // 回傳各類型的統計與命中的原文段落；subject 為空表示全部科目
  function analyze(points,subject){
    const rows=Object.values(points||{}).filter(d=>!subject||d.subject===subject),withText=rows.filter(d=>d.commentary&&d.commentary.length);
    const themes=THEMES.map(t=>{
      const hits=[];let questions=0;
      for(const d of withText){const ps=d.commentary.filter(p=>t.re.test(p));if(ps.length){questions++;for(const p of ps)hits.push({year:d.year,subject:d.subject,questionNo:d.questionNo,text:p});}}
      hits.sort((a,b)=>b.year-a.year||a.subject.localeCompare(b.subject,'zh-Hant')||a.questionNo-b.questionNo);
      return {id:t.id,name:t.name,ask:t.ask,questions,hits};
    }).sort((a,b)=>b.questions-a.questions);
    return {total:withText.length,themes};
  }
  root.CommentaryThemes={THEMES,analyze};
})(typeof window!=='undefined'?window:this);
