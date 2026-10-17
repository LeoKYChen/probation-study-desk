"use strict";
/**
 * Stage 3q, RESEARCH REVIEW ONLY.
 * Historical evidence ledger and fail-closed v2.7 release decisions. No
 * networking, PDF/HTML handling, web deployment, user data or real case IDs.
 * A passing public source SAMPLE is never live publication, current law or
 * a grant to serve court content. No caller-supplied assertion can change it.
 */
const { OFFICIAL_PORTAL } = require("./stage3g-official-source-gate.cjs");

function deepFreeze(item) {
  if (item && typeof item === "object" && !Object.isFrozen(item)) {
    for (const value of Object.values(item)) deepFreeze(value);
    Object.freeze(item);
  }
  return item;
}

const REVIEWED_AT = "2026-10-16";
const UPSTREAM_COMMIT = "ef677ad63c3206fc211a083fad8b1d9ef5015222";

const EVIDENCE = deepFreeze({
  legislation: {
    status: "sample_verified",
    summary: "20/20 指定法規項目抽樣通過；歷史與修正日期的核對有範圍限制",
    counts: { sampleVerified: 20, sampleTarget: 20 },
    limits: [
      "當日官方法規快照可能過期，不能以舊版冒稱現行法",
      "修正公布日不等於施行日",
      "歷史版本只完整核對部分法條",
      "未驗證長期營運、併發或正式站整合"
    ],
    report: "STAGE1_ACCEPTANCE.md",
    actionRuns: [38705512707, 38706127912]
  },
  interpretations: {
    status: "scope_limited_verified",
    summary: "21/21 中繼資料；17/21 官方全文；4/21 僅官方要旨；效力尚待核對",
    counts: { metadata: 21, sourceFullText: 17, officialAbstractOnly: 4 },
    limits: [
      "僅有官方要旨的 4 件不能標成全文",
      "站方編寫摘要不等於官方原始要旨",
      "尚未驗證任何函釋的現行法律效力",
      "使用者已同意 B 方案的限定範圍驗收，並非同意正式部署"
    ],
    report: "STAGE2_ACCEPTANCE.md",
    actionRuns: [38727447628, 38727736275]
  },
  constitutional: {
    status: "selected_parts_only",
    summary: "3 件選定的憲法解釋／判決抽樣；只比對主文、解釋文片段",
    counts: { selected: 3 },
    limits: [
      "其中釋字 803 的片段命中為 3/4；不能宣稱完整全文通過",
      "理由書、意見書與附件未逐字獨立驗收",
      "原抽樣不能代表憲法法庭全部資料"
    ],
    report: "STAGE3B_FINDINGS.md",
    actionRuns: [38765264966]
  },
  legislative_history: {
    status: "selected_provisions_only",
    summary: "只核對兩項指定法條的三個歷史版本及立法理由",
    counts: { selectedProvisions: 2, checkedVersions: 3 },
    limits: [
      "不能推論其他條文全部立法沿革正確",
      "修正公布日期與施行日期需要分開查核"
    ],
    report: "STAGE3B_FINDINGS.md",
    actionRuns: [38765264966]
  },
  court_html: {
    status: "snapshot_text_verified",
    summary: "原始 10 件、跨年 5 件、長篇 2 件公開裁判之文字擷取分項通過",
    counts: { initialVerified: 10, crossYearVerified: 5, longFormVerified: 2 },
    limits: [
      "文字一致只對測試時擷取到的官方網頁版本成立",
      "不代表現時仍公開、確定、沒有新的上級審或已完成個資審查",
      "不同 PDF、非典型 HTML 及即時撤除未全面驗收",
      "不能因這些樣本一致就開放個別裁判連結"
    ],
    report: "STAGE3M_RESULT.md",
    actionRuns: [38848105281, 38848445006, 38848711214, 38867861922, 38869992254]
  },
  court_history: {
    status: "snapshot_list_verified",
    summary: "原 10 件歷審清單與官方逐欄一致；27 項目中限定抽樣 7 件關聯裁判可回查",
    counts: { parentLists: 10, linkedEntriesListed: 27, relatedCasesChecked: 7 },
    limits: [
      "列出的歷審項目不等於所有審級完整",
      "空清單或最後一筆沒有上級審不表示裁判確定",
      "MCP 清單可快取 24 小時，不能推論即時同步"
    ],
    report: "STAGE3K_RESULT.md",
    actionRuns: [38849436423, 38859510262, 38859737261]
  },
  court_pdf: {
    status: "offline_synthetic_only",
    summary: "PDF 讀取與視覺安全僅有合成 84 項測試；真實司法院 PDF 全文 0 件",
    counts: { syntheticPdfChecks: 84, realOfficialPdfFulltextsVerified: 0 },
    limits: [
      "缺合法可信之真實檔案及同版獨立全文／畫面參考",
      "JDoc 主全文與附件、網站轉存 PDF 不能混淆",
      "未具備使用者 PDF 上傳、解析沙箱及資料清除合規證據"
    ],
    report: "STAGE3P_RESULT.md",
    actionRuns: [38872625315, 38877089435, 38878260693]
  },
  court_publication: {
    status: "mock_only_no_live_verifier",
    summary: "點擊時查核及撤除更新均為合成；沒有真實全天候官方公開狀態驗證",
    counts: { realClickTimePublicationChecks: 0, realPurgeDemonstrations: 0 },
    limits: [
      "官方會員 API 凌晨時段／七日異動資訊不是全天候點擊時狀態",
      "HTTP 403／404／逾時不能推定裁判正式撤除",
      "撤除需完成副本、索引、衍生內容與備份等真實資料管理"
    ],
    report: "STAGE3P_RESULT.md",
    actionRuns: [38840061724, 38878260693]
  },
  case_finality: {
    status: "not_verified",
    summary: "沒有逐案驗證完整歷審與裁判已確定的權威證據",
    counts: { completeFinalityVerifications: 0 },
    limits: ["不得從最後一個歷審項目或空清單推論已確定"],
    report: "STAGE3J_RESULT.md",
    actionRuns: [38849436423]
  }
});

const FEATURE_MAP = deepFreeze({
  law_lookup: {
    evidence: "legislation", readiness: "independent_review_candidate",
    text: "指定法規抽樣已驗；現行版本、施行日及更新須另查"
  },
  interpretation_lookup: {
    evidence: "interpretations", readiness: "limited_scope_review_candidate",
    text: "官方來源分級核對：17 件全文、4 件僅要旨；效力待查"
  },
  constitutional_reference: {
    evidence: "constitutional", readiness: "limited_scope_review_candidate",
    text: "僅指定主文及解釋文抽查；不代表理由書全文"
  },
  legislative_history: {
    evidence: "legislative_history", readiness: "limited_scope_review_candidate",
    text: "僅指定兩條法條之沿革與理由範例完成核對"
  },
  court_html: {
    evidence: "court_html", readiness: "research_snapshot_only",
    text: "公開樣本擷取一致，非當下公開、確定或准許提供個案連結"
  },
  court_history: {
    evidence: "court_history", readiness: "research_snapshot_only",
    text: "抽樣歷審清單一致，不代表完整歷審或確定"
  },
  court_pdf: {
    evidence: "court_pdf", readiness: "blocked_real_source_unverified",
    text: "司法院可能提供 PDF；本站尚未獨立核對全文"
  },
  court_current_publication: {
    evidence: "court_publication", readiness: "blocked_live_verification_absent",
    text: "缺當下可信公開狀態與更新撤除後端驗證"
  },
  court_finality: {
    evidence: "case_finality", readiness: "blocked_finality_unknown",
    text: "裁判是否已確定：尚待查證"
  },
  individual_court_link: {
    evidence: "court_publication", readiness: "blocked_live_verification_absent",
    text: "禁止提供個別裁判連結；只能使用官方通用查詢入口"
  },
  official_court_portal: {
    evidence: null, readiness: "portal_only",
    text: "可供使用者自行至司法院裁判書系統查詢"
  }
});

const PUBLIC_COURT_FEATURES = deepFreeze([
  "court_html", "court_history", "court_pdf", "court_current_publication",
  "court_finality", "individual_court_link"
]);

function featureStatus(featureId) {
  if (typeof featureId !== "string" ||
      !Object.prototype.hasOwnProperty.call(FEATURE_MAP, featureId)) {
    // Caller-controlled text must NEVER be echoed to HTML/JSON output.
    return deepFreeze({
      known: false, status: "blocked_unknown_feature",
      allowProduction: false, allowMerge: false,
      allowIndividualLink: false, allowCourtFullText: false,
      url: OFFICIAL_PORTAL
    });
  }
  const f = FEATURE_MAP[featureId];
  return deepFreeze({
    known: true, id: featureId, status: f.readiness,
    userFacingText: f.text,
    evidence: f.evidence ? EVIDENCE[f.evidence] : null,
    scopeOnly: featureId !== "official_court_portal",
    allowProduction: false, allowMerge: false,
    allowIndividualLink: false, allowCourtFullText: false,
    allowPdfDownload: false, allowLiveApi: false,
    // Every real or synthetic case specific URL is deliberately ignored.
    url: OFFICIAL_PORTAL
  });
}

/**
 * Planning-only gate; a requester's boolean claims and external "evidence"
 * cannot promote historical research to deployment, authorise API credentials,
 * or waive independent official source validation.
 */
function planReview({ features, approvals, evidence, now, candidateLink } = {}) {
  void approvals; void evidence; void now; void candidateLink;
  if (!Array.isArray(features) || features.length > 30 ||
      features.some(x=>typeof x!=="string" ||
        !Object.prototype.hasOwnProperty.call(FEATURE_MAP,x))) {
    return deepFreeze({
      status:"blocked_invalid_scope", features:[],
      reviewable: [], blocked: [],
      allRequestedResearchSubtestsPassed:false,
      productionApproved:false, stage3Accepted:false, canMerge:false,
      canDeploy:false, canUseLiveApi:false, canStoreRealJudgments:false,
      canPublishIndividualCaseLinks:false, url:OFFICIAL_PORTAL
    });
  }
  const ids=[...new Set(features)];
  const reviewable=ids.filter(k=>
    FEATURE_MAP[k].readiness==="independent_review_candidate" ||
    FEATURE_MAP[k].readiness==="limited_scope_review_candidate");
  const blocked=ids.filter(k=>PUBLIC_COURT_FEATURES.includes(k));
  return deepFreeze({
    status: ids.length===0 ? "no_scope_selected" :
      blocked.length ? "court_features_not_release_ready" :
      "research_components_ready_for_separate_review_only",
    features:ids,
    reviewable, blocked,
    allRequestedResearchSubtestsPassed: false,
    productionApproved:false, stage3Accepted:false, canMerge:false,
    canDeploy:false, canUseLiveApi:false, canStoreRealJudgments:false,
    canPublishIndividualCaseLinks:false, url:OFFICIAL_PORTAL
  });
}

function publicCourtPresentation({ format, caseUrl, officialId, verified,
                                  pdfUrl, currentStatus, rawText } = {}) {
  // Even an explicit true caller flag is not independently authenticated.
  void caseUrl; void officialId; void verified; void pdfUrl;
  void currentStatus; void rawText;
  const pdf = format === "pdf";
  const html = format === "html";
  return deepFreeze({
    contentKind: pdf ? "pdf_unverified" :
      html ? "html_prior_sample_only" : "court_source_unverified",
    heading: pdf ? "裁判 PDF 全文尚未核實" :
      html ? "裁判網頁的既有樣本已核對，個案當下公開仍待確認" :
      "裁判來源與格式尚待確認",
    message: pdf ?
      "請至司法院裁判書系統自行查詢；本站沒有完成該 PDF 的獨立全文驗證。" :
      "本站未核對此刻個別裁判的公開、撤除及確定狀態；請至司法院自行查詢。",
    portalUrl:OFFICIAL_PORTAL,
    allowedLinks:deepFreeze([OFFICIAL_PORTAL]),
    embedCourtText:false,caseSpecificUrlReturned:false,
    downloadAllowed:false,currentlyPublishedAsserted:false,
    judgmentFinalAsserted:false,stage3Accepted:false
  });
}

function summary() {
  return deepFreeze({
    asOf:REVIEWED_AT,
    upstreamRevision:UPSTREAM_COMMIT,
    status:"stage3_not_accepted",
    featureNames:Object.keys(FEATURE_MAP),
    findings:EVIDENCE,
    productionApproved:false,
    deploymentPerformed:false,
    officialPortalOnlyForCourt:true,
    sourceRefreshRequiredBeforeProduction:true
  });
}

module.exports = deepFreeze({
  REVIEWED_AT, UPSTREAM_COMMIT, OFFICIAL_PORTAL, EVIDENCE,
  FEATURE_MAP, PUBLIC_COURT_FEATURES,
  featureStatus, planReview, publicCourtPresentation, summary
});
