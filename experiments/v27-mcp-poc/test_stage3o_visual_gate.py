"""44 offline-only synthetic visible-vs-text PDF checks; no court documents."""
from dataclasses import replace
from io import BytesIO
import json
import unittest

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import white, black
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw

from stage3n_pdf_gate import SyntheticProof
from stage3o_visual_gate import (
    SyntheticReferencePage, RENDER_MAX_PIXELS,
    synthetic_reference_from_fixture, inspect_synthetic_visual_pdf,
)

PROOF = SyntheticProof(case_id="TEST_PDF_SYNTHETIC_VISIBLE",
                       court="SYNTHETIC COURT A", decision_date="2026-10-16")


def fixture(page_count=3, *, invisible=False, shift=False, cover=False,
            table=False, grid=True, swapped_columns=False, blank_page=0,
            small=True, watermark=False, image_cover=False,
            alpha=1):
    """Make PDF bytes and synthetic expected extraction strings in memory."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792), pageCompression=1, invariant=1)
    c.setTitle("COMPLETELY_SYNTHETIC_VISUAL_PDF_TEST")
    expected = []
    for i in range(1, page_count+1):
        lines = [f"PAGE:{i}/{page_count}"]
        if i == 1:
            lines += ["CASE:"+PROOF.case_id, "COURT:"+PROOF.court,
                      "DATE:"+PROOF.decision_date, "MAIN HOLDING", "REASONS"]
        lines += [f"SYNTHETIC LINE {i} {j} NEVER A REAL DECISION" for j in range(5)]
        expected.append("\n".join(lines))
        if i == blank_page:
            c.rect(80, 400, 160, 120, fill=0, stroke=1)
            c.showPage()
            continue
        if invisible:
            c.setFillColor(white)
        else:
            c.setFillColor(black)
        text = c.beginText(38+(12 if shift else 0), 750)
        text.setFont("Helvetica", 11)
        text.setLeading(18)
        for line in lines:
            text.textLine(line)
        c.drawText(text)
        c.setFillColor(black)
        if cover:
            c.setFillColor(white)
            c.rect(38, 660, 490, 92, fill=1, stroke=0)
            c.setFillColor(black)
        if table:
            if grid:
                for x in (38, 145, 270):
                    c.line(x, 285, x, 400)
                for y in (285, 325, 365, 400):
                    c.line(38, y, 270, y)
            if swapped_columns:
                c.rect(305, 300, 110, 110, fill=0, stroke=1)
        if watermark:
            c.setFont("Helvetica", 20)
            c.drawString(80, 555, "SYNTHETIC VISIBLE OVERLAY")
        if image_cover:
            c.setFillColor(white)
            c.rect(20, 50, 570, 720, fill=1, stroke=0)
            c.setFillColor(black)
        c.showPage()
    c.save()
    return buf.getvalue(), expected


def check(blob, expected, refs, proof=PROOF):
    return inspect_synthetic_visual_pdf(
        blob, proof, expected_page_texts=expected,
        independently_supplied_reference=refs
    )


def scanned_image_fixture():
    """A synthetic scanned page with visible writing, but NO PDF text layer."""
    image = Image.new("RGB", (650, 800), "white")
    drawer = ImageDraw.Draw(image)
    drawer.text((25, 35), "SYNTHETIC SCANNED PAGE - NOT A JUDGMENT", fill="black")
    drawer.text((25, 70), "CASE: TEST_PDF_SYNTHETIC_VISIBLE", fill="black")
    output = BytesIO()
    c = canvas.Canvas(output, pagesize=(612, 792), invariant=1)
    c.drawImage(ImageReader(image), 12, 16, width=590, height=760)
    c.showPage()
    c.save()
    return output.getvalue()


def table_cell_fixture(*, swap=False):
    """Same extraction order, different VISIBLE locations of table cell text."""
    b = BytesIO()
    c = canvas.Canvas(b, pagesize=(612, 792), invariant=1)
    base = ["PAGE:1/1", "CASE:"+PROOF.case_id, "COURT:"+PROOF.court,
            "DATE:"+PROOF.decision_date, "MAIN HOLDING", "REASONS",
            "SYNTHETIC TABLE CELL A", "SYNTHETIC TABLE CELL B"]
    c.setFont("Helvetica", 10)
    for row, line in enumerate(base[:6]):
        c.drawString(35, 745-18*row, line)
    c.rect(35, 400, 350, 70)
    c.line(210, 400, 210, 470)
    xpos = (225, 45) if swap else (45, 225)
    c.drawString(xpos[0], 440, base[6])
    c.drawString(xpos[1], 440, base[7])
    c.showPage()
    c.save()
    return b.getvalue(), ["\n".join(base)]


class SyntheticVisibleTextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline, cls.expected = fixture()
        cls.refs = synthetic_reference_from_fixture(cls.baseline)
        cls.valid = check(cls.baseline, cls.expected, cls.refs)

    def test_01_baseline_matches(self):
        self.assertEqual(self.valid["status"], "synthetic_visual_and_text_passed")

    def test_02_all_three_rasters_match(self):
        self.assertEqual(self.valid["reference_render_pages_matched"], 3)

    def test_03_text_gate_passes(self):
        self.assertTrue(self.valid["synthetic_text_fidelity_passed"])

    def test_04_zero_real_pdf_authorization(self):
        self.assertFalse(self.valid["real_official_pdf_fulltext_verified"])

    def test_05_no_public_link(self):
        self.assertFalse(self.valid["public_judgment_link_authorized"])

    def test_06_no_api_used(self):
        self.assertFalse(self.valid["actual_judicial_api_used"])

    def test_07_no_ocr_used(self):
        self.assertFalse(self.valid["ocr_used"])

    def test_08_bytes_not_written_to_disk(self):
        self.assertFalse(self.valid["raw_pdf_or_pixels_written_to_disk"])

    def test_09_empty_reference_returns_review(self):
        x = check(self.baseline, self.expected, None)
        self.assertEqual(x["reason"], "independent_visual_reference_missing")

    def test_10_empty_reference_list_blocked(self):
        self.assertEqual(check(self.baseline, self.expected, [])["status"], "blocked")

    def test_11_too_few_references_review(self):
        self.assertEqual(check(self.baseline, self.expected, self.refs[:2])["reason"],
                         "visual_reference_page_count_disagrees")

    def test_12_too_many_references_review(self):
        self.assertEqual(check(self.baseline, self.expected, self.refs+self.refs[:1])["reason"],
                         "visual_reference_page_count_disagrees")

    def test_13_forged_short_digest_blocked(self):
        x = replace(self.refs[0], rgb_sha256="00")
        self.assertEqual(check(self.baseline, self.expected, (x,)+self.refs[1:])["status"],
                         "blocked")

    def test_14_digest_uppercase_blocked(self):
        x = replace(self.refs[0], rgb_sha256="F"*64)
        self.assertEqual(check(self.baseline, self.expected, (x,)+self.refs[1:])["status"],
                         "blocked")

    def test_15_wrong_page_width_blocked_or_review(self):
        x = replace(self.refs[0], width=self.refs[0].width+1)
        self.assertEqual(check(self.baseline, self.expected, (x,)+self.refs[1:])["reason"],
                         "rendered_page_differs_from_reference")

    def test_16_wrong_image_hash_is_detected(self):
        x = replace(self.refs[1], rgb_sha256="0"*64)
        result = check(self.baseline, self.expected, (self.refs[0],x,self.refs[2]))
        self.assertEqual(result["reference_render_pages_matched"], 1)

    def test_17_invalid_reference_page_type_blocked(self):
        self.assertEqual(check(self.baseline, self.expected, ("wrong",)+self.refs[1:])["status"],
                         "blocked")

    def test_18_overlarge_image_dimensions_blocked(self):
        x = replace(self.refs[0], width=5000)
        self.assertEqual(check(self.baseline, self.expected, (x,)+self.refs[1:])["status"],
                         "blocked")

    def test_19_too_many_pixels_blocked(self):
        x = replace(self.refs[0], width=1800,height=1800)
        self.assertGreater(x.width*x.height,RENDER_MAX_PIXELS)
        self.assertEqual(check(self.baseline, self.expected, (x,)+self.refs[1:])["status"],
                         "blocked")

    def test_20_different_visible_font_position_but_identical_text(self):
        b, refs = fixture(shift=True)
        outcome = check(b, self.expected, self.refs)
        self.assertTrue(outcome["synthetic_text_fidelity_passed"])
        self.assertEqual(outcome["reason"], "rendered_page_differs_from_reference")

    def test_21_white_text_layer_has_text_but_not_visible(self):
        b, refs = fixture(invisible=True)
        result = check(b, self.expected, self.refs)
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertFalse(result["synthetic_visual_fidelity_passed"])

    def test_22_white_box_obscures_legible_text(self):
        b, refs = fixture(cover=True)
        result = check(b, self.expected, self.refs)
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertEqual(result["reason"], "rendered_page_differs_from_reference")

    def test_23_visible_watermark_detected_without_text_change(self):
        b, refs = fixture(watermark=True)
        result = check(b, self.expected, self.refs)
        self.assertFalse(result["synthetic_visual_fidelity_passed"])

    def test_24_full_page_white_rect_cover_detected(self):
        b, refs = fixture(image_cover=True)
        result = check(b, self.expected, self.refs)
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertEqual(result["reason"], "rendered_page_differs_from_reference")

    def test_25_table_lines_removed_but_same_text_detected(self):
        base, expected = fixture(table=True, grid=True)
        b, _ = fixture(table=True, grid=False)
        refs = synthetic_reference_from_fixture(base)
        result = check(b, expected, refs)
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertEqual(result["reason"], "rendered_page_differs_from_reference")

    def test_26_misplaced_table_columns_detected(self):
        base, expected = fixture(table=True)
        b, _ = fixture(table=True,swapped_columns=True)
        result = check(b, expected, synthetic_reference_from_fixture(base))
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertFalse(result["synthetic_visual_fidelity_passed"])

    def test_27_blank_middle_page_not_misreported_as_visual_success(self):
        b, expected = fixture(blank_page=2)
        outcome = check(b, self.expected, self.refs)
        self.assertEqual(outcome["status"], "review")
        self.assertIn("text_gate", outcome["reason"])

    def test_28_wrong_reference_text_fails_before_visual_comparison(self):
        text = self.expected.copy()
        text[0] = text[0].replace("MAIN HOLDING", "MAIN DIFF")
        r = check(self.baseline,text,self.refs)
        self.assertFalse(r["synthetic_text_fidelity_passed"])
        self.assertEqual(r["reference_render_pages_matched"], 0)

    def test_29_wrong_proof_blocks_visual_pipeline(self):
        r = check(self.baseline, self.expected, self.refs,
                  replace(PROOF,case_id="TPSM,114,台抗,2605,20251231,1"))
        self.assertEqual(r["status"], "blocked")

    def test_30_corrupted_pdf_has_no_trusted_visual_status(self):
        bad = self.baseline[:300]
        r = check(bad, self.expected, self.refs)
        self.assertFalse(r["synthetic_visual_fidelity_passed"])

    def test_31_two_reference_images_swapped(self):
        swapped=(self.refs[1], self.refs[0], self.refs[2])
        self.assertEqual(check(self.baseline,self.expected,swapped)["reason"],
                         "rendered_page_differs_from_reference")

    def test_32_pdf_page_count_one_pass(self):
        pdf, expected = fixture(1)
        r = check(pdf,expected,synthetic_reference_from_fixture(pdf))
        self.assertEqual(r["reference_render_pages_matched"],1)

    def test_33_pdf_page_count_four_pass(self):
        pdf, expected = fixture(4)
        r = check(pdf,expected,synthetic_reference_from_fixture(pdf))
        self.assertEqual(r["reference_render_pages_matched"],4)

    def test_34_mismatched_three_page_reference_fails_one(self):
        b, _= fixture(shift=True)
        r=check(b,self.expected,self.refs)
        self.assertEqual(r["reference_render_pages_matched"],0)

    def test_35_forged_text_only_pdf_does_not_auto_pass(self):
        b, expected = fixture(invisible=True)
        own=synthetic_reference_from_fixture(b)
        # Honest limit: references derived from the SAME bad PDF can match.
        r=check(b,expected,own)
        self.assertTrue(r["synthetic_visual_fidelity_passed"])
        self.assertFalse(r["real_official_pdf_fulltext_verified"])
        self.assertFalse(r["real_pdf_visual_semantics_verified"])

    def test_36_manifest_does_not_prove_official_publication(self):
        r=self.valid
        self.assertFalse(r["real_pdf_visual_semantics_verified"])
        self.assertFalse(r["public_judgment_link_authorized"])

    def test_37_output_contains_no_pdf_text_or_source(self):
        s=json.dumps(self.valid)
        for phrase in ("SYNTHETIC COURT", "PAGE:1/3", "TEST_PDF_", "CASE:", "PDF-1"):
            self.assertNotIn(phrase,s)

    def test_38_invalid_manifest_bool_width_blocked(self):
        x=replace(self.refs[0],width=True)
        self.assertEqual(check(self.baseline,self.expected,(x,)+self.refs[1:])["status"],
                         "blocked")

    def test_39_ref_hash_extra_character_blocked(self):
        x=replace(self.refs[0],rgb_sha256=self.refs[0].rgb_sha256+"a")
        self.assertEqual(check(self.baseline,self.expected,(x,)+self.refs[1:])["status"],
                         "blocked")

    def test_40_both_stages_required(self):
        r=self.valid
        self.assertTrue(r["synthetic_text_fidelity_passed"])
        self.assertTrue(r["synthetic_visual_fidelity_passed"])
        self.assertFalse(r["stage3_accepted"])

    def test_41_real_raster_image_page_is_not_ocr_verified(self):
        pdf = scanned_image_fixture()
        result = check(pdf, self.expected[:1], self.refs[:1])
        self.assertEqual(result["status"], "review")
        self.assertIn("text_gate", result["reason"])
        self.assertFalse(result["ocr_used"])

    def test_42_table_cells_reversed_with_same_extracted_text(self):
        canonical, expected = table_cell_fixture()
        swapped, same_expected = table_cell_fixture(swap=True)
        baseline = check(canonical, expected, synthetic_reference_from_fixture(canonical))
        self.assertTrue(baseline["synthetic_visual_fidelity_passed"])
        result = check(swapped, expected, synthetic_reference_from_fixture(canonical))
        self.assertTrue(result["synthetic_text_fidelity_passed"])
        self.assertFalse(result["synthetic_visual_fidelity_passed"])
        self.assertEqual(result["reason"], "rendered_page_differs_from_reference")

    def test_43_reference_raster_from_wrong_document_fails(self):
        alternate, _ = fixture(shift=True)
        wrong_ref = synthetic_reference_from_fixture(alternate)
        result = check(self.baseline, self.expected, wrong_ref)
        self.assertEqual(result["reason"], "rendered_page_differs_from_reference")

    def test_44_crop_box_removes_visible_content_but_not_text_layer(self):
        reader = PdfReader(BytesIO(self.baseline))
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        for page in writer.pages:
            page.cropbox.upper_right = (390, 560)
        out = BytesIO()
        writer.write(out)
        r = check(out.getvalue(), self.expected, self.refs)
        self.assertTrue(r["synthetic_text_fidelity_passed"])
        self.assertEqual(r["reason"], "rendered_page_differs_from_reference")


if __name__ == "__main__":
    unittest.main(verbosity=2)
