# 觀護人學習平臺｜Probation Study Desk

> 以臺灣司法特考三等觀護人為核心的開源自主學習網站：從考古題練習、申論作答、學習排程，到訂正、回想與學習紀錄，讓「讀過」逐步變成「寫得出來」。

[**GitHub Pages**](https://leokychen.github.io/probation-study-desk/) · [**Cloudflare 正式站**](https://probation-study30-test.pages.dev/) · [**備考書桌**](https://leokychen.github.io/probation-study-desk/study-desk/) · [**學習管理**](https://leokychen.github.io/probation-study-desk/lectures/) · [**申論評分參考**](https://leokychen.github.io/probation-study-desk/law-scoring/) · [**律師・司法官備考**](https://probation-study30-test.pages.dev/lawyer-judge/) · [**更新紀錄**](CHANGELOG.md) · [**Releases**](https://github.com/LeoKYChen/probation-study-desk/releases) · [**問題回報**](https://github.com/LeoKYChen/probation-study-desk/issues)

**專案性質：** 個人開發、維護的學習輔助工具，**非**考選部、司法院或其他機關的官方網站。參考答案、AI 評語與自行記錄的分數都不是國家考試正式閱卷結果。

## 主要功能

| 入口 | 可以做什麼 |
| --- | --- |
| [**備考書桌**](study-desk/) | 保存多次作答、評語、訂正、再次回想與 Markdown 筆記；搭配函授已學主題、弱點及選題理由安排練習 |
| [專業科目練習](professional/) | 考古題、每日 30 分鐘、四格申論草稿、答案核對、複習與練習月曆；法律科目可切換「申論結構教練」（爭點 → 標題骨架 → 規範與涵攝 → 自評） |
| [v2.5 考古題練習臺](v2.5/) | 553 題選題、作答與草稿、逐題作答連結、原有／補充版本試評、AI 批改交接及備份 |
| [共同科目](common-subjects/) | 國文作文、英文與其他共同科目練習 |
| [學習管理](lectures/) | 管理函授、閱讀、複習與申論；取消原有 90 天上限，支援跨年度排程及月曆逐項編輯、部分／全部完成 |
| [申論評分參考](law-scoring/) | 553 題學習用評分要點；先作答或貼上答案網址，再逐列自評、查看命題者視角並複製 AI 批改文字。另有今日清單、限時練習與拆題核對、作答歷程與二刷提醒 |
| [各科重點整理](law-scoring/summaries.html) | 六科跨類科主題歸納：出題紀錄、核心內容、答題骨架與常見混淆，題號連回申論評分參考。依自評紀錄顯示優先複習的主題（弱點地圖）、失分類型與限時表現 |
| [失分回想／考點回想](law-scoring/review.html) | 沒勾到的得分點與六科 178 個考點，依間隔安排複習；法律三科可先看答題骨架 |
| [通勤模式](law-scoring/commute.html) | 手機單手操作的回想卡與要點卡（六科 843 張），中斷後回到上次位置 |
| [律師・司法官備考](lawyer-judge/) | 第一試選擇題 107–115 年 2,700 題（通勤練習、刑法與刑訴章節篩選、錯題本）、第二試申論 107–114 年 199 題與考選部評分要點 185 題。入口在申論評分參考頂端的開關，預設關閉；紀錄與觀護人平臺分開保存 |
| [每日模擬題／晚間學習室](daily-simulation/) | 分科選題、計時、申論練習、AI 批改提示詞與閱讀資料 |
| [少年司法週報](juvenile-news/) | 少年司法、CRC、國際標準、法制、研究與制度動態 |
| [主動回憶](active-recall/) | 先自行回想，再檢視參考要點 |
| [116 年觀護人專題練習](dongdong-time/) | 既有題庫保留，新增內容暫停；收錄不等於逐題驗收 |
| [警察特考 108–115 年原題](police-exams/) | 指定四科、32 份官方原卷的 127 題 AI 輔助來源比對題；v2.5／備考書桌／專業科目可載入，真人逐卷校稿尚未完成 |

其他工具：[完整 JSON 備份](backup/) · [列印／PDF](print/) · [離線閱讀](offline/) · [雙 AI 協作工作臺（外部網站）](https://leokychen.github.io/multi-ai-review-desk/)

### 一次練習的建議流程

1. 在學習管理安排函授、閱讀、複習與申論，再於備考書桌確認已學範圍並選題。
2. **先自行作答**，再核對法條、題目要求、學理與參考架構；可從題目入口開啟「申論評分參考」，逐列檢查遺漏。
3. 取得人工或 AI 回饋；有需要時使用自訂 AI 批改提示詞，或依頁面支援範圍送交外部雙 AI 工作臺。
4. **自己確認錯誤並訂正**，保留原答案與新版本，安排再次回想。
5. 定期匯出 JSON 備份；重要筆記可另外下載 Markdown 或列印。

## 近期更新（截至 2026-11-14）

以下皆已合併到 `main`，並於 2026-11-14 經發布流程送上 Cloudflare 正式站（`a8946e8`）。細節見 [CHANGELOG](CHANGELOG.md)。

- **律師・司法官備考併入本站**：整站放在 `lawyer-judge/`，從申論評分參考頂端的開關進入，預設關閉。律司的紀錄一律存在 `lj::` 開頭的鍵，不會覆蓋觀護人的紀錄。選擇題新增通勤練習（一次 20 或 30 題，中途離開可續做）及刑法、刑訴章節篩選；仍在錯題本的刑法、刑訴條文與章節，會顯示在本站重點整理頁的「優先複習」。[PR #171](https://github.com/LeoKYChen/probation-study-desk/pull/171)、[#172](https://github.com/LeoKYChen/probation-study-desk/pull/172)、[#173](https://github.com/LeoKYChen/probation-study-desk/pull/173)
- **今日清單**：申論評分參考最上方，可收合；列出到期的回想卡、到二刷日的題目及一題建議新題。[PR #169](https://github.com/LeoKYChen/probation-study-desk/pull/169)
- **作答歷程與二刷**：按「存成一次紀錄」保存分數、用時與拆題步數；低於 60 分隔 7 天、60 到 79 分隔 14 天提醒重寫。[PR #168](https://github.com/LeoKYChen/probation-study-desk/pull/168)
- **限時練習與拆題核對**：依配分計時（每 1 分 1.2 分鐘，含拆題 3 分鐘），時間到只提醒；可與命題者視角的作答動作逐步核對。[PR #162](https://github.com/LeoKYChen/probation-study-desk/pull/162)
- **弱點地圖**：重點整理頁每科上方的「優先複習」，另顯示失分類型（刑法、刑訴、少事法）與限時表現。需要先有自評紀錄才會出現內容。[PR #153](https://github.com/LeoKYChen/probation-study-desk/pull/153)、[#161](https://github.com/LeoKYChen/probation-study-desk/pull/161)、[#170](https://github.com/LeoKYChen/probation-study-desk/pull/170)
- **答題骨架**：刑法、刑訴與保安處分、少事法共 72 個考點各一行骨架，考點回想可先「看骨架」。[PR #157](https://github.com/LeoKYChen/probation-study-desk/pull/157)、[#160](https://github.com/LeoKYChen/probation-study-desk/pull/160)
- **考點回想、通勤模式與要點卡**：六科 178 個考點可間隔複習；通勤模式提供手機單手操作與中斷續讀，要點卡涵蓋六科 843 張。[PR #154](https://github.com/LeoKYChen/probation-study-desk/pull/154)、[#155](https://github.com/LeoKYChen/probation-study-desk/pull/155)、[#163](https://github.com/LeoKYChen/probation-study-desk/pull/163)
- **申論結構教練（第一階段）**：每日 30 分鐘的法律科目可切換為四階段結構訓練，紀錄存在既有的每日紀錄內。[PR #164](https://github.com/LeoKYChen/probation-study-desk/pull/164)–[#166](https://github.com/LeoKYChen/probation-study-desk/pull/166)
- **命題者視角與重點整理**：申論評分參考 553 題皆可查看命題者視角；[各科重點整理](law-scoring/summaries.html)依六科主題歸納歷屆考點。[PR #149](https://github.com/LeoKYChen/probation-study-desk/pull/149)
- **每日 30 分鐘月曆**以實際活動判定是否有紀錄，系統預先配題及空白草稿顯示「無紀錄」。[PR #150](https://github.com/LeoKYChen/probation-study-desk/pull/150)

**尚未驗證：** 上述功能以 Chromium 自動化測試為主；iPhone Safari（WebKit）、實體手機及已安裝離線版升級後的行為，尚未完整實測。律司選擇題的章節是依條號與關鍵字自動歸類，未經人工審定。

### 既有功能與操作

- **學習管理**：原「函授管理」改名，網址仍為 `lectures/`。可輸入預排天數或結束日期，支援超過 90 天及跨年度安排；點選月曆日期新增、編輯函授／閱讀／複習／申論項目，記錄完成比例、實際分鐘、重點疑問及複習標記。重新排程保留已編輯項目；完成狀態不會自動填入實際學習時間。另修正手機日期欄位溢位。見 [操作說明](docs/LEARNING_MANAGEMENT_20261027.md)。
- **申論評分參考**：`law-scoring/` 已收錄 553 題，包含觀護人六科 190 題及相關類科 363 題。可依「類科 → 科目 → 題目」選題；先作答（可寫在頁面、紙上或其他網站並貼上作答網址），再展開要點逐列自評並複製 AI 批改文字；沒勾到的得分點會成為「失分回想卡」。法律題的法規核對標示與學科題待對照教材的狀態須依逐題資料確認；**收錄不代表逐題人工核定**。
- **自動試評保留兩版**：v2.5 原有版本涵蓋既有 426 題；觀護人 108–115 年六科另有 190 題補充版本。答案與草稿共用，兩版試評、人工調分及回饋分別保存，切換版本不會自動重評。可用 [190 題試評清單](v2.5/probation-trial-review.html) 比較；該清單的試用不寫入正式練習紀錄。警察特考 127 題不在原有 426 題自動試評範圍內。
- **逐題作答連結**：v2.5 可為每題保存一個外部作答連結；申論評分參考亦有自己的作答網址欄。兩處屬於不同模組的本機紀錄。
- **保存與 AI 交接修正**：v2.5 寫入失敗時顯示尚未保存，備份中心顯示本機儲存空間用量；每日題庫快取移至 Cache Storage。雙 AI 評語回傳新增重新開啟原頁後補寫回的流程，仍需確認作答版本並搭配相容的外部工作臺。

### 題數與評量範圍

| 模組／機制 | 目前範圍 | 使用界線 |
| --- | --- | --- |
| v2.5／備考書桌／專業科目選題 | 既有 426 題＋警察特考 127 題，共 553 題 | 專業科目每日練習依當日科目選題，警察原題待人工逐卷複核 |
| v2.5 原有版本自動試評 | 既有 11 科 426 題 | 數字代表辨識的論述線索，尚未經專家答案集校準 |
| v2.5 觀護人補充版本試評 | 108–115 年六科 190 題 | 保留原有版本，逐題列出參考綱要與來源限制 |
| 申論評分參考 | 553 題 | AI 草擬要點、本人勾選自評；學科內容仍待教材核對 |

**不同頁面的配分不完全相同**：申論評分參考的法律題採 20／25／35／20，學科題採 20／30／30／20；v2.5 完整 AI 批改提示詞的法律科目採 20／25／35／20，非法律科目維持 30／25／25／20。答題方向模式不評分，其他模組依各自頁面設定。上述均為學習工具的設計，非觀護人考試官方配分。

## 維護方向與凍結基準

使用者已核定 A–N 功能路線：核心練習、備考書桌、少年司法週報、AI 批改交接及備份／離線維持既有服務；部分題庫和雲端同步暫停，知識關聯圖及舊版 UI 封存，v2.7 法律檢索與 JCIS 分離處理。當時特許擴充的題庫範圍為警察特考歷屆官方原題；後續已合併的學習管理及試評等調整見上方近期更新與主分支提交。2026-10-23 已將其 127 題整合到 `main`（[PR #71](https://github.com/LeoKYChen/probation-study-desk/pull/71) 已合併）；原有 426 題 ID 保留，v2.5、備考書桌與專業科目練習皆可載入 **553 題**。**32 份試卷仍待真人逐卷核稿**，現階段的 AI／官方 PDF 來源比對不得視為人工驗收。

詳見 [穩定版凍結及安全整併計畫](docs/STABILITY_FREEZE_20261023.md)與 [決策 Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)。凍結前 `main` 的可追溯還原點是 `archive/stability-baseline-20261023`；**此分支不包含使用者瀏覽器中的私人學習紀錄**。任何程式合併、部署及 Release 仍須獨立完成 CI 與人工驗收。

## 使用中的功能界線與注意事項

- **備考書桌採本機保存**：作答版本與回想等記錄主要存於瀏覽器 IndexedDB；跨裝置自動雲端同步目前暫緩。不同裝置需由使用者手動備份／匯入。
- **不同模組不會自動合併紀錄**：從舊練習頁面接入書桌，需要使用者確認匯入，並保留來源及版本差異。
- **三種評量機制分開使用**：v2.5 自動試評辨識答案中的論述線索；申論評分參考由本人逐列勾選自評；外部 AI 批改產生待查證的文字回饋。三者的分數和結果不能互相視為正式成績。
- **AI 是輔助，不是官方閱卷**：「複製批改提示詞」與獨立雙 AI 工作臺是不同機制；外部 API 金鑰與模型費用由使用者自行管理。回傳評語不等於已完成法條或考古題來源查證。
- **學習追蹤不是能力診斷**：書桌的弱點分類、自評回想變化及選題推薦，依本人確認與既有紀錄運作，不推定正式考試分數。
- **考科重點地圖尚非 Obsidian 式關聯圖**：原有 v2.5 版是文字／列表介面；「完整重點整理」展開區和「補強清單」目前暫時隱藏視覺呈現，未刪除相關原始資料。
- **題庫品質需分級理解**：題目已收錄、程式測試通過、官方題源核對、法規正確性及國考申論品質驗收，不是同一件事。

GitHub Pages 從 `main` 根目錄發布。Cloudflare 使用獨立的發布流程，程式修正需經手動部署與驗收。兩站的發布結果以各自的 [GitHub Actions 紀錄](https://github.com/LeoKYChen/probation-study-desk/actions) 與網站實測為準。2026-11-14 Cloudflare 正式站的發布流程已對 `a8946e8`（[PR #173](https://github.com/LeoKYChen/probation-study-desk/pull/173)）執行成功。

## 學習資料、隱私與備份

網站不要求註冊帳號，主要在目前的瀏覽器保存作答、草稿、自評和學習進度。依模組不同，使用 `localStorage`、`sessionStorage` 或 `IndexedDB`。

- **GitHub Pages 與 Cloudflare、不同瀏覽器和不同裝置，不會自動同步紀錄。** 請定期從 [備份中心](backup/) 或對應模組匯出 JSON，確認備份檔實際保存；匯入前預覽資料差異。
- **申論評分參考的紀錄**（`lawScoring.v2`、失分回想卡、考點回想、要點卡）已納入[備份中心](backup/)的 JSON 匯出；外部作答文件仍需自行保存。同一題在兩台裝置都有紀錄時，匯入不會合併作答歷程，以本機為主，另一份保留在「衝突版本」。備考書桌的 IndexedDB 紀錄請使用書桌自己的 JSON 匯出。
- **律師・司法官備考的紀錄另外保存**：請在 [`lawyer-judge/backup/`](lawyer-judge/backup/) 匯出；離線資料也要在律司頁面另外下載。
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

全站版本依 [發布指引](docs/RELEASE_PROCESS.md) 驗收並以日期命名。已封存的版本可從 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases) 與 [Tags](https://github.com/LeoKYChen/probation-study-desk/tags) 查閱。`v2.5`、`v2.5.4` 是子模組版本。

本專案中可合法授權的原創程式碼以 [LICENSE](LICENSE)（GPL-3.0-only）為準。政府試題、新聞、學術文獻、外部教材和第三方圖片不會因收錄於此儲存庫而自動適用相同授權，須依各自原始來源確認。

---

維護者：[LeoKYChen](https://github.com/LeoKYChen) · [儲存庫](https://github.com/LeoKYChen/probation-study-desk) · **文件更新：2026-11-14**
