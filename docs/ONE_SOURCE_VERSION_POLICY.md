# 網站版本統一｜GitHub 為唯一程式來源（第一項工作）

狀態：**獨立 PR 待驗收**；不得將「鏡像預覽成功」誤稱為已替換正式網站。

## 使用者已確認的規則

- 使用 `LeoKYChen/probation-study-desk` 的 `main` 作為唯一正式程式來源。
- GitHub Pages 與 Cloudflare 若發布**同一套正式網站**，應來自**同一個 commit 的相同靜態檔案**，不可在 Cloudflare 上另行修改一套正式版。
- 先測試後更新正式站；既有學習資料、題目 ID、localStorage 鍵、備份格式和已上線網址一律不動。
- v2.7 法律 AI 暫停；Staresto v0.4 保留隱藏；342 題品質審查暫停。
- 本 PR **不**處理備份、PDF、離線作答、ZIP 練習等後續階段。

## 現況與差異

- GitHub Pages 正式站：`https://leokychen.github.io/probation-study-desk/`，來源為 `main`。
- Cloudflare 五入口統一首頁預覽：`https://home-preview-20261017.probation-study30-test.pages.dev/`，來源是獨立分支 `preview/116-study-home-20261017`。
- Cloudflare v2.5.4 30 分鐘練習驗收站：`https://v254-unified-preview.probation-study30-test.pages.dev/`，來源是獨立分支 `feature/study30-v254-unified-acceptance-1151016`，有 ZIP/補丁建置流程。
- 三者**目前並非同一份程式**。v2.5.4 對應的是另一個尚待納入正式整合決策的獨立練習介面，不能用舊版 `main` 直接蓋掉。

## 本次採取的安全做法

1. `scripts/build-cloudflare-main-mirror.py` 從 GitHub 已追蹤的正式網站靜態檔案複製出發布包；只複製站點資源，不複製內部實驗、工作流程、開發測試及重複的 `upload/` 資料夾。
2. 必須檢查專業科目、每日模擬、共同科目、少年司法週報、PWA 等必要頁面、題庫、JSON 都存在，並逐檔核對主要內容的 SHA-256。
3. `.github/workflows/preview-main-cloudflare-mirror.yml` 在 PR 中只做檢查，不執行 Cloudflare 部署；合併至 `main` 後，才隨 `main` 更新自動將相同檔案發布至 **獨立鏡像測試別名**：`https://github-main-mirror.probation-study30-test.pages.dev/`。
4. 上線後工作流程會檢查鏡像站首頁、專業科目、共同科目、每日題庫及週報 JSON 等檔案是否與 GitHub 同一版本逐位元組相同。
5. 原有 Cloudflare 五入口首頁和 v2.5.4 測試站的 URL、部署分支、專案設定**完全不改動**。正式 Cloudflare 切換必須在驗收完成並經使用者再次確認後另案處理。

### 如何辨認鏡像版本

開啟 `https://github-main-mirror.probation-study30-test.pages.dev/mirror-manifest.json`，其 `source_commit` 欄位顯示鏡像所對應的 GitHub SHA。主要網站檔案另以 `required_file_sha256` 對照。

此 JSON 僅為發布版本核對資訊，**不是學習紀錄的 JSON 備份**。

## 後續正式統一仍需做的事（尚未完成）

- 決定五入口首頁如何正式成為 `main` 版首頁，保留舊首頁仍有的快速選題功能或既有入口，不能直接無條件取代。
- 盤點並決定 v2.5.4 獨立學習站是否以整合後的功能納入 `main`，避免功能降級；正式站與測試站可以共存，但不得以測試站誤稱正式版。
- 實機核對 Cloudflare 鏡像與 GitHub 正式網站的題目、草稿、計時、匯出和導覽正常；測試網站來源的 localStorage 和 GitHub Pages **仍然不同**，不能以功能一致誤稱跨網域學習資料同步。
- 經使用者確認後，才討論正式 Cloudflare 網址改用同步部署、停止舊測試站或更換連結；不清除任何舊紀錄。

## 驗收與回復

- PR 檢查成功：只證明程式可建立鏡像發布包，不代表正式站已完成整合。
- 鏡像發布成功：證明該 Cloudflare **新測試網址** 與特定 GitHub commit 的核心檔案一致，不代表另一個 v2.5.4 測試站被更新。
- 正式切換之前，先確認備份及回復方法，保留當前 GitHub commit 和 Cloudflare 專用分支。
- 此 PR 不修改任何使用者資料或既有 URL；若預覽失敗，停止鏡像的 Actions 工作流程即可，不必改動原有正式站。

## 獨立整合驗收分支

五入口首頁與 v2.5.4 的整合方案、來源雜湊、測試及正式切換批准事項，見 [UNIFIED_HOME_V254_ACCEPTANCE.md](UNIFIED_HOME_V254_ACCEPTANCE.md)。main 鏡像基線全包 143 檔核對結果見 `MAIN_MIRROR_BYTE_AUDIT_20261017.json`。本分支尚未正式切換。
