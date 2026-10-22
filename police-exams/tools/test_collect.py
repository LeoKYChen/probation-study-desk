import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_originals import discover, extract_questions, unnumbered_pdf_question_paragraphs, validate_header, valid_url, CATALOG

EXAM="115060"
PAPER="https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115060&c=402&s=0804&q=1"
HTML=f"""<main>
<div>一般警察人員考試三等考試_犯罪防治人員類別預防組</div>
<div>社會學與社會工作 <a href="bad">試題</a></div>
<div>諮商與輔導 <a href="{PAPER}">試題</a></div>
<div>一般警察人員考試三等考試_行政警察人員</div>
<div>心理學 <a href="{PAPER}">試題</a></div>
<div>警察人員考試三等考試_犯罪防治人員類別預防組</div>
<div>犯罪學與犯罪預防 <a href="{PAPER.replace('0804','1102')}">試題</a></div>
</main>"""

class OfficialPaperTests(unittest.TestCase):
    def test_year_catalog_all_eight(self):
        self.assertEqual([x["year"] for x in CATALOG["years"]],list(range(108,116)))
        self.assertEqual(len(CATALOG["subjects"]),4)
    def test_allowlist_rejects_forged(self):
        self.assertIsNone(valid_url("https://attacker.example/path/wHandExamQandA_File.ashx?t=Q&code=115060",PAPER,EXAM))
        self.assertIsNone(valid_url(PAPER.replace("115060","114060"),PAPER,EXAM))
        self.assertEqual(valid_url(PAPER,PAPER,EXAM),PAPER)
    def test_group_detection_and_exclusions(self):
        found=discover(HTML,PAPER,EXAM)
        self.assertEqual(set(found),{"counseling","criminology_prevention"})
        self.assertNotIn("psychology",found)
    def test_original_question_body_never_paraphrased(self):
        source="""115年公務人員特種考試警察人員、一般警察人員考試試題
考 試 別：一般警察人員考試
等 別：三等考試
類科組別：犯罪防治人員預防組
科 目：諮商與輔導
一、請詳細說明甲問題的核心概念及法律依據？並論述乙問題的具體理由及實務運用。（25 分）
二、請比較理論A、理論B，並舉例說明。（25 分）
三、請從少年最佳利益分析，分別回答（一）及（二）。（25 分）
四、請就跨機關合作提出具體可行的實際做法，並分析可能遇到的程序或專業倫理限制。（25 分）"""
        sp=next(x for x in CATALOG["subjects"] if x["key"]=="counseling")
        self.assertFalse(validate_header(source,115,sp))
        questions,warnings=extract_questions(source,115,sp,PAPER,"hash")
        self.assertEqual(len(questions),4)
        self.assertEqual(warnings,[])
        self.assertEqual(questions[1]["body"],"二、請比較理論A、理論B，並舉例說明。（25 分）")
        self.assertEqual(questions[1]["sourceKind"],"candidate-original-unreviewed")
        self.assertFalse(questions[1]["verified"])
    def test_general_police_header_never_matches_police(self):
        police=next(x for x in CATALOG["subjects"] if x["key"]=="criminology_prevention")
        fake=("115年公務人員考試試題\\n考 試 別：一般警察人員考試\\n"
              "等 別：三等考試\\n類科組別：犯罪防治人員預防組\\n"
              "科 目：犯罪學與犯罪預防\\n" + "考題內容"*100)
        self.assertIn("警察考試別未核對",validate_header(fake,115,police))

    def test_unnumbered_pdf_110_psychology(self):
        """Some older exam PDFs render 一、二、 visibly but omit their glyph in text extraction."""
        source = ("※注意：禁止使用電子計算器。\n不必抄題，作答時請將試題題號及答案依照順序寫在試卷上。\n\n"
                  "請試述心理學者對影響遺忘的原因有那些不同看法？（25 分）\n\n"
                  "在社會心理學領域，團體迷思是一個重要議題。請說明其意義、因素與對策。（25 分）\n\n"
                  "請試述下列名詞之意涵：（每小題5 分，共25 分）\n"
                  "implicit memory\nPremack principle\nhallucination vs. delusion\n"
                  "antisocial personality disorder\nnature vs. nurture\n\n"
                  "根據 Freud 的心理分析理論，請列舉至少 10 種防衛機制，並分述之。（25 分）")
        sp=next(x for x in CATALOG["subjects"] if x["key"]=="psychology")
        qs,warnings=extract_questions(source,110,sp,PAPER,"hash")
        self.assertEqual(len(qs),4)
        self.assertEqual(qs[2]["body"].count("nature vs. nurture"),1)
        self.assertFalse(qs[0]["verified"])
        self.assertTrue(any("漏掉題號" in w for w in warnings))
        self.assertFalse(qs[0]["body"].startswith("一、"),"Do not synthesize characters not extracted from PDF")
    def test_unnumbered_two_page_113_criminal_law(self):
        source = ("※注意：不必抄題，作答時請將試題題號及答案依照順序寫在試卷上。\n\n"
                  "甲乙丙共同為犯罪行為，請討論甲乙丙三人可能成立的罪名及各自責任。（25 分）\n\n"
                  "甲酒後駕車肇事逃逸，請詳細分析相關刑事責任及各行為階段。（25 分）\n\n"
                  "甲在警局拒絕夜間詢問且等待辯護人，請判斷自白是否具證據能力。（25 分）\n\f\n"
                  "代號：30160-30360\n頁次：2-2\n"
                  "甲缺席審判，法院判決後提出上訴。請討論上訴第三審有無理由。（25 分）")
        sp=next(x for x in CATALOG["subjects"] if x["key"]=="criminal_law_procedure")
        qs,warnings=extract_questions(source,113,sp,PAPER,"hash")
        self.assertEqual(len(qs),4)
        self.assertNotIn("代號：",qs[3]["body"])
        self.assertTrue(any("漏掉題號" in w for w in warnings))

    def test_short_or_wrong_year_not_passed(self):
        sp=next(x for x in CATALOG["subjects"] if x["key"]=="counseling")
        self.assertTrue(validate_header("110年考試/一般警察人員/犯罪防治人員預防組/諮商與輔導",115,sp))

if __name__=="__main__":
    unittest.main()
