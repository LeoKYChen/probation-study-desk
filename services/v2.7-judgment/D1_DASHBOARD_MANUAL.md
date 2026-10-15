# v2.7.1c｜Cloudflare D1 Dashboard 手動建立兩個「合成資料」測試庫

狀態：2026-10-15。**GitHub 端的 D1 專用 Token 已確認 active，但對正確帳戶的 `GET /d1/database` 仍收到 HTTP 401、code 10000。** 因此**暫停任何 GitHub Actions 遠端 D1 佈建**。暫不猜測原因或要求再建立 Token。

## 只需要在 Cloudflare Dashboard 完成的操作

1. 在同一個 Cloudflare 帳戶進入 **Storage & databases → D1 SQL database**（介面名稱可能變動）；先確認目前資料庫數量。Cloudflare Free 方案最多10個D1資料庫，如果已有9個以上，先停止，不要新增或刪除任何既有資料庫。
2. 按 **Create database**，建立：
   - `probation-v271c-metadata-synth-20261015`
   - `probation-v271c-ledger-synth-20261015`
   兩個獨立資料庫。Location hint可選Asia-Pacific (APAC)，僅為建議而非強制司法資料存放地。
3. 確認兩個名稱均出現在資料庫列表。到此為止**不需要**匯入真實裁判、開公開查詢或配置Worker。不要在聊天貼帳密、Token、API Key。
4. 如使用者同意下一步，再分別進入兩個資料庫的 **Console**，執行已準備的純合成資料表SQL：
   - 中繼資料庫：[`0001_private_metadata.sql`](./migrations/0001_private_metadata.sql)
   - 撤除庫：[`0002_separate_revocation_ledger.sql`](./migrations/0002_separate_revocation_ledger.sql)
   *須先確認資料庫完全是新建空庫，不能對既有資料庫貼上SQL。*
5. 合成資料SQL：
   - [`metadata-synthetic-smoke.sql`](./remote/metadata-synthetic-smoke.sql)
   - [`ledger-synthetic-smoke.sql`](./remote/ledger-synthetic-smoke.sql)

**注意：** Dashboard 能建立D1，不代表GitHub Actions的D1權限已修復。無法遠端使用同一Token時，下一步可先透過Dashboard Console做人工合成測試；日後若要自動化，再獨立處理Token權限或Cloudflare的D1 API 401。

## 安全界線與避免操作風險

- 不修改現有Pages專案、v2.5或每日練習站；不刪除現有資料庫。
- 不下載、不儲存任何真實裁判，也不要求司法資料開放API帳號。
- 以上SQL的執行僅驗證表結構與合成資料，不代表Time Travel的真實備份撤除測試已通過。
- 不在使用者明確確認兩個獨立測試資料庫已建立之前，自行透過Actions啟動寫入。

官方指引：[Cloudflare D1 Getting started](https://developers.cloudflare.com/d1/get-started/)；[D1 API List](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/list/)。
