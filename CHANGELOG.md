# 更新紀錄（CHANGELOG）

本檔記錄觀護人學習平臺**主儲存庫**有來源可核對的重要變更，便於回顧功能演進。**寫入本檔不表示已建立 GitHub Release，也不保證已部署到所有網站。** 完整差異以 Git commit、PR、GitHub Actions 及正式網站驗收為準。

版本規範、驗收與發布方式參見 [Release 維護指引](docs/RELEASE_PROCESS.md)。子模組內的 `v2.5`、`v2.5.4` 等名稱，不直接代表整個網站的 Release 版本。

## [Unreleased] — 截至 2026-10-22 的主分支整理

以下紀錄的是已可在 `main` 追溯的變更，**尚未將這批功能宣告成全站正式穩定 Release**。

### 新增

- **備考書桌本機版**：以 IndexedDB 保存作答版本、人工或 AI 回饋、訂正、再次回想與 Markdown 筆記；可手動匯出／匯入 JSON。不同學習模組的歷史紀錄須經使用者明確匯入，不自動同步或覆寫。參見 [備考書桌文件](study-desk/README.md)。
- **書桌選題及追蹤**：支援已學主題、函授完成確認、個人時間預算、到期複習、使用者確認的弱點類別，以及跨題錯誤類型和自評回想趨勢。選題理由可檢視；這些紀錄不是客觀考試能力分數。[相關程式提交](https://github.com/LeoKYChen/probation-study-desk/commit/10087d46ec34d51dcd26ac7d7acdef5377f80acd)
- **自訂 AI 批改提示詞**：依考科與批改模式保存個人規則，支援 JSON 匯出／匯入；仍是複製提示詞到外部模型的流程，不是網站內建自動閱卷。
- **雙 AI 工作臺交接**：備考書桌、每日模擬題與 v2.5 考古題練習臺可在指定情境下與獨立的雙 AI 工作臺交換題目、作答和回饋，需由使用者確認；API 金鑰與模型呼叫由工作臺另行處理，並可能產生費用。[v2.5 整合提交](https://github.com/LeoKYChen/probation-study-desk/commit/aa608654fa0a2e833e52724ef0ac34dae15225c0)

### 調整與修正

- **備考書桌手機版**：調整考科名稱、操作按鈕與練習捷徑的響應式版面。[相關提交](https://github.com/LeoKYChen/probation-study-desk/commit/0d07acf25ad29b9b4681b92497493bf8687cbdf4)
- **雙 AI 回饋保護**：避免重複回傳覆寫或重複附加回饋；處理 iPhone 上的題目交接與回傳問題。[重複回傳修正](https://github.com/LeoKYChen/probation-study-desk/commit/e0773b88b2e82bad48c24481f42a81f4e113c138)／[iPhone 修正](https://github.com/LeoKYChen/probation-study-desk/commit/eeebd4276c4fbcf9fdb2d5b75a986dc294f69267)
- **主頁入口**：整合備考書桌與外部雙 AI 協作入口，保留舊練習模組；功能入口與瀏覽器學習資料不會因連結而自動合併。

### 尚須留意

- 尚未建立經本檔驗收的**全站正式發布版本號**。首次命名以前，應先確認既有 Tags 和 Releases，避免重複。
- 各題庫的收錄、官方題源核對、法條正確性與申論評分品質是不同驗收項目，不能僅憑題數或程式測試通過認定內容已完備。
- 備考書桌的自動跨裝置雲端同步暫緩；手機版測試不等同所有實體裝置和瀏覽器皆已驗收。

## 2026-10-18 — v2.5 介面整理（歷史紀錄，非全站 Release）

- 暫時隱藏 v2.5「查看完整重點整理、章節優先順序與來源」展開區及「補強清單」視覺區塊；保留既有資料及處理邏輯。參見 [PR #40](https://github.com/LeoKYChen/probation-study-desk/pull/40)。
- 此時的考科重點地圖仍為文字／列表式，**沒有** Obsidian 式節點關聯圖。
- 原 README 當時記載的題數與部署資訊，保留於 [歷史快照](docs/README_ARCHIVE_2026-10-22.md)，不得作為永久即時數字引用。

---

更新此檔時，請將「已合併程式」「已完成測試」「已部署」「已發布 Release」分別記錄，並附上可回溯的來源或驗收連結。
