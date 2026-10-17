# 第五階段：原始 GitHub Download ZIP，解壓後雙擊根目錄 index.html

**目標與交付是同一份 GitHub 專案，不再維護另一套 portable 練習站。** 此 PR 只驗收原始專案的 `file://` 相容能力；必須通過實機驗收、取得核准才會合併正式分支。

## 下載方法

在 [GitHub 原始碼](https://github.com/LeoKYChen/probation-study-desk) 選擇此 PR 測試分支 **feature/stage5-file-zip-offline-20261018**，再點選 Code → Download ZIP。解壓後直接雙擊**解壓資料夾根目錄** `index.html`，不用 localhost、本機伺服器或網路。使用時請勿把 `file-data/`、`file-compat.js` 等檔案從資料夾移開。

正式發布後，一般 GitHub `main` 的 Code → Download ZIP 才會包含此功能；目前 main 不變。

## 同一套網站，兩種啟動方式

| 功能 | GitHub Pages / Cloudflare HTTPS | GitHub ZIP file:// |
|---|---|---|
| 原首頁及五大入口 | 原本 UI | 保留同一套 HTML，資料夾連結自動轉向 index.html |
| 專業科目 30 分鐘 | 原樣 | 原題與原作答介面，無伺服器 |
| 426 題考古題及複習 | 原樣 | 同一份正式原題 JS，保留原有作答欄 |
| 每日模擬題（以最新原始 JSON 題數為準，目前 132 題） | fetch 原始 questions.json | 從原 JSON 自動產生的本機 JS 提供同樣資料 |
| 國文作文及英文 | 原樣 | 主要介面仍是原版，原 JSON 轉為本機 JS 提供離線讀取 |
| 少年司法週報 | 原本 React/Vite UI | 因 ES module 無法保證在 file:// 運作，切換同一份 issues.json 的唯讀週報介面 |
| 第二階段完整 JSON 備份 | 原樣 | 原備份頁可開，但不同瀏覽器可能使 file:// 分頁儲存區隔離；請優先從各作答頁匯出獨立 JSON |
| 原本雲端 AI | 線上可用 | 明示需要網路並攔截跳轉，不假裝離線可用 |
| Service Worker / PWA | HTTPS 仍維持原有流程 | 不需要／無法在 file:// 安裝 |

## 來源唯一性與更新

正本題庫永遠是：`daily-simulation/*.json`、`common-subjects/daily/*.json`、`common-subjects/catalog/data/**/*.json`、`juvenile-news/issues.json`。`scripts/generate-file-data.cjs` 會將上述 JSON 自動轉為 `file-data/*.generated.js`。這是**機器自動生成的同一份內容**，不得手工維護第二份題庫；CI 的 `--check` 會拒絕原檔與 ZIP 資料不同步。

HTTPS 使用者只載入很小的 `file-compat.js`，其中以 `location.protocol!=='file:'` 立即結束，不更動既有 fetch、題庫、localStorage 或 URL 行為。檔案模式才利用腳本橋接 JSON 的 `fetch` 與目錄連結。生成的較大資料 JS **只會在 file:// 有條件載入**，線上正式站不會額外下載這些資料複本。

## 必須遵守的紀錄保護

`file://` 下 `localStorage` 是否可讀寫、各個 HTML 是否共用同一來源，**依瀏覽器版本與安全設定而不同，規格不保證穩定**。即使答案重新整理後仍在，也不代表搬動資料夾、更新系統或切換瀏覽器後能保留。每次練習後請**從原作答頁面匯出 JSON，另外存至個人資料夾**；不要只相信瀏覽器的自動儲存。如果換電腦，依各原模組的匯入流程還原，切勿直接覆寫其他模組的資料。

避免將機密個案、可辨識少年個資、未經授權的公務內容放入學習檔。離線法律、研究及新聞內容不會更新，適用時仍須至官方來源核對。

## 核心驗收（獨立測試分支）

1. GitHub 工作流程利用 `git archive HEAD` 產生**同一份原始碼** ZIP，解壓縮後直接以 `file:///.../index.html` 打開，沒有測試伺服器。
2. Chromium 關閉網路，WebKit 阻止所有 HTTP(S)；測試原首頁五個入口、專業科目、考古題作答重新整理仍存在、共同科目作文重新整理、每日模擬題（以最新原始 JSON 題數為準，目前 132 題）、歷史週報 11 期、原英文每日子頁、Staresto 題庫索引、原備份頁，以及雲端 AI 離線提示。
3. 所有 generated JS 由原始 JSON 重建後比對，不能有來源分歧。
4. 保留原有保護版面 SHA-256、前三／四階段的驗收與正式發布保護。

**未完全等價處：** 少年週報的 file:// 閱讀介面不同於線上 React 版；雲端 AI／任何第三方外部網站都無法完全無網操作；跨檔案的 localStorage 共享及真實 macOS/iPhone Safari 個人紀錄，需要使用者在本機測試。
