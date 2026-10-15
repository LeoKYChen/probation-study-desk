# v2.7.1c 第三輪｜私有裁判後端部署前安全檢查（2026-10-15）

> **尚未部署Cloudflare D1／Worker；沒有真實司法院API請求，也沒有真實裁判資料。** 目前只實作離線合成資料及簽章憑證模擬。不要將測試通過解讀成可公開裁判檢索。

## 本輪實作與驗收

| 元件 | 程式 | 測試涵蓋 |
|---|---|---|
| 外部可信撤除版本見證 | `trusted-witness.cjs` | 兩個相互獨立的Ed25519公鑰、短效簽章、不同簽署主體、版本倒退或不一致即拒絕 |
| 內部操作權限 | `service-permissions.cjs` | 簽章綁定角色、操作、資料SHA-256、效期及一次性nonce；重放或替換請求失敗 |
| 私有命令調度 | `internal-controller.cjs` | 僅允許合成資料讀寫、模擬還原，沒有公開HTTP或真實司法API開關 |
| 部署前稽核 | `deployment-preflight.cjs` | 檢查獨立D1、見證服務、Secrets、原子nonce儲存、備份政策、授權及稽核等條件 |
| 原安全防護 | `private-worker.mjs`、`restore-guard.cjs` | HTTP皆404；資料還原凍結，撤除墓碑禁止舊資料回復 |

測試路徑：`services/v2.7-judgment/*.test.cjs`。GitHub Actions在Node.js 24離線執行。最新81項合成測試通過，0失敗。

### Cloudflare官方平台限制

- D1 Time Travel會覆寫目前資料庫狀態，保留期限依帳戶方案而不同；官方說明：https://developers.cloudflare.com/d1/reference/time-travel/
- 服務間私有通訊可考慮Cloudflare **Service bindings**，比對外HTTP連線更容易控制邊界：https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Workers敏感設定使用**Secrets**，不能放在前端網頁或公開GitHub：https://developers.cloudflare.com/workers/configuration/secrets/
- 本輪 `node:crypto` 依賴Node24合成測試，不代表能不改動直接部署Workers；需另行確認`nodejs_compat`與Runtime API支援。

## 遠端部署前尚未完成的事項（全部屬阻擋條件）

1. **兩個不同的遠端D1**：裁判中繼資料庫及撤除墓碑庫；各自獨立備份／還原邊界。尚未建立。
2. **兩個真正獨立的簽署服務**：目前Ed25519公私鑰都只存在離線測試；簽署版本的儲存系統、輪替與撤銷機制、外部單調版本儲存尚未建立。即使兩個憑證有效，也仍需證明兩個服務不會同時倒退。
3. **不依附操作資料庫的原子nonce儲存**：若操作DB回復舊版，不可使舊請求再度有效；目前只使用合成記憶體集合。
4. **受控服務間授權**：選擇Service binding或等效私有通道，對操作角色、服務身分、來源、撤除作權限分離；正式Worker尚未連結。
5. **真正的Time Travel與備份清除政策**：判斷保留期限、外部快取／向量／附件、復原及法律遵循。程式只驗證現行SQL表，不能驗證歷史副本。
6. **同時更新/撤除競態處理**：撤除墓碑、可信見證與主庫寫入跨服務尚非同一筆交易；正式版要先建立撤除優先、讀取時重查及保護機制。
7. **安全管理與人工復核**：費用及免費額度、警示與操作日誌、資料最小化、突發封鎖、管理員核准及修復流程。
8. **使用者授權、法遵與正式API**：在上述機制完成遠端合成測試且使用者明確同意前，不應要求API帳密，亦不對司法院真實API發出請求。

### 外部簽章見證不等於已完成可信儲存

`trusted-witness.cjs` 只驗證兩張短效Ed25519憑證並拒絕版本倒退。**它不會自動建立真正不可回滾的外部儲存。** 金鑰管理、取得憑證的服務、單調版本寫入與授權政策均須另行實作和審查。因此目前程式不可用於真實裁判存取。

### 部署意願與安全界線

- 目前使用者僅授權繼續開發及模擬測試；**遠端D1／Worker及外部見證服務均尚未建立或部署**。
- 未來若要試用Cloudflare遠端D1，先建立**獨立、只含合成資料、不可公開查詢**的測試環境；需使用者自行在Cloudflare核准相關資源，後續由開發者檢查是否具備對應連線能力。
- 不允許把現有Cloudflare Secrets複製到網頁、GitHub檔案、Actions日誌；開發過程也不需要傳送帳密給聊天助理。
- `feature/v2.7-legal-search` 以外的 `main`、v2.5正式站及`probation-study30-test`都不需變更。
- 即使`assessPrivatePilot()`顯示自填檢查清單均通過，也**不會**自動核准真實資料處理或部署。
