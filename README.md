# 觀護人學習平臺｜Probation Study Desk

> 以臺灣司法特考三等觀護人為核心的開源自主學習網站：從考古題練習、申論作答、函授規劃，到訂正、回想與學習紀錄，讓「讀過」逐步變成「寫得出來」。

[**開始使用**](https://leokychen.github.io/probation-study-desk/) · [**備考書桌**](https://leokychen.github.io/probation-study-desk/study-desk/) · [**更新紀錄**](CHANGELOG.md) · [**Releases**](https://github.com/LeoKYChen/probation-study-desk/releases) · [**問題回報**](https://github.com/LeoKYChen/probation-study-desk/issues)

**專案性質：** 個人開發、維護的學習輔助工具，**非**考選部、司法院或其他機關的官方網站。參考答案、AI 評語與自行記錄的分數都不是國家考試正式閱卷結果。

## 主要功能

| 入口 | 可以做什麼 |
| --- | --- |
| [**備考書桌**](study-desk/) | 保存多次作答、評語、訂正、再次回想與 Markdown 筆記；搭配函授已學主題、弱點及選題理由安排練習 |
| [專業科目練習](professional/) | 考古題、30 分鐘訓練、四格申論草稿、答案核對及複習 |
| [v2.5 考古題練習臺](v2.5/) | 保留原有考題、作答、核對與備份流程 |
| [共同科目](common-subjects/) | 國文作文、英文與其他共同科目練習 |
| [函授學習管理](lectures/) | 登錄堂次與觀看進度，預覽 7／30／60／90 天學習計畫 |
| [每日模擬題／晚間學習室](daily-simulation/) | 分科選題、計時、申論練習、AI 批改提示詞與閱讀資料 |
| [少年司法週報](juvenile-news/) | 少年司法、CRC、國際標準、法制、研究與制度動態 |
| [主動回憶](active-recall/) | 先自行回想，再檢視參考要點 |
| [116 年觀護人專題練習](dongdong-time/) | 既有題庫保留，新增內容暫停；收錄不等於逐題驗收 |
| [警察特考 108–115 年原題](police-exams/) | 指定四科、32 份官方原卷的 127 題 AI 輔助來源比對題；v2.5／備考書桌可載入，真人逐卷校稿尚未完成 |

其他工具：[完整 JSON 備份](backup/) · [列印／PDF](print/) · [離線閱讀](offline/) · [雙 AI 協作工作臺（外部網站）](https://leokychen.github.io/multi-ai-review-desk/)

### 一次練習的建議流程

1. 在函授管理或備考書桌確認已學範圍，選一題適合的題目。
2. **先自行作答**，再核對法條、題目要求、學理與參考架構。
3. 取得人工或 AI 回饋；有需要時使用自訂 AI 批改提示詞，或依頁面支援範圍送交外部雙 AI 工作臺。
4. **自己確認錯誤並訂正**，保留原答案與新版本，安排再次回想。
5. 定期匯出 JSON 備份；重要筆記可另外下載 Markdown 或列印。

## 穩定版凍結決策（2026-10-23）

使用者已核定 A–N 功能路線：核心練習、備考書桌、少年司法週報、AI 批改交接及備份／離線維持既有服務；部分題庫和雲端同步暫停，知識關聯圖及舊版 UI 封存，v2.7 法律檢索與 JCIS 分離處理。**警察特考歷屆官方原題是本輪唯一特許擴充的題庫範圍**。2026-10-23 已將其 127 題整合到 `main`（[PR #71](https://github.com/LeoKYChen/probation-study-desk/pull/71) 已合併）；原有 426 題 ID 保留，v2.5 與備考書桌合計可載入 **553 題**，但 `professional/` 仍為原有 426 題。**32 份試卷仍待真人逐卷核稿**，現階段的 AI／官方 PDF 來源比對不得視為人工驗收。

詳見 [穩定版凍結及安全整併計畫](docs/STABILITY_FREEZE_20261023.md)與 [決策 Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)。凍結前 `main` 的可追溯還原點是 `archive/stability-baseline-20261023`；**此分支不包含使用者瀏覽器中的私人學習紀錄**。任何程式合併、部署及 Release 仍須獨立完成 CI 與人工驗收。

## 使用中的功能界線與注意事項（截至 2026-10-23）

- **備考書桌採本機保存**：作答版本與回想等記錄主要存於瀏覽器 IndexedDB；跨裝置自動雲端同步目前暫緩。不同裝置需由使用者手動備份／匯入。
- **不同模組不會自動合併紀錄**：從舊練習頁面接入書桌，需要使用者確認匯入，並保留來源及版本差異。
- **AI 是輔助，不是官方閱卷**：「複製批改提示詞」與獨立雙 AI 工作臺是不同機制；外部 API 金鑰與模型費用由使用者自行管理。回傳評語不等於已完成法條或考古題來源查證。
- **學習追蹤不是能力診斷**：書桌的弱點分類、自評回想變化及選題推薦，依本人確認與既有紀錄運作，不推定正式考試分數。
- **考科重點地圖尚非 Obsidian 式關聯圖**：原有 v2.5 版是文字／列表介面；「完整重點整理」展開區和「補強清單」目前暫時隱藏視覺呈現，未刪除相關原始資料。
- **題庫品質需分級理解**：題目已收錄、程式測試通過、官方題源核對、法規正確性及國考申論品質驗收，不是同一件事。

上述為主分支程式及文件盤點，**不代表 GitHub Pages／Cloudflare 均已部署到相同版本**。Cloudflare 正式發布須依 [手動部署與驗收規範](docs/RELEASE_READINESS_20261023.md) 另行操作；發布結果須核對 [GitHub Actions](https://github.com/LeoKYChen/probation-study-desk/actions) 與實際網站。詳情見 [CHANGELOG](CHANGELOG.md)。

## 學習資料、隱私與備份

網站不要求註冊帳號，主要在目前的瀏覽器保存作答、草稿、自評和學習進度。依模組不同，使用 `localStorage`、`sessionStorage` 或 `IndexedDB`。

- **GitHub Pages 與 Cloudflare、不同瀏覽器和不同裝置，不會自動同步紀錄。** 請定期從 [備份中心](backup/) 或對應模組匯出 JSON，確認備份檔實際保存；匯入前預覽資料差異。
- 清除網站資料、切換裝置或使用無痕模式，可能使本機作答無法恢復；**GitHub Release 或原始碼 ZIP 不包含個人學習資料**。
- 請勿輸入或傳送**可識別少年個案、公務秘密、機密卷證、密碼或 API 金鑰**；也不得把私人備份公開貼至 Issues、PR 或儲存庫。
- 在 HTTPS 網站使用的 PWA 離線快照、GitHub 原始碼 ZIP 和本機 `study-desk/`，支援範圍不同；備考書桌不能直接以 `file://` 開啟使用。

## 開發與文件

本專案主要是 HTML／CSS／JavaScript 靜態頁面；少年司法週報另採 React、TypeScript 與 Vite。原始程式、相容資料及離線資源分散於多個模組，**單純執行 `npm run build` 並不會建立完整網站**。

~~~bash
git clone https://github.com/LeoKYChen/probation-study-desk.git
cd probation-study-desk
npm install
npm run check
npm run build
~~~

維護與驗收文件：

- [詳細功能、技術、資料維護及品質原則](docs/PROJECT_GUIDE.md)
- [備考書桌使用與測試說明](study-desk/README.md)
- [變更紀錄：CHANGELOG](CHANGELOG.md)
- [GitHub Release 發布與回復指引](docs/RELEASE_PROCESS.md)
- [2026-10-23 穩定版部署、驗收與未完成事項](docs/RELEASE_READINESS_20261023.md)
- [32 份官方原卷人工核稿清單](police-exams/reviews/OFFICIAL_32_PAPER_CHECKLIST.md)
- [2026-10-22 整理前 README 完整快照](docs/README_ARCHIVE_2026-10-22.md)

如欲回報程式錯誤、功能建議或題庫勘誤，請至 [GitHub Issues](https://github.com/LeoKYChen/probation-study-desk/issues)，盡可能附頁面、重現步驟、題目年度與可核實的來源。對於未核對的考古題、法條、判決、研究或 AI 引據，不應標示為已驗收。

## 版本與授權

**全站正式版本**將依 [發布指引](docs/RELEASE_PROCESS.md) 的驗收程序，以日期式名稱規劃。**本次穩定化文件更新不建立 Tag 或 GitHub Release**；實際已發布版本以 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases) 與 [Tags](https://github.com/LeoKYChen/probation-study-desk/tags) 為準。子模組的 `v2.5`、`v2.5.4` 不等於全站 Release。

本專案中可合法授權的原創程式碼以 [LICENSE](LICENSE)（GPL-3.0-only）為準。政府試題、新聞、學術文獻、外部教材和第三方圖片不會因收錄於此儲存庫而自動適用相同授權，須依各自原始來源確認。

---

維護者：[LeoKYChen](https://github.com/LeoKYChen) · [儲存庫](https://github.com/LeoKYChen/probation-study-desk) · **文件更新：2026-10-23**
