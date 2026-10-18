# 每日模擬題｜Apps Script 匯入前品質閘門 QA 安裝與驗收（2026-10-18）

> **現況：品質檢查模組已在 GitHub 獨立分支建置，未接上正式的 Apps Script 同步。**  
> 於 GitHub `main` 未找到 `syncDailyResources` 的原始程式；已在 Google Drive 搜尋相同名稱亦未找到。因此此文件提供**可直接接入 Apps Script 的獨立模組、整合點及測試**，不是宣稱已改好線上自動同步或已完成正式部署。
>
> **維持既有要求：** 342 題預測題繼續暫停；每日 21:00 v3.0 提示詞的首次產題需待使用者通知，不先驗收；本次不更動正式版 `main`、Google Apps Script 部署、Drive 資料夾及真實作答紀錄。

## 1. 目標與資料來源

流程仍是 **每日新聞／申論 MD → Google Drive／Google Docs → 現有 Apps Script 解析 → GitHub `daily-simulation/questions.json` → v2.5 網站**。新程式插入在「解析完成」與「寫回 GitHub」之間，作為發布前**只讀驗證**。

- 原始 QA 基線：`main` `b07f531df991d5c2065c3ce6d6a3050fc4d7a38a`；現有正式題庫 132 題。
- 分支承接已完成的前兩批獨立修正：`fix/daily-question-metadata-20261018`。目前新的 `feat/daily-import-quality-gate-20261018` 分支並非正式版。
- 模組：`integrations/apps-script/daily-quality-gate.gs`（純 JavaScript，Google Apps Script V8 相容）。
- QA 測試：`verification/test-daily-quality-gate.cjs`（22 個合成案例，配合原有 132 題）。
- **無 GitHub/Drive 寫入 API、無刪題操作、無外部網路請求。**

## 2. 新題判定規則

| 審查面向 | 自動行為 | 界限 |
|---|---|---|
| 空陣列、損壞的舊題庫、重複 ID | 阻擋整批發布 | 避免空同步把舊題洗掉 |
| 固定科目名稱與日期輪替 | 不一致則阻擋 | 只檢驗每天**新生成題**；原有 132 題未清洗前不會被全面判退 |
| 題幹完整、編輯指令漏入 | 缺主要設問或殘留生成指令即阻擋 | 不能單靠字數認定實質題意完備 |
| 25 分及子題配分 | 沒有可辨識配分／加總錯誤則阻擋 | 複雜格式可能誤判，需檢視原因後再修正 |
| 核心爭點、答題架構及四欄表 | 缺欄位、缺標準欄名、基本內容不足即阻擋 | 不代表內容法律／學理判斷已正確 |
| 來源欄位 | 不可為空；聲稱改編官方試題卻沒有官方原卷檔案網址 → 暫緩待人工核對 | **即使有官方網址，也不代表系統已開啟原卷確認內容** |
| 題幹完全重複 | 阻擋新 ID | 既有 ID 不刪、不合併 |
| 題首高度重疊（前 120 個正規化文字） | 暫緩發布、列人工比對 | 同案例不同考點可能合法，不能直接判定重複 |
| 同一來源文件與題目位置（若來源有這兩個欄位） | 不同 ID 占用同一來源段落則阻擋 | 若 MD 有多道題，必須提供不同段落索引；不能只用文件 ID 就當成重複 |
| 既有題目 ID 同內容再匯入 | 視為冪等重跑，不另新增 | 只要任何欄位改變就暫緩、不能覆蓋舊版本與學習紀錄 |

### 品質與來源的誠實邊界

本模組**只有結構、類別、分數及內容相似性閘門**。現行題庫多數 `reviewStatus` 為「待核對」，這並不因通過閘門而自動變成國考品質合格。法條新舊、條號、官方原卷、理論及申論答案仍要查核來源。對可能只是「一份資料兩種版本」的近似題，先標人工確認，不做任何自動刪除。

## 3. 接入真正 Apps Script 時的順序（不得原樣取代現有同步函式）

先備份正式 Apps Script `syncDailyResources` 程式，複製 `daily-quality-gate.gs` 到**測試版 Apps Script 專案**，保持原本 Drive 搜尋、MD 解析、JSON 格式與 GitHub 驗證邏輯不變。只有取得現行程式後，才能把下列示意接入原有函式。

```js
// 示意：existingDataset 必須由 GitHub 讀取目前正式版的最新 JSON。
// parsedQuestions 必須是從新 MD 解析完成的完整題目陣列。
// 不能先刪除既有 questions，也不能先發 PUT 再檢查。
const report = DailyQuestionQualityGate.inspect(existingDataset, parsedQuestions);
if (!report.canPublish) {
  Logger.log(JSON.stringify({
    phase: 'quality-gate',
    blocked: report.blocked,
    manualReview: report.manualReview
  }));
  // 停止本次 GitHub PUT，舊 JSON/舊答案完全保留。
  return;
}

// report.proposedDataset 是全新物件，不修改 existingDataset。
// 發布之前仍須檢查 GitHub 最新 blob SHA／版本未被其他同步更新。
// 使用原有的 GitHub 寫入程式與可靠的失敗處理；不能跳過授權。
const candidateJson = JSON.stringify(report.proposedDataset, null, 2);
// existingSyncWrite(candidateJson, expectedExistingBlobSha); // 只有整合完成、測試通過才可接回
```

**關鍵安全要求：**
1. 遇到 `blocked` 或 `manualReview` 都暫停**整批發布**，而非發布半套題目。檢查失敗不能把 `questions` 改為空陣列。
2. 原題（現在 132 題）只檢查集合完整、ID 唯一；不因未來新增題目比較嚴格而自動下架。
3. 同 ID、全部欄位完全相同的再次匯入屬冪等，允許不新增。不同內容一律拒絕自動覆蓋，須走版本人工審查。
4. 比對 GitHub 內容須依**目前最新**的遠端 SHA 做樂觀鎖定；遠端狀態變更時應重新讀取、重新檢驗後再處理，避免同步競爭與意外覆蓋。
5. `sourceDocumentId`＋`sourceQuestionIndex` 是可選來源辨識欄位；**目前同步來源程式尚未找到**，不能假定現有解析器已輸出這兩個欄位。
6. 初次接入應只記錄 `blocked/manualReview` 不寫入，再以 3～7 天合成與實際產題資料驗證；確認不會對合法格式錯誤封鎖後，才允許套用在正式寫入流程。

## 4. 驗收邊界

- 使用 GitHub Actions 在測試分支執行原有 `verification/check-daily-v254.cjs` 等回歸，驗證既有資料與備份相容。
- `verification/test-daily-quality-gate.cjs` 針對 22 種輸入執行判定，**實測結果需以 GitHub Actions 為準**。
- 由於未取得正式 `syncDailyResources` 來源、未運行 GAS V8 實際 Google API 及遠端 GitHub PUT，**本次不能宣告「Apps Script 正式整合驗收完成」**。
- 目前沒有使用私人備份、個案資料、真實作答；沒有改動正式網站或其學習資料。

## 5. 下一步

取得現行 Apps Script `syncDailyResources` 及 MD 擷取／GitHub 發布相關函式，再對照既有欄位接入 QA 版、以合成 Google Docs 測試冪等及錯誤回復。通過後才提出正式版合併與上線建議；原有 342 題持續停用，第三階段每週學習建議仍照原計畫保留。
