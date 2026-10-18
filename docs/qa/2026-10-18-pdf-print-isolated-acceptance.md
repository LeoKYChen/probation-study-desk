# 第一階段｜PDF／A4 列印安全驗收（2026-10-18）

## 目的與界線
- 驗收對象：觀護人學習臺現有之 `print/` 申論答案列印及 PDF 匯出。
- 來源程式：`main` SHA `57055ee27e8698245fb39fc9b2a3212c15203af1`，列印模組未修改。
- 隔離測試分支：`test/phase1-print-pdf-20261018`；只額外新增測試 Workflow 及 `print/qa-fixture-20261018.html` 假作文初始化頁。
- GitHub Actions：[Run #39098518655](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39098518655) — **success**。
- 已部署隔離預覽網址：<https://qa-print-20261018.probation-study30-test.pages.dev/print/qa-fixture-20261018.html>。
- 198 個網站發布檔案均與該 QA 分支 Commit `70b2304f0476d53d91a6447e1cf8391c75e1c091` 逐位元組一致；正式版未部署、未修改。

## 自動化通過項目
1. 資料模型單元測試：專業科目、426 題、每日模擬題、國文作文四類已儲存紀錄；原題、草稿、AI 評語、修訂稿；壞資料與舊版缺題號兼容；列印唯讀、不改 `localStorage`。
2. Chromium 手機寬度根目錄：選題、產生預覽、A4 CSS、原生 PDF、原資料保留。
3. Chromium GitHub Pages 子目錄前綴：同上通過。
4. WebKit 手機寬度：多題預覽、列印視窗觸發、CSS A4 列印媒體、原資料保留；此項**不等於 iOS 原生 PDF 儲存**。
5. Cloudflare QA 網站 HTTPS 實測：在全新合成測試環境以專屬假作文入口產生 2 篇作文，再於列印中心選取 2 篇，驗證舊稿與評語顯示、隱藏評語、重新整理與原始紀錄不變（Chromium/WebKit 均通過）；Chromium 實際產出 PDF。

## iPhone Safari 真機待驗收
1. 使用 Safari 一般瀏覽模式開啟**隔離 QA** 假作文入口：<https://qa-print-20261018.probation-study30-test.pages.dev/print/qa-fixture-20261018.html>。
2. 點「建立兩篇純假作文」。若 QA 網站原本已有不同作文資料，會停止而不覆蓋。只有 QA 測試網站才允許建立假稿。
3. 點「前往 PDF 列印測試」，選擇「國文作文」，確認可列印 2 題，點「勾選目前清單」及「產生紙本預覽」。
4. 確認兩篇作文、中文標點／換行及第一篇的舊稿版本、測試評語均有顯示，文字清楚、無明顯截斷。
5. 取消勾選「包含 AI 評語／批改回饋」，確認測試評語不再顯示；再勾回。
6. 點「列印／儲存 PDF」。使用 iPhone 系統列印預覽中可用的「分享」或「儲存到檔案」流程，將 PDF 存至私人「檔案」App；如果選項不出現，回報而不強行執行。
7. 在「檔案」App 確認 PDF 檔非 0 KB、開啟後為兩篇假作文、排版可閱讀；返回測試站重新整理，仍可看到 2 筆作文（唯讀確認）。

## 尚待完成
- 真正的 iPhone Safari 原生 PDF 儲存與開啟，**目前未獲實機回報，不得標示通過**。
- 此 QA 測試未涵蓋 Mac 真機各版 PDF 驅動、所有 30 題邊界／超長作文分頁、中文字體列印差異。
- 本次安全驗收只在隔離測試站使用假資料，不取得任何私人學習紀錄。
- 正式版 `main` 維持 `57055ee27e8698245fb39fc9b2a3212c15203af1`；不擅自變更 Cloudflare 正式網址或 GitHub Pages。
