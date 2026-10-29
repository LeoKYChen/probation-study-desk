/* v2.5.3 Stage 2: transparent self-assessment, same local study30 record. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const Core=window.Study30Rubric;
  let currentQuestionId='',currentToken='',currentDate='',activeType='',lastData=null;
  const make=(tag,txt,cls)=>{const el=document.createElement(tag);if(txt!==undefined)el.textContent=txt;if(cls)el.className=cls;return el;};
  function context(){return window.Study30App?.essayAssessmentContext?.();}
  function currentValue(){
    const scores={};
    document.querySelectorAll('[data-rubric-score]').forEach(sel=>{
      if(sel.value!=='')scores[sel.dataset.rubricScore]=Number(sel.value);
    });
    const issues=Array.from(document.querySelectorAll('[data-rubric-issue]:checked'),b=>b.value);
    return {version:1,rubric:activeType,scores,issues,nextStep:$('rubricNextStep').value};
  }
  function resultDisplay(data,ctx,wasLoaded=false){
    if(!data||!Core.RULES[data.rubric])return;
    const rule=Core.RULES[data.rubric];
    const completed=rule.criteria.filter(c=>Number.isInteger(data.scores[c.id])).length;
    const result=Core.score(data.rubric,data.scores);
    $('rubricProgress').textContent=`已評 ${completed}／${rule.criteria.length} 項`;
    $('rubricScore').textContent=result===null?'完成全部準則後才顯示自評分數':`自評 ${result}／100（非國考評分）`;
    $('rubricScore').dataset.complete=String(result!==null);
    const savedAt=data.assessedAt;
    if(savedAt){
      let t='已保存自評';
      const date=new Date(savedAt);
      if(Number.isFinite(date.getTime()))t+=`｜${date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}`;
      $('rubricSaveStatus').textContent=t;
    }else if(wasLoaded){$('rubricSaveStatus').textContent='尚未填寫自評';}
    $('rubricStale').hidden=!(savedAt&&ctx?.draft?.updatedAt&&new Date(ctx.draft.updatedAt)>new Date(savedAt));
  }
  async function store(){
    if(!activeType||!currentQuestionId)return;
    const values=currentValue();
    if(!Core.validate(activeType,values)){
      $('rubricSaveStatus').textContent='自評資料格式不正確，請重新選擇評分。';return;
    }
    const ok=window.Study30App.saveEssayAssessment(currentQuestionId,values);
    if(!ok){$('rubricSaveStatus').textContent='儲存失敗，請匯出JSON備份並檢查儲存空間。';return;}
    if(window.PSD_STUDY30_IDB_TEST===true){$('rubricSaveStatus').textContent='儲存中…';try{await window.Study30App.whenSaved();}catch{$('rubricSaveStatus').textContent='儲存失敗，請匯出備份。';return;}}
    lastData=window.Study30App.essayAssessmentContext()?.assessment||null;
    resultDisplay(lastData,context());
    window.dispatchEvent(new CustomEvent('study30:essay-assessed'));
  }
  function build(type){
    const rule=Core.RULES[type];
    $('rubricType').textContent=rule.title;
    const criteria=$('rubricCriteria'),issues=$('rubricIssues');
    criteria.replaceChildren();issues.replaceChildren();
    for(const c of rule.criteria){
      const wrap=make('div',undefined,'rubric-item');
      const label=make('label',`${c.label}（權重 ${c.weight}%）`);
      label.htmlFor='rubricField'+c.id;
      const desc=make('p',c.hint,'rubric-hint');
      const select=make('select');select.id='rubricField'+c.id;select.dataset.rubricScore=c.id;
      const none=make('option','尚未評定');none.value='';select.append(none);
      for(let i=0;i<Core.SCALE.length;i++){
        const option=make('option',Core.SCALE[i]);option.value=String(i);select.append(option);
      }
      select.addEventListener('change',store);
      wrap.append(label,desc,select);criteria.append(wrap);
    }
    for(const reason of rule.issues){
      const label=make('label',undefined,'rubric-issue');const input=make('input');
      input.type='checkbox';input.value=reason;input.dataset.rubricIssue='';input.addEventListener('change',store);
      label.append(input,document.createTextNode(reason));issues.append(label);
    }
  }
  function load(){
    const ctx=context();if(!ctx)return;
    const type=Core.subjectType(ctx.subject);
    const changed=currentQuestionId!==ctx.questionId||currentDate!==ctx.date||currentToken!==ctx.sessionToken||activeType!==type;
    if(!changed)return;
    currentQuestionId=ctx.questionId;currentDate=ctx.date;currentToken=ctx.sessionToken;activeType=type;
    build(type);
    // A record of another rubric must never be applied to a different subject.
    const saved=ctx.assessment;
    const data=saved?.rubric===type&&Core.validate(type,saved)?saved:null;
    lastData=data;
    for(const sel of document.querySelectorAll('[data-rubric-score]')){
      const value=data?.scores?.[sel.dataset.rubricScore];sel.value=Number.isInteger(value)?String(value):'';
    }
    for(const inp of document.querySelectorAll('[data-rubric-issue]'))inp.checked=!!data?.issues?.includes(inp.value);
    $('rubricNextStep').value=data?.nextStep||'';
    $('rubricQuestion').textContent=(ctx.subject?ctx.subject+'｜':'')+(ctx.questionHeading||'自主練習');
    $('rubricSaveStatus').textContent=data?'已載入先前自評':'尚未填寫自評';
    resultDisplay(data||{rubric:type,scores:{},issues:[],nextStep:''},ctx,true);
  }
  function refreshStale(){
    const ctx=context();if(!ctx||!lastData||!lastData.assessedAt)return;
    $('rubricStale').hidden=!(ctx.draft?.updatedAt&&new Date(ctx.draft.updatedAt)>new Date(lastData.assessedAt));
  }
  function start(){
    if(!Core||!window.Study30App?.essayAssessmentContext){$('rubricSaveStatus').textContent='自評模組尚未載入，請重新整理。';return;}
    $('rubricNextStep').addEventListener('input',store);
    $('rubricConfirmReview').addEventListener('click',store);
    window.addEventListener('study30:render',load);
    window.addEventListener('study30:essay-saved',refreshStale);
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
