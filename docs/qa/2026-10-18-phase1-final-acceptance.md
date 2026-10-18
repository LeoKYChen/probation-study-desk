# 第一階段｜觀護人學習臺穩定性與資料安全最終驗收

- 日期：2026-10-18（臺灣）
- 正式版基線：`main` `57055ee27e8698245fb39fc9b2a3212c15203af1`。
- 狀態：**第一階段穩定性與資料安全驗收正式結案：範圍內核心項目全部通過。**
- 驗收邊界：資料儲存安全、JSON 搬移、離線／PWA、PDF 與版本升級回復。題庫內容法律正確性、正式國考評分與完整隱私稽核不包含於本階段。

## 一、已完成的人工作業（使用者 iPhone 實機回報）
| 類別 | 實機回報與範圍 | 判定 |
|---|---|---|
| JSON 匯出 | Safari 完成檔案下載、檔案 App 找到非空 JSON | 通過 |
| JSON 匯入 | 隔離測試站，合成資料新增 1 筆、衝突 1 筆，按確認匯入，備份頁重新讀取 2 筆 | **基本持久化通過**；未逐欄核對全文及衝突檔下載 |
| Safari 一般瀏覽離線 | 184 資源下載，真機斷網開啟、作文輸入、重新整理保留 | 通過 |
| iPhone 主畫面 PWA | 主畫面安裝、離線啟動、假作文關閉重開仍保留 | 通過 |
| iPhone Safari PDF | 兩篇假作文 A4 預覽、iPhone PDF 儲存、開啟閱讀、原記錄保留 | 通過 |

證據均為使用者於對話中明確回報，非遠端登入其手機。未收取或上傳實際私人答案。

個別紀錄：
- [JSON 真機驗收紀錄](./2026-10-18-iphone-safari-json-backup.md)
- [離線與 PWA 真機及自動化驗收](./2026-10-18-offline-pwa-isolated-acceptance.md)
- [PDF 真機及自動化驗收](./2026-10-18-pdf-print-isolated-acceptance.md)

## 二、最終整合自動化驗收
- 獨立 QA 分支：`test/phase1-final-acceptance-20261018`。
- [Actions #39100081569](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39100081569)：**success（所有步驟通過）**。
- 僅新增 `.github/workflows/phase1-final-safety-acceptance-20261018.yml` 測試流程，所有來源程式與題庫均與正式版基線相同。
- 已通過：發版防錯目標／來源／並行保護（假的 Cloudflare transport）、426 題等資料完整性、JSON 合併與失敗回復、列印唯讀、離線 184 項資源、Chromium 和 WebKit 的升級、舊版回復、作答保存、離線開啟與 A4 列印。
- 嚴格限制：本流程沒有任何正式部署步驟、不呼叫真實 Cloudflare 回復 API、不操作真實使用者 localStorage。

## 三、最終結案門檻
1. `main` SHA 沒有改變，正式 Cloudflare／GitHub Pages 沒有因測試而被重新部署。
2. 最終整合 GitHub Actions 全部成功，若失敗須提出確切錯誤與重測依據。
3. JSON 匯入失敗、版本回退與更新操作都不能消除已有作答；核心唯讀、衝突與回滾測試必須通過。
4. 離線、Safari、PWA 與 PDF 的基本實機使用結果已具備測試紀錄且範圍如實揭露。
5. 未測之故障情境列為保留風險，不可宣稱全面測過。

## 四、原先保留風險及未涵蓋範圍（最終補測結果見第七節）
- **原訂保留項目已補測通過**：離線資源更新下載中途 HTTP 503 失敗後，前一份完整快取仍可使用，失敗暫存已清除；詳第七節。
- 未進行真正的 Cloudflare production 發版與線上 rollback 演練；只做假傳輸與舊／新版 UI 切換模擬。直接在正式版執行故障演練可能造成營運風險，不列為必做。
- 未涵蓋使用者實際學習資料逐欄無遺漏核對、Safari 清除網站資料、跨原生 Safari 與 PWA localStorage 自動同步、裝置丟失後復原。
- PDF 尚未驗收長篇 30 題批次及不同 iOS 裝置的完整列印結果。
- 所有測試只使用合成資料，正式答案請持續定期 JSON 下載備份。

## 五、補測前結案規劃（已由第七節結果取代）
- 若整合測試完成且無失敗：可將上述已驗證模組標記**第一階段核心功能驗收通過**；整體專案是否正式結案，依是否要求補跑「離線更新中斷故障注入」而定。
- 不因測試通過就合併 QA 工作流程或將測試假資料部署正式站。
- 使用者不需再上傳任何私人資料，也不需清除 iPhone Safari／PWA 資料。

## 六、最終整合回歸執行結果（已確認成功）

2026-10-18 GitHub Actions [#39100081569](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39100081569) 的 `phase1-final-regression` 工作及所有步驟均為 `success`。再次核對 `main` 仍是 `57055ee27e8698245fb39fc9b2a3212c15203af1`。

| 驗收項目 | 結果 | 證據摘要 |
|---|---|---|
| 正式程式碼來源與測試發布包一致 | 通過 | 僅新增隔離 QA workflow；來源、備份、離線與列印檔案原文比對 |
| 發版防錯與回復權限控制 | 通過（模擬） | Fake Cloudflare 傳輸，拒絕錯誤專案、分支及回復對象，不觸及真實 production |
| 題庫與資料欄位穩定 | 通過 | 426 題唯一題號、舊版來源紀錄與五個首頁入口保留 |
| JSON 安全合併與失敗回復 | 通過 | 不寫入匯出、格式驗證、衝突保留、重複匯入、過期預覽防護、匯入失敗回滾；Chromium 真實檔案下載、匯入重載 |
| A4 PDF／列印 | 通過 | 四類紀錄、原始作答唯讀、Chromium PDF、WebKit 預覽，以及 iPhone PDF 真機回報 |
| 舊版、新版與回復舊版 | 通過（模擬） | Chromium 與 WebKit 的升級→本機回復→再次升級，保留歷史作答及 AI 評語 |
| 多裝置路徑與頁面功能 | 通過 | Chromium/WebKit、根路徑與 GitHub Pages 子路徑、專業作答、計時、草稿、舊資料鍵 |
| 離線 184 個資源與基本答案保存 | 通過 | Chromium 真實斷網、WebKit 回應 503 模擬來源失效；iPhone Safari 與 PWA 真機回報 |

### 最終判定
**第一階段已驗證的核心安全功能：通過。** JSON 基本備份／還原、Safari／PWA 離線、PDF 列印與模擬升級回復可記為完成。

**補測前曾保留一項待驗問題。** Service Worker 離線資源更新中途失敗的安全性，現已依第七節追加獨立故障注入，最新結果為通過。

本報告不代表授權改版、合併 QA 分支、移除舊版本、重新部署正式站或清理私人紀錄。

## 七、最後保留項目：離線更新中斷故障注入（已通過）

### 測試範圍與追溯
- 實際通過的 GitHub Actions：[**#39100570167**](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39100570167)，`offline-failure-safety` 工作與所有步驟均為 `success`。
- 測試來源：`main` `57055ee27e8698245fb39fc9b2a3212c15203af1`，獨立分支 `test/phase1-offline-failure-20261018`。該分支只新增自動化工作流程及 `verification/phase1-offline-failure-qa.cjs`；原始 `sw.js` 與正式程式未更動。
- 使用 Playwright Chromium 與 WebKit 分別建立全新瀏覽器環境；本機測試 HTTP 伺服器用合成 HTTP 503 模擬單項離線資源下載失敗，未對正式站斷網、刪除快取或操作真人紀錄。

### 動態故障測試結果

| 驗證項目 | Chromium | WebKit |
|---|---|---|
| 初次完整下載 184 個資源 | 通過 | 通過 |
| 第二次下載遭合成 HTTP 503 阻斷 | 已確實觸發 | 已確實觸發 |
| 原本完整 snapshot 名稱及版本維持 | 通過 | 通過 |
| 未完成暫存 snapshot 清除 | 通過 | 通過 |
| 快取頁可再次開啟 | 真正 browser offline 下通過 | 快取重新開啟通過（非真正飛航模式） |
| 本機合成儲存資料不被改寫 | 通過 | 通過 |
| 故障解除後再次下載可建立新完整 snapshot | 通過 | 通過 |

測試輸出：
- `PASS chromium: 184-asset complete snapshot kept after HTTP 503; failed partial cache cleaned; existing offline page opens; retry successful; localStorage unchanged`
- `PASS webkit: 184-asset complete snapshot kept after HTTP 503; failed partial cache cleaned; existing offline page opens; retry successful; localStorage unchanged`

### 測試過程修正（可稽核）
第一次隔離測試 [#39100455081](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39100455081) 在「重新下載完成」檢查時過早讀取狀態，不能判定為網站正式程式有缺陷。僅修正測試程式，改成等待下載按鈕恢復可用且完成訊息出現，最新 [#39100570167](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39100570167) 所有步驟通過。原始程式並無修補。

## 八、正式結案結論與保留範圍

**結案日期：2026-10-18。第一階段「觀護人學習臺穩定性與資料安全」範圍內的核心驗收項目全部通過，結案。**

結案包含：
1. JSON 合成資料匯出、合併與衝突保留、匯入失敗安全回復，含 iPhone Safari 基本真機驗收。
2. Chromium/WebKit 離線資源及手機作答保存自動化，iPhone Safari 與主畫面 PWA 真機回報。
3. A4 列印與 PDF 原始紀錄唯讀保護、iPhone Safari PDF 真機回報。
4. 正式程式來源、426 題題庫及主要導覽穩定檢查。
5. 舊版／新版來回切換與發版回復權限控制的**隔離模擬**。
6. 離線更新遭 HTTP 503 中斷時，舊完整快取保留、失敗暫存移除、故障解除後重試成功。

**結案不代表零風險**：沒有實際操作 Cloudflare production rollback；沒有直接複核真人 JSON 逐欄完整性、Safari／PWA 之間的資料同步、清除網站資料後復原、不同 iOS 版本與 30 題長篇批次 PDF 等情況。正式學習紀錄仍須定期下載私人 JSON 備份。

本次僅更新獨立 GitHub 驗收文件與測試分支。核對 `main` 仍是 `57055ee27e8698245fb39fc9b2a3212c15203af1`；**未合併測試程式、未部署或回復正式網站、未存取或清理任何私人答案**。
