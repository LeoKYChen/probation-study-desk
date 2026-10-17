# v2.7 × MCP｜第十九輪 Stage 3s：法規與函釋來源資料契約驗收結果

**驗收日期：2026-10-17（臺灣時間）**  
**分支：`experiment/v27-mcp-stage3s`，從第十八輪 `experiment/v27-mcp-stage3r` 延伸**  
**成功 CI：[GitHub Actions #38999800917](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38999800917)**

## 一、實際驗收結果

| 本輪檢核項目 | 證據及結果 |
| --- | --- |
| 新增離線合成來源契約測試 | **66／66 通過，fail 0** |
| 指定合成來源資料 | **4 筆**：2 筆法規、1 筆具合成全文函釋、1 筆僅合成要旨函釋 |
| 來源資料轉 Stage3r 原型資料格式 | **4／4 筆通過**：法規 2 筆、函釋 2 筆 |
| Stage1 的 20 個法規檢核項目重新取得 | **0 件**，使用既有報告 |
| Stage2 的 21 筆函釋重新取得 | **0 件**，使用既有報告 |
| 最新官方法規及函釋資料正式查核 | **0 件** |
| 新增裁判資料、真實 PDF 下載或 PDF 轉存 | **0 件** |
| 正式站整合、主分支合併或 Cloudflare 部署 | **0 件** |
| `stage3_accepted` | **false** |

CI 官方記錄直接顯示 `# tests 66`、`# pass 66`、`# fail 0`，並完成合成資料跨模組 mapping 檢查及 GitHub 變更範圍檢查。腳本不登入任何真實官方 API、不下載 PDF、不保存真實法律原文。

## 二、完成的資料契約

### 法規

已建立 `id`、`sourceUrl`、`sourceVersion`、`observedAt`、`promulgatedOn`、`commencementOn`、`commencementRule`、`transitionalRule`、`effectiveScope` 與 `text` 等**內部標準化欄位**。

- 如果法規只取得修正公布日，`commencementOn` 維持 `null`，不根據修改或觀察日期自行推論施行日。
- 有施行日期欄位仍**不等於**該法規此刻是最新法或對某個案件可適用。
- 法規名稱／文本、來源版本、來源地址、日期及施行欄位皆須與固定的**合成來源參考**一致，才能產生**合成示範卡片**。
- 過渡條款在內部契約獨立保存；既有 Stage3r 卡片沒有新增未驗證的過渡適用結論。

### 行政函釋

已建立 `id`、`sourceUrl`、`sourceVersion`、`observedAt`、`issuingAgency`、`issueNumber`、`issuedOn`、`contentTier`、`fullText`、`officialAbstract`、`legalEffectLabel` 等**內部標準化欄位**。

- `official_full_text_verified`：對應「全文層級」的**合成示範**。
- `official_abstract_only`：只允許顯示要旨層級；輸入如果夾帶冒稱全文的內容，會拒絕。
- `unavailable`：沒有足夠核對資料時，不以站方摘要自動填補。
- 任何「函釋現行有效」聲稱都不會由本輪合成資料取得合法效力認證。

**沿用的歷史驗收結論：** Stage1 法規指定項目 20／20；Stage2 函釋 21／21 中繼資料、17／21 官方全文、4／21 僅官網要旨。上述數目**不是本輪新增驗收的真實官方紀錄**，也不表示全部法律已確認現行施行或函釋均仍適用。

## 三、可信來源之重大界線

本輪使用 `https://fixtures.stage3s.invalid` 及 `TEST_*_SYNTHETIC_...` 格式，故所有來源明確屬於人工合成研究資料。

對每筆固定合成紀錄計算 SHA-256 指紋，能測試「提交的資料是否與先前鎖定的合成內容一致」。**這既不是司法院或法務部的數位簽章，也沒有驗證任何真實官方網站的回應，不能轉換為司法資料存取或發布授權。**

即使測試通過，下列欄位始終維持：
- `authorizedOfficialSource=false`
- `currentLawVerified=false`
- `currentInterpretationEffectVerified=false`
- `canServeProduction=false`
- `stage3Accepted=false`

使用者自行添加 `verified=true`、`legalEffectLabel=active`、`officialSourceVerified=true` 或網址偽裝，皆不能升級前述狀態。

**原始官方 API 的實際欄位名稱、端點限制、修正公布／施行分別如何表示，及各件函釋的有效性資料來源，尚未完成本輪實證比對。** 因此這次完成的是 source-to-UI **內部資料契約及驗證原型**，並不是正式政府 API 接口驗收。正式資料整合應另設「實際官網欄位 → 標準化欄位 → 來源證據 → 安全介面」的可稽核路徑。

## 四、交付檔案

1. `experiments/v27-mcp-poc/stage3s/source-contract.cjs`：離線標準化資料模型、固定合成證據、SHA-256 檢查、未知來源拒絕及 Stage3r UI 對應。
2. `experiments/v27-mcp-poc/stage3s/source-contract.test.cjs`：66 項版本日期、全文／要旨錯配、假來源／失效聲稱及 UI 對應負面測試。
3. `experiments/v27-mcp-poc/STAGE3S.md`：完整欄位規格及正式來源未知項目。
4. `experiments/v27-mcp-poc/STAGE3S_RESULT.md`：本報告。
5. `.github/workflows/test-v27-mcp-stage3s.yml`：只在獨立分支執行的安全 CI，測試結果僅保存通過件數。

**正式 v2.5、原 `development/v2.7/`、`services/v2.7-judgment/`、`main`、Cloudflare 均未修改。**

## 五、接續開發建議

第十九輪的合成契約已建立；下一輪重點不宜再無止境增加純合成測試，而應先**核對法務部官方公開法規與函釋資料實際欄位、來源版本、修正及施行規定的表示方式**，再設計有限且可驗的讀取與轉換器。只要官網來源查核失敗，就保持「無法判斷是否現行適用」，不以已儲存的歷史快照自動當作最新法律。

在來源仍不可信或使用限制未解決之前，不應接入正式 v2.7，也沒有啟用任何裁判、PDF 或個案連結功能。**第十九輪資料契約子測試通過；第 3 階段整體仍未完成驗收。**
