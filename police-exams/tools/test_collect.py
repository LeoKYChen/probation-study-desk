import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_originals import discover, extract_questions, validate_header, valid_url, CATALOG

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

    def test_short_or_wrong_year_not_passed(self):
        sp=next(x for x in CATALOG["subjects"] if x["key"]=="counseling")
        self.assertTrue(validate_header("110年考試/一般警察人員/犯罪防治人員預防組/諮商與輔導",115,sp))

if __name__=="__main__":
    unittest.main()
