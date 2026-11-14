# 律司備考平臺｜v2.5 考古題練習臺

由觀護人學習平臺的 v2.5 練習臺改版而來，功能與程式結構相同，科目與題庫換成律師、司法官考試。

- **題庫**：預設為空。用根目錄的 `scripts/import-questions.mjs` 匯入你自備的題目後，重新整理頁面即可練習。
- **評分引擎**：逐題評分（`rubrics.js`、`legal-pilots.js`、`full-pilots.js`、`pending-pilots-data.js`）與主題診斷（`topic-rubrics.js`、`all-topics.js`、`content-standards.js`）的程式都保留，原觀護人題目的規則已移除。日後替律師、司法官題目新增規則時，依各檔原格式以題目 id 為鍵登錄。
- **考科重點地圖**：`study-map-data.js` 預設為空，可依每科一筆 `{subject, source, text}` 的格式加入你的重點整理。
- **自動參考分數**是本機文字規則判定，不是官方分數；法條與實務見解請自行核對。

顯示開關（沿用原專案）：

| 檔案 | 顯示開關 | 目前設定 | 恢復顯示 |
| --- | --- | --- | --- |
| `study-map.js` | `SHOW_FULL_NOTES` | `false` | 改為 `true` |
| `review25.js` | `SHOW_REVIEW_LIST` | `false` | 改為 `true` |
