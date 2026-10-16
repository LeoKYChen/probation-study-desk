"""Stage3o offline SYNTHETIC PDF raster/text agreement gate.

Only compares complete pages against separately supplied synthetic reference
render hashes, after Stage3n validates every extractable page against a
synthetic expected transcript. No network, OCR, disk writes or real cases.

Pixel equality is a deliberately strict test fixture technique. It is not a
semantic visual proof, an anti-malware sandbox, or official court verification.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Sequence
import re

import fitz
from stage3n_pdf_gate import SyntheticProof, inspect_synthetic_pdf, MAX_PDF_BYTES, MAX_PAGES

RENDER_SCALE = 1.25
RENDER_MAX_PIXELS = 2_500_000
RENDER_MAX_TOTAL_PIXELS = 20_000_000
HASH_FORMAT = re.compile(r"[0-9a-f]{64}\Z")


@dataclass(frozen=True)
class SyntheticReferencePage:
    width: int
    height: int
    rgb_sha256: str


def _metadata(status: str, reason: str, *, pages=0, visual_matches=0,
              text_fidelity=False) -> dict:
    return {
        "status": status,
        "reason": reason,
        "page_count": pages,
        "reference_render_pages_matched": visual_matches,
        "synthetic_text_fidelity_passed": bool(text_fidelity),
        "synthetic_visual_fidelity_passed": status == "synthetic_visual_and_text_passed",
        "real_official_pdf_fulltext_verified": False,
        "real_pdf_visual_semantics_verified": False,
        "ocr_used": False,
        "public_judgment_link_authorized": False,
        "actual_judicial_api_used": False,
        "raw_pdf_or_pixels_written_to_disk": False,
        "stage3_accepted": False,
    }


def _valid_references(refs: object) -> bool:
    return bool(
        isinstance(refs, (tuple, list))
        and 1 <= len(refs) <= MAX_PAGES
        and all(
            isinstance(r, SyntheticReferencePage)
            and type(r.width) is int and type(r.height) is int
            and 1 <= r.width <= 2000 and 1 <= r.height <= 2000
            and r.width * r.height <= RENDER_MAX_PIXELS
            and isinstance(r.rgb_sha256, str)
            and HASH_FORMAT.fullmatch(r.rgb_sha256)
            for r in refs
        )
    )


def _fingerprints(pdf_bytes: bytes) -> tuple[SyntheticReferencePage, ...]:
    """Internal renderer; never returns images, text or case identifiers."""
    results = []
    pixels = 0
    with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
        if not 1 <= document.page_count <= MAX_PAGES:
            raise ValueError("synthetic_page_count_out_of_bounds")
        for idx in range(document.page_count):
            page = document.load_page(idx)
            if (page.rect.width <= 0 or page.rect.height <= 0
                or page.rect.width * RENDER_SCALE > 2000
                or page.rect.height * RENDER_SCALE > 2000):
                raise ValueError("synthetic_page_geometry_out_of_bounds")
            # One specific renderer/scale/colorspace, pinned in CI. This does
            # not detect semantic agreement independent of the reference.
            pix = page.get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE),
                                  colorspace=fitz.csRGB, alpha=False,
                                  annots=False)
            size = pix.width * pix.height
            pixels += size
            if size > RENDER_MAX_PIXELS or pixels > RENDER_MAX_TOTAL_PIXELS:
                raise ValueError("synthetic_raster_pixel_budget_exceeded")
            results.append(SyntheticReferencePage(pix.width, pix.height,
                                                  sha256(pix.samples).hexdigest()))
    return tuple(results)


def synthetic_reference_from_fixture(pdf_bytes: bytes) -> tuple[SyntheticReferencePage, ...]:
    """Test-fixture-only generator, NOT an authoritative document attestation."""
    if type(pdf_bytes) is not bytes or not 150 <= len(pdf_bytes) <= MAX_PDF_BYTES:
        raise ValueError("synthetic_reference_pdf_size_invalid")
    return _fingerprints(pdf_bytes)


def inspect_synthetic_visual_pdf(
    pdf_bytes: bytes,
    proof: SyntheticProof,
    *,
    expected_page_texts: Sequence[str] | None,
    independently_supplied_reference: Sequence[SyntheticReferencePage] | None,
) -> dict:
    # Stage3n validates size, PDF parser hazards, each page's text, synthetic
    # identity/date and sequence. Rendering only occurs after it passes.
    prior = inspect_synthetic_pdf(
        pdf_bytes, proof, expected_page_texts=expected_page_texts
    )
    if prior["status"] != "synthetic_fidelity_passed":
        return _metadata(prior["status"], "text_gate:" + prior["reason"],
                         pages=prior["page_count"])

    pages = prior["page_count"]
    if independently_supplied_reference is None:
        return _metadata("review", "independent_visual_reference_missing",
                         pages=pages, text_fidelity=True)
    if not _valid_references(independently_supplied_reference):
        return _metadata("blocked", "visual_reference_manifest_invalid",
                         pages=pages, text_fidelity=True)
    if len(independently_supplied_reference) != pages:
        return _metadata("review", "visual_reference_page_count_disagrees",
                         pages=pages, text_fidelity=True)

    try:
        actual = _fingerprints(pdf_bytes)
    except Exception:
        # Parser/render errors are review, not proof of corruption/withdrawal.
        return _metadata("review", "synthetic_pdf_render_unavailable",
                         pages=pages, text_fidelity=True)

    matching = 0
    for expected, observed in zip(independently_supplied_reference, actual):
        if (expected.width != observed.width or expected.height != observed.height
            or expected.rgb_sha256 != observed.rgb_sha256):
            return _metadata("review", "rendered_page_differs_from_reference",
                             pages=pages, visual_matches=matching,
                             text_fidelity=True)
        matching += 1
    return _metadata("synthetic_visual_and_text_passed",
                     "all_synthetic_text_and_raster_pages_match",
                     pages=pages, visual_matches=matching, text_fidelity=True)
