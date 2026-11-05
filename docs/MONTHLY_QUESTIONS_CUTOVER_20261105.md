# 每日模擬題｜月份分檔、手動增量與切換驗收（2026-11-05）

**狀態：PR #126 測試分支；未合併 main、未切換正式 Cloudflare、未安裝正式 Apps Script、未停用任何排程。**

## 1. 依賴盤點（已完成）

| 來源／功能 | 目前讀取方式 | 相容性處理 |
|---|---|---|
| 原題庫 \`daily-simulation/questions.json\` | schemaVersion 1、245 題 | 保留作為**凍結的舊版回復快照**，不再由新的月份手動同步更新 |
| 新題庫 \`questions-monthly.json\` | schemaVersion 2、月份/分檔/245 題目目錄 | 月份分檔成為新版網站權威來源；缺少主索引時才退回舊版 |
| 晚間學習室 \`app.js\` / \`model.js\` | 載入完整題庫供搜尋、作答、複習、收藏 | 新讀取器驗證全部 shards，再輸出既有 schemaVersion 1 模型；資料鍵/ID 不改 |
| 每日模擬題本機紀錄 | \`probation-daily-github:records:v1\` / \`daily-reading-test:saved\` | 持續以**原題目 ID**為鍵；不執行遷移與刪除 |
| Cache Storage | \`psd-daily-dataset-v1\`、舊快取 URL | 舊成功快取作為網路故障退路，不更改作答資料 |
| 列印 / PDF \`print/app.js\` | 原本直接讀 \`questions.json\` | 改由 \`QuestionStorage.load\` 讀取完整月份題庫；失敗時保留舊快取退路 |
| ZIP 檔案 \`file-compat.js\` | 原本用 \`file-data/daily.generated.js\` | 加入月份主索引與 SHA-256 shard JS 延遲註冊；缺少分檔時明確報錯 |
| PWA \`sw.js\` / \`offline-manifest.json\` | 封存快照下載 | 自動追蹤月份索引全部 shard、驗證 SHA256，再原子寫入新快照 |
| Cloudflare 靜態鏡像 | \`scripts/build-cloudflare-main-mirror.py\` | 發布前核對全部 shard 雜湊、月份、ID、題數，且不得丟失或變更舊題身份 |
| Apps Script 題庫同步 | 原 v3.4.2 解析器 + 手動增量新模組 | 保留原解析及人工訂正保護；來源快檢、逐批讀取、原子寫入變動 shard |

## 2. 實際分檔結果（已完成）

以正式原始 JSON 中已驗證的 **245 題**產生以下分檔，檔名以原始 UTF-8 本文 SHA-256 命名，不憑估計的字元數判斷檔案大小：

| 月份 | 題數 | 分檔 | 單檔實際大小 |
|---|---:|---:|---|
| 2026-11 | 20 | 1 | 228,352 bytes |
| 2026-10 | 219 | 3 | 891,685、897,050、187,539 bytes |
| 2026-09 | 6 | 1 | 49,754 bytes |

所有 5 檔皆不超過 **900,000 UTF-8 bytes**；保留 245 個原 ID、原題幹、日期、科目、題目物件、模板及來源診斷。

新索引：\`daily-simulation/questions-monthly.json\`；內容定址 shard：\`daily-simulation/question-shards/<sha256>.json\`。

\`scripts/build-monthly-questions.cjs\` 提供 \`--plan\`、\`--check\`、\`--stage <新的絕對路徑>\`、\`--write\`。**正式操作不得跳過 --check 與備份。**

## 3. 閱讀與歷史搜尋（程式完成、持續驗收）

- 新聞月份選擇與**每日模擬題月份選擇是兩個獨立篩選器**，切換分頁不會把新聞的月份當成考題月份。
- 預設「全部月份（跨月搜尋）」；選 2026-09 時顯示當月六題，選 2026-10 顯示 219 題，選 2026-11 顯示 20 題。
- 為保留既有「全題庫搜尋／已有作答／收藏／待複習」行為，**目前網頁首次仍會載入全部五個 shard**，再在本機以月份篩選；這不是按月份延遲載入最佳化，不能誤稱為首次只下載當月。
- \`QuestionStorage.load\` 驗證 SHA-256、manifest、日期、catalog、ID 唯一性後才回傳完整 v1 題庫；不會因其中一檔錯誤，靜默只顯示部分資料。
- 個別題目及作答仍用原 ID，不強迫改成 \`2026-09-...\` 形式。

## 4. 離線與備份（已加入整合程式與測試）

- 每個 JSON shard 都有對應的 \`file-data/question-shards/<sha256>.js\`，新月份主索引對應 \`file-data/questions-monthly.generated.js\`；原 \`daily.generated.js\` 保留舊資料做相容回退。
- \`scripts/generate-file-data.cjs --check\` 會逐檔核對原始 shard、SHA-256、ID/月份，以及 ZIP JS 是否與 JSON 一致；\`--write\` 可重建。
- \`repairMonthlyQuestionOfflineBridge()\` 是 GAS 的**人工例外修復入口**，核對月份資料後只修復缺漏/過時的 ZIP JS，不重寫題目及作答。
- 原有 JSON 作答備份、匯入、列印來源均沿用原題號；**不合併、不覆蓋他人的紀錄**。本機作答依舊可能因跨網址或清除瀏覽器資料而遺失，請使用原本備份功能。
- PWA 下載完整月份 shard，目前屬於完整離線包，並非「只下載當月」；此策略避免歷史作答在斷線時缺乏題幹。

## 5. 手動同步流程（僅供隔離測試，正式 Apps Script 未安裝）

需以使用者提供的 v3.4.2 原本解析器為基礎：

1. 備份目前 Apps Script 各 \`.gs\`、指令碼屬性、觸發器清單；不要分享 GitHub token。
2. **以** \`scripts/apps-script/DailyResourcesSelective.gs\` **取代**原每日題庫解析器，不能同時放兩份 \`mdCollect_\`、\`syncDailyResources\` 同名函式；原本依賴 \`readDailyTabs_\`、\`dailySection_\` 等 helper 仍要保留。
3. 同一隔離 GAS 專案新增 \`ManualDailyQuestions.gs\`、\`ManualMonthlyQuestions.gs\`，並保留 \`OfflineBridge.gs\`。正式 \`psdBridgeConfig_('daily')\` 限定 \`main\`，**不應直接拿正式 token 在測試分支試跑**；需先審查隔離設定。
4. \`previewManualDailyQuestions()\` 只讀預覽，不更改游標/資料；檢查新增題號、來源筆數、待人工訂正的題目。
5. \`manualSyncDailyQuestions()\` 每次最多處理 3 份有變動的來源（Google Docs 或 Markdown）；以來源修改時間 + 類型 + 檔名雜湊作快檢。首次因缺乏既有逐來源 checkpoint，仍須逐批建立成功紀錄；其後未修改來源不重新解析。
6. 新增題目只建立新分檔；舊 shard 原雜湊完整重用；修訂一題僅重建包含該題的 shard。GitHub source-state、變動 JSON shard/JS、月份主索引/JS 在**同一提交**原子更新；失敗不前移游標。
7. \`resetManualQuestionScan()\` 只重設掃描游標。**不得使用舊版 \`syncDailyResources()\` 全量覆蓋已切換的月份題庫。**
8. GitHub 提交成功、Cloudflare 部署成功、正式站/ZIP 可讀是不同的驗收節點，不能混為一談。

## 6. 發布與安全停用排程（尚未執行）

- **首次從 v1 切到 v2 必須人工審查/發布**；\`scripts/daily-data-release-gate.py\` 會拒絕第一次未審查的資料自動切換。
- 真正網站端、列印、ZIP、PWA、手機 Chromium/WebKit、題目數、原作答紀錄與備份復原均需驗收後才能合併 PR、安排 Cloudflare 部署。
- 正式 GAS 測試通過且備份完成後，才執行手動停用原本 \`syncDailyResources\`、\`syncReadingNews\` 的特定觸發器；不得把 ChatGPT 21:00 摘要排程混同為 GAS 排程。
- 正式 GitHub main、正式 Cloudflare 與正式 Apps Script 在此 PR 草稿期間**維持原狀**。

## 7. 驗收對照

- \`verification/monthly-questions.test.cjs\`：245 題新舊逐筆相同、SHA-256、分檔上限、完整目錄、備份與 ID 不變。
- \`verification/manual-monthly-questions.test.cjs\`：只更新有變動 shard、保留其他 4/5 shard、來源成功紀錄原子提交、舊題/人工訂正不覆蓋、併發/篡改拒絕。
- \`verification/monthly-question-offline.test.cjs\`：從真實 ZIP JS 用 \`file://\` 模擬載入五個分檔、僅載入九月、遺漏分檔拒讀。
- \`verification/monthly-news-browser.cjs\`：對真正資料做手機 Chromium、WebKit 及兩種路徑操作驗收，包含月份選擇、原題幹、已作答保留和跨月切換。
- \`verification/daily-data-release-gate-test.py\`：首次手動 cutover 限制、日後變動 shard / manifest 成對提交，禁止錯誤 SHA、無聲覆蓋舊 JSON。
- \`scripts/build-cloudflare-main-mirror.py\`：發版前強制驗證題庫各分檔內容與舊題的同一性。

**設計取捨：** 既有 \`questions.json\` 作為不可變回復基準暫存於 repo，並不因「已分檔」而立即刪掉；這會暫時增加 GitHub 總儲存量，但降低切換期間的資料損失風險。等正式驗收、備份和回復演練完成，才評估是否移出舊快照。
