/* 通勤模式：單手操作的回想卡。三組卡片——失分回想、考點回想、理論卡——一次一張、不用打字。
   失分回想與考點回想直接讀寫原本的紀錄（lawScoring.recall.v1、lawScoring.topicRecall.v1），
   排程規則都沿用原模組；理論卡的紀錄在 lawScoring.theoryCards.v1。本檔自己只存「上次做到哪裡」與字級（lawScoring.commute.v1）。 */
(function () {
'use strict';
const KEY = 'lawScoring.commute.v1';
const DECKS = ['miss', 'topic', 'theory'];
const STAGES = ['front', 'hints', 'back'];
const FONT_LABELS = ['較小', '標準', '較大', '最大'];

// 上次位置：組別、卡片、翻到哪一面、字級。格式不對的欄位一律退回預設值。
function normalize(s) {
  s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  return {
    deck: DECKS.includes(s.deck) ? s.deck : '',
    id: typeof s.id === 'string' ? s.id : '',
    stage: STAGES.includes(s.stage) ? s.stage : 'front',
    font: Number.isInteger(s.font) && s.font >= 0 && s.font < FONT_LABELS.length ? s.font : 1,
    at: typeof s.at === 'string' ? s.at : ''
  };
}
// 點卡片：題面 → 提示（有提示才停）→ 答案。按「翻開答案」則直接到答案。
function nextStage(stage, hasHints) { return stage === 'front' && hasHints ? 'hints' : 'back'; }
// 今天的順序：先跳過的卡排到最後；上次停在的那張如果還在，就從它開始。
function arrange(list, skipped, resumeId) {
  const skip = new Set(skipped || []);
  const out = list.filter(x => !skip.has(x.id)).concat((skipped || []).map(id => list.find(x => x.id === id)).filter(Boolean));
  const i = resumeId ? out.findIndex(x => x.id === resumeId) : -1;
  return i > 0 ? [out[i]].concat(out.slice(0, i), out.slice(i + 1)) : out;
}
function dayStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

window.LawScoringCommute = {KEY, DECKS, normalize, nextStage, arrange};
if (typeof document === 'undefined' || !document.getElementById('commute-root')) return;

const R = window.LawScoringReview, TR = window.LawScoringTopicRecall, TH = window.LawScoringTheoryCards;
const S = window.LawScoringSummaries, RENDER = window.LawScoringSummaryRender, DATA = window.LawScoringData;
const WK = window.LawScoringWeakness, SCORER = window.LawScoring && window.LawScoring.score;
const $ = id => document.getElementById(id);
function el(tag, attrs, text) { const n = document.createElement(tag); for (const k in (attrs || {})) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; }
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
const today = dayStr(new Date());
const RESULT_TEXT = {good: '記下了，之後間隔會拉長。', partial: '明天再複習一次。', again: '放回第 1 盒，明天再來。'};
const NO_SAVE = {fail: '目前瀏覽器無法保存，這一張沒有記錄。'};

/* ---------- 三組卡片。每組提供：ready()、list()、rate(item, result)、snapshot()、summary()、empty() ---------- */
const decks = {};

// 失分回想：與失分回想卡頁相同的同步、到期與評分規則。
decks.miss = (function () {
  const ok = !!(R && DATA);
  const byId = ok ? new Map(DATA.questions.map(q => [q.id, q])) : null;
  let cards = {}, saved = true;
  if (ok) { cards = R.syncCards(readJSON(R.SCORE_KEY), readJSON(R.CARD_KEY), today); saved = write(R.CARD_KEY, cards); }
  return {
    name: '失分回想', ready: () => ok,
    list() {
      return R.dueCards(cards, today, null).map(([id, c]) => {
        const q = byId.get(id.split('#')[0]), row = q.rows[+id.split('#')[1]];
        return {
          id, meta: q.exam + '／' + q.subject + '・第 ' + q.no + ' 題・第 ' + c.box + ' 盒', title: q.title,
          sub: q.kind === 'case' ? row.group + '之刑事責任' : row.group,
          note: '上次漏了：' + c.missed.map(k => R.COL_LABEL[k]).join('、') + (row.point === c.point ? '' : '（這一列的評分要點已更新）'),
          hints: [], tip: '先在心裡說出這一點的要點與法條或出處，再翻開對照。',
          back(host) {
            host.appendChild(el('p', {class: 'cm-point'}, row.point));
            host.appendChild(el('p', null, row.detail));
            host.appendChild(el('p', {class: 'cm-src'}, q.srcLabel + '：' + row.articles.join('、')));
            if (row.disputed) host.appendChild(el('p', {class: 'tag'}, '學說實務爭議・需寫各說與個人見解'));
            const note = row.devNote && row.devNote.trim(); if (note) host.appendChild(el('p', {class: 'dev-note'}, '開發者補充：' + note));
          },
          link: {href: './#' + encodeURIComponent(q.id), text: '回原題整題重寫 →'}
        };
      });
    },
    rate(item, result) {
      const next = Object.assign({}, cards, {[item.id]: R.rate(cards[item.id], result, today)});
      if (!write(R.CARD_KEY, next)) return NO_SAVE;
      cards = next; return cards[item.id].mastered ? '這一點已熟練，不再出現。' : RESULT_TEXT[result];
    },
    snapshot() { const before = cards; return () => { if (!write(R.CARD_KEY, before)) return false; cards = before; return true; }; },
    summary() { const all = Object.values(cards), active = all.filter(c => !c.mastered).length; return '複習中 ' + active + ' 張・已熟練 ' + (all.length - active) + ' 張'; },
    empty() {
      return Object.keys(cards).length
        ? {title: '失分回想今天做完了', text: '今天到期的卡片都複習完了。'}
        : {title: '還沒有失分回想卡', text: '到申論評分參考寫一題、展開評分要點並逐列勾選，沒勾到的得分點會自動變成卡片。', link: {href: './', text: '到申論評分參考'}};
    },
    saved: () => saved
  };
})();

// 考點回想與理論卡共用：章節順序依弱點地圖，排程用考點回想的 queue。
const summariesReady = slugs => !!(S && RENDER && TR && R && slugs.every(x => S.items[x]));
let weakCache;
function weakMap() {
  if (weakCache !== undefined) return weakCache;
  weakCache = null;
  if (WK && DATA && SCORER) { try { const byId = new Map(DATA.questions.map(q => [q.id, q])), store = WK.readStore(); weakCache = {}; S.list.forEach(m => { if (S.items[m.slug]) weakCache[m.slug] = WK.compute(S.items[m.slug], store, byId, SCORER); }); } catch (e) { weakCache = null; } }
  return weakCache;
}
function summaryDeck(opt) {
  const ok = summariesReady(opt.slugs);
  let state = ok ? opt.read() : null, ordered = null, extra = 0;
  const order = () => ordered || (ordered = TR.orderNew(opt.slugs.flatMap(x => opt.cardsOf(S.items[x])), S.items, weakMap()));
  const queue = () => TR.queue(state, order(), today, extra + opt.bonus);
  return {
    name: opt.name, ready: () => ok,
    list() { const q = queue(); return q.due.concat(q.fresh).map(c => opt.item(c, state.cards[c.id])); },
    rate(item, result) {
      const next = TR.rateCard(state, item.id, result, today, R.rate);
      if (!write(opt.key, opt.pack(next))) return NO_SAVE;
      state = next; return state.cards[item.id].mastered ? '這一張已熟練，不再出現。' : RESULT_TEXT[result];
    },
    snapshot() { const before = state; return () => { if (!write(opt.key, opt.pack(before))) return false; state = before; return true; }; },
    summary() { const q = queue(); return '複習中 ' + q.reviewing + ' 張・已熟練 ' + q.mastered + ' 張・還沒開始 ' + q.unseen + ' 張'; },
    empty() {
      const q = queue();
      return {title: opt.name + '今天做完了', text: q.unseen ? '今天的份量做完了。還有 ' + q.unseen + ' 張沒開始，要再練可以加開新卡。' : (q.reviewing ? '今天沒有到期的卡，新卡也都開始了。' : '全部都已熟練。'),
        more: q.unseen ? {text: '再練 ' + opt.step + ' 張新卡', run() { extra += opt.step; }} : null};
    }
  };
}
decks.topic = summaryDeck({
  name: '考點回想', slugs: S ? S.list.map(m => m.slug) : ['?'], bonus: 0, step: TR ? TR.NEW_PER_DAY : 5,
  key: TR && TR.KEY, read: () => TR.readState(), pack: s => TR.pack(s), cardsOf: d => TR.cardsOf(d),
  item(c, rec) {
    const d = S.items[c.slug];
    return {id: c.id, meta: c.subject + '・' + c.chapter + '・' + (rec ? '第 ' + rec.box + ' 盒' : '新卡'), title: c.title, sub: c.src, hints: c.hints,
      hintsLabel: '這個考點的要點標題：', tip: '先在心裡回想這個考點的要點，再點卡片看提示或翻開。',
      back(host) { RENDER.renderBlocks(host, c.blocks, d); }, link: {href: 'summaries.html#' + c.slug + '/' + c.section, text: '到重點整理看這一章 →'}};
  }
});
decks.theory = summaryDeck({
  name: '理論卡', slugs: TH ? TH.SUBJECTS : ['?'], bonus: TH && TR ? TH.NEW_PER_DAY - TR.NEW_PER_DAY : 0, step: 10,
  key: TH && TH.KEY, read: () => TH.readState(), pack: s => TH.pack(s), cardsOf: d => TH.cardsOf(d),
  item(c, rec) {
    const d = S.items[c.slug];
    return {id: c.id, meta: c.subject + '・' + c.chapter + '・' + (rec ? '第 ' + rec.box + ' 盒' : '新卡'), title: c.label, context: c.topic, hints: [],
      tip: '先在心裡說出這個要點的內容（學者、年代、構念），再翻開對照。',
      back(host) { RENDER.renderBlocks(host, [{t: 'ul', items: [c.item]}], d); }, link: {href: 'summaries.html#' + c.slug + '/' + c.section, text: '到重點整理看這一章 →'}};
  }
});

/* ---------- 畫面 ---------- */
let pos = normalize(readJSON(KEY));
let deckKey = '', stage = 'front', current = null, total = 0, done = 0, undo = null;
const skipped = Object.fromEntries(DECKS.map(k => [k, []]));
let resumeId = pos.id;
const say = t => { $('cm-status').textContent = t || ''; };
function savePos() { pos = {deck: deckKey, id: current ? current.id : '', stage: current ? stage : 'front', font: pos.font, at: new Date().toISOString()}; write(KEY, pos); }
function applyFont() {
  document.body.classList.remove('cm-f0', 'cm-f2', 'cm-f3'); if (pos.font !== 1) document.body.classList.add('cm-f' + pos.font);
  $('cm-font-label').textContent = FONT_LABELS[pos.font]; $('cm-font-down').disabled = pos.font === 0; $('cm-font-up').disabled = pos.font === FONT_LABELS.length - 1;
}
function listOf(key) { const d = decks[key]; return d.ready() ? arrange(d.list(), skipped[key], key === deckKey ? resumeId : '') : []; }
function renderCounts() {
  DECKS.forEach(k => {
    const d = decks[k], n = d.ready() ? d.list().length : null;
    $('cm-count-' + k).textContent = n == null ? '無法載入' : (n ? '剩 ' + n + ' 張' : '完成');
  });
  document.querySelectorAll('[data-deck]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-deck') === deckKey)));
}
function showStage() {
  const hasHints = current.hints.length > 0;
  $('cm-hints').hidden = stage === 'front' || !hasHints;
  $('cm-back').hidden = stage !== 'back';
  $('cm-tip').hidden = stage === 'back';
  $('cm-card').classList.toggle('is-back', stage === 'back');
  const rating = stage === 'back';
  $('cm-front-actions').hidden = rating; $('cm-rate3').hidden = !rating;
  const hintBtn = $('cm-hint'); hintBtn.hidden = !hasHints || stage !== 'front';
  $('cm-front-actions').classList.toggle('cm-single', hintBtn.hidden);
}
function render(focus) {
  const d = decks[deckKey];
  renderCounts();
  $('cm-undo').hidden = !undo;
  if (!d.ready()) {
    current = null; $('cm-card').hidden = true; $('cm-empty').hidden = false; $('cm-summary').textContent = '';
    $('cm-empty-title').textContent = d.name + '沒有載入成功';
    $('cm-empty-text').textContent = '資料沒有載入成功，請確認網路連線後重新整理。已下載離線版的話，請到離線頁更新一次。';
    const box = $('cm-empty-actions'); box.textContent = '';
    { const b = el('button', {type: 'button', class: 'btn primary'}, '重新載入'); b.addEventListener('click', () => location.reload()); box.appendChild(b); }
    $('cm-front-actions').hidden = true; $('cm-rate3').hidden = true; $('cm-skip').hidden = true; $('cm-progress').textContent = '';
    savePos(); if (focus) $('cm-empty-title').focus(); return;
  }
  const list = listOf(deckKey);
  $('cm-summary').textContent = d.summary();
  if (!list.length) { current = null; renderEmpty(d); savePos(); if (focus) $('cm-empty-title').focus(); return; }
  const item = list[0];
  if (!current || current.id !== item.id) { stage = resumeId === item.id && pos.deck === deckKey ? pos.stage : 'front'; }
  resumeId = '';
  current = item; total = list.length;
  $('cm-card').hidden = false; $('cm-empty').hidden = true;
  $('cm-meta').textContent = item.meta; $('cm-title').textContent = item.title;
  const context = $('cm-context'); context.textContent = item.context || ''; context.hidden = !item.context;
  const sub = $('cm-sub'); sub.textContent = item.sub || ''; sub.hidden = !item.sub;
  const note = $('cm-note'); note.textContent = item.note || ''; note.hidden = !item.note;
  $('cm-hints-label').textContent = item.hintsLabel || '提示：';
  const hl = $('cm-hint-list'); hl.textContent = ''; item.hints.forEach(h => hl.appendChild(el('li', null, h)));
  const body = $('cm-content'); body.textContent = ''; item.back(body);
  const link = $('cm-link'); link.href = item.link.href; link.textContent = item.link.text;
  $('cm-tip').textContent = item.tip;
  $('cm-progress').textContent = '今天這一組：做完 ' + done + ' 張・剩 ' + total + ' 張';
  $('cm-skip').hidden = total < 2;
  showStage(); savePos();
  if (focus) { window.scrollTo(0, 0); $('cm-title').focus({preventScroll: true}); }
}
function renderEmpty(d) {
  const e = d.empty(), box = $('cm-empty-actions');
  $('cm-card').hidden = true; $('cm-empty').hidden = false;
  $('cm-empty-title').textContent = e.title; $('cm-empty-text').textContent = e.text; box.textContent = '';
  if (e.more) { const b = el('button', {type: 'button', class: 'btn primary'}, e.more.text); b.addEventListener('click', () => { e.more.run(); say(''); render(true); }); box.appendChild(b); }
  DECKS.filter(k => k !== deckKey && decks[k].ready()).forEach(k => {
    const n = decks[k].list().length; if (!n) return;
    const b = el('button', {type: 'button', class: 'btn ghost'}, '換到' + decks[k].name + '（剩 ' + n + ' 張）'); b.addEventListener('click', () => switchDeck(k, true)); box.appendChild(b);
  });
  if (e.link) box.appendChild(el('a', {class: 'btn', href: e.link.href}, e.link.text));
  $('cm-front-actions').hidden = true; $('cm-rate3').hidden = true; $('cm-skip').hidden = true;
  $('cm-progress').textContent = done ? '今天這一組：做完 ' + done + ' 張' : '';
}
function switchDeck(key, focus) { if (key === deckKey) return; deckKey = key; current = null; done = 0; stage = 'front'; undo = null; say(''); render(focus); }
function setStage(next, focusTarget) { stage = next; showStage(); savePos(); if (focusTarget) $(focusTarget).focus({preventScroll: false}); }

document.querySelectorAll('[data-deck]').forEach(b => b.addEventListener('click', () => switchDeck(b.getAttribute('data-deck'), true)));
$('cm-hint').addEventListener('click', () => { if (current) setStage('hints', 'cm-hints'); });
$('cm-reveal').addEventListener('click', () => { if (current) setStage('back', 'cm-content'); });
$('cm-card').addEventListener('click', ev => {
  if (!current || stage === 'back' || ev.target.closest('a,button,summary,input')) return;
  const sel = window.getSelection && window.getSelection(); if (sel && String(sel)) return;
  setStage(nextStage(stage, current.hints.length > 0), null);
});
document.querySelectorAll('#cm-bar [data-rate]').forEach(b => b.addEventListener('click', () => {
  if (!current || stage !== 'back') return;
  const d = decks[deckKey], restore = d.snapshot(), was = {id: current.id, deck: deckKey};
  const msg = d.rate(current, b.getAttribute('data-rate'));
  if (msg && msg.fail) { say(msg.fail); return; }
  done++; undo = {deck: deckKey, id: was.id, restore};
  skipped[deckKey] = skipped[deckKey].filter(id => id !== was.id);
  say(msg); current = null; stage = 'front'; render(true);
}));
$('cm-undo').addEventListener('click', () => {
  if (!undo || undo.deck !== deckKey) { undo = null; $('cm-undo').hidden = true; return; }
  if (!undo.restore()) { say('目前瀏覽器無法保存，沒有復原。'); return; }
  resumeId = undo.id; pos = Object.assign({}, pos, {deck: deckKey, stage: 'back'}); done = Math.max(0, done - 1); undo = null; current = null;
  say('已復原上一張的評分，請重新選一次。'); render(true);
});
$('cm-skip').addEventListener('click', () => {
  if (!current) return;
  skipped[deckKey] = skipped[deckKey].filter(id => id !== current.id).concat([current.id]);
  say('先跳過，這一張排到今天的最後。'); current = null; stage = 'front'; render(true);
});
$('cm-font-down').addEventListener('click', () => { if (pos.font > 0) { pos.font--; applyFont(); savePos(); } });
$('cm-font-up').addEventListener('click', () => { if (pos.font < FONT_LABELS.length - 1) { pos.font++; applyFont(); savePos(); } });

// 進頁面：回到上次那一組、那一張、那一面；沒有上次位置時，從第一組還有卡片的開始。
applyFont();
const resumed = pos.deck && decks[pos.deck].ready() && pos.id && decks[pos.deck].list().some(x => x.id === pos.id);
deckKey = pos.deck || DECKS.find(k => decks[k].ready() && decks[k].list().length) || 'miss';
if (!resumed) resumeId = '';
render(false);
if (resumed) say('已回到上次的位置。');
else if (!decks.miss.saved()) say('目前瀏覽器無法保存回想卡進度。');
})();
