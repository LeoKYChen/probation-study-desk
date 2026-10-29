# IndexedDB 儲存核心（開發中，尚未接入）

這是安全遷移的初步元件，不改變任何頁面的讀寫。使用獨立資料庫，不更動既有備考書桌資料庫。提供原值複製、逐項回讀、單交易回滾、遷移標記、舊值變動偵測與單筆／多筆 compare-and-set；不刪除或更新 localStorage 原始資料。

尚未完成：各學習模組、備考書桌、完整 JSON 和 Google Drive 同步整合；容量不足、舊版備份及跨裝置實測；離線載入與 PWA 更新；原有題庫 ID 驗證。舊頁面若仍可在遷移後寫 localStorage，可能造成分流；接入前必須處理跨版本及跨分頁協調，並在交易提交後比對來源，不能將此核心視為完整遷移方案。瀏覽器儲存遭清除或被系統回收時不保證持久，須另行備份。

此程式不得作為正式上線依據；須完成整合及驗收後另行審查。`indexeddb.test.cjs` 使用 fake-indexeddb；`browser.test.cjs` 在 Chromium 和 WebKit 測試核心，並非整站或真實 Drive 驗收。

`backup-bridge.js` 能以原有備份格式讀取 IndexedDB 並利用原合併規則保留衝突，再於同一交易驗證基準與套用變更。它尚未接入備份畫面、書桌資料庫或 Google Drive，不等於完整備份。

`drive-sync.js` 是使用現有 Drive 快照格式的非同步介面，合成測試涵蓋雙裝置資料往返和分歧保留；尚未接入 OAuth、同步畫面或既有書桌資料庫，亦未連線真實 Google Drive。
