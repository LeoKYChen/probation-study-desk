> 2026-10-22更新：依使用者指示，跨裝置同步暫緩。以下雲端設定為未來選配的歷史說明，現在不需操作或提供任何設定。

# 跨裝置同步接入：開發中

目前已完成本機佇列、版本衝突、重送去重、私有資料表與RPC，並使用合成帳號及內嵌PostgreSQL測試。尚未連線真實Supabase專案，不代表已驗收正式帳號同步。

## 未來重新啟用時的設定參考（目前無需操作）

1. 登入 [Supabase](https://supabase.com/dashboard)，建立或指定一個 **Free** 組織中的測試專案。若畫面要求升級、付款或信用卡，先停下來。
2. 從專案設定取得 **Project URL** 與 **Publishable key**（以 `sb_publishable_` 開頭）。這兩個是本前端需要的公開連線設定。
3. 回報這兩項設定即可。資料庫密碼、`service_role`、`sb_secret_`、個人access token都不需要提供。

只取得公開設定還不足以使用同步：後續仍須在該專案執行已備妥的 `schema.sql`，配置Email登入驗證碼模板，再用隔離帳號驗收；本次沒有替使用者執行這些外部動作。

## 接入檔案

- `core.js`：可在Node與瀏覽器共用的同步契約。
- `idb.js`：IndexedDB帳號命名空間；資料與佇列原子寫入。
- `supabase.js`：Email OTP、工作階段更新、RPC呼叫；拒絕管理金鑰。
- `schema.sql`：新專案初始化；私有表、版本化事件、去重回條及兩個受驗證的RPC。

資料表不授權前端直接操作；RPC由 `auth.uid()` 取得實際使用者，不能靠前端指定userId。每個帳號的寫入會序列化，避免較晚提交的事件落在已讀游標之前。單筆內容限制約1MB，每次拉取最多200筆且內容約4MB。重送回條與事件目前會持續保存，正式大量使用前須制定壓縮與保留政策。

Email OTP目前透過分頁 `sessionStorage` 保存登入工作階段，關閉工作階段後需重新登入。預設寄信服務有收件人及流量限制；先以專案團隊成員Email測試。啟用驗證碼時，Email模板須包含 `{{ .Token }}`；不能只保留Magic Link。尚未配置SMTP，也未申請付費寄信服務。

## 官方依據（2026-10-22查閱）

- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)：publishable與secret的用途不同。
- [Database functions](https://supabase.com/docs/guides/database/functions)：資料庫RPC與權限。
- [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)：驗證碼模板與驗證流程。
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)：內建寄信服務限制。
- [價格](https://supabase.com/pricing)：當日列有$0 Free方案、500MB資料庫；閒置一週可能暫停。
- [費用控制](https://supabase.com/docs/guides/platform/cost-control)：Free方案不收取超額費用；本次沒有開通任何方案。

## 尚未驗收

真實郵件寄送、正式Auth/JWT與PostgREST整合、實體手機／電腦、WebKit、兩個正式網域的匯入及正式部署。相關模擬測試不得替代實際驗收。
