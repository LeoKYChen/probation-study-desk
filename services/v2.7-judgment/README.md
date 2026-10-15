# v2.7.1b｜司法裁判 API 安全介接（離線測試版）

**目前狀態（2026-10-15）：僅離線模擬通過。沒有司法院 API 帳號、沒有真實裁判、沒有正式資料庫，也沒有公開裁判查詢端點。**

本目錄不屬於 Cloudflare Pages 公開資產的 `development/v2.7/`，**不可**把真實裁判、帳密、Token 或任何非公開少年案件複製進公開 Git 儲存庫。

## 官方來源及規格校正

- 司法院資料開放平臺：https://opendata.judicial.gov.tw/
- 114年8月22日版官方API規格：https://opendata.judicial.gov.tw/api/Newses/42/file
- POST `https://data.judicial.gov.tw/jdg/api/Auth`：`{user,password}` → `{Token}`（6小時有效）。
- POST `https://data.judicial.gov.tw/jdg/api/JList`：`{token}` → `[{date,list:[jid,...]}]`（取得7日前的異動清單）。
- POST `https://data.judicial.gov.tw/jdg/api/JDoc`：`{token,j}` → 裁判書物件（或 error）。
- **重要：`JFULLX` 是物件，並非字串**：
  - `JFULLX.JFULLTYPE`：`text` 或 `file`
  - `JFULLX.JFULLCONTENT`：文字內容；`file` 時可能僅有預覽，不得冒充完整全文
  - `JFULLX.JFULLPDF`：`file` 類型提供官方PDF連結
- 相同 jid 的新版必須覆蓋舊版。官方回報「可能未公開或已從系統移除」時，必須撤除相關儲存資料、搜尋索引、摘要、向量與衍生快取。API服務時間限臺灣時間00:00–06:00。

## 已建立的檔案

| 程式 | 功能 |
|---|---|
| `judicial-api-client.cjs` | 可注入mock的Auth/JList/JDoc介面；臺灣時區窗口檢查、6小時Token保守提前更新、live HTTP雙重鎖 |
| `jdoc-model.cjs` | 官方JDoc欄位正規化、`text`/`file`分類、官方檔案連結檢查、撤除計畫 |
| `private-mutation.cjs` | 儲存介面契約：一律先禁止公開查詢；撤除須完成清除並再次確認 |
| `*.test.cjs` | 28項純合成資料測試；不需帳號、網路或Cloudflare憑證 |

本目錄中沒有任何真實的裁判書全文，也不包含公開裁判案例的示範案號。測試使用 `TEST_JID_SYNTHETIC_DO_NOT_USE`，不得引用為真實裁判。

## 測試指令

```bash
node --test services/v2.7-judgment/*.test.cjs
```

GitHub Actions：`.github/workflows/test-v271b-judgment.yml`（獨立執行，未帶入任何帳密Secrets）。

## 什麼時候才需要使用者授權？

**不是現在。** 當且僅當以下條件都完成，才會請使用者在安全的GitHub/Cloudflare Secrets管理畫面自行設定帳戶資訊：

1. 已選定可持續刪除的**私有**儲存設備（例如受控Worker與D1/R2），公開GitHub及Cloudflare Pages不保留裁判全文。
2. 建置完成包含主表、索引、附件、快取、向量及備份的**真實刪除與驗證**程序，不只是目前的模擬介面；需有公開封鎖及撤除失敗告警。
3. 取得官方授權帳號並核對資料使用規範；使用者自行設定具必要權限的 `JUDICIAL_API_USER`、`JUDICIAL_API_PASSWORD` 等私密設定，**不得在聊天、代碼或GitHub issue直接貼帳密**。
4. 先由使用者確認是否啟用最小量真實API連線測試。此時才評估將 `JUDICIAL_API_LIVE_ENABLED=true` 設於受控環境，而非公開網站。
5. 完成真實裁判的修改/撤除端到端測試及定期更新稽核前，不開放給其他人搜尋，也不保證裁判收錄完整。

目前 `makeHttpTransport` 預設關閉，即使傳入 `enabled:true`，仍要求後端程序的 `JUDICIAL_API_LIVE_ENABLED=true`。沒有任何啟用真實 API 的排程或網頁按鈕。

## 尚未完成／不應宣稱

- 尚未申請或使用司法資料開放平臺帳號、尚未對 `data.judicial.gov.tw` 送出實際請求。
- 尚未建置正式私有資料庫、裁判書全文搜尋、真實資料清除、備份保留政策、定期同步。
- 離線測試通過 **不等於** API 真實回應測試通過，也不等於隱私、授權或裁判撤除的正式驗收完成。
- 少年保護事件裁判如未公開，不得因技術可行性推定可以取得或公開。

下一里程碑 **v2.7.1c**：先建立可刪除的私有儲存與撤除端到端測試，然後才安排使用者授權與最小量的實際API連線驗證。
