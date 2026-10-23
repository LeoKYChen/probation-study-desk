/* Stage 3: READ-ONLY, offline-capable print model, no storage writes or network.
   Sources: original 426 bank, 125 daily JSON, 132 common-subject essay prompts. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.PSDEssayPrint=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const OLD=[
 ['挫折與成長','從個人經驗或實際觀察出發，說明挫折如何使人成長。'],
 ['在變動中學習','當所學與工作環境不同時，如何調整與學習？'],
 ['責任與選擇','當個人利益與責任衝突時，應如何選擇？'],
 ['理解與同理','理解他人的處境，是否等於認同他的行為？'],
 ['守法與信任','制度如何建立人民的信任？'],
 ['耐心的力量','效率掛帥的時代，耐心為何重要？'],
 ['勇於改變','何時應該改變，何時應謹慎堅持？'],
 ['小事中的專業','從平凡工作經驗說明專業態度如何養成。'],
 ['傾聽與溝通','立場不同時，傾聽的價值與限制是什麼？'],
 ['公平與差異','相同對待是否一定公平？'],
 ['失敗後的修正','錯誤如何轉化為持續進步的動力？'],
 ['以行動回應理想','理想落實於生活，需要哪些具體行動？']
 ];
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const str=v=>typeof v==='string'?v:'';
 const populated=v=>str(v).trim().length>0;
 const section=(title,body,group='answer')=>({title,body:str(body),group});
 const LAW=['刑法','刑事訴訟法','少年事件處理法','保安處分執行法'];
 const OUTLAW=['一、審題與爭點辨識','二、法律依據與要件','三、具體涵攝與論證','四、結論與作答回應'];
 const OUTTHEORY=['一、概念與題意界定','二、理論要點與比較','三、情境應用與實務分析','四、統整結論'];
 const OUTGENERAL=['一、題目爭點','二、法律或學理依據','三、涵攝與實務應用','四、結論'];
 const keys=['probation-study30-v251:v1','probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2','probation-daily-github:records:v1','psd-common-subjects-v1'];
 function parse(storage,key,errors){
  const raw=storage.getItem(key);
  if(raw===null)return null;
  try{const x=JSON.parse(raw);if(!obj(x))throw Error('資料不是紀錄物件');return x;}
  catch(e){errors.push(key+' 無法安全讀取：'+e.message);return null;}
 }
 function anyText(sections){return sections.some(s=>populated(s.body));}
 function printRecords(storage,sources={}){
  const records=[],errors=[],past=[...(sources.past||[])],byId=new Map(past.map(q=>[q.id,q]));
  const daily=new Map((sources.daily||[]).map(q=>[q.id,q])),essay=[...OLD.map(([title,body])=>({title,body})),...(sources.essays||[])];
  const professional=parse(storage,keys[0],errors);
  if(professional){
   if(professional.version!==1||!obj(professional.sessions))errors.push('專業科目紀錄版本無法辨識，未列印。');
   else {
    const all=Object.values(professional.sessions).filter(obj);
    // Cross-day AI reviews are available to the original app; use the same fallback.
    const latestReview=id=>all.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).find(s=>obj(s.aiReviewTexts)&&typeof s.aiReviewTexts[id]==='string')?.aiReviewTexts[id]||'';
    for(const [day,s] of Object.entries(professional.sessions)){
     if(!obj(s))continue;
     const drafts=obj(s.essayDrafts)?s.essayDrafts:{};
     for(const [id,d] of Object.entries(drafts)){
      if(!obj(d))continue;
      const q=byId.get(id),manual=str(s.essayCustomPrompts?.[id]);
      const subject=str(q?.subject||s.essayPracticeSubject||'自主練習'),labels=d.template==='law'||(d.template!=='theory'&&LAW.some(x=>subject.includes(x)))?OUTLAW:OUTTHEORY;
      const parts=Array.isArray(d.outline)?d.outline:[];
      const sections=labels.map((name,i)=>section(name,parts[i]||''));
      sections.push(section('完整申論答案',d.fullAnswer||''));
      const assessment=s.essayAssessments?.[id];
      if(obj(assessment)){
       let line='';
       if(obj(assessment.scores))line+='自評（每項／4）：'+Object.entries(assessment.scores).map(([k,v])=>k+' '+String(v)).join('、');
       if(Array.isArray(assessment.issues)&&assessment.issues.length)line+='\n待補強：'+assessment.issues.join('、');
       if(populated(assessment.nextStep))line+='\n下次改善目標：'+assessment.nextStep;
       sections.push(section('我的申論自評（非官方閱卷）',line,'review'));
      }
      sections.push(section('AI 批改評語（自行貼入，非官方評分）',str(s.aiReviewTexts?.[id]||latestReview(id)),'feedback'));
      const notes=Array.isArray(s.notes)?s.notes.filter(populated):[];
      if(notes.length)sections.push(section('當日練習札記',notes.join('\n\n'),'review'));
      if(!anyText(sections))continue;
      records.push({uid:'study30:'+day+':'+id,category:'study30',categoryLabel:'專業科目每日30分鐘',title:q?.title||id,
       meta:[day,subject,str(q?.examType||'')].filter(Boolean).join(' · '),question:q?.body||manual||'（此筆紀錄沒有保存原題文字，請先至練習頁核對題目。）',
       source:q?.source||'',sections,updatedAt:d.updatedAt||s.updatedAt||'',recordId:id});
     }
    }
   }
  }
  // Only use the newest available main-key record, then fill absent IDs from legacy.
  const seen=new Set();
  for(const key of keys.slice(1,4)){
   const map=parse(storage,key,errors);
   if(!map)continue;
   for(const [id,d] of Object.entries(map)){
    if(seen.has(id)||!obj(d))continue;
    seen.add(id);
    const q=byId.get(id);
    const draft=obj(d.essayDrafts)?d.essayDrafts:{};
    const sections=OUTGENERAL.map((name,i)=>section(name,str(draft[['issues','basis','analysis','conclusion'][i]])));
    sections.push(section('完整申論答案',d.issue||''));
    const assessment=obj(d.assessment)?d.assessment:null;
    if(assessment){
     let notes='';
     if(Array.isArray(assessment.strengths)&&assessment.strengths.length)notes+='優點：'+assessment.strengths.join('、');
     if(Array.isArray(assessment.improvements)&&assessment.improvements.length)notes+='\n待補強：'+assessment.improvements.join('、');
     if(assessment.total!==undefined&&assessment.total!==null)notes+='\n本站參考評分：'+assessment.total+'（非官方）';
     sections.push(section('本站練習參考評估（非官方）',notes,'review'));
    }
    if(obj(d.pointFeedback))sections.push(section('我的逐點核對筆記',Object.entries(d.pointFeedback).map(([k,v])=>k+'：'+(typeof v==='string'?v:JSON.stringify(v))).join('\n'),'review'));
    if(populated(d.aiFeedback))sections.push(section('AI 批改評語（自行貼入，非官方評分）',d.aiFeedback,'feedback'));
    if(!anyText(sections))continue;
    records.push({uid:'past:'+id,category:'past',categoryLabel:'考古題練習',title:q?.title||id,
     meta:q?[q.year+' 年',q.subject,q.examType||''].filter(Boolean).join(' · '):id+'（舊題號／尚未核對）',
     question:q?.body||'（題庫找不到這個舊題號，請至原題庫核對題幹。）',
     source:q?.source||'',sections,updatedAt:d.updatedAt||'',recordId:id});
   }
  }
  const simulation=parse(storage,keys[4],errors);
  if(simulation)for(const [id,d] of Object.entries(simulation)){
   if(!obj(d))continue;
   const q=daily.get(id),draft=obj(d.essayDrafts)?d.essayDrafts:{};
   const sections=OUTGENERAL.map((name,i)=>section(name,str(draft[['issues','basis','analysis','conclusion'][i]])));
   sections.push(section('完整申論答案',d.answer||''));
   sections.push(section('AI 批改評語（自行貼入，非官方評分）',d.aiFeedback||'','feedback'));
   if(!anyText(sections))continue;
   records.push({uid:'daily:'+id,category:'daily',categoryLabel:'每日模擬題',title:q?[q.date+'｜'+q.subject]:'每日模擬題 '+id,
    meta:q?[q.date,q.subject,'模擬題（非官方原題）'].join(' · '):id+'（舊題號／尚未核對）',
    question:q?.question||'（題庫未找到此題，請核對原題文字。）',source:q?.sourceReference||'',sections,
    updatedAt:d.updatedAt||'',recordId:id});
  }
  const common=parse(storage,keys[5],errors);
  if(common){
   if(common.schema!=='psd-common-subjects-v1'||!obj(common.drafts))errors.push('國文作文紀錄格式不符，未列印。');
   else for(const [key,d] of Object.entries(common.drafts)){
    const match=/^(sentence|paragraph|opening|full):(\d+)$/.exec(key);
    if(!match||!obj(d))continue;
    const q=essay[Number(match[2])];
    const sections=[section('我的作文',d.text||'')];
    if(Array.isArray(d.versions))d.versions.forEach((v,i)=>{
      if(obj(v))sections.push(section('保存版本 '+(i+1)+(str(v.date)?'（'+v.date.slice(0,16).replace('T',' ')+'）':''),v.text||'','revision'));
    });
    sections.push(section('批改或訂正評語',d.feedback||'','feedback'));
    sections.push(section('下次改進目標',d.nextAction||'','review'));
    if(!anyText(sections))continue;
    const kind={sentence:'句子精修',paragraph:'段落深化',opening:'開頭結尾',full:'完整作文'}[match[1]];
    records.push({uid:'common:'+key,category:'common',categoryLabel:'國文作文',title:q?.title||'作文題目 '+match[2],
     meta:kind+' · '+(q?.type==='short'?'短文':q?.type==='long'?'長文':'既有原創題'),
     question:q?.body||'（未找到對應作文題幹，請先核對題庫索引。）',
     source:q?.source?.exam?String(q.source.exam)+'（本站改編練習，非官方原題）':'',sections,
     updatedAt:d.updatedAt||'',recordId:key});
   }
  }
  records.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))||a.uid.localeCompare(b.uid));
  return {records,errors};
 }
 return {OLD,printRecords};
});
