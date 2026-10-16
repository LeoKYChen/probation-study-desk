/* Stage 3f browser-only demo. NO fetching, real case identifiers, or persistence. */
(function () {
  'use strict';
  const lib = window.Stage3fModel;
  if (!lib) throw new Error('Demo model failed to load');
  const engine = lib.createDemoEngine();
  const $ = id => document.getElementById(id);
  const resultCards = $('resultCards');
  let lastToken = null;

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content); // textContent, never innerHTML
    return node;
  }
  function statusMessage(message, style) {
    const node = $('verificationStatus');
    node.className = 'verification-status' + (style ? ' ' + style : '');
    node.textContent = message;
  }
  function metrics() {
    const counts = engine.summary();
    $('metricConfirmed').textContent = counts.confirmed;
    $('metricPending').textContent = counts.pending;
    $('metricWithdrawn').textContent = counts.withdrawn;
    $('metricUnavailable').textContent = counts.unavailable;
  }
  function render() {
    const cases = engine.list({ topic: $('topicFilter').value, status: $('statusFilter').value });
    resultCards.replaceChildren();
    $('resultsCount').textContent = '顯示 '+cases.length+' 筆純合成案例，無任何真實裁判資料。';
    if (!cases.length) {
      resultCards.append(element('div', 'empty', '沒有符合條件的合成案例，這不代表真實裁判不存在。'));
    }
    for (const item of cases) {
      const card = element('article', 'case-card');
      const top = element('div', 'card-head');
      const wrapper = element('div');
      wrapper.append(element('h3', 'card-title', item.title));
      wrapper.append(element('span', 'card-subtitle', '模擬主題：'+item.topic+' · 只有教學狀態，沒有案號'));
      top.append(wrapper);
      top.append(element('span', 'status '+lib.STATUS[item.status].css, lib.STATUS[item.status].label));
      card.append(top);
      card.append(element('p', 'case-explanation', item.hint));
      const btn = element('button', 'case-action', item.status === 'confirmed' ? '模擬點擊並重新查核' : '個案連結不可用');
      btn.type = 'button';
      btn.disabled = item.status !== 'confirmed';
      if (!btn.disabled) btn.addEventListener('click', () => checkClick(item.id));
      card.append(btn);
      resultCards.append(card);
    }
    metrics();
  }
  function showResult(result) {
    if (result.status === 'demo_reverified') statusMessage('模擬重新查核成功。' + result.description, 'good');
    else statusMessage('安全封鎖：' + result.description, 'bad');
    render();
  }
  function checkClick(id) {
    // Browser-only illustration. NOT equivalent to the stage3e trusted backend.
    const ticket = engine.issue(id);
    if (!ticket.ok) {
      statusMessage('模擬案件不符合產生個別連結的條件。', 'bad');
      return;
    }
    lastToken = ticket.token;
    const result = engine.redeem(ticket.token, $('outcomeSelect').value);
    $('replayButton').disabled = false;
    showResult(result);
  }
  $('topicFilter').addEventListener('change', render);
  $('statusFilter').addEventListener('change', render);
  $('resetButton').addEventListener('click', () => {
    engine.reset();
    lastToken = null;
    $('topicFilter').value = 'all';
    $('statusFilter').value = 'all';
    $('outcomeSelect').value = 'still_public';
    $('replayButton').disabled = true;
    statusMessage('範例已重設。請從左側選擇模擬已核對的案例。');
    render();
  });
  $('replayButton').addEventListener('click', () => {
    if (!lastToken) return;
    showResult(engine.redeem(lastToken, $('outcomeSelect').value));
  });
  render();
})();