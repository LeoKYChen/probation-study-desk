/* 讀書計畫：116 年觀護人在職備考的三個階段、本週清單與檢核點。
   今日題組、模擬題與完整寫題的數字從既有紀錄讀取（只讀不寫）；心理學函授堂數、四科講義重讀與整卷練習在網站外進行，由使用者手動記。
   手動記錄存在 lawScoring.plan.v1（已納入完整備份）。考試日期讀首頁倒數的設定（psd-home-exam-countdown-v1），沒設定時以 2027-08-14 估。 */
(function () {
'use strict';
const KEY = 'lawScoring.plan.v1';
const EXAM_KEY = 'psd-home-exam-countdown-v1', STUDY30_KEY = 'probation-study30-v251:v1', SCORE_KEY = 'lawScoring.v2';
const START = '2026-11-16', EXAM_GUESS = '2027-08-14', PSYCH_TOTAL = 34;
const PHASES = [
  {n: 1, name: '打底', start: START, end: '2027-02-28', goal: '心理學上完第一遍；刑法、刑訴、犯罪學、諮商重讀；少事法、保安處分開始寫題。', psych: [2, 3], write: 1,
    slots: [['通勤', '今日題組 60 分鐘；其餘做要點卡、考點回想（先做刑法、刑訴、犯罪學、諮商）。做完可以休息，不必塞滿。'], ['平日晚上 1 小時', '週一刑法、週二刑訴、週三犯罪學、週四諮商：重讀函授講義，讀一章就寫那一章的題。週五完整寫 1 題（少事法或保安處分）。'], ['假日', '心理學函授 2 到 3 堂，上課前先翻前一堂講義；有餘力再完整寫 1 題。']],
    notes: ['心理學的考古題先當教材讀：輪到時直接翻開看評分要點，自評按「沒抓到」。', '刑法、刑訴以現行條文為準，舊筆記不直接沿用。']},
  {n: 2, name: '穩固', start: '2027-03-01', end: '2027-06-13', goal: '六科都以寫題為主；完成四科重讀；開始整卷練習。', psych: null, write: 6,
    slots: [['通勤', '今日題組（第 2 輪起每天題數增加）；要點卡、考點回想六科都做。'], ['平日晚上 1 小時', '週一到週四繼續完成四科重讀（4 月底前讀完）；讀完的科目改成每晚完整寫 1 題並訂正。'], ['假日', '每天完整寫 2 到 3 題並訂正；心理學講義讀第二遍；5 月起每兩週一次整卷限時（一科 4 題）。']],
    notes: ['開始累積「沒抓到」的題，作為衝刺期的複習清單。', '共同科目每週固定一個時段：法學知識選擇題、英文閱讀。']},
  {n: 3, name: '衝刺', start: '2027-06-14', end: null, goal: '把會的寫穩，把常錯的補起來，不再開新教材。', psych: null, write: 4,
    slots: [['通勤', '只做「沒抓到／抓到一半」的題與到期的卡片。'], ['平日晚上 1 小時', '一天一科，讀自己的錯題與重點整理的「優先複習」。'], ['假日', '整卷限時，每個假日至少一科；訂正後把漏掉的要點補到講義上。']],
    notes: ['考前 4 週核對一次修法（刑法、刑訴、少事法、保安處分執行法）。', '考前 2 週不再寫新題，只看錯題與講義上的註記。']}
];
const REREAD = [['criminal', '刑法'], ['procedure', '刑事訴訟法'], ['criminology', '犯罪學'], ['counseling', '諮商與輔導']];
const PAPERS = [['juvenile', '少年事件處理法'], ['criminal', '刑法'], ['procedure', '刑訴與保安處分'], ['criminology', '犯罪學'], ['psychology', '心理學'], ['counseling', '諮商與輔導']];
const CHECKPOINTS = [
  {date: '2026-12-13', fallback: '假日先保心理學，今日題組每天降為 3 題。'},
  {date: '2027-01-10', fallback: '過年連假補心理學；四科改成只讀「重點整理」對應的章節。'},
  {date: '2027-02-28', fallback: '穩固期前三週的假日仍先上完心理學。'},
  {date: '2027-04-30', fallback: '沒讀完的章節改用寫題帶讀。'},
  {date: '2027-06-13', fallback: '衝刺期的假日全部排整卷。'}
];

/* ---------- 日期 ---------- */
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseDay(day) { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); }
function validDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseDay(s)) === s; }
function addDays(day, n) { const d = parseDay(day); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) { return Math.round((parseDay(a) - parseDay(b)) / 86400000); }
function monday(day) { return addDays(day, -((parseDay(day).getDay() + 6) % 7)); } // 一週從週一到週日
function fmtDay(day) { const [, m, d] = day.split('-'); return Number(m) + '/' + Number(d); }
function phaseOf(day) { let p = PHASES[0]; for (const x of PHASES) if (day >= x.start) p = x; return p; }
function weekNo(day) { return Math.floor(diffDays(monday(day), monday(START)) / 7) + 1; }
function examDate(raw) { return raw && typeof raw === 'object' && validDay(raw.date) ? {date: raw.date, set: true} : {date: EXAM_GUESS, set: false}; }

/* ---------- 手動記錄：lecture:psych → {n}；week:<週一日期> → {psych, read:{科目:true}}；done:reread、done:paper → {科目:true} ---------- */
function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function flags(x, ids) { const o = {}; if (isObj(x)) for (const id of ids) if (x[id] === true) o[id] = true; return o; }
const RID = REREAD.map(x => x[0]), PID = PAPERS.map(x => x[0]);
function normalize(raw) {
  const out = {psych: 0, weeks: {}, reread: {}, paper: {}};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!isObj(v)) continue;
    if (k === 'lecture:psych') { if (Number.isInteger(v.n)) out.psych = Math.max(0, Math.min(PSYCH_TOTAL, v.n)); }
    else if (k === 'done:reread') out.reread = flags(v, RID);
    else if (k === 'done:paper') out.paper = flags(v, PID);
    else if (k.startsWith('week:') && validDay(k.slice(5))) {
      const w = {psych: Number.isInteger(v.psych) && v.psych > 0 ? Math.min(PSYCH_TOTAL, v.psych) : 0, read: flags(v.read, RID)};
      if (w.psych || Object.keys(w.read).length) out.weeks[k.slice(5)] = w;
    }
  }
  return out;
}
function pack(st) {
  const out = {};
  if (st.psych) out['lecture:psych'] = {n: st.psych};
  if (Object.keys(st.reread).length) out['done:reread'] = st.reread;
  if (Object.keys(st.paper).length) out['done:paper'] = st.paper;
  for (const [d, w] of Object.entries(st.weeks)) if (w.psych || Object.keys(w.read).length) out['week:' + d] = w.psych ? {psych: w.psych, read: w.read} : {read: w.read};
  return out;
}
function weekOf(st, day) { return st.weeks[monday(day)] || {psych: 0, read: {}}; }
function withWeek(st, day, w) { return {psych: st.psych, weeks: Object.assign({}, st.weeks, {[monday(day)]: w}), reread: st.reread, paper: st.paper}; }
// 心理學堂數加減：總數限制在 0 到 34；本週的堂數跟著加減（不低於 0）。
function bumpPsych(st, day, delta) {
  const n = Math.max(0, Math.min(PSYCH_TOTAL, st.psych + delta)); if (n === st.psych) return st;
  const w = weekOf(st, day), next = withWeek(st, day, {psych: Math.max(0, w.psych + (n - st.psych)), read: w.read});
  next.psych = n; return next;
}
function toggle(map, id, on) { const o = Object.assign({}, map); if (on) o[id] = true; else delete o[id]; return o; }
function setRead(st, day, id, on) { const w = weekOf(st, day); return withWeek(st, day, {psych: w.psych, read: toggle(w.read, id, on)}); }
function setReread(st, id, on) { return {psych: st.psych, weeks: st.weeks, reread: toggle(st.reread, id, on), paper: st.paper}; }
function setPaper(st, id, on) { return {psych: st.psych, weeks: st.weeks, reread: st.reread, paper: toggle(st.paper, id, on)}; }
function readWeeks(st, id) { return Object.values(st.weeks).filter(w => w.read[id]).length; }

/* ---------- 從既有紀錄讀數字（只讀） ---------- */
// 某一週（週一到週日）完整寫題的次數：每日30分鐘有自評或按過完成的日期，加上申論評分參考存過的作答歷程。
function writesInWeek(study30, scoreStore, day) {
  const a = monday(day), b = addDays(a, 6), inWeek = d => typeof d === 'string' && d >= a && d <= b;
  let n = 0;
  const sessions = isObj(study30) && isObj(study30.sessions) ? study30.sessions : {};
  for (const [d, s] of Object.entries(sessions)) if (inWeek(d) && isObj(s) && (s.finished === true || !!s.rating)) n++;
  if (isObj(scoreStore)) for (const s of Object.values(scoreStore)) if (isObj(s) && Array.isArray(s.history)) n += s.history.filter(h => isObj(h) && inWeek(h.d)).length;
  return n;
}
// 今日題組在某一週的完成數（題目與模擬題分開算）與目前進度。RD、roundState 沒有時回傳 null。
function roundsInWeek(RD, questions, roundState, day) {
  if (!RD || !roundState) return null;
  const a = monday(day), b = addDays(a, 6), ids = new Set(questions.map(q => q.id));
  let done = 0, mock = 0;
  for (const [k, v] of Object.entries(roundState.items)) { const n = v.done.filter(x => x.d >= a && x.d <= b).length; if (k.startsWith(RD.MOCK)) mock += n; else if (ids.has(k)) done += n; }
  const p = RD.plan(questions, roundState, day, 0), perDay = RD.ROUNDS[p.round - 1].perDay;
  return {done, mock, target: p.finished ? 0 : perDay * 6, perDay, behind: p.behind, round: p.round, roundDone: p.roundDone, roundTotal: p.roundTotal, finished: p.finished};
}
// 本週清單。env：{state, today, RD, questions, roundState, study30, scoreStore}
function weekStats(env) {
  const ph = phaseOf(env.today), w = weekOf(env.state, env.today);
  return {phase: ph, week: weekNo(env.today), monday: monday(env.today), sunday: addDays(monday(env.today), 6),
    rounds: roundsInWeek(env.RD, env.questions || [], env.roundState, env.today),
    write: {done: writesInWeek(env.study30, env.scoreStore, env.today), target: ph.write},
    psych: {week: w.psych, total: env.state.psych, of: PSYCH_TOTAL, target: env.state.psych >= PSYCH_TOTAL ? null : ph.psych || [1, 2]},
    read: REREAD.map(([id, name]) => ({id, name, week: !!w.read[id], done: !!env.state.reread[id], weeks: readWeeks(env.state, id)}))};
}
// 五個檢核點與狀態：done（都達到）、late（日期已過仍未達到）、todo（還沒到）。
function checkpoints(env) {
  const st = env.state, r = roundsInWeek(env.RD, env.questions || [], env.roundState, env.today);
  const rereadDone = RID.filter(id => st.reread[id]).length, papers = PID.filter(id => st.paper[id]).length;
  const items = [
    [{label: '心理學函授至少 10 堂', ok: st.psych >= 10, detail: st.psych + ' 堂'}, {label: '今日題組落後不到一週的份量', ok: !!r && r.behind < r.perDay * 6, detail: r ? '落後 ' + r.behind + ' 題' : '讀不到'}],
    [{label: '心理學函授至少 20 堂', ok: st.psych >= 20, detail: st.psych + ' 堂'}, {label: '四科講義各讀了至少 6 週（約三分之一）', ok: RID.every(id => st.reread[id] || readWeeks(st, id) >= 6), detail: REREAD.map(([id, n]) => n + ' ' + (st.reread[id] ? '讀完' : readWeeks(st, id) + ' 週')).join('、')}],
    [{label: '心理學函授 34 堂上完', ok: st.psych >= PSYCH_TOTAL, detail: st.psych + '／' + PSYCH_TOTAL + ' 堂'}, {label: '今日題組第 1 輪過半', ok: !!r && (r.round > 1 || r.finished || r.roundDone * 2 >= r.roundTotal), detail: r ? (r.round > 1 || r.finished ? '第 1 輪已完成' : r.roundDone + '／' + r.roundTotal) : '讀不到'}],
    [{label: '四科講義重讀完成', ok: rereadDone === RID.length, detail: rereadDone + '／' + RID.length + ' 科'}, {label: '一週完整寫題至少 6 題', ok: writesInWeek(env.study30, env.scoreStore, env.today < '2027-04-30' ? env.today : '2027-04-30') >= 6, detail: '該週 ' + writesInWeek(env.study30, env.scoreStore, env.today < '2027-04-30' ? env.today : '2027-04-30') + ' 題'}],
    [{label: '六科各做過一次整卷限時', ok: papers === PID.length, detail: papers + '／' + PID.length + ' 科'}]
  ];
  return CHECKPOINTS.map((c, i) => { const ok = items[i].every(x => x.ok); return {date: c.date, fallback: c.fallback, items: items[i], status: ok ? 'done' : env.today > c.date ? 'late' : 'todo', days: diffDays(c.date, env.today)}; });
}
// 今日清單用的一行摘要。
function summary(state, today) {
  const ph = phaseOf(today), next = CHECKPOINTS.find(c => c.date >= today);
  return {phase: ph.name, week: weekNo(today), started: today >= START, psych: state.psych, psychTotal: PSYCH_TOTAL, next: next ? next.date : null};
}

window.LawScoringStudyPlan = {KEY, START, EXAM_GUESS, PSYCH_TOTAL, PHASES, REREAD, PAPERS, CHECKPOINTS, monday, weekNo, phaseOf, examDate, diffDays, normalize, pack, bumpPsych, setRead, setReread, setPaper, readWeeks, writesInWeek, roundsInWeek, weekStats, checkpoints, summary,
  read() { try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalize(null); } }};
if (typeof document === 'undefined' || !document.getElementById('plan-root')) return;

/* ====================== 畫面 ====================== */
const DATA = window.LawScoringData, RD = window.LawScoringRounds;
const $ = id => document.getElementById(id);
function el(tag, attrs, text) { const n = document.createElement(tag); for (const k in (attrs || {})) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; }
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
let today = ymd(new Date()), state = window.LawScoringStudyPlan.read();
function save(next, msg) {
  try { localStorage.setItem(KEY, JSON.stringify(pack(next))); } catch (e) { $('pl-status').textContent = '目前瀏覽器無法保存，這次的更動沒有記錄。'; render(); return; }
  state = next; $('pl-status').textContent = msg || '已記錄。'; render();
}
function env() { return {state, today, RD, questions: DATA ? DATA.questions : [], roundState: RD ? RD.read() : null, study30: readJSON(STUDY30_KEY), scoreStore: readJSON(SCORE_KEY)}; }
function row(host, title, value, cls) { const li = el('li', cls ? {class: cls} : null); li.appendChild(el('strong', null, title)); li.appendChild(el('span', {class: 'pl-val'}, value)); host.appendChild(li); return li; }
function check(id, label, on, fn) { const l = el('label', {class: 'pl-check'}), c = el('input', {type: 'checkbox', id}); c.checked = on; c.addEventListener('change', () => fn(c.checked)); l.appendChild(c); l.appendChild(el('span', null, label)); return l; }

function renderHead(s) {
  const ex = examDate(readJSON(EXAM_KEY)), left = diffDays(ex.date, today), cps = checkpoints(env()), next = cps.find(c => c.days >= 0);
  $('pl-phase').textContent = today < START ? s.phase.name + '期・' + fmtDay(START) + ' 開始' : s.phase.name + '期・第 ' + s.week + ' 週';
  $('pl-goal').textContent = s.phase.goal;
  const chips = $('pl-chips'); chips.textContent = '';
  chips.appendChild(el('span', {class: 'rd-chip'}, left >= 0 ? '距離考試 ' + left + ' 天' : '考試已過 ' + (-left) + ' 天'));
  if (next) chips.appendChild(el('span', {class: 'rd-chip'}, '下個檢核點 ' + fmtDay(next.date) + '（' + next.days + ' 天後）'));
  chips.appendChild(el('span', {class: 'rd-chip'}, '本週 ' + fmtDay(s.monday) + '–' + fmtDay(s.sunday)));
  $('pl-exam-note').textContent = ex.set ? '考試日期取自首頁倒數的設定（' + ex.date + '）。' : '考試日期還沒設定，先以 ' + EXAM_GUESS + ' 估算；公告後到首頁的倒數設定填入實際日期。';
}
function renderWeek(s) {
  const ul = $('pl-week'); ul.textContent = '';
  const r = s.rounds;
  if (r) {
    const li = row(ul, '今日題組', r.finished ? '五輪都跑完了' : '本週 ' + r.done + '／' + r.target + ' 題' + (r.behind ? '・落後 ' + r.behind + ' 題' : ''), r.behind ? 'is-late' : '');
    li.appendChild(el('a', {href: 'rounds.html'}, '去練'));
    row(ul, '模擬題', '本週 ' + r.mock + '／7 題');
  } else row(ul, '今日題組', '讀不到紀錄');
  const w = row(ul, '完整寫題', '本週 ' + s.write.done + ' 題（目標 ' + s.write.target + ' 題）');
  w.appendChild(el('a', {href: '../professional/'}, '每日30分鐘'));
  // 心理學函授：加減按鈕
  const li = el('li', {class: 'pl-psych'}); li.appendChild(el('strong', null, '心理學函授'));
  li.appendChild(el('span', {class: 'pl-val', id: 'pl-psych-val'}, '已上 ' + s.psych.total + '／' + s.psych.of + ' 堂・本週 ' + s.psych.week + ' 堂' + (s.psych.target ? '（目標 ' + s.psych.target[0] + ' 到 ' + s.psych.target[1] + ' 堂）' : '')));
  const box = el('span', {class: 'pl-step', role: 'group', 'aria-label': '心理學函授已上堂數'});
  const minus = el('button', {class: 'btn ghost', type: 'button', id: 'pl-psych-minus', 'aria-label': '少一堂'}, '−1'), plus = el('button', {class: 'btn primary', type: 'button', id: 'pl-psych-plus', 'aria-label': '多一堂'}, '＋1 堂');
  minus.disabled = s.psych.total <= 0; plus.disabled = s.psych.total >= s.psych.of;
  minus.onclick = () => save(bumpPsych(state, today, -1), '心理學改為 ' + Math.max(0, state.psych - 1) + ' 堂。');
  plus.onclick = () => save(bumpPsych(state, today, 1), '心理學記到 ' + Math.min(PSYCH_TOTAL, state.psych + 1) + ' 堂。');
  box.appendChild(minus); box.appendChild(plus); li.appendChild(box); ul.appendChild(li);
  // 四科講義重讀：本週打勾與整科讀完
  const rr = el('li', {class: 'pl-reread'}); rr.appendChild(el('strong', null, '四科講義重讀')); rr.appendChild(el('span', {class: 'pl-val'}, '本週 ' + s.read.filter(x => x.week || x.done).length + '／' + s.read.length + ' 科'));
  const tb = el('div', {class: 'pl-grid'});
  s.read.forEach(x => {
    const g = el('div', {class: 'pl-grid-row'}); g.appendChild(el('span', {class: 'pl-sub'}, x.name + (x.weeks ? '（已 ' + x.weeks + ' 週）' : '')));
    g.appendChild(check('pl-read-' + x.id, '本週讀了', x.week, on => save(setRead(state, today, x.id, on))));
    g.appendChild(check('pl-done-' + x.id, '整科讀完', x.done, on => save(setReread(state, x.id, on))));
    tb.appendChild(g);
  });
  rr.appendChild(tb); ul.appendChild(rr);
}
function renderPhases(s) {
  const host = $('pl-phases'); if (host.dataset.phase === String(s.phase.n)) return; // 階段沒變就不重畫，保留展開狀態
  host.dataset.phase = String(s.phase.n); host.textContent = '';
  PHASES.forEach(p => {
    const now = p.n === s.phase.n, det = el('details', {class: 'pl-phase' + (now ? ' is-now' : '')}); if (now) det.open = true;
    det.appendChild(el('summary', null, p.name + '期（' + fmtDay(p.start) + '–' + (p.end ? fmtDay(p.end) : '考前') + '）' + (now ? '・現在' : '')));
    const body = el('div', {class: 'pl-phase-body'}); body.appendChild(el('p', null, p.goal));
    const dl = el('dl'); p.slots.forEach(([t, d]) => { dl.appendChild(el('dt', null, t)); dl.appendChild(el('dd', null, d)); }); body.appendChild(dl);
    const ul = el('ul', {class: 'small muted'}); p.notes.forEach(n => ul.appendChild(el('li', null, n))); body.appendChild(ul);
    det.appendChild(body); host.appendChild(det);
  });
}
function renderCheckpoints() {
  const host = $('pl-cps'); host.textContent = '';
  const LABEL = {done: '已達到', late: '未達到', todo: '進行中'};
  checkpoints(env()).forEach((c, i) => {
    const li = el('li', {class: 'pl-cp is-' + c.status});
    const head = el('p', {class: 'pl-cp-head'}); head.appendChild(el('strong', null, fmtDay(c.date))); head.appendChild(el('span', {class: 'pl-badge'}, LABEL[c.status] + (c.status === 'todo' && c.days >= 0 ? '・還有 ' + c.days + ' 天' : ''))); li.appendChild(head);
    const ul = el('ul'); c.items.forEach(x => ul.appendChild(el('li', {class: x.ok ? 'is-ok' : ''}, (x.ok ? '✓ ' : '・') + x.label + '（' + x.detail + '）'))); li.appendChild(ul);
    if (i === CHECKPOINTS.length - 1) { const g = el('div', {class: 'pl-papers', role: 'group', 'aria-label': '已做過整卷限時的科目'}); PAPERS.forEach(([id, name]) => g.appendChild(check('pl-paper-' + id, name, !!state.paper[id], on => save(setPaper(state, id, on))))); li.appendChild(g); }
    if (c.status === 'late') li.appendChild(el('p', {class: 'pl-fallback'}, '調整：' + c.fallback));
    else if (c.status === 'todo') li.appendChild(el('p', {class: 'small muted'}, '沒達到時：' + c.fallback));
    host.appendChild(li);
  });
}
function render() {
  // 重畫會換掉打勾框與按鈕，先記住焦點，畫完放回去。
  const focus = document.activeElement && document.activeElement.id;
  const s = weekStats(env());
  renderHead(s); renderWeek(s); renderPhases(s); renderCheckpoints();
  if (focus && $(focus) && !$(focus).disabled) $(focus).focus({preventScroll: true});
}
$('pl-load').hidden = true; $('pl-body').hidden = false;
render();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { today = ymd(new Date()); state = window.LawScoringStudyPlan.read(); render(); } });
window.addEventListener('storage', e => { if (e.key === KEY || e.key === (RD && RD.KEY) || e.key === STUDY30_KEY || e.key === SCORE_KEY) { state = window.LawScoringStudyPlan.read(); render(); } });
})();
