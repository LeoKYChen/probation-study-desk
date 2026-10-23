# 備考書桌跨裝置同步｜測試專案設定與正式驗收

> 狀態：2026-10-23，僅適用於 `feature/study-desk-cloud-sync-20261023` / PR #83。**尚未對正式網站啟用。** 此文件是設定與驗收清單，不表示已替使用者建立外部帳號或完成實機測試。

## 一、先保留現有學習紀錄

在平常使用的手機與電腦上，分別進入原本的「備考書桌 → 進度與資料保存」，先點選「匯出書桌 JSON」。確認每份檔案能在裝置開啟、大小不是 0 bytes，並妥善存於私人資料夾。若曾使用不同網域（GitHub Pages 和 Cloudflare Pages），**每個來源網站均應分別備份**；兩站即使程式碼相同，瀏覽器 IndexedDB／localStorage 也不共用。不要刪除原裝置網站資料，不要把私人的 JSON、信箱驗證碼或機密個案上傳至公開 GitHub。

## 二、建立不含個人作答的測試資料庫（帳號由使用者本人操作）

1. 打開 [Supabase Dashboard](https://supabase.com/dashboard)，登入自己的帳號，選擇 Free 組織並建立新的測試 Project。若要求信用卡、升級或付款，先停止；不要為了測試直接開啟付費服務。
2. 在專案中的 **SQL Editor** 開啟 New query。從本專案 [cloud-sync/schema.sql](../cloud-sync/schema.sql) 複製完整腳本，在新建立的**專用測試 Project** 執行。勿在已有其他業務資料的資料庫執行。
3. 至 **Authentication → Email Templates → Magic Link / OTP**，將信件內容改為包含 `{{ .Token }}`，例如「你的備考書桌登入驗證碼：`{{ .Token }}`」。避免只放 Magic Link，因網站使用輸入式驗證碼。
4. 使用 Supabase 內建寄信功能時，先用該專案組織**已獲授權的團隊成員信箱**測試；依官方文件，預設寄信服務不支援向任意地址發送，正式營運需要另行規劃符合規範的寄件方式。測試階段不要自行開通付費 SMTP。
5. 在 **Connect** 或 **Project Settings → API Keys** 找到 **Project URL**（`https://<project-ref>.supabase.co`）及 **Publishable key**（以 `sb_publishable_` 開頭）。它們是公開前端連線設定，可填在測試頁面；**不要使用或分享 `service_role`、`sb_secret_`、資料庫密碼、Access token 或 Refresh token**。

## 三、隔離的功能驗收順序

由於 PR #83 尚未合併至正式站，請先在隔離的測試建置中驗收，**不可直接拿正式個人作答做第一次測試**。

- [ ] A 裝置首次開啟：不登入，原本 guest 作答正常顯示，沒有自動網路請求或上傳。
- [ ] A 裝置在帳號書桌登入：不會自動帶入 guest 筆記；登入未成功時不遺失 guest。
- [ ] 下載 guest 原始 JSON，用**合成的作答**測試「複製本機舊書桌至帳號」；新帳號資料成功保存，guest 不變。
- [ ] B 裝置以同一 Project + 同一 Email OTP 登入：能取得 A 已同步的合成作答。
- [ ] B 裝置修改，A 不在編輯中的作答可更新；如果 A 正在寫訂正或回饋，不能悄悄清除輸入。
- [ ] B 裝置斷網作答，顯示本機保存與待上傳數；恢復網路後再同步，A 能取得修改。
- [ ] A、B 同時改同一份答案：至少保留兩個版本，並提供人工處理，不能靜默覆寫。
- [ ] 登出後回到 guest，帳號的離線資料仍保留於本裝置；再次登入同一帳號可接續。
- [ ] 換另一個帳號或另一個 Project，不得看到先前帳號資料。
- [ ] 模擬驗證碼過期、401、429、斷線及背景重開；提示明確，仍可匯出 JSON。
- [ ] iPhone Safari、Mac Chrome/Safari 及既有兩個正式網域的正確版本／PWA 更新、JSON 還原、回復程序均通過，再考慮正式合併部署。

## 新增：帳號資料隔離與安全登入驗收（第三輪）

- [ ] 同一瀏覽器若有原本的函授管理 `localStorage` 資料，切換到新的雲端帳號時不能直接顯示或上傳；只有點「匯入此裝置函授進度至帳號（需確認）」並明確同意後才可移轉。
- [ ] 帳號 A 已確認匯入的函授快照可以同步到帳號 A 的另一部裝置，但不能出現在帳號 B。
- [ ] 登入者介面應顯示遮罩後的帳號信箱，避免把原本裝置紀錄移轉到錯誤帳號。
- [ ] Email OTP 成功但測試 Project 沒有安裝同步 RPC 時，應提示「雲端資料庫尚未準備好」，保留原本 guest 書桌，不可錯誤顯示同步成功。
- [ ] 離線尚有待上傳紀錄／衝突時登出應警告；帳號的本機資料仍保留。
- [ ] 背景同步不可重設目前手動選擇的考題或函授堂次，也不可清除正在輸入的訂正、回饋、考科偏好。
- [ ] 測試專案以合成資料驗收。系統資料存於所連接的 Supabase 後端，**不是端到端加密的私人保險箱**；不得同步可識別少年個案或保密公務文件。

## 四、常見問題

**為什麼填了 Project URL 和 Publishable key 還不能同步？**

因為要先將 SQL 資料表、受驗證的 RPC、Email OTP 信件範本設定好，登入後才有受權限保護的同步通道。程式模擬測試不等同真實 Supabase 驗收。

**需要把 API 金鑰貼到 GitHub 嗎？**

不需要，也不應把使用者 JWT／管理金鑰放進程式碼或 PR。公開 Publishable key 雖可出現在前端，測試時也可只填在網站介面，避免無謂的長期公開設定。

**已登入後，原本的筆記會不見嗎？**

帳號與未登入書桌採不同本機資料空間；登入初期看不到 guest 是刻意的安全隔離。必須自行確認匯入，原 guest 仍可在登出後查看。

## 五、驗收證據與上線門檻

程式測試：`npm --prefix verification/sync test` 與 `npm --prefix verification/sync run test:browser`。此測試使用合成帳號、攔截的雲端回應及內嵌 PostgreSQL，**不可宣稱等於真實 Supabase 已通過**。

實際上線前須記錄：PR 最新 commit SHA、CI 結果、驗收裝置及瀏覽器、Project 連線成功、OTP 成功、跨裝置雙向修改及衝突、離線恢復、正式站版本識別、可回復的 JSON 備份。只有全部確認後，才考慮合併 PR 與正式發布。

### 依據（Supabase 官方）

- [Email OTP 登入](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Publishable 與 Secret API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [自訂 SMTP 及預設寄信限制](https://supabase.com/docs/guides/auth/auth-smtp)
