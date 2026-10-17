"use strict";
/**
 * Stage3s: source -> UI TRUST-BOUNDARY CONTRACT, OFFLINE SYNTHETIC FIXTURES.
 *
 * The fixed fixture registry is an offline test oracle, NEVER a real official
 * source of authority. Neither user-supplied "verified" nor a URL-looking-
 * official can mint a trusted legal record. These methods do no HTTP/IO,
 * and intentionally NEVER certify a live law, interpretation or release.
 */
const crypto = require("node:crypto");

const CONTRACT_VERSION = "stage3s-source-ui-v1";
const MODEL_REVIEWED_AT = "2026-10-17";
const SYNTHETIC_BASE = "https://fixtures.stage3s.invalid";
const SOURCE_KINDS = Object.freeze(["law", "interpretation"]);
const CONTENT_TIERS = Object.freeze(["official_full_text_verified", "official_abstract_only", "unavailable"]);

function deepFreeze(x) {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    for (const v of Object.values(x)) deepFreeze(v);
    Object.freeze(x);
  }
  return x;
}

const FIXTURES = deepFreeze({
  TEST_LAW_SYNTHETIC_V1: {
    kind: "law",
    id: "TEST_LAW_SYNTHETIC_V1",
    sourceUrl: SYNTHETIC_BASE + "/law/TEST_LAW_SYNTHETIC_V1",
    sourceVersion: "TEST_VERSION_20260901",
    observedAt: "2026-10-02T12:15:00+08:00",
    title: "示範法律－資料透明條款",
    promulgatedOn: "2026-09-01",
    commencementOn: null,
    commencementRule: "施行日期由合成來源另定；不由修正公布日推算。",
    transitionalRule: null,
    text: "合成條文：修正公布與法律施行，應作個別日期及版本紀錄。",
    effectiveScope: "unknown"
  },
  TEST_LAW_SYNTHETIC_V2: {
    kind: "law",
    id: "TEST_LAW_SYNTHETIC_V2",
    sourceUrl: SYNTHETIC_BASE + "/law/TEST_LAW_SYNTHETIC_V2",
    sourceVersion: "TEST_VERSION_20261001",
    observedAt: "2026-10-03T09:45:00+08:00",
    title: "示範法律－過渡規定條款",
    promulgatedOn: "2026-10-01",
    commencementOn: "2026-10-15",
    commencementRule: "合成資料提供施行日期；不代表現行版本驗證。",
    transitionalRule: "合成過渡規定：特定情況另待查詢。",
    text: "合成條文：法條施行日與行為時法的適用，應分別查核。",
    effectiveScope: "unknown"
  },
  TEST_INTERP_SYNTHETIC_FULL: {
    kind: "interpretation",
    id: "TEST_INTERP_SYNTHETIC_FULL",
    sourceUrl: SYNTHETIC_BASE + "/interpretation/TEST_INTERP_SYNTHETIC_FULL",
    sourceVersion: "TEST_DOC_A",
    observedAt: "2026-10-15T11:00:00+08:00",
    issuingAgency: "合成發文機關甲",
    issueNumber: "合成字第 001 號",
    issuedOn: "2024-08-07",
    contentTier: "official_full_text_verified",
    fullText: "人工合成公文全文：這並不是實際行政函釋。",
    officialAbstract: "人工合成原始要旨：這不是官方實際要旨。",
    legalEffectLabel: "unknown"
  },
  TEST_INTERP_SYNTHETIC_ABSTRACT: {
    kind: "interpretation",
    id: "TEST_INTERP_SYNTHETIC_ABSTRACT",
    sourceUrl: SYNTHETIC_BASE + "/interpretation/TEST_INTERP_SYNTHETIC_ABSTRACT",
    sourceVersion: "TEST_DOC_B",
    observedAt: "2026-10-15T11:10:00+08:00",
    issuingAgency: "合成發文機關乙",
    issueNumber: "合成字第 002 號",
    issuedOn: "2023-07-19",
    contentTier: "official_abstract_only",
    fullText: null,
    officialAbstract: "人工合成官方要旨：原始公文全文未取得。",
    legalEffectLabel: "unknown"
  }
});

const ACCEPTED_IDS = Object.freeze(Object.keys(FIXTURES));
const HASH_FIELDS = Object.freeze([
  "kind", "id", "sourceUrl", "sourceVersion", "observedAt",
  "title", "promulgatedOn", "commencementOn", "commencementRule",
  "transitionalRule", "text", "effectiveScope", "issuingAgency",
  "issueNumber", "issuedOn", "contentTier", "fullText",
  "officialAbstract", "legalEffectLabel"
]);
function fingerprint(x) {
  const canonical = HASH_FIELDS.map(k => [k, Object.prototype.hasOwnProperty.call(x, k) ? x[k] : null]);
  return crypto.createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
const DIGESTS = deepFreeze(Object.fromEntries(
  Object.entries(FIXTURES).map(([key, value]) => [key, fingerprint(value)])
));

function isoDate(x) {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const [y, m, d] = x.split("-").map(Number);
  if (y < 1900 || y > 2100) return false;
  const timestamp = new Date(Date.UTC(y, m - 1, d));
  return timestamp.getUTCFullYear() === y && timestamp.getUTCMonth() === m - 1
    && timestamp.getUTCDate() === d;
}
function isoTime(x) {
  if (typeof x !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(x)) return false;
  const day = x.slice(0, 10);
  const hh = Number(x.slice(11, 13)), mm = Number(x.slice(14, 16)), ss = Number(x.slice(17, 19));
  const tz = x.slice(19), tzh = tz === "Z" ? 0 : Number(tz.slice(1,3)),
    tzm = tz === "Z" ? 0 : Number(tz.slice(4,6));
  return isoDate(day) && hh <= 23 && mm <= 59 && ss <= 59
    && tzh <= 14 && tzm <= 59 && (tzh < 14 || tzm === 0)
    && !Number.isNaN(Date.parse(x));
}
function fixtureUrl(x, expected) {
  if (typeof x !== "string" || x !== expected ||
      x.includes("@") || x.includes("?") || x.includes("#")) return false;
  try {
    const u = new URL(x);
    return u.protocol === "https:" && u.hostname === "fixtures.stage3s.invalid"
      && u.username === "" && u.password === "" && u.port === "";
  } catch { return false; }
}
const DENIED = deepFreeze({
  status: "review",
  sourceClassification: "untrusted_or_unavailable",
  fixtureIdentityConfirmed: false,
  presentFullText: false,
  authorizedOfficialSource: false,
  currentLawVerified: false,
  currentInterpretationEffectVerified: false,
  canServeProduction: false,
  allowIndividualCourtCase: false,
  evidence: null,
  stage3Accepted: false
});
function deny(reason) {
  // Reasons are fixed internal categories; never echo untrusted input.
  return deepFreeze({...DENIED, reason});
}

/**
 * The test oracle compares every source-supported field, not just a caller's
 * booleans or a PDF/source URL. Every real ID is explicitly unsupported.
 * A hash only proves equality against OUR frozen synthetic fixture.
 */
function inspectRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return deny("record_not_object");
  if (typeof raw.id !== "string" ||
      !Object.prototype.hasOwnProperty.call(FIXTURES, raw.id)) {
    return deny("unknown_or_non_synthetic_record");
  }
  const known = FIXTURES[raw.id];
  if (!SOURCE_KINDS.includes(raw.kind) || raw.kind !== known.kind) return deny("record_kind_mismatch");
  if (!fixtureUrl(raw.sourceUrl, known.sourceUrl)) return deny("source_origin_or_path_untrusted");
  if (!isoTime(raw.observedAt)) return deny("observation_time_invalid");
  if (!isoDate(raw.kind === "law" ? raw.promulgatedOn : raw.issuedOn))
    return deny("legal_date_invalid");
  if (raw.kind === "law") {
    if (raw.commencementOn !== null && !isoDate(raw.commencementOn))
      return deny("commencement_date_invalid");
    if (raw.effectiveScope !== "unknown") return deny("effective_scope_requires_independent_proof");
  } else {
    if (!CONTENT_TIERS.includes(raw.contentTier)) return deny("invalid_content_tier");
    if (raw.legalEffectLabel !== "unknown") return deny("legal_effect_requires_independent_proof");
    if (raw.contentTier === "official_abstract_only" && raw.fullText !== null)
      return deny("abstract_only_cannot_contain_full_text");
  }
  if (fingerprint(raw) !== DIGESTS[raw.id]) return deny("synthetic_fixture_content_or_version_changed");
  return deepFreeze({
    status: "synthetic_fixture_checked",
    sourceClassification: "offline_fixture_equal_to_pinned_snapshot",
    fixtureIdentityConfirmed: true,
    kind: known.kind,
    // The record's synthetic data are copied from a trusted-in-test fixture,
    // NEVER directly echoed from untrusted raw.
    fixture: known,
    evidence: deepFreeze({
      type: "synthetic_fixture_digest_match",
      digest: DIGESTS[known.id],
      sourceVersion: known.sourceVersion,
      checkedAt: known.observedAt,
      realOfficialSourceAuthenticated: false,
      officialPermissionVerified: false,
      currentEffectProven: false
    }),
    presentFullText: known.kind === "interpretation"
      && known.contentTier === "official_full_text_verified",
    authorizedOfficialSource: false,
    currentLawVerified: false,
    currentInterpretationEffectVerified: false,
    canServeProduction: false,
    allowIndividualCourtCase: false,
    stage3Accepted: false
  });
}
function toReviewCard(raw, userSuppliedSummary = null) {
  void userSuppliedSummary;
  const inspected = inspectRecord(raw);
  if (inspected.status !== "synthetic_fixture_checked") return deny(inspected.reason);
  const f = inspected.fixture;
  const base = {
    status: "synthetic_display_only",
    id: f.id,
    kind: f.kind,
    title: f.title || "合成函釋示例",
    snapshotTime: f.observedAt,
    sourceVersion: f.sourceVersion,
    sourceProofType: inspected.evidence.type,
    sourceClassification: inspected.sourceClassification,
    authorizedOfficialSource: false,
    currentLawVerified: false,
    currentInterpretationEffectVerified: false,
    fromRealOfficialResponse: false,
    stage3Accepted: false,
    canServeProduction: false
  };
  if (f.kind === "law") return deepFreeze({
    ...base,
    snapshotOn: f.observedAt.slice(0,10),
    promulgatedOn: f.promulgatedOn,
    commencementOn: f.commencementOn,
    commencementRule: f.commencementRule,
    transitionalRule: f.transitionalRule,
    effectiveScope: "unknown",
    effectiveDateInferred: false,
    sampleExcerpt: f.text,
    officialVersionCheckedToday: false,
    presentAsCurrentLaw: false
  });
  return deepFreeze({
    ...base,
    issuingAgency: f.issuingAgency,
    issueNumber: f.issueNumber,
    issuedOn: f.issuedOn,
    observedOn: f.observedAt.slice(0,10),
    contentLevel: f.contentTier,
    sampleFullText: f.contentTier === "official_full_text_verified" ? f.fullText : null,
    sampleOfficialAbstract: f.officialAbstract,
    siteSummary: "合成站方整理文字，非官方函釋原文或要旨。",
    canPromoteSummaryToOfficialOriginal: false,
    legalEffect: "unverified",
    currentValidityDetermined: false,
    originalDocumentComplete: f.contentTier === "official_full_text_verified"
  });
}
function toStage3rModelInput(raw) {
  const card = toReviewCard(raw);
  if (card.status !== "synthetic_display_only") return null;
  if (card.kind === "law") {
    return deepFreeze({
      kind: "law", id: card.id, title: card.title,
      snapshotOn: card.snapshotOn, promulgatedOn: card.promulgatedOn,
      effectiveOn: card.commencementOn, sampleExcerpt: card.sampleExcerpt,
      verified: false, currentValidityVerified: false
    });
  }
  return deepFreeze({
    kind: "interpretation", id: card.id, title: card.title,
    issuingAgency: card.issuingAgency, issuedOn: card.issuedOn,
    observedOn: card.observedOn, contentLevel: card.contentLevel,
    sampleFullText: card.sampleFullText,
    sampleOfficialAbstract: card.sampleOfficialAbstract,
    siteSummary: card.siteSummary,
    validityReview: "unverified"
  });
}
function schemaReview() {
  return deepFreeze({
    contractVersion: CONTRACT_VERSION,
    asOf: MODEL_REVIEWED_AT,
    supportedRecordKinds: SOURCE_KINDS,
    sourceRecordIdentifiers: ACCEPTED_IDS,
    syntheticFixtureCount: ACCEPTED_IDS.length,
    onlySyntheticFixtures: true,
    realOfficialFieldNamesEndToEndMapped: false,
    realOfficialRetrievalValidated: false,
    currentLawAndInterpretationEffectAuthenticated: false,
    memberApiCredentialsUsed: false,
    actualPdfDownloads: 0,
    releasesAuthorized: false,
    stage3Accepted: false
  });
}
module.exports = deepFreeze({
  CONTRACT_VERSION, MODEL_REVIEWED_AT, SOURCE_KINDS, CONTENT_TIERS,
  ACCEPTED_IDS, FIXTURES, DIGESTS,
  isoDate, isoTime, fingerprint, inspectRecord, toReviewCard,
  toStage3rModelInput, schemaReview
});
