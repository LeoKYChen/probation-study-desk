/* Stage 3r: synthetic-only source-tier display, works in Node and offline browser. */
(function (root, factory) {
  'use strict';
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else if (root) root.Stage3rModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const AS_OF = '2026-10-17';
  const LIMITS = Object.freeze({
    legislationSamplePassed: 20,
    legislationSampleTarget: 20,
    interpretationMetadataChecked: 21,
    interpretationFullTextChecked: 17,
    interpretationAbstractOnly: 4,
    sourceCurrentValidityIndependentlyVerified: false,
    siteIntegrated: false,
    productionApproved: false,
    stage3Accepted: false
  });
  const LEGAL_CONTENT = Object.freeze({
    official_full_text_verified: Object.freeze({
      code: 'official_full_text_verified',
      label: '全文層級（合成示例）',
      level: '全文欄位（合成文字，非官方實際原文）',
      canCallFullText: true,
      tone: 'verified'
    }),
    official_abstract_only: Object.freeze({
      code: 'official_abstract_only',
      label: '官方要旨層級（合成示例；非全文）',
      level: '官方要旨欄位（合成文字；非公文全文）',
      canCallFullText: false,
      tone: 'caution'
    }),
    unavailable: Object.freeze({
      code: 'unavailable',
      label: '官方文字內容未驗證',
      level: '尚無經核對的官方文字內容',
      canCallFullText: false,
      tone: 'unknown'
    })
  });
  const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
  const LAW_ID_RX = /^TEST_LAW_SYNTHETIC_[A-Z0-9_]{1,20}$/;
  const INTERP_ID_RX = /^TEST_INTERP_SYNTHETIC_[A-Z0-9_]{1,20}$/;
  const MAX_TEXT = 900;

  function validDate(value) {
    if (typeof value !== 'string' || !DATE_RX.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2100) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }
  function safeText(value, fallback = '未提供（合成示例）') {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    return text ? text.slice(0, MAX_TEXT) : fallback;
  }
  function dateField(value, name) {
    return Object.freeze({
      name,
      value: validDate(value) ? value : null,
      display: validDate(value) ? value + '（合成日期；非官方最新資料）' : '未核對／未提供',
      independentlyVerified: false
    });
  }
  function blocked(reason) {
    return Object.freeze({
      status: 'blocked', reason,
      recordAccepted: false, fromOfficialData: false,
      currentlyEffectiveProven: false,
      currentlyApplicableProven: false, productionApproved: false,
      siteSummaryCanSubstituteOfficialText: false,
      currentSourceUrl: null,
      privateDataUsed: false
    });
  }
  function lawCard(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        !LAW_ID_RX.test(row.id || '') || row.kind !== 'law') {
      return blocked('僅接受合成法規示範記錄');
    }
    const snapshot = dateField(row.snapshotOn, '來源快照／擷取日');
    const promulgated = dateField(row.promulgatedOn, '修正公布日');
    const effective = dateField(row.effectiveOn, '施行日');
    const independentEffectiveEvidence = false; // No authenticated official verifier.
    return Object.freeze({
      status: 'synthetic_display_only', id: row.id,
      title: safeText(row.title), kind: 'law',
      sourceLevel: '合成欄位示範；真實法規須另查官方版本',
      snapshot, promulgated, effective,
      excerpt: safeText(row.sampleExcerpt, '合成條文示範；未接入真實官方原文'),
      historicalSampleContext: 'Stage 1 指定樣本 ' + LIMITS.legislationSamplePassed + '/' + LIMITS.legislationSampleTarget + ' 已核對',
      validityText: '現行法版本及施行規定尚待官方核對',
      caveat: '修正公布日不等於施行日；快照日期不代表今日有效版本。',
      currentlyEffectiveProven: independentEffectiveEvidence,
      currentlyApplicableProven: false,
      fromOfficialData: false,
      isActualHistoricalLawSample: false,
      allowedOfficialArticleUrl: null,
      publicTextVerifiedForThisDemo: false,
      productionApproved: false,
      stage3Accepted: false
    });
  }
  function interpretationCard(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        !INTERP_ID_RX.test(row.id || '') || row.kind !== 'interpretation') {
      return blocked('僅接受合成函釋示範記錄');
    }
    const tier = Object.prototype.hasOwnProperty.call(LEGAL_CONTENT, row.contentLevel)
      ? LEGAL_CONTENT[row.contentLevel] : LEGAL_CONTENT.unavailable;
    const full = tier.canCallFullText ? safeText(row.sampleFullText, '') : '';
    const abstract = tier.code !== 'unavailable'
      ? safeText(row.sampleOfficialAbstract, '') : '';
    const hasFull = tier.canCallFullText && full.length > 0;
    const resolvedTier = tier.canCallFullText && !hasFull
      ? LEGAL_CONTENT.unavailable : tier;
    const officialContent = resolvedTier.canCallFullText ? full
      : resolvedTier.code === 'official_abstract_only' ? abstract : '';
    const confirmedLevel = resolvedTier.code === 'official_abstract_only' && !abstract
      ? LEGAL_CONTENT.unavailable : resolvedTier;
    return Object.freeze({
      status: 'synthetic_display_only', id: row.id, kind: 'interpretation',
      title: safeText(row.title),
      issuingAgency: safeText(row.issuingAgency),
      issuedOn: dateField(row.issuedOn, '發文日期'),
      observedOn: dateField(row.observedOn, '來源查核日'),
      contentLevel: confirmedLevel.code,
      contentLabel: confirmedLevel.label,
      tierTone: confirmedLevel.tone,
      officialTextLabel: confirmedLevel.level,
      officialTextPreview: confirmedLevel.code === 'unavailable'
        ? null : officialContent,
      siteSummaryLabel: '本站自行編寫摘要（合成內容；非官方要旨）',
      siteSummary: safeText(row.siteSummary),
      historicalSampleContext: 'Stage 2：21 件中繼資料，17 件官方全文、4 件僅官方要旨（均為歷史抽樣成果）',
      validityText: '現行適用效力尚待查證',
      isCurrentValidityVerified: false,
      canClaimOriginalFullText: confirmedLevel.canCallFullText,
      canPromoteSiteSummaryToOfficialAbstract: false,
      fromOfficialData: false,
      officialRecordLink: null,
      productionApproved: false,
      stage3Accepted: false
    });
  }
  function normalizeRecord(row) {
    if (row?.kind === 'law') return lawCard(row);
    if (row?.kind === 'interpretation') return interpretationCard(row);
    return blocked('未知合成資料類型');
  }
  function listView(records, section = 'all') {
    if (!Array.isArray(records) || records.length > 12) {
      return Object.freeze({status:'blocked',reason:'資料數量或結構無效',items:Object.freeze([])});
    }
    const validSections=['all','law','interpretation'];
    if (!validSections.includes(section)) {
      return Object.freeze({status:'blocked',reason:'未知顯示分類',items:Object.freeze([])});
    }
    const cards=records.filter(r => section === 'all' || r?.kind === section)
      .map(normalizeRecord);
    return Object.freeze({status:'synthetic_display_only',items:Object.freeze(cards),
      count:cards.length,productionApproved:false});
  }
  return Object.freeze({
    AS_OF,LIMITS,LEGAL_CONTENT,validDate,safeText,dateField,
    lawCard,interpretationCard,normalizeRecord,listView
  });
});