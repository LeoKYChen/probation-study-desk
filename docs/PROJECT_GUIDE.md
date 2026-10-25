# 觀護人學習平臺｜功能、技術與資料維護說明

> 本文件由 2026-10-22 的主分支 README、備考書桌文件與近期程式提交整理，詳述使用流程、技術邊界及內容維護原則。具體畫面與功能是否部署成功，以實際正式網站和最新 Actions 驗收為準。完整重整前文字參見 [README 歷史快照](README_ARCHIVE_2026-10-22.md)。

## 1. 專案定位

網站以臺灣司法特考三等觀護人備考為主，結合歷屆題目、申論作答、國文英文等共同科目、函授進度、主動回憶與少年司法週報。這是個人開源學習工具，**不是**考選部、司法院或其他政府機關的正式網站，也不提供正式國家考試評分。

主要學習路徑為：**確認已學範圍 → 選題 → 獨立作答 → 參考核對 → 收集回饋 → 訂正 → 再次回想**。AI 回饋可協助整理，但不能代替法條、實務與題源查核。

## 2. 功能模組

| 路徑 | 主要內容 | 資料及限制 |
| --- | --- | --- |
| `professional/` | 專業科目、考古題、30 分鐘練習、申論草稿及複習 | 作答與學習紀錄由本地端模組管理 |
| `v2.5/` | 既有考古題練習臺及考科重點整理 | 重點地圖仍是列表式；部分展開區及補強清單暫時隱藏 |
| `common-subjects/` | 國文作文、英文與共同科目練習 | 題庫和來源標註需依個別模組查核 |
| `lectures/` | 函授堂次、觀看進度及 7／30／60／90 天規劃 | 使用者自行登錄；不讀取函授業者帳號 |
| `study-desk/` | 備考書桌、作答版本、回饋、訂正、回想、弱點及選題理由 | IndexedDB 本機保存；跨裝置自動同步暫緩 |
| `daily-simulation/` | 每日模擬題、晚間學習、完整申論與 AI 提示詞 | 獨立的題庫與紀錄格式 |
| `juvenile-news/` | 少年司法週報、CRC、研究及相關政策資訊 | 週報資料需核對來源日期、內容與更新 |
| `active-recall/` | 不先看答案的主動回憶 | 與主題練習搭配使用 |
| `dongdong-time/` | 116 年觀護人 342 題專題練習 | **收錄不代表逐題品質已驗收** |
| `backup/` | 本機紀錄 JSON 匯出、預覽及還原 | 依網站來源與實際模組格式有限制 |
| `print/` | 整理申論與作文，透過瀏覽器列印／另存 PDF | 是列印工具，不等於題庫備份 |
| `offline/` | HTTPS 網站離線快照下載 | 外部 AI 服務與資料更新仍需網路 |

正式入口：[網站首頁](https://leokychen.github.io/probation-study-desk/)；備考書桌的詳細選題、弱點分類與測試狀態，請以 [子模組文件](../study-desk/README.md) 為準。

### 舊模組與備考書桌的關係

備考書桌可由使用者**明確匯入**舊練習快照，辨識可接續的筆記與評語；不會在每次修改時自動同步回原始模組。存在不同版本或來源不明的紀錄時，應保留原始內容並標示不確定性。書桌的「掌握程度」由使用者自評，不自動推定答題分數。

### AI 相關功能的界線

- 「一鍵複製 AI 批改」及「自訂提示詞」主要產生供外部 AI 使用的文字；可按考科／模式保存個人規則，與網站本機備份搭配。
- [雙 AI 協作工作臺](https://leokychen.github.io/multi-ai-review-desk/) 是另一個獨立網站，不是本儲存庫直接呼叫模型的內建閱卷器。特定作答頁面支援經確認後的題目交接及回饋回傳；工作臺的 API 金鑰、模型費用及本機紀錄另行管理。
- AI 評語必須經使用者查證、訂正後才可成為已確認的弱點；不能自動認定所引法源或題源正確。
- 不得放入可識別少年個案、公務秘密、卷證、帳號密碼或 API 金鑰。

## 3. 資料保存、隱私與相容性

網站沒有統一的雲端使用者帳號。本機紀錄可能存於瀏覽器 `localStorage`、`sessionStorage` 或書桌的 `IndexedDB`。這些資料與 GitHub 儲存庫、GitHub Release **沒有自動備份關係**。

- 不同瀏覽器、不同手機、無痕視窗、GitHub Pages 與 Cloudflare 的不同網域都不會自動合併學習紀錄。
- 先使用 [備份中心](../backup/) 或各模組匯出 JSON，再確認檔案確實下載；跨裝置須自行檢視匯入預覽與衝突。
- 不同模組的資料格式、支援欄位與保存範圍可能不同，不能假定單一匯出包含所有來源。
- 瀏覽器網站資料清除、系統清理及 Safari 儲存限制可能造成資料遺失；進行重大更新前應先備份。
- 離線 PWA 快照、GitHub 原始碼 ZIP 和書桌本機版的支援範圍不相同。尤其書桌使用 ES modules 和 IndexedDB，**不可直接以 `file://` 雙擊使用**；若需本機測試應啟動 HTTP 伺服器。

## 4. 技術架構與開發

專案多數學習頁面由 HTML／CSS／JavaScript 和 JS／JSON 題庫組成，少年司法週報另有 React、TypeScript、Vite 原始碼及建置產物。PWA 使用 Service Worker 及 Cache Storage。完整維護另涉及 `.github/workflows/`、`scripts/`、`verification/` 等目錄。

~~~bash
git clone https://github.com/LeoKYChen/probation-study-desk.git
cd probation-study-desk
npm test                      # 全部不需瀏覽器的檢查，免安裝套件
# 只有修改週報 React 原始碼時：
cd juvenile-news/source && npm install && npm run check && npm run build
~~~

網站本身不需打包；週報的 Vite 設定只放在 `juvenile-news/source/`，產物在該資料夾的 `docs/`，確認後再複製到 `juvenile-news/`。發布時必須保留各模組、資料檔、相對路徑、離線資源和相容檔。個別測試：

~~~bash
node common-subjects/test-v02.cjs
node backup/test.cjs
node print/test.cjs
node lectures/test.cjs
node scripts/generate-file-data.cjs --check
node verification/unified-integration.cjs .
npm --prefix verification/sync test
npm --prefix verification/sync run test:browser
~~~

不同測試有不同前置套件與平台需求；請依現有工作流程及子模組文件執行，**測試成功不代表全部題庫內容正確**。備考書桌開發測試可在儲存庫根目錄執行 `python3 -m http.server 8781`，再開 `http://localhost:8781/study-desk/`。

## 5. 題庫、法源與品質

題庫資料以各模組的正式 JS／JSON 為準，例如 `daily-simulation/questions.json`、`juvenile-news/issues.json` 等；產生檔不得手動改成第二套不同的資料。更新時務必保留穩定題目 ID，防止作答與備份無法對應。

品質查核至少區分五個面向：

1. **題源真實**：年度、考試類科、題次、原題或改編題可否追溯到官方資料。
2. **時點正確**：依題目日期判斷適用法規，現行法與歷史法必須區分；可依 [全國法規資料庫](https://law.moj.gov.tw/) 等官方原始來源核對。
3. **實務和研究可靠**：判決、函釋、釋憲文號、研究文獻與引用不得憑空補寫。
4. **申論評分品質**：題目設問、爭點、理論、涵攝、架構及配分均需個別檢查；AI 自評不等於國考閱卷標準。
5. **程式及資料相容**：題目 ID 唯一、備份／還原、手機版、離線快照、跨版本保存與回歸測試。

歷史 README 曾記錄專業題庫 426 題、每日申論模擬 132 題及獨立 342 題專題；這是當時的**資料快照而非 2026-10-22 即時重新盤點數字**，請勿當作已完成官方核對。

## 6. 文件與發布分工

- [主 README](../README.md)：提供使用者快速理解與入口。
- [CHANGELOG](../CHANGELOG.md)：記錄可回溯的功能變動，區分尚未發布與正式 Release。
- [Release 維護指引](RELEASE_PROCESS.md)：版本、測試、標籤及發布、回復程序。
- [備考書桌說明](../study-desk/README.md)：專項功能與驗收。
- [README 歷史快照](README_ARCHIVE_2026-10-22.md)：保存重整前的完整文字供追溯。

## 7. 授權與免責

原創且有權授權的程式碼，以儲存庫的 [LICENSE](../LICENSE)（GPL-3.0-only）為準。國考試題、政府文件、學術研究、新聞、圖片及第三方內容，不因被連結或收錄就自動取得相同授權。請自行確認使用限制。

本網站不是官方機關網站；不保證考試成績、AI 回饋正確、第三方服務可用或學習紀錄永久保存。任何公開 Issue、PR、Release 附件及備份範例都不得包含個資、真實個案或非公開機密資料。
