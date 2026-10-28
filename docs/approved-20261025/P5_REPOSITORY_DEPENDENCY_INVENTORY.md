# P5｜儲存庫及 GitHub Actions 唯讀盤點（禁止刪檔）

- 追蹤 #91；基準 `main a89f58cfe6271a642c29f5dfce7e4ea6fc32d9d7`。
- 透過 GitHub Repository Tree API 盤點 `git/trees/main?recursive=1`：**496 個樹節點**（包括檔案與資料夾）；工作流程 `.github/workflows/` 共 **32 個 .yml**。上述為本次 API 快照，並非未來不變總數。
- 此工作包**僅盤點，不刪檔、不搬資料夾、不停用 Actions、不變更部署**。分類未完成引用追蹤者均標待查。

## 初步依賴風險矩陣

| 資產 | 已知用途／證據 | 分類與理由 | 後續必查項目 |
|---|---|---|---|
| `index.html` | 正式首頁，有六卡入口、書桌與備份連結 | **必留** | Pages／Cloudflare／手機可用性 |
| `study-desk/`、`backup/` | 獨立 IndexedDB 與 localStorage 備份流程 | **必留** | 備份與還原驗收 |
| `professional/`、`v2.5/` | 舊作答路徑與原有資料鍵；題庫數不同 | **必留** | 426／553 題 ID 及舊紀錄 |
| `upload/`（含子模組 HTML、離線資產） | 已列入 A–N 的 N 封存範圍，不能推定無用 | **封存保護／不得直接刪** | 歷史網址、Actions、原始 PR／回復指標 |
| `index (1).html` | 根目錄多餘名稱的 HTML 存在 | **待查** | 搜尋正式腳本、舊網址與歷史版本引用；找不到引用不等於可立即刪 |
| 根目錄 `index-DWXubpQf.js`、`index-JfbeKn1C.css` | 命名類似打包資產；`offline-manifest.json` 包含同名資產的 **juvenile-news/assets/** 路徑，非直接證明根目錄同名檔可刪 | **待查** | 逐路徑與 checksum 核對、Vite 輸出與 Service Worker |
| `file-data/*.generated.js` | 離線 ZIP 的 JSON 對應 JS，由 `scripts/generate-file-data.cjs` 建立；workflow `stage5-generate-file-data.yml` 會檢查及提交 | **必留** | 離線 `file://` 全部功能 |
| `offline-manifest.json`、`sw.js` | Service Worker 會載入 `offline-manifest.json`；與快取檔案一致性有關 | **必留** | 與每次發版 SHA／部署根目錄一致 |
| `package.json` | `name=juvenile-justice-weekly`；React／Vite 建置仍與少年司法週報有關 | **保留，命名整理非急件** | 改名對工具與部署環境的實際影響 |
| `knowledge-graph-preview/` | A–N H 已封存、既有實驗程式與測試保留 | **封存／不得重新整合** | 恢復時另請核定 |

## Actions 分類（依檔名與部分 YAML 讀取，非完成依賴圖）

| 類別 | 代表 workflow | 目前處理 |
|---|---|---|
| 正式發布／部署 | `sync-cloudflare-production.yml`、`publish-release-v2026-10-0-once.yml` | 不停用；另核查手動核准及特定 trigger |
| 預覽／鏡像 | `preview-main-cloudflare-mirror.yml`、`preview-layout-review.yml`、`preview-unified-home-v254.yml` | 保留，逐項核對使用中的預覽需求 |
| 非部署穩定性驗證 | `stability-freeze-contract.yml` | 保留，維持 10/23 A–N 契約 |
| 書桌／備份 | `check-study-desk-sync.yml`、`stage2-json-backup-preview.yml` | 保留，P1 回歸檢查 |
| 官方題源／題庫 | `police-browser-acceptance.yml`、`police-originals-audit.yml` | 保留，32 卷真人校稿仍需人工補充 |
| 少年司法週報／排程 | `juvenile-weekly-release.yml`、`daily-monthly-review-mirror.yml` | 保留，依內容更新來源驗收 |
| 離線／ZIP／列印 | `stage5-generate-file-data.yml`、`stage5-source-zip-test.yml`、`stage4-offline-preview.yml`、`stage3-print-preview.yml` | 保留，改動前必須驗證相容 |
| 舊版單次 promote 工作 | `promote-114-three-questions.yml`、`promote-115-police-originals.yml` 等 | **可能封存候選，但尚未核定；不得刪除** |

## 下一步的真正清理門檻

1. 對每個候選檔案取得 `git grep` 等價引用清單、Actions YAML 引用與部署網址／Service Worker 影響；必要時檢查歷史發版。
2. 擷取實際 hash、回復 commit、已合併／未合併 PR 狀態；跨部署網域查驗輸出檔。
3. 先提出獨立「候選清理 PR」供另行核定，**本次只提出稽核資料，不執行任何刪除或停用**。
4. GitHub Pages 和 Cloudflare deployment SHA 不得由 README 或最後一次 Actions 綠燈直接推定完整一致。

**本輪結論**：已實證 32 個 workflow、存在 `upload/` 和可疑根目錄檔案、Vite 命名仍舊、離線打包檔受維護；尚無任何一個目標檔具備完整刪除證據，因此**可直接刪除清單為空**。

## 2026-10-25 接續：逐份工作流程與具體引用收據

本輪靜態快照為 `76e7af4a086ce8b749e78dc8d9032f84df22646a`（原 P5 PR 提交，父提交 `a89f58cfe6271a642c29f5dfce7e4ea6fc32d9d7`），共 **426個追蹤檔案／498個含目錄節點／32份 YAML**。上方496節點是當時 main 快照，包含 P5 新文件及目錄後數字不同，不能直接當成新增或遺失資產。PR 所見 base SHA `88416e6c135f19221ad68f8563eb81fab95035de` 比父提交多了每日模擬資料與離線橋接的更新；本輪不覆蓋或吸納那些檔案。

[靜態收據](P5_STATIC_DEPENDENCY_RECEIPTS.json) 記錄每份 YAML 的觸發事件／分支／路徑限制、權限、外部 Actions 版本、可見寫入步驟與 if 條件、字面檔案引用及行號。使用 Ruby Psych 安全解析，未執行任何 workflow、建置／生成腳本或發布程序。下表「未見」只限 YAML 內直接命令，不代表被呼叫腳本無副作用，也不是完整動態依賴圖。

| Workflow | 觸發事件（詳細限制見收據） | 檔案字面引用行項 | YAML 中可見遠端寫入／發布 |
|---|---|---|---|
| `check-common-subjects.yml` | push, pull_request, workflow_dispatch | 14 | 未見直接遠端寫入命令 |
| `check-staresto-link-coach.yml` | pull_request, push | 5 | 未見直接遠端寫入命令 |
| `check-staresto-v05-catalog.yml` | push, pull_request, workflow_dispatch | 3 | 未見直接遠端寫入命令 |
| `check-study-desk-sync.yml` | pull_request, workflow_dispatch | 1 | 未見直接遠端寫入命令 |
| `check-v254-daily.yml` | pull_request, push, workflow_dispatch | 26 | 未見直接遠端寫入命令 |
| `cloudflare-production-preflight.yml` | workflow_dispatch | 2 | 未見直接遠端寫入命令 |
| `daily-monthly-review-mirror.yml` | push, workflow_dispatch | 7 | 推送至 feat/daily-pending-monthly-review-20261020 |
| `dual-ai-handoff.yml` | push, pull_request | 20 | 未見直接遠端寫入命令 |
| `juvenile-weekly-release.yml` | push, pull_request, workflow_dispatch | 27 | 推送至 main |
| `knowledge-graph-preview.yml` | push, pull_request, workflow_dispatch | 27 | 未見直接遠端寫入命令 |
| `lecture-planner-preview.yml` | push, pull_request, workflow_dispatch | 13 | Cloudflare lecture-planner-preview |
| `lecture-planner-tests.yml` | push, pull_request | 6 | 未見直接遠端寫入命令 |
| `mobile-rwd-preview.yml` | push, pull_request, workflow_dispatch | 24 | Cloudflare mobile-rwd-preview |
| `police-browser-acceptance.yml` | workflow_dispatch, push | 26 | 未見直接遠端寫入命令 |
| `police-originals-audit.yml` | workflow_dispatch, push | 9 | 未見直接遠端寫入命令 |
| `preview-layout-review.yml` | push, pull_request | 14 | Cloudflare layout-review-20261017 |
| `preview-main-cloudflare-mirror.yml` | push, pull_request, workflow_dispatch | 7 | Cloudflare github-main-mirror |
| `preview-unified-home-v254.yml` | push, pull_request | 26 | Cloudflare unified-home-v254-20261017 |
| `promote-114-three-questions.yml` | workflow_dispatch | 3 | 未見直接遠端寫入命令 |
| `promote-115-police-originals.yml` | workflow_dispatch | 3 | 未見直接遠端寫入命令 |
| `promote-clean-police-originals.yml` | workflow_dispatch | 3 | 未見直接遠端寫入命令 |
| `promote-pdf-visual-originals.yml` | push, workflow_dispatch | 10 | 推送至 feat/police-past-papers-108-115-originals |
| `publish-release-v2026-10-0-once.yml` | push | 2 | 建立釘選 GitHub Release |
| `stability-freeze-contract.yml` | pull_request, push, workflow_dispatch | 3 | 未見直接遠端寫入命令 |
| `stage2-json-backup-preview.yml` | push, pull_request, workflow_dispatch | 26 | Cloudflare stage2-json-backup-preview |
| `stage3-print-preview.yml` | pull_request, push, workflow_dispatch | 37 | Cloudflare stage3-a4-print-preview |
| `stage4-offline-live-diagnostic.yml` | pull_request, workflow_dispatch | 7 | 未見直接遠端寫入命令 |
| `stage4-offline-preview.yml` | pull_request, push, workflow_dispatch | 45 | Cloudflare stage4-offline-preview |
| `stage5-generate-file-data.yml` | push, workflow_dispatch | 10 | 推送至 feature/stage5-file-zip-offline-20261018 |
| `stage5-source-zip-test.yml` | push, pull_request, workflow_dispatch | 41 | 未見直接遠端寫入命令 |
| `study-desk-weakness.yml` | push, pull_request | 5 | 未見直接遠端寫入命令 |
| `sync-cloudflare-production.yml` | push, workflow_dispatch, pull_request | 26 | Cloudflare main |

### 需要保留的寫入與發布界線

- `sync-cloudflare-production.yml` 的正式發布步驟受 `workflow_dispatch`、`refs/heads/main` 與 `confirm_release == RELEASE` 保護；PR 驗證是另一個 job。這是 YAML 靜態證據，不等於實際網站部署 SHA 已驗證。
- `juvenile-weekly-release.yml` 有條件推送週報鏡像到 main；其 synchronize job 限 push／手動且 main。這是現有依賴，本輪未執行、未修改。
- `daily-monthly-review-mirror.yml`、`stage5-generate-file-data.yml`、`promote-pdf-visual-originals.yml` 仍可能寫入指定舊分支，不能只因舊名稱判定可停用；手動觸發也須檢查 checkout 與固定推送目標。
- `promote-114-three-questions.yml`、`promote-115-police-originals.yml`、`promote-clean-police-originals.yml` 現有 YAML 已是 **手動／唯讀127題檢查閘門**。修正上方僅依名稱推定的「可能封存」分類，不是本輪停用或改寫它們。
- 既有預覽發布各有指定分支或條件；P2／P3 原分支不符合這些發布條件。本輪不新增 Actions，不手動觸發預覽或正式部署。第三方平台的 Git 自動建置設定仍待外部唯讀確認。

### 可疑檔案實證與限制

- `index (1).html` 的全文檔名在其他追蹤文字中未找到字面引用；它仍引用 `./main.tsx` 與 `./favicon.svg`。這不足以排除歷史網址或外部書籤，本次不刪。
- 根目錄 JS 與 `juvenile-news/assets/index-DWXubpQf.js` 的 SHA256 同為 `ffe49aea778f60da3c4f5bed1595b8544041539396a773e2eebb79ee2e79a4c2`；CSS 對應檔同為 `b239cbd05f76db54940db4ea91b65c80c32145ecee05cedefb1180b7ff763c3a`。相同內容只證明當前位元組相等，不能授權刪除任一路徑。
- 相同檔名的字面搜尋會命中 `./assets/`、`juvenile-news/assets/`、歷史稽核文件；收據另列 HTML 相對網址解析結果，**不把它誤記為根目錄引用**。`upload/juvenile-news/index.html` 的相對資產屬封存副本，也不能搬走。
- `offline-manifest.json` 指向少年週報資產目錄；`sw.js` 與離線資料橋接有多份腳本及測試引用，繼續保留。
- `scripts/build-cloudflare-main-mirror.py` 採允許清單：根目錄可疑HTML／打包檔與 `previews/` 不在此鏡像清單。此為程式閱讀結果，沒有執行 build（其中含清除舊輸出目錄操作）。GitHub Pages、離線 ZIP 和 Cloudflare 的發布集合不能因此視為完全相同。

### 待人工／外部驗證

- [ ] 查 GitHub Pages 與 Cloudflare 現行建置來源、實際部署 SHA、使用中的自動部署設定。
- [ ] 查外部書籤、歷史 Release／ZIP 和舊分支／未合併 PR，補候選路徑的保全與回復點。
- [ ] 對 YAML 呼叫腳本的動態路徑、套件腳本與生成資產做第二層追蹤；不能把字面引用收據當成完整依賴圖。
- [ ] 任何未來刪檔、停用工作流程或移動路徑必須另提核定；本輪允許直接刪除的清單仍為空。
