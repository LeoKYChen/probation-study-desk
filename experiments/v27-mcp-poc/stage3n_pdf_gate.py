"""v2.7 Stage 3n: OFFLINE, SYNTHETIC PDF read / page-fidelity safety gate.

Accepts only synthetic document identifiers and an injected mock provenance
record. Uses pypdf to inspect bytes in process memory, without HTTP, file I/O,
OCR, user uploads, case texts in reports, or deployment. "passed" means only
the synthetic fixture PDF's every page matches the supplied synthetic reference.
It NEVER verifies an actual Judicial Yuan document or current publication.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from io import BytesIO
import re
import unicodedata
from typing import Sequence

from pypdf import PdfReader

MAX_PDF_BYTES = 450_000
MAX_PAGES = 12
MAX_CHARS_PER_PAGE = 12_000
MIN_CHARS_PER_PAGE = 72
MAX_TOTAL_EXTRACTED = 90_000
PDF_MAGIC = b"%PDF-"
EOF_TRAILER = b"%%EOF"
CASE_ID_RE = re.compile(r"TEST_PDF_SYNTHETIC_[A-Z0-9_]{1,30}\Z")
ALLOWED_COURTS = frozenset(("SYNTHETIC COURT A", "SYNTHETIC COURT B"))
OFFICIAL_HOST = "judgment.judicial.gov.tw"
ALLOWED_ORIGIN = "https://judgment.judicial.gov.tw"
SOURCE_KIND = "SYNTHETIC_OFFICIAL_PDF_EVIDENCE"


@dataclass(frozen=True)
class SyntheticProof:
    """A test double for a future trusted source, NOT a security credential."""
    case_id: str
    court: str
    decision_date: str
    kind: str = SOURCE_KIND
    origin: str = ALLOWED_ORIGIN
    access_authorized: bool = True
    was_public_in_fixture: bool = True
    independent_reference_supplied: bool = True


def normalized(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def result(status: str, reason: str, *,
           pages: int = 0, readable_pages: int = 0,
           compared_pages: int = 0, marker_ok: bool = False,
           identity_ok: bool = False) -> dict:
    """Return NON-CONTENT metadata only, never extracted text or source bytes."""
    return {
        "status": status,
        "reason": reason,
        "page_count": pages,
        "readable_page_count": readable_pages,
        "independently_compared_page_count": compared_pages,
        "page_order_markers_valid": marker_ok,
        "first_page_identity_valid": identity_ok,
        "synthetic_reference_fidelity_passed": status == "synthetic_fidelity_passed",
        "real_official_pdf_fulltext_verified": False,
        "official_api_used": False,
        "individual_judgment_url_approved": False,
        "pdf_bytes_written_to_disk": False,
        "pdf_fulltext_saved": False,
        "ocr_used": False,
        "stage3_accepted": False,
    }


def valid_proof(proof: object) -> bool:
    if not isinstance(proof, SyntheticProof):
        return False
    if (proof.kind != SOURCE_KIND or proof.origin != ALLOWED_ORIGIN
        or not proof.access_authorized or not proof.was_public_in_fixture
        or not proof.independent_reference_supplied
        or not CASE_ID_RE.fullmatch(proof.case_id)
        or proof.court not in ALLOWED_COURTS):
        return False
    try:
        if not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", proof.decision_date):
            return False
        date.fromisoformat(proof.decision_date)
    except ValueError:
        return False
    return True


def _has_dangerous_features(reader: PdfReader) -> bool:
    """Reject annotations, embedded files, scripts, actions and forms."""
    root = reader.trailer["/Root"]
    if any(key in root for key in (
        "/Names", "/AcroForm", "/OpenAction", "/AA", "/EmbeddedFiles",
        "/Perms", "/Collection", "/JavaScript", "/JS"
    )):
        return True
    for page in reader.pages:
        if any(key in page for key in ("/Annots", "/AA", "/OpenAction")):
            return True
    return False


def inspect_synthetic_pdf(blob: bytes, proof: SyntheticProof, *,
                          expected_page_texts: Sequence[str] | None) -> dict:
    # Fail closed BEFORE attempting to decode even a PDF header.
    if not valid_proof(proof):
        return result("blocked", "synthetic_provenance_missing_or_untrusted")
    if type(blob) is not bytes:
        return result("blocked", "pdf_must_be_immutable_bytes")
    if len(blob) > MAX_PDF_BYTES:
        return result("blocked", "pdf_bytes_exceed_test_safety_limit")
    if len(blob) < 150 or not blob.startswith(PDF_MAGIC):
        return result("blocked", "pdf_magic_or_size_invalid")
    if EOF_TRAILER not in blob[-96:]:
        return result("blocked", "pdf_eof_trailer_missing")
    if expected_page_texts is not None:
        if (not isinstance(expected_page_texts, (tuple, list))
            or not (1 <= len(expected_page_texts) <= MAX_PAGES)
            or any(not isinstance(x, str) for x in expected_page_texts)):
            return result("blocked", "synthetic_reference_format_invalid")
    try:
        reader = PdfReader(BytesIO(blob), strict=True)
        if reader.is_encrypted:
            return result("blocked", "encrypted_pdf_not_allowed")
        pages = len(reader.pages)
        if pages < 1 or pages > MAX_PAGES:
            return result("blocked", "pdf_page_count_out_of_bounds", pages=pages)
        if _has_dangerous_features(reader):
            return result("blocked", "pdf_contains_interactive_or_embedded_features",
                          pages=pages)
        # Deliberately NO OCR fallback; an image-only page remains unverified.
        # Resource exhaustion and malicious parser input must be controlled by
        # an external sandbox in a future production process.
        extracted: list[str] = []
        page_lines: list[frozenset[str]] = []
        total_chars = 0
        for page in reader.pages:
            text = page.extract_text(extraction_mode="plain") or ""
            # Preserve page-local exact field and marker boundaries in memory.
            # Substring checks would falsely accept CASE:<id>_WRONG as <id>.
            lines = frozenset(normalized(line) for line in text.splitlines()
                              if line.strip())
            content = normalized(text)
            if len(content) > MAX_CHARS_PER_PAGE:
                return result("blocked", "one_page_text_exceeds_safety_cap",
                              pages=pages, readable_pages=len(extracted))
            if len(content) < MIN_CHARS_PER_PAGE:
                return result("review", "blank_scanned_or_unreadable_page",
                              pages=pages, readable_pages=len(extracted))
            total_chars += len(content)
            if total_chars > MAX_TOTAL_EXTRACTED:
                return result("blocked", "total_pdf_text_exceeds_safety_cap",
                              pages=pages, readable_pages=len(extracted))
            extracted.append(content)
            page_lines.append(lines)
    except Exception:
        # Never expose parser exception text: it can include untrusted PDF
        # material or file offsets, and a bad document is not an empty ruling.
        return result("review", "pdf_parse_or_extract_failed")

    assert len(extracted) == pages
    tags = (
        f"CASE:{proof.case_id}",
        f"COURT:{proof.court}",
        f"DATE:{proof.decision_date}",
        "MAIN HOLDING",
        "REASONS",
    )
    identity_ok = all(normalized(tag) in page_lines[0] for tag in tags)
    if not identity_ok:
        return result("review", "first_page_case_date_or_court_unconfirmed",
                      pages=pages, readable_pages=pages)

    marker_ok = all(
        normalized(f"PAGE:{i}/{pages}") in page_lines[i-1]
        and sum(line.startswith("PAGE:") for line in page_lines[i-1]) == 1
        for i in range(1, pages+1)
    )
    if not marker_ok:
        return result("review", "page_sequence_marker_invalid",
                      pages=pages, readable_pages=pages, identity_ok=True)

    if expected_page_texts is None:
        return result("review", "independent_page_texts_not_supplied",
                      pages=pages, readable_pages=pages, marker_ok=True,
                      identity_ok=True)
    if len(expected_page_texts) != pages:
        return result("review", "reference_page_count_disagrees",
                      pages=pages, readable_pages=pages, marker_ok=True,
                      identity_ok=True)

    compared = 0
    for actual, reference in zip(extracted, expected_page_texts):
        if not reference or len(normalized(reference)) < MIN_CHARS_PER_PAGE:
            return result("review", "reference_page_is_empty_or_incomplete",
                          pages=pages, readable_pages=pages,
                          compared_pages=compared, marker_ok=True,
                          identity_ok=True)
        if actual != normalized(reference):
            return result("review", "one_or_more_page_texts_disagree",
                          pages=pages, readable_pages=pages,
                          compared_pages=compared, marker_ok=True,
                          identity_ok=True)
        compared += 1
    return result("synthetic_fidelity_passed", "all_synthetic_pages_match",
                  pages=pages, readable_pages=pages,
                  compared_pages=compared, marker_ok=True, identity_ok=True)
