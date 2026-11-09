/* 弱點地圖：把申論評分參考的自評分數，依重點整理的主題算出掌握度與優先複習順序。只讀取紀錄，不寫入任何資料。 */
(function () {
'use strict';
const SCORE_KEY = 'lawScoring.v2';
const LOW = 60;      // 低於這個分數的題目列為「低分」
const MIN = 3;       // 一章至少自評幾題才排名（題數不到 3 的章以全部題數為準）
const GUAN_W = 2;    // 觀護人的題目加重計算
const TOP = 5;
const TOK = /(觀護|監獄|犯防|薦任|監所|家調)(\d{3})-(\d)/g;

// 與失分回想卡同一標準：已展開評分要點，且有作答、作答網址或至少一個勾選，才算已自評。
function isGraded(s) {
  if (!s || !s.unlocked) return false;
  const ticked = o => o && Object.values(o).some(v => v === true || (v && typeof v === 'object' && Object.values(v).some(Boolean)));
  return !!(String(s.answer || '').trim() || String(s.answerUrl || '').trim() || ticked(s.checks) || ticked(s.organize));
}
// 一章的題目：只數「出題：」行，括號內的「另見」不算（與排行圖同一規則）。
function chapterTokens(sec) {
  const seen = new Set();
  for (const b of sec.blocks) if (b.t === 'p' && b.text.startsWith('出題：')) for (const k of b.text.replace(/（[^）]*）/g, '').matchAll(TOK)) seen.add(k[0]);
  return [...seen];
}
function readStore() { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch (e) { return {}; } }
function rawStore() { try { return localStorage.getItem(SCORE_KEY) || ''; } catch (e) { return ''; } }

// d：一科的重點整理資料；store：自評紀錄；byId：題目 id → 題目；scoreFn：申論評分參考的計分函式。
function compute(d, store, byId, scoreFn) {
  const chapters = d.sections.filter(sec => sec.count != null).map(sec => {
    const row = d.chart.find(r => r.section === sec.id) || {theme: sec.title, guan: 0, other: 0};
    const items = chapterTokens(sec).map(token => {
      const id = d.links[token], q = byId.get(id), s = store[id];
      const graded = !!(q && isGraded(s));
      let score = null;
      if (graded) { try { score = scoreFn(q, {checks: s.checks || {}, organize: s.organize || {}}).total; } catch (e) { score = null; } }
      return {token, id, graded: graded && score != null, score};
    });
    const done = items.filter(x => x.graded);
    const avg = done.length ? Math.round(done.reduce((a, x) => a + x.score, 0) / done.length) : null;
    const weight = GUAN_W * row.guan + row.other;
    const enough = done.length >= Math.min(MIN, items.length) && done.length > 0;
    return {
      section: sec.id, title: row.theme, total: items.length, guan: row.guan, done: done.length, avg, weight, enough,
      priority: enough ? weight * (1 - avg / 100) : null,
      todo: items.filter(x => !x.graded).map(x => x.token),
      low: done.filter(x => x.score < LOW).sort((a, b) => a.score - b.score).map(x => ({token: x.token, score: x.score}))
    };
  });
  const ranked = chapters.filter(c => c.enough && c.priority > 0).sort((a, b) => b.priority - a.priority || b.weight - a.weight).slice(0, TOP);
  const untried = chapters.filter(c => !c.enough).sort((a, b) => b.weight - a.weight || b.total - a.total).slice(0, TOP);
  return {chapters, ranked, untried, gradedTotal: chapters.reduce((a, c) => a + c.done, 0), bySection: Object.fromEntries(chapters.map(c => [c.section, c]))};
}

window.LawScoringWeakness = {compute, isGraded, chapterTokens, readStore, rawStore, LOW, MIN, GUAN_W, TOP};
})();
