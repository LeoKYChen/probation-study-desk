/* v2.5.4 compact reading layout. Presentation only: no study data, storage, or grading logic. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const mk = (tag, cls, txt) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (txt !== undefined) node.textContent = txt;
    return node;
  };
  function setHeading(selector, expected, replacement) {
    const heading = document.querySelector(selector);
    if (heading && heading.textContent.trim() === expected) heading.textContent = replacement;
  }
  function setup() {
    const daily = document.querySelector('section.daily-card');
    if (!daily || document.querySelector('.clean-study-shell')) return;
    const essay = $('dailyEssayPanel');
    const parent = daily.parentElement;
    if (!parent) return;

    // One unified workspace; moving the existing nodes preserves their event handlers,
    // editors, current draft, autosave bindings, and the original form field IDs.
    const shell = mk('div', 'clean-study-shell');
    const dailyCol = mk('div', 'clean-study-main');
    const essayCol = mk('div', 'clean-study-side');
    parent.insertBefore(shell, daily);
    shell.append(dailyCol, essayCol);
    dailyCol.append(daily);
    if (essay) essayCol.append(essay);

    const nav = mk('nav', 'clean-study-nav');
    nav.setAttribute('aria-label', '頁面導覽');
    const navItems = [
      ['今日練習', 'cleanDaily'],
      ['學習分析', 'cleanInsights'],
      ['備份與還原', 'cleanBackup']
    ];
    for (const [label, target] of navItems) {
      const a = mk('a', '', label);
      a.href = '#' + target;
      nav.append(a);
    }
    shell.before(nav);
    daily.id = 'cleanDaily';

    // Group, but do not hide, pre-existing study analysis panels or status messages.
    const insightParts = [
      document.querySelector('.weakness-priority-panel'),
      document.querySelector('.v254-panel'),
      document.querySelector('.essay-analytics-panel')
    ].filter(Boolean);
    if (insightParts.length) {
      const insightGroup = mk('section', 'clean-insights');
      insightGroup.id = 'cleanInsights';
      insightGroup.setAttribute('aria-label', '學習分析');
      insightGroup.append(mk('h2', 'clean-group-heading', '學習分析'));
      shell.after(insightGroup);
      for (const panel of insightParts) insightGroup.append(panel);
    } else {
      nav.querySelector('a[href="#cleanInsights"]')?.remove();
    }

    const health = document.querySelector('.data-health-panel');
    const backup = document.querySelector('.backup-import-panel');
    if (health || backup) {
      const group = document.createElement('details');
      group.className = 'clean-backup';
      group.id = 'cleanBackup';
      const heading = mk('summary', '', '備份與還原');
      group.append(heading);
      const inner = mk('div', 'clean-backup-content');
      group.append(inner);
      (document.querySelector('.clean-insights') || shell).after(group);
      if (health) inner.append(health);
      if (backup) inner.append(backup);
    } else {
      nav.querySelector('a[href="#cleanBackup"]')?.remove();
    }

    // Keep legal warnings and critical restore confirmation instructions intact.
    setHeading('#v254Heading', '七科學習診斷與弱點追蹤', '七科學習分析');
    setHeading('#essayAnalyticsHeading', '申論能力成長統計', '申論成長');
    setHeading('#weaknessPriorityHeading', '今日弱點優先建議', '今日複習重點');
    setHeading('#backupImportHeading', '學習紀錄 JSON 匯入／還原', '匯入與還原');
    setHeading('#dataHealthHeading', '學習紀錄健康檢查', '資料狀態');

    // Remove only repeated decorative metadata, not source counts or disclaimers.
    document.querySelectorAll('.v254-panel .eyebrow, .essay-analytics-panel .eyebrow, .weakness-priority-panel .eyebrow')
      .forEach(n => { n.hidden = true; });
    const duplicateIntro = essay?.querySelector(':scope > p.tiny.muted');
    if (duplicateIntro?.textContent.includes('此處直接沿用')) duplicateIntro.hidden = true;

    const subjectSummary = $('questionSourceSummary');
    if (subjectSummary) {
      // Status remains visible if either source count is incomplete or different.
      if (subjectSummary.dataset.complete === 'true') subjectSummary.classList.add('clean-source-ok');
      const observer = new MutationObserver(() => {
        subjectSummary.classList.toggle('clean-source-ok', subjectSummary.dataset.complete === 'true');
      });
      observer.observe(subjectSummary, {attributes:true, attributeFilter:['data-complete']});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();