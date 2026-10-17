/* v2.5.2: rule-based review scheduling. All results come from user's own ratings. */
(function (root) {
  'use strict';
  const ratings = new Set(['mastered', 'partial', 'review']);
  const MS_DAY = 86400000;
  function dateIndex(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return NaN;
    const millis = Date.parse(iso + 'T00:00:00Z');
    return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === iso ? Math.floor(millis / MS_DAY) : NaN;
  }
  function addDays(iso, days) {
    return new Date((dateIndex(iso) + days) * MS_DAY).toISOString().slice(0, 10);
  }
  function canonicalSubject(q) {
    const raw = String(q?.subjectGroup || q?.subject || '其他考科').trim();
    return raw.replace(/[（(].*?[）)]/g, '').trim() || '其他考科';
  }
  function topic(q) {
    const title = String(q?.title || '').trim();
    // Titles are manually written descriptors in the original past-paper bank.
    const delimiter = title.includes('｜') ? '｜' : title.includes('｜') ? '｜' : '|';
    const parts = title.split(delimiter);
    let value = parts.length > 1 ? parts.slice(1).join('｜') : title;
    value = value.replace(/^\s*\d{2,3}\s*年?\s*第\s*\d+\s*題\s*[：:－\-]?\s*/, '').trim();
    if (!value || /^第\d+題/.test(value) || /^.{0,12}…$/.test(value)) {
      value = '第' + String(q?.questionNo || '?') + '題｜考點待歸類';
    }
    return value.length > 55 ? value.slice(0, 52) + '…' : value;
  }
  function nextInterval(rating, prev) {
    if (rating === 'review') return 1;
    if (rating === 'partial') return 3;
    if (prev?.rating !== 'mastered') return 7;
    return prev.interval >= 14 ? 30 : 14;
  }
  function model(sessions, bank, now) {
    const questions = new Map(bank.map(q => [String(q.id), q]));
    const history = new Map();
    for (const [date, item] of Object.entries(sessions || {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (!Number.isFinite(dateIndex(date)) || dateIndex(date) > dateIndex(now) || !item || !ratings.has(item.rating) || !item.questionId) continue;
      const id = String(item.questionId);
      const q = questions.get(id);
      if (!q) continue;
      const previous = history.get(id);
      const interval = nextInterval(item.rating, previous);
      history.set(id, {
        id, title: String(q.title || '歷屆題'), subject: canonicalSubject(q), topic: topic(q),
        date, rating: item.rating, interval, due: addDays(date, interval),
        attempts: (previous?.attempts || 0) + 1,
        cause: item.errorCause || '', sourceUrl: q.sourceUrl || ''
      });
    }
    const all = Array.from(history.values()).map(r => ({...r, daysUntil: dateIndex(r.due) - dateIndex(now)}));
    const urgency = r => r.rating === 'review' ? 0 : r.rating === 'partial' ? 1 : 2;
    const sorted = (a, b) => a.daysUntil - b.daysUntil || urgency(a) - urgency(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    const due = all.filter(r => r.daysUntil <= 0).sort(sorted);
    const upcoming = all.filter(r => r.daysUntil > 0).sort(sorted);
    const subjects = new Map();
    const topics = new Map();
    for (const r of all) {
      for (const [map, key, label] of [[subjects, r.subject, r.subject], [topics, r.subject + '|' + r.topic, r.topic]]) {
        if (!map.has(key)) map.set(key, {label, subject:r.subject, studied:0, mastered:0, partial:0, review:0, overdue:0});
        const cell = map.get(key);
        cell.studied++;
        cell[r.rating]++;
        if (r.daysUntil <= 0) cell.overdue++;
      }
    }
    return {
      all, due, upcoming,
      weak: all.filter(r => r.rating !== 'mastered').sort(sorted),
      subjects: Array.from(subjects.values()).sort((a,b) => (b.review+b.partial)/b.studied - (a.review+a.partial)/a.studied || b.studied-a.studied),
      topics: Array.from(topics.values()).sort((a,b)=>b.overdue-a.overdue || (b.review+b.partial)-(a.review+a.partial))
    };
  }
  function chooseDue(sessions, bank, date, target, sunday) {
    const result = model(sessions, bank, date);
    const available = sunday ? result.due : result.due.filter(r => r.subject === target || (r.subject === '刑事訴訟法與保安處分執行法' && ['刑事訴訟法', '保安處分執行法'].includes(target)));
    return available[0]?.id || null;
  }
  root.Study30Review = { model, topic, canonicalSubject, nextInterval, addDays, dateIndex, chooseDue };
})(window);
