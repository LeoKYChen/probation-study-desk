/* 今日題組：考古題輪次練習加每天 1 題模擬題，一頁做完。
   輪次：觀護人 190 題跑 5 輪、相關類科 363 題跑 3 輪，每輪做法由深到淺。每天題數可自己設；週一到週六出題，週日休息（可加開）。
   沒做的題不累積成欠債：頁面只依目前的每天題數，從今天往後推算各輪的預計完成日，超過考試日期就提醒。
   紀錄存在 lawScoring.rounds.v1（已納入完整備份）；上次位置、字級與當天加開題數存在 lawScoring.rounds.pos.v1（單機設定，不備份）。
   申論評分參考自評（lawScoring.v2）與每日模擬題的紀錄只讀不寫。 */
(function () {
'use strict';
const KEY = 'lawScoring.rounds.v1', POS_KEY = 'lawScoring.rounds.pos.v1';
const DAILY_KEY = 'probation-daily-github:records:v1';
const DEFAULT_START = '2026-11-16';
const EXAM_KEY = 'psd-home-exam-countdown-v1', EXAM_GUESS = '2027-08-14', PER_DAY_MAX = 60;
// 每輪每天 60 分鐘：每題分鐘數 × 每天題數 = 60。
const ROUNDS = [
  {n: 1, scope: 'all', min: 12, perDay: 5, depth: 'full', how: '拆題、列骨架，再對照評分參考'},
  {n: 2, scope: 'all', min: 6, perDay: 10, depth: 'mid', how: '蓋住答案，回想骨架'},
  {n: 3, scope: 'all', min: 4, perDay: 15, depth: 'brief', how: '只講爭點與結論'},
  {n: 4, scope: 'guan', min: 3, perDay: 20, depth: 'brief', how: '快速過一遍'},
  {n: 5, scope: 'guan', min: 2, perDay: 30, depth: 'brief', how: '掃過，卡住才停'}
];
const RATES = ['again', 'partial', 'good'];
const RATE_LABEL = {again: '沒抓到', partial: '抓到一半', good: '抓到了'};
const SETTINGS = '__settings', MOCK = 'mock:';
const NOTE_MAX = 2000, MOCK_MIN = 10;
const FONT_LABELS = ['較小', '標準', '較大', '最大'];

/* ---------- 日期 ---------- */
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseDay(day) { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); }
function validDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseDay(s)) === s; }
function addDays(day, n) { const d = parseDay(day); d.setDate(d.getDate() + n); return ymd(d); }
function isRest(day) { return parseDay(day).getDay() === 0; } // 週日：休息日，不排題（可加開）
function fmtDay(day) { const [, m, d] = day.split('-'); return Number(m) + '/' + Number(d); }

/* ---------- 題目順序 ---------- */
const isGuan = q => q.examType === '觀護人';
const maxRound = q => isGuan(q) ? 5 : 3;
// 一輪的出題順序：觀護人的題先出，再出相關類科；各科輪流、一次一題，所以每天的題組各科平均；同一科裡年度新的在前。
function roundOrder(questions, round) {
  const tiers = round.scope === 'guan' ? [questions.filter(isGuan)] : [questions.filter(isGuan), questions.filter(q => !isGuan(q))];
  const out = [];
  for (const tier of tiers) {
    const groups = new Map();
    for (const q of tier) { const k = q.examType + '／' + q.subject; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    const queues = [...groups.values()].map(list => list.slice().sort((a, b) => b.year - a.year || a.no - b.no));
    let left = tier.length;
    while (left > 0) for (const list of queues) if (list.length) { out.push(list.shift().id); left--; }
  }
  return out;
}
// 全部題次，依序排成一列：第 1 輪全部、第 2 輪全部……第 5 輪觀護人題。
function slots(questions) {
  const out = [];
  for (const round of ROUNDS) for (const id of roundOrder(questions, round)) out.push({r: round.n, id});
  return out;
}
function sizes(questions) { const g = questions.filter(isGuan).length; return ROUNDS.map(r => r.scope === 'guan' ? g : questions.length); }

/* ---------- 每天題數：可自己設（每輪 1 到 60 題），沒設時用預設值 ---------- */
function okPerDay(n) { return Number.isInteger(n) && n >= 1 && n <= PER_DAY_MAX; }
function perDayOf(state, n) { const a = state && state.settings && state.settings.perDay; return a && okPerDay(a[n - 1]) ? a[n - 1] : ROUNDS[n - 1].perDay; }
function customPerDay(state) { const a = state.settings.perDay; return !!a && a.some((n, i) => n !== ROUNDS[i].perDay); }
// 設定每天題數；list 與預設相同時清掉設定。回傳新的紀錄，不改動原本的。
function setPerDay(state, list) {
  if (!Array.isArray(list) || list.length !== ROUNDS.length || !list.every(okPerDay)) return state;
  const settings = {start: state.settings.start};
  if (list.some((n, i) => n !== ROUNDS[i].perDay)) settings.perDay = list.slice();
  return {settings, items: state.items};
}
function examDate(raw) { return isObj(raw) && validDay(raw.date) ? {date: raw.date, set: true} : {date: EXAM_GUESS, set: false}; }

/* ---------- 紀錄：id → {done:[{d,r,s}], notes:{輪次:骨架}}；模擬題的 id 加 mock: 前綴；起算日在 __settings ---------- */
function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function entry(x) { return isObj(x) && validDay(x.d) && RATES.includes(x.r) ? {d: x.d, r: x.r, s: Number.isFinite(x.s) && x.s >= 0 ? Math.round(x.s) : 0} : null; }
function normalize(raw) {
  const out = {settings: {start: DEFAULT_START}, items: {}};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k === SETTINGS) {
      if (isObj(v) && validDay(v.start)) out.settings.start = v.start;
      if (isObj(v) && Array.isArray(v.perDay) && v.perDay.length === ROUNDS.length && v.perDay.every(okPerDay)) out.settings.perDay = v.perDay.slice();
      continue;
    }
    if (!isObj(v)) continue;
    const done = Array.isArray(v.done) ? v.done.map(entry).filter(Boolean) : [];
    const notes = {};
    if (isObj(v.notes)) for (const [r, t] of Object.entries(v.notes)) if (/^[1-5]$/.test(r) && typeof t === 'string' && t) notes[r] = t.slice(0, NOTE_MAX);
    if (done.length || Object.keys(notes).length) out.items[k] = {done, notes};
  }
  return out;
}
function pack(state) {
  const out = {}, set = {};
  if (state.settings.start !== DEFAULT_START) set.start = state.settings.start;
  if (customPerDay(state)) set.perDay = state.settings.perDay.slice();
  if (Object.keys(set).length) out[SETTINGS] = set;
  for (const [k, v] of Object.entries(state.items)) {
    if (!v.done.length && !Object.keys(v.notes).length) continue;
    out[k] = Object.keys(v.notes).length ? {done: v.done, notes: v.notes} : {done: v.done};
  }
  return out;
}
// 今天做過的題（依出題順序，模擬題在最後）；r 是今天那一次所屬的輪次。
function doneToday(questions, state, today) {
  const out = [], hit = id => { const d = state.items[id] ? state.items[id].done : []; for (let i = d.length - 1; i >= 0; i--) if (d[i].d === today) return {key: id, r: i + 1, rate: d[i].r}; return null; };
  const seen = new Set();
  for (const s of slots(questions)) { if (seen.has(s.id)) continue; seen.add(s.id); const h = hit(s.id); if (h) out.push(h); }
  for (const k of Object.keys(state.items)) if (k.startsWith(MOCK)) { const h = hit(k); if (h) out.push(Object.assign(h, {r: 1})); }
  return out;
}
// 重練：只更新今天那一筆的自評並累加秒數，不多算一次。
function rerate(state, key, day, result, secs) {
  const old = state.items[key]; if (!old) return state;
  let i = old.done.length - 1; while (i >= 0 && old.done[i].d !== day) i--;
  if (i < 0) return state;
  const done = old.done.slice(); done[i] = {d: day, r: result, s: done[i].s + Math.max(0, Math.round(secs || 0))};
  return {settings: state.settings, items: Object.assign({}, state.items, {[key]: {done, notes: old.notes}})};
}
// 清除：只清某一天的完成紀錄（骨架保留），或全部清除（起算日保留）。
function clearDay(state, day) {
  const items = {};
  for (const [k, v] of Object.entries(state.items)) items[k] = {done: v.done.filter(x => x.d !== day), notes: v.notes};
  return {settings: state.settings, items};
}
function clearAll(state) { return {settings: state.settings, items: {}}; }
const countOf = (state, id) => state.items[id] ? state.items[id].done.length : 0;
// 記一次完成；回傳新的紀錄，不改動原本的。
function record(state, key, result, day, secs) {
  const old = state.items[key] || {done: [], notes: {}};
  const item = {done: old.done.concat([{d: day, r: result, s: Math.max(0, Math.round(secs || 0))}]), notes: old.notes};
  return {settings: state.settings, items: Object.assign({}, state.items, {[key]: item})};
}
function setNote(state, key, round, text) {
  const old = state.items[key] || {done: [], notes: {}}, notes = Object.assign({}, old.notes);
  text = String(text || '').slice(0, NOTE_MAX);
  if (text) notes[round] = text; else delete notes[round];
  return {settings: state.settings, items: Object.assign({}, state.items, {[key]: {done: old.done, notes}})};
}

/* ---------- 預計完成日 ---------- */
// 照目前的每天題數，從今天往後推算各輪的完成日。已完成的輪次為 'done'。
// 週日不排題；今天已做的題先扣掉今天的份量。沒做的日子不會變成欠的題，只會讓完成日往後移。
function forecast(questions, state, today) {
  const rem = ROUNDS.map(() => 0);
  for (const s of slots(questions)) if (countOf(state, s.id) < s.r) rem[s.r - 1]++;
  let todayDone = 0;
  for (const q of questions) if (state.items[q.id]) todayDone += state.items[q.id].done.filter(x => x.d === today).length;
  const ends = rem.map(n => n ? null : 'done');
  let ri = rem.findIndex(n => n > 0);
  for (let d = today, guard = 0; ri >= 0 && ri < ROUNDS.length && guard < 4000; d = addDays(d, 1), guard++) {
    if (isRest(d)) continue;
    let cap = perDayOf(state, ri + 1);
    if (d === today) cap = Math.max(0, cap - todayDone);
    rem[ri] -= Math.min(cap, rem[ri]);
    if (!rem[ri]) { ends[ri] = d; ri++; while (ri < ROUNDS.length && ends[ri] === 'done') ri++; }
  }
  const last = ends.filter(x => x && x !== 'done').pop() || null;
  return {ends, finish: last};
}
// 今天的題組與進度。extra：今天加開的題數；exam：考試日期（可省略）。純計算，不寫入。
function plan(questions, state, today, extra, exam) {
  const all = slots(questions);
  const doneToday = id => !!state.items[id] && state.items[id].done.some(x => x.d === today);
  let doneTotal = 0, todayDone = 0;
  for (const q of questions) {
    doneTotal += Math.min(countOf(state, q.id), maxRound(q));
    if (state.items[q.id]) todayDone += state.items[q.id].done.filter(x => x.d === today).length;
  }
  const pending = all.filter(s => countOf(state, s.id) < s.r);
  const round = pending.length ? pending[0].r : ROUNDS.length, def = ROUNDS[round - 1], perDay = perDayOf(state, round);
  const inScope = questions.filter(q => def.scope !== 'guan' || isGuan(q));
  const roundDone = inScope.filter(q => countOf(state, q.id) >= round).length;
  const tally = {again: 0, partial: 0, good: 0};
  for (const q of inScope) { const e = state.items[q.id] && state.items[q.id].done[round - 1]; if (e) tally[e.r]++; }
  const rest = isRest(today);
  const base = !pending.length || rest ? 0 : perDay;
  const quota = base + Math.max(0, extra || 0);
  const queue = [], seen = new Set();
  for (const s of pending) {
    if (queue.length >= Math.max(0, quota - todayDone)) break;
    if (seen.has(s.id) || doneToday(s.id)) continue; // 同一題一天只出一次
    seen.add(s.id); queue.push(s);
  }
  const f = forecast(questions, state, today), examDay = validDay(exam) ? exam : EXAM_GUESS;
  return {round, roundDone, roundTotal: inScope.length, tally, doneTotal, total: all.length, perDay, base, quota, todayDone, queue,
    rest, finished: !pending.length, ends: f.ends, finish: f.finish, exam: examDay, late: !!f.finish && f.finish > examDay, custom: customPerDay(state)};
}

/* ---------- 模擬題：每天 1 題 ---------- */
function mockDoneToday(state, today) { return Object.entries(state.items).some(([k, v]) => k.startsWith(MOCK) && v.done.some(x => x.d === today)); }
// 選今天的模擬題：當天已選過就沿用；否則選最新、沒有標示待訂正、這裡沒練過、每日模擬題頁也沒寫過的一題。
function pickMock(list, state, daily, kept) {
  if (!Array.isArray(list)) return null;
  if (kept) { const q = list.find(x => x.id === kept); if (q) return q; }
  const text = v => typeof v === 'string' && !!v.trim();
  const written = r => isObj(r) && (text(r.answer) || (isObj(r.essayDrafts) && Object.values(r.essayDrafts).some(text)));
  const cand = list.filter(q => q.reviewStatus !== '待訂正' && !q.qualityStatus && !countOf(state, MOCK + q.id) && !written(isObj(daily) ? daily[q.id] : null));
  return cand.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

// 單機設定：上次位置、當天跳過與加開、字級。換日後只留字級。
function normPos(s, today) {
  s = isObj(s) ? s : {};
  const font = Number.isInteger(s.font) && s.font >= 0 && s.font < FONT_LABELS.length ? s.font : 1;
  if (s.d !== today) return {d: today, id: '', stage: 'front', skipped: [], extra: 0, mock: '', secs: {}, font};
  const secs = {};
  if (isObj(s.secs)) for (const [k, v] of Object.entries(s.secs)) if (Number.isFinite(v) && v >= 0) secs[k] = Math.round(v);
  return {d: today, id: typeof s.id === 'string' ? s.id : '', stage: s.stage === 'back' ? 'back' : 'front',
    skipped: Array.isArray(s.skipped) ? s.skipped.filter(x => typeof x === 'string').slice(0, 200) : [],
    extra: Number.isInteger(s.extra) && s.extra > 0 ? Math.min(s.extra, 600) : 0, mock: typeof s.mock === 'string' ? s.mock : '', secs, font};
}
// 今天的順序：先跳過的排到最後。
function arrange(list, skipped) {
  const skip = new Set(skipped || []);
  return list.filter(x => !skip.has(x.key)).concat((skipped || []).map(k => list.find(x => x.key === k)).filter(Boolean));
}

window.LawScoringRounds = {KEY, POS_KEY, EXAM_KEY, EXAM_GUESS, DEFAULT_START, ROUNDS, MOCK, SETTINGS, isGuan, maxRound, roundOrder, slots, sizes, normalize, pack, countOf, record, setNote,
  perDayOf, setPerDay, customPerDay, examDate, forecast, plan, doneToday, rerate, clearDay, clearAll, mockDoneToday, pickMock, normPos, arrange, isRest, addDays, validDay,
  read() { try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalize(null); } }};
if (typeof document === 'undefined' || !document.getElementById('rounds-root')) return;

/* ====================== 畫面 ====================== */
const DATA = window.LawScoringData, LS = window.LawScoring, M = window.PracticeModel;
const $ = id => document.getElementById(id);
function el(tag, attrs, text) { const n = document.createElement(tag); for (const k in (attrs || {})) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; }
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
// 只把 **粗體** 與 [文字](https 連結) 轉成節點，其餘一律當文字。
function inline(parent, text) {
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g; let i = 0, m; text = String(text);
  while ((m = re.exec(text))) {
    if (m.index > i) parent.appendChild(document.createTextNode(text.slice(i, m.index)));
    parent.appendChild(m[1] != null ? el('strong', null, m[1]) : el('a', {href: m[3], target: '_blank', rel: 'noopener noreferrer'}, m[2]));
    i = re.lastIndex;
  }
  if (i < text.length) parent.appendChild(document.createTextNode(text.slice(i)));
  return parent;
}
function prose(host, text) {
  String(text || '').replace(/\r/g, '').split(/\n{2,}/).forEach(par => {
    par = par.trim(); if (!par) return;
    const p = el('p'); par.split('\n').forEach((line, i) => { if (i) p.appendChild(el('br')); inline(p, line); }); host.appendChild(p);
  });
}
function blocks(host, list) {
  (list || []).forEach(b => {
    if (b.t === 'p') { host.appendChild(inline(el('p'), b.text)); return; }
    const ul = el(b.t === 'ol' ? 'ol' : 'ul'); (b.items || []).forEach(x => ul.appendChild(inline(el('li'), typeof x === 'string' ? x : x.text))); host.appendChild(ul);
  });
}
function section(host, title) { const s = el('section', {class: 'rd-sec'}); s.appendChild(el('h3', null, title)); host.appendChild(s); return s; }
function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

const root = $('rounds-root');
if (!DATA || !LS) { $('rd-load').textContent = '題庫沒有載入，請確認網路後重新整理。'; return; }
$('rd-load').hidden = true;
const byId = new Map(DATA.questions.map(q => [q.id, q]));
let today = ymd(new Date());
let state = window.LawScoringRounds.read();
let pos = normPos(readJSON(POS_KEY), today);
let mocks = null;      // null：讀取中；false：讀不到；陣列：已讀到
let current = null, stage = 'front', depthOverride = false, undo = null, redo = null; // redo：正在重練的今天做過的題
let clockBase = 0, clockStart = 0, noteTimer = null, noteFor = '';

function savePos() { write(POS_KEY, pos); }
function saveState(next) { if (!write(KEY, pack(next))) return false; state = next; return true; }
function status(t) { $('rd-status').textContent = t || ''; }

// 命題者視角資料按需載入；載入後若還停在同一題就重畫。
const designLoading = {};
function ensureDesign(q) {
  const f = LS.designFile(q); if (!f || LS.design(q) || designLoading[f]) return;
  designLoading[f] = true;
  const sc = document.createElement('script'); sc.src = 'exam-design/' + f;
  sc.onload = () => { if (current && current.kind === 'q' && LS.designFile(current.q) === f) { flushNote(); show(false); } };
  sc.onerror = () => { designLoading[f] = false; };
  document.head.appendChild(sc);
}

function loadMocks() {
  if (!M || typeof fetch !== 'function') { mocks = false; return; }
  fetch('../daily-simulation/questions.json').then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(d => { mocks = M.dataset(d).questions; }).catch(() => { mocks = false; }).then(() => render());
}

function todayItems() {
  const p = plan(DATA.questions, state, today, pos.extra, examDate(readJSON(EXAM_KEY)).date);
  const list = p.queue.map(s => ({key: s.id, kind: 'q', r: s.r, q: byId.get(s.id)}));
  let mockState = 'done';
  if (!mockDoneToday(state, today)) {
    if (mocks === null) mockState = 'loading';
    else if (mocks === false) mockState = 'fail';
    else {
      const m = pickMock(mocks, state, readJSON(DAILY_KEY), pos.mock);
      if (m) { mockState = 'todo'; if (pos.mock !== m.id) { pos.mock = m.id; savePos(); } list.push({key: MOCK + m.id, kind: 'mock', r: 1, m}); }
      else mockState = 'none';
    }
  }
  return {p, list: arrange(list, pos.skipped), mockState};
}

function renderProgress(p, mockState) {
  const def = ROUNDS[p.round - 1];
  $('rd-round').textContent = p.finished ? '五輪都跑完了' : '第 ' + p.round + ' 輪';
  $('rd-count').textContent = p.finished ? p.total + ' 題次' : p.roundDone + '／' + p.roundTotal;
  $('rd-how').textContent = p.finished ? '' : def.how + '・每題約 ' + def.min + ' 分鐘・每天 ' + p.perDay + ' 題約 ' + p.perDay * def.min + ' 分鐘';
  const bar = $('rd-bar'), pct = p.finished ? 100 : Math.round(p.roundDone / p.roundTotal * 100);
  bar.setAttribute('aria-valuenow', String(pct)); bar.setAttribute('aria-valuetext', $('rd-round').textContent + ' ' + $('rd-count').textContent);
  $('rd-bar-fill').style.width = pct + '%';
  const chips = $('rd-chips'); chips.textContent = '';
  const chip = (text, cls) => chips.appendChild(el('span', {class: 'rd-chip' + (cls ? ' ' + cls : '')}, text));
  if (!p.finished) chip('今日 ' + Math.min(p.todayDone, p.quota) + '／' + p.quota + (p.todayDone > p.quota ? '（多練 ' + (p.todayDone - p.quota) + '）' : ''));
  chip('模擬題 ' + ({done: '1／1', todo: '0／1', loading: '讀取中', fail: '讀不到', none: '沒有新題'})[mockState]);
  if (!p.finished) {
    if (p.rest) chip('週日休息，想練可以加開');
    if (p.finish) chip((p.late ? '照目前題數，' + fmtDay(p.finish) + ' 才跑完，超過考期' : '照目前題數，預計 ' + fmtDay(p.finish) + ' 跑完'), p.late ? 'is-behind' : 'is-ahead');
  }
  const t = p.tally, any = t.again + t.partial + t.good;
  $('rd-tally').textContent = any && !p.finished ? '這一輪自評：抓到了 ' + t.good + '・抓到一半 ' + t.partial + '・沒抓到 ' + t.again : '';
}

function depthOf(item) { return depthOverride ? 'full' : ROUNDS[item.r - 1].depth; }
function minutesOf(item) { return item.kind === 'mock' ? MOCK_MIN : ROUNDS[item.r - 1].min; }

function renderFront(item) {
  const front = $('rd-front'); front.textContent = '';
  if (item.kind === 'q') {
    const q = item.q, last = state.items[q.id] && state.items[q.id].done[item.r - 2];
    $('rd-meta').textContent = '第 ' + item.r + ' 輪・' + q.exam;
    $('rd-title').textContent = q.subject + '・第 ' + q.no + ' 題（' + q.points + ' 分）';
    if (redo) front.appendChild(el('p', {class: 'rd-last'}, '重練今天做過的題：自評會更新今天這一筆，不會多算一輪。'));
    else if (last) front.appendChild(el('p', {class: 'rd-last'}, '上一輪：' + RATE_LABEL[last.r]));
    prose(front.appendChild(el('div', {class: 'rd-body'})), q.body);
    if (item.r === 1) {
      const d = LS.design(q);
      if (d && d.demands && d.demands.length) {
        const det = el('details', {class: 'rd-demands'}); det.appendChild(el('summary', null, '題幹要求（只依題幹整理，不含答案）'));
        blocks(det.appendChild(el('div', {class: 'rd-blocks'})), d.demands); front.appendChild(det);
      } else ensureDesign(q);
    }
  } else {
    const m = item.m;
    $('rd-meta').textContent = '模擬題・' + M.subject(m) + '・' + m.date;
    $('rd-title').textContent = '今天的模擬題';
    front.appendChild(el('p', {class: 'rd-last'}, (redo ? '重練今天做過的題。' : '') + 'AI 產生的模擬題，內容待核對，不是考古題。'));
    prose(front.appendChild(el('div', {class: 'rd-body'})), M.displayQuestion(m));
  }
  const wantsNote = item.kind === 'mock' || item.r <= 2;
  $('rd-note-wrap').hidden = !wantsNote;
  if (wantsNote) {
    // 同一題重畫時不覆蓋正在打的字。
    if (noteFor !== item.key + '#' + item.r) { noteFor = item.key + '#' + item.r; $('rd-note').value = (state.items[item.key] && state.items[item.key].notes[item.r]) || ''; }
    $('rd-note-label').textContent = item.kind === 'mock' || item.r === 1 ? '骨架（選填）：只列爭點與作答順序，不寫內容。' : '骨架（選填）：不看答案，把想得起來的爭點與順序列出來。';
  }
}

function renderBack(item) {
  const back = $('rd-back'); back.textContent = '';
  if (item.kind === 'mock') {
    const m = item.m;
    prose(section(back, '爭點'), m.issues);
    prose(section(back, '參考架構'), m.outline);
    back.appendChild(el('a', {class: 'btn', href: '../daily-simulation/'}, '到每日模擬題完整作答'));
    return;
  }
  const q = item.q, depth = depthOf(item), d = LS.design(q);
  back.appendChild(el('p', {class: 'rd-qtitle'}, q.title));
  if (depth !== 'mid') back.appendChild(el('p', {class: 'rd-overview'}, q.overview));
  const prev = item.r > 1 && state.items[q.id] && state.items[q.id].notes[item.r - 1];
  if (prev) { const det = el('details', {class: 'rd-demands'}); det.appendChild(el('summary', null, '第 ' + (item.r - 1) + ' 輪你列的骨架')); det.appendChild(el('p', {class: 'rd-prev'}, prev)); back.appendChild(det); }
  if (depth !== 'brief') {
    const steps = LS.actionSteps(d);
    if (depth === 'full' && d && d.structure && d.structure.length) blocks(section(back, '命題結構'), d.structure);
    else if (steps.length) section(back, '作答動作').appendChild(el('p', null, steps.join(' → ')));
    else if (!d) ensureDesign(q);
  }
  const pts = section(back, depth === 'brief' ? '爭點' : '評分要點'), ul = el('ul', {class: 'rd-points'});
  let group = null;
  q.rows.forEach(row => {
    const li = el('li');
    if (row.group !== group) { group = row.group; li.appendChild(el('span', {class: 'rd-group'}, q.kind === 'case' ? group + '之刑事責任' : group)); }
    li.appendChild(el('strong', {class: 'rd-point'}, row.point));
    if (depth === 'full') li.appendChild(el('p', {class: 'rd-detail'}, row.detail));
    if (depth !== 'brief' && row.articles && row.articles.length) li.appendChild(el('p', {class: 'rd-src'}, row.articles.join('、')));
    if (depth !== 'brief' && row.disputed) li.appendChild(el('span', {class: 'tag'}, '學說實務爭議・需寫各說與個人見解'));
    ul.appendChild(li);
  });
  pts.appendChild(ul);
  if (depth === 'full' && q.organize && q.organize.length) { const s = section(back, '答題組織'), l = el('ul'); q.organize.forEach(x => l.appendChild(el('li', null, x))); s.appendChild(l); }
  if (depth !== 'brief' && q.pitfalls && q.pitfalls.length) { const s = section(back, '常見失分'), l = el('ul'); q.pitfalls.forEach(x => l.appendChild(el('li', null, x))); s.appendChild(l); }
  const row = el('div', {class: 'rd-back-actions'});
  if (depth !== 'full') { const b = el('button', {class: 'btn ghost', type: 'button'}, '看完整評分要點'); b.onclick = () => { depthOverride = true; show(false); }; row.appendChild(b); }
  row.appendChild(el('a', {class: 'btn', href: './#' + encodeURIComponent(q.id)}, '到申論評分參考完整作答'));
  back.appendChild(row);
  back.appendChild(el('p', {class: 'small muted'}, q.srcLabel + '。評分要點由 AI 草擬，非官方評分。'));
}

function tick() {
  if (!current) { $('rd-clock').textContent = ''; return; }
  const sec = clockBase + (clockStart ? (Date.now() - clockStart) / 1000 : 0), lim = minutesOf(current);
  $('rd-clock').textContent = mmss(sec) + '／約 ' + lim + ' 分';
  $('rd-clock').classList.toggle('is-over', sec > lim * 60);
}
function clockPause() { if (current && clockStart) { clockBase += (Date.now() - clockStart) / 1000; clockStart = 0; if (!redo) { pos.secs[current.key] = Math.round(clockBase); savePos(); } } }
function clockResume() { if (current && !clockStart && !document.hidden) clockStart = Date.now(); }

function flushNote() {
  if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
  if (!current || $('rd-note-wrap').hidden) return;
  const text = $('rd-note').value, saved = (state.items[current.key] && state.items[current.key].notes[current.r]) || '';
  if (text === saved) return;
  if (!saveState(setNote(state, current.key, current.r, text))) status('目前瀏覽器無法保存骨架，離開前請先複製。');
}

// 顯示目前這一題。focus：是否把焦點移到標題或答案。
function show(focus) {
  const item = current;
  renderFront(item);
  const back = stage === 'back';
  $('rd-back').hidden = !back; $('rd-card').classList.toggle('is-back', back);
  if (back) renderBack(item); else $('rd-back').textContent = '';
  $('rd-front-actions').hidden = back; $('rd-rate').hidden = !back;
  $('rd-skip').hidden = back || !!redo; $('rd-exit').hidden = !redo;
  tick();
  if (focus) { const t = back ? $('rd-back') : $('rd-title'); t.focus({preventScroll: true}); (back ? $('rd-back') : $('rd-card')).scrollIntoView({block: 'start'}); }
}

function renderEmpty(p, mockState) {
  const box = $('rd-empty'), title = $('rd-empty-title'), text = $('rd-empty-text'), acts = $('rd-empty-actions');
  acts.textContent = '';
  const more = (label, n) => { const b = el('button', {class: 'btn primary', type: 'button'}, label); b.onclick = () => { pos.extra += n; pos.skipped = []; savePos(); render(true); }; acts.appendChild(b); };
  const step = p.perDay;
  if (p.finished) { title.textContent = '五輪都跑完了'; text.textContent = '觀護人題 5 輪、相關類科 3 輪都完成了。之後可以用失分回想與二刷名單維持。'; }
  else if (p.rest && !p.todayDone && !p.quota) { title.textContent = '今天週日，休息'; text.textContent = '週日不排題。想多練可以加開，做了預計完成日會提前。'; more('加開 ' + step + ' 題', step); }
  else { title.textContent = '今天的題組做完了'; text.textContent = '要再練可以加開，做了預計完成日會提前。'; more('再練 ' + step + ' 題', step); }
  if (mockState === 'loading') text.textContent += ' 模擬題讀取中…';
  if (mockState === 'fail') text.textContent += ' 模擬題這次讀不到，連上網路後重新整理再試。';
  if (mockState === 'none') text.textContent += ' 模擬題目前沒有還沒練過的新題。';
  acts.appendChild(el('a', {class: 'btn', href: 'commute.html'}, '到通勤模式做回想卡'));
  box.hidden = false;
}

function render(focus) {
  clockPause();
  const {p, list, mockState} = todayItems();
  renderProgress(p, mockState);
  renderSchedule(p);
  renderDone();
  const keep = current && list.find(x => x.key === current.key);
  const next = redo || keep || list.find(x => x.key === pos.id) || list[0] || null;
  const changed = !current || !next || current !== next && (current.key !== next.key || !!redo);
  current = next;
  $('rd-undo').hidden = !undo || !!redo;
  if (redo) {
    $('rd-empty').hidden = true; $('rd-card').hidden = false;
    if (changed) { stage = 'front'; depthOverride = false; clockBase = 0; clockStart = 0; }
    $('rd-progress').textContent = '重練中';
    show(!!focus); clockResume(); return;
  }
  if (!current) {
    $('rd-card').hidden = true; $('rd-front-actions').hidden = true; $('rd-rate').hidden = true; $('rd-skip').hidden = true; $('rd-exit').hidden = true;
    $('rd-progress').textContent = ''; $('rd-clock').textContent = '';
    renderEmpty(p, mockState);
    if (focus) $('rd-empty-title').focus({preventScroll: true});
    return;
  }
  $('rd-empty').hidden = true; $('rd-card').hidden = false;
  if (changed) { stage = pos.id === current.key ? pos.stage : 'front'; depthOverride = false; clockBase = pos.secs[current.key] || 0; clockStart = 0; }
  pos.id = current.key; pos.stage = stage; savePos();
  const idx = list.findIndex(x => x.key === current.key);
  $('rd-progress').textContent = '剩 ' + list.length + ' 題' + (list.length > 1 ? '・下一題：' + (list[(idx + 1) % list.length].kind === 'mock' ? '模擬題' : list[(idx + 1) % list.length].q.subject) : '');
  show(!!focus);
  clockResume();
}

function reveal() { if (!current || stage === 'back') return; flushNote(); stage = 'back'; if (!redo) { pos.stage = stage; savePos(); } show(true); status(''); }
function rate(result) {
  if (!current || stage !== 'back') return;
  flushNote(); clockPause();
  if (redo) {
    const again = rerate(state, redo.key, today, result, Math.min(clockBase, minutesOf(redo) * 60 * 3));
    if (!saveState(again)) { status('目前瀏覽器無法保存，自評沒有更新。'); clockResume(); return; }
    redo = null; current = null; stage = 'front'; undo = null; render(true); status('已更新今天的自評：' + RATE_LABEL[result] + '。'); return;
  }
  const item = current, before = state, beforePos = JSON.parse(JSON.stringify(pos));
  const secs = Math.min(clockBase, minutesOf(item) * 60 * 3);
  if (!saveState(record(state, item.key, result, today, secs))) { status('目前瀏覽器無法保存，這一題沒有記錄。'); clockResume(); return; }
  undo = () => { if (!write(KEY, pack(before))) return false; state = before; pos = beforePos; pos.stage = 'back'; savePos(); return true; };
  pos.skipped = pos.skipped.filter(k => k !== item.key); delete pos.secs[item.key]; pos.id = ''; pos.stage = 'front';
  current = null; stage = 'front';
  render(true);
  status('記下了：' + RATE_LABEL[result] + '。');
}
function exitRedo() { if (!redo) return; flushNote(); clockPause(); redo = null; current = null; stage = 'front'; render(true); status('已回到今日題組。'); }
function startRedo(h) {
  flushNote(); clockPause();
  const item = h.key.startsWith(MOCK) ? (Array.isArray(mocks) && mocks.find(m => MOCK + m.id === h.key) ? {key: h.key, kind: 'mock', r: 1, m: mocks.find(m => MOCK + m.id === h.key)} : null) : (byId.has(h.key) ? {key: h.key, kind: 'q', r: h.r, q: byId.get(h.key)} : null);
  if (!item) { status('這一題現在讀不到，無法重練。'); return; }
  redo = item; current = null; stage = 'front'; status(''); render(true);
}
// 今天做過的題：列在題目卡下方，可以再練一次。
function renderDone() {
  const list = doneToday(DATA.questions, state, today), box = $('rd-done'), ul = $('rd-done-list');
  box.hidden = !list.length; ul.textContent = '';
  $('rd-done-summary').textContent = '今天做過的題（' + list.length + '）';
  list.forEach(h => {
    const mock = h.key.startsWith(MOCK), q = byId.get(h.key), li = el('li');
    li.appendChild(el('span', null, (mock ? '模擬題' : q ? q.subject + '・' + q.year + ' 年第 ' + q.no + ' 題' : h.key) + '（' + RATE_LABEL[h.rate] + '）'));
    const b = el('button', {class: 'btn ghost', type: 'button'}, '重練'); b.onclick = () => startRedo(h);
    if (redo && redo.key === h.key) { b.disabled = true; b.textContent = '重練中'; }
    li.appendChild(b); ul.appendChild(li);
  });
}
function skip() {
  if (!current || stage === 'back' || redo) return;
  flushNote(); clockPause();
  pos.skipped = pos.skipped.filter(k => k !== current.key).concat([current.key]); pos.id = ''; pos.stage = 'front';
  current = null; undo = null; render(true); status('先跳過，排到今天最後。');
}
function doUndo() {
  if (!undo || redo) return;
  flushNote(); clockPause();
  if (!undo()) { status('目前瀏覽器無法保存，沒有復原。'); return; }
  undo = null; current = null; stage = 'front'; noteFor = ''; render(true); status('已復原上一題，可以重新自評。');
}

/* ---------- 設定與進度表 ---------- */
function renderSchedule(p) {
  const body = $('rd-table-body'), editing = body.contains(document.activeElement);
  if (editing) return; // 正在輸入時不重畫，避免打到一半被蓋掉
  body.textContent = '';
  ROUNDS.forEach((r, i) => {
    const now = !p.finished && r.n === p.round, li = el('li', now ? {class: 'is-now', 'aria-current': 'step'} : null), end = p.ends[i];
    const n = perDayOf(state, r.n);
    li.appendChild(el('strong', null, '第 ' + r.n + ' 輪'));
    const late = end && end !== 'done' && end > p.exam;
    li.appendChild(el('span', late ? {class: 'rd-plan-late'} : null, (r.scope === 'guan' ? '觀護人題' : '全部') + '・' + (end === 'done' ? '已完成' : end ? '預計 ' + fmtDay(end) + ' 完成' + (late ? '（超過考期）' : '') : '—')));
    const lab = el('label', {class: 'rd-per', for: 'rd-per-' + r.n}); lab.appendChild(document.createTextNode('每天'));
    const inp = el('input', {type: 'number', id: 'rd-per-' + r.n, min: '1', max: String(PER_DAY_MAX), step: '1', inputmode: 'numeric', required: ''}); inp.value = String(n);
    lab.appendChild(inp); lab.appendChild(document.createTextNode('題（約 ' + n * r.min + ' 分）')); li.appendChild(lab);
    li.appendChild(el('span', {class: 'rd-plan-how'}, r.how + '（每題約 ' + r.min + ' 分）'));
    body.appendChild(li);
  });
  $('rd-per-reset').hidden = !customPerDay(state);
  const ex = examDate(readJSON(EXAM_KEY));
  $('rd-exam-note').textContent = ex.set ? '考試日期取自首頁倒數的設定（' + ex.date + '）。' : '考試日期還沒設定，先以 ' + EXAM_GUESS + ' 估算；公告後到首頁的倒數設定填入實際日期。';
}
function applyFont() { for (let i = 0; i < FONT_LABELS.length; i++) document.body.classList.toggle('cm-f' + i, pos.font === i); $('rd-font-label').textContent = FONT_LABELS[pos.font]; $('rd-font-down').disabled = pos.font === 0; $('rd-font-up').disabled = pos.font === FONT_LABELS.length - 1; }

// 清除這一頁的紀錄（只動今日題組自己的紀錄）。先問範圍，再執行。
function mkClear() { const b = el('button', {class: 'btn danger', type: 'button', id: 'rd-clear'}, '清除今日題組紀錄'); b.onclick = clearPrompt; return b; }
function clearPrompt() {
  const area = $('rd-clear-area'), msg = $('rd-clear-status'), back = () => { area.textContent = ''; area.appendChild(mkClear()); };
  const n = Object.values(state.items).reduce((a, v) => a + v.done.length, 0), t = doneToday(DATA.questions, state, today).length;
  area.textContent = ''; area.appendChild(el('span', null, '要清除哪些紀錄？目前共 ' + n + ' 筆，其中今天 ' + t + ' 筆。其他頁面的紀錄不受影響。'));
  const day = el('button', {class: 'btn danger', type: 'button'}, '只清今天的'), all = el('button', {class: 'btn danger', type: 'button'}, '全部清除，回到第 1 輪'), no = el('button', {class: 'btn ghost', type: 'button'}, '取消');
  const run = (next, text) => {
    flushNote(); clockPause();
    if (!saveState(next)) { msg.textContent = '目前瀏覽器無法保存，沒有清除。'; back(); return; }
    pos = normPos({font: pos.font}, today); savePos(); redo = null; undo = null; current = null; stage = 'front'; noteFor = '';
    back(); render(); msg.textContent = text;
  };
  day.onclick = () => run(clearDay(state, today), '已清除今天的完成紀錄；骨架與之前的紀錄保留。');
  all.onclick = () => run(clearAll(state), '已清除今日題組的全部紀錄，回到第 1 輪；起算日與字級保留。');
  no.onclick = () => { back(); msg.textContent = ''; };
  if (t) area.appendChild(day); if (n || Object.keys(state.items).length) area.appendChild(all); area.appendChild(no);
  if (!n && !Object.keys(state.items).length) { area.firstChild.textContent = '目前沒有紀錄可以清除。'; }
}
$('rd-clear-area').appendChild(mkClear());
$('rd-exit').addEventListener('click', exitRedo);
$('rd-reveal').addEventListener('click', reveal);
$('rd-skip').addEventListener('click', skip);
$('rd-undo').addEventListener('click', doUndo);
$('rd-rate').addEventListener('click', e => { const b = e.target.closest('button[data-rate]'); if (b) rate(b.dataset.rate); });
$('rd-note').addEventListener('input', () => { if (noteTimer) clearTimeout(noteTimer); noteTimer = setTimeout(flushNote, 600); });
$('rd-note').addEventListener('blur', flushNote);
$('rd-font-down').addEventListener('click', () => { if (pos.font > 0) { pos.font--; savePos(); applyFont(); } });
$('rd-font-up').addEventListener('click', () => { if (pos.font < FONT_LABELS.length - 1) { pos.font++; savePos(); applyFont(); } });
function savePerDay(list, text) {
  const msg = $('rd-per-status'), next = setPerDay(state, list);
  if (!saveState(next)) { msg.textContent = '目前瀏覽器無法保存。'; return; }
  if (document.activeElement && $('rd-table-body').contains(document.activeElement)) document.activeElement.blur();
  render(); msg.textContent = text;
}
$('rd-per-form').addEventListener('submit', e => {
  e.preventDefault();
  const list = ROUNDS.map(r => Number($('rd-per-' + r.n).value)), msg = $('rd-per-status');
  if (!list.every(okPerDay)) { msg.textContent = '每天題數請填 1 到 ' + PER_DAY_MAX + ' 的整數。'; return; }
  savePerDay(list, '每天題數已更新，預計完成日重新計算。');
});
$('rd-per-reset').addEventListener('click', () => savePerDay(ROUNDS.map(r => r.perDay), '已恢復原本的每天題數。'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { flushNote(); clockPause(); return; }
  const now = ymd(new Date());
  if (now !== today) { today = now; pos = normPos(pos, today); savePos(); current = null; undo = null; redo = null; }
  state = window.LawScoringRounds.read(); render();
});
window.addEventListener('pagehide', () => { flushNote(); clockPause(); });
// 其他分頁改了紀錄：重讀再畫，避免用舊資料覆蓋。
window.addEventListener('storage', e => { if (e.key === KEY) { state = window.LawScoringRounds.read(); undo = null; redo = null; render(); } });
setInterval(tick, 1000);
applyFont();
render();
loadMocks();
})();
