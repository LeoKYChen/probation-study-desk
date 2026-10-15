#!/usr/bin/env python3
"""Synthetic parser unit tests. NO synthetic law data is shipped to the site."""
import sys
import json
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_official_laws import parse, article_number

def fixture():
    def law(name, pcode, count):
        a=[{"ArticleType":"A", "ArticleNo":f"第 {i} 條", "ArticleContent":f"synthetic test article {i}"} for i in range(1,count+1)]
        if pcode=="C0010011":
            a.append({"ArticleType":"A","ArticleNo":"第 3-1 條","ArticleContent":"synthetic test item 通譯"})
        return {"LawName":name,"LawURL":f"https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode={pcode}","LawModifiedDate":"20230621","LawArticles":a}
    return {"UpdateDate":"synthetic test","Laws":[law("少年事件處理法","C0010011",65),law("保安處分執行法","I0030002",25)]}

class ParserTests(unittest.TestCase):
    def test_article_normalization(self):
        self.assertEqual(article_number("第 3-1 條"),"3-1")
        self.assertEqual(article_number("第3條之1"),"3-1")
    def test_happy_case(self):
        out=parse(json.dumps(fixture(),ensure_ascii=False).encode())
        self.assertEqual(len(out["articles"]),91)
        self.assertEqual(len({(x["id"],x["articleKey"]) for x in out["articles"]}),91)
    def test_reject_missing_law(self):
        obj=fixture();obj["Laws"].pop()
        with self.assertRaises(ValueError):parse(json.dumps(obj,ensure_ascii=False).encode())
    def test_reject_duplicate_article(self):
        obj=fixture();obj["Laws"][0]["LawArticles"].append(obj["Laws"][0]["LawArticles"][0])
        with self.assertRaises(ValueError):parse(json.dumps(obj,ensure_ascii=False).encode())
    def test_reject_truncated_safeguards(self):
        obj=fixture();obj["Laws"][0]["LawArticles"][-1]["ArticleContent"]="missing provision"
        with self.assertRaises(ValueError):parse(json.dumps(obj,ensure_ascii=False).encode())

if __name__=="__main__":unittest.main()
