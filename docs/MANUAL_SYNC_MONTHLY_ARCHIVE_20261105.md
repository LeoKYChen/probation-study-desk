# 手動增量同步與月份封存 v1.0（2026-11-05）

**狀態：測試分支程式碼；正式 Apps Script 尚未安裝，正式網站尚未切換。**

## 確認的需求

1. 手動同步，停止每日模擬題及新聞的固定觸發器。
2. 已成功提交且來源檔案名稱、類型、修改時間未改變時，略過全文讀取與重新上傳。
3. 持續以不超過 1,000,000 UTF-8 bytes 的新聞 JSON 小檔儲存；新增資料不觸碰未變更的歷史 shard。
4. 按月份封存，但仍從同一主站開啟舊月份，無需每月新建子站。

## 第一階段：已寫入測試分支

- scripts/apps-script/ManualIncrementalNews.gs：manualSyncReadingNews() 每次最多處理三篇變動文件，掃描約 90 秒後結束並保留 GitHub 提交所需時間。
- Apps Script 的 FileIterator continuation token 儲存於 PSD_MANUAL_NEWS_CURSOR；下一次人工執行會續掃。不會安裝新觸發器。
- GitHub 現有 schemaVersion 2 新聞索引保持相容；讀取器回傳舊 shard 的內容與路徑。增量寫入時沿用未改變 shard 的雜湊路徑，只建立修改 shard、新增月份 shard 和主索引／離線入口。
- 沒有變動的批次不產生 GitHub commit；更新的單一 commit 原子提交新索引、必要的分檔和 file-data/daily.generated.js，並再次核對 GitHub HEAD。
- resetManualNewsScan() 只清除游標，不刪資料；disableAutomaticDailySyncTriggers() 僅在人工呼叫時移除名稱為 syncDailyResources 及 syncReadingNews 的觸發器，其他排程不受影響。
- verification/manual-news-sync.test.cjs：驗證游標接續、未變動內容直接略過、舊 shard 重用、GitHub 衝突拒寫。

**限制：同步時仍會讀取既有 GitHub 新聞 shard 來比對，這與重複上傳不同。下一階段月份索引會降低讀取量。**

### 尚未完成

目前 GitHub 未收錄原本 syncDailyResources 的 Apps Script 主程式，因此**每日模擬題本身的增量同步尚未改造**；不能用新聞函式取代題庫函式。取得正式 Apps Script 程式碼後，才可套用相同機制。

正式 Apps Script 專案未授權直接編輯，故無法在本次 GitHub 提交後宣稱已停用觸發器或已在正式站驗收。

## 正式安裝前的順序

1. 備份 Apps Script 現有 .gs 檔、指令碼屬性與觸發器清單。不要提供 GitHub token 給 AI。
2. 在測試專案／測試 GitHub 分支測試，確保資料夾只含允許公開的全文。
3. 審查並整份安裝更新版 ReadingNewsSync.gs；新增 ManualIncrementalNews.gs，保留 OfflineBridge.gs。
4. 手動執行 manualSyncReadingNews()；若 hasMore 為 true，重新點擊執行直到本批掃描結束。注意：GitHub commit 成功不代表 Cloudflare 已部署。
5. 核對 GitHub documents.json、變動 shard、file-data/daily.generated.js 與正式網站資料。執行既有離線回讀檢查。
6. 最後**人工執行一次** disableAutomaticDailySyncTriggers()，檢查 Apps Script 觸發器畫面已移除兩個每日同步觸發器。
7. 若 FileIterator continuation token 過期，執行 resetManualNewsScan()；已提交且未改的文件仍會略過。
8. 切換前完成 iOS Safari、桌面、離線 ZIP 測試；不可先停用所有排程。

## 第二階段：月份封存規格（尚未實作）

建議新索引 schemaVersion 3：

~~~json
{
  "schemaVersion": 3,
  "activeMonth": "2026-11",
  "months": [
    {"month": "2026-11", "status": "open", "count": 10, "index": "archives/2026-11/index.json"},
    {"month": "2026-10", "status": "archived", "count": 42, "index": "archives/2026-10/index.json"}
  ]
}
~~~

- 一次性遷移使用已驗證的 GitHub 新聞與題庫 JSON，不要求全部 Google Drive 原始文件重新解析、上傳。
- 舊月份預設只載入輕量索引，點擊文章後才載入全文 shard；跨月份搜尋先使用標題與摘要索引。
- 按月份及 1 MB 限額切成多個內容雜湊 shard；封存後仍可單篇修訂並新增版本。
- 原始新聞／題目 ID 不變；原本 ?document=文章ID 必須可找到歷史文章；新增 ?month=2026-09 只是方便切換。
- 書籤、已讀、作答紀錄、IndexedDB、備份還原都不得因封存而重置。
- 歷史資料在網路上可讀，不等於離線 ZIP 已包含；離線包預設包含近期資料，歷史月份另外選擇下載。
- 發布前必須同時更新新聞讀取器、離線產生器、Service Worker、Cloudflare 資料發布白名單與驗證測試。

## 容量與成功定義

- 按月封存可降低單次掃描、同步和首次載入成本，**不會降低 GitHub 已存在的總儲存量，也不會延長 Apps Script 約六分鐘的限制**。
- 成功標準必須分開：已提交 GitHub／已發布 Cloudflare／實際網站可讀／離線 ZIP 可讀。
- 未變動來源預期全文解析與上傳次數為零；修改單篇時，不變動其他 shard 的內容及路徑。
