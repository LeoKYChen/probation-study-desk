/* 考點回想：把各科重點整理的每個考點做成回想卡，先自己回想、再對照內容並自評，依間隔複習（與失分回想卡同一套間隔）。
   紀錄另存在 lawScoring.topicRecall.v1；自評紀錄（lawScoring.v2）只讀取，用來決定新卡順序，不會被更動。 */
(function () {
'use strict';
const KEY = 'lawScoring.topicRecall.v1';
const NEW_PER_DAY = 5;
const TOK = /(觀護|監獄|犯防|薦任|監所|家調)(\d{3})-(\d)/g;

function dayStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// 提示：條列項目開頭的粗體標題；表格則列出欄名。
function hintsOf(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === 'ul' || b.t === 'ol') for (const it of b.items) { const m = /^\*\*([^*]+)\*\*/.exec(it.text); if (m) out.push(m[1].replace(/[：:]\s*$/, '')); }
    else if (b.t === 'table') out.push('表格：' + b.head.map(h => h.replace(/\*\*/g, '').trim()).filter(Boolean).join('、'));
  }
  return out;
}
// 一科的重點整理 → 考點卡。每個 h3 是一張卡，到下一個 h3 或章末為止；「出題：」行放在卡片正面。
function cardsOf(d) {
  const out = [];
  d.sections.forEach((sec, si) => {
    if (sec.count == null) return;
    let cur = null;
    const push = () => { if (cur && cur.blocks.length) { cur.hints = hintsOf(cur.blocks); out.push(cur); } cur = null; };
    sec.blocks.forEach(b => {
      if (b.t === 'h3') { push(); cur = {id: d.slug + '|' + b.text, slug: d.slug, subject: d.subject, section: sec.id, sectionIndex: si, chapter: sec.title.replace(/（\d+ 題）$/, ''), title: b.text, src: '', guan: 0, blocks: [], index: out.length}; return; }
      if (!cur) return;
      if (b.t === 'p' && b.text.startsWith('出題：') && !cur.src) { cur.src = b.text; cur.guan = (b.text.replace(/（[^）]*）/g, '').match(/觀護\d{3}-\d/g) || []).length; return; }
      cur.blocks.push(b);
    });
    push();
  });
  return out;
}

// 新卡順序：弱點地圖排到的章最先（依優先分數），其次是還沒練夠的章（依加權出題數），已全部掌握的章最後；
// 同一章內，觀護人考過的考點先出。weakBySlug 沒有資料時，以排行圖的出題數代替。
function orderNew(cards, summaries, weakBySlug) {
  const key = c => {
    const w = weakBySlug && weakBySlug[c.slug] && weakBySlug[c.slug].bySection[c.section];
    if (w) return w.enough ? (w.priority > 0 ? [0, -w.priority] : [2, -w.weight]) : [1, -w.weight];
    const row = (summaries[c.slug].chart || []).find(r => r.section === c.section) || {guan: 0, other: 0};
    return [1, -(2 * row.guan + row.other)];
  };
  const keyed = cards.map(c => [key(c), c]);
  return keyed.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[1].slug.localeCompare(b[1].slug) || a[1].sectionIndex - b[1].sectionIndex || b[1].guan - a[1].guan || a[1].index - b[1].index).map(x => x[1]);
}

// 今天要出的卡：到期的舊卡全部出；新卡每天最多 NEW_PER_DAY 張（以今天第一次評分的卡計算），extra 是使用者按「再練」加開的張數。
function queue(state, ordered, today, extra) {
  const picked = state.subjects && state.subjects.length ? new Set(state.subjects) : null;
  const live = ordered.filter(c => !picked || picked.has(c.slug));
  const recs = state.cards || {};
  const due = live.filter(c => recs[c.id] && !recs[c.id].mastered && recs[c.id].due <= today).sort((a, b) => recs[a.id].due.localeCompare(recs[b.id].due));
  const unseen = live.filter(c => !recs[c.id]);
  const addedToday = Object.values(recs).filter(r => r.added === today).length;
  const slots = Math.max(0, NEW_PER_DAY + (extra || 0) - addedToday);
  const all = Object.keys(recs).length, mastered = Object.values(recs).filter(r => r.mastered).length;
  return {due, fresh: unseen.slice(0, slots), unseen: unseen.length, reviewing: all - mastered, mastered, addedToday};
}
// 評分：新卡先建立紀錄（第 1 盒、今天加入），再套用失分回想卡的間隔規則。
function rateCard(state, id, result, today, rate) {
  const cards = Object.assign({}, state.cards);
  const base = cards[id] || {box: 1, due: today, added: today, reviews: [], mastered: false};
  cards[id] = rate(base, result, today);
  return Object.assign({}, state, {cards});
}
function readState() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  return unpack(s);
}
// 儲存格式與失分回想卡相同：最上層就是「卡片 id → 紀錄」，設定放在 __ 開頭的鍵，完整備份才能逐張合併。
function unpack(s) {
  s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  const cards = {};
  for (const k of Object.keys(s)) if (!k.startsWith('__') && s[k] && typeof s[k] === 'object' && typeof s[k].due === 'string' && Array.isArray(s[k].reviews)) cards[k] = s[k];
  return {cards, subjects: Array.isArray(s.__subjects) ? s.__subjects : null, tab: s.__tab === 'topic' ? 'topic' : 'miss'};
}
function pack(state) { const out = Object.assign({}, state.cards); if (state.subjects) out.__subjects = state.subjects; out.__tab = state.tab; return out; }

window.LawScoringTopicRecall = {KEY, NEW_PER_DAY, cardsOf, hintsOf, orderNew, queue, rateCard, readState, pack, unpack};
if (typeof document === 'undefined' || !document.getElementById('tab-topic')) return;

const S = window.LawScoringSummaries, R = window.LawScoringReview, RENDER = window.LawScoringSummaryRender;
const WK = window.LawScoringWeakness, DATA = window.LawScoringData, SCORER = window.LawScoring && window.LawScoring.score;
const $ = id => document.getElementById(id);
function el(tag, attrs, text) { const n = document.createElement(tag); for (const k in (attrs || {})) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; }
const today = dayStr(new Date());
let state = readState(), ordered = null, current = null, extra = 0, loadingAll = false, saveOk = true;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(pack(state))); saveOk = true; } catch (e) { saveOk = false; $('tr-status').textContent = '目前瀏覽器無法保存考點回想的進度。'; } }

// 分頁：失分回想／考點回想。考點回想第一次打開時才載入六科重點整理。
function showTab(tab, focus, save) {
  state.tab = tab; if (save) persist();
  $('tab-miss').hidden = tab !== 'miss'; $('tab-topic').hidden = tab !== 'topic';
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === tab)));
  if (tab === 'topic') { ensureData(); if (focus) $('tr-heading').focus(); }
}
function ensureData() {
  if (ordered) { renderDeck(); return; }
  if (!S || !R || !RENDER) { fail(); return; }
  const missing = S.list.filter(m => !S.items[m.slug]);
  if (!missing.length) { build(); return; }
  if (loadingAll) return;
  loadingAll = true; $('tr-error').hidden = true; $('tr-status').textContent = '正在載入六科重點整理…';
  let left = missing.length, bad = false;
  const done = () => { if (--left) return; loadingAll = false; if (bad || S.list.some(m => !S.items[m.slug])) fail(); else { $('tr-status').textContent = ''; build(); } };
  missing.forEach(m => { const sc = document.createElement('script'); sc.src = 'summaries/' + m.file; sc.onload = done; sc.onerror = () => { bad = true; sc.remove(); done(); }; document.head.appendChild(sc); });
}
function fail() { $('tr-status').textContent = ''; $('tr-card').hidden = true; $('tr-done').hidden = true; $('tr-subjects').hidden = true; $('tr-error').hidden = false; }
function build() {
  let weak = null;
  if (WK && DATA && SCORER) { try { const byId = new Map(DATA.questions.map(q => [q.id, q])), store = WK.readStore(); weak = {}; S.list.forEach(m => { weak[m.slug] = WK.compute(S.items[m.slug], store, byId, SCORER); }); } catch (e) { weak = null; } }
  const all = S.list.flatMap(m => cardsOf(S.items[m.slug]));
  ordered = orderNew(all, S.items, weak);
  renderSubjects(); renderDeck();
}
function renderSubjects() {
  const box = $('tr-subject-list'); box.textContent = ''; $('tr-subjects').hidden = false;
  const picked = state.subjects && state.subjects.length ? new Set(state.subjects) : null;
  $('tr-subjects-summary').textContent = '要練的科目：' + (picked ? S.list.filter(m => picked.has(m.slug)).map(m => m.title).join('、') : '全部 ' + S.list.length + ' 科');
  S.list.forEach(m => {
    const label = el('label', {class: 'tr-subject'}), input = el('input', {type: 'checkbox', value: m.slug});
    input.checked = !picked || picked.has(m.slug);
    input.addEventListener('change', () => {
      const on = [...box.querySelectorAll('input:checked')].map(i => i.value);
      if (!on.length) { input.checked = true; $('tr-status').textContent = '至少要留一科。'; return; }
      state.subjects = on.length === S.list.length ? null : on; persist(); $('tr-status').textContent = '';
      $('tr-subjects-summary').textContent = '要練的科目：' + (state.subjects ? S.list.filter(x => on.includes(x.slug)).map(x => x.title).join('、') : '全部 ' + S.list.length + ' 科'); renderDeck();
    });
    label.appendChild(input); label.appendChild(el('span', null, m.title + '（' + ordered.filter(c => c.slug === m.slug).length + ' 張）'));
    box.appendChild(label);
  });
}
function renderDeck() {
  const q = queue(state, ordered, today, extra), list = q.due.concat(q.fresh);
  $('tr-summary').textContent = '今天到期 ' + q.due.length + ' 張・新卡 ' + q.fresh.length + ' 張・複習中 ' + q.reviewing + ' 張・已熟練 ' + q.mastered + ' 張・還沒開始 ' + q.unseen + ' 張';
  $('tr-error').hidden = true; $('tr-card').hidden = !list.length; $('tr-done').hidden = !!list.length;
  if (!list.length) { current = null; $('tr-done-text').textContent = q.unseen ? '今天的考點都複習完了。' : (q.reviewing ? '今天沒有到期的卡，新卡也都開始了。' : '選定科目的考點都已熟練。'); $('tr-more').hidden = !q.unseen; return; }
  const c = current = list[0], rec = state.cards[c.id], d = S.items[c.slug];
  $('tr-meta').textContent = c.subject + '・' + c.chapter + '・' + (rec ? '第 ' + rec.box + ' 盒' : '新卡');
  $('tr-title').textContent = c.title;
  const src = $('tr-src'); src.textContent = ''; src.hidden = !c.src; if (c.src) RENDER.linkify(src, c.src, d.links);
  $('tr-answer').value = '';
  $('tr-hints').hidden = true; $('tr-back').hidden = true; $('tr-reveal').hidden = false; $('tr-hint').hidden = !c.hints.length;
  const hl = $('tr-hint-list'); hl.textContent = ''; c.hints.forEach(h => hl.appendChild(el('li', null, h)));
  const body = $('tr-content'); body.textContent = ''; RENDER.renderBlocks(body, c.blocks, d);
  $('tr-open').href = 'summaries.html#' + c.slug + '/' + c.section;
}

document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { const t = b.getAttribute('data-tab'); try { history.replaceState(null, '', t === 'topic' ? '#topics' : location.pathname + location.search); } catch (e) {} showTab(t, false, true); }));
$('tr-hint').addEventListener('click', () => { $('tr-hints').hidden = false; $('tr-hint').hidden = true; $('tr-hints').focus(); });
$('tr-reveal').addEventListener('click', () => { $('tr-back').hidden = false; $('tr-reveal').hidden = true; $('tr-hint').hidden = true; $('tr-content').focus(); });
document.querySelectorAll('[data-trate]').forEach(b => b.addEventListener('click', () => {
  if (!current) return;
  const result = b.getAttribute('data-trate');
  state = rateCard(state, current.id, result, today, R.rate); persist();
  if (saveOk) $('tr-status').textContent = state.cards[current.id].mastered ? '這個考點已熟練，不再出現。' : {good: '記下了，之後間隔會拉長。', partial: '明天再複習一次。', again: '放回第 1 盒，明天再來。'}[result];
  renderDeck(); if (current) $('tr-title').focus(); else $('tr-heading').focus();
}));
$('tr-more').addEventListener('click', () => { extra += NEW_PER_DAY; $('tr-status').textContent = '已加開 ' + NEW_PER_DAY + ' 張新卡。'; renderDeck(); if (current) $('tr-title').focus(); });
$('tr-retry').addEventListener('click', () => ensureData());

showTab(location.hash === '#topics' ? 'topic' : state.tab, false, false);
})();
