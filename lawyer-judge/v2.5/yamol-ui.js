/* Only public question keywords are sent when an external link is clicked. */
window.yamolSearchUrl = function(question) {
  const excerpt = String(question.body || '').replace(/\s+/g, ' ').slice(0, 55);
  return 'https://www.google.com/search?q=' + encodeURIComponent('site:yamol.tw ' + question.year + ' ' + question.subject + ' ' + excerpt);
};
window.renderYamolLinks = function(question) {
  const el = id => document.getElementById(id);
  const record = window.YAMOL_LINKS?.[question.id];
  const links = record?.links || [];
  el('yamolGuide').hidden = false;
  el('yamolPartLinks').replaceChildren();
  el('yamolPaperLink').hidden = !record?.paperUrl;
  if(record?.paperUrl) el('yamolPaperLink').href = record.paperUrl;
  if(record?.status === 'verified' && links.length) {
    el('yamolQuestionLink').href = links[0].url;
    el('yamolQuestionLink').textContent = '查看阿摩本題／討論 ↗';
    el('yamolLinkStatus').textContent = '已核對題幹' + (links.length > 1 ? '；分為 ' + links.length + ' 個子題' : '') + '。擬答與討論為參考資料，非官方標準答案。';
    links.slice(1).forEach((link,index) => {
      const a = document.createElement('a');
      a.href = link.url; a.textContent = '子題 ' + (index+2) + ' ↗';
      a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'shuati-fallback';
      el('yamolPartLinks').appendChild(a);
    });
  } else if(record?.status === 'paper_verified' && record.paperUrl) {
    el('yamolQuestionLink').href = record.paperUrl;
    el('yamolQuestionLink').textContent = '查看阿摩對應試卷 ↗';
    el('yamolPaperLink').hidden = true;
    el('yamolLinkStatus').textContent = '已確認對應試卷；本題尚未完成題幹配對。擬答與討論為參考資料。';
  } else {
    el('yamolQuestionLink').href = window.yamolSearchUrl(question);
    el('yamolQuestionLink').textContent = '搜尋阿摩相關題目 ↗';
    el('yamolLinkStatus').textContent = '本題尚未確認阿摩對應頁面；以公開題幹搜尋。搜尋結果需自行核對。';
  }
};
