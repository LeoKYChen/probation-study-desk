# P0／P1｜本機學習紀錄保存範圍與還原驗收（核定施工，未合併）

- 追蹤：#91；基準 main `a89f58cfe6271a642c29f5dfce7e4ea6fc32d9d7`，正式 Release `v2026.10.0`（`b924bd6e2ef12c18275e4fbf446e5ca1f7f643d1`）。
- 保護原則：使用**合成資料**測試；不能接觸、匯入或公開使用者私人 JSON；不更改題目 ID、不覆寫原答案。
- 程式碼核對：`backup/unified-core.js`、`backup/app.js`、`study-desk/app.js`、`cloud-sync/core.js`、`cloud-sync/idb.js`、`verification/sync/local-browser.cjs`、`backup/test.cjs`。

## P0 資料保存範圍矩陣

| 模組 | 本機保存 | 備份入口及格式 | 已確認限制／待驗收 |
|---|---|---|---|
| 備考書桌 `study-desk/` | IndexedDB：`psd-study-desk-sync-v1` / `accounts`；`guest` namespace | 書桌「匯出書桌 JSON」(`psd-study-desk-v1`、schemaVersion 1) | **不納入**既有 `backup/` 統一 localStorage 檔案；新環境需從書桌獨立匯入；跨分頁衝突、實機 Safari 待完整驗收 |
| 專業科目每日30分鐘 | localStorage：`probation-study30-v251:v1` | `backup/` 完整 JSON（`psd-unified-learning-backup`） | 舊題 ID 不可改，sessionStorage 計時狀態不保證納入 |
| v2.5／歷史考古題 | localStorage：`probation-study-desk-v3`、`probation-study-desk-v2`、`probation-study-desk-v24` | `backup/` 完整 JSON | 與書桌不會自動雙向同步；請手動預覽匯入 |
| 每日模擬題 | localStorage：`probation-daily-github:records:v1` 與收藏鍵 | `backup/` 完整 JSON | 正在編輯但未儲存內容／sessionStorage 不保證收錄 |
| 國文、英文及舊英文 | localStorage：`psd-common-subjects-v1`、`psd-staresto-link-coach-v06`、`psd-staresto-daily-v04` | `backup/` 完整 JSON | 個別存檔結構須保持原規格；Staresto 新整合仍凍結 |
| 函授管理 | localStorage：`psd-lecture-planner-v1` | `backup/` 完整 JSON；書桌會另存唯讀進度快照 | 快照不是跨網站即時同步；現場網頁是否有變動須重新檢查 |
| AI 提示詞、首頁倒數、週報收藏／已讀／字級 | 多個 localStorage 鍵，參照 `backup/unified-core.js` modules 常數 | `backup/` 完整 JSON | 同一網域同一瀏覽器內才可讀取，與書桌 IndexedDB 不同 |

**關鍵結論**：`backup/` 的名稱雖然叫「完整學習紀錄」，但其 `collect(storage, origin)` 僅採用 localStorage 的已列管鍵。書桌有獨立 IndexedDB 與獨立 JSON。下載**兩份**並確認非空，才算本次備份兩個範圍；跨 GitHub Pages／Cloudflare 網域需各自處理。

## P1 合成資料驗收項目

| 用例 | 驗收方法 | 狀態 |
|---|---|---|
| 原完整備份匯出→新空間還原 | `node backup/test.cjs`（既有測試）及 `node --test verification/sync/backup-boundary.test.mjs`（新增） | 待 PR CI 執行 |
| 本機書桌保存→匯出格式驗證→新空間匯入 | `MemoryStore` + `LocalRecords` 合成答案；真實 IDB／下載另用瀏覽器測試 | 待 PR CI 執行 |
| 相同資料重複匯入 | 不產生新衝突版本 | 待 PR CI 執行 |
| 不同答案版本衝突 | 保留原答案並將差異寫入 import/archive 版本 | 待 PR CI 執行 |
| 非法格式及原型污染 | `validateState`、`backup.validate` 拒收 | 待 PR CI 執行 |
| 不同來源資料不混同 | localStorage JSON 不含 IndexedDB，另一瀏覽器／網域不會自動同步 | 原始碼已確認；實體裝置待驗收 |
| iPhone Safari 與實際下載檔案 | 本人確認保存路徑、非空檔及新環境還原 | **待使用者實測**，不可冒稱通過 |

## 一般使用者目前應如何備份

1. 在**目前實際使用的網域**打開 `/study-desk/`，確認已顯示最新作答，於「進度與資料保存」下載「匯出書桌 JSON」；檢查檔案不為空、日期正確。
2. 回到 `/backup/` 下載既有模組「完整學習紀錄 JSON」；確認來源網域、所含模組與檔案大小。
3. 若平日也使用其他網域（GitHub Pages／Cloudflare），分別進入相同功能檢查。**不同網域間的資料不會自動同步**。
4. 不得上傳私人 JSON 到 GitHub Issue／PR，也不要用正式個人紀錄做公開 CI 測試。
5. 還原前先各自備份現有裝置；使用各模組相應的匯入介面，先預覽，遇衝突保留原稿。

## 權限與尚缺證據

本工作包只針對 P0／P1，**不**啟用雲端登入、Gist、Firebase、Supabase 或外部 API；不創建新資料來源。歷史 2026-10-24 iPhone 五項回報**不代表**本次備份還原、Safari 全功能、Cloudflare 版本一致、離線 ZIP 均驗收。當前沒有可驗證的使用者私人備份成功證據，需實際人工確認；本文件不得作為正式發布或 PR 合併核准。
