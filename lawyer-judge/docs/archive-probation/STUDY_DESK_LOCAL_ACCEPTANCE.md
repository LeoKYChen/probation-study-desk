# 備考書桌本機版：2026-10-22開發驗收

基準：5533577d90ad10f9ff58bf805b6e9e9cbbbd075b。跨裝置同步暫緩；本次未建立帳號服務、提交、PR或正式部署。

## 本輪已完成

- 函授堂次與題目主題由本人確認對應；完成觀看後才依對應納入已學範圍。
- 回到書桌重新讀取進度，退回未完課／刪除堂次不再沿用；原始函授紀錄唯讀。
- 書桌JSON保存函授快照、主題對應、科目與複習設定；備份快照標示來源與時間。
- 設定時間預算、搭配複習數、三種回想間隔；不更改既有到期日。
- 選題說明考科、已學候選、未知範圍排除及選題理由；納入本人弱點標記與實際練習間隔。
- 原主題庫374題及相關考試52題，沿用原題ID及題源標示，未重新逐題查證內容。
- 舊專業科目申論、v2.5答案／草稿及每日模擬的已知欄位可轉成接續筆記；保留快照、評語、原日期與轉換回條，不推定流程完成。

## 執行結果

- 24項Node測試通過（含保留的雲端資料庫契約測試；該服務目前未啟用）。
- Chromium實際操作通過：作答、評語、訂正、離線重開、JSON移轉、函授映射與完成度變動、時間與複習設定、舊筆記轉換、重匯去重、426題入口、手機寬度、無外部請求。
- 原有備份、函授核心、網站整合檢查通過；題目ID及原始儲存鍵檢查通過。
- JavaScript語法、Git差異空白檢查通過。

主要命令：

```bash
PSD_SYNC_TEST_MODULES=/tmp/psd-sync-validation/node_modules node --test verification/sync/core.test.mjs verification/sync/planning.test.mjs verification/sync/sql.test.mjs
BROWSER_EXECUTABLE=/tmp/psd-browser/chromium node verification/sync/local-browser.cjs
node backup/test.cjs
node lectures/test.cjs
node verification/unified-integration.cjs .
git diff --check
```

## 分軸自行審查

程式標準軸：檢查新規則模組、UI接線、不可變原稿、輸入驗證、交易回復、唯讀舊資料與備份相容性，目前此開發切片無已知阻擋問題。沒有獨立代理或人工第二位審查者。

需求軸：本輪功能已覆蓋上述驗收；仍未將書桌修改寫回全部舊頁面，無法辨識的舊欄位僅保存快照，題目主題對應為本人確認而非自動分類。這些界線已在頁面與開發說明標示。正式站入口、實體裝置、WebKit、發布與更新快取驗收尚未完成；不能以本機Chromium測試宣稱已正式上線。
