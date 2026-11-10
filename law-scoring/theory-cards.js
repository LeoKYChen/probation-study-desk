/* 理論卡：把犯罪學、心理學、諮商與輔導三科重點整理的每個要點（條列項目開頭的粗體標題）做成一張短卡，
   給通勤模式用。內容完全取自重點整理，不另外撰寫；排程沿用考點回想（topic-recall.js）與失分回想卡的間隔。
   紀錄另存在 lawScoring.theoryCards.v1，格式與考點回想相同；自評紀錄與考點回想的紀錄都不會被更動。 */
(function () {
'use strict';
const KEY = 'lawScoring.theoryCards.v1';
const SUBJECTS = ['criminology', 'psychology', 'counseling'];
const NEW_PER_DAY = 10;
const LEAD = /^\*\*([^*]+)\*\*/;

// 一科的重點整理 → 理論卡。每個有粗體標題的條列項目是一張卡；所屬考點（h3）放在卡片正面，沒有 h3 的章以章名代替。
function cardsOf(d) {
  const out = [], seen = new Map();
  d.sections.forEach((sec, si) => {
    if (sec.count == null) return;
    const chapter = sec.title.replace(/（\d+ 題）$/, '');
    let topic = '', src = '';
    sec.blocks.forEach(b => {
      if (b.t === 'h3') { topic = b.text; src = ''; return; }
      if (b.t === 'p' && b.text.startsWith('出題：')) { if (!src) src = b.text; return; }
      if (b.t !== 'ul' && b.t !== 'ol') return;
      b.items.forEach(it => {
        const m = LEAD.exec(it.text); if (!m) return;
        const label = m[1].replace(/[：:]\s*$/, '').trim(); if (!label) return;
        const base = d.slug + '|' + (topic || chapter) + '|' + label, n = (seen.get(base) || 0) + 1; seen.set(base, n);
        const own = (it.text.match(/觀護\d{3}-\d/g) || []).length;
        out.push({id: n > 1 ? base + '#' + n : base, slug: d.slug, subject: d.subject, section: sec.id, sectionIndex: si, chapter, topic, label, src,
          guan: own || (src.replace(/（[^）]*）/g, '').match(/觀護\d{3}-\d/g) || []).length, item: it, index: out.length});
      });
    });
  });
  return out;
}
// 儲存格式與考點回想相同：最上層是「卡片 id → 紀錄」，設定放在 __ 開頭的鍵。
function unpack(s) {
  s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  const cards = {};
  for (const k of Object.keys(s)) if (!k.startsWith('__') && s[k] && typeof s[k] === 'object' && typeof s[k].due === 'string' && Array.isArray(s[k].reviews)) cards[k] = s[k];
  return {cards, subjects: Array.isArray(s.__subjects) ? s.__subjects.filter(x => SUBJECTS.includes(x)) : null};
}
function pack(state) { const out = Object.assign({}, state.cards); if (state.subjects && state.subjects.length) out.__subjects = state.subjects; return out; }
function readState() { let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} return unpack(s); }

window.LawScoringTheoryCards = {KEY, SUBJECTS, NEW_PER_DAY, cardsOf, unpack, pack, readState};
})();
