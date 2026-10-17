# 五入口首頁與 v2.5.4 整合測試（第 1 項）

本分支僅供驗收，不授權合併 main、更新正式站或切換任何既有測試別名。

## 已驗證的基線

2026-10-17 核查：GitHub main 為 `e88ecf5a378db0a70aff98238ecd6da80a4b8ea3`。
PR #29 已合併；[Actions run 39021111891](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39021111891) 的建置、Cloudflare 部署及核心位元組核對成功。
部署日誌提供固定部署 `https://177a0bc8.probation-study30-test.pages.dev/`，別名 `https://github-main-mirror.probation-study30-test.pages.dev/`。

此回合另從別名讀取整個發布包：142 個網站靜態檔＋mirror-manifest.json，共 **143/143 逐位元組相同**。完整 SHA-256 與逐檔結果見 `MAIN_MIRROR_BYTE_AUDIT_20261017.json`。
這證明鏡像與指定 main commit 的發布包一致；不表示 Cloudflare 其他測試版與 main 相同，也不表示 GitHub Pages 的 CDN 回應已逐檔比對。

## 整合方案及來源

- 以 main 為基底的新分支：`test/unify-home-v254-20261017`。
- 五入口版面取自 `0c20885d34979217d0f1169c70cd29fd4faf05dd:previews/116-study-home/index.html`，保留倒數設定鍵 `psd-home-exam-countdown-v1`。
- v2.5.4 來源分支 commit：`40cf8256674817de7697e5cddcb1fd5617c77edf`。
- 為避免重建環境造成差異，實際匯入的是既有 v254-unified-preview 的 30 個公開發布檔案；原始 SHA-256、重建比對及整合後 SHA-256 記在 `V254_INTEGRATION_PROVENANCE.json`。
- 按原發布流程重建後，所有 JS、CSS、HTML、題庫及 manifest 與線上相同；192px 圖示和因圖示內容計算的 SW 版本不同。匯入時保留線上圖示，不用本機重建圖示替換它。
- 放入 `professional/`：426 題、原計時與科目切換、申論、自評統計、補練及 AI 評語邏輯不改。28/30 檔案與原站完全相同；`index.html` 只改站內導覽，`sw.js` 只隔離快取名稱並更新本次版本。
- 專業科目、共同科目、每日模擬及知識補給改用同站相對路徑；法律 AI 保留原獨立外部網址，不改其內容。
- 舊首頁逐位元組保留為同層的 `legacy-home.html`；原 `v2.5/`、`study30/`、其他模組及題目 ID 不改。
- v254 使用原鍵 `probation-study30-v251:v1`，既有 v2.5 使用原鍵 `probation-study-desk-v24`。未遷移、清空、改名或合併任何個人紀錄。不同 origin 的紀錄不會自動共享；測試使用全新瀏覽器環境的合成資料。
- 保留原版已存在的匯入、匯出、PWA 資產；本次沒有開發 JSON 跨裝置、PDF、離線、ZIP 離線或 v2.7 功能。

## 自動驗收

`node verification/unified-integration.cjs`：來源雜湊、426 題唯一 ID、與 main 題庫相同、五入口、原儲存鍵、完整靜態依賴。

`node verification/unified-browser.cjs`：Chromium 與 WebKit 在網站根目錄及 `/probation-study-desk/` 路徑進行測試，涵蓋 320/390/768/1440 寬度、倒數設定重開、四個站內入口新分頁、426 題載入、計時、步驟速記、完整申論與 AI 評語重開保存、舊 session 與其他儲存鍵保留、原首頁及 v2.5 仍可開啟。

`node verification/check-daily-v254.cjs`：原有每日模擬 125 題回歸。

新 workflow 會先測試同一發布包，再檢查 Cloudflare 專案 production branch 與新別名不同，僅在此測試分支 push 時部署 **全新** `unified-home-v254-20261017` 別名；PR 事件只驗證。沒有 main 部署或手動正式切換步驟。新別名發布後逐檔核對全包位元組並重跑瀏覽器驗收。測試執行結果以本 PR Checks 與 Actions 日誌為準；未通過不能稱作已驗收。

## 正式切換前仍需使用者核准

1. 確認新測試站的五入口外觀、專業練習與舊入口均符合使用需求。
2. 核准合併此 PR：因 main 是 GitHub Pages 正式來源，合併會使 GitHub 正式首頁更新；現有 main 鏡像工作流程也會同步更新其專用鏡像。**本回合不合併**。
3. 指定並核准 Cloudflare 正式網址及部署規則；本 PR 不改任何既有 Cloudflare 正式站或舊預覽。也不自動停用舊站。
4. 確認跨網址紀錄各自保存的限制，以及既有資料留存方式。原資料留在原 origin，本回合不作跨站搬移。
5. 已加入舊版 worker、實際舊快取下載與合成紀錄的更新測試；正式更新前仍由使用者在自己的裝置確認重開首頁與歷史答案。測試引擎不能代替實際 iPhone／Safari 主畫面 App 驗收。
6. 確認回復方案：保留基線 main SHA、舊首頁、現有 v254 與首頁測試站；若正式驗收失敗，回復程式部署，個人 localStorage 不清除。

未驗證範圍：使用者實際裝置與真實歷史資料、實際 Safari／iPhone 主畫面 App、GitHub Pages 線上整合版本（尚未合併）、正式 Cloudflare 切換。外部法律 AI、考選部、Shuati、Yamol 的服務行為不納入本次新功能驗收。


## 追加驗收：既有快取更新及 WebKit

問題已重現：原根目錄 worker 與 main 完全相同，首頁採既有快照優先；只換根目錄 HTML 無法使已有快取的使用者看到五入口首頁。

修正僅在 `sw.js` 將首頁的目錄路徑及 `index.html` 加入原有的線上優先清單。維持既有逾時與快取回退，不刪除 CacheStorage 或 localStorage，不增加離線下載功能；舊離線快照仍保留。更新 worker 完成後，重新開啟連線首頁可讀到整合版；這不是要求清除網站資料。

`verification/unified-pwa-upgrade.cjs` 使用可核對 SHA-256 的 main 舊版 worker fixture、逐位元組保留的舊首頁，以及既有下載流程建立實際舊快照（78 個資源）。以獨立持久化瀏覽器設定檔測試網站根目錄和 GitHub 專案子路徑，驗證更新後的五入口首頁、含查詢字串的 index 路徑、原儲存值完全保留、透過實際 worker 狀態檢查確認舊快照完整，並在模擬首頁伺服器故障時讀回完全相同的舊首頁位元組、根目錄與 professional worker 範圍共存，以及關閉瀏覽器後重新開啟仍保留紀錄。所有資料均為合成資料，從未存取使用者實際瀏覽器設定檔。

WebKit 的暫時瀏覽環境曾在 worker 替換後無法保留快取內容；改用符合已安裝情境的獨立持久化設定檔進行驗收，避免將暫時環境差異誤認為作答資料遺失。

一般 WebKit 驗收檢查複製指令的內容與成功／備援提示，不宣稱驗證 macOS／iPhone 的系統剪貼簿。Chromium 另驗證實際複製結果。CI 在兩個引擎都通過一般操作與舊快取更新測試後，才發布同一個獨立整合測試別名；發布後再跑兩引擎功能測試及全檔位元組比對。最終結果以本 PR 最新 Checks 為準。

WebKit 自動化切換斷線後重新載入受 worker 控制的頁面會回報引擎內部錯誤，因此不宣稱通過 WebKit 飛航模式重載；其線上升級與舊快取內容保留另作驗證。Chromium 保留既有快照斷線重載檢查。此限制不擴展本次為離線功能開發。

快取驗收以既有 worker 的狀態 API 檢查全部舊資源是否仍存在，並模擬首頁伺服器 503，要求瀏覽器從 worker 讀回與舊首頁完全相同的位元組；這比跨引擎直接從頁面讀取 worker 所建立的 CacheStorage 更貼近實際使用路徑。

CI 分工：macOS WebKit（Playwright 1.62.1，與本機已通過版本相同）執行一般操作、完整舊快取更新及瀏覽器重開；Linux 執行 Chromium 舊快取更新及 Chromium／WebKit 一般操作。macOS 工作是部署工作的必要前置，不是允許跳過的檢查。原 Linux WebKit 1.56.1 曾回報基線快照遺失，保留失敗 Actions 紀錄，不以該環境宣稱已通過已安裝 PWA 測試。發布後仍在兩引擎複驗一般功能。
