# 108–115年警察犯罪防治預防組｜官方歷屆原題收錄

## 需求與既有平臺相容

**限定108–115年，且只納入下列四份官方科目（按年度逐一查核是否設科）**：

- 一般警察人員考試三等犯罪防治人員預防組：心理學
- 同上：諮商與輔導
- 同上：刑法與刑事訴訟法
- 警察人員考試三等犯罪防治人員預防組：犯罪學與犯罪預防

注意「警察人員考試」及「一般警察人員考試」不是同一考試。其他科目**不加入**。

## 目前實作（不誇大收錄）

- `catalog.json` 保存8個年度與4科32個查核格，以及115年已定位的4份官方試卷URL。
- `tools/collect_originals.py` 從考選部目錄定位試卷，下載官方PDF，以原文抽取題幹、子題和配分，逐卷檢查年份、等別、類科、科目。不能定位、文字異常或 PDF 不是考選部來源，都在 `audit.json` 保留問題，不以其他來源頂替。
- GitHub Actions `Police original past papers audit (108-115)` 在獨立工作環境產出 `candidates.json` 和 `audit.json` 作為審稿附件；**不發布、也不自動寫入正式題庫**。
- 擷取文字需對照官方 PDF 逐題核對（包括附件圖表、子題與配分），並由人工填寫 `review receipts` 記載題號、PDF雜湊、文字雜湊及核對者後，方可用 `tools/promote_reviewed.py` 生成正式 `questions.approved.js`。
- `approved-loader.js` 只接受 official-original、已核對、年度與考科合法、具雙雜湊的題目；拒收改編、來源不明與重複ID。現有426題不被覆蓋。
- `v2.5/` 追加批准原題，可使用**刷題王／阿摩（未核對直達頁先提供搜尋）、四格草稿、完整申論、系統初評、一鍵複製AI批改、評語保存、複習與備份**；`study-desk/` 可使用同一份核准原題並保留舊紀錄。
- 既有`professional/` 受版型與來源保護，未修改其原有題庫；完整功能請走 `v2.5/`。

## 如何執行收集（GitHub Actions）

開啟 Actions -> **Police original past papers audit (108-115)** -> Run workflow。預設8年；可填單一年份。

取得附件 `candidates.json` 與 `audit.json`，逐題開啟考選部官方原卷，比對PDF視覺畫面、文字、題號及配分。若PDF為影像檔、公式或圖表無法擷取，標記「待處理」，不虛構文字。若目錄找不到該卷，保留`unresolved`，不得直接當作「當年沒出題」。

核對收據範例（不得在未檢查原卷前填 true）：

```json
{
  "police-115-counseling-1": {
    "reviewedAgainstOfficialPdf": true,
    "reviewer": "人工核對者代號",
    "checkedAt": "2026-10-22",
    "pdfSha256": "從audit和candidate抄錄64位SHA256",
    "textSha256": "該題候選原文SHA256"
  }
}
```

將已核對的收據儲存為JSON後，執行：

```bash
python police-exams/tools/promote_reviewed.py --candidates candidates.json --receipts receipts.json --out police-exams/questions.approved.js
```

新題務必與原來的題庫資料分開保存；確認CI與瀏覽器測試後才提交合併。**未完成核對的題目，既不能進正式網站，也不能加計已收錄題數。**

## 來源

- [考選部考畢試題查詢平臺](https://wwwq.moex.gov.tw/exam/wFrmExamQandASearch.aspx)
- 逐年官方目錄請見 `catalog.json`；官方PDF見來源`sourceUrl`。
