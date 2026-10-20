"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const gate = require("./source-profile-gate.cjs");
const stage3t = require("../stage3t/official-field-mapper.cjs");
const stage3q = require("../stage3q-readiness-ledger.cjs");

const {SRC,PROFILES,PUBLICATION_FACTS,DEFINED_STANDARD_FIELDS,
  recognizedSource,classifyOfficialReference,assessParserSelection,
  syntheticTagRelationship,reconcileStandardAndSource,sourceStatus} = gate;

const fakeFlags = Object.freeze({
  verified: true, credentials: {apiKey:"DONT_USE_ME"},
  sourceVersion: "CURRENT", requestApproved: true,
  authenticatedEvidence: { signature: "APPROVED" },
  rootTag: "StatName", shallowElements: ["StatName","StatArticles"]
});

test("MOJ official meeting slides explicitly report different XML tags", () => {
  assert.equal(PUBLICATION_FACTS.xmlElementNamesDifferAcrossChannelsReportedInMojDocument,true);
  assert.equal(PUBLICATION_FACTS.commonLegalContentSourceReportedInMojDocument,true);
  assert.match(SRC.MOJ_BRIEF,/^https:\/\/www\.moj\.gov\.tw\/media\//);
});
test("historical MOJ claim is not independent present-day real XML proof",()=>{
  assert.equal(PUBLICATION_FACTS.currentRealXmlPayloadReceived,false);
  assert.equal(PUBLICATION_FACTS.sameLegalTextAcrossCurrentVersionsVerified,false);
});
test("tag examples not asserted without inspecting original XML",()=>{
  assert.equal(PUBLICATION_FACTS.tagNameExamplesIndependentlyConfirmed,false);
  assert.equal(PUBLICATION_FACTS.xsdFoundAndVerified,false);
});
test("government standard not confused with raw XML mapping",()=>{
  assert.equal(PUBLICATION_FACTS.officialDataStandardIsXmlTagMapping,false);
  assert.equal(PROFILES.government_law_data_standard.actualXmlNodesObserved,false);
});
test("website profile separate from open-data profile",()=>{
  assert.notEqual(PROFILES.law_site_export.publicationChannel,
    PROFILES.open_data_law_raw_xml.publicationChannel);
  assert.notEqual(PROFILES.law_site_export.xmlTagFamily,
    PROFILES.open_data_law_raw_xml.xmlTagFamily);
});
test("website guide is a reference, not authenticated raw XML",()=>{
  const p=PROFILES.law_site_export;
  assert.equal(p.evidenceType,"official_developer_guide_reference_only");
  assert.equal(p.parseAllowed,false);
  assert.equal(p.parsedRealDocument,false);
});
test("open-data RAW XML URL is only official distribution metadata",()=>{
  const p=PROFILES.open_data_law_raw_xml;
  assert.equal(p.evidenceType,"official_dataset_distribution_metadata_only");
  assert.equal(p.parseAllowed,false);
  assert.equal(p.actualXmlNodesObserved,false);
});
test("all profiles are deeply immutable",()=>{
  assert.ok(Object.isFrozen(PROFILES));
  for(const p of Object.values(PROFILES))assert.ok(Object.isFrozen(p));
});
test("official standard published StatModifiedDate",()=>{
  assert.ok(DEFINED_STANDARD_FIELDS.includes("StatModifiedDate"));
  assert.ok(DEFINED_STANDARD_FIELDS.includes("StatEffectiveDate"));
});
test("standard dictionary includes nested field name but it does not prove XML nesting",()=>{
  assert.ok(DEFINED_STANDARD_FIELDS.includes("StatArticles"));
  assert.ok(DEFINED_STANDARD_FIELDS.includes("ArticleNo"));
  assert.equal(PUBLICATION_FACTS.officialDataStandardIsXmlTagMapping,false);
});
test("standard dictionary has stable documented number of fields",()=>{
  assert.equal(DEFINED_STANDARD_FIELDS.length,19);
  assert.ok(Object.isFrozen(DEFINED_STANDARD_FIELDS));
});
test("law standard 2026 update does not override unknown real XML",()=>{
  const x=reconcileStandardAndSource({sourceUrl:SRC.STANDARD,sourceFamily:"open_data_law_raw_xml"});
  assert.equal(x.status,"standard_vocabulary_available_not_actual_xml");
  assert.equal(x.currentRawXmlMappingVerified,false);
  assert.equal(x.standardFieldNameCount,19);
});
for(const [key,role] of [
  ["RAW","raw_xml_download_address_only"],
  ["ZIP","archive_distribution_address_only"],
  ["GUIDE","developer_guide_reference_only"],
  ["STANDARD","metadata_standard_only"],
  ["DATASET","dataset_listing_only"],
  ["MOJ_BRIEF","official_historical_comparison_slide"]
]) {
  test("exact URL has documented SOURCE ROLE only: "+key,()=>{
    const x=classifyOfficialReference(SRC[key]);
    assert.equal(x.role,role);
    assert.equal(x.status,"documented_source_role_only");
    assert.equal(x.urlDownloadAuthorized,false);
    assert.equal(x.canSelectProductionXmlParser,false);
  });
}
test("RAW URL has only one expected profile identity",()=>{
  assert.equal(recognizedSource(SRC.RAW),"open_data_law_raw_xml");
});
test("site guide matches law-site profile but not downloadable XML",()=>{
  assert.equal(recognizedSource(SRC.GUIDE),"law_site_export");
  assert.equal(assessParserSelection({sourceUrl:SRC.GUIDE}).status,
    "non_raw_source_cannot_select_parser");
});
test("ZIP is not automatically parsed as XML",()=>{
  const x=assessParserSelection({sourceUrl:SRC.ZIP,claimedProfile:"open_data_law_raw_xml"});
  assert.equal(x.canSelectProductionXmlParser,false);
  assert.equal(x.profile,"open_data_law_zip");
});
test("government data standard website never becomes the XML source",()=>{
  const x=assessParserSelection({sourceUrl:SRC.STANDARD,claimedProfile:"open_data_law_raw_xml"});
  assert.equal(x.status,"non_raw_source_cannot_select_parser");
});
test("official meeting slide cannot itself be used as XML document",()=>{
  const x=assessParserSelection({sourceUrl:SRC.MOJ_BRIEF,claimedProfile:"law_site_export"});
  assert.equal(x.canSelectProductionXmlParser,false);
});
test("dataset listing cannot itself be parsed as law",()=>{
  assert.equal(assessParserSelection({sourceUrl:SRC.DATASET}).status,
    "non_raw_source_cannot_select_parser");
});
test("RAW source with matching claimed family still blocked pending real bytes",()=>{
  const x=assessParserSelection({sourceUrl:SRC.RAW,claimedProfile:"open_data_law_raw_xml"});
  assert.equal(x.status,"awaiting_authenticated_raw_xml_structure");
  assert.equal(x.rawElementEvidenceCount,0);
  assert.equal(x.canSelectProductionXmlParser,false);
});
test("RAW source with wrong family rejected",()=>{
  const x=assessParserSelection({sourceUrl:SRC.RAW,claimedProfile:"law_site_export"});
  assert.equal(x.status,"source_profile_mismatch");
  assert.equal(x.canSelectProductionXmlParser,false);
});
test("RAW source with missing family rejected",()=>{
  assert.equal(assessParserSelection({sourceUrl:SRC.RAW}).status,
    "source_profile_mismatch");
});
test("RAW source with standard names as claimed XML tags still blocked",()=>{
  const x=assessParserSelection({sourceUrl:SRC.RAW,
    claimedProfile:"open_data_law_raw_xml",
    rootTag:"StatName",shallowElements:["StatName","StatArticles"]});
  assert.equal(x.status,"awaiting_authenticated_raw_xml_structure");
  assert.equal(x.officialRawTagNamesAuthenticated,false);
});
test("RAW source with forged full confidence and permission still blocked",()=>{
  const x=assessParserSelection({sourceUrl:SRC.RAW,
    claimedProfile:"open_data_law_raw_xml",...fakeFlags});
  assert.equal(x.canDeploy,false);
  assert.equal(x.sourceVerifiedLive,false);
  assert.equal(x.canSelectProductionXmlParser,false);
});
test("RAW source cannot claim current law from missing effective date",()=>{
  const x=assessParserSelection({sourceUrl:SRC.RAW,claimedProfile:"open_data_law_raw_xml",
    currentLawInForce:true});
  assert.equal(x.currentLawInForceVerified,false);
  assert.equal(x.canPublishLawAsCurrentlyEffective,false);
});
test("unknown source URL is blocked and not echoed",()=>{
  const fake="https://evil.invalid/raw.xml?token=DONT_USE_ME";
  const x=assessParserSelection({sourceUrl:fake,claimedProfile:"open_data_law_raw_xml"});
  assert.equal(x.status,"blocked_unknown_source");
  assert.doesNotMatch(JSON.stringify(x),/evil|DONT_USE_ME/);
});
test("null source blocked",()=>{
  assert.equal(classifyOfficialReference(null).status,"blocked_unrecognized_source");
});
test("object impersonating URL blocked",()=>{
  assert.equal(classifyOfficialReference({toString:()=>SRC.RAW}).status,"blocked_unrecognized_source");
});
test("prototype properties not recognized",()=>{
  for(const value of ["__proto__","constructor","toString"]){
    assert.equal(recognizedSource(value),null);
  }
});
for(const mutation of [
  SRC.RAW.replace("https:","http:"),
  SRC.RAW.replace("sendlaw.moj.gov.tw","sendlaw.moj.gov.tw.evil.invalid"),
  SRC.RAW.replace("AuData=CF","AuData=EF"),
  SRC.RAW+"&token=SECRET",
  SRC.RAW+"#fragment",
  SRC.RAW.replace("sendlaw","user:pass@sendlaw"),
  SRC.RAW.replace("GetFile.ashx","OtherFile.ashx"),
  SRC.RAW.replace("DType=RAW_XML","DType=RAW_XML%2F"),
  SRC.RAW.replace("DType=RAW_XML","DType=XML"),
  SRC.RAW+" ",
  "javascript:alert(1)",
  "file:///etc/passwd"
]) {
  test("non-exact URL never gives raw parser access: "+JSON.stringify(mutation).slice(0,50),()=>{
    const x=assessParserSelection({sourceUrl:mutation,claimedProfile:"open_data_law_raw_xml"});
    assert.equal(x.canSelectProductionXmlParser,false);
  });
}
test("known RAW URL cannot be equivalently replaced by different param order",()=>{
  const r="https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?DType=RAW_XML&AuData=CF";
  assert.equal(classifyOfficialReference(r).status,"blocked_unrecognized_source");
});
test("separate synthetic tag fixtures intentionally different",()=>{
  const x=syntheticTagRelationship("TEST_CHANNEL_A","TEST_CHANNEL_B");
  assert.equal(x.status,"synthetic_tag_sets_compared_no_real_xml_inference");
  assert.equal(x.sameArtificialNames,false);
  assert.equal(x.actualOfficialXmlTagEquivalenceEstablished,false);
});
test("self-comparison of artificial fixture doesn't prove any official format",()=>{
  const x=syntheticTagRelationship("TEST_CHANNEL_A","TEST_CHANNEL_A");
  assert.equal(x.sameArtificialNames,true);
  assert.equal(x.actualOfficialXmlTagEquivalenceEstablished,false);
});
test("mock fixture names cannot silently serve as real source",()=>{
  const x=syntheticTagRelationship("TEST_CHANNEL_A","TEST_CHANNEL_B");
  assert.equal(x.proofAvailableToRealParser,false);
  assert.equal(x.legalContentEquivalentCurrentVersions,false);
});
test("caller cannot forge actual tag list as a fixture name",()=>{
  const x=syntheticTagRelationship("StatArticles","TEST_CHANNEL_B");
  assert.equal(x.status,"blocked_unknown_synthetic_fixture");
});
test("caller cannot use prototype pollution as a fixture",()=>{
  assert.equal(syntheticTagRelationship("__proto__","TEST_CHANNEL_B").status,
    "blocked_unknown_synthetic_fixture");
});
test("caller can't supply tag lookup map",()=>{
  const x=syntheticTagRelationship({tag:"TEST_CHANNEL_A"},"TEST_CHANNEL_B");
  assert.equal(x.status,"blocked_unknown_synthetic_fixture");
});
test("standard comparison can show recognized profile but never attach real raw tag mapping",()=>{
  const x=reconcileStandardAndSource({sourceUrl:SRC.STANDARD,
    sourceFamily:"law_site_export",
    claimedMappedNames:["StatName","StatModifiedDate"]});
  assert.equal(x.requestedFamily,"law_site_export");
  assert.equal(x.sourceFamilyIsBound,false);
});
test("standard comparison of RAW URL refuses schema-to-XML leap",()=>{
  const x=reconcileStandardAndSource({sourceUrl:SRC.RAW,
    standardFields:["StatName","StatArticles"],authenticatedEvidence:true});
  assert.equal(x.status,"review");
  assert.equal(x.reason,"standard_field_dictionary_is_not_this_xml_payload");
});
test("standard comparison unknown URL fails closed",()=>{
  const x=reconcileStandardAndSource({sourceUrl:"https://evil.invalid"});
  assert.equal(x.reason,"unknown_source_for_schema_join");
});
test("fake independent provenance cannot authorize standard-to-XML conversion",()=>{
  const x=reconcileStandardAndSource({sourceUrl:SRC.STANDARD,
    standardFields:DEFINED_STANDARD_FIELDS,
    claimedMappedNames:["StatName"],authentication:{signature:"REAL"}});
  assert.equal(x.officialRawTagNamesAuthenticated,false);
  assert.equal(x.canSelectProductionXmlParser,false);
});
test("ref dictionary official source URLs not used as download permission",()=>{
  for(const id of Object.keys(SRC)){
    const x=classifyOfficialReference(SRC[id]);
    assert.equal(x.urlDownloadAuthorized,false);
    assert.equal(x.xmlFullDocumentVerified,false);
  }
});
test("MOJ briefing source differs from government raw distribution",()=>{
  assert.notEqual(SRC.MOJ_BRIEF,SRC.RAW);
  assert.notEqual(recognizedSource(SRC.MOJ_BRIEF),recognizedSource(SRC.RAW));
});
test("sourceStatus states Stage3u failure without inventing raw tag names",()=>{
  const s=sourceStatus();
  assert.equal(s.officialRawXmlProbeSucceeded,false);
  assert.equal(s.actualRawTagFamiliesObservedNow,0);
  assert.equal(s.fullOfficialXsdVerified,false);
});
test("Stage3t remains data STANDARD mapping only",()=>{
  assert.equal(stage3t.summary().exactOfficialXmlTagNamesValidatedFromDownload,false);
});
test("Stage3q no deployment for a law source despite new docs",()=>{
  const x=stage3q.planReview({features:["law_lookup"],
    approvals:{newXmlSourceDocumented:true,officialMojProof:true}});
  assert.equal(x.canDeploy,false);
  assert.equal(x.stage3Accepted,false);
});
test("release gates false across all exposed pathway outputs",()=>{
  const checks=[
    classifyOfficialReference(SRC.RAW),
    assessParserSelection({sourceUrl:SRC.RAW,claimedProfile:"open_data_law_raw_xml"}),
    syntheticTagRelationship("TEST_CHANNEL_A","TEST_CHANNEL_B"),
    reconcileStandardAndSource({sourceUrl:SRC.STANDARD}),
    sourceStatus()
  ];
  for(const row of checks) {
    assert.equal(row.canMerge,false);
    assert.equal(row.canDeploy,false);
    assert.equal(row.stage3Accepted,false);
  }
});
test("no law text, case ID or PDF bytes in release status",()=>{
  const s=JSON.stringify(sourceStatus());
  for(const privateVal of ["TPSM,114","JDoc","法條全文","private-juvenile"])
    assert.equal(s.includes(privateVal),false);
});
test("source registry immutable at all levels",()=>{
  assert.ok(Object.isFrozen(SRC));
  assert.ok(Object.isFrozen(PUBLICATION_FACTS));
  assert.ok(Object.isFrozen(gate.SYNTHETIC_TAGS));
});
