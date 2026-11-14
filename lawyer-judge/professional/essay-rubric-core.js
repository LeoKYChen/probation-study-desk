/* Self-assessment rubric (v2.5.3 stage 2). NOT official exam grading. */
(function(root) {
  'use strict';
  const SCALE = [
    '0｜未觸及或完全無法說明',
    '1｜缺漏明顯，需大幅修正',
    '2｜部分掌握，但要件或論證不完整',
    '3｜主要內容正確，仍有改善空間',
    '4｜已充分交代，並能具體分析'
  ];
  const RULES = {
    law: {
      title:'法律科目｜法規、爭點與涵攝',
      criteria:[
        {id:'issues', label:'爭點辨識與題意回應', weight:20, hint:'能識別各小題主要法律問題，區分必要與次要爭點。'},
        {id:'law', label:'現行法規、構成要件及見解', weight:25, hint:'條文與要件應另核對官方法規，必要時指出學說／實務爭議，不杜撰條次。'},
        {id:'apply', label:'事實涵攝與法律論證', weight:35, hint:'逐項對照具體事實、法律要件、爭議及理由，而非僅下結論。'},
        {id:'organize', label:'架構、結論與完整性', weight:20, hint:'層次清楚、各小題有結論，並回扣問題。'}
      ],
      issues:['法律爭點遺漏','法條或判解待查證','要件分析不足','案例涵攝薄弱','答案架構不清楚']
    },
    'public-law': {
      title:'憲法與行政法｜爭點、審查基準與涵攝',
      criteria:[
        {id:'issues',label:'爭點辨識',weight:20,hint:'找出受限制的基本權或行政行為的法律性質（如行政處分、法規命令、事實行為），區分主要與次要爭點。'},
        {id:'standard',label:'規範與審查基準',weight:25,hint:'憲法題：基本權保護範圍、限制、法律保留、明確性、比例原則及適用的審查密度；行政法題：法律依據、程序要件與一般法律原則。條文與大法官解釋、憲法法庭判決字號須另行核對。'},
        {id:'apply',label:'事實涵攝',weight:30,hint:'把題目事實逐一對應到要件與審查步驟，說明理由，不要只列原則名稱。'},
        {id:'remedy',label:'結論與救濟',weight:15,hint:'各小題給明確結論；行政法題交代救濟途徑（訴願、行政訴訟種類）與期間等程序事項。'},
        {id:'organize',label:'結構與表達',weight:10,hint:'層次清楚、標題回扣設問。'}
      ],
      issues:['基本權或行為性質判斷錯誤','審查基準未交代','比例原則未逐步涵攝','救濟途徑遺漏','法條或解釋字號待查證']
    },
    civil: {
      title:'民法｜請求權基礎與涵攝',
      criteria:[
        {id:'basis',label:'請求權基礎與檢查順序',weight:25,hint:'先寫誰得向誰依何規定請求什麼；依契約、類似契約（如締約上過失）、無因管理、物權請求權、侵權行為、不當得利的順序檢查。'},
        {id:'elements',label:'構成要件',weight:25,hint:'逐一列出請求權成立要件，並注意權利未消滅、得否行使的檢查。'},
        {id:'defense',label:'抗辯與例外',weight:15,hint:'檢查時效、同時履行抗辯、與有過失、權利濫用或特別規定排除等。'},
        {id:'apply',label:'事實涵攝',weight:25,hint:'每個要件都要對應題目事實並說明理由；學說與實務見解有分歧時，表明採取的見解。'},
        {id:'organize',label:'結構與表達',weight:10,hint:'依請求權逐一作答，每段有小結論。'}
      ],
      issues:['請求權基礎遺漏','檢查順序錯亂','要件未逐一涵攝','抗辯或時效遺漏','條文待查證']
    },
    criminal: {
      title:'刑法｜犯罪階層與競合',
      criteria:[
        {id:'elements',label:'構成要件該當性',weight:25,hint:'客觀構成要件（行為、結果、因果關係與客觀歸責）與主觀構成要件（故意或過失）分開檢查。'},
        {id:'unlawful',label:'違法性',weight:15,hint:'檢查阻卻違法事由，如正當防衛、緊急避難、依法令之行為、得被害人承諾。'},
        {id:'guilt',label:'有責性',weight:15,hint:'責任能力、不法意識（違法性認識）、期待可能性；有錯誤問題時另外處理。'},
        {id:'system',label:'未遂、共犯與競合',weight:20,hint:'依題意交代未遂、正犯與共犯的區分，最後處理罪數與競合。'},
        {id:'apply',label:'事實涵攝',weight:15,hint:'每個要件對應題目事實，學說與實務見解有分歧時表明立場。'},
        {id:'organize',label:'結構與表達',weight:10,hint:'依行為人、依行為分段，最後統整罪名。'}
      ],
      issues:['構成要件檢查不完整','阻卻違法事由遺漏','責任層次跳過','共犯或競合處理錯誤','條文待查證']
    },
    procedure: {
      title:'訴訟法｜程序爭點與效果',
      criteria:[
        {id:'issues',label:'程序爭點辨識',weight:20,hint:'找出題目所在的程序階段與要處理的程序問題（如管轄、當事人、證據、上訴、既判力）。'},
        {id:'law',label:'法條與要件',weight:25,hint:'寫出適用條文與要件；刑事訴訟注意強制處分、證據能力與證據排除，民事訴訟注意訴訟要件與處分權主義。條次須另行核對。'},
        {id:'effect',label:'證據或程序效果',weight:20,hint:'說明違反規定時的法律效果，例如證據能否使用、程序是否違法、法院應如何處理。'},
        {id:'apply',label:'事實涵攝',weight:25,hint:'把題目事實對應到程序要件，實務見解與學說分歧時表明採取的見解。'},
        {id:'organize',label:'結構與表達',weight:10,hint:'依程序階段或依設問分段，各段有結論。'}
      ],
      issues:['程序階段判斷錯誤','條文要件遺漏','法律效果未交代','涵攝不足','條文或實務見解待查證']
    },
    commercial: {
      title:'商事法｜爭點、要件與實務',
      criteria:[
        {id:'issues',label:'爭點辨識',weight:20,hint:'找出公司、保險、證券或票據關係中的主要法律問題與當事人地位。'},
        {id:'law',label:'法條與要件',weight:30,hint:'寫出適用條文與要件，注意特別法優先與民法的補充適用。條次須另行核對。'},
        {id:'practice',label:'實務見解',weight:15,hint:'有重要實務見解或函釋時交代其要旨；未查證者標示待確認，不要杜撰字號。'},
        {id:'apply',label:'事實涵攝',weight:25,hint:'把題目事實逐一對應要件並說明理由。'},
        {id:'organize',label:'結構與表達',weight:10,hint:'依設問分段，各段有結論。'}
      ],
      issues:['爭點遺漏','特別法與普通法關係混淆','要件分析不足','實務見解待查證','涵攝薄弱']
    },
    chinese: {
      title:'國文｜作文',
      criteria:[
        {id:'idea',label:'立意取材',weight:30,hint:'切合題旨，觀點明確，取材具體且與論點相關。'},
        {id:'structure',label:'結構組織',weight:25,hint:'起承轉合完整，段落分明，論述有層次。'},
        {id:'diction',label:'文辭',weight:25,hint:'用語精確流暢，避免冗贅與口語化。'},
        {id:'mechanics',label:'字體標點',weight:10,hint:'標點正確，無錯別字。'},
        {id:'overall',label:'整體表現',weight:10,hint:'全文有說服力，結尾能回扣題旨。'}
      ],
      issues:['偏離題旨','論點不明確','結構鬆散','文辭不精確','錯別字或標點錯誤']
    },
    general: {
      title:'一般／跨科題｜內容與分析',
      criteria:[
        {id:'relevant',label:'切題與重要概念',weight:25,hint:'掌握題目要求及關鍵知識。'},
        {id:'accurate',label:'內容正確與查證',weight:25,hint:'適當核對資料，避免無依據推論。'},
        {id:'apply',label:'分析與具體例證',weight:25,hint:'呈現理由、關聯及具體應用。'},
        {id:'organize',label:'結構與完整性',weight:25,hint:'完整回題，文字清楚。'}
      ],
      issues:['題意掌握不足','基礎知識待核對','分析不足','缺少例證','架構不清楚']
    }
  };
  for (const rubric of Object.values(RULES)) {
    if (rubric.criteria.reduce((n,c)=>n+c.weight,0)!==100) throw Error('rubric weights != 100');
  }
  function subjectType(raw){
    const s=String(raw||'');
    if(/國文|作文/.test(s))return 'chinese';
    if(/民法與民事訴訟法/.test(s))return 'civil';
    if(/刑法與刑事訴訟法/.test(s))return 'criminal';
    if(/訴訟法|強制執行法/.test(s))return 'procedure';
    if(/憲法|行政法/.test(s))return 'public-law';
    if(/刑法/.test(s))return 'criminal';
    if(/民法/.test(s))return 'civil';
    if(/公司法|保險法|證券交易法|票據法|商事法/.test(s))return 'commercial';
    if(/法/.test(s))return 'law';
    return 'general';
  }
  function validate(type,data){
    const rubric=RULES[type];
    if(!rubric || !data || data.rubric!==type || data.version!==1 || typeof data.scores!=='object' || !data.scores || Array.isArray(data.scores)) return false;
    const ids=new Set(rubric.criteria.map(c=>c.id));
    if(Object.keys(data.scores).some(k=>!ids.has(k)))return false;
    if(Object.values(data.scores).some(s=>!Number.isInteger(s)||s<0||s>4))return false;
    if(!Array.isArray(data.issues)||data.issues.length>rubric.issues.length||data.issues.some(s=>!rubric.issues.includes(s))||new Set(data.issues).size!==data.issues.length)return false;
    if(typeof data.nextStep!=='string'||data.nextStep.length>3000)return false;
    return true;
  }
  function score(type,scores){
    const rubric=RULES[type];
    if(!rubric)return null;
    if(!rubric.criteria.every(c=>Number.isInteger(scores?.[c.id])&&scores[c.id]>=0&&scores[c.id]<=4))return null;
    return Math.round(rubric.criteria.reduce((sum,c)=>sum+c.weight*scores[c.id]/4,0));
  }
  root.Study30Rubric={SCALE,RULES,subjectType,validate,score};
})(window);
