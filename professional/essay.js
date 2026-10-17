/* v2.5.3 stage-one essay workspace; no separate storage key or timer. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const LAW_SUBJECTS=['刑法','刑事訴訟法','少年事件處理法','保安處分執行法','法學知識'];
  const TEMPLATES={
    law:[
      ['一、審題與爭點辨識','題目問的是什麼？列出主要與次要法律爭點，避免僅重述事實。'],
      ['二、法律依據與要件','寫出應核對的現行法規、構成要件及必要學說／實務見解；不要杜撰條文。'],
      ['三、具體涵攝與論證','逐項對照題幹事實和法律要件；有爭議時說明不同見解及理由。'],
      ['四、結論與作答回應','按題目各小題作出明確結論，並簡述結論成立的理由。']
    ],
    theory:[
      ['一、概念與題意界定','界定核心概念及題目要求，比較題、申論題與案例題的任務不同。'],
      ['二、理論要點與比較','說明主要理論、學者觀點、重要構念；如題目要求，比較不同理論。'],
      ['三、情境應用與實務分析','把理論連結題目情境、少年處遇或輔導實務；指出適用限制及倫理考量。'],
      ['四、統整結論','針對題目作出有層次的歸納，回扣前述理論與分析。']
    ]
  };
  const DEFAULT={template:'theory',outline:['','','',''],fullAnswer:'',updatedAt:null};
  let activeId=null,activeDate=null,activeSessionToken=null;
  function defaultTemplate(subject){return LAW_SUBJECTS.some(name=>String(subject||'').includes(name))?'law':'theory';}
  function getDraft(){
    return {template:$('essayTemplate').value,outline:[0,1,2,3].map(i=>$('essayField'+i).value),fullAnswer:$('essayFullAnswer').value};
  }
  function setLabels(template){
    const fields=TEMPLATES[template]||TEMPLATES.theory;
    for(let i=0;i<4;i++){
      $('essayLabel'+i).textContent=fields[i][0];
      $('essayHint'+i).textContent=fields[i][1];
      $('essayField'+i).placeholder=fields[i][1];
    }
  }
  function countText(){
    const data=getDraft();
    const count=[...data.outline,data.fullAnswer].join('').replace(/\s/g,'').length;
    $('essayCharCount').textContent=`目前 ${count.toLocaleString('zh-TW')} 字元（不計空白）`;
  }
  function describeTime(iso){
    if(!iso)return '尚無草稿';
    const date=new Date(iso);
    return Number.isNaN(date.getTime())?'已有草稿':`已保存｜${date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
  }
  function persistForm(){
    const api=window.Study30App;
    if(!api||!activeId)return;
    const ok=api.saveEssay(activeId,getDraft());
    $('essaySaveStatus').textContent=ok?'已自動保存至本機':'未能保存：請勿關閉網頁，先複製文字或使用下方匯出功能。';
    $('essaySaveStatus').classList.toggle('essay-error',!ok);
    countText();
    if(ok)window.dispatchEvent(new CustomEvent('study30:essay-saved'));
  }
  function loadFromSession(){
    const ctx=window.Study30App?.essayContext();
    if(!ctx)return;
    const changed=ctx.questionId!==activeId||ctx.date!==activeDate||ctx.sessionToken!==activeSessionToken;
    activeId=ctx.questionId;activeDate=ctx.date;activeSessionToken=ctx.sessionToken;
    $('essaySubject').textContent=`科目：${ctx.subject||'自主練習'}`;
    $('essayQuestion').textContent=ctx.questionHeading||'本階段請依上方今日任務自主選題';
    $('essayQuestionBody').textContent=ctx.questionBody||'此科目暫無可對應的考古題，可自行輸入題目後練習。';
    $('essayQuestionSource').hidden=!ctx.questionSource;
    if(ctx.questionSource)$('essayQuestionSource').href=ctx.questionSource;
    $('essayManualQuestionBox').hidden=!ctx.manual;
    if(changed)$('essayManualQuestion').value=ctx.customPrompt||'';
    // Rehydrate on every task/phase switch, but do not overwrite an in-progress
    // editor with a stale value when the question stays the same.
    if(changed){
      const d=ctx.draft||DEFAULT,template=d.template||defaultTemplate(ctx.subject);
      $('essayTemplate').value=template;
      [0,1,2,3].forEach(i=>{$('essayField'+i).value=d.outline?.[i]||'';});
      $('essayFullAnswer').value=d.fullAnswer||'';
      $('essaySaveStatus').textContent=describeTime(d.updatedAt);
      $('essaySaveStatus').classList.remove('essay-error');
      setLabels(template);countText();
    }
    // Essay drafting remains available after the daily timer finishes.
    // It does not add to the completed session's elapsed seconds.
    if(ctx.finished && changed)$('essaySaveStatus').textContent+='（今日計時已結束，仍可補寫草稿）';
  }
  function mdSafe(t){return String(t||'').replaceAll('\r\n','\n');}
  function assessmentMarkdown(){
    const record=window.Study30App?.essayAssessmentContext?.()?.assessment;
    const core=window.Study30Rubric;
    if(!record||!core?.validate(record.rubric,record))return [];
    const rule=core.RULES[record.rubric],result=core.score(record.rubric,record.scores);
    const lines=['## 我的申論自評（非官方閱卷）','',`- 評分規準：${rule.title}`,
      `- 個人自評：${result===null?'尚未完成各項評分':result+'／100'}`,'',
      ...rule.criteria.map(c=>`- ${c.label}（權重 ${c.weight}%）：${Number.isInteger(record.scores[c.id])?record.scores[c.id]+'／4':'尚未評分'}`),
      '',`- 待補強：${record.issues.length?record.issues.join('、'):'尚未標記'}`,
      `- 下次改善目標：${record.nextStep||'尚未填寫'}`,''];
    return lines;
  }
  function exportEssay(){
    const ctx=window.Study30App?.essayContext();
    if(!ctx||!activeId)return;
    const data=getDraft(),template=TEMPLATES[data.template]||TEMPLATES.theory;
    const text=[`# 國考申論練習｜${ctx.subject||'自主練習'}`,'',`- 日期：${ctx.date}`,
      `- 題目：${ctx.questionHeading||'自選題'}`,`- 模板：${data.template==='law'?'法律科目':'學理科目'}`,
      `- 來源：${ctx.manual?'使用者自選練習題':'既有觀護人考古題'}`,'',
      '## 本次題目','',mdSafe(ctx.manual?ctx.customPrompt:ctx.questionBody),'',
      ...template.flatMap((part,i)=>[`## ${part[0]}`,'',mdSafe(data.outline[i]),'']),
      '## 完整申論答案','',mdSafe(data.fullAnswer),'',
      ...assessmentMarkdown(),
      '> 本文為個人練習草稿，未經官方評分或答案核對。申論自評是個人練習參考分數。',''].join('\n');
    const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const safeSubject=String(ctx.subject||'自主練習').replace(/[\/:*?"<>|]/g,'-');
    a.href=url;a.download=`study30-essay-${ctx.date}-${safeSubject}.md`;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function start(){
    if(!window.Study30App?.essayContext){$('essaySaveStatus').textContent='申論模組無法載入，請重新整理網頁。';return;}
    $('essayTemplate').addEventListener('change',()=>{setLabels($('essayTemplate').value);persistForm();});
    [0,1,2,3].forEach(i=>$('essayField'+i).addEventListener('input',persistForm));
    $('essayFullAnswer').addEventListener('input',persistForm);
    $('essayExport').addEventListener('click',exportEssay);
    $('essayManualQuestion').addEventListener('input',()=>{
      const ctx=window.Study30App?.essayContext();
      if(!ctx?.manual||activeId!==ctx.questionId)return;
      const ok=window.Study30App.saveEssayManualQuestion(ctx.questionId,$('essayManualQuestion').value);
      if(!ok)$('essaySaveStatus').textContent='自選題目無法儲存，請先複製文字備份。';
    });
    window.addEventListener('study30:render',loadFromSession);
    loadFromSession();
  }
  window.Study30Essay={defaultTemplate,TEMPLATES};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
