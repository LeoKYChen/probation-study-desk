# 觀護人學習平臺｜Firebase Spark 全站跨裝置同步（開發／驗收說明）

> **開發分支：** `feature/firebase-whole-site-sync`；**PR #84：Draft，尚未合併或正式發布**。2026-10-23。Firebase 是使用者指定的新後端；先前 PR #83 的 Supabase 書桌方案不作正式發布。

## 1. 這次「整個網站」的定義與現況

同一 Firebase Auth（Google 帳號）應同步「全部具有使用者學習狀態的模組」，不能只同步備考書桌。本站有多個網址／頁面，但其資料分為以下兩種：

| 範圍 | 本次已撰寫的介接 | 限制 |
|---|---|---|
| v2.5／舊版考古題作答 | 統一備份白名單的 localStorage 介接 | 先從備份中心明確同步 |
| 每日模擬題、收藏與每日 30 分鐘 | 同上 | 進行中的 sessionStorage 計時並未納入 |
| 國文、英文學習、AI 批改提示詞 | 同上 | 僅既有備份中心列管鍵 |
| 函授排課、已看進度 | 同上 | 不直接推定知識掌握 |
| 少年司法週報收藏／已讀、考試倒數與偏好 | 同上 | 同一網址下的 localStorage |
| **備考書桌作答／訂正／回饋／弱點** | **新增 IndexedDB guest 儲存區逐筆同步介接** | 不同步舊 Supabase 的 outbox／游標／帳號命名空間 |
| 同一站其他尚未發現／不在允許清單的鍵 | **未接入** | 先盤點，不能在未驗證格式時自動上傳 |
| GitHub Pages 與 Cloudflare Pages 兩個網域 | 共用 Firebase 專案與同一 Google UID 的架構 | 各網域初次啟用時需各自做資料預覽與確認 |
| 後台新聞 JSON、題庫、網站程式碼、GitHub Actions | **不是個人學習紀錄** | 繼續由 GitHub 原有更新／部署管線處理 |

## 登入政策（已確認需求）

**完全不強制登入。** 所有既有考古題、模擬題、函授、英文、少年司法週報及備考書桌都保留訪客本機模式。Google 帳號僅用於選用 Firebase 同步；登入本身不等於授權上傳既有答案。首次同步先預覽、下載兩份 JSON、確認後才寫雲端。

**曾經確認過雲端同步的帳號**：只有未登出的已授權會話，才會在再次打開「完整學習紀錄備份」時嘗試恢復 Firebase 登入狀態；不會因此自動上傳任何學習資料。使用者明確登出後，下一次開啟仍是訪客狀態，不再自動載入 Firebase SDK；保留本機作答與原帳號綁定保護。

目前跨裝置合併仍須在備份中心操作；要達到在每個作答頁面直接同步，尚須另做全站資料寫入事件介接、離線佇列與衝突可視化。**不能把本階段寫成已完成無感自動同步。**

## 2. 安全設計（本階段）

- **沒有在網站上登入與確認前不觸發學習紀錄上傳。** Google Web config 是公開設定，但**不可放服務帳戶金鑰、管理金鑰、Access token 或個人答案在 repo**。
- 每個使用者資料位於 `users/{firebase-uid}/modules/{encodedKey}` 與 `users/{firebase-uid}/desk/{encodedRecordId}`；`firestore.rules` 僅允許該 UID 讀寫自己的資料，且拒絕刪除。
- 綁定同一瀏覽器網址下的本機資料與首次同步的 UID。若登入其他帳號或 Firebase Project，**禁止直接把原本的同站資料上傳至另一帳號**。共用電腦應用獨立瀏覽器使用者設定檔。
- 原始資料先留本機。使用 `PSDUnifiedBackup` 的原始白名單和結構驗證；首次比對、相同 ID 不同答案、另一裝置後續修改等情況依差異預覽決定。當遠端與本機都修改時，**雲端主版本保留，本機不同版本保存於衝突版本檔／書桌 `import/` 保留紀錄**。
- 對每個 Firestore 文件使用整數 revision + Firestore transaction 比對（CAS），另一裝置插入新版就拒絕本次，要求重新預覽。必要時先保存衝突檔再處理主要資料；局部成功須再次預覽，**沒有跨兩種儲存庫的原子交易承諾**。
- 單文件大於安全門檻（850KB 附近）即拒絕，提示後續分段同步；不會刪除或截斷原稿。
- **同步前必須匯出兩份 JSON**：既有 15 類模組、備考書桌 IndexedDB；確認檔案實際保存並關閉其他練習分頁，才執行同步。
- 此版本使用「按下同步」的安全流程。**尚未實現各模組零操作背景自動同步**；此功能需先完善寫入事件、離線佇列與多分頁衝突處理。

## 本輪：本機待同步偵測與失敗防護

- 已新增僅讀取本機資料的待同步偵測器：比對既有 15 類 `localStorage` 模組、備考書桌 IndexedDB 與最後一次成功同步的 SHA-256 基準；純本機計算，**不需輪詢 Firestore、不產生雲端讀取成本**。
- 此偵測器在備份中心已綁定的登入帳號模式中，每約 30 秒、網路恢復、分頁重新顯示時可重新檢查；**訪客模式不載入 Firebase SDK，也不在背景上傳**。本機刪除曾同步的紀錄會顯示有差異，而不是當成雲端刪除指令。
- 登入但未完成首次備份及合併者，會看到「尚未完成首次同步」提示；不將登入視為上傳同意。
- 同步失敗（包括兩個資料區其中一個先成功）時，舊預覽及下載確認狀態會失效。必須重新預覽並檢查兩份備份後再操作，以免反覆送出舊交易。
- 真正的**全站背景自動同步**尚未實作：必須先讓所有寫入端具有可靠的變更通知／離線佇列及跨分頁資料保護，才能在使用者明確開啟後安全啟用。
- Firebase Web SDK 已固定至 12.19.0，該版本含 iOS Safari 登入儲存穩定性修補；仍須實機驗證。

## 新增：各學習頁面寫入事件與離線佇列（開發中）

- 共用 `cloud-sync/local-journal.js` 是**純本機中繼日誌**，記錄資料區名稱及一次性變更識別碼，**不儲存答卷、筆記內容、帳號密碼或 Google token**，也不包含 Firebase SDK／網路呼叫。
- 本輪先接上函授、v2.5 考古題、每日模擬題、英文 v0.4／v0.6，以及備考書桌 IndexedDB；只在模組寫入成功後記錄提示。**專業科目每日 30 分鐘練習程式及其版型受正式整合來源 SHA-256 檢查保護，已恢復原始檔案，不直接加掛寫入通知。** 尚未逐一涵蓋所有 15 類來源寫入路徑，例如週報收藏及其他設定項目，仍由備份中心的 SHA-256 掃描補足。
- 只有**已完成首次同步且登入狀態未主動登出**的帳號，才將待同步模組識別碼放在該 Firebase Project + UID 的本機 queue。訪客操作不額外留下任何雲端同步佇列資料。
- 佇列不同於真正的離線上傳任務：原始答案仍在 localStorage／IndexedDB。手動同步時會先對照雲端版本，預覽與兩份備份後才上傳。
- 預覽開始時保存佇列識別碼快照；**兩個資料區都成功同步後**，僅清除這次預覽之前且識別碼沒變過的項目。如果正在同步時另有一筆新作答，其新識別碼會留下；若中途失敗則不清除。
- 佇列屬**盡力通知**，在瀏覽器配額限制或多分頁極端競態下不保證原子性。完整的本機 SHA-256 掃描仍為主要判斷依據，因此不能以佇列為已上傳憑證。
- 目前**未開啟自動 Firebase 背景上傳**，待真實 Firestore、Google Auth 與行動 Safari 驗收後才可討論在使用者主動開啟自動同步的模式中安全送出佇列。

## 跨分頁併發保護：本機佇列 v2

- `cloud-sync/local-journal.js` 已由「所有分頁共用一份 JSON 清單」改成 **每個分頁／模組各自一筆 localStorage 標記**。因此兩個分頁同時儲存不同作答時，不會因共用清單的最後寫入者而遺失另一個分頁的變更通知。
- v2 佇列只儲存模組名稱和隨機變更 token；沒有個人答案、筆記內容及認證資料。即使本機佇列壞掉或超出瀏覽器儲存額度，原本資料仍留在 localStorage／IndexedDB，由 SHA-256 實際紀錄比對補救。
- 雲端合併預覽時保留每個分頁的 token；兩部分都成功才逐筆清理當時已確認的標記。同一分頁或其他分頁在預覽後新增的 token 不會因本次成功而清掉。
- 新增快速、無 Firebase 金鑰也無部署權限的 `Firebase sync contract (no deployment)` CI：執行離線佇列、版本衝突、帳號隔離及 JSON 備份回歸測試。
- **尚未完成全站背景自動上傳**。本機變更通知只是準備工作，必須在安全模型驗收與使用者明確授權後才可啟用實際雲端上傳。

## 離線與跨網域資源完整性

- 新增的 Firebase 公開 JavaScript／ES module 介面已加入 `offline-manifest.json`，包含備份中心 `firebase-ui.mjs`、Firebase 公開客戶端、同步比對核心、IndexedDB 工具及離線日誌。
- Cloudflare 隔離鏡像建置新增「僅允許 `cloud-sync/` 靜態 `.js`／`.mjs`」規則：允許公用前端模組，仍阻擋 `schema.sql`、內部測試及管理憑證。**這不是將私人作答或 Firebase 管理金鑰打包進網站。**
- Firebase CDN 需要連線才能首次下載並登入；沒有網路時仍能使用已備妥的本機學習及離線資源，**不宣稱離線狀態可以完成雲端同步**。
- 獨立 Firebase CI 另檢查離線資源、HTML 引用及 Cloudflare 鏡像一致性，防止新頁面參照部署站上找不到的 JavaScript。

## 3. Firebase Spark 測試專案（由帳號擁有人在 Firebase Console 操作）

1. 至 https://console.firebase.google.com 建立 **Spark** 免費專案。按畫面確認免費方案，不開啟 Blaze，也不綁卡；若跳出須付費的提示，先不要繼續。
2. 新增 Web app，從 Project settings 複製 `apiKey`、`projectId`、`authDomain`、`appId`。可填在**測試網站的完整學習紀錄備份頁**，但不要提供 serviceAccount JSON。
3. 到 **Authentication → Sign-in method** 啟用 **Google**。在 Auth 的授權網域加入實際使用的 GitHub Pages／Cloudflare 測試網址主機；Google 彈出登入可能因 iPhone Safari 阻擋，需要實機驗收。
4. 到 **Firestore Database** 建立測試資料庫，選擇鎖定的安全規則模式，**將本 repo 根目錄 `firestore.rules` 部署為有效安全規則**；勿採任何人都可讀寫的測試寬鬆規則。
5. 在測試分支的網頁進入「完整學習紀錄備份」，登入 → 預覽 15 類模組及書桌 → 匯出兩份 JSON → 確認合併。用**合成答案**驗證，第一輪不要拿真實私人資料直接試驗。
6. 第二部裝置用**同一 Firebase Project、同一 Google 帳號**登入；第一次在該網址同步仍須預覽並確認合併。完成合成資料驗證後才考慮實際資料。
7. Firestore Spark 免費配額非無限制；例如免費儲存 1 GiB、每日 50,000 次文件讀取、20,000 次寫入。**本專案目前沒有部署與實測產生的 Firestore 費用紀錄**。

## Firestore 權限測試：不需綁卡的本機模擬器

本輪新增 `firebase.emulator.json`、`verification/firebase-rules/run.cjs`、`verification/firebase-rules/package.json` 及 `.github/workflows/firebase-rules-emulator.yml`。GitHub Actions 使用 `demo-psd-rules` 本機專案 ID，**沒有實際 Google 帳號、私人案例資料、Firebase 管理金鑰或正式環境部署權限**。

模擬器會驗證：匿名帳號不能讀取、其他 UID 不得讀寫、使用者只能存取自己的 `modules`／`desk` 路徑、建立版本必須為 1、更新必須遞增 1、不能額外增加欄位、更新時間必須使用伺服器時間、不允許刪除、過大的文件會遭拒絕。

想在有 Node 與 Java 21 的電腦重跑：

```bash
npm --prefix verification/firebase-rules install --no-audit --no-fund
./verification/firebase-rules/node_modules/.bin/firebase emulators:exec \
  --only firestore --project demo-psd-rules \
  --config firebase.emulator.json --non-interactive \
  "node verification/firebase-rules/run.cjs"
```

**模擬器測試結果與真實 Firebase 驗收不同。** 通過模擬器只能證明在測試情境下權限規則符合預期；實際網域授權、iOS Safari Google 登入、Spark 配額與兩部裝置同步仍需另行驗收。

## 本輪補強：帳號切換防護及文件識別碼限制

- `cloud-sync/firebase-client.mjs` 將 Firestore 存取封裝為可用合成帳號測試的 `createUserScopedAdapter`。在讀取請求前後及寫入交易各階段檢查最新 Google UID，帳號被另一分頁登出／切換時不再繼續原操作。
- `verification/sync/firebase-client.test.mjs` 模擬跨帳號變更、交易讀取中登出、revision CAS、非法集合與非標準識別碼；不要求真正 Firebase 專案。
- Firestore Rules 建立文件時增加 `k~` 識別碼前綴限制，與前端 `encodeDocumentId()` 一致。模擬器另測試拒絕不合法的 `modules` 與 `desk` 文件 ID。
- **注意：只有文件 ID 前綴的初步格式限制；用戶端另有完整編碼驗證。** 真實 Firestore、Google OAuth、iPhone 與跨網域測試仍未完成，不把模擬器測試當作線上驗收。
- 這批提交目前未查得對應的 GitHub Actions 工作流程結果；應視為**已提交、待執行驗收**，而不是已通過。

## 4. 尚未完成的發布阻擋

- [ ] 真實 Firebase Auth + Firestore 雙裝置整合測試；Firestore Rules Emulator 自動測試已加入 CI，**通過狀態仍待最新工作流程確認**
- [ ] iPhone Safari／Mac 瀏覽器、GitHub Pages／Cloudflare 各網域登入及重新登入
- [ ] 多網域各自本機資料、跨帳號隔離與切換、離線回復、資料量過大、故障回復
- [ ] 15 類白名單外的模組與 sessionStorage 問題逐一盤點，決定是否需要新格式
- [ ] 核對前端可離線啟動、不影響舊備份功能；Firebase CDN 在無網路時不可使整個頁面失效
- [ ] 補齊其他模組的寫入事件；共用本機佇列已接主要模組，但**安全背景上傳仍未啟用**（目前須在備份中心手動確認）
- [ ] 比對 Firebase 免費額度和 Google 帳單設定；不宣稱 AI Pro 等於所有 Firebase 服務無限制免費
- [ ] PR CI、真實備份檔非空與可還原、測試用合成資料雙裝置
- [ ] 使用者批准後，才考慮合併主線及部署；正式站保留可回復版本

## 5. 回歸測試

```bash
npm --prefix verification/sync ci
npm --prefix verification/sync test
node backup/test.cjs
npm --prefix verification/sync run test:browser
```

新增測試：`verification/sync/firebase.test.mjs`、`verification/sync/firebase-desk.test.mjs`。測試使用模擬遠端比較及合成資料，不等同連上真實 Google 專案。

## 官方資料

- [Firebase Spark 定價](https://firebase.google.com/pricing)
- [Firestore 用量與限制](https://firebase.google.com/docs/firestore/quotas)
- [Firebase Web SDK CDN](https://firebase.google.com/docs/web/alt-setup)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Google redirect 在 Safari 的跨網域限制](https://firebase.google.com/docs/auth/web/redirect-best-practices)
