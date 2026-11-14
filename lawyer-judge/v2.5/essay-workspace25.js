(function (root) {
  'use strict';
  // v2.5 考古題：逐題四格草稿。完整申論答案仍沿用既有 issue 欄位。
  var practice = root.Practice25;
  if (!practice || !root.document) return;
  var fields = [
    ['draftIssue', 'issues'],
    ['draftBasis', 'basis'],
    ['draftAnalysis', 'analysis'],
    ['draftConclusion', 'conclusion']
  ];
  var inputs = fields.map(function (pair) { return root.document.getElementById(pair[0]); });
  var counter = root.document.getElementById('draftWordCount');
  var status = root.document.getElementById('saveStatus');
  if (!counter || !status || inputs.some(function (node) { return !node; })) return;

  var shownId = null;
  function currentDrafts() {
    var q = practice.getQuestion();
    var record = q ? practice.getState(q.id) : null;
    var drafts = record && record.essayDrafts;
    return drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
  }
  function countWords() {
    var count = inputs.reduce(function (n, node) {
      return n + node.value.replace(/\s/g, '').length;
    }, 0);
    counter.textContent = '草稿 ' + count + ' 字';
  }
  function sync(force) {
    var q = practice.getQuestion();
    var id = q ? q.id : null;
    if (!force && id === shownId) return;
    shownId = id;
    var drafts = currentDrafts();
    fields.forEach(function (pair, index) {
      inputs[index].value = typeof drafts[pair[1]] === 'string' ? drafts[pair[1]] : '';
      inputs[index].disabled = !id;
    });
    countWords();
    if (!id) return;
    // 不更動既有答案與評分；只有草稿時仍顯示已保存狀態。
    if (Object.values(drafts).some(function (value) { return typeof value === 'string' && value.trim(); })) {
      status.textContent = '四格草稿已儲存在此裝置';
      status.removeAttribute('data-error');
    }
  }
  function saveField(key, node) {
    var q = practice.getQuestion();
    if (!q || q.id !== shownId) { sync(true); return; }
    countWords();
    var records = practice.getRecords();
    var existed = Object.prototype.hasOwnProperty.call(records, q.id);
    var previous = existed ? records[q.id] : null;
    var drafts = Object.assign({}, currentDrafts());
    drafts[key] = node.value;
    try {
      practice.patch({ essayDrafts: drafts });
      status.textContent = '四格草稿已自動儲存在此裝置';
      status.removeAttribute('data-error');
    } catch (error) {
      // 主站 patch 會先更新記憶體、再寫 localStorage；失敗時還原記憶體，避免誤認已保存。
      if (existed) records[q.id] = previous;
      else delete records[q.id];
      status.textContent = '草稿儲存失敗，請先複製文字另存，勿關閉頁面。';
      status.dataset.error = 'true';
    }
  }
  fields.forEach(function (pair, index) {
    inputs[index].addEventListener('input', function () { saveField(pair[1], inputs[index]); });
  });
  root.addEventListener('practice25:render', function () { sync(false); });
  root.addEventListener('backup25:applied', function () { sync(true); });
  root.addEventListener('storage', function (event) {
    if (event.key === 'probation-study-desk-v24') sync(true);
  });
  sync(true);
})(typeof window === 'undefined' ? globalThis : window);
