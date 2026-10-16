"""Stage3n unit tests: all PDF bytes manufactured in memory, NO real court data."""
import io
import json
import unittest
from dataclasses import replace

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from stage3n_pdf_gate import (
    inspect_synthetic_pdf, SyntheticProof, MAX_PDF_BYTES, MAX_PAGES,
    MAX_CHARS_PER_PAGE, MAX_TOTAL_EXTRACTED, normalized, result
)

CASE = "TEST_PDF_SYNTHETIC_ALPHA"
PROOF = SyntheticProof(
    case_id=CASE, court="SYNTHETIC COURT A",
    decision_date="2026-10-16"
)


def fixture(n=3, *, blank=(), page_markers=None, wrong_case=False,
            wrong_court=False, wrong_date=False, missing_reasons=False,
            oversized_text=False):
    """Generate a purely fictitious ASCII court-like PDF, no filesystem writes."""
    stream = io.BytesIO()
    page = canvas.Canvas(stream, pagesize=(612, 792), pageCompression=1)
    page.setTitle("SYNTHETIC_OFFLINE_PDF_UNIT_TEST_ONLY")
    expected = []
    for num in range(1, n+1):
        lines = []
        if num not in blank:
            lines.append(page_markers.get(num, f"PAGE:{num}/{n}")
                         if page_markers else f"PAGE:{num}/{n}")
            if num == 1:
                lines += [
                    "CASE:" + (CASE+"_WRONG" if wrong_case else CASE),
                    "COURT:" + ("SYNTHETIC COURT B" if wrong_court
                               else PROOF.court),
                    "DATE:" + ("2026-10-15" if wrong_date else PROOF.decision_date),
                    "MAIN HOLDING",
                ]
                if not missing_reasons:
                    lines.append("REASONS")
            if oversized_text:
                # Each line <300 points-ish? Physical overflow is irrelevant
                # to extraction test, only synthetic parser size accounting.
                for j in range(65):
                    lines.append(f"OFFLINE_SYNTHETIC_REASON_{num}_{j}_"+"X"*230)
            else:
                lines.extend(
                    f"OFFLINE ONLY EXPLANATION PAGE {num} LINE {j} "
                    "NO REAL JUDGMENT OR PARTY DETAILS INCLUDED"
                    for j in range(4)
                )
            t = page.beginText(32, 760)
            t.setFont("Helvetica", 9)
            t.setLeading(12)
            for line in lines:
                t.textLine(line)
            page.drawText(t)
        else:
            page.rect(45, 45, 100, 100)
        page.showPage()
        expected.append("\n".join(lines))
    page.save()
    return stream.getvalue(), expected


def run(blob, expected, proof=PROOF):
    return inspect_synthetic_pdf(blob, proof, expected_page_texts=expected)


def rewrite_pdf(blob, action):
    parsed = PdfReader(io.BytesIO(blob))
    writer = PdfWriter()
    for page in parsed.pages:
        writer.add_page(page)
    action(writer)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


class PDFGateFixtureTests(unittest.TestCase):
    def test_three_pages_all_match(self):
        blob, refs = fixture()
        r = run(blob, refs)
        self.assertEqual(r["status"], "synthetic_fidelity_passed")
        self.assertEqual(r["page_count"], 3)
        self.assertEqual(r["readable_page_count"], 3)
        self.assertEqual(r["independently_compared_page_count"], 3)
        self.assertTrue(r["page_order_markers_valid"])

    def test_one_page_all_match(self):
        blob, refs = fixture(1)
        self.assertEqual(run(blob, refs)["status"], "synthetic_fidelity_passed")

    def test_multi_page_text_diff_fails(self):
        blob, refs = fixture()
        refs[1] += " DIFFERENT OFFICIAL REFERENCE"
        r = run(blob, refs)
        self.assertEqual(r["reason"], "one_or_more_page_texts_disagree")
        self.assertEqual(r["independently_compared_page_count"], 1)

    def test_wrong_reference_only_last_page_fails(self):
        blob, refs = fixture()
        refs[2] = refs[2].replace("EXPLANATION", "DIFFERENT")
        r = run(blob, refs)
        self.assertEqual(r["independently_compared_page_count"], 2)

    def test_missing_reference_pages_fails(self):
        blob, refs = fixture(3)
        r = run(blob, refs[:2])
        self.assertEqual(r["reason"], "reference_page_count_disagrees")

    def test_unavailable_reference_pages_never_pass(self):
        blob, _ = fixture()
        r = inspect_synthetic_pdf(blob, PROOF, expected_page_texts=None)
        self.assertEqual(r["reason"], "independent_page_texts_not_supplied")

    def test_empty_reference_page_never_pass(self):
        blob, refs = fixture()
        refs[1] = ""
        self.assertEqual(run(blob, refs)["reason"], "reference_page_is_empty_or_incomplete")

    def test_reference_type_mismatch_blocked(self):
        blob, _ = fixture()
        self.assertEqual(run(blob, "pages")["reason"], "synthetic_reference_format_invalid")

    def test_reference_page_non_string_blocked(self):
        blob, refs = fixture()
        refs[1] = 99
        self.assertEqual(run(blob, refs)["status"], "blocked")

    def test_reference_page_list_empty_blocked(self):
        blob, _ = fixture()
        self.assertEqual(run(blob, [])["reason"], "synthetic_reference_format_invalid")

    def test_page_sequence_marker_wrong(self):
        blob, refs = fixture(page_markers={2: "PAGE:3/3"})
        r = run(blob, refs)
        self.assertEqual(r["reason"], "page_sequence_marker_invalid")

    def test_blank_middle_page_review(self):
        blob, refs = fixture(blank={2})
        r = run(blob, refs)
        self.assertEqual(r["reason"], "blank_scanned_or_unreadable_page")
        self.assertEqual(r["readable_page_count"], 1)

    def test_image_only_page_without_ocr_review(self):
        blob, refs = fixture(1, blank={1})
        r = run(blob, refs)
        self.assertEqual(r["status"], "review")
        self.assertFalse(r["ocr_used"])

    def test_first_page_case_identifier_mismatch(self):
        blob, refs = fixture(wrong_case=True)
        self.assertEqual(run(blob, refs)["reason"], "first_page_case_date_or_court_unconfirmed")

    def test_first_page_court_mismatch(self):
        blob, refs = fixture(wrong_court=True)
        self.assertEqual(run(blob, refs)["reason"], "first_page_case_date_or_court_unconfirmed")

    def test_first_page_date_mismatch(self):
        blob, refs = fixture(wrong_date=True)
        self.assertEqual(run(blob, refs)["reason"], "first_page_case_date_or_court_unconfirmed")

    def test_main_reason_section_absent(self):
        blob, refs = fixture(missing_reasons=True)
        self.assertEqual(run(blob, refs)["reason"], "first_page_case_date_or_court_unconfirmed")

    def test_pdf_truncated_no_eof(self):
        blob, refs = fixture()
        self.assertEqual(run(blob[:-100], refs)["reason"], "pdf_eof_trailer_missing")

    def test_html_not_pdf(self):
        self.assertEqual(run(b"<html>fake.pdf</html>"*30, ["x"])["reason"],
                         "pdf_magic_or_size_invalid")

    def test_random_bytes_not_pdf(self):
        self.assertEqual(run(b"\x00"*1024, ["x"])["status"], "blocked")

    def test_pdf_too_large_denied(self):
        blob, refs = fixture()
        padded = blob + b"X" * (MAX_PDF_BYTES+1)
        self.assertEqual(run(padded, refs)["reason"], "pdf_bytes_exceed_test_safety_limit")

    def test_encrypted_pdf_denied(self):
        blob, refs = fixture(1)
        encrypted = rewrite_pdf(blob, lambda w: w.encrypt("synthetic_password"))
        self.assertEqual(run(encrypted, refs)["reason"], "encrypted_pdf_not_allowed")

    def test_embedded_attachment_denied(self):
        blob, refs = fixture(1)
        embedded = rewrite_pdf(
            blob, lambda w: w.add_attachment(
                filename="SYNTHETIC_README.txt", data=b"NOT_A_CASE_RECORD"
            ))
        self.assertEqual(
            run(embedded, refs)["reason"],
            "pdf_contains_interactive_or_embedded_features"
        )

    def test_too_many_pages_denied_before_extraction(self):
        blob, refs = fixture(MAX_PAGES+1)
        r = run(blob, refs[:MAX_PAGES])
        self.assertEqual(r["reason"], "synthetic_reference_format_invalid")
        r = inspect_synthetic_pdf(blob, PROOF, expected_page_texts=None)
        self.assertEqual(r["reason"], "pdf_page_count_out_of_bounds")

    def test_one_page_exceeds_text_limit(self):
        blob, refs = fixture(1, oversized_text=True)
        self.assertLess(len(blob), MAX_PDF_BYTES)
        self.assertGreater(len(normalized(refs[0])), MAX_CHARS_PER_PAGE)
        self.assertEqual(run(blob, refs)["reason"], "one_page_text_exceeds_safety_cap")

    def test_bad_provenance_origin(self):
        blob, refs = fixture()
        r = run(blob, refs, replace(PROOF, origin="https://judgment.judicial.gov.tw.evil.invalid"))
        self.assertEqual(r["reason"], "synthetic_provenance_missing_or_untrusted")

    def test_not_authorized(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, access_authorized=False))["status"],
                         "blocked")

    def test_mock_not_public(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, was_public_in_fixture=False))["status"],
                         "blocked")

    def test_unverified_reference_source(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, independent_reference_supplied=False))["status"],
                         "blocked")

    def test_disallow_real_or_private_case_number(self):
        blob, refs = fixture()
        r = run(blob, refs, replace(PROOF, case_id="TPSM,114,台抗,2605,20251231,1"))
        self.assertEqual(r["status"], "blocked")

    def test_provenance_needs_exact_type(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, {"case_id":CASE})["status"], "blocked")

    def test_only_synthetic_source_kind(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, kind="REAL_JUDICIAL_PDF"))["status"],
                         "blocked")

    def test_invalid_proof_date(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, decision_date="2026-02-30"))["status"],
                         "blocked")

    def test_non_bytes_input(self):
        blob, refs = fixture()
        self.assertEqual(run(bytearray(blob), refs)["reason"], "pdf_must_be_immutable_bytes")

    def test_result_does_not_contain_text_case_or_url(self):
        blob, refs = fixture()
        report = run(blob, refs)
        rendered = json.dumps(report, ensure_ascii=False)
        for forbidden in (CASE, "SYNTHETIC COURT A", "REASONS",
                          "PAGE:1/3", "data.aspx", "http://"):
            self.assertNotIn(forbidden, rendered)

    def test_fail_closed_even_when_synthetic_pages_pass(self):
        blob, refs = fixture()
        r = run(blob, refs)
        self.assertTrue(r["synthetic_reference_fidelity_passed"])
        for gate in ("real_official_pdf_fulltext_verified",
                     "individual_judgment_url_approved",
                     "official_api_used", "stage3_accepted", "pdf_bytes_written_to_disk",
                     "pdf_fulltext_saved", "ocr_used"):
            self.assertFalse(r[gate], gate)

    def test_pdf_normalization_changes_whitespace_only(self):
        self.assertEqual(normalized("Main \n  holding"), normalized("Mainholding"))
        self.assertNotEqual(normalized("EVIDENCE"), normalized("EVIDENCF"))

    def test_proof_rejects_empty_case_id(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, case_id=""))["status"], "blocked")

    def test_proof_rejects_wrong_court(self):
        blob, refs = fixture()
        self.assertEqual(run(blob, refs, replace(PROOF, court="COURT SOMEWHERE"))["status"],
                         "blocked")

    def test_summary_counts_are_never_exposed_as_real_acceptance(self):
        result_obj = result("synthetic_fidelity_passed", "test_only", pages=2)
        self.assertTrue(result_obj["synthetic_reference_fidelity_passed"])
        self.assertFalse(result_obj["real_official_pdf_fulltext_verified"])
        self.assertFalse(result_obj["stage3_accepted"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
