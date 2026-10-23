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

**曾經確認過雲端同步的帳號**：當使用者再次打開「完整學習紀錄備份」，才試著恢復 Firebase 登入狀態；不會因為登入已恢復就自動上傳任何學習資料。未選擇同步的訪客不會主動載入 Firebase SDK。

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

## 3. Firebase Spark 測試專案（由帳號擁有人在 Firebase Console 操作）

1. 至 https://console.firebase.google.com 建立 **Spark** 免費專案。按畫面確認免費方案，不開啟 Blaze，也不綁卡；若跳出須付費的提示，先不要繼續。
2. 新增 Web app，從 Project settings 複製 `apiKey`、`projectId`、`authDomain`、`appId`。可填在**測試網站的完整學習紀錄備份頁**，但不要提供 serviceAccount JSON。
3. 到 **Authentication → Sign-in method** 啟用 **Google**。在 Auth 的授權網域加入實際使用的 GitHub Pages／Cloudflare 測試網址主機；Google 彈出登入可能因 iPhone Safari 阻擋，需要實機驗收。
4. 到 **Firestore Database** 建立測試資料庫，選擇鎖定的安全規則模式，**將本 repo 根目錄 `firestore.rules` 部署為有效安全規則**；勿採任何人都可讀寫的測試寬鬆規則。
5. 在測試分支的網頁進入「完整學習紀錄備份」，登入 → 預覽 15 類模組及書桌 → 匯出兩份 JSON → 確認合併。用**合成答案**驗證，第一輪不要拿真實私人資料直接試驗。
6. 第二部裝置用**同一 Firebase Project、同一 Google 帳號**登入；第一次在該網址同步仍須預覽並確認合併。完成合成資料驗證後才考慮實際資料。
7. Firestore Spark 免費配額非無限制；例如免費儲存 1 GiB、每日 50,000 次文件讀取、20,000 次寫入。**本專案目前沒有部署與實測產生的 Firestore 費用紀錄**。

## 4. 尚未完成的發布阻擋

- [ ] 真實 Firebase Auth + Firestore 雙裝置整合測試及 Firestore Rules Emulator 權限拒絕測試
- [ ] iPhone Safari／Mac 瀏覽器、GitHub Pages／Cloudflare 各網域登入及重新登入
- [ ] 多網域各自本機資料、跨帳號隔離與切換、離線回復、資料量過大、故障回復
- [ ] 15 類白名單外的模組與 sessionStorage 問題逐一盤點，決定是否需要新格式
- [ ] 核對前端可離線啟動、不影響舊備份功能；Firebase CDN 在無網路時不可使整個頁面失效
- [ ] 各學習模組自動偵測寫入及安全背景同步（目前須在備份中心手動確認）
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
