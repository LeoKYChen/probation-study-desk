# 更新紀錄（CHANGELOG）

本檔記錄觀護人學習平臺**主儲存庫**有來源可核對的重要變更，便於回顧功能演進。**寫入本檔不表示已建立 GitHub Release，也不保證已部署到所有網站。** 完整差異以 Git commit、PR、GitHub Actions 及正式網站驗收為準。

版本規範、驗收與發布方式參見 [Release 維護指引](docs/RELEASE_PROCESS.md)。子模組內的 `v2.5`、`v2.5.4` 等名稱，不直接代表整個網站的 Release 版本。

## 2026-10-25 — 儲存空間與雙 AI 回傳穩定化（PR #98，尚未合併）

- **儲存空間已滿不再靜默遺失作答**：v2.5 練習臺寫入失敗時提示備份，狀態列改為「尚未保存」；匯入 JSON 先寫入成功才替換紀錄。
- **每日題庫快取移出 localStorage**：v2.5 每日模擬與每日學習室改用 Cache Storage 保存上次讀取的題庫，並刪除舊的 localStorage 副本，釋出共用空間；離線時仍可讀取，列印頁同步支援。
- **雙 AI 回傳可補寫回**：原練習頁重新整理或被 iPhone Safari 關閉後，重新開啟時會詢問是否寫回已完成的評語（一週內有效）；以指紋比對答案，答案已改則不寫入。需搭配雙 AI 工作臺 v0.16。
- **備份中心顯示本機儲存空間用量**，用量達 80% 時提醒先備份。
- **開發流程**：移除根目錄過時的週報開發檔（`tsconfig.json`、`vite.config.ts`、`page.tsx` 等）；根目錄 `vite build` 曾會清空 `docs/`。週報改在 `juvenile-news/source` 編譯。新增 `npm test`（26 項免安裝檢查）、題庫複本一致性檢查，以及 `All checks` 彙總 CI。

## 2026-10-23 — 進入功能凍結與維護階段（已合併程式，非 GitHub Release）

### 方向與發布安全

- **A–N 功能路線凍結**：維持核心備考、備考書桌、雙 AI 交接、少年司法週報、主動回憶、列印／備份／離線等既有功能；暫停 116 年獨立專題題庫新增、Staresto 擴充與雲端同步；知識關聯圖、舊 UI 實驗封存，法律檢索及 JCIS 移至獨立專案追蹤。參見 [Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)、[PR #78（已合併）](https://github.com/LeoKYChen/probation-study-desk/pull/78)。
- **保留回復基準**：`archive/stability-baseline-20261023` 保存凍結時的公開程式碼提交（不含私人學習紀錄）；新增非部署型功能與資料相容檢查。
- **Cloudflare 受控發布**：原主線 push 改以建置與測試為主；正式發布需要在 `main` 人工觸發 `workflow_dispatch` 並明確輸入 `RELEASE`，才會執行 production publish，GitHub Pages 仍可能循既有流程發布。**這些保護已合併為程式設定，不代表本次曾觸發 Cloudflare 正式發布或完成現網驗收。** 參見 [工作流程](.github/workflows/sync-cloudflare-production.yml) 與 [驗收紀錄](docs/RELEASE_READINESS_20261023.md)。

### 題庫與相容性

- **108–115 年警察特考指定四科原題整合**：32 份官方試卷、127 道以 AI 輔助官方 PDF 來源比對的原題，透過 [PR #71（已合併）](https://github.com/LeoKYChen/probation-study-desk/pull/71) 進入主分支；既有 426 題 ID 不變，v2.5 與備考書桌可載入共 **553 題**，`professional/` 仍為原 426 題。參見 [題庫說明](police-exams/README.md)。
- **重要品質界線**：32 份原卷仍待真人逐卷校稿，包含 9 份高關注試卷／31 題優先複查；程式「已核准載入」及 AI 比對不是逐題人工驗收，不得宣稱已有官方標準答案或人工校稿完成。參見 [人工校稿清單](police-exams/reviews/OFFICIAL_32_PAPER_CHECKLIST.md)。
- **離線、鏡像及部署保護**：新增警察題庫及 `dual-ai-bridge.js` 必要資產檢查，修正 CI 瀏覽器測試及手機交接相關流程，保護既有 ZIP／PWA／Cloudflare 相容性。合併提交可見 [程式紀錄](https://github.com/LeoKYChen/probation-study-desk/commits/main/)。

### 待完成

- 正式 Release 的既有 Tags／Releases 名稱、候選提交 SHA、所有 Actions、GitHub Pages／Cloudflare 當前線上版本、iPhone Safari 實機以及個人 JSON 匯出還原，仍需逐項核實；見 [Issue #72](https://github.com/LeoKYChen/probation-study-desk/issues/72)。
- 不把「程式碼已合併」「CI 檢查成功」「真人核稿完成」「正式網站同步」「已建立 GitHub Release」混為一談。

## [Unreleased] — 2026-10-22 歷史整理（非正式 Release）

以下紀錄的是已可在 `main` 追溯的變更，**尚未將這批功能宣告成全站正式穩定 Release**。

### 新增

- **備考書桌本機版**：以 IndexedDB 保存作答版本、人工或 AI 回饋、訂正、再次回想與 Markdown 筆記；可手動匯出／匯入 JSON。不同學習模組的歷史紀錄須經使用者明確匯入，不自動同步或覆寫。參見 [備考書桌文件](study-desk/README.md)。
- **書桌選題及追蹤**：支援已學主題、函授完成確認、個人時間預算、到期複習、使用者確認的弱點類別，以及跨題錯誤類型和自評回想趨勢。選題理由可檢視；這些紀錄不是客觀考試能力分數。[相關程式提交](https://github.com/LeoKYChen/probation-study-desk/commit/10087d46ec34d51dcd26ac7d7acdef5377f80acd)
- **自訂 AI 批改提示詞**：依考科與批改模式保存個人規則，支援 JSON 匯出／匯入；仍是複製提示詞到外部模型的流程，不是網站內建自動閱卷。
- **雙 AI 工作臺交接**：備考書桌、每日模擬題與 v2.5 考古題練習臺可在指定情境下與獨立的雙 AI 工作臺交換題目、作答和回饋，需由使用者確認；API 金鑰與模型呼叫由工作臺另行處理，並可能產生費用。[v2.5 整合提交](https://github.com/LeoKYChen/probation-study-desk/commit/aa608654fa0a2e833e52724ef0ac34dae15225c0)

### 調整與修正

- **備考書桌手機版**：調整考科名稱、操作按鈕與練習捷徑的響應式版面。[相關提交](https://github.com/LeoKYChen/probation-study-desk/commit/0d07acf25ad29b9b4681b92497493bf8687cbdf4)
- **雙 AI 回饋保護**：避免重複回傳覆寫或重複附加回饋；處理 iPhone 上的題目交接與回傳問題。[重複回傳修正](https://github.com/LeoKYChen/probation-study-desk/commit/e0773b88b2e82bad48c24481f42a81f4e113c138)／[iPhone 修正](https://github.com/LeoKYChen/probation-study-desk/commit/eeebd4276c23cb2e1aaa3c7626c322823eb44f54)
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
