"""Stage3u offline tests: synthetic XML and mocked HTTP only, zero live calls."""
import contextlib
import io
import json
import unittest
from unittest.mock import patch

from xml_prefix_probe import (
    SOURCE, MAX_WHOLE_BYTES, PREFIX_BYTES,
    approved_url, base, inspect_prefix, live, selftest
)

SYN = (b'<?xml version="1.0" encoding="UTF-8"?>\n'
       b'<SYNTHETIC_ROOT><SYNTHETIC_LAW>'
       b'<SYNTHETIC_NAME>PERSONAL_FAKE_TEST_VALUE'
       b'</SYNTHETIC_NAME>'
       b'<SYNTHETIC_ARTICLES><SYNTHETIC_ARTICLE>'
       b'TEST_ONLY_NO_ACTUAL_LAW'
       b'</SYNTHETIC_ARTICLE></SYNTHETIC_ARTICLES>'
       b'</SYNTHETIC_LAW></SYNTHETIC_ROOT>')


class FakeHTTP:
    def __init__(self, status=200, headers=None, blob=b"", url=SOURCE):
        self.status = status
        self.headers = headers or {}
        self.blob = blob
        self.url = url
        self.read_calls = []

    def geturl(self):
        return self.url

    def read(self, n):
        self.read_calls.append(n)
        return self.blob[:n]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class FakeOpener:
    def __init__(self, head, get=None):
        self.head, self.get = head, get
        self.calls = []

    def open(self, req, timeout):
        self.calls.append((req.get_method(), timeout))
        if req.get_method() == "HEAD":
            return self.head
        if self.get is None:
            raise AssertionError("GET must not occur")
        return self.get


class PrefixParserTests(unittest.TestCase):
    def test_selftest(self):
        with contextlib.redirect_stdout(io.StringIO()):
            selftest()

    def test_source_exact(self):
        self.assertTrue(approved_url(SOURCE))

    def test_source_rejects_http(self):
        self.assertFalse(approved_url(SOURCE.replace("https://", "http://")))

    def test_source_rejects_evil_host(self):
        self.assertFalse(approved_url(SOURCE.replace(".gov.tw", ".gov.tw.evil.invalid")))

    def test_source_rejects_token(self):
        self.assertFalse(approved_url(SOURCE+"&token=bad"))

    def test_source_rejects_unexpected_download_type(self):
        self.assertFalse(approved_url(SOURCE.replace("RAW_XML", "XML")))

    def test_source_rejects_fragment(self):
        self.assertFalse(approved_url(SOURCE+"#test"))

    def test_source_rejects_credentials(self):
        self.assertFalse(approved_url(SOURCE.replace("https://","https://a:b@")))

    def test_valid_xml_prefix_root(self):
        r = inspect_prefix(SYN)
        self.assertEqual(r["root_tag"], "SYNTHETIC_ROOT")
        self.assertEqual(r["first_child_tag"], "SYNTHETIC_LAW")

    def test_partial_xml_is_not_a_validated_full_document(self):
        r=inspect_prefix(SYN[:90])
        self.assertTrue(r["xml_prefix_structure_observed"])
        self.assertFalse(r["xml_document_complete"])

    def test_even_complete_synthetic_xml_not_live_official_authentication(self):
        r=inspect_prefix(SYN)
        self.assertFalse(r["official_xml_schema_verified"])
        self.assertFalse(r["actual_xml_field_values_verified"])
        self.assertFalse(r["stage3_accepted"])

    def test_prefix_metadata_never_contains_text(self):
        r=inspect_prefix(SYN)
        out=json.dumps(r)
        for raw in ("PERSONAL_FAKE_TEST_VALUE", "TEST_ONLY_NO_ACTUAL_LAW",
                    "SYNTHETIC_ARTICLE>", "DType=RAW_XML"):
            self.assertNotIn(raw, out)

    def test_prefix_tag_names_are_structural(self):
        r=inspect_prefix(SYN)
        self.assertIn("SYNTHETIC_NAME", r["shallow_tag_names"])

    def test_single_tag_insufficient_to_claim_structure(self):
        r=inspect_prefix(b"<OnlyRoot>prefix")
        self.assertEqual(r["status"], "review")
        self.assertIsNone(r["first_child_tag"])

    def test_not_xml_empty(self):
        self.assertEqual(inspect_prefix(b"")["reason"], "empty_or_above_prefix_limit")

    def test_not_xml_json(self):
        self.assertEqual(inspect_prefix(b'{"root":"fake"}')["reason"], "not_xml_start")

    def test_zip_no_unzip(self):
        self.assertEqual(inspect_prefix(b"PK\x03\x04zip")["reason"],
                         "zip_content_not_xml_no_extraction")

    def test_gzip_no_decompression(self):
        self.assertEqual(inspect_prefix(b"\x1f\x8bgarbage")["reason"],
                         "gzip_content_not_xml_no_extraction")

    def test_html_denied(self):
        self.assertEqual(inspect_prefix(b"<html><body>n</body></html>")["reason"],
                         "html_not_xml_dataset")

    def test_doctype_denied(self):
        self.assertEqual(inspect_prefix(b"<!DOCTYPE root><root><child/></root>")["reason"],
                         "dtd_or_entity_declaration_forbidden")

    def test_entity_declaration_denied(self):
        self.assertEqual(inspect_prefix(b"<root><!ENTITY x 'hello'><child/></root>")["reason"],
                         "dtd_or_entity_declaration_forbidden")

    def test_xml_bomb_declaration_denied(self):
        evil=b"<!DOCTYPE a [<!ENTITY lol 'ha'>]><a><b>&lol;</b></a>"
        self.assertEqual(inspect_prefix(evil)["status"], "review")

    def test_malformed_xml_yields_review(self):
        self.assertEqual(inspect_prefix(b"<broken><x></broken>")["reason"],
                         "partial_xml_parse_error")

    def test_too_many_input_bytes_denied(self):
        r=inspect_prefix(b"x" * (PREFIX_BYTES+1))
        self.assertEqual(r["reason"], "empty_or_above_prefix_limit")

    def test_prefix_tag_names_truncated(self):
        b=b"<Root>"+b"".join(("<tag%d/>"%i).encode() for i in range(40))+b"</Root>"
        r=inspect_prefix(b)
        self.assertLessEqual(len(r["shallow_tag_names"]),20)

    def test_duplicate_tag_names_are_not_misleading_new_columns(self):
        r=inspect_prefix(b"<Root><item/><item/><item/></Root>")
        self.assertEqual(r["shallow_tag_names"],["Root","item"])

    def test_unicode_element_name_not_leaked(self):
        r=inspect_prefix("<根><法條>文本</法條></根>".encode())
        self.assertEqual(r["shallow_tag_names"],[])
        self.assertFalse(r["xml_prefix_structure_observed"])

    def test_attributes_not_saved(self):
        r=inspect_prefix(b'<Root secret="SENSITIVE_TEST_SECRET"><Child value="HIDE"/></Root>')
        self.assertNotIn("SENSITIVE_TEST_SECRET",json.dumps(r))
        self.assertNotIn("HIDE",json.dumps(r))

    def test_no_live_legal_claims_in_default(self):
        r=base()
        for k in ("stage3_accepted","xml_document_complete",
                  "law_current_effect_verified","full_dataset_downloaded",
                  "member_api_used","pdf_downloaded"):
            self.assertFalse(r[k])

    def test_head_greater_than_cap_never_gets(self):
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":str(MAX_WHOLE_BYTES+1)}))
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"official_dataset_too_large_or_empty")
        self.assertEqual([x[0] for x in opener.calls],["HEAD"])

    def test_head_no_length_never_gets(self):
        opener=FakeOpener(FakeHTTP())
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"head_size_not_disclosed_no_get")
        self.assertEqual(len(opener.calls),1)

    def test_head_403_never_gets(self):
        opener=FakeOpener(FakeHTTP(status=403,headers={"Content-Length":"1000"}))
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"head_not_official_200")
        self.assertEqual(len(opener.calls),1)

    def test_head_redirected_to_other_host_stops(self):
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"1000"},
            url="https://evil.invalid/response.xml"))
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"head_not_official_200")

    def test_bounded_get_uses_no_more_than_prefix(self):
        get=FakeHTTP(status=206,blob=SYN,headers={"Content-Length":str(len(SYN))})
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"1100"}),get)
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(get.read_calls,[PREFIX_BYTES])
        self.assertEqual([x[0] for x in opener.calls],["HEAD","GET"])
        self.assertTrue(r["xml_prefix_structure_observed"])
        self.assertFalse(r["xml_document_complete"])

    def test_server_ignores_range_keeps_only_prefix_and_never_complete(self):
        get=FakeHTTP(status=200,blob=SYN+ (b"junk"*100),headers={"Content-Length":"5000"})
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"5000"}),get)
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertFalse(r["range_honored"])
        self.assertFalse(r["full_dataset_downloaded"])
        self.assertLessEqual(r["bytes_inspected"],PREFIX_BYTES)

    def test_get_larger_than_head_cap_denied_without_read(self):
        get=FakeHTTP(status=200,blob=SYN,headers={"Content-Length":str(MAX_WHOLE_BYTES+1)})
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"3000"}),get)
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"get_response_too_large")
        self.assertEqual(get.read_calls,[])

    def test_get_wrong_source_host_denied_without_read(self):
        get=FakeHTTP(status=200,blob=SYN,url="https://evil.invalid/payload.xml")
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"4000"}),get)
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        self.assertEqual(r["reason"],"get_redirect_or_unexpected_status")
        self.assertEqual(get.read_calls,[])

    def test_no_court_case_metadata_stored_in_mock_result(self):
        get=FakeHTTP(status=206,blob=SYN)
        opener=FakeOpener(FakeHTTP(headers={"Content-Length":"2200"}),get)
        with patch("xml_prefix_probe._opener",return_value=opener):
            r=live()
        for val in ("TEST_ONLY_NO_ACTUAL_LAW","PERSONAL_FAKE_TEST_VALUE",
                    "TPSM,","JDoc"):
            self.assertNotIn(val,json.dumps(r))


if __name__ == "__main__":
    unittest.main(verbosity=2)
