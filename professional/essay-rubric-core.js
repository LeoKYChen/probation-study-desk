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
    psychology: {
      title:'心理學｜理論與心理機制',
      criteria:[
        {id:'definition',label:'概念界定與題意掌握',weight:20,hint:'正確定義核心術語，交代題目所問範圍。'},
        {id:'theory',label:'心理學理論正確性',weight:30,hint:'理論、學者、重要構念及彼此關係說明正確。'},
        {id:'mechanism',label:'心理機制與證據說明',weight:20,hint:'說明為何、如何產生心理現象；必要時區分研究發現與個人推論。'},
        {id:'application',label:'情境應用與限制',weight:20,hint:'能依題目情境分析，說明理論適用限制。'},
        {id:'organize',label:'結構與結論',weight:10,hint:'條理清晰、結論明確回應問題。'}
      ],
      issues:['名詞定義不精確','理論或學者混淆','機制解釋不足','實例應用薄弱','研究依據待核對']
    },
    criminology: {
      title:'犯罪學｜理論比較與犯罪預防',
      criteria:[
        {id:'definition',label:'問題意識與基本概念',weight:20,hint:'界定犯罪學核心問題、研究對象與重要概念。'},
        {id:'theory',label:'犯罪學理論正確性',weight:30,hint:'正確說明理論主張、作用機制與必要的學者觀點。'},
        {id:'comparison',label:'理論比較與批判分析',weight:20,hint:'依題意比較理論解釋力、侷限與相異之處。'},
        {id:'practice',label:'犯罪預防與實務應用',weight:20,hint:'將理論連結少年偏差、犯罪預防、復歸或處遇，避免空泛。'},
        {id:'organize',label:'架構與結論',weight:10,hint:'結構完整，明確回應題目要求。'}
      ],
      issues:['重要理論混淆','因果機制交代不足','理論比較不足','預防政策應用空泛','結論未回題']
    },
    counseling: {
      title:'諮商與輔導｜個案概念化與倫理',
      criteria:[
        {id:'assess',label:'個案評估與問題辨識',weight:20,hint:'掌握個案主訴、風險、需求與情境因素，不憑空診斷。'},
        {id:'approach',label:'諮商理論與介入原理',weight:25,hint:'說明所採理論、主要概念及介入理由。'},
        {id:'intervention',label:'具體技術與處遇安排',weight:25,hint:'提出可操作的輔導步驟、合作資源與評估方式。'},
        {id:'ethics',label:'專業倫理、界限及安全',weight:20,hint:'考量保密及例外、當事人自主、轉介與安全風險。'},
        {id:'organize',label:'回應題目與結論',weight:10,hint:'有層次地統整個案處理思路。'}
      ],
      issues:['個案評估不足','諮商理論不精確','輔導技術過於空泛','倫理或風險遺漏','介入成效評估不足']
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
    if(/心理學/.test(s))return 'psychology';
    if(/犯罪學/.test(s))return 'criminology';
    if(/諮商|輔導/.test(s))return 'counseling';
    if(/刑法|刑事訴訟法|少年事件處理法|保安處分執行法|法學知識|憲法|行政法/.test(s))return 'law';
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
