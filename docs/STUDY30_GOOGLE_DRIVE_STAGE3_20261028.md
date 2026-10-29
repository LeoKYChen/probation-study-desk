# 第三階段：Google Drive 私人同步｜設定與驗收（2026-10-28）

## 目前狀態
**獨立開發／驗收中；尚未接上使用者的 Google OAuth，也未上線。**
本階段維持 localStorage 為本機編輯基礎。使用者主動授權後，會在 Google Drive「觀護人學習平台-私人同步備份」資料夾建立不可變 JSON 快照（檔名前綴 `psd-sync-v1-`）。手動完整 JSON 匯出／匯入仍可用，原本放在個人 Google Drive 的手動備份不會被自動修改或搬移。

## 使用者需自行設定 Google Cloud
1. 登入 [Google Cloud Console](https://console.cloud.google.com/)，建立或選擇自己的專案；啟用 **Google Drive API**。
2. 設定 OAuth 同意畫面、適用的測試使用者／發布狀態與必要權限（`https://www.googleapis.com/auth/drive.file`）。如 Google 要求應用程式驗證，依官方流程處理，不能跳過授權要求。
3. 建立 **OAuth 2.0 用戶端 ID → 網頁應用程式**（不是服務帳號，也不是 Client Secret）。在「已授權的 JavaScript 來源」加入實際站台**來源**，例如 `https://leokychen.github.io`；若使用另一個 Cloudflare 網址，要另列入該網址的 origin。不可加入 `/probation-study-desk` 等路徑。
4. 複製公開 **Client ID** 到學習平台的「Google Drive 私人自動同步」欄位。**不得貼 Client Secret、API 金鑰、密碼或存取權杖**。
5. 按「連線 Google Drive」，由 Google 視窗選擇希望持續使用的**同一個**私人帳號，檢查 `drive.file` 權限後授權。第一次同步會建立專用資料夾；後續裝置應使用**相同 OAuth Web Client ID、相同 Google 帳號、相同 Drive 資料夾**。
6. 按「立即安全同步」或勾選每5分鐘自動檢查。自動模式僅在**頁面開啟、前景可見、已連線且權杖有效**的情況下運作；Google 需要再次授權時必須手動操作。關閉網頁後不保證背景同步。

Google Identity Services 官方參考：
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
Google Drive API 官方參考：
- https://developers.google.com/workspace/drive/api/guides/create-file
- https://developers.google.com/workspace/drive/api/guides/manage-uploads

## 安全與版本承接
- 授權存取權杖只留在 JavaScript 記憶體，不放入 localStorage、不放入 JSON 快照、不寫進 GitHub；本機僅存公開 Client ID、同步開關、匿名裝置 ID 與已確認資料夾 ID。
- 使用 `drive.file` 最小範圍，Drive REST 僅呼叫官方 Google API；不使用共享 Google 帳號密碼，不建立公開分享連結。
- **不修改、覆蓋或自動刪除**任何舊雲端快照。每次需要上傳時建立新快照；下載遠端可辨識快照後，依 `backup/unified-core.js` 進行安全合併，不確定的不同申論答案保留在衝突歷史。
- 同步前先讀取完整雲端快照；如任何快照損壞、格式不正確、清單過量（1000筆）或權限不足，**停止同步**，不自動跳過疑似損壞版本。
- 本機寫入採匯入預覽後的原子檢查及失敗回復；遇另一分頁更新時停止覆蓋。
- 如果同一裝置改用了不同 Google 帳號或不同 OAuth 應用程式，且雲端資料夾 ID 改變，系統會阻擋同步以防資料分流。
- 不應把實際案件、少年個資、身分證字號、機密公文放入個人學習筆記同步；個人 Google Drive 不代表機關許可處理公務敏感資料。

## 使用情境與驗收
1. 手機上午07:30（初次授權）寫緊張理論，完成同步；公司電腦12:30使用相同 OAuth 專案及 Google 帳號，取得早上的申論草稿。
2. 公司電腦延伸原版本後上傳新快照；家中筆電20:00開啟並同步，顯示完整文字及自評。
3. 兩台裝置離線分別修改同一題：保留版本差異與衝突紀錄，不自動抹除其中任一份答案。
4. 網路中斷、OAuth 到期、損壞快照與不同 Google 帳號：本機練習不被清空，清楚顯示錯誤／待授權。
5. 新裝置的空白頁面不能覆蓋有內容的手機紀錄；重複同步不可持續製造相同衝突。
6. 手動下載的完整 JSON 與雲端快照中皆不可含 OAuth Access Token 或 Client Secret。

## 已知限制
- 純前端 OAuth 無法在關閉頁面後無提示地取得新權杖；Google 授權到期後需要使用者再次授權。
- 本版採用完整不可變快照、每次合併讀取所有可辨識快照，因此快照數量很大時效率會下降；未開發安全封存／壓縮，不自動清除歷史。
- 無中央伺服器來做同時寫入排序；多裝置同時修改同一答案時採衝突保留，而非保證自動合成唯一正確答案。
- 同日多次獨立計時的精準去重仍需後續資料結構改造；不直接相加兩裝置時間。
- Google Drive 同步資料夾是**新的平台專用資料夾**，不會自動匯入既有手動上傳 JSON；要先於「完整學習紀錄備份」匯入一次原始資料，再授權同步。

## 發布門檻
先通過純 JavaScript／CI 合成資料測試、Chromium／WebKit 網頁操作測試，再實測 Google OAuth、Google Drive API、iPhone／iPad Safari、PWA 離線及跨裝置權限。**測試完成前不合併 main、不部署正式站，不使用真實學習內容做公用測試。**
