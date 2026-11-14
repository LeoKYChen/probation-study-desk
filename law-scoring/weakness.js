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

// 失分類型：只用題庫既有欄位，統計這一科已自評的題目裡，哪一類要點最常沒寫到。只在法律科目使用。
// 類別：有爭議的要點（disputed）、爭議要點有沒有並陳見解（案例題的 views 欄）、罪數與競合的要點（要點名稱比對）、其他要點（對照用）、答題組織各項。
const LOSS_SLUGS = ['criminal-law', 'criminal-procedure', 'juvenile'];
const CONCUR = /競合|罪數|併罰|定應執行/;
function lossTypes(d, store, byId) {
  const ids = [...new Set(Object.values(d.links))];
  const acc = new Map();
  const add = (key, label, hit) => { const x = acc.get(key) || {key, label, hit: 0, total: 0}; x.total++; if (hit) x.hit++; acc.set(key, x); };
  let graded = 0;
  for (const id of ids) {
    const q = byId.get(id), s = store[id];
    if (!q || !isGraded(s)) continue;
    graded++;
    const checks = s.checks || {}, organize = s.organize || {};
    q.rows.forEach((r, i) => {
      const c = checks[i] || {}, found = !!c.found;
      if (r.disputed) { add('disputed', '有爭議的要點', found); if (q.kind === 'case') add('views', '爭議要點有並陳不同見解', !!c.views); }
      if (CONCUR.test(r.point)) add('concur', '罪數與競合的要點', found);
      if (!r.disputed && !CONCUR.test(r.point)) add('plain', '其他要點', found);
    });
    (q.organize || []).forEach((t, i) => add('org:' + t, '答題組織：' + t, !!organize[i]));
  }
  const all = [...acc.values()].map(x => Object.assign(x, {rate: Math.round(100 * x.hit / x.total)}));
  const baseline = all.find(x => x.key === 'plain') || null;
  const items = all.filter(x => x.key !== 'plain' && x.total >= MIN).sort((a, b) => a.rate - b.rate || b.total - a.total);
  return {graded, items, baseline, enough: graded >= MIN};
}

// 限時表現：這一科存過的作答歷程裡，有限時紀錄的幾次在時間內完成、拆題核對列到幾步。
// 已自評但還沒存檔的那一次限時紀錄也算一次用時（拆題步數只存在作答歷程裡，沒存檔就不計）。純計算，不寫入。
function timeStats(d, store) {
  const ids = [...new Set(Object.values(d.links))];
  const time = {key: 'time', label: '限時內寫完', hit: 0, total: 0}, outline = {key: 'outline', label: '拆題有列到的步驟', hit: 0, total: 0};
  let over = 0;
  for (const id of ids) {
    const s = store[id]; if (!s) continue;
    const hist = Array.isArray(s.history) ? s.history.filter(h => h && typeof h.score === 'number') : [];
    for (const h of hist) {
      if (typeof h.used === 'number' && h.limit) { time.total++; if (h.used <= h.limit) time.hit++; else over += h.used - h.limit; }
      if (Array.isArray(h.steps) && h.steps[1] > 0) { outline.hit += h.steps[0]; outline.total += h.steps[1]; }
    }
    const t = s.timed, last = hist[hist.length - 1];
    if (isGraded(s) && t && t.t0 && t.t2 && t.limit && !(last && last.at >= t.t2)) { const used = Math.round((t.t2 - t.t0) / 1000); time.total++; if (used <= t.limit) time.hit++; else over += used - t.limit; }
  }
  const items = [time, outline].filter(x => x.total >= MIN).map(x => Object.assign(x, {rate: Math.round(100 * x.hit / x.total)}));
  const late = time.total - time.hit;
  return {items, times: time.total, avgOverMin: late ? Math.max(1, Math.round(over / late / 60)) : 0};
}

// 律師・司法官備考平臺（lawyer-judge/）的第一試選擇題：那邊會把刑法、刑事訴訟法「還在錯題本裡」的題目
// 依條文與章節整理成一份摘要，存在 lj:: 開頭的鍵。這裡只讀取、檢查格式後交給重點整理頁顯示，不寫入任何東西。
const LJ_MCQ_KEY = 'lj::lsdesk-mcq-weak-v1', LJ_SUBJECT = {'criminal-law': '刑法', 'criminal-procedure': '刑事訴訟法'};
function rawLawyerMcq() { try { return localStorage.getItem(LJ_MCQ_KEY) || ''; } catch (e) { return ''; } }
function lawyerMcq(slug, raw) {
  const subject = LJ_SUBJECT[slug]; if (!subject || !raw) return null;
  let data; try { data = JSON.parse(raw); } catch (e) { return null; }
  const s = data && data.version === 1 && data.subjects && data.subjects[subject];
  if (!s || typeof s !== 'object') return null;
  const int = n => Number.isInteger(n) && n >= 0;
  const rows = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x.name === 'string' && x.name && x.name.length <= 80 && int(x.wrong) && int(x.done) && x.wrong > 0 && x.wrong <= x.done).slice(0, 8).map(x => ({name: x.name, wrong: x.wrong, done: x.done}));
  if (!int(s.done) || !int(s.wrong) || s.wrong > s.done) return null;
  const updated = typeof data.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data.updatedAt) ? data.updatedAt.slice(0, 10) : '';
  return {subject, done: s.done, wrong: s.wrong, articles: rows(s.articles), chapters: rows(s.chapters), updated};
}
window.LawScoringWeakness = {compute, lossTypes, timeStats, lawyerMcq, rawLawyerMcq, isGraded, chapterTokens, readStore, rawStore, LOW, MIN, GUAN_W, TOP, LOSS_SLUGS};
})();
