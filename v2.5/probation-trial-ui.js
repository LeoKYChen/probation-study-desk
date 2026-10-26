(function(root){
  'use strict';
  const V=root.TrialVersions,api=root.Practice25;
  if(!V||!api||!root.document)return;
  const el=id=>document.getElementById(id),panel=el('trialVersionPanel'),select=el('trialVersionSelect');
  if(!panel||!select)return;
  const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function addList(parent,items){const ul=make('ul');for(const text of items||[])ul.append(make('li',text));parent.append(ul);}
  let comparisonKey='';
  function compare(q){
    const key=q.id+'|'+(root.PROBATION_TRIAL_RUBRICS?.[q.id]?.version||'retained');
    if(comparisonKey===key)return;comparisonKey=key;
    const holder=el('trialCompareContent');holder.replaceChildren();holder.className='trial-version-columns';
    for(const provider of ['original','supplement']){
      const r=V.rubric(q.id,{selectedTrialProvider:provider}),section=make('section');
      section.append(make('h4',V.providers[provider].label));
      if(provider==='supplement'&&!root.PROBATION_TRIAL_RUBRICS?.[q.id])section.append(make('p','本題屬原已完成的54題，補充版本沿用相同試評，沒有另造一份答案。'));
      if(r){
        section.append(make('p',r.title));
        if(r.calibration?.referenceAnswer||r.referenceAnswer)section.append(make('p',r.calibration?.referenceAnswer||r.referenceAnswer));
        section.append(make('h4','答題要點'));addList(section,(r.criteria||[]).map(x=>x.label+'：'+x.hint));
        section.append(make('h4','參考來源'));const ul=make('ul');
        for(const source of r.sources||[]){if(!source?.url)continue;const li=make('li'),a=make('a',source.title);if(/^https?:\/\//.test(source.url))a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);if(source.scope)li.append(make('span','｜'+source.scope));ul.append(li);}section.append(ul);
        const issues=r.openIssues||r.calibration?.openIssues;if(issues?.length){section.append(make('h4','待查證／覆核'));addList(section,issues);}
      }else section.append(make('p','這個版本尚無本題資料。'));
      holder.append(section);
    }
  }
  function render(){
    const q=api.getQuestion();panel.hidden=!q||!V.available(q.id);if(panel.hidden){const average=el('averageScore');if(average){const value=V.average(api.getRecords(),new Set(api.getQuestions().map(q=>q.id)),'original');average.textContent=value===null?'—':String(value);if(average.previousElementSibling)average.previousElementSibling.textContent='原有版本平均線索分';}return;}
    const state=api.getState(q.id),key=V.provider(state),r=V.rubric(q.id,state),supplement=key==='supplement',isNew=supplement&&!!root.PROBATION_TRIAL_RUBRICS?.[q.id];
    select.value=key;
    el('trialVersionDescription').textContent=V.providers[key].description+(supplement&&!isNew?' 本題沿用原已完成的試評。':'')+' 題目及你的答案共用；兩版試評結果分別保留。';
    const versions=V.archive(state),labels=Object.keys(V.providers).filter(p=>versions[p]?.assessment||versions[p]?.scoreSource==='adjusted').map(p=>V.providers[p].label);
    el('trialVersionStatus').textContent=labels.length?'已有試評紀錄：'+labels.join('、')+'。目前顯示：'+V.providers[key].label+'。':'目前顯示：'+V.providers[key].label+'；尚未在這個版本進行試評。';
    compare(q);
    if(el('scoreMode'))el('scoreMode').textContent=V.providers[key].label+(isNew?' · 觀護人逐題試評':' · 全科試評');
    const average=el('averageScore');if(average){const value=V.average(api.getRecords(),new Set(api.getQuestions().map(q=>q.id)),key);average.textContent=value===null?'—':String(value);if(average.previousElementSibling)average.previousElementSibling.textContent=V.providers[key].label+'平均線索分';}
    if(isNew){
      if(el('pilotRuleStatus'))el('pilotRuleStatus').textContent='補充版本｜逐題要點及四項試評已建立｜來源限制逐題列示，未經專家校準';
      if(el('scoreIntro'))el('scoreIntro').textContent='四項理由依完整原題、逐題參考要點及應用要求產生。文字命中不等於答對；來源不足、任選或數量要求、否定與反例須人工覆核時，暫不給總分。';
      if(el('directionNote'))el('directionNote').textContent='補充版本，整理日2026-10-26。非官方唯一擬答；來源支持範圍、查證日期、異說及待覆核事項逐題列示。'+(r.legalVersion?'法律題區分行為時法、現行有效規範、未施行修法及草案。':'');
      if(el('pointList')){el('pointList').replaceChildren();for(const text of [r.authoredTargets.issue,r.authoredTargets.application])el('pointList').append(make('li',text));}
      const a=state.assessment;
      if(a?.method==='probation-190-trial-v1'&&a.rubricVersion===r.version&&a.answer===state.issue&&state.scoreSource!=='adjusted'&&a.total===null){
        if(el('scoreLevel'))el('scoreLevel').textContent='四項試評已完成，需人工覆核';
        if(el('scoreMessage'))el('scoreMessage').textContent='已列本題論述線索及改善方向；未給總分不代表答錯。';
      }
    }
    if(!state.assessment&&state.scoreSource!=='adjusted'){
      if(el('totalScore'))el('totalScore').textContent='—';
      if(el('scoreLevel'))el('scoreLevel').textContent=V.providers[key].label+' · 尚未試評';
      if(el('scoreMessage'))el('scoreMessage').textContent='切換版本不會自動重評；按「系統判定本題」取得這個版本的結果。';
    }
  }
  select.addEventListener('change',()=>{
    const q=api.getQuestion();if(!q||!V.available(q.id))return;
    const next=select.value,before=api.getState(q.id),recordMap=api.getRecords(),existed=Object.prototype.hasOwnProperty.call(recordMap,q.id),backup=existed?JSON.parse(JSON.stringify(before)):null;
    try{api.flush();const state=api.getState(q.id);api.patch(V.select(state,next));api.render();}
    catch(error){if(existed)recordMap[q.id]=backup;else delete recordMap[q.id];select.value=V.provider(before);el('trialVersionStatus').textContent='版本切換未能儲存，已保留原版本。請先複製尚未保存的答案，再匯出備份。';}
  });
  root.addEventListener('practice25:render',render);root.addEventListener('practice25:changed',render);root.addEventListener('backup25:applied',render);render();
  root.TrialVersionsUI={render};
})(window);
