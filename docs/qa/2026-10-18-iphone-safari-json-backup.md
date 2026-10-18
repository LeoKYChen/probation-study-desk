# 第一階段｜iPhone Safari JSON 備份真機驗收紀錄

- 日期：2026-10-18（臺灣）
- 正式版基準：`main` `57055ee27e8698245fb39fc9b2a3212c15203af1`
- 證據性質：**使用者於對話中自行回報 4 項 iPhone Safari 真機檢查均通過**；非系統自動存取使用者裝置得知。
- 測試使用的正式站網域：**尚未指定**（不可推定 GitHub Pages、Cloudflare 兩站均經真機驗證）。
- 私人資料：未取得、未儲存亦未上傳任何實際 JSON 備份、作答或筆記。

## 真機匯出與檔案保存（4/4；使用者回報通過）
1. Safari 可開啟完整 JSON 備份頁並顯示資料摘要。
2. 可點選下載完整學習紀錄 JSON。
3. iPhone 檔案 App 可找到下載的 `.json`。
4. 檔案非 0 KB，可預覽或讀取。

## 已有自動化
- [隔離驗收 #39090933588](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39090933588)：`main` 備份程式之單元安全、Chromium / WebKit 合成資料下載、還原、衝突及重開均成功。
- 自動化僅用合成紀錄，不代表實體 iPhone 匯入已驗收。

## 尚未驗證
備份內容與各個真實資料鍵是否完整、iPhone Safari 的匯入／衝突檔下載與重開、Google Drive App 傳檔、實機 PWA 及飛航模式。

## 下一輪測試（正式站禁止使用假資料匯入）
- 獨立預覽站：<https://stage2-json-backup-preview.probation-study30-test.pages.dev/backup/>；若不可用即停止回報，不擅自轉正式站測試。
- 僅在沒有重要歷史資料的隔離 Safari 瀏覽環境執行；若有既有紀錄即停止。
- 匯入合成 JSON A（單日原稿），重開頁面確認保存。
- 匯入合成 JSON B（同日不同答案＋新一天），預期舊 A 保留、新日期加入、1 筆衝突進入可下載衝突版。
- 每次匯入前依畫面要求下載保護備份並確認；不分享任何個人資料。
- 實際使用者回報前，該項標記**待驗收**。

此紀錄只存於獨立 `audit/iphone-safari-json-20261018` 分支；**不得以文件提交表示批准合併或部署 production**。
