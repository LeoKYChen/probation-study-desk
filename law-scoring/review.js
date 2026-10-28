/* 失分統計與回想卡：讀取申論評分參考的自評勾選（不修改），沒勾到的得分點自動成為間隔複習的回想卡。紀錄只存在目前瀏覽器。 */
(function () {
'use strict';
const DATA = window.LawScoringData;
const SCORE_KEY = 'lawScoring.v2', CARD_KEY = 'lawScoring.recall.v1';
// 盒子 1–5 對應下一次複習的間隔天數；第 5 盒再答對就算熟練。
const INTERVALS = [1, 3, 7, 14, 30];
// 必要欄位（不含加分欄）歸到五類失分；案例題的「不同見解」只看爭議列。
const CATS = [['issues','漏寫爭點或論點'], ['law','法條或理論不正確'], ['views','爭議沒寫不同見解'], ['apply','沒扣回目的、實務或涵攝'], ['organize','架構檢核未做到']];
const COL_CAT = {found:'issues', law:'law', theory:'law', views:'views', purpose:'apply', apply:'apply', practice:'apply'};
const COL_LABEL = {found:'有寫到', law:'法條正確', theory:'理論正確', views:'寫出不同見解', purpose:'扣回制度目的', apply:'有涵攝', practice:'扣回實務'};
const BY_ID = new Map(DATA.questions.map(q => [q.id, q]));

function dayStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function addDays(day, n) { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() + n); return dayStr(d); }
function requiredCols(q, row) {
  const cols = {essay:['found','law','purpose'], proc:['found','law','purpose'], theory:['found','theory','practice'], case:['found','views','apply']}[q.kind];
  return cols.filter(c => c !== 'views' || row.disputed);
}
function missedCols(q, s, i) { const c = (s.checks && s.checks[i]) || {}; return requiredCols(q, q.rows[i]).filter(k => !c[k]); }

// 已展開評分要點的題目才算「已自評」。
function graded(store) { return DATA.questions.filter(q => store[q.id] && store[q.id].unlocked).map(q => [q, store[q.id]]); }

function stats(store) {
  const total = Object.fromEntries(CATS.map(([k]) => [k, {miss:0, all:0}]));
  const subjects = new Map();
  for (const [q, s] of graded(store)) {
    const key = q.examType + '／' + q.subject;
    const sub = subjects.get(key) || subjects.set(key, {examType:q.examType, subject:q.subject, count:0, scoreSum:0, cats:Object.fromEntries(CATS.map(([k]) => [k, {miss:0, all:0}]))}).get(key);
    sub.count++;
    if (window.LawScoring) sub.scoreSum += window.LawScoring.score(q, {checks:s.checks || {}, organize:s.organize || {}}).total;
    const tally = (cat, missed) => { for (const t of [total[cat], sub.cats[cat]]) { t.all++; if (missed) t.miss++; } };
    q.rows.forEach((row, i) => { const missed = missedCols(q, s, i); requiredCols(q, row).forEach(c => tally(COL_CAT[c], missed.includes(c))); });
    q.organize.forEach((_, i) => tally('organize', !(s.organize && s.organize[i])));
  }
  return {gradedCount: graded(store).length, total, subjects: [...subjects.values()]};
}

// 依自評結果同步卡片：新出現的漏寫列加入、今天到期；從未複習且已在評分頁補勾的卡片移除。
function syncCards(store, cards, today) {
  const out = Object.assign({}, cards), live = new Set();
  for (const [q, s] of graded(store)) {
    q.rows.forEach((row, i) => {
      const id = q.id + '#' + i, missed = missedCols(q, s, i);
      if (!missed.length) return;
      live.add(id);
      if (!out[id]) out[id] = {box:1, due:today, added:today, point:row.point, missed, reviews:[], mastered:false};
      else if (!out[id].mastered) out[id] = Object.assign({}, out[id], {missed});
    });
  }
  for (const id of Object.keys(out)) if (!live.has(id) && !out[id].reviews.length) delete out[id];
  return out;
}

function rate(card, result, today) {
  const next = Object.assign({}, card, {reviews: card.reviews.concat([{day:today, result}]).slice(-50)});
  if (result === 'good') { if (card.box >= INTERVALS.length) next.mastered = true; else { next.box = card.box + 1; next.due = addDays(today, INTERVALS[card.box]); } }
  else if (result === 'partial') next.due = addDays(today, 1);
  else { next.box = 1; next.due = addDays(today, 1); }
  return next;
}
function dueCards(cards, today, filter) {
  // 題目或評分列已不存在（資料改版）的卡片不出題，但保留紀錄。
  return Object.entries(cards).filter(([id, c]) => { const q = BY_ID.get(id.split('#')[0]); return !c.mastered && c.due <= today && q && q.rows[+id.split('#')[1]] && (!filter || filter(q)); }).sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0]));
}

window.LawScoringReview = {stats, syncCards, rate, dueCards, INTERVALS, CATS};
if (typeof document === 'undefined' || !document.getElementById('review-root')) return;

const $ = id => document.getElementById(id);
function el(tag, attrs, text) { const n = document.createElement(tag); for (const k in (attrs || {})) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; }
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
let saveOk = true;
function persist() { try { localStorage.setItem(CARD_KEY, JSON.stringify(cards)); } catch (e) { saveOk = false; $('status').textContent = '目前瀏覽器無法保存回想卡進度。'; } }
const today = dayStr(new Date());
const store = readJSON(SCORE_KEY);
let cards = syncCards(store, readJSON(CARD_KEY), today);
persist();
let filterKey = '', current = null;
const pct = (m, a) => a ? Math.round(100 * m / a) : 0;

function renderStats() {
  const st = stats(store);
  $('graded-count').textContent = st.gradedCount;
  $('empty').hidden = st.gradedCount > 0;
  $('stats').hidden = st.gradedCount === 0;
  $('subj-section').hidden = st.gradedCount === 0;
  const host = $('cat-bars'); host.textContent = '';
  CATS.forEach(([k, label]) => {
    const t = st.total[k]; if (!t.all) return;
    const row = el('div', {class:'bar-row'}); row.appendChild(el('span', null, label)); row.appendChild(el('strong', null, '漏 ' + t.miss + '／' + t.all + '（' + pct(t.miss, t.all) + '%）'));
    const tr = el('div', {class:'track'}), f = el('div', {class:'fill miss'}); f.style.width = pct(t.miss, t.all) + '%'; tr.appendChild(f); row.appendChild(tr); host.appendChild(row);
  });
  const worst = CATS.filter(([k]) => st.total[k].all).sort((a, b) => pct(st.total[b[0]].miss, st.total[b[0]].all) - pct(st.total[a[0]].miss, st.total[a[0]].all))[0];
  $('worst').textContent = worst ? '目前最常失分：' + worst[1] + '。下一題作答時，先檢查這一項。' : '';
  const body = $('subject-rows'); body.textContent = '';
  st.subjects.sort((a, b) => a.examType.localeCompare(b.examType) || a.subject.localeCompare(b.subject)).forEach(s => {
    const tr = el('tr');
    tr.appendChild(el('th', {scope:'row'}, s.examType + '／' + s.subject));
    tr.appendChild(el('td', {'data-label':'已自評'}, s.count + ' 題'));
    tr.appendChild(el('td', {'data-label':'平均自評'}, Math.round(s.scoreSum / s.count) + ' 分'));
    const top = CATS.filter(([k]) => s.cats[k].all && s.cats[k].miss).sort((a, b) => pct(s.cats[b[0]].miss, s.cats[b[0]].all) - pct(s.cats[a[0]].miss, s.cats[a[0]].all))[0];
    tr.appendChild(el('td', {'data-label':'最常失分'}, top ? top[1] + '（' + pct(s.cats[top[0]].miss, s.cats[top[0]].all) + '%）' : '沒有漏寫'));
    body.appendChild(tr);
  });
}

function renderFilter() {
  const sel = $('deck-filter'), keys = [...new Set(Object.keys(cards).map(id => BY_ID.get(id.split('#')[0])).filter(Boolean).map(q => q.examType + '／' + q.subject))].sort();
  sel.textContent = ''; sel.appendChild(el('option', {value:''}, '全部科目'));
  keys.forEach(k => sel.appendChild(el('option', {value:k}, k)));
  sel.value = keys.includes(filterKey) ? filterKey : '';
}

function renderDeck() {
  const list = dueCards(cards, today, filterKey ? q => q.examType + '／' + q.subject === filterKey : null);
  const all = Object.values(cards), active = all.filter(c => !c.mastered);
  $('deck-summary').textContent = '今天到期 ' + list.length + ' 張・複習中 ' + active.length + ' 張・已熟練 ' + (all.length - active.length) + ' 張';
  $('card').hidden = !list.length; $('done').hidden = !!list.length || !all.length;
  if (!list.length) { current = null; return; }
  current = list[0][0];
  const c = cards[current], q = BY_ID.get(current.split('#')[0]), row = q.rows[+current.split('#')[1]];
  $('card-meta').textContent = q.exam + '／' + q.subject + '・第 ' + q.no + ' 題・第 ' + c.box + ' 盒';
  $('card-title').textContent = q.title;
  $('card-group').textContent = (q.kind === 'case' ? row.group + '之刑事責任' : row.group);
  $('card-missed').textContent = '上次漏了：' + c.missed.map(k => COL_LABEL[k]).join('、');
  $('card-changed').hidden = row.point === c.point;
  $('card-answer').value = '';
  $('card-back').hidden = true; $('reveal').hidden = false;
  $('back-point').textContent = row.point;
  $('back-detail').textContent = row.detail;
  $('back-src-label').textContent = q.srcLabel + '：';
  $('back-articles').textContent = row.articles.join('、');
  const note = row.devNote && row.devNote.trim();
  $('back-note').hidden = !note; $('back-note').textContent = note ? '開發者補充：' + note : '';
  $('back-dispute').hidden = !row.disputed;
  $('rewrite').href = './#' + encodeURIComponent(q.id);
}

function render() { renderStats(); renderFilter(); renderDeck(); }
$('reveal').addEventListener('click', () => { $('card-back').hidden = false; $('reveal').hidden = true; $('back-point').focus(); });
document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
  if (!current) return;
  const result = b.getAttribute('data-rate');
  cards[current] = rate(cards[current], result, today); persist();
  $('status').textContent = saveOk ? {good:'記下了，之後間隔會拉長。', partial:'明天再複習一次。', again:'放回第 1 盒，明天再來。'}[result] : $('status').textContent;
  renderDeck(); $('card-title').focus();
}));
$('deck-filter').addEventListener('change', e => { filterKey = e.target.value; renderDeck(); });
render();
})();
