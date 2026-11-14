# 第二階段啟動：JSON 備份／還原／Google Drive 手動移轉 — 現況稽核

基準：`main` commit `c755f9274146cfd7eea8e6a6b4f86e8b2ac989e2`（PR #30、#31、#32 均已合併）。
此文件**僅為資料安全稽核，不包含正式程式變更或已完成的跨裝置同步**。

## 使用者確認之範圍及交付方式

- 要求能在手機／電腦手動下載 **JSON**，自行上傳私人 Google Drive；到另一裝置下載後於網站手動匯入。
- 網站**不接入 Google Drive API、不要求 Google 登入、不自動背景同步**。
- 以一份可下載的「完整學習紀錄 JSON」為目標，包含各模組使用者資料；資料只由目前 origin 的瀏覽器在本人操作下匯出，不能擅自讀取另一 origin。
- 匯入前顯示分類及筆數預覽；遇衝突不默默覆寫；匯入前需可保存本機快照；任何失敗不得造成半套匯入，並保留原檔。
- 不改題目 ID、不清除未知欄位、不重建已有答案、不改既有 storage keys，不上傳私人作答到 GitHub。
- 只做第二階段，不涉及 PDF 列印、離線、ZIP 離線、v2.7 法律 AI 或停用 Staresto v0.4 資料。

## 已查證的主要本機資料範圍

| 模組 | 現行資料鍵或格式 | 原有 JSON 支援 | 第二階段已知風險 |
|---|---|---|---|
| 整合 v2.5.4 專業練習 | `probation-study30-v251:v1`，`version:1,sessions:{date:...}` | 匯出包 `probation-study30-v252`、匯入接受 `probation-study30-v251–253`／raw v1；合併／完整還原 | 合併遇同日期**跳過備份版本**，不同裝置同日答案可能無法自動合併；完整還原會刪掉備份未含日期 |
| v2.5 考古題 | `probation-study-desk-v24`（加上同站其他既有版本鍵，須細查） | `probation-study-desk-backup` v4；另有 sync bundle | 同題可能有兩版答案；需保存衝突替代稿及未知欄位 |
| 每日模擬題 | `probation-daily-github:records:v1`；收藏 `daily-reading-test:saved`；進行中計時使用 sessionStorage | `v2.5/daily-practice.js` 匯出題目、收藏、計時；`daily-simulation/` 也可匯出／匯入 | 兩個頁面操作同鍵但各自匯入規則不同；全域備份需防止覆寫及遺漏收藏／計時 |
| 國文作文／舊原創英文 | `psd-common-subjects-v1` | 獨立 JSON 匯出／匯入 | **現有匯入會取代本模組全部資料**；132 題作文草稿／修訂版本不宜整包直接覆蓋 |
| Staresto v0.6 英文 | `psd-staresto-link-coach-v06` | JSON 匯出、`mergeBackup` 合併匯入 | 需保留單字複習、每日任務與已有成績的版本 |
| 已隱藏的 Staresto v0.4 | `psd-staresto-daily-v04` | 原頁面可 JSON 匯出／取代式匯入 | 隱藏入口不代表可以忽略歷史資料；若同 origin 存在仍應可備份，不能自動覆蓋 |
| 少年司法週報閱讀進度 | `jj-bookmarks`、`jj-read`、`jj-font` | 目前閱讀端依 React localStorage 實作，尚未查證通用 JSON 匯出介面 | 收藏及已讀應於新總備份保留；不能誤把靜態週報文章當個人紀錄 |
| 首頁考試倒數 | `psd-home-exam-countdown-v1` | localStorage 設定 | 使用者設定可選擇納入總備份；還原不影響作答 |

資料來源：`professional/backup-import.js`、`professional/app.js`、`v2.5/backup-core.js`、`v2.5/index.html`、`v2.5/daily-practice.js`、`daily-simulation/app.js`、`common-subjects/index.html`、`common-subjects/README.md`、`common-subjects/english-assistant/app.js`、`common-subjects/daily/app.js`、`juvenile-news/source/app/page.tsx`、`index.html`。

## 交付方案與最低驗收門檻

1. **資料鍵稽核**：列出本次備份包包含與不包含的所有鍵、校驗欄位、限制檔案大小、相容舊格式；同 origin 之外資料須由本人另行操作來源站匯出。
2. **完整匯出**：單檔 UTF-8 JSON，包含 schemaVersion、exportedAt、sourceOrigin、版本／模組清單及每模組原始使用者資料；避免隱式資料遷移、隱私資料傳輸及擅自省略。
3. **匯入預覽**：驗證格式、大小及內容後，顯示各科／各模組現有與備份資料量、新增與衝突量；未確認不寫入任何本機鍵。
4. **保留衝突**：預設保留已存在的完整資料；新裝置空白狀態可還原；同一題／同一日期有差異必須保留兩版本或提示分別匯入，**不可靜默覆蓋**。
5. **可恢復性**：匯入前提供完整目前資料的下載，並在寫入失敗時回滾；需測試未知欄位、缺失欄位、資料損壞、超大 JSON、部分舊版、不同題目 ID、重複匯入。
6. **跨裝置驗收**：以隔離合成資料測試 Mac、桌面 Chromium/WebKit、手機寬度及另一 origin 匯入；完整流程為 A 裝置寫答→下載 JSON→本機模擬放入私人雲端→B 裝置匯入→重開→再編輯→反向匯入後不遺失 A、B 任何答案。
7. **分離部署**：只在獨立測試分支開發、PR 自動測試通過後再提正式切換；本階段不更動正式網站直到另行核准。

## 安全注意事項

- GitHub Pages `leokychen.github.io` 與 Cloudflare `probation-study30-test.pages.dev` **不同 origin**：相同程式碼不是相同本機紀錄；只能手動搬移自己從各站取得的備份。
- 為避免資料競態，正式入口若開著未儲存的編輯器，總備份頁不能假設已寫到 localStorage；先要求使用者儲存，再做完整匯出。
- sessionStorage 的計時資料不應被誤稱在另一分頁可以一鍵備份；需要明示限制及另外設計匯出方式。
- 含個人筆記或 AI 回饋的 JSON 只能儲存於個人設備或**私人 Google Drive**，不得附到公開 GitHub issue、commit、PR 或公開分享連結。
- 此文件只有「開始第二階段並完成現況稽核」，尚無新備份中樞與跨裝置驗收結果。
