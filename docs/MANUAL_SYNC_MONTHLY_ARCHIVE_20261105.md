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


## 第二階段實作進度（2026-11-05）

**已在測試分支加入，尚未切換資料格式：**

- daily-simulation/news-storage.js：支援既有 schemaVersion 1/2，以及新的 schemaVersion 3 月份總索引。切換月份時只讀取該月份的 index 與經 SHA-256 驗證的新聞 shards；會檢查原 ID、月份、筆數及目錄一致性。
- daily-simulation/news.js、index.html、app.js：新聞閱讀介面提供「選擇新聞封存月份」；既有 v2 資料也能使用月份篩選（v2 因為仍是舊資料架構，首次仍會讀完所有 shards）。已讀／收藏繼續依原始 ID 儲存，不改每日模擬題作答格式。
- 原有 ?document=<id> 深層連結在 v3 可以透過總索引定位月份，再讀取那個月的全文。
- scripts/build-monthly-news.cjs：從 GitHub 已驗證 JSON 規劃月份遷移；--plan 不寫檔；--stage DIR 只在儲存庫外建立**獨立預覽**，不覆蓋正式 documents.json。
- verification/news-storage.test.cjs 與 verification/monthly-news-migration.test.cjs：涵蓋新舊格式、月份按需讀取、篡改拒讀、分檔原文 SHA 檢查與原始 ID 不變。
- scripts/run-checks.cjs 已將規劃及單元測試納入 npm test。

**正式啟用前尚須：**更新手動同步器的 v3 月份索引讀寫、OfflineBridge、file-compat.js、ZIP 產生器、Service Worker 與 Cloudflare release gate；完成來源不變跳過／月份修改／離線讀取／手機與桌面整合測試。尚未把真實來源轉成 v3，這是避免損及已發布新聞的刻意隔離措施。

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

## 第三階段增量同步與封存相容性（測試分支，尚未部署）

2026-11-05 已新增以下程式及回歸測試：

- scripts/apps-script/ManualMonthlyNews.gs：當現有新聞索引已轉成 v3 時，手動更新只重建受影響的月份 shard 和月份索引。沒有變動的月份仍沿用 GitHub 已存在的雜湊 shard，不重傳全文。
- scripts/apps-script/ReadingNewsSync.gs：能核對 v3 的各月份索引與每個來源 shard 的 SHA-256、ID 和月份；阻止舊版 syncReadingNews 誤將 v3 降回 v2。
- scripts/apps-script/ManualIncrementalNews.gs：讀取來源失敗時直接停止，不前移續傳游標；單次掃描時間獨立計算，已提交的來源不重複解析。
- scripts/apps-script/OfflineBridge.gs 與 scripts/generate-file-data.cjs：可驗證／產生 v3 各月份索引、shard 的 file:// 版 JavaScript 鏡像。
- file-compat.js：可從離線 ZIP 載入安全的月份索引；ZIP 若未包含指定月份，明確回報，不會假裝載入成功。
- sw.js：標準 PWA 下載保留「當月」的索引及分檔；歷史封存於連線時按需讀取。標準快照**不保證**舊月份離線可讀；需要歷史離線資料者須另行下載離線包。
- scripts/build-cloudflare-main-mirror.py：在建立 Cloudflare 鏡像前嚴格核對 v2/v3 shard SHA-256、新聞 ID、各月份筆數、索引檔案存在性。
- scripts/daily-data-release-gate.py：首次 v2→v3 轉換不得無人審核自動發布；經人工發布且正式站已具備月份索引之後，安全的單純月份資料更新才可能自動發布，仍由發布門檻與完整性檢查共同保護。
- verification/manual-monthly-news.test.cjs、verification/news-bridge.test.cjs、verification/news-apps-script.test.cjs：包含未變動月份不重傳、跨月修訂、雜湊核驗、離線索引修復及並行寫入拒絕覆寫。

### 切換正式站前的關鍵保留事項

- 不要只把 v3 documents.json 上傳到正式 main；必須在**同一個經審查的發布版本**包含所有月份索引、全部引用的新聞 shard、新版 reader、ZIP 橋接與 PWA。
- `syncDailyResources` 的正式 Apps Script 原始碼仍未取得，因此**每日模擬題同步器尚未改造**；不能聲稱整體每日題庫已採手動增量。
- 未修改正式 Google Apps Script 指令碼專案，也沒有停用正式時間觸發器。須在完整測試及備份完成後，才手動執行停用入口。
- 尚未合併 PR #126，亦未在正式站啟用 v3。既有 239 篇已發布新聞仍由現行 v2 索引提供服務。
- 分檔與封存改善**單次處理、瀏覽器下載及更新成本**，並不移除 GitHub 歷史儲存量或 Apps Script 的執行時間限制。

## 第四階段：不變資料的快速檢查與真實瀏覽器驗收

- 手動增量新聞同步對 **v3 月份索引** 新增輕量快取路徑：先讀 GitHub 的主索引及 catalog（包含來源的 modified、mime），比對 Google Drive 的檔案名稱、類型和修改時間。**沒有變動時，不下載任何既有新聞 shard，也不重新讀取 Drive 全文，更不提交 GitHub。**
- 若來源真正變動，現階段為確保安全，仍會回讀完整既有新聞 shard 並核對 SHA-256 後產生變動月份的新版 shard；所以此階段的「不重做」特別保證**無變動批次**與**未改動分檔不重新提交**，不宣稱有變動時也永遠不用驗證舊資料。
- 舊版 v1/v2，或缺少完整 modified/mime 的 v3，會自動退回原有完整核驗，不會用不完整 metadata 判斷已成功。
- 來源讀取失敗的檔案不會自動當作成功；遇到錯誤會停止本輪並保留續傳位置，不變動既有 GitHub 內容。
- CI 新增 verification/monthly-news-browser.cjs，使用**真實已發布的 239 篇**建立記憶體中的 v3 月份資料覆蓋層，不改正式 documents.json；分別在 Chromium／WebKit 驗證當月載入、9 月與 10 月切換、完整文章、收藏、已讀與原文章 ID 深層連結。
- 讀者切換月份時保留所在閱讀分頁，避免強制回到新聞首頁。
- 如 v3 轉換需要指定月份離線閱讀，必須先確定對應月份的 ZIP 子索引 JS 和 shard JS 都已包含在 ZIP，不能僅靠主索引宣稱離線可讀。

**尚未完成正式 cutover。** GitHub PR #126 保持草稿；目前實際正式資料仍為 v2，正式 Apps Script 原版 syncDailyResources 仍待取得，無法宣稱每日模擬題已完成手動增量。
