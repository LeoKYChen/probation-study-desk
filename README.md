# 觀護人學習平臺｜Probation Study Desk

> 以臺灣司法特考三等觀護人為核心的開源自主學習網站：從考古題練習、申論作答、學習排程，到訂正、回想與學習紀錄，讓「讀過」逐步變成「寫得出來」。

[**開始使用**](https://leokychen.github.io/probation-study-desk/) · [**備考書桌**](https://leokychen.github.io/probation-study-desk/study-desk/) · [**學習管理**](https://leokychen.github.io/probation-study-desk/lectures/) · [**申論評分參考**](https://leokychen.github.io/probation-study-desk/law-scoring/) · [**更新紀錄**](CHANGELOG.md) · [**Releases**](https://github.com/LeoKYChen/probation-study-desk/releases) · [**問題回報**](https://github.com/LeoKYChen/probation-study-desk/issues)

**專案性質：** 個人開發、維護的學習輔助工具，**非**考選部、司法院或其他機關的官方網站。參考答案、AI 評語與自行記錄的分數都不是國家考試正式閱卷結果。

## 主要功能

| 入口 | 可以做什麼 |
| --- | --- |
| [**備考書桌**](study-desk/) | 保存多次作答、評語、訂正、再次回想與 Markdown 筆記；搭配函授已學主題、弱點及選題理由安排練習 |
| [專業科目練習](professional/) | 考古題、30 分鐘訓練、四格申論草稿、答案核對及複習 |
| [v2.5 考古題練習臺](v2.5/) | 553 題選題、作答與草稿、逐題作答連結、原有／補充版本試評、AI 批改交接及備份 |
| [共同科目](common-subjects/) | 國文作文、英文與其他共同科目練習 |
| [學習管理](lectures/) | 管理函授、閱讀、複習與申論；取消原有 90 天上限，支援跨年度排程及月曆逐項編輯、部分／全部完成 |
| [申論評分參考](law-scoring/) | 553 題學習用評分要點；先作答或貼上答案網址，再逐列自評、檢視架構並複製 AI 批改文字 |
| [每日模擬題／晚間學習室](daily-simulation/) | 分科選題、計時、申論練習、AI 批改提示詞與閱讀資料 |
| [少年司法週報](juvenile-news/) | 少年司法、CRC、國際標準、法制、研究與制度動態 |
| [主動回憶](active-recall/) | 先自行回想，再檢視參考要點 |
| [116 年觀護人專題練習](dongdong-time/) | 既有題庫保留，新增內容暫停；收錄不等於逐題驗收 |
| [警察特考 108–115 年原題](police-exams/) | 指定四科、32 份官方原卷的 127 題 AI 輔助來源比對題；v2.5／備考書桌可載入，真人逐卷校稿尚未完成 |

其他工具：[完整 JSON 備份](backup/) · [列印／PDF](print/) · [離線閱讀](offline/) · [雙 AI 協作工作臺（外部網站）](https://leokychen.github.io/multi-ai-review-desk/)

### 一次練習的建議流程

1. 在學習管理安排函授、閱讀、複習與申論，再於備考書桌確認已學範圍並選題。
2. **先自行作答**，再核對法條、題目要求、學理與參考架構；可從題目入口開啟「申論評分參考」，逐列檢查遺漏。
3. 取得人工或 AI 回饋；有需要時使用自訂 AI 批改提示詞，或依頁面支援範圍送交外部雙 AI 工作臺。
4. **自己確認錯誤並訂正**，保留原答案與新版本，安排再次回想。
5. 定期匯出 JSON 備份；重要筆記可另外下載 Markdown 或列印。

## 近期更新（2026-10-25～10-28）

以下依主分支已合併程式整理；內容查核與部署狀態需分別確認。

- **學習管理**：原「函授管理」改名，網址仍為 `lectures/`。可輸入預排天數或結束日期，支援超過 90 天及跨年度安排；點選月曆日期新增、編輯函授／閱讀／複習／申論項目，記錄完成比例、實際分鐘、重點疑問及複習標記。重新排程保留已編輯項目；完成狀態不會自動填入實際學習時間。另修正手機日期欄位溢位。見 [操作說明](docs/LEARNING_MANAGEMENT_20261027.md)。
- **申論評分參考**：`law-scoring/` 已收錄 553 題，包含觀護人六科 190 題及相關類科 363 題。可依「類科 → 科目 → 題目」選題；先作答（可寫在頁面、紙上或其他網站並貼上作答網址），再展開要點逐列自評並複製 AI 批改文字；沒勾到的得分點會成為「失分回想卡」。法律題的法規核對標示與學科題待對照教材的狀態須依逐題資料確認；**收錄不代表逐題人工核定**。
- **自動試評保留兩版**：v2.5 原有版本涵蓋既有 426 題；觀護人 108–115 年六科另有 190 題補充版本。答案與草稿共用，兩版試評、人工調分及回饋分別保存，切換版本不會自動重評。可用 [190 題試評清單](v2.5/probation-trial-review.html) 比較；該清單的試用不寫入正式練習紀錄。警察特考 127 題不在原有 426 題自動試評範圍內。
- **逐題作答連結**：v2.5 可為每題保存一個外部作答連結；申論評分參考亦有自己的作答網址欄。兩處屬於不同模組的本機紀錄。
- **保存與 AI 交接修正**：v2.5 寫入失敗時顯示尚未保存，備份中心顯示本機儲存空間用量；每日題庫快取移至 Cache Storage。雙 AI 評語回傳新增重新開啟原頁後補寫回的流程，仍需確認作答版本並搭配相容的外部工作臺。

### 題數與評量範圍

| 模組／機制 | 目前範圍 | 使用界線 |
| --- | --- | --- |
| v2.5／備考書桌選題 | 既有 426 題＋警察特考 127 題，共 553 題 | `professional/` 仍使用既有 426 題 |
| v2.5 原有版本自動試評 | 既有 11 科 426 題 | 數字代表辨識的論述線索，尚未經專家答案集校準 |
| v2.5 觀護人補充版本試評 | 108–115 年六科 190 題 | 保留原有版本，逐題列出參考綱要與來源限制 |
| 申論評分參考 | 553 題 | AI 草擬要點、本人勾選自評；學科內容仍待教材核對 |

**不同頁面的配分不完全相同**：申論評分參考的法律題採 20／25／35／20，學科題採 20／30／30／20；v2.5 完整 AI 批改提示詞的法律科目採 20／25／35／20，非法律科目維持 30／25／25／20。答題方向模式不評分，其他模組依各自頁面設定。上述均為學習工具的設計，非觀護人考試官方配分。

## 維護方向與凍結基準

使用者已核定 A–N 功能路線：核心練習、備考書桌、少年司法週報、AI 批改交接及備份／離線維持既有服務；部分題庫和雲端同步暫停，知識關聯圖及舊版 UI 封存，v2.7 法律檢索與 JCIS 分離處理。當時特許擴充的題庫範圍為警察特考歷屆官方原題；後續已合併的學習管理及試評等調整見上方近期更新與主分支提交。2026-10-23 已將其 127 題整合到 `main`（[PR #71](https://github.com/LeoKYChen/probation-study-desk/pull/71) 已合併）；原有 426 題 ID 保留，v2.5 與備考書桌合計可載入 **553 題**，但 `professional/` 仍為原有 426 題。**32 份試卷仍待真人逐卷核稿**，現階段的 AI／官方 PDF 來源比對不得視為人工驗收。

詳見 [穩定版凍結及安全整併計畫](docs/STABILITY_FREEZE_20261023.md)與 [決策 Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)。凍結前 `main` 的可追溯還原點是 `archive/stability-baseline-20261023`；**此分支不包含使用者瀏覽器中的私人學習紀錄**。任何程式合併、部署及 Release 仍須獨立完成 CI 與人工驗收。

## 使用中的功能界線與注意事項（截至 2026-10-28）

- **備考書桌採本機保存**：作答版本與回想等記錄主要存於瀏覽器 IndexedDB；跨裝置自動雲端同步目前暫緩。不同裝置需由使用者手動備份／匯入。
- **不同模組不會自動合併紀錄**：從舊練習頁面接入書桌，需要使用者確認匯入，並保留來源及版本差異。
- **三種評量機制分開使用**：v2.5 自動試評辨識答案中的論述線索；申論評分參考由本人逐列勾選自評；外部 AI 批改產生待查證的文字回饋。三者的分數和結果不能互相視為正式成績。
- **AI 是輔助，不是官方閱卷**：「複製批改提示詞」與獨立雙 AI 工作臺是不同機制；外部 API 金鑰與模型費用由使用者自行管理。回傳評語不等於已完成法條或考古題來源查證。
- **學習追蹤不是能力診斷**：書桌的弱點分類、自評回想變化及選題推薦，依本人確認與既有紀錄運作，不推定正式考試分數。
- **考科重點地圖尚非 Obsidian 式關聯圖**：原有 v2.5 版是文字／列表介面；「完整重點整理」展開區和「補強清單」目前暫時隱藏視覺呈現，未刪除相關原始資料。
- **題庫品質需分級理解**：題目已收錄、程式測試通過、官方題源核對、法規正確性及國考申論品質驗收，不是同一件事。

上述為主分支程式及文件盤點，**不代表 GitHub Pages／Cloudflare 均已部署到相同版本**。Cloudflare 正式發布須依 [手動部署與驗收規範](docs/RELEASE_READINESS_20261023.md) 另行操作；發布結果須核對 [GitHub Actions](https://github.com/LeoKYChen/probation-study-desk/actions) 與實際網站。詳情見 [CHANGELOG](CHANGELOG.md)。

## 學習資料、隱私與備份

網站不要求註冊帳號，主要在目前的瀏覽器保存作答、草稿、自評和學習進度。依模組不同，使用 `localStorage`、`sessionStorage` 或 `IndexedDB`。

- **GitHub Pages 與 Cloudflare、不同瀏覽器和不同裝置，不會自動同步紀錄。** 請定期從 [備份中心](backup/) 或對應模組匯出 JSON，確認備份檔實際保存；匯入前預覽資料差異。
- **申論評分參考另存本機紀錄**（`lawScoring.v2`）：目前未納入備份中心的 JSON 匯出清單；重要答案請另行複製保存，外部作答文件也需自行保存。備考書桌的 IndexedDB 紀錄請使用書桌自己的 JSON 匯出。
- 清除網站資料、切換裝置或使用無痕模式，可能使本機作答無法恢復；**GitHub Release 或原始碼 ZIP 不包含個人學習資料**。
- 請勿輸入或傳送**可識別少年個案、公務秘密、機密卷證、密碼或 API 金鑰**；也不得把私人備份公開貼至 Issues、PR 或儲存庫。
- 在 HTTPS 網站使用的 PWA 離線快照、GitHub 原始碼 ZIP 和本機 `study-desk/`，支援範圍不同；備考書桌不能直接以 `file://` 開啟使用。

## 開發與文件

本專案主要是 HTML／CSS／JavaScript 靜態頁面，**網站本身不需要打包**：GitHub Pages 直接發布 `main` 的檔案。少年司法週報另採 React、TypeScript 與 Vite，原始碼在 `juvenile-news/source/`。

開發環境需 **Node.js 22.13.0 以上及 Python 3**；根目錄檢查不需先執行 `npm install`。本機預覽可在根目錄啟動 HTTP 伺服器：

~~~bash
git clone https://github.com/LeoKYChen/probation-study-desk.git
cd probation-study-desk
npm test        # 執行不需瀏覽器的檢查
python3 -m http.server 8781
# 開啟 http://localhost:8781/；備考書桌在 /study-desk/
~~~

只有修改少年司法週報的 React 原始碼時才需要編譯，且必須在 `juvenile-news/source` 資料夾內執行；**不要在根目錄執行 `vite build`**，以免覆蓋根目錄的 `docs/` 文件：

~~~bash
cd juvenile-news/source
npm install
npm run check
npm run build   # 產物在 juvenile-news/source/docs/，確認後再複製到 juvenile-news/
~~~

每週新增週報不必編譯，請依 [週報說明](juvenile-news/README.md) 使用 `scripts/weekly-import.cjs`。瀏覽器端到端測試（`verification/*browser*.cjs`、`e2e-*.cjs`）需另行安裝 Playwright，由 GitHub Actions 執行。

維護與驗收文件：

- [詳細功能、技術、資料維護及品質原則](docs/PROJECT_GUIDE.md)
- [備考書桌使用與測試說明](study-desk/README.md)
- [學習管理操作、資料相容與驗證](docs/LEARNING_MANAGEMENT_20261027.md)
- [觀護人 190 題兩版試評與資料保存](docs/probation-trial-versions.md)
- [申論評分參考的框架與來源說明](docs/LAW_SCORING_REFERENCE.md)（含早期提案文字；目前合併範圍見本 README 與主分支）
- [變更紀錄：CHANGELOG](CHANGELOG.md)
- [GitHub Release 發布與回復指引](docs/RELEASE_PROCESS.md)
- [2026-10-23 穩定版部署、驗收與未完成事項](docs/RELEASE_READINESS_20261023.md)
- [32 份官方原卷人工核稿清單](police-exams/reviews/OFFICIAL_32_PAPER_CHECKLIST.md)
- [2026-10-22 整理前 README 完整快照](docs/README_ARCHIVE_2026-10-22.md)

如欲回報程式錯誤、功能建議或題庫勘誤，請至 [GitHub Issues](https://github.com/LeoKYChen/probation-study-desk/issues)，盡可能附頁面、重現步驟、題目年度與可核實的來源。對於未核對的考古題、法條、判決、研究或 AI 引據，不應標示為已驗收。

## 版本與授權

**全站正式版本**將依 [發布指引](docs/RELEASE_PROCESS.md) 的驗收程序，以日期式名稱規劃。**本次 README 更新不建立 Tag 或 GitHub Release**；實際已發布版本以 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases) 與 [Tags](https://github.com/LeoKYChen/probation-study-desk/tags) 為準。子模組的 `v2.5`、`v2.5.4` 不等於全站 Release。

本專案中可合法授權的原創程式碼以 [LICENSE](LICENSE)（GPL-3.0-only）為準。政府試題、新聞、學術文獻、外部教材和第三方圖片不會因收錄於此儲存庫而自動適用相同授權，須依各自原始來源確認。

---

維護者：[LeoKYChen](https://github.com/LeoKYChen) · [儲存庫](https://github.com/LeoKYChen/probation-study-desk) · **文件更新：2026-10-28**
