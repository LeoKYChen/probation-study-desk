/* Structure-coach UI uses the existing daily session, timer and JSON backup. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const Model=window.Study30StructureCoachModel;
  let key='',draft=null;
  const names=['題目已知的重要事實','用一句話寫出核心法律問題','回答前需要確認的必要前提'];
  const checks=['我有回答題目核心問題','標題主從與先後順序清楚','規範與具體事實有連結','重要段落有可辨識的結論','沒有不必要的重複或離題'];
  const roles=[['premise','必要前提'],['issue','主要爭點'],['supplement','補充論點'],['conclusion','結論']];
  const lawSubjects=new Set(['少年事件處理法','刑法','刑事訴訟法','保安處分執行法']);
  const isLaw=ctx=>lawSubjects.has(ctx.subject);
  const topicGuide=[
    '先整理題目中的現象或案例、核心學理問題，以及理解所需的概念。',
    '至少建立兩個論述區塊；依題意安排理論、作用機制、比較及案例應用。',
    '解釋核心概念、理論機制、具體案例或研究應用，最後提出小結。',
    '記錄一個最重要的結構問題與下次改善方式。'
  ];
  function node(tag,text,cls){
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  }
  function textarea(label,name,value,rows=3){
    const wrap=node('div',undefined,'coach-field');
    const id='coach-'+name,lab=node('label',label);
    lab.htmlFor=id;
    const field=node('textarea');
    field.id=id;field.rows=rows;field.maxLength=12000;field.dataset.coachField=name;
    field.value=value||'';
    wrap.append(lab,field);
    return wrap;
  }
  function outlineCard(item,index,law){
    const box=node('div',undefined,'coach-outline-card');
    const top=node('div',undefined,'coach-outline-top');
    top.append(node('strong','論證區塊 '+(index+1)));
    const actions=node('div',undefined,'coach-outline-actions');
    for(const [action,icon,disabled] of [
      ['up','↑',index===0],['down','↓',index===draft.outline.length-1],
      ['remove','移除',draft.outline.length<=1]
    ]){
      const b=node('button',icon,'secondary');
      b.type='button';b.dataset.coachAction=action;b.dataset.coachIndex=String(index);
      b.disabled=disabled;b.setAttribute('aria-label',(action==='up'?'上移':action==='down'?'下移':'移除')+'第'+(index+1)+'個區塊');
      actions.append(b);
    }
    top.append(actions);box.append(top);
    const label=node('label','本段標題');label.htmlFor='coach-title-'+index;
    const title=node('input');title.id=label.htmlFor;title.maxLength=300;
    title.value=item.title;title.dataset.coachIndex=String(index);title.dataset.coachOutline='title';
    box.append(label,title);
    const questionLabel=node('label','本段要回答的問題');questionLabel.htmlFor='coach-question-'+index;
    const question=node('input');question.id=questionLabel.htmlFor;question.maxLength=600;
    question.value=item.question;question.dataset.coachIndex=String(index);question.dataset.coachOutline='question';
    box.append(questionLabel,question);
    const roleLabel=node('label','本段角色');roleLabel.htmlFor='coach-role-'+index;
    const select=node('select');select.id=roleLabel.htmlFor;
    select.dataset.coachIndex=String(index);select.dataset.coachOutline='role';
    for(const [v,txt] of roles){
      const o=node('option',law?txt:({premise:'概念前提',issue:'核心論點',supplement:'補充比較',conclusion:'整合結論'}[v]));
      o.value=v;select.append(o);
    }
    select.value=item.role;box.append(roleLabel,select);
    return box;
  }
  function previousPhaseReview(ctx,law){
    if(ctx.phase<1)return null;
    const details=node('details',undefined,'coach-previous-review');
    details.open=true;
    details.append(node('summary','前面階段已保存的作答（唯讀，可收合）'));
    const content=node('div',undefined,'coach-previous-content');
    const groups=[
      {title:'第1階段｜'+(law?'事實與爭點':'現象與問題'),items:[
        [law?names[0]:'題目現象與案例',draft.facts],
        [law?names[1]:'核心法律問題':'核心學理問題',draft.coreQuestion],
        [law?names[2]:'必要前提':'必要概念與理論',draft.prerequisites]
      ]},
      {title:'第2階段｜申論骨架',items:[
        ['我的標題與問題',draft.outline.filter(x=>x.title.trim()||x.question.trim()).map((x,i)=>
          (i+1)+'. '+x.title+(x.question?'\n   '+x.question:'')).join('\n\n')]
      ]},
      {title:'第3階段｜論證段落',items:[
        [law?'本段爭點':'本段學理問題',draft.paragraph.issue],
        [law?'規範及要件':'理論及概念',draft.paragraph.rule],
        [law?'涵攝分析':'理論機制與案例應用',draft.paragraph.application],
        ['小結',draft.paragraph.conclusion],
        ['連貫段落',draft.paragraph.combined]
      ]}
    ];
    for(let i=0;i<Math.min(ctx.phase,groups.length);i++){
      const g=groups[i],section=node('section',undefined,'coach-previous-group');
      section.append(node('h4',g.title));
      for(const [name,value] of g.items){
        if(!String(value||'').trim())continue;
        section.append(node('strong',name));
        section.append(node('p',value,'coach-previous-text'));
      }
      content.append(section);
    }
    details.append(content);
    return details;
  }
  function draw(ctx){
    const host=$('structureCoachPanel');
    if(!host)return;
    host.replaceChildren();
    const law=isLaw(ctx);
    const heading=node('h3','申論結構教練｜'+(law?
      ['辨識事實與爭點','建立申論骨架','練習段落論證','自我檢查與訂正']:
      ['辨識現象與問題','建立申論骨架','解釋理論與案例','自我檢查與訂正'])[ctx.phase]);
    host.append(heading);
    const desc=node('p',(law?Model.promptForPhase:topicGuide)[ctx.phase],'muted');
    host.append(desc);
    const previous=previousPhaseReview(ctx,law);
    if(previous)host.append(previous);
    const area=node('div',undefined,'coach-body');
    if(ctx.phase===0){
      area.append(textarea(law?names[0]:'題目中的現象、情境或案例','facts',draft.facts,4),
        textarea(law?names[1]:'一句話寫出核心學理問題','coreQuestion',draft.coreQuestion,2),
        textarea(law?names[2]:'需要先確認的概念、理論或條件','prerequisites',draft.prerequisites,3));
    }
    if(ctx.phase===1){
      const hint=node('p','標題越多不一定越好。至少完成兩個區塊，並說明各段真正要回答什麼。','muted tiny');
      area.append(hint);
      const list=node('div',undefined,'coach-outline-list');
      draft.outline.forEach((item,i)=>list.append(outlineCard(item,i,law)));
      area.append(list);
      const add=node('button','新增論證區塊','secondary');
      add.type='button';add.dataset.coachAction='add';add.disabled=draft.outline.length>=8;
      area.append(add);
    }
    if(ctx.phase===2){
      area.append(textarea(law?'本段爭點':'本段要解釋的學理問題','issue',draft.paragraph.issue,2),
        textarea(law?'規範及要件（法條不確定可寫待查）':'核心理論、概念與定義','rule',draft.paragraph.rule,3),
        textarea(law?'題目事實如何符合或不符合要件？為什麼？':'作用機制、理論比較或具體案例應用','application',draft.paragraph.application,4),
        textarea('本段小結','conclusion',draft.paragraph.conclusion,2),
        textarea('整合成一段連貫的申論文字（選填）','combined',draft.paragraph.combined,6));
    }
    if(ctx.phase===3){
      const fieldset=node('fieldset',undefined,'coach-checks');fieldset.append(node('legend','結構自我檢查（勾選不代表法律內容正確）'));
      checks.forEach((label,i)=>{
        const wrap=node('label',undefined,'coach-check');
        const cb=node('input');cb.type='checkbox';cb.checked=draft.checks[i];cb.dataset.coachCheck=String(i);
        wrap.append(cb,node('span',label));fieldset.append(wrap);
      });
      area.append(fieldset,textarea('本次最主要的結構問題','weakness',draft.weakness,3),
        textarea('下次要如何具體改善？','nextGoal',draft.nextGoal,3));
    }
    host.append(area);
    if(ctx.finished){
      host.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=true;});
      host.append(node('p','本次練習已完成，原稿為唯讀；可從月曆建立獨立的重新練習版本。','muted tiny'));
    }
    const status=node('p',ctx.finished?'已完成；原稿唯讀。':'輸入後會儲存在本機，並隨本模組 JSON 一起備份。','muted tiny');
    status.id='coachSaveStatus';status.setAttribute('role','status');host.append(status);
    host.append(node('p',law?'教練檢查只處理論證結構；法條及實務見解仍須另行核對。':
      '教練檢查只處理論述結構；心理學、犯罪學與諮商理論內容仍須依教材核對。','muted tiny'));
  }
  function save(){
    const ok=window.Study30App.saveStructureCoach(draft);
    const status=$('coachSaveStatus');
    if(status)status.textContent=ok?'已保存於目前瀏覽器':'無法儲存：請先複製內容並匯出 JSON 備份';
  }
  function update(event){
    const el=event.target;
    if(!draft||!el?.dataset)return;
    if(el.dataset.coachField){
      const f=el.dataset.coachField;
      if(f in draft)draft[f]=el.value;
      else if(f in draft.paragraph)draft.paragraph[f]=el.value;
      save();
    }else if(el.dataset.coachOutline){
      const i=Number(el.dataset.coachIndex);
      if(!draft.outline[i])return;
      draft.outline[i][el.dataset.coachOutline]=el.value;
      save();
    }else if(el.dataset.coachCheck!==undefined){
      draft.checks[Number(el.dataset.coachCheck)]=el.checked;
      save();
    }
  }
  function action(event){
    const button=event.target.closest('button[data-coach-action]');
    if(!button||!draft)return;
    const command=button.dataset.coachAction,i=Number(button.dataset.coachIndex);
    if(command==='add'&&draft.outline.length<8)draft.outline.push({title:'',question:'',role:'issue'});
    else if(command==='remove'&&draft.outline.length>1&&draft.outline[i])draft.outline.splice(i,1);
    else if(command==='up'&&i>0&&draft.outline[i]){[draft.outline[i-1],draft.outline[i]]=[draft.outline[i],draft.outline[i-1]];}
    else if(command==='down'&&i>=0&&i<draft.outline.length-1){[draft.outline[i+1],draft.outline[i]]=[draft.outline[i],draft.outline[i+1]];}
    else return;
    save();draw(window.Study30App.structureCoachContext());
  }
  function render(){
    const host=$('structureCoachPanel'),ctx=window.Study30App?.structureCoachContext?.();
    if(!host||!ctx)return;
    host.hidden=!ctx.active;
    if(!ctx.active){key='';draft=null;return;}
    const next=[ctx.date,ctx.sessionToken,ctx.practiceMode,ctx.mode,ctx.phase,ctx.finished?'complete':'draft'].join(':');
    if(next===key)return; // Preserve caret position during timer and stats refresh.
    key=next;draft=Model.normalize(ctx.coach);draw(ctx);
  }
  function start(){
    const host=$('structureCoachPanel');
    if(!host||!Model)return;
    host.addEventListener('input',update);
    host.addEventListener('change',update);
    host.addEventListener('click',action);
    window.addEventListener('study30:render',render);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
