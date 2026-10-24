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