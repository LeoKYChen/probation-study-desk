/* v2.7 Stage 3f — synthetic-only, browser and Node compatible. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.Stage3fModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PORTAL_URL = 'https://judgment.judicial.gov.tw/FJUD/';
  const TICKET_LIFETIME_MS = 60_000;
  const SYNTHETIC_FIXTURES = Object.freeze([
    Object.freeze({ id: 'SYNTHETIC_A', title: '合成案例 A', topic: '竊盜', status: 'confirmed', hint: '假設已經完成官方原文、案件識別碼與公開狀態檢查。' }),
    Object.freeze({ id: 'SYNTHETIC_B', title: '合成案例 B', topic: '詐欺', status: 'pending', hint: '來源尚不足以獨立確認，不能提供個別裁判連結。' }),
    Object.freeze({ id: 'SYNTHETIC_C', title: '合成案例 C', topic: '偽造文書', status: 'withdrawn', hint: '模擬官方撤除或不再公開，禁止提供個別裁判連結。' }),
    Object.freeze({ id: 'SYNTHETIC_D', title: '合成案例 D', topic: '竊盜', status: 'unavailable', hint: '官方來源目前無法驗證，不能認定不存在或仍公開。' })
  ]);
  const STATUS = Object.freeze({
    confirmed: Object.freeze({ label: '模擬已核對', description: '仍須點擊時重新查證', css: 'confirmed' }),
    pending: Object.freeze({ label: '待驗證', description: '不得顯示個案深連結', css: 'pending' }),
    withdrawn: Object.freeze({ label: '已撤除／不公開（模擬）', description: '封鎖個案深連結', css: 'withdrawn' }),
    unavailable: Object.freeze({ label: '來源暫無法查證', description: '僅提供官方通用入口', css: 'unavailable' })
  });
  const OUTCOMES = Object.freeze(['still_public', 'withdrawn', 'unavailable']);

  function createDemoEngine({ now = () => Date.now() } = {}) {
    if (typeof now !== 'function') throw new TypeError('Clock must be a function');
    const overrides = new Map();
    const tickets = new Map();
    let ticketCount = 0;

    function timestamp() {
      const ms = Number(now());
      if (!Number.isSafeInteger(ms) || ms < 0) throw new Error('Invalid demo clock');
      return ms;
    }
    function stateOf(id) {
      const fixture = SYNTHETIC_FIXTURES.find((item) => item.id === id);
      if (!fixture) return null;
      return overrides.get(id) || fixture.status;
    }
    function list({ topic = 'all', status = 'all' } = {}) {
      if (topic !== 'all' && !['竊盜', '詐欺', '偽造文書'].includes(topic)) throw new Error('Unsupported synthetic topic');
      if (status !== 'all' && !Object.hasOwn(STATUS, status)) throw new Error('Unsupported status');
      return Object.freeze(SYNTHETIC_FIXTURES
        .filter(item => (topic === 'all' || item.topic === topic))
        .map(item => Object.freeze({
          id: item.id, title: item.title, topic: item.topic,
          status: stateOf(item.id),
          hint: stateOf(item.id) === item.status ? item.hint : '此案例已因模擬點擊查核而更新顯示狀態。'
        }))
        .filter(item => status === 'all' || item.status === status));
    }
    function summary() {
      const counts = Object.fromEntries(Object.keys(STATUS).map(s => [s, 0]));
      for (const item of list()) counts[item.status]++;
      return Object.freeze(counts);
    }
    function issue(id) {
      if (stateOf(id) !== 'confirmed') return Object.freeze({ ok: false, reason: 'case_not_eligible' });
      const issuedAt = timestamp();
      ticketCount++;
      const token = 'DEMO_ONCE_' + ticketCount + '_' + issuedAt;
      tickets.set(token, Object.freeze({ id, expiresAt: issuedAt + TICKET_LIFETIME_MS }));
      return Object.freeze({ ok: true, token, ttlSeconds: 60 });
    }
    function redeem(token, outcome) {
      const item = tickets.get(token);
      tickets.delete(token); // consume BEFORE any checks
      if (!item) return Object.freeze({ status: 'blocked_replay', description: '憑證無效或已被使用；未提供個別裁判連結。' });
      if (timestamp() >= item.expiresAt) return Object.freeze({ status: 'blocked_expired', description: '模擬憑證已逾期；請重新執行驗證。' });
      if (stateOf(item.id) !== 'confirmed') return Object.freeze({ status: 'blocked_withdrawn', description: '案件狀態已改變；禁止個別連結。' });
      if (!OUTCOMES.includes(outcome)) return Object.freeze({ status: 'blocked_unavailable', description: '未取得可靠的重新查核結果。' });
      if (outcome === 'withdrawn') {
        overrides.set(item.id, 'withdrawn');
        return Object.freeze({ status: 'blocked_withdrawn', description: '模擬查到撤除／不再公開，個案連結立即封鎖。' });
      }
      if (outcome === 'unavailable') {
        overrides.set(item.id, 'unavailable');
        return Object.freeze({ status: 'blocked_unavailable', description: '模擬官方查證失敗：不推論裁判不存在，只提供官方通用入口。' });
      }
      // This is only a toy result, NEVER a real official or individual deep link.
      return Object.freeze({ status: 'demo_reverified', description: '模擬重新核對成功。正式版本仍需可信後端查證才可導向個別裁判；本展示版不產生個別連結。' });
    }
    function reset() {
      overrides.clear();
      tickets.clear();
      return Object.freeze({ reset: true });
    }
    function diagnostics() {
      // For local synthetic test introspection only, not case-level results.
      return Object.freeze({ synthetic: true, storedCourtTexts: 0, publicIndividualLinks: 0, temporaryTickets: tickets.size });
    }
    return Object.freeze({ list, summary, issue, redeem, reset, diagnostics });
  }
  return Object.freeze({ createDemoEngine, STATUS, OUTCOMES, PORTAL_URL, TICKET_LIFETIME_MS });
});