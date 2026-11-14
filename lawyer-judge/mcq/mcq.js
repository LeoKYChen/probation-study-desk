/* GPL-3.0-only. 第一試選擇題練習：依科目抽題、整卷計時、錯題本與統計。紀錄只存在本機瀏覽器（psd-mcq-v1）。
   題庫由 scripts/import-questions.mjs --mcq 寫入 bank.js（window.MCQ_BANK）。 */
(() => {
  'use strict';
  const BANK = Array.isArray(window.MCQ_BANK) ? window.MCQ_BANK : [];
  const KEY = 'psd-mcq-v1', POINT = 2, INTERVALS = [1, 3, 7, 14], MAX_HISTORY = 50, MAX_EXAMS = 20;
  const PAPERS = {
    '卷一': {title: '刑法・刑事訴訟法・法律倫理', minutes: 90},
    '卷二': {title: '憲法・行政法・國際公法・國際私法', minutes: 90},
    '卷三': {title: '民法・民事訴訟法', minutes: 100},
    '卷四': {title: '公司法・保險法・票據法・證券交易法・強制執行法・法學英文', minutes: 80}
  };
  const GROUPS = [
    ['卷一', ['刑法', '刑事訴訟法', '法律倫理']],
    ['卷二', ['憲法', '行政法', '國際公法', '國際私法']],
    ['卷三', ['民法', '民事訴訟法']],
    ['卷四', ['公司法', '保險法', '票據法', '證券交易法', '強制執行法', '法學英文']]
  ];
  const SUBJECTS = GROUPS.flatMap(([, list]) => list);
  const LETTERS = ['A', 'B', 'C', 'D'];
  const CH = window.LSDeskMcqChapters || null; // 章節歸類（mcq/chapters.js）；沒有載入時章節功能整個不顯示
  // 送給觀護人學習平臺弱點地圖看的摘要（只含刑法、刑事訴訟法的常錯條文與章節）；由本頁計算、對方唯讀。
  const WEAK_KEY = 'lsdesk-mcq-weak-v1', WEAK_SUBJECTS = ['刑法', '刑事訴訟法'];
  const COMMUTE_SETS = [['criminal', '刑法＋刑事訴訟法', ['刑法', '刑事訴訟法']], ['刑法', '刑法', ['刑法']], ['刑事訴訟法', '刑事訴訟法', ['刑事訴訟法']], ['picked', '沿用下方勾選的科目', null]];
  const $ = id => document.getElementById(id);
  const byId = new Map(BANK.map(q => [q.id, q]));
  const scored = q => q.status !== 'incomplete';
  const isCorrect = (q, letter) => q.acceptedAnswers.includes(letter);
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dateKey(new Date());
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dateKey(new Date(y, m - 1, d + n)); };
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);

  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return e;
  }

  /* ---------- 儲存 ---------- */
  const newStore = () => ({version: 1, updatedAt: null, records: {}, history: [], active: null, settings: {}});
  let store = newStore(), storageOK = true;
  const validStore = c => isObj(c) && c.version === 1 && isObj(c.records) && Array.isArray(c.history) && (c.active === null || c.active === undefined || isObj(c.active)) && (c.settings === undefined || isObj(c.settings)) && (c.chapters === undefined || (CH ? CH.validOverrides(c.chapters) : isObj(c.chapters)));
  function notice(text) { const n = $('notice'); n.textContent = text; n.hidden = !text; }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const c = JSON.parse(raw); if (!validStore(c)) throw Error('invalid'); store = {...newStore(), ...c, active: c.active || null, settings: c.settings || {}}; }
    } catch {
      storageOK = false;
      notice('瀏覽器裡的選擇題紀錄無法讀取或格式不相容。本次不會覆寫原紀錄，仍可練習，但這次的作答不會保存。');
    }
  }
  function persist() {
    store.updatedAt = new Date().toISOString();
    if (!storageOK) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch { storageOK = false; notice('瀏覽器沒有保存成功（可能是無痕模式或空間不足）。請先到備份中心匯出紀錄。'); }
    writeWeak();
  }
  const overrides = () => store.chapters || {};

  /* ---------- 作答紀錄與錯題複習 ---------- */
  /* 紀錄欄位：n 作答次數、c 答對次數、w 在錯題本、b 連續答對級數、d 下次複習日、l 上次選項、t 上次時間；
     u=1 上次答對但標「不確定」（照錯題排程）、e 上次錯因（CAUSES 的代碼）、x=1 使用者標為已過時（不再出題）。 */
  const CAUSES = [['k', '不知道這個規定'], ['m', '記錯要件或效果'], ['r', '看錯題目'], ['c', '兩個選項分不出來']];
  const causeText = code => (CAUSES.find(c => c[0] === code) || [])[1] || '';
  function record(q, letter, ok, unsure) {
    const r = store.records[q.id] || {n: 0, c: 0, w: 0, b: 0, d: null, l: null, t: null};
    r.n++; if (ok) r.c++;
    r.l = letter; r.t = new Date().toISOString();
    if (ok) delete r.e;
    if (ok && unsure) { r.u = 1; r.w = 1; r.b = 0; r.d = addDays(today(), 1); }
    else if (!ok) { delete r.u; r.w = 1; r.b = 0; r.d = addDays(today(), 1); }
    else if (r.w) { delete r.u; r.b++; if (r.b >= INTERVALS.length) { r.w = 0; r.d = null; } else r.d = addDays(today(), INTERVALS[r.b]); }
    store.records[q.id] = r;
  }
  const outdated = id => !!store.records[id]?.x;
  const wrongList = () => Object.entries(store.records).filter(([id, r]) => r.w && !r.x && byId.has(id)).map(([id, r]) => ({q: byId.get(id), r}));
  const dueList = () => wrongList().filter(({r}) => r.d && r.d <= today());

  /* ---------- 依法條歸類（自動從題目與選項文字擷取條號；沒寫條號的題目歸不進去） ---------- */
  const LAW_SUBJECT = {'民法': '民法', '刑法': '刑法', '民事訴訟法': '民事訴訟法', '刑事訴訟法': '刑事訴訟法', '公司法': '公司法', '保險法': '保險法', '票據法': '票據法', '證券交易法': '證券交易法', '強制執行法': '強制執行法', '憲法': '憲法'};
  const ART = /([\u4e00-\u9fff]{0,14})第\s*(\d{1,4})\s*條(?:之\s*(\d{1,2}))?/g;
  const LAW_END = /(法|條例|規則|細則|辦法|通則|規程|公約|增修條文)$/;
  const KNOWN_LAWS = ['中華民國憲法增修條文', '憲法增修條文', '涉外民事法律適用法', '刑事訴訟法', '民事訴訟法', '行政訴訟法', '憲法訴訟法', '行政程序法', '行政執行法', '強制執行法', '證券交易法', '國家賠償法', '家事事件法', '非訟事件法', '地方制度法', '政府採購法', '中央法規標準法', '公務員懲戒法', '行政罰法', '企業併購法', '訴願法', '公司法', '保險法', '票據法', '海商法', '律師法', '法官法', '民法', '刑法', '憲法'];
  const JUNK = /.*(成立|構成|觸犯|違反|適用|參酌|符合|諭知|受到|不受|有關|關於|現行|修正前|修正後|增訂|僅限|依據|依照|根據|規定|屬|犯|關)/;
  function lawName(prefix, subject) {
    // 先比對常見法名（取最長）；否則去掉前面的動詞後，取以「法／條例…」結尾的字串；都沒有就用該科目的法名
    const tail = prefix.split(/[依按及與和或、，。；：「」（）()\s則而之為有無將對就以於在自從因]/).pop() || '';
    const known = KNOWN_LAWS.find(n => tail.endsWith(n));
    if (known) return known.replace(/^中華民國/, '');
    const rest = tail.replace(JUNK, '');
    if (rest.length >= 3 && rest.length <= 12 && LAW_END.test(rest) && !/^(同法|本法|該法|新法|舊法)$/.test(rest)) return rest;
    return LAW_SUBJECT[subject] || null;
  }
  const articleCache = new Map();
  function articlesOf(q) {
    if (articleCache.has(q.id)) return articleCache.get(q.id);
    const text = [q.body, ...(q.options || [])].join('\n'), set = new Set();
    for (const m of text.matchAll(ART)) { const law = lawName(m[1], q.subject); if (law) set.add(`${law}第 ${Number(m[2])} 條${m[3] ? '之 ' + Number(m[3]) : ''}`); }
    const list = [...set]; articleCache.set(q.id, list); return list;
  }

  /* ---------- 弱點摘要：刑法、刑事訴訟法目前還在錯題本裡的題目，依條文與章節統計 ---------- */
  function weakSummary() {
    const subjects = {};
    for (const subject of WEAK_SUBJECTS) {
      const arts = new Map(), chaps = new Map(); let done = 0, wrong = 0;
      for (const q of BANK) {
        if (q.subject !== subject) continue;
        const r = store.records[q.id]; if (!r || !r.n || r.x) continue;
        const miss = r.w ? 1 : 0; done++; wrong += miss;
        for (const a of articlesOf(q)) { const x = arts.get(a) || {name: a, wrong: 0, done: 0}; x.done++; x.wrong += miss; arts.set(a, x); }
        if (CH) for (const id of CH.tagsOf(q, overrides())) { const x = chaps.get(id) || {id, name: CH.nameOf(subject, id), wrong: 0, done: 0}; x.done++; x.wrong += miss; chaps.set(id, x); }
      }
      const rank = m => [...m.values()].filter(x => x.wrong > 0).sort((a, b) => b.wrong - a.wrong || b.done - a.done || a.name.localeCompare(b.name, 'zh-Hant'));
      subjects[subject] = {done, wrong, articles: rank(arts).slice(0, 8), chapters: rank(chaps).slice(0, 6)};
    }
    return {version: 1, subjects};
  }
  let weakLast = null;
  function writeWeak() {
    if (!storageOK) return;
    try {
      const body = JSON.stringify(weakSummary());
      if (weakLast === null) { try { const old = JSON.parse(localStorage.getItem(WEAK_KEY) || 'null'); weakLast = old ? JSON.stringify({version: old.version, subjects: old.subjects}) : ''; } catch { weakLast = ''; } }
      if (body === weakLast) return;
      localStorage.setItem(WEAK_KEY, JSON.stringify({...JSON.parse(body), updatedAt: new Date().toISOString()}));
      weakLast = body;
    } catch { /* 摘要寫不進去不影響作答紀錄 */ }
  }

  /* ---------- 抽題 ---------- */
  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
  function selectedSubjects() { return new Set([...document.querySelectorAll('#subject-groups input:checked')].map(i => i.value)); }
  function poolFor(opts) {
    let list = BANK.filter(q => scored(q) && !outdated(q.id) && opts.subjects.has(q.subject) && q.year >= opts.from && q.year <= opts.to);
    if (opts.pool === 'new') list = list.filter(q => !store.records[q.id]);
    if (opts.pool === 'wrong') list = list.filter(q => store.records[q.id]?.w);
    if (opts.pool === 'due') list = list.filter(q => { const r = store.records[q.id]; return r?.w && r.d && r.d <= today(); });
    if (opts.chapter && CH) list = list.filter(q => CH.inChapter(q, opts.chapter, overrides()));
    return list;
  }
  /* 章節篩選：只勾一科、而且那一科有章節歸類時才出現。 */
  function chapterSubject() { const s = [...selectedSubjects()]; return CH && s.length === 1 && CH.has(s[0]) ? s[0] : ''; }
  function syncChapterSelect(want) {
    const wrap = $('chapter-wrap'), sel = $('chapter'); if (!wrap || !sel) return;
    const subject = chapterSubject();
    $('chapter-hint').hidden = !CH || !!subject;
    wrap.hidden = !subject;
    if (!subject) { sel.dataset.subject = ''; sel.replaceChildren(); return; }
    const keep = want !== undefined ? want : (sel.dataset.subject === subject ? sel.value : '');
    const counts = CH.counts(subject, BANK.filter(q => scored(q) && !outdated(q.id)), overrides());
    sel.replaceChildren(h('option', {value: '', text: '全部章節'}),
      ...CH.chapters(subject).map(c => h('option', {value: c.id, text: `${c.name}（${counts[c.id]}）`})),
      h('option', {value: CH.UNSORTED, text: `尚未歸類（${counts[CH.UNSORTED]}）`}));
    sel.dataset.subject = subject;
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : '';
  }
  const bySeq = (a, b) => a.year - b.year || String(a.paper).localeCompare(String(b.paper)) || a.no - b.no;
  function readPracticeOptions() {
    return {subjects: selectedSubjects(), from: Number($('year-from').value), to: Number($('year-to').value), pool: $('pool').value, count: Number($('count').value), order: $('order').value, chapter: chapterSubject() ? $('chapter').value : ''};
  }
  function updatePoolInfo() {
    syncChapterSelect();
    const o = readPracticeOptions();
    if (o.from > o.to) { $('pool-info').textContent = '年度起迄顛倒了，請調整。'; $('practice-start').disabled = true; return; }
    const n = poolFor(o).length;
    $('pool-info').textContent = n ? `符合條件 ${n} 題，這次會出 ${Math.min(n, o.count)} 題。` : '沒有符合條件的題目，請放寬科目、年度或題目範圍。';
    $('practice-start').disabled = n === 0;
    renderCommute();
  }

  /* ---------- 版面切換 ---------- */
  let timerId = null, chosen = null, confirmBox = null, unsureNow = false;
  function showView(name) {
    $('page-heading').hidden = name !== 'home';
    $('home-view').hidden = name !== 'home';
    $('session-view').hidden = name !== 'session';
    $('result-view').hidden = name !== 'result';
    if (name !== 'session' && timerId) { clearInterval(timerId); timerId = null; }
    window.scrollTo(0, 0);
  }
  function setTab(name, focus) {
    for (const t of ['practice', 'exam', 'wrong', 'stats']) {
      const on = t === name;
      $('tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false');
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    }
    if (focus) $('tab-' + name).focus();
  }
  function bindTabs() {
    const names = ['practice', 'exam', 'wrong', 'stats'];
    names.forEach((n, i) => {
      $('tab-' + n).addEventListener('click', () => { setTab(n); if (n === 'wrong') renderWrong(); if (n === 'stats') renderStats(); });
      $('tab-' + n).addEventListener('keydown', e => {
        const k = {ArrowRight: 1, ArrowLeft: -1}[e.key];
        if (!k) { if (e.key === 'Home') { e.preventDefault(); setTab(names[0], true); } if (e.key === 'End') { e.preventDefault(); setTab(names.at(-1), true); } return; }
        e.preventDefault(); const next = names[(i + k + names.length) % names.length]; setTab(next, true);
        if (next === 'wrong') renderWrong(); if (next === 'stats') renderStats();
      });
    });
  }

  /* ---------- 首頁 ---------- */
  function renderHome() {
    const answerable = BANK.filter(scored), skipped = BANK.length - answerable.length;
    const years = [...new Set(BANK.map(q => q.year))].sort((a, b) => a - b);
    $('bank-summary').textContent = `${BANK.length} 題（${years[0]}–${years.at(-1)} 年，律師／司法官第一試）` + (skipped ? `；其中 ${skipped} 題原檔選項或正解殘缺，標為不計分。` : '。');
    // 科目
    const saved = new Set(store.settings.subjects || SUBJECTS);
    const count = Object.fromEntries(SUBJECTS.map(s => [s, BANK.filter(q => q.subject === s && scored(q)).length]));
    $('subject-groups').replaceChildren(...GROUPS.map(([paper, list]) => h('div', {class: 'subject-group'},
      h('p', {text: `${paper}　${PAPERS[paper].title}`}),
      h('div', {class: 'chips'}, list.map(s => h('label', {class: 'chip'},
        h('input', {type: 'checkbox', value: s, checked: saved.has(s), onchange: updatePoolInfo}), s, h('small', {text: String(count[s])})))))));
    for (const id of ['year-from', 'year-to', 'exam-year']) $(id).replaceChildren(...years.map(y => h('option', {value: y, text: `${y} 年`})));
    $('year-from').value = store.settings.from && years.includes(store.settings.from) ? store.settings.from : years[0];
    $('year-to').value = store.settings.to && years.includes(store.settings.to) ? store.settings.to : years.at(-1);
    if (store.settings.pool) $('pool').value = store.settings.pool;
    if (store.settings.count) $('count').value = String(store.settings.count);
    if (store.settings.order) $('order').value = store.settings.order;
    syncChapterSelect(store.settings.chapter || '');
    $('exam-year').value = years.at(-1);
    $('exam-paper').replaceChildren(...Object.entries(PAPERS).map(([p, v]) => h('option', {value: p, text: `${p}：${v.title}（${v.minutes} 分鐘）`})));
    $('wrong-subject').replaceChildren(h('option', {value: '', text: '全部科目'}), ...SUBJECTS.map(s => h('option', {value: s, text: s})));
    updatePoolInfo(); updateExamInfo(); renderResume(); renderExamHistory(); updateBadge();
  }
  function updateBadge() { const n = wrongList().length; $('wrong-badge').textContent = String(n); $('wrong-badge').hidden = !n; }
  function renderResume() {
    const a = store.active;
    $('resume-box').hidden = !a;
    if (!a) return;
    if (a.kind === 'exam') {
      $('resume-title').textContent = `有一份整卷模擬還沒交卷（${a.year} 年${a.paper}）`;
      $('resume-detail').textContent = `已作答 ${Object.keys(a.answers).length}／${a.ids.length} 題` + (a.deadline ? '；計時以開始時間為準，時間到會自動交卷。' : '。');
    } else {
      $('resume-title').textContent = '有一組練習還沒做完';
      $('resume-detail').textContent = `做到第 ${Math.min(a.idx + 1, a.ids.length)}／${a.ids.length} 題。`;
    }
  }

  /* ---------- 練習 ---------- */
  function startPractice(ids, extra) {
    store.active = {kind: 'practice', ids, idx: 0, results: {}, startedAt: Date.now(), ...(extra || {})};
    persist(); chosen = null; showSession();
  }
  function onPracticeSubmit(e) {
    e.preventDefault();
    const o = readPracticeOptions();
    let list = poolFor(o);
    list = o.order === 'random' ? shuffle(list) : list.sort(bySeq);
    list = list.slice(0, o.count);
    if (!list.length) return;
    store.settings = {...store.settings, subjects: [...o.subjects], from: o.from, to: o.to, pool: o.pool, count: o.count, order: o.order, chapter: o.chapter};
    startPractice(o.order === 'random' ? list.map(q => q.id) : list.map(q => q.id));
  }

  /* ---------- 通勤練習：一鍵開始固定題數；先出到期的錯題，再補還沒做過的，最後才是做過的 ---------- */
  function commuteSubjects() {
    const code = $('commute-subject').value, set = COMMUTE_SETS.find(s => s[0] === code) || COMMUTE_SETS[0];
    return set[2] ? new Set(set[2]) : selectedSubjects();
  }
  function commutePools() {
    const subjects = commuteSubjects(), t = today();
    const all = BANK.filter(q => scored(q) && !outdated(q.id) && subjects.has(q.subject));
    const due = all.filter(q => { const r = store.records[q.id]; return r?.w && r.d && r.d <= t; });
    const fresh = all.filter(q => !store.records[q.id]);
    const picked = new Set([...due, ...fresh].map(q => q.id));
    return {all, due, fresh, rest: all.filter(q => !picked.has(q.id))};
  }
  function commutePick(count) {
    const p = commutePools(), half = Math.ceil(count / 2);
    const out = shuffle(p.due).slice(0, p.fresh.length ? half : count);
    for (const group of [p.fresh, p.due, p.rest]) { const have = new Set(out.map(q => q.id)); for (const q of shuffle(group)) { if (out.length >= count) break; if (!have.has(q.id)) out.push(q); } }
    return out.slice(0, count).map(q => q.id);
  }
  function renderCommute() {
    const box = $('commute-box'); if (!box) return;
    const a = store.active, p = commutePools();
    for (const id of ['commute-20', 'commute-30']) $(id).disabled = !!a || !p.all.length;
    $('commute-info').textContent = a ? '有一組還沒做完，請先按上方的「接續」，或放棄那一組。'
      : p.all.length ? `這個範圍共 ${p.all.length} 題：到期該複習的錯題 ${p.due.length} 題、還沒做過的 ${p.fresh.length} 題。` : '這個範圍沒有題目，請換一個科目。';
  }
  function startCommute(count) {
    if (store.active) return;
    const ids = commutePick(count); if (!ids.length) return;
    store.settings = {...store.settings, commute: $('commute-subject').value};
    startPractice(ids, {commute: 1});
  }

  /* ---------- 作答畫面 ---------- */
  function metaLine(q, extra) {
    return h('div', {class: 'question-meta'}, h('span', {class: 'pill', text: q.subject}), `${q.year} 年${q.paper || ''}第 ${q.no} 題`, extra || null);
  }
  function optionsBox(q, picked, locked, onPick, reveal) {
    const name = 'opt-' + q.id;
    return h('fieldset', {class: 'options-set'}, h('legend', {class: 'sr-only', text: '選項（單選）'}),
      h('div', {class: 'options'}, q.options.map((text, i) => {
        const L = LETTERS[i], input = h('input', {type: 'radio', name, value: L, checked: picked === L, disabled: locked, onchange: () => onPick(L)});
        const cls = ['option'];
        let mark = null;
        if (locked && reveal) {
          if (isCorrect(q, L)) { cls.push('correct'); mark = h('span', {class: 'mark', text: '✓ 正確答案'}); }
          else if (picked === L) { cls.push('wrong'); mark = h('span', {class: 'mark', text: '✗ 你選的'}); }
        }
        return h('label', {class: cls.join(' ')}, input, h('span', {class: 'letter', text: `(${L})`}), h('span', {class: 'text', text}), mark);
      })));
  }
  function answerText(q) { return q.status === 'multi' ? `${q.acceptedAnswers.join('、')}（官方更正，選任一個都給分）` : q.answer; }
  function causeBox(q) {
    const r = store.records[q.id]; if (!r) return null;
    return h('fieldset', {class: 'cause-set'}, h('legend', {text: '這題錯在哪？（選填，統計頁會彙整）'}),
      h('div', {class: 'cause-options'}, CAUSES.map(([code, text]) => h('label', {class: 'cause'},
        h('input', {type: 'radio', name: 'cause-' + q.id, value: code, checked: r.e === code, onchange: () => { r.e = code; persist(); }}), text))));
  }
  function outdatedButton(q, after) {
    return h('button', {type: 'button', class: 'secondary small-btn', onclick: () => {
      const r = store.records[q.id]; if (!r) return;
      if (r.x) delete r.x; else r.x = 1;
      persist(); updateBadge(); after();
    }, text: store.records[q.id]?.x ? '取消「已過時」標記' : '標為已過時（修法後答案不同，不再出題）'});
  }
  function feedbackBox(q, letter, unsure) {
    const ok = isCorrect(q, letter);
    return h('div', {class: 'feedback ' + (ok ? 'ok' : 'bad'), role: 'status'},
      h('strong', {text: ok ? (unsure ? '✓ 答對了（你標了不確定，明天會再出現）' : '✓ 答對了') : `✗ 答錯了，正確答案：${answerText(q)}`}),
      q.status === 'multi' ? h('p', {class: 'small', text: q.answerNote}) : null,
      q.url ? h('p', {class: 'source'}, '題目來源：', h('a', {href: q.url, target: '_blank', rel: 'noopener', text: 'LawPlayer 整理的考選部試題 ↗'}), '。官方更正答案請查考選部。') : null);
  }
  /* 章節：顯示這題歸到哪幾章，可以移除歸錯的、加入漏掉的；更正存在 store.chapters，優先於自動歸類。 */
  function chapterBox(q) {
    if (!CH || !CH.has(q.subject)) return null;
    const box = h('div', {class: 'chapter-box'});
    const save = list => { store.chapters = {...overrides(), [q.id]: list}; persist(); draw(); };
    function draw() {
      const tags = CH.tagsOf(q, overrides()), edited = Object.prototype.hasOwnProperty.call(overrides(), q.id);
      const rest = CH.chapters(q.subject).filter(c => !tags.includes(c.id));
      box.replaceChildren(
        h('p', {class: 'small muted', text: edited ? '章節（你更正過）：' : '章節（自動歸類，可能有誤）：'}),
        h('ul', {class: 'chapter-tags'}, tags.length ? tags.map(id => h('li', {}, h('span', {text: CH.nameOf(q.subject, id)}),
          h('button', {type: 'button', class: 'chip-remove', 'aria-label': `把這題移出「${CH.nameOf(q.subject, id)}」`, onclick: () => save(tags.filter(x => x !== id)), text: '移除'}))) : h('li', {}, h('span', {text: '尚未歸類'}))),
        h('div', {class: 'chapter-edit'},
          rest.length ? h('label', {}, '加入章節', h('select', {onchange: e => { if (e.target.value) save(CH.chapters(q.subject).map(c => c.id).filter(id => tags.includes(id) || id === e.target.value)); }},
            h('option', {value: '', text: '選一個章節…'}), ...rest.map(c => h('option', {value: c.id, text: c.name})))) : null,
          edited ? h('button', {type: 'button', class: 'secondary', onclick: () => { const next = {...overrides()}; delete next[q.id]; store.chapters = next; persist(); draw(); }, text: '還原自動歸類'}) : null));
    }
    draw();
    return box;
  }
  function unscoredBox(q) {
    return h('div', {class: 'unscored'}, h('strong', {text: '本題原檔殘缺，不計分'}), h('p', {text: q.answerNote || '選項或正解不完整。'}),
      q.url ? h('p', {class: 'source'}, '請對照原卷：', h('a', {href: q.url, target: '_blank', rel: 'noopener', text: 'LawPlayer ↗'})) : null);
  }

  function showSession() {
    const a = store.active;
    if (!a) { document.body.classList.remove('mcq-commute'); renderAll(); showView('home'); return; }
    showView('session');
    const exam = a.kind === 'exam';
    $('session-kind').textContent = exam ? `整卷模擬｜${a.year} 年${a.paper}` : a.commute ? '通勤練習' : '依科目練習';
    document.body.classList.toggle('mcq-commute', !exam && !!a.commute);
    $('session-pause').hidden = exam;
    $('session-end').textContent = exam ? '交卷' : '結束並看結果';
    $('navigator-wrap').hidden = !exam;
    $('timer').hidden = !(exam && a.deadline);
    $('session-end').onclick = () => exam ? askSubmitExam() : finishPractice();
    if (exam && a.deadline) startTimer();
    renderQuestion();
    $('session-heading').focus();
  }
  function startTimer() {
    const a = store.active, tick = () => {
      const left = Math.max(0, a.deadline - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
      $('timer').textContent = `剩餘 ${pad(m)}:${pad(s)}`;
      $('timer').classList.toggle('low', left <= 5 * 60000);
      if (left <= 0) { clearInterval(timerId); timerId = null; submitExam(true); }
    };
    if (timerId) clearInterval(timerId);
    tick(); timerId = setInterval(tick, 1000);
  }

  function renderQuestion() {
    const a = store.active, card = $('question-card'), q = byId.get(a.ids[a.idx]);
    confirmBox = null;
    $('session-progress').max = a.ids.length;
    const exam = a.kind === 'exam';
    $('session-progress').value = exam ? Object.keys(a.answers).length : a.idx + (a.results[q.id] ? 1 : 0);
    $('session-heading').textContent = `第 ${a.idx + 1}／${a.ids.length} 題`;
    if (exam) renderNavigator();
    const kids = [metaLine(q, exam && a.flags[q.no] ? h('span', {class: 'pill', text: '已標記待檢查'}) : null), h('p', {class: 'question-text', id: 'qtext', text: q.body})];
    if (!scored(q)) {
      kids.push(unscoredBox(q));
      kids.push(h('div', {class: 'actions'}, exam ? navButtons(a) : h('button', {type: 'button', class: 'primary', onclick: () => nextPractice(), text: a.idx + 1 < a.ids.length ? '下一題' : '看結果'})));
      card.replaceChildren(...kids); return;
    }
    if (exam) {
      const picked = a.answers[q.no] || null;
      kids.push(optionsBox(q, picked, false, L => { a.answers[q.no] = L; persist(); renderNavigator(); $('session-progress').value = Object.keys(a.answers).length; }));
      kids.push(h('div', {class: 'actions'}, navButtons(a)));
    } else {
      const done = a.results[q.id];
      kids.push(optionsBox(q, done ? done.l : chosen, !!done, L => { chosen = L; $('submit-answer').disabled = false; }, !!done));
      if (done) {
        kids.push(feedbackBox(q, done.l, done.u));
        if (!done.ok) kids.push(causeBox(q));
        const arts = articlesOf(q);
        if (arts.length) kids.push(h('p', {class: 'small muted', text: '題目提到的條文：' + arts.join('、')}));
        kids.push(chapterBox(q));
        const next = h('button', {type: 'button', class: 'primary', id: 'next-question', onclick: nextPractice, text: a.idx + 1 < a.ids.length ? '下一題' : '看結果'});
        // 通勤練習時只有「下一題」固定在畫面下方；「標為已過時」留在題目最後，不佔住畫面。
        if (a.commute) { kids.push(h('div', {class: 'actions plain'}, outdatedButton(q, renderQuestion))); kids.push(h('div', {class: 'actions'}, next)); }
        else kids.push(h('div', {class: 'actions'}, next, outdatedButton(q, renderQuestion)));
      } else {
        kids.push(h('label', {class: 'unsure'}, h('input', {type: 'checkbox', id: 'unsure', checked: unsureNow, onchange: e => { unsureNow = e.target.checked; }}), '這題我不確定（猜的）——答對也排進複習'));
        kids.push(h('div', {class: 'actions'},
          h('button', {type: 'button', class: 'primary', id: 'submit-answer', disabled: !chosen, onclick: submitPractice, text: '送出答案'}),
          h('button', {type: 'button', class: 'secondary', onclick: skipPractice, text: '跳過這題'})));
      }
    }
    card.replaceChildren(...kids);
    if (!exam && a.results[q.id]) $('next-question')?.focus();
  }
  function submitPractice() {
    const a = store.active, q = byId.get(a.ids[a.idx]);
    if (!chosen || a.results[q.id]) return;
    const ok = isCorrect(q, chosen), unsure = ok && unsureNow;
    record(q, chosen, ok, unsure);
    a.results[q.id] = unsure ? {l: chosen, ok, u: 1} : {l: chosen, ok};
    persist(); chosen = null; unsureNow = false; renderQuestion(); updateBadge();
  }
  function skipPractice() { chosen = null; unsureNow = false; nextPractice(); }
  function nextPractice() {
    const a = store.active; chosen = null; unsureNow = false;
    if (a.idx + 1 >= a.ids.length) { finishPractice(); return; }
    a.idx++; persist(); renderQuestion(); $('session-heading').focus();
  }

  /* 整卷 */
  function navButtons(a) {
    const q = byId.get(a.ids[a.idx]);
    return [
      h('button', {type: 'button', class: 'secondary', disabled: a.idx === 0, onclick: () => goto(a.idx - 1), text: '上一題'}),
      h('button', {type: 'button', class: 'secondary', disabled: a.idx + 1 >= a.ids.length, onclick: () => goto(a.idx + 1), text: '下一題'}),
      scored(q) ? h('button', {type: 'button', class: 'secondary', 'aria-pressed': a.flags[q.no] ? 'true' : 'false', onclick: () => { if (a.flags[q.no]) delete a.flags[q.no]; else a.flags[q.no] = 1; persist(); renderQuestion(); }, text: a.flags[q.no] ? '取消標記' : '標記待檢查'}) : null,
      scored(q) && a.answers[q.no] ? h('button', {type: 'button', class: 'secondary', onclick: () => { delete a.answers[q.no]; persist(); renderQuestion(); }, text: '清除作答'}) : null
    ];
  }
  function goto(i) { const a = store.active; a.idx = Math.max(0, Math.min(a.ids.length - 1, i)); persist(); renderQuestion(); }
  function renderNavigator() {
    const a = store.active;
    $('navigator-help').textContent = `已作答 ${Object.keys(a.answers).length}／${a.ids.filter(id => scored(byId.get(id))).length} 題（有框線＝標記待檢查）`;
    $('navigator').replaceChildren(...a.ids.map((id, i) => {
      const q = byId.get(id);
      const state = !scored(q) ? 'skip' : a.flags[q.no] ? 'flagged' : a.answers[q.no] ? 'answered' : 'open';
      const label = `第 ${q.no} 題` + (!scored(q) ? '（不計分）' : a.answers[q.no] ? '（已作答）' : '（未作答）') + (a.flags[q.no] ? '（已標記）' : '');
      return h('button', {type: 'button', 'data-state': state, 'aria-label': label, 'aria-current': i === a.idx ? 'true' : null, onclick: () => goto(i), text: String(q.no)});
    }));
  }
  function startExam(e) {
    e.preventDefault();
    const year = Number($('exam-year').value), paper = $('exam-paper').value, timed = $('exam-timer').value === 'on';
    const qs = BANK.filter(q => q.year === year && q.paper === paper).sort((x, y) => x.no - y.no);
    if (!qs.length) return;
    const startedAt = Date.now();
    store.active = {kind: 'exam', year, paper, ids: qs.map(q => q.id), idx: 0, answers: {}, flags: {}, startedAt, deadline: timed ? startedAt + PAPERS[paper].minutes * 60000 : null};
    persist(); showSession();
  }
  function updateExamInfo() {
    const year = Number($('exam-year').value), paper = $('exam-paper').value;
    const qs = BANK.filter(q => q.year === year && q.paper === paper), ok = qs.filter(scored).length;
    $('exam-info').textContent = qs.length ? `${qs.length} 題（計分 ${ok} 題，滿分 ${ok * POINT} 分）；時間 ${PAPERS[paper].minutes} 分鐘。` : '這一年沒有這一卷的題目。';
    $('exam-start').disabled = !qs.length;
  }
  function askSubmitExam() {
    const a = store.active, left = a.ids.filter(id => scored(byId.get(id)) && !a.answers[byId.get(id).no]).length;
    if (confirmBox) { confirmBox.querySelector('button')?.focus(); return; }
    confirmBox = h('div', {class: 'feedback', role: 'alertdialog', 'aria-label': '確認交卷'},
      h('strong', {text: left ? `還有 ${left} 題沒作答，確定要交卷嗎？` : '確定要交卷嗎？交卷後就不能再修改。'}),
      h('div', {class: 'actions'}, h('button', {type: 'button', class: 'primary', onclick: () => submitExam(false), text: '確定交卷'}), h('button', {type: 'button', class: 'secondary', onclick: () => { confirmBox.remove(); confirmBox = null; $('session-end').focus(); }, text: '繼續作答'})));
    $('question-card').append(confirmBox); confirmBox.querySelector('button').focus();
  }
  function examResultOf(year, paper, answers) {
    const qs = BANK.filter(q => q.year === year && q.paper === paper).sort((x, y) => x.no - y.no);
    const rows = qs.map(q => ({q, picked: answers[q.no] || null, ok: scored(q) && !!answers[q.no] && isCorrect(q, answers[q.no])}));
    const total = rows.filter(r => scored(r.q)).length, correct = rows.filter(r => r.ok).length;
    return {rows, total, correct, answered: rows.filter(r => r.picked).length, score: correct * POINT, max: total * POINT};
  }
  function submitExam(auto) {
    const a = store.active; if (!a || a.kind !== 'exam') return;
    if (timerId) { clearInterval(timerId); timerId = null; }
    const res = examResultOf(a.year, a.paper, a.answers);
    for (const r of res.rows) if (r.picked && scored(r.q)) record(r.q, r.picked, r.ok);
    const used = Math.round((Math.min(Date.now(), a.deadline || Date.now()) - a.startedAt) / 60000);
    const entry = {id: 'e' + a.startedAt, t: new Date().toISOString(), type: 'exam', year: a.year, paper: a.paper, timed: !!a.deadline, usedMin: used, score: res.score, max: res.max, correct: res.correct, total: res.total, answered: res.answered, answers: a.answers};
    store.history.unshift(entry);
    let exams = 0; store.history = store.history.filter(x => x.type !== 'exam' || ++exams <= MAX_EXAMS).slice(0, MAX_HISTORY);
    store.active = null; persist();
    renderExamResult(entry, auto);
  }

  /* ---------- 結果 ---------- */
  function reviewItem(q, picked, ok) {
    const tag = !scored(q) ? '不計分' : !picked ? '未作答' : ok ? '答對' : '答錯';
    return h('details', {class: 'item'},
      h('summary', {}, h('span', {class: 'pill', text: tag}), h('span', {class: 'pill', text: q.subject}), `${q.year} 年${q.paper || ''}第 ${q.no} 題`),
      h('div', {}, h('p', {class: 'qtext', text: q.body}),
        scored(q) ? h('ol', {type: 'A', class: 'review-options'}, q.options.map((t, i) => h('li', {}, t, isCorrect(q, LETTERS[i]) ? '　✓ 正確答案' : '', picked === LETTERS[i] && !isCorrect(q, LETTERS[i]) ? '　✗ 你選的' : ''))) : unscoredBox(q),
        scored(q) ? h('p', {}, picked ? `你選 ${picked}；` : '你沒有作答；', `正確答案：${answerText(q)}`) : null,
        q.url ? h('p', {class: 'source'}, h('a', {href: q.url, target: '_blank', rel: 'noopener', text: '題目來源（LawPlayer）↗'})) : null));
  }
  function resultActions(wrongIds, backLabel) {
    return h('div', {class: 'actions'},
      wrongIds.length ? h('button', {type: 'button', class: 'primary', onclick: () => startPractice(shuffle(wrongIds)), text: `把這 ${wrongIds.length} 題錯題再練一次`}) : null,
      h('button', {type: 'button', class: 'secondary', onclick: () => { renderAll(); showView('home'); }, text: backLabel}));
  }
  function finishPractice() {
    const a = store.active; if (!a) return;
    const done = a.ids.filter(id => a.results[id]).map(id => ({q: byId.get(id), ...a.results[id]}));
    const correct = done.filter(r => r.ok).length;
    if (done.length) { store.history.unshift({id: 'p' + a.startedAt, t: new Date().toISOString(), type: 'practice', total: done.length, correct}); store.history = store.history.slice(0, MAX_HISTORY); }
    store.active = null; persist(); chosen = null; document.body.classList.remove('mcq-commute');
    const wrong = done.filter(r => !r.ok), guessed = done.filter(r => r.ok && r.u);
    const body = $('result-body');
    body.replaceChildren(h('h2', {id: 'result-heading', tabindex: '-1', text: '本次練習結果'}),
      done.length ? h('div', {class: 'stat-row'}, stat(`${correct}／${done.length}`, '答對題數'), stat(`${Math.round(correct / done.length * 100)}%`, '正確率'), stat(String(a.ids.length - done.length), '沒作答的題')) : h('p', {text: '這次沒有作答任何一題。'}),
      wrong.length ? h('h3', {text: `答錯的題目（${wrong.length}）已加入錯題本`}) : null,
      ...wrong.map(r => reviewItem(r.q, r.l, false)),
      guessed.length ? h('p', {text: `另有 ${guessed.length} 題答對但你標了「不確定」，已排進錯題本的複習。`}) : null,
      resultActions(wrong.map(r => r.q.id), '回到練習首頁'));
    showView('result'); $('result-heading').focus();
  }
  const stat = (b, s) => h('div', {class: 'stat'}, h('b', {text: b}), h('span', {text: s}));
  function renderExamResult(entry, auto) {
    const res = examResultOf(entry.year, entry.paper, entry.answers);
    const subjects = [...new Set(res.rows.map(r => r.q.subject))];
    const bySubject = subjects.map(s => { const rs = res.rows.filter(r => r.q.subject === s && scored(r.q)); const c = rs.filter(r => r.ok).length; return {s, total: rs.length, c, answered: rs.filter(r => r.picked).length}; });
    const wrong = res.rows.filter(r => scored(r.q) && !r.ok);
    $('result-body').replaceChildren(
      h('h2', {id: 'result-heading', tabindex: '-1', text: `${entry.year} 年${entry.paper} 模擬結果`}),
      auto ? h('p', {class: 'notice', text: '時間到，已自動交卷。'}) : null,
      h('div', {class: 'stat-row'}, stat(`${res.score}／${res.max}`, `得分（每題 ${POINT} 分）`), stat(`${res.correct}／${res.total}`, '答對題數'), stat(String(res.total - res.answered), '未作答'), stat(entry.timed ? `${entry.usedMin} 分鐘` : '不計時', '作答時間')),
      h('h3', {text: '各科得分'}),
      h('div', {class: 'table-wrap'}, h('table', {}, h('thead', {}, h('tr', {}, ['科目', '答對／題數', '得分', '正確率'].map(t => h('th', {scope: 'col', text: t})))),
        h('tbody', {}, bySubject.map(r => h('tr', {}, h('th', {scope: 'row', text: r.s}), h('td', {text: `${r.c}／${r.total}`}), h('td', {text: `${r.c * POINT}／${r.total * POINT}`}), h('td', {text: r.total ? Math.round(r.c / r.total * 100) + '%' : '—'})))))),
      h('h3', {text: `沒答對的題目（${wrong.length}，含未作答）`}),
      ...wrong.map(r => reviewItem(r.q, r.picked, false)),
      resultActions(wrong.filter(r => r.picked).map(r => r.q.id), '回到整卷模擬'));
    showView('result'); $('result-heading').focus();
  }
  function renderExamHistory() {
    const exams = store.history.filter(x => x.type === 'exam');
    $('exam-history').replaceChildren(...(exams.length ? [h('div', {class: 'table-wrap'}, h('table', {}, h('thead', {}, h('tr', {}, ['日期', '試卷', '得分', '答對', ''].map(t => h('th', {scope: 'col', text: t})))),
      h('tbody', {}, exams.map(x => h('tr', {}, h('td', {text: x.t.slice(0, 10)}), h('td', {text: `${x.year} 年${x.paper}`}), h('td', {text: `${x.score}／${x.max}`}), h('td', {text: `${x.correct}／${x.total}`}),
        h('td', {}, h('button', {type: 'button', class: 'secondary', onclick: () => renderExamResult(x, false), text: '看檢討'})))))))] : [h('p', {class: 'muted', text: '還沒有交過卷。'})]));
  }

  /* ---------- 錯題本 ---------- */
  function renderWrong() {
    const subject = $('wrong-subject').value;
    const all = wrongList().filter(x => !subject || x.q.subject === subject).sort((a, b) => (a.r.d || '').localeCompare(b.r.d || '') || (b.r.t || '').localeCompare(a.r.t || ''));
    const due = dueList().filter(x => !subject || x.q.subject === subject);
    const unsureCount = all.filter(x => x.r.u).length;
    $('wrong-info').textContent = all.length ? `錯題本 ${all.length} 題（其中 ${unsureCount} 題是答對但不確定），${due.length} 題今天（或之前）該複習。` : '目前沒有錯題。答錯的題目、以及答對但標「不確定」的題目會出現在這裡。';
    $('wrong-practice-due').disabled = !due.length; $('wrong-practice-all').disabled = !all.length;
    $('wrong-practice-due').onclick = () => startPractice(shuffle(due.map(x => x.q.id)).slice(0, 50));
    $('wrong-practice-all').onclick = () => startPractice(shuffle(all.map(x => x.q.id)).slice(0, 50));
    $('wrong-list').replaceChildren(...all.map(({q, r}) => h('details', {class: 'item'},
      h('summary', {}, h('span', {class: 'pill', text: q.subject}), `${q.year} 年${q.paper}第 ${q.no} 題`, r.u ? h('span', {class: 'pill', text: '猜對'}) : null, h('span', {class: 'small muted', text: `共作答 ${r.n} 次・下次複習 ${r.d || '—'}${r.e ? '・錯因：' + causeText(r.e) : ''}`})),
      h('div', {}, h('p', {class: 'qtext', text: q.body}),
        h('ol', {type: 'A'}, q.options.map((t, i) => h('li', {}, t, isCorrect(q, LETTERS[i]) ? '　✓ 正確答案' : '', r.l === LETTERS[i] && !isCorrect(q, LETTERS[i]) ? '　✗ 你上次選的' : ''))),
        h('p', {text: `正確答案：${answerText(q)}`}),
        h('div', {class: 'actions'}, h('button', {type: 'button', class: 'secondary', onclick: () => { store.records[q.id].w = 0; store.records[q.id].d = null; delete store.records[q.id].u; persist(); renderWrong(); updateBadge(); }, text: '移出錯題本（我已經會了）'}),
          outdatedButton(q, () => { renderWrong(); renderStats(); }))))));

  }

  /* ---------- 統計 ---------- */
  function renderStats() {
    const rec = store.records, done = BANK.filter(q => rec[q.id]);
    const n = done.reduce((s, q) => s + rec[q.id].n, 0), c = done.reduce((s, q) => s + rec[q.id].c, 0);
    $('stats-overview').replaceChildren(stat(`${done.length}／${BANK.filter(scored).length}`, '做過的題目'), stat(n ? Math.round(c / n * 100) + '%' : '—', '整體正確率'), stat(String(wrongList().length), '錯題本'), stat(String(dueList().length), '今天該複習'));
    $('stats-table').tBodies[0].replaceChildren(...SUBJECTS.map(s => {
      const qs = BANK.filter(q => q.subject === s && scored(q)), mine = qs.filter(q => rec[q.id]);
      const att = mine.reduce((t, q) => t + rec[q.id].n, 0), ok = mine.reduce((t, q) => t + rec[q.id].c, 0), wr = qs.filter(q => rec[q.id]?.w && !rec[q.id].x).length;
      const pct = att ? Math.round(ok / att * 100) : null, weak = att >= 10 && pct < 60;
      return h('tr', {}, h('th', {scope: 'row', text: s}), h('td', {text: String(att)}),
        h('td', {}, pct === null ? '—' : [h('span', {class: 'bar' + (weak ? ' weak' : ''), 'aria-hidden': 'true'}, h('i', {style: `width:${pct}%`})), `${pct}%`, weak ? h('span', {class: 'tag-weak', text: '　較弱'}) : null]),
        h('td', {text: `${mine.length}／${qs.length}`}), h('td', {text: String(wr)}));
    }));
    renderStatsExtra();
  }

  function renderStatsExtra() {
    const rec = store.records;
    // 錯因
    const counts = Object.fromEntries(CAUSES.map(c => [c[0], 0])); let marked = 0;
    for (const [id, r] of Object.entries(rec)) if (r.w && !r.x && r.e && byId.has(id) && r.e in counts) { counts[r.e]++; marked++; }
    $('stats-causes').replaceChildren(marked ? h('div', {class: 'table-wrap'}, h('table', {class: 'compact'}, h('thead', {}, h('tr', {}, ['錯因', '題數', '占比'].map(t => h('th', {scope: 'col', text: t})))),
      h('tbody', {}, CAUSES.map(([code, text]) => h('tr', {}, h('th', {scope: 'row', text}), h('td', {text: String(counts[code])}), h('td', {text: Math.round(counts[code] / marked * 100) + '%'})))))) : h('p', {class: 'muted', text: '還沒有標過錯因。答錯後可以在題目下方選一個原因。'}));
    // 條文
    const missedQs = BANK.filter(q => { const r = rec[q.id]; return r && !r.x && r.n - r.c > 0; });
    const tally = new Map(); let covered = 0;
    for (const q of missedQs) { const arts = articlesOf(q); if (arts.length) covered++; for (const a of arts) tally.set(a, (tally.get(a) || 0) + 1); }
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant')).slice(0, 15);
    $('stats-articles-note').textContent = missedQs.length ? `自動從題目與選項文字擷取條號。你答錯過的 ${missedQs.length} 題中，${covered} 題（${Math.round(covered / missedQs.length * 100)}%）有寫到條號；沒寫條號的題目不在下表。擷取結果可能有誤，請以題目原文為準。` : '自動從題目與選項文字擷取條號；沒寫條號的題目歸不進來。';
    $('stats-articles').replaceChildren(top.length ? h('div', {class: 'table-wrap'}, h('table', {class: 'compact'}, h('thead', {}, h('tr', {}, ['條文', '錯題數', '練習'].map(t => h('th', {scope: 'col', text: t})))),
      h('tbody', {}, top.map(([art, n]) => h('tr', {}, h('th', {scope: 'row', text: art}), h('td', {text: String(n)}),
        h('td', {}, h('button', {type: 'button', class: 'secondary', onclick: () => {
          const ids = BANK.filter(q => scored(q) && !outdated(q.id) && articlesOf(q).includes(art)).map(q => q.id);
          startPractice(shuffle(ids).slice(0, 50));
        }, text: '練這條', 'aria-label': `練習提到${art}的題目`}))))))) : h('p', {class: 'muted', text: missedQs.length ? '答錯過的題目都沒有寫到條號。' : '還沒有答錯過的題目。'}));
    // 已過時
    const old = Object.entries(rec).filter(([id, r]) => r.x && byId.has(id)).map(([id]) => byId.get(id)).sort(bySeq);
    $('stats-outdated').replaceChildren(old.length ? h('ul', {class: 'outdated-list'}, old.map(q => h('li', {}, h('span', {text: `${q.subject}・${q.year} 年${q.paper || ''}第 ${q.no} 題`}),
      h('button', {type: 'button', class: 'secondary', onclick: () => { delete store.records[q.id].x; persist(); renderWrong(); renderStats(); updateBadge(); updatePoolInfo(); }, text: '取消標記'})))) : h('p', {class: 'muted', text: '目前沒有標為已過時的題目。'}));
  }

  /* ---------- 其他 ---------- */
  function renderAll() { renderHome(); renderWrong(); renderStats(); }
  function resume() {
    const a = store.active; if (!a) return;
    if (a.kind === 'exam' && a.deadline && Date.now() >= a.deadline) { submitExam(true); return; }
    chosen = null; showSession();
  }
  document.addEventListener('keydown', e => {
    if (!store.active || $('session-view').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && /^(SELECT|TEXTAREA)$/.test(t.tagName) || (t && t.tagName === 'INPUT' && t.type !== 'radio')) return;
    const k = e.key.toUpperCase(), idx = LETTERS.includes(k) ? LETTERS.indexOf(k) : '1234'.includes(e.key) && e.key ? Number(e.key) - 1 : -1;
    if (idx >= 0) { const radios = document.querySelectorAll('#question-card input[type=radio]:not(:disabled)'); if (radios[idx]) { radios[idx].checked = true; radios[idx].dispatchEvent(new Event('change', {bubbles: true})); radios[idx].focus(); e.preventDefault(); } }
    else if (e.key === 'Enter' && t && t.tagName === 'INPUT') { $('submit-answer')?.click(); }
  });

  function init() {
    if (!BANK.length) { $('empty').hidden = false; return; }
    load();
    bindTabs();
    $('practice-form').addEventListener('submit', onPracticeSubmit);
    for (const id of ['year-from', 'year-to', 'pool', 'count', 'order']) $(id).addEventListener('change', updatePoolInfo);
    $('subjects-all').onclick = () => { document.querySelectorAll('#subject-groups input').forEach(i => { i.checked = true; }); updatePoolInfo(); };
    $('subjects-none').onclick = () => { document.querySelectorAll('#subject-groups input').forEach(i => { i.checked = false; }); updatePoolInfo(); };
    $('exam-form').addEventListener('submit', startExam);
    if ($('chapter')) $('chapter').addEventListener('change', updatePoolInfo);
    $('commute-subject').replaceChildren(...COMMUTE_SETS.map(([code, label]) => h('option', {value: code, text: label})));
    $('commute-subject').value = COMMUTE_SETS.some(s => s[0] === store.settings.commute) ? store.settings.commute : COMMUTE_SETS[0][0];
    $('commute-subject').addEventListener('change', renderCommute);
    $('commute-20').onclick = () => startCommute(20);
    $('commute-30').onclick = () => startCommute(30);
    // 先停在這裡：回到練習首頁，進度留著，下次按「接續」或重新打開本頁就從同一題繼續。
    $('session-pause').onclick = () => { persist(); document.body.classList.remove('mcq-commute'); renderAll(); showView('home'); $('resume-go').focus(); };
    $('exam-year').addEventListener('change', updateExamInfo); $('exam-paper').addEventListener('change', updateExamInfo);
    $('wrong-subject').addEventListener('change', renderWrong);
    $('resume-go').onclick = resume;
    $('resume-drop').onclick = () => {
      const a = store.active; if (!a) return;
      const drop = () => { store.active = null; persist(); renderResume(); };
      if (a.kind === 'exam' && Object.keys(a.answers).length) {
        if ($('resume-box').querySelector('[data-confirm]')) return;
        const box = h('div', {class: 'feedback', 'data-confirm': '1', role: 'alertdialog', 'aria-label': '確認放棄'}, h('strong', {text: '放棄後，這份模擬的作答會消失（不會計分）。'}),
          h('div', {class: 'actions'}, h('button', {type: 'button', class: 'primary', onclick: drop, text: '確定放棄'}), h('button', {type: 'button', class: 'secondary', onclick: () => box.remove(), text: '先不要'})));
        $('resume-box').append(box); box.querySelector('button').focus();
      } else drop();
    };
    renderAll(); setTab('practice');
    $('home-view').hidden = false;
    writeWeak();
    if (store.active) {
      if (store.active.kind === 'exam') setTab('exam');
      // 通勤練習中斷後重新打開本頁，直接回到上次那一題（網址帶 #home 時留在首頁）。
      else if (store.active.commute && location.hash !== '#home') resume();
    } else if (location.hash === '#wrong') { setTab('wrong'); renderWrong(); } // 從「複習」頁連過來時直接開錯題本
  }
  init();
})();
