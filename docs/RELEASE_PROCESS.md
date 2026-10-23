# 全站 GitHub Release 維護指引

本文件定義「程式變更」「網站部署」「正式發布」之間的界線，以及觀護人學習平臺建議採行的人工驗收流程。**建立或合併本文件本身不會自動產生 Tag、Release、部署或資料備份。**

## 1. 概念與版本

| 名稱 | 用途 | 重要界線 |
| --- | --- | --- |
| Commit | 單次原始碼修改及可追溯的紀錄 | 不等於功能完成、也不等於網站上線 |
| Pull Request | 審核一組修改，確認差異及測試 | 合併後可能觸發部署，取決於工作流程 |
| Tag | 鎖定特定 Git commit 的版本名稱 | 不含使用者瀏覽器中的私人學習紀錄 |
| GitHub Release | 以既定 Tag 為基礎發布版本說明，可附加檔案 | 不會自行觸發網站部署，除非 CI 有特別設定 |
| GitHub Pages／Cloudflare | 對外提供線上靜態網站 | 網站上的程式可能先於、晚於或不同於某個 Release |

建議**全站**改採日期式版本號 `vYYYY.MM.N`（例如 `v2026.10.0`），同月依正式發布次序遞增 `N`。這是**規範提議，不是目前已建立的版本**。舊版 `v2.5`、`v2.5.4` 繼續視為子模組名稱；不批次重新命名路徑或刪除舊模組。

首次正式發布前，務必至 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases) 與 [Tags](https://github.com/LeoKYChen/probation-study-desk/tags) 檢查現存名稱、所指 SHA 及發布紀錄；名稱衝突時改用下一個可用版本，不得覆蓋既有正式 Tag。

## 2. 建議的發布門檻

針對即將發布的**特定 commit**完成下列事項；不清楚的項目應明確標示「未驗證」，不能視為通過：

- [ ] 功能範圍已凍結，重要 PR 已合併至 `main`，並記錄最終 commit SHA。
- [ ] 該 SHA 的 GitHub Actions 所需檢查成功；有例外者列明原因，不能只依早先某次綠燈判斷。
- [ ] 首頁、專業科目、共同科目、函授管理、備考書桌、每日練習、少年司法週報等受影響入口可正常使用。
- [ ] 手機及桌面端的主要流程已測試；Chromium、Safari／iPhone、Firefox 等**僅以實際驗收過的項目**記載通過情況。
- [ ] 既有題目 ID、作答紀錄、歷史備份與匯入相容性未受到破壞；先以**非真實個案資料**完成備份／還原測試。
- [ ] 若變更題庫、法條、考古題年度或答案，已另外完成題源、法源時點及必要的人工內容查核；若未完成，不得宣稱逐題驗收。
- [ ] 檢查外部 AI 服務須自備 API 金鑰、可能收費，且跨站傳輸需使用者同意；不應將機密資料納入測試及發布附件。
- [ ] 確認本次 Release 的部署位置、部署狀態及是否需刷新 PWA／離線快照。
- [ ] `README.md` 的功能狀態與 `CHANGELOG.md` 已依核實結果更新。
- [ ] 確認現有 Tag／Release 名稱不衝突，並撰寫具體發布摘要與已知限制。

可視變動範圍執行的本機測試範例（不保證涵蓋全站所有功能）：

~~~bash
npm install
npm run check
npm run build
node backup/test.cjs
node print/test.cjs
node lectures/test.cjs
node verification/unified-integration.cjs .
npm --prefix verification/sync test
npm --prefix verification/sync run test:browser
~~~

注意：`npm run build` 主要處理 React／Vite 部分，**不會單獨產出整站所有靜態模組**。測試清單須依實際影響範圍及 CI 的最新設計增減；不應為了建立 Release 而忽略失敗。

## 3. 正式發布操作（人工）

1. 先合併功能與文件 PR；確認 `main` 最新 commit 與需保留的歷史作答格式。
2. 開啟儲存庫 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases)，選 **Draft a new release**。
3. 選擇既有 Tag，或建立一個**未使用過**的新 Tag，目標分支指定 `main`，並再確認所指 commit SHA。
4. 標題例如「觀護人學習平臺 v2026.10.0」，**僅在真正決定與通過驗收後**使用。發布說明取自 `CHANGELOG.md` 已核實的內容，補充「新增／修正／已知限制／測試範圍／部署網址」。
5. 如果需要可下載的網站封裝檔，先另外確認含所有靜態模組、生成資料和相對路徑，再附為 Release asset；不要把 GitHub 自動提供的原始碼 ZIP 誤稱為已驗證的離線安裝包。
6. 核對是否標記為 latest，並於實際確認發布前避免誤設 pre-release／正式版本；最後才按 **Publish release**。
7. 發布後，逐項檢查 Release 的 Tag SHA、附件、說明文字，以及實際網站是否已部署到預期版本。把 Release 連結補回 README 或版本紀錄。

**本指引不會設定「發布 Release 即自動部署」的工作流程。** 若要連動部署，須另行審查 `.github/workflows/`、部署權限及原有分支保護規則，避免覆蓋已正常運行的 GitHub Pages／Cloudflare 流程。

## 4. 失敗處理與回復原則

- Release 指向的 Git commit 是回溯錨點；**下載舊原始碼 ≠ 自動還原線上網站**。必要時由既有部署管線對選定的已驗證提交重新部署。
- 更換程式版本不應清除瀏覽器 `localStorage`、`IndexedDB`、PWA 快取以外的私人紀錄。任何資料格式遷移都應先提供匯出、相容性測試及回復方案。
- Tag 已對外發布後，原則上不覆寫或強制移動；若需要修正，另建立修正版與新 Tag，清楚寫明差異。
- GitHub Release 的原始碼與附件**不是**個人的學習紀錄備份。使用者仍須透過本站 JSON 匯出另行保存。

## 5. 發布說明模板

~~~markdown
# 觀護人學習平臺 vYYYY.MM.N

發布日期：YYYY-MM-DD
程式版本：<main 的完整 commit SHA>
網站入口：https://leokychen.github.io/probation-study-desk/

## 本版新增
- （僅記載已核實功能）

## 修正與調整
- （對應 PR、Commit）

## 已知限制
- （未完成／未驗證事項）

## 驗收與部署
- GitHub Actions：（連結與結果）
- 手機／桌面測試：（實際範圍）
- GitHub Pages／Cloudflare：（實際完成狀態）

## 資料與使用注意
- 個人作答仍由瀏覽器保存，請先匯出 JSON 備份
- 外部 AI 的金鑰、費用與資料傳送由使用者自行管理
~~~

相關說明：[README](../README.md) · [CHANGELOG](../CHANGELOG.md) · [歷史 README 快照](README_ARCHIVE_2026-10-22.md)
