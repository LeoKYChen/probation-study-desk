# v2.7 × MCP｜第十九輪（Stage 3s）來源資料契約與 UI 映射規格

**更新：2026-10-17；獨立分支：`experiment/v27-mcp-stage3s`，以 `experiment/v27-mcp-stage3r` 為基礎。**

## 目的與實作界線

本輪不再增加 PDF 驗證、沒有觸碰正式站，也不重新取得先前 20 個法規檢核項目或 21 筆函釋。基礎是 [第 1 階段](STAGE1_ACCEPTANCE.md)、[第 2 階段](STAGE2_ACCEPTANCE.md)、[第 17 輪來源驗收阻擋](STAGE3Q_RESULT.md)、[第 18 輪離線法規／函釋卡片](STAGE3R_RESULT.md)。這些來源只支持特定抽樣與原型驗收，不能自動推論全國法規現行有效或函釋仍具現行效力。

本輪新增兩個檔案：
- `stage3s/source-contract.cjs`：**離線、合成來源**資料契約，採可預期的合成識別碼、固定來源紀錄與 SHA-256 指紋比對；含 `inspectRecord()`、`toReviewCard()`、`toStage3rModelInput()`、`schemaReview()`。只與自己事前固定的**合成**原始資料比對。
- `stage3s/source-contract.test.cjs`：來源版本、日期、字號、全文／要旨、來源 URL、範例攻擊及 Stage3r UI 對應的反例測試。

合成來源網域是 `https://fixtures.stage3s.invalid`，**刻意不以真正機關網站／API 假裝取得官方資料**。所有輸出均保持 `authorizedOfficialSource=false`、`currentLawVerified=false`、`currentInterpretationEffectVerified=false`、`canServeProduction=false`、`stage3Accepted=false`。

## 一、法規資料契約

| 概念欄位 | 來源資料必要條件 | 對 Stage3r 畫面 |
| --- | --- | --- |
| `id`、`kind=law` | 真實接入前須核實法規識別碼；本輪只允許 `TEST_LAW_SYNTHETIC_...` | 僅合成標題和識別碼 |
| `sourceUrl` | 只接受合成 fixture 內逐筆固定的 URL；**不能靠看起來像 law.moj.gov.tw 就當成身分已驗** | **不展示**真實逐條官方深連結 |
| `sourceVersion` | 須與獨立記錄的版本對應；變更即重新查核 | 作為研究版本標籤，非現行法證明 |
| `observedAt` | 具 UTC 時差的時間戳記，格式／日期必須合法且一致 | `snapshotOn` 來源快照／查核日 |
| `promulgatedOn` | 修正公布日，獨立檢核 | `promulgatedOn`，**不替代施行日** |
| `commencementOn` | 施行日；未知時應為 `null` | `effectiveOn`，未知保留未查 |
| `commencementRule`、`transitionalRule` | 條文施行規定及過渡規定，若無權威文字不得猜造 | 研究契約保留完整欄位；現行卡片不擅自產生推論 |
| `effectiveScope` | 研究 fixture 固定 `unknown`，正式版本須獨立確認 | 一律「現行法、施行範圍待核對」 |
| `text` | 合成固定全文與版本日期一起做 hash 比對 | 只顯示合成條文，非實際法規原文 |

**註：** 官方法規資料的真實欄位名稱、不同來源對施行條文與歷史版本的表示方式，以及修法後的可追溯識別碼，**尚未完成新的原始 API 規格對照**。本表是**內部標準化資料契約**，不是宣稱政府 API 原生具有上述全部欄位。與真實官方資料串接前，必須建立「各來源原始欄位 → 正規化欄位」實際證據，並對缺少欄位的情形拒絕或降級。

## 二、函釋資料契約

| 概念欄位 | 安全判定 |
| --- | --- |
| `id`、`sourceVersion`、`sourceUrl`、`observedAt` | 對應固定合成來源。真實 ID、目前 URL、原始頁版本均尚未接入 |
| `issuingAgency`、`issueNumber`、`issuedOn` | 必須與同一來源、同一筆公文的欄位一致；無法核對不可推算 |
| `contentTier` | `official_full_text_verified`／`official_abstract_only`／`unavailable` |
| `fullText` | **僅全文等級才允許轉入全文欄位**；要旨等級若帶全文，直接拒絕 |
| `officialAbstract` | 原始要旨的獨立欄位，**不可由本站整理文字代替** |
| `legalEffectLabel` | 固定 `unknown`；不依自動搜尋結果或使用者自行 `valid=true` 宣稱現行有效 |
| `siteSummary` | 與官方欄位隔離；示例只使用固定合成本站摘要，不接受未核對的輸入 |

這些欄位反映 [Stage2 接受的 B 方案](STAGE2_ACCEPTANCE.md)：**21 筆中繼資料、17 筆官方全文、4 筆僅要旨**。本輪四份合成 fixture 不是過去查過的 21 筆，**也沒有宣稱是新增真實函釋的驗收**。原 21 筆仍依先前證據分級保存；「函釋現行效力」仍全部待確認。

## 三、阻擋情境

任何違反固定記錄的來源 ID、法院／函釋案件 ID、版本、日期、文字、SHA-256、來源路徑或函釋全文／要旨等級，均不得進入 Stage3r 卡片。不能因為 JSON 內帶有 `official=true`、`validity=active`、`verified=true`、`approved=true` 就通過。

新增四個合成固定樣本（兩筆法規、兩筆函釋），代表兩種不同法規施行情況及函釋全文／要旨情況。對應 Stage3r 仍會寫「合成示例」，**不能因指紋一致改成真實官方來源已驗證**。

注意：`SHA-256` 在此只是把輸入與**專案自己固定的合成 fixture**比對，並非政府電子簽章、憑證、官方 API 回應驗證或時間戳來源。這種指紋機制**沒有解決信任來源、資料完整性以外的法遵與現行效力問題**，不能直接搬到正式站作驗證官方正本的充分證據。

## 四、預定下一關

要開始做**真實官方欄位映射**，需要另行取得可稽核的官方來源規格及實際例子（不含任何非公開少年裁判或個資），確認法規版本及施行日出處、行政函釋要旨／全文的欄位、版本快取更新方式。單純本地 JSON schema 通過不足以讓它進入正式查詢結果。往後若進行實際整合，仍須建立可取用性、隱私／個資、更新、錯誤降級及撤除後的後端檢查，並由使用者**另行授權部署**。

本輪不修改 `main`、v2.5、`development/v2.7/`、`services/v2.7-judgment/`、Cloudflare；不讀寫真實法院 PDF，不建立 PDF 轉存，也不使用帳密、Token 或付費服務。
