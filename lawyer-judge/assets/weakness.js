/* 弱點地圖（純計算，不讀寫儲存）：把第一試選擇題正確率、第二試評分要點命中率、申論自評合成各科優先順序。
   優先分數＝權重 ×（1 − 掌握度）。權重只依題庫題數（選擇題占比＋申論占比），不是官方配分。 */
(function(root){
  'use strict';
  const MIN_MCQ=10; // 選擇題至少作答 10 次才列入
  // 第二試考科 ↔ 第一試科目；paper 為 null 的只考第一試
  const GROUPS=[
    {name:'憲法與行政法',paper:'憲法與行政法',mcq:['憲法','行政法']},
    {name:'刑法與刑事訴訟法',paper:'刑法與刑事訴訟法',mcq:['刑法','刑事訴訟法']},
    {name:'民法與民事訴訟法',paper:'民法與民事訴訟法',mcq:['民法','民事訴訟法']},
    {name:'公司法、保險法與證券交易法',paper:'公司法、保險法與證券交易法',mcq:['公司法','保險法','證券交易法']},
    {name:'智慧財產法（選試）',paper:'智慧財產法',mcq:[]},
    {name:'票據法',paper:null,mcq:['票據法']},{name:'強制執行法',paper:null,mcq:['強制執行法']},
    {name:'國際公法',paper:null,mcq:['國際公法']},{name:'國際私法',paper:null,mcq:['國際私法']},
    {name:'法律倫理',paper:null,mcq:['法律倫理']},{name:'法學英文',paper:null,mcq:['法學英文']}
  ];
  /* input：{mcqBank:[{id,subject,status}], mcqRecords:{id:{n,c}}, essayBank:[{subject}], pointStats:[{subject,hit,miss,questions}], selfStats:[{label,mastered,partial,review}]} */
  function compute(input){
    const mb=input.mcqBank||[],rec=input.mcqRecords||{},eb=input.essayBank||[];
    const scored=mb.filter(q=>q.status!=='incomplete'),mcqTotal=scored.length||1;
    const papers=new Set(GROUPS.map(g=>g.paper).filter(Boolean)),essayTotal=eb.filter(q=>papers.has(q.subject)).length||1;
    const rows=GROUPS.map(g=>{
      const qs=scored.filter(q=>g.mcq.includes(q.subject));let att=0,ok=0;
      for(const q of qs){const r=rec[q.id];if(r&&r.n){att+=r.n;ok+=r.c||0;}}
      const essayCount=g.paper?eb.filter(q=>q.subject===g.paper).length:0;
      const weight=qs.length/mcqTotal+essayCount/essayTotal;
      const parts=[];
      if(att>=MIN_MCQ)parts.push({kind:'mcq',value:ok/att,text:`選擇題正確率 ${Math.round(ok/att*100)}%（${att} 次）`});
      const ps=(input.pointStats||[]).find(s=>s.subject===g.paper);
      if(ps&&ps.hit+ps.miss>0)parts.push({kind:'points',value:ps.hit/(ps.hit+ps.miss),text:`評分要點命中 ${Math.round(ps.hit/(ps.hit+ps.miss)*100)}%（${ps.questions} 題）`});
      let m=0,p=0,r=0;for(const s of input.selfStats||[]){if(s.label===g.paper||g.mcq.includes(s.label)){m+=s.mastered||0;p+=s.partial||0;r+=s.review||0;}}
      if(m+p+r>0)parts.push({kind:'self',value:(m+p*0.5)/(m+p+r),text:`申論自評 掌握 ${m}／不完整 ${p}／需複習 ${r}`});
      const mastery=parts.length?parts.reduce((t,x)=>t+x.value,0)/parts.length:null;
      return {name:g.name,paper:g.paper,mcq:g.mcq,weight,mcqQuestions:qs.length,essayQuestions:essayCount,mcqAttempts:att,parts,mastery,priority:mastery==null?null:weight*(1-mastery)};
    }).filter(r=>r.weight>0);
    const ranked=rows.filter(r=>r.priority!=null).sort((a,b)=>b.priority-a.priority||b.weight-a.weight);
    const untouched=rows.filter(r=>r.priority==null).sort((a,b)=>b.weight-a.weight);
    return {ranked,untouched,MIN_MCQ};
  }
  root.WeaknessMap={GROUPS,compute};
})(typeof window!=='undefined'?window:this);
