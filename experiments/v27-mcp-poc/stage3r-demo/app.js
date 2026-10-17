/* Offline, synthetic-only view. DOM textContent prevents interpretation HTML injection. */
(function () {
  'use strict';
  const model = globalThis.Stage3rModel;
  const root = document.getElementById('cards');
  const count = document.getElementById('sample-count');
  if (!model || !root || !count) return;
  const DEMO = Object.freeze([
    {kind:'law',id:'TEST_LAW_SYNTHETIC_A',title:'示範法 A｜修正與施行日分開',
      snapshotOn:'2026-10-02',promulgatedOn:'2026-09-01',effectiveOn:null,
      sampleExcerpt:'合成條文：資料查核時，應分別記錄修正公布日與實際施行規定。'},
    {kind:'law',id:'TEST_LAW_SYNTHETIC_B',title:'示範法 B｜施行日期有欄位',
      snapshotOn:'2026-10-02',promulgatedOn:'2026-08-15',effectiveOn:'2026-09-01',
      sampleExcerpt:'合成條文：即使存在施行日欄位，未有當下官方來源核查，仍不得直接標成現行有效。'},
    {kind:'interpretation',id:'TEST_INTERP_SYNTHETIC_FULL',title:'函釋甲｜官方全文層級',
      issuingAgency:'合成發文機關 A',issuedOn:'2026-02-12',observedOn:'2026-10-15',
      contentLevel:'official_full_text_verified',
      sampleFullText:'人工合成的公文全文示例：此段僅展示「全文」欄位如何標註，並非任何真實官方公文。',
      sampleOfficialAbstract:'人工合成官方要旨示例，不替代全文。',
      siteSummary:'本站整理說明（合成）：即使曾核對全文，函釋現行效力仍須另查。'},
    {kind:'interpretation',id:'TEST_INTERP_SYNTHETIC_ABSTRACT',title:'函釋乙｜僅有官方要旨',
      issuingAgency:'合成發文機關 B',issuedOn:'2024-08-21',observedOn:'2026-10-15',
      contentLevel:'official_abstract_only',
      sampleOfficialAbstract:'人工合成官方要旨示例：本頁沒有公文全文，不得補寫後冒充原文。',
      sampleFullText:'禁止顯示的偽造全文',
      siteSummary:'本站整理說明（合成）：僅有要旨也可以標示，但必須清楚說明是要旨而非全文。'},
    {kind:'interpretation',id:'TEST_INTERP_SYNTHETIC_MISSING',title:'函釋丙｜來源文字尚未取得',
      issuingAgency:'合成發文機關 C',issuedOn:'2023-05-06',observedOn:null,
      contentLevel:'unavailable',
      sampleOfficialAbstract:'這段不應顯示為官方要旨',
      sampleFullText:'這段不應顯示為官方全文',
      siteSummary:'本站自行整理的占位說明（合成），不能作為官方函釋原文。'}
  ]);
  function tag(name, cls, value) {
    const node = document.createElement(name);
    if (cls) node.className = cls;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function field(container, label, value) {
    const div = tag('div', 'field');
    div.append(tag('div', 'field-label', label), tag('div', 'field-value', value));
    container.append(div);
  }
  function notice(container, value) {container.append(tag('p','warning',value));}
  function preview(container, label, value, site) {
    container.append(tag('div','text-label',label));
    container.append(tag('div',site?'preview site':'preview',value));
  }
  function card(view) {
    if (view.status !== 'synthetic_display_only') return null;
    const node = tag('article','card');
    const head = tag('div','card-head');
    head.append(tag('div','kind',view.kind === 'law' ? '法規 · 合成版本示範' : '函釋 · 合成來源示範'));
    head.append(tag('span','tag '+(view.kind === 'law' ? 'demo' : view.tierTone),
      view.kind === 'law' ? '現行效力未核實' : view.contentLabel));
    node.append(head,tag('h3','',view.title));
    const meta = tag('div','card-meta');
    if (view.kind === 'law') {
      field(meta,'來源快照日',view.snapshot.display);
      field(meta,'修正公布日',view.promulgated.display);
      field(meta,'施行日（獨立欄位）',view.effective.display);
      field(meta,'現行法及施行規定',view.validityText);
      node.append(meta);
      preview(node,'條文欄位（合成示例，非官方）',view.excerpt,false);
      notice(node,view.caveat);
      node.append(tag('div','source-line',view.historicalSampleContext));
    } else {
      field(meta,'發文機關',view.issuingAgency);
      field(meta,'發文日期',view.issuedOn.display);
      field(meta,'來源查核日',view.observedOn.display);
      field(meta,'函釋現行效力',view.validityText);
      node.append(meta);
      preview(node,view.officialTextLabel,view.officialTextPreview ||
        '無足夠資料顯示已核對的官方文字。',false);
      preview(node,view.siteSummaryLabel,view.siteSummary,true);
      notice(node,'來源等級僅為合成介面示例；不得由本站摘要推定官方全文或現行效力。');
      node.append(tag('div','source-line',view.historicalSampleContext));
    }
    return node;
  }
  function render(section) {
    const view = model.listView(DEMO, section);
    root.replaceChildren();
    if (view.status !== 'synthetic_display_only') {
      root.append(tag('p','empty','無法顯示未經核對的資料。'));
      count.textContent = '驗證失敗';
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of view.items) {
      const box = card(entry);
      if (box) fragment.append(box);
    }
    root.append(fragment);
    count.textContent = '顯示 ' + view.count + ' 筆人工合成示例 · 沒有連線或取得真實法規資料';
  }
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const selection = button.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach((target) => {
        const selected = target === button;
        target.classList.toggle('is-selected',selected);
        target.setAttribute('aria-pressed',selected ? 'true' : 'false');
      });
      render(selection);
    });
  });
  render('all');
})();