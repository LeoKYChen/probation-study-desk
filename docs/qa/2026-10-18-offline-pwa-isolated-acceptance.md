# 第一階段：離線與 PWA 自動化安全驗收（2026-10-18）

## 發布範圍與證據
- 正式程式基線：`main` SHA `57055ee27e8698245fb39fc9b2a3212c15203af1`。
- GitHub 獨立隔離測試分支：`test/phase1-offline-pwa-20261018`，只新增 `.github/workflows/stability-offline-pwa-qa-20261018.yml`，不改既有網頁、題庫或儲存邏輯。
- 測試 Workflow：[Actions #39093315744](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39093315744)，結論 `success`。
- 隔離 Cloudflare 測試入口：<https://qa-offline-20261018.probation-study30-test.pages.dev/offline/>，`qa-offline-20261018` 為非正式版測試分支別名。
- 已核對正式發布包 **197** 項檔案，和測試分支 Commit `355c936995c0b8ade057eb5ad2e871c7e5372ed3` 逐位元組一致。
- 本次只使用合成記錄／獨立 Chromium、WebKit 瀏覽器環境；未觸及個人學習資料。

## 自動化執行成果（皆通過）
1. `verification/offline-stage4-check.cjs`：共 **184** 個離線清單資源、依賴、JSON 及根目錄快取安全檢查通過。
2. Chromium：主網域根路徑與 `/probation-study-desk/` 子路徑，離線下載 **184** 項資源，切換真正離線網路狀態，考古題、國文作文作答並重新整理，答案仍在；其他學習／週報／備份／列印入口可開啟。
3. WebKit：下載 **184** 項資源，**以來源伺服器回 HTTP 503 模擬斷網**，檢查頁面開啟與答案保存通過。此項不宣稱實際 WebKit 飛航模式或 iPhone Safari 真機測試。
4. Cloudflare 隔離測試分支成功部署，**197** 項正式站靜態發布檔案與測試 Commit 完全相符。
5. Cloudflare 隔離測試站實際點擊下載離線資源 **184** 項，Chromium 斷網後仍能進入主動回憶、編寫作文並於重新整理後保留文字。

## 還未完成：iPhone Safari／PWA 人工驗收
- 必須先使用 Safari **一般瀏覽分頁**，開啟獨立 `qa-offline-20261018` 網域，下載離線資料並等候顯示「離線已備妥」。
- 再確實切斷 Wi-Fi 和行動網路，於同一 Safari 環境從快取打開國文作文，僅輸入假文字，確認重新整理後原文字仍在；恢復連線再查看。
- 上述成功後，再於同一隔離網站測試「加入主畫面」獨立 PWA；其儲存環境**不可預設**與 Safari 一般分頁共用，需單獨下載離線資料、單獨寫入合成測試文字、重開測試。
- 沒有使用者回報前，這兩項均為待驗收，不可列為通過。

## 安全限制
正式 Cloudflare <https://probation-study30-test.pages.dev/> 及 GitHub Pages <https://leokychen.github.io/probation-study-desk/> 未部署此 QA 分支；不可在正式站用假資料寫入。切勿清除 Safari 網站資料、原有主畫面學習臺、localStorage 或上傳真實資料。只有隔離 QA 網址可以使用假稿測試。
