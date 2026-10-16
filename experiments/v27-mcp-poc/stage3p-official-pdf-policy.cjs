"use strict";
/**
 * Stage3p (OFFLINE ONLY): Judicial Yuan PDF source/lifecycle planning gates.
 *
 * This module never performs HTTP, downloads PDFs, processes judgments,
 * authenticates to any official API or allows deployment. Its inputs are
 * untrusted planning fixtures, NOT judicial-source authorization evidence.
 *
 * Primary materials for the policy statements:
 * - https://opendata.judicial.gov.tw/api/Newses/42/file (114.08.22 API spec)
 * - https://www.judicial.gov.tw/tw/communique/dl-115081-23e72637eb1d41f7b7606d097f3f0a52.html
 * - https://judgment.judicial.gov.tw/readme.aspx
 */
const { inOfficialApiWindow, OFFICIAL_PORTAL } = require("./stage3g-official-source-gate.cjs");

const OFFICIAL_API_DOCUMENTATION = "https://opendata.judicial.gov.tw/api/Newses/42/file";
const OFFICIAL_USAGE_NORMS = "https://www.judicial.gov.tw/tw/communique/dl-115081-23e72637eb1d41f7b7606d097f3f0a52.html";
const COURT_SITE_HELP = "https://judgment.judicial.gov.tw/readme.aspx";
const SOURCE_CATEGORIES = Object.freeze([
  "jdoc_primary_file",
  "jdoc_attachment",
  "website_export_pdf",
  "unattributed_pdf",
  "jdoc_text"
]);
const REPLICA_TARGETS = Object.freeze([
  "primary", "cache", "search_index", "cdn",
  "derived_text", "exports", "backups", "logs"
]);
const READINESS_CHECKS = Object.freeze([
  "registered_membership",
  "member_terms_reviewed",
  "operator_pilot_approval",
  "source_identity_independently_proven",
  "current_publication_verified",
  "independent_same_version_text_reference",
  "independent_same_version_visual_reference",
  "case_sensitive_data_reviewed",
  "isolated_parser_limits_verified",
  "encrypted_transit_and_secret_handling",
  "replica_inventory_approved",
  "withdrawal_and_version_purge_end_to_end_verified",
  "audit_and_backup_expiry_verified"
]);

function cleanUrl(raw, prefix) {
  if (typeof raw !== "string" || raw.length > 1200 || /\s|\\/.test(raw)) return false;
  if (/%2f|%5c|%00|%2e%2e/i.test(raw)) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:"
      && u.hostname === "data.judicial.gov.tw"
      && u.username === "" && u.password === ""
      && u.port === "" && u.search === "" && u.hash === ""
      && u.pathname.startsWith(prefix)
      && u.pathname.length > prefix.length
      && !u.pathname.split("/").includes("..")
      && /\.pdf$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function decision(kind, classification, reason, urlShape = false) {
  return Object.freeze({
    kind, classification, reason,
    matchesDocumentedOfficialEndpointShape: urlShape,
    actualOfficialResponseIndependentlyVerified: false,
    officialAccessRightsIndependentlyVerified: false,
    permissionToDownloadRealPdf: false,
    realPdfFullTextVerified: false,
    publicIndividualCaseUrlAllowed: false,
    courtPdfStored: false,
    safePortalUrl: OFFICIAL_PORTAL
  });
}

function classifyPdfSource(source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return decision("invalid", "blocked", "source_record_invalid");
  }
  if (!SOURCE_CATEGORIES.includes(source.kind)) {
    return decision("invalid", "blocked", "source_kind_unknown");
  }
  if (source.kind === "jdoc_primary_file") {
    if (source.jfulltype !== "file") {
      return decision(source.kind, "blocked", "jfulltype_not_file");
    }
    const valid = cleanUrl(source.jfullpdf, "/jdg/api/JDocFile/");
    return decision(source.kind,
      valid ? "documented_primary_pdf_url_shape" : "blocked",
      valid ? "jdoc_file_field_structurally_recognized_but_not_authenticated"
        : "jfullpdf_path_or_origin_not_supported", valid);
  }
  if (source.kind === "jdoc_attachment") {
    const valid = cleanUrl(source.attachmentUrl, "/jdg/api/JAttFile/")
      || cleanUrl(source.attachmentUrl, "/jdg/api/JFile/");
    return decision(source.kind,
      valid ? "attachment_only" : "blocked",
      valid ? "api_attachment_not_judgment_fulltext" : "attachment_url_untrusted",
      valid);
  }
  if (source.kind === "website_export_pdf") {
    return decision(source.kind, "generated_export_not_independent",
      "court_website_export_is_not_an_independent_official_fulltext_reference");
  }
  if (source.kind === "jdoc_text") {
    return decision(source.kind,
      source.jfulltype === "text" ? "text_is_not_pdf" : "blocked",
      "jdoc_text_field_cannot_substitute_for_pdf_page_integrity");
  }
  return decision(source.kind, "source_not_established",
    "pdf_url_without_documented_authoritative_origin_is_unverified");
}

/**
 * A full set of boolean "paper checkmarks" is NEVER an actual grant to call
 * real court API, because input assertions are not independently authenticated.
 */
function assessPilotReadiness({ source, planningDate, assertions = {} } = {}) {
  const provenance = classifyPdfSource(source);
  let serviceHours = false;
  try {
    serviceHours = inOfficialApiWindow(planningDate);
  } catch {
    serviceHours = false;
  }
  const checks = Object.freeze(READINESS_CHECKS.map(name =>
    Object.freeze({ name, asserted: assertions?.[name] === true,
      authenticatedEvidenceProvided: false })
  ));
  const missing = Object.freeze(checks.filter(x => !x.asserted).map(x => x.name));
  const sourceShapeApproved = provenance.classification
    === "documented_primary_pdf_url_shape";
  return Object.freeze({
    status: !sourceShapeApproved ? "source_blocked"
      : (!serviceHours ? "outside_api_service_window"
      : (missing.length ? "requirements_not_documented"
      : "paper_requirements_only_real_evidence_still_required")),
    officialApiWindowTaipei00To06: serviceHours,
    documentationOnly: true,
    checkCount: checks.length,
    requirements: checks,
    missingAssertions: missing,
    source: provenance,
    actualAuthorizationAuthenticated: false,
    independentOriginalVerified: false,
    permissionToCallRealApi: false,
    permissionToFetchPdf: false,
    permissionToStorePdf: false,
    permitUserProvidedFileUpload: false,
    permitPublicIndividualLink: false,
    allowMergeOrDeployment: false,
    stage3Accepted: false,
    safePortalUrl: OFFICIAL_PORTAL
  });
}

/**
 * Lifecycle mock. The official API says same-JID updates replace prior
 * content; revoked documents are to be deleted. A 403/404 is NOT itself
 * evidence of withdrawal. All acknowledgments here are SYNTHETIC.
 */
function simulateLifecycle({ event, acknowledgments = {}, verifiedReplacement = false } = {}) {
  const recognized = ["withdrawn", "same_jid_updated", "http403",
    "http404", "timeout", "no_new_signal"];
  if (!recognized.includes(event)) {
    return Object.freeze({
      status: "blocked_invalid_event",
      suppressCase: true, actualPurgeProven: false,
      stage3Accepted: false, targetsPending: [...REPLICA_TARGETS]
    });
  }
  if (event === "http403" || event === "http404" || event === "timeout"
      || event === "no_new_signal") {
    return Object.freeze({
      status: "publication_status_unknown",
      reason: "source_unavailability_or_stale_listing_not_formal_withdrawal",
      suppressCase: true, actualPurgeProven: false,
      withdrawnOfficiallyProven: false, stage3Accepted: false,
      targetsPending: []
    });
  }
  const pending = REPLICA_TARGETS.filter(name =>
    acknowledgments?.[name] !== true);
  const withdrawn = event === "withdrawn";
  return Object.freeze({
    status: withdrawn
      ? (pending.length ? "synthetic_purge_pending" : "synthetic_purge_complete")
      : ((pending.length || !verifiedReplacement)
        ? "synthetic_update_pending" : "synthetic_update_invalidation_complete"),
    reason: withdrawn ? "official_removal_requires_deletion"
      : "same_jid_newer_content_replaces_old_version",
    targetsPending: Object.freeze(pending),
    syntheticAcknowledgmentsOnly: true,
    replacementMustBeIndependentlyChecked: !withdrawn,
    replacementIndependentlyProven: false,
    suppressCase: true,
    realOldContentDeleted: false,
    actualPurgeProven: false,
    caseCanBeServedAgain: false,
    stage3Accepted: false
  });
}

module.exports = Object.freeze({
  OFFICIAL_API_DOCUMENTATION, OFFICIAL_USAGE_NORMS,
  COURT_SITE_HELP, OFFICIAL_PORTAL, SOURCE_CATEGORIES,
  REPLICA_TARGETS, READINESS_CHECKS,
  classifyPdfSource, assessPilotReadiness, simulateLifecycle
});
