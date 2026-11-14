(function () {
  'use strict';
  const topics = window.ALL_TOPICS || window.CRIME_TOPICS || [];
  const byId = new Map(questionBank.map(q => [q.id, q]));
  let selectedTopic = topics[0]?.id || '';
  let practice = null;
  const hub = $('topicHub');
  const checks = [...document.querySelectorAll('[data-topic-check]')];
  const adaptations = {
    // 律司版：原觀護人題目的「只答指定部分」提示已移除；格式為 '主題id|題目id': '提示文字'
  };
  function topicQuestions(t, exam = $('crimeExamSelect').value) {
    const subject = $('topicSubjectSelect').value || '全部科目';
    const qs = t.questionIds.map(id => byId.get(id)).filter(Boolean).filter(q => (exam === '全部類科' || q.examTypes.includes(exam)) && (subject === '全部科目' || q.subject === subject));
    const seen = new Set();
    return qs.filter(q => { const key = `${q.sourceUrl}|${q.questionNo}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  function questionTopics(q) { return topics.filter(t => t.questionIds.includes(q.id)); }
  function titleFor(q) { return `${q.year}年 ${q.examTypes.join('／')} ${q.subject} 第${q.questionNo}題`; }
  function element(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
  function button(label, action, cls = 'btn') { const b = element('button', label, cls); b.type = 'button'; b.addEventListener('click', action); return b; }
  function original(q) {
    currentExamType = q.examTypes[0]; currentYear = q.year; currentSubject = q.subject; currentId = q.id;
    currentFilter = 'all'; document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    refreshYearSelect(); refreshSubjectSelect(); render();
    document.querySelector('.question-paper').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function refreshTopics() {
    const subject=$('topicSubjectSelect').value || '全部科目',exam=$('crimeExamSelect').value || '全部類科';
    const inScope=questionBank.filter(q=>(subject==='全部科目'||q.subject===subject)&&(exam==='全部類科'||q.examTypes.includes(exam)));
    $('topicCoverage').textContent=`全題庫 ${questionBank.length}題／${new Set(questionBank.map(q=>q.subject)).size}科目；目前範圍 ${inScope.length}題均可拆點練習。各科內容診斷覆蓋與限制請見下方；新準則仍待人工答案校準。`;
    const available = topics.filter(t => !$('crimeRepeatOnly').checked || topicQuestions(t).length >= 2).filter(t => topicQuestions(t).length > 0)
      .sort((a,b) => topicQuestions(b).length - topicQuestions(a).length || a.label.localeCompare(b.label,'zh-Hant'));
    if (!available.some(t => t.id === selectedTopic)) selectedTopic = available[0]?.id;
    $('crimeTopicSelect').replaceChildren();
    for (const t of available) { const o = element('option', `${t.label} · ${topicQuestions(t).length}題${t.broad ? '（主題相關）' : ''}`); o.value = t.id; $('crimeTopicSelect').appendChild(o); }
    $('crimeTopicSelect').value = selectedTopic || '';
    renderCards();
  }
  function renderCards() {
    const t = topics.find(t => t.id === selectedTopic);
    const list = $('crimeTopicCards'); list.replaceChildren();
    if (!t) { $('crimeFrequency').textContent = '此範圍沒有符合條件的考點，可取消「至少兩題」限制。'; $('crimeScope').textContent = ''; return; }
    const qs = topicQuestions(t), all = t.questionIds.map(id=>byId.get(id)).filter(Boolean).filter((q,i,a)=>a.findIndex(x=>x.sourceUrl===q.sourceUrl&&x.questionNo===q.questionNo)===i);
    const lawyer = all.filter(q => q.examTypes.includes('律師')).length, judge = all.filter(q => q.examTypes.includes('司法官')).length;
    const yearCount = new Set(qs.map(q => q.year)).size;
    $('crimeFrequency').textContent = `目前範圍 ${qs.length}題／${yearCount}個年度；全部 ${all.length}題，其中適用律師 ${lawyer}題、適用司法官 ${judge}題（兩者共用的題目分別計入）。`;
    $('crimeScope').textContent = `${t.scope}。${t.broad ? '此為較大的主題分類，卡片僅標為主題相關，不能視為同一理論反覆命題。' : '同一考點可有概念說明、比較與案例等不同問法；仍須核對各題額外要求。'}`;
    for (const q of qs.sort((a,b) => b.year-a.year)) {
      const card = element('article', undefined, 'topic-card');
      card.appendChild(element('h3', titleFor(q)));
      card.appendChild(element('p', t.reviewedMappings?.[q.id] || t.mappings?.[q.id]?.status || (t.broad ? '關聯：主題相關（非同一理論）' : '關聯：同一考點，問法須逐題對照')));
      card.appendChild(element('p',window.TOPIC_RUBRICS?.[`${t.id}|${q.id}`]?'理論內容診斷（先行試作）':window.CONTENT_STANDARDS?.[t.id]?'核心內容診斷（有來源；答案校準中）':'題幹要求診斷（內容準則待建立）'));
      if(t.mappings?.[q.id]?.quote) card.appendChild(element('p','關聯線索：'+t.mappings[q.id].quote,'topic-note'));
      if(window.isLegalTopic(q,t))card.appendChild(element('p','跨年度請核對修法與施行日期；相近主題不代表相同結論。','topic-note'));
      card.appendChild(element('p', q.body, 'topic-preview'));
      const other = questionTopics(q).filter(x => x.id !== t.id);
      card.appendChild(element('p', other.length ? `另有考點：${other.map(x=>x.label).join('、')}` : '另有要求：請依上方完整題幹核對比較、例子及實務應用。'));
      const state = saved[q.id]?.topicPractice?.[t.id];
      card.appendChild(element('p', state?.done ? '本考點專項：已完成' : state?.answer ? '本考點專項：已儲存草稿' : '本考點專項：尚未練習'));
      const actions = element('div', undefined, 'topic-actions');
      actions.append(button('練完整原題', () => original(q)), button('只練指定部分', () => openPractice(q,t), 'btn primary'));
      card.appendChild(actions); list.appendChild(card);
    }
  }
  function promptFor(q,t) {
    const rubric = window.getTopicRubric?.(q,t) || window.TOPIC_RUBRICS?.[`${t.id}|${q.id}`];
    if (rubric) return rubric.prompt;
    const custom = adaptations[`${t.id}|${q.id}`];
    if (custom) return custom;
    // Explicit adapted task, not an alleged verbatim official subquestion.
    return `本次只整理「${t.label}」：依完整原題所指定的學者、理論或制度，說明其核心概念；若原題要求比較，僅比較此考點範圍；若有指定案例，僅用此考點說明案例。其他考點與延伸政策部分留待完整原題練習。`;
  }
  function openPractice(q,t) {
    practice = {question:q,topic:t};
    const state = saved[q.id]?.topicPractice?.[t.id] || {};
    $('topicPracticeTitle').textContent = `只練：${t.label}`;
    $('topicPracticeSource').textContent = `改編自 ${titleFor(q)}（考點分類試作）`;
    $('topicPracticePrompt').textContent = promptFor(q,t);
    $('topicPracticeOriginal').textContent = q.body;
    $('topicPracticeOfficial').href = q.sourceUrl;
    $('topicPracticeAnswer').value = state.answer || '';
    $('topicLegalVersionWrap').hidden = !window.isLegalTopic(q,t);
    $('topicLegalVersion').value = 'current';
    $('topicLawNotice').textContent = `${q.year}年僅為題目出處。一律以現行法作答（查核日2026-10-02）；舊題修法差異另提示。舊年度作答紀錄仍保留。`;
    checks.forEach(c => c.checked = !!state.checks?.[c.dataset.topicCheck]);
    $('topicPracticeSaveStatus').textContent = state.answer ? (state.prompt&&state.prompt!==promptFor(q,t)?'已保留舊答案；本次改編範圍已調整，請核對上方提示後重新練習。':'已載入此裝置的專項紀錄') : '';
    updateSelfResult(); renderDiagnostic(); $('topicPracticeDialog').showModal();
    $('topicPracticeAnswer').focus();
  }
  function persistPractice(markDone, assessment) {
    if (!practice) return;
    const {question:q,topic:t} = practice;
    const answer = $('topicPracticeAnswer').value;
    if (markDone && !answer.trim()) { showToast('請先寫下本考點答案'); $('topicPracticeAnswer').focus(); return false; }
    const checkState = Object.fromEntries(checks.map(c => [c.dataset.topicCheck,c.checked]));
    const previous = saved[q.id] || entry(q.id);
    const old = previous.topicPractice?.[t.id] || {};
    saved[q.id] = {...previous, topicPractice:{...previous.topicPractice, [t.id]:{
      ...old,answer,checks:checkState,done:!!markDone,questionId:q.id,topicId:t.id,
      ...(old.prompt && old.prompt!==promptFor(q,t) ? {scopeHistory:[...(old.scopeHistory || []),{prompt:old.prompt,answer:old.answer,assessment:old.assessment,legalVersion:old.legalVersion,updatedAt:old.updatedAt,topicVersion:old.topicVersion}]}:{}),
      ...(assessment ? {assessment, assessmentHistory:[...(old.assessmentHistory || []), ...(old.assessment ? [old.assessment] : [])]} : {}),
      prompt:promptFor(q,t),legalVersion:$('topicLegalVersion').value,topicVersion:'all-topics-v1',updatedAt:new Date().toISOString()
    }}, updatedAt:new Date().toISOString()};
    try { localStorage.setItem(storageKey,JSON.stringify(saved)); }
    catch(e) { $('topicPracticeSaveStatus').textContent='此裝置儲存失敗，請複製答案並匯出備份。'; throw e; }
    $('topicPracticeSaveStatus').textContent = markDone ? '已保存：本考點完成，整題狀態不變' : '專項作答已自動儲存在此裝置';
    updateSelfResult(); renderCards(); renderDiagnostic(); return true;
  }
  function updateSelfResult() {
    const count = checks.filter(c=>c.checked).length;
    const done = practice && saved[practice.question.id]?.topicPractice?.[practice.topic.id]?.done;
    $('topicPracticeResult').textContent = `自查 ${count}／3項${done ? ' · 本考點已完成' : ''}。這是自評完成度，不是系統評分或國考分數。`;
  }
  function renderDiagnostic() {
    if (!practice) return;
    const key = `${practice.topic.id}|${practice.question.id}`;
    const rubric = window.getTopicRubric?.(practice.question,practice.topic) || window.TOPIC_RUBRICS?.[key];
    $('topicDiagnosticPanel').hidden = !rubric;
    $('topicNoDiagnostic').hidden = !!rubric;
    const result = $('topicDiagnosticResult'); result.replaceChildren();
    if (!rubric) return;
    const list = $('topicDiagnosticCriteria'); list.replaceChildren();
    for (const row of rubric.criteria) list.appendChild(element('li', `${row.label}${rubric.mode==='requirements'?'':`（完成度權重${row.weight}）`}｜${row.hint}`));
    const source = $('topicDiagnosticSource'); source.replaceChildren();
    const a = element('a', rubric.source.title); a.href = rubric.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    source.append(a, element('span', `；${rubric.source.section}。${rubric.mode==='requirements'?'範圍與提示由題幹整理，非標準答案。':'應用例子與權重為開發者試作，待教材覆核。'}版本：${rubric.version}`));
    $('topicDiagnosticMode').textContent = rubric.mode==='requirements'?'題幹要求檢查：顯示範圍、理由與應用線索，內容未校準，不計分。':rubric.mode==='content'?'核心內容診斷：準則有來源，僅檢查上方指定概念。不同表達、原題完整答案與個案結論仍需覆核。':'理論內容診斷：完成度權重為練習設計，非官方配分；文字命中仍須覆核正確性。';
    if(rubric.extraSource){const extra=element('a',rubric.extraSource.title);extra.href=rubric.extraSource.url;extra.target='_blank';extra.rel='noopener noreferrer';source.append(element('p',rubric.extraSource.section),extra);}
    const state = saved[practice.question.id]?.topicPractice?.[practice.topic.id];
    const assessment = state?.assessment;
    if (!assessment) { result.appendChild(element('p','寫完後按「診斷本考點答案」，查看逐項線索與可能缺漏。','topic-note')); return; }
    if (assessment.answer !== $('topicPracticeAnswer').value || assessment.version !== rubric.version || assessment.key !== key || (rubric.legal && assessment.legalVersion !== $('topicLegalVersion').value)) {
      result.appendChild(element('p','答案或診斷規則已變更，舊結果保留於紀錄，但不適用目前答案。請重新診斷。','topic-note')); return;
    }
    result.appendChild(element('p', assessment.provisionalScore === null ? (rubric.mode==='requirements'?'題幹要求檢查結果（不計分）':'需人工覆核，暫不計完成度') : `試作論述覆蓋度：${assessment.provisionalScore}／100`, 'topic-self-result'));
    result.appendChild(element('p',assessment.message,'topic-note'));
    result.appendChild(element('p',assessment.confidence,'topic-note'));
    for (const warning of assessment.warnings) result.appendChild(element('p',warning,'topic-note'));
    const labels = {evidence:'已找到相關論述，正確性待覆核',partial:'只有部分線索／語意需覆核',missing:'尚未辨識到，可能缺漏',manual:'需人工覆核'};
    for (const row of assessment.rows) {
      const card = element('div',undefined,'diagnostic-item');
      card.appendChild(element('h4',`${row.label}｜${labels[row.status]}`));
      if(row.evidence) card.appendChild(element('blockquote',row.evidence,'diagnostic-evidence'));
      card.appendChild(element('p',row.hint,'topic-note')); result.appendChild(card);
    }
  }
  $('diagnoseTopicButton').addEventListener('click', () => {
    if (!practice) return;
    if (!$('topicPracticeAnswer').value.trim()) { showToast('請先寫下本考點答案'); $('topicPracticeAnswer').focus(); return; }
    const key = `${practice.topic.id}|${practice.question.id}`;
    const rubric=window.getTopicRubric?.(practice.question,practice.topic);
    const assessment = window.diagnoseTopicAnswer?.($('topicPracticeAnswer').value,key,rubric,$('topicLegalVersion').value);
    if (!assessment) return;
    const done = !!saved[practice.question.id]?.topicPractice?.[practice.topic.id]?.done;
    if (persistPractice(done,assessment)) showToast('已保存本考點診斷，整題評分不變');
  });
  window.renderCrimeRelated = () => {
    const q = currentQuestion(), panel = $('crimeRelatedPanel'), body = $('crimeRelatedContents');
    body.replaceChildren(); panel.hidden = !q; if (panel.hidden) return;
    const tags = questionTopics(q);
    for (const t of tags) {
      const same = topicQuestions(t,'全部類科').filter(x=>x.id!==q.id);
      const line = element('p',undefined,'topic-note');
      line.appendChild(button(`${t.label} · 其他${same.length}題${t.broad ? '（主題相關）' : ''}`,()=>{
        $('crimeExamSelect').value='全部類科'; $('topicSubjectSelect').value='全部科目'; $('crimeRepeatOnly').checked=false; selectedTopic=t.id;
        refreshTopics(); hub.open=true; hub.scrollIntoView({behavior:'smooth',block:'start'});
      },'topic-link'));
      body.appendChild(line);
      if(same.length) body.appendChild(element('p',same.slice(0,4).map(titleFor).join('；')+(same.length>4?'；更多題目見考點列表':''),'topic-note'));
    }
  };
  window.refreshCrimePractice = refreshTopics;
  for(const name of ['全部科目',...new Set(questionBank.map(q=>q.subject))]){const o=element('option',name);o.value=name;$('topicSubjectSelect').appendChild(o);}
  $('topicSubjectSelect').value='全部科目';
  $('crimeExamSelect').replaceChildren();for(const name of examTypes){const o=element('option',name);o.value=name;$('crimeExamSelect').appendChild(o);}$('crimeExamSelect').value='全部類科';
  $('topicSubjectSelect').addEventListener('change',refreshTopics);
  $('topicLegalVersion').addEventListener('change',()=>persistPractice(!!saved[practice?.question.id]?.topicPractice?.[practice?.topic.id]?.done));
  $('crimeTopicSelect').addEventListener('change',()=>{selectedTopic=$('crimeTopicSelect').value;renderCards();});
  $('crimeExamSelect').addEventListener('change',refreshTopics);
  $('crimeRepeatOnly').addEventListener('change',refreshTopics);
  $('topicPracticeAnswer').addEventListener('input',()=>persistPractice(false));
  checks.forEach(c=>c.addEventListener('change',()=>persistPractice(false)));
  $('completeTopicPractice').addEventListener('click',()=>{if(persistPractice(true))showToast('已完成本考點，整題狀態不變');});
  $('closeTopicPractice').addEventListener('click',()=>{$('topicPracticeDialog').close();});
  $('topicPracticeDialog').addEventListener('close',()=>{practice=null;renderCards();});
  const coverage=$('contentCoverageTable'),table=element('table');
  const head=element('tr');for(const label of ['科目','題庫題數','有內容準則的考點','至少一項內容練習的題數'])head.appendChild(element('th',label));table.appendChild(head);
  for(const subject of new Set(questionBank.map(q=>q.subject))){const qs=questionBank.filter(q=>q.subject===subject);const contentTopics=topics.filter(t=>qs.some(q=>t.questionIds.includes(q.id))&&(window.CONTENT_STANDARDS?.[t.id]||qs.some(q=>window.TOPIC_RUBRICS?.[`${t.id}|${q.id}`])));const count=qs.filter(q=>contentTopics.some(t=>t.questionIds.includes(q.id)&&(window.CONTENT_STANDARDS?.[t.id]||window.TOPIC_RUBRICS?.[`${t.id}|${q.id}`]))).length;const tr=element('tr');for(const value of [subject,qs.length,contentTopics.length,count])tr.appendChild(element('td',String(value)));table.appendChild(tr);}
  coverage.style.overflowX='auto';coverage.appendChild(table);
  const pilotGroups=new Map();
  for(const [id,rubric] of Object.entries(window.FULL_PILOT_RUBRICS||{})){const q=byId.get(id);if(!q)continue;if(!pilotGroups.has(q.subject))pilotGroups.set(q.subject,[]);pilotGroups.get(q.subject).push({q,rubric});}
  for(const [subject,items] of pilotGroups){const group=document.createElement('details'),summary=document.createElement('summary'),actions=document.createElement('div');summary.textContent=subject+'｜'+items.length+'題';actions.className='topic-actions';for(const {q,rubric} of items)actions.appendChild(button(`${q.examType} ${q.year}年 第${q.questionNo}題｜${rubric.title}`,()=>original(q)));group.appendChild(summary);group.appendChild(actions);$('legalPilotLinks').appendChild(group);} 
  refreshTopics(); window.renderCrimeRelated();
})();
