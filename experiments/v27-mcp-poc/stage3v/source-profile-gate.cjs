"use strict";
/**
 * Stage3v: independently documented XML publication source/profile registry.
 *
 * Documented observations:
 * - MOJ open-data meeting slide p.14, reported 113 (2024):
 *   "兩者內容來源一致...僅XML標籤不同".
 * - data.gov.tw dataset 18289 lists law RAW_XML + ZIP.
 * - schema.gov.tw/lists/96 lists DATA STANDARD names (StatName etc).
 * - Stage3u HEAD request to RAW_XML failed, no actual XML root observed.
 *
 * NO LIVE DOCUMENTS, NO XSD, NO VERIFIED RAW XML TAG MAPPINGS.
 * Any caller supplied document, signature, verified flag, or observed tags
 * is not independently authenticated. Everything production-related blocks.
 */

const RESEARCH_AS_OF = "2026-10-20";
const SRC = Object.freeze({
  RAW: "https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData=CF&DType=RAW_XML",
  ZIP: "https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?DType=XML&AuData=CF",
  GUIDE: "https://law.moj.gov.tw/PublicData/DevelopGuide.aspx",
  STANDARD: "https://schema.gov.tw/lists/96",
  DATASET: "https://data.gov.tw/dataset/18289",
  MOJ_BRIEF: "https://www.moj.gov.tw/media/30228/%E7%B0%A1%E5%A0%B1.pdf?mediaDL=true"
});

const PROFILES = Object.freeze({
  law_site_export: Object.freeze({
    profileId: "law_site_export",
    publicationChannel: "national_law_site",
    evidenceLink: SRC.GUIDE,
    evidenceType: "official_developer_guide_reference_only",
    schemaNameSource: "unverified",
    actualXmlNodesObserved: false,
    parsedRealDocument: false,
    xmlTagFamily: "unknown_law_site",
    sourceIdentityIndependentlyProved: false,
    safelyFetchableSource: false,
    parseAllowed: false
  }),
  open_data_law_raw_xml: Object.freeze({
    profileId: "open_data_law_raw_xml",
    publicationChannel: "government_open_data",
    evidenceLink: SRC.DATASET,
    evidenceType: "official_dataset_distribution_metadata_only",
    schemaNameSource: "unverified",
    actualXmlNodesObserved: false,
    parsedRealDocument: false,
    xmlTagFamily: "unknown_open_data_raw",
    sourceIdentityIndependentlyProved: false,
    safelyFetchableSource: false,
    parseAllowed: false
  }),
  government_law_data_standard: Object.freeze({
    profileId: "government_law_data_standard",
    publicationChannel: "government_schema_standard",
    evidenceLink: SRC.STANDARD,
    evidenceType: "published_data_standard_not_raw_xml_format",
    schemaNameSource: "official_data_standard",
    actualXmlNodesObserved: false,
    parsedRealDocument: false,
    xmlTagFamily: "not_applicable_standard_fields",
    sourceIdentityIndependentlyProved: false,
    safelyFetchableSource: false,
    parseAllowed: false
  })
});

const PUBLICATION_FACTS = Object.freeze({
  commonLegalContentSourceReportedInMojDocument: true,
  xmlElementNamesDifferAcrossChannelsReportedInMojDocument: true,
  mojDocumentEvidenceUrl: SRC.MOJ_BRIEF,
  mojDocumentPeriod: "ROC113_open_data_meeting_material",
  reportScope: "MOJ briefing mentions law.moj.gov.tw versus government open-data XML",
  tagNameExamplesIndependentlyConfirmed: false,
  xsdFoundAndVerified: false,
  currentRealXmlPayloadReceived: false,
  officialRawXmlPrefixObserved: false,
  sameLegalTextAcrossCurrentVersionsVerified: false,
  officialDataStandardIsXmlTagMapping: false
});

const DEFINED_STANDARD_FIELDS = Object.freeze([
  "StatLevel", "StatName", "StatURL", "StatCategory",
  "StatModifiedDate", "StatEffectiveDate", "StatAbandonNote",
  "StatHasEngVersion", "EngStatName", "StatAttachements",
  "StatHistories", "StatContentType", "StatContent", "StatArticles",
  "ArticleType", "ArticleNo", "ArticleContent", "FileName", "FileURL"
]);

function lockDeep(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    for (const value of Object.values(obj)) lockDeep(value);
    Object.freeze(obj);
  }
  return obj;
}

function safeResult(data) {
  return lockDeep(Object.assign({
    sourceVerifiedLive: false,
    urlDownloadAuthorized: false,
    downloadedCurrentRawXml: false,
    officialRawTagNamesAuthenticated: false,
    xmlFullDocumentVerified: false,
    currentLawInForceVerified: false,
    independentSourceVersionComparisonPassed: false,
    canSelectProductionXmlParser: false,
    canMerge: false,
    canDeploy: false,
    canPublishLawAsCurrentlyEffective: false,
    stage3Accepted: false
  }, data));
}

function recognizedSource(rawUrl) {
  // Compare EXACT URLs. No remote redirects, no guesswork, no lookalike host.
  if (typeof rawUrl !== "string" || rawUrl.length > 500) return null;
  if (rawUrl === SRC.RAW) return "open_data_law_raw_xml";
  if (rawUrl === SRC.ZIP) return "open_data_law_zip";
  if (rawUrl === SRC.GUIDE) return "law_site_export";
  if (rawUrl === SRC.STANDARD) return "government_law_data_standard";
  if (rawUrl === SRC.DATASET) return "dataset_listing";
  if (rawUrl === SRC.MOJ_BRIEF) return "source_format_difference_evidence";
  return null;
}

function classifyOfficialReference(sourceUrl) {
  const source = recognizedSource(sourceUrl);
  if (!source) return safeResult({
    status: "blocked_unrecognized_source",
    reason: "not_exact_allowlisted_document_or_distribution",
    role: "unknown"
  });
  let role = "reference_only";
  if (source === "open_data_law_raw_xml") role = "raw_xml_download_address_only";
  else if (source === "open_data_law_zip") role = "archive_distribution_address_only";
  else if (source === "law_site_export") role = "developer_guide_reference_only";
  else if (source === "government_law_data_standard") role = "metadata_standard_only";
  else if (source === "dataset_listing") role = "dataset_listing_only";
  else if (source === "source_format_difference_evidence") role = "official_historical_comparison_slide";
  return safeResult({
    status: "documented_source_role_only",
    sourceId: source,
    role,
    reason: "published_url_role_identified_not_authorized_transport"
  });
}

function assessParserSelection({ sourceUrl, claimedProfile, rootTag,
                                 shallowElements, sourceVersion,
                                 verified, credentials, requestApproved,
                                 authenticatedEvidence } = {}) {
  void rootTag; void shallowElements; void sourceVersion;
  void verified; void credentials; void requestApproved; void authenticatedEvidence;
  const ref = classifyOfficialReference(sourceUrl);
  if (ref.status !== "documented_source_role_only") {
    return safeResult({
      status: "blocked_unknown_source",
      reason: "no_canonical_official_reference",
      profile: "none"
    });
  }
  if (ref.sourceId === "dataset_listing" ||
      ref.sourceId === "source_format_difference_evidence" ||
      ref.sourceId === "government_law_data_standard" ||
      ref.sourceId === "law_site_export" ||
      ref.sourceId === "open_data_law_zip") {
    return safeResult({
      status: "non_raw_source_cannot_select_parser",
      reason: "not_a_verified_raw_xml_response",
      profile: ref.sourceId
    });
  }
  if (claimedProfile !== "open_data_law_raw_xml") {
    return safeResult({
      status: "source_profile_mismatch",
      reason: "source_binding_does_not_match_claimed_profile",
      profile: "open_data_law_raw_xml"
    });
  }
  return safeResult({
    status: "awaiting_authenticated_raw_xml_structure",
    reason: "stage3u_head_failed_no_real_element_names",
    profile: "open_data_law_raw_xml",
    priorProbe: "Stage3u official_head_unavailable_no_get",
    rawElementEvidenceCount: 0
  });
}

const SYNTHETIC_TAGS = Object.freeze({
  TEST_CHANNEL_A: Object.freeze(["TEST_A_CONTAINER", "TEST_A_LAW", "TEST_A_NAME", "TEST_A_ARTICLE"]),
  TEST_CHANNEL_B: Object.freeze(["TEST_B_ROOT", "TEST_B_STATUTE", "TEST_B_TITLE", "TEST_B_TEXT"])
});

function syntheticTagRelationship(left, right) {
  if (typeof left !== "string" || typeof right !== "string" ||
      !Object.prototype.hasOwnProperty.call(SYNTHETIC_TAGS, left) ||
      !Object.prototype.hasOwnProperty.call(SYNTHETIC_TAGS, right)) {
    return safeResult({
      status: "blocked_unknown_synthetic_fixture",
      reason: "only_predefined_artificial_tag_sets_supported"
    });
  }
  const a = SYNTHETIC_TAGS[left], b = SYNTHETIC_TAGS[right];
  return safeResult({
    status: "synthetic_tag_sets_compared_no_real_xml_inference",
    artificialFixtureA: left, artificialFixtureB: right,
    sameArtificialNames: a.length === b.length && a.every((x, i) => x === b[i]),
    actualOfficialXmlTagEquivalenceEstablished: false,
    legalContentEquivalentCurrentVersions: false,
    proofAvailableToRealParser: false
  });
}

function reconcileStandardAndSource({ sourceUrl, standardFields,
                                      claimedMappedNames, sourceFamily,
                                      authentication } = {}) {
  void standardFields; void claimedMappedNames; void authentication;
  const source = classifyOfficialReference(sourceUrl);
  if (source.status !== "documented_source_role_only") {
    return safeResult({
      status: "review", reason: "unknown_source_for_schema_join"
    });
  }
  if (source.sourceId !== "government_law_data_standard") {
    return safeResult({
      status: "review", reason: "standard_field_dictionary_is_not_this_xml_payload",
      sourceId: source.sourceId
    });
  }
  return safeResult({
    status: "standard_vocabulary_available_not_actual_xml",
    reason: "official_standard_field_names_cannot_be_assumed_as_raw_elements",
    sourceId: "government_law_data_standard",
    standardFieldNameCount: DEFINED_STANDARD_FIELDS.length,
    sourceFamilyIsBound: false,
    requestedFamily: typeof sourceFamily === "string" &&
      Object.prototype.hasOwnProperty.call(PROFILES, sourceFamily)
      ? sourceFamily : "unknown",
    mapperEvidenceLevel: "standard_only",
    currentRawXmlMappingVerified: false
  });
}

function sourceStatus() {
  return safeResult({
    stage: "Stage3v official documentary source-format separation",
    researchedAt: RESEARCH_AS_OF,
    knownPublicationProfiles: Object.keys(PROFILES),
    documentedSources: Object.keys(SRC).length,
    distinctRawTagFamiliesReportedHistorically: true,
    actualRawTagFamiliesObservedNow: 0,
    fullOfficialXsdVerified: false,
    officialDeveloperGuideContentReadable: false,
    officialRawXmlProbeSucceeded: false,
    stage3vSyntheticOnly: true,
    nextBestStep: "Seek official XSD or small original XML sample with authenticated provenance"
  });
}

module.exports = lockDeep({
  RESEARCH_AS_OF, SRC, PROFILES, PUBLICATION_FACTS,
  DEFINED_STANDARD_FIELDS, SYNTHETIC_TAGS,
  recognizedSource, classifyOfficialReference, assessParserSelection,
  syntheticTagRelationship, reconcileStandardAndSource, sourceStatus
});
