# 觀護人學習平臺｜穩定版凍結與安全整併計畫
> 2026-10-23 使用者確認。決策追蹤：[Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)；前次整理：[Issue #73](https://github.com/LeoKYChen/probation-study-desk/issues/73)。

## 0. 目前保留與回復基準

- 凍結時 `main` commit：`d46ea4b219e6c8cb4fb38627662b4c79a424a932`；已另立 `archive/stability-baseline-20261023` 指向相同 SHA。這是**公開程式碼快照**，不包含瀏覽器儲存的學習資料。
- 凍結不等於網站已正式發布新 Release，也不代表任何 PR 已完成合併、CI 綠燈或 Cloudflare 已同步。
- 使用者應另從各模組／備份中心**匯出並確認 JSON**。GitHub ZIP、Branch 或 Release 無法保存個人的 IndexedDB/localStorage 作答與批改紀錄。
- 不進行強制推送、不刪歷史分支、不重排原題 ID、不直接覆蓋正式站；此文件的合併應遵循 PR 與現有 CI。
- 公開 GitHub 不存放少年個案、機密卷證、API keys、含個資的 JSON 或第三方未獲授權內容。

## 1. 已核定的 A–N 功能決策

| 路線 | 處理 | 開發與資料政策 |
| --- | --- | --- |
| A 每日模擬題／晚間學習室 | **保留** | 保留現有練習、閱讀、計時、作答和備份；僅必要修復／題源查核 |
| B 雙 AI 批改整合 | **保留** | 保留外部雙 AI 交接、明確確認、待查回饋；禁止自動覆寫既有答案 |
| C 自訂 AI 批改提示詞 | **保留** | 保留既有設定、匯入匯出，不延伸新的 AI 平行服務 |
| D 少年司法週報 | **保留** | 週報內容可定期更新；仍以官方原始來源與日期、週報資料鏡像一致為準 |
| E 主動回憶 | **保留** | 保存 `active-recall/` 既有功能和題目紀錄 |
| F 116 年獨立專題題庫 | **暫停** | `dongdong-time/` 不新增資料；保留已收錄題目與既有紀錄 |
| G Staresto 英文整合 | **暫停** | 停止擴充、搬入題庫及新整合；既有頁面／資料不得刪除；#12、#38 為待封存開發提案，先審核第三方權利 |
| H 考科知識關聯圖 | **封存** | `knowledge-graph-preview/` 保留唯讀預覽與測試；不併入正式 v2.5；保留實驗提交 |
| I 完整重點整理與補強清單 | **維持隱藏** | `SHOW_FULL_NOTES=false`、`SHOW_REVIEW_LIST=false`，不得刪除原始內容或學習數據 |
| J v2.7 法律檢索與 MCP | **獨立專案** | 暫停在本站整合後端；先做資安／依賴／部署盤點，再決定專用 Repo 與遷移方式 |
| K 雲端學習紀錄同步 | **暫停** | `cloud-sync/` 保留供研究，但不啟用同步、登入、Supabase；維持 JSON 手動備份 |
| L 列印／PDF／離線 ZIP | **保留** | 保留已發布功能及 PWA、file 路徑相容；離線 URL 與必要資料檔不得因重複就刪除 |
| M JCIS 少年個案展示頁面 | **獨立專案** | `jcis-demo/` 擬另歸 `LeoKYChen/High-Risk`（已確認 Repo 存在）；先完成功能／授權／敏感資料審查及可回復複製，再決定本站保留導覽或移除 |
| N v2.6、舊介面與外觀改版 | **封存** | 暫停舊版分支及新的 UI 實驗，穩定介面與相容路徑保持；不影響現行 v2.5 必需資源 |

**唯一持續內容開發例外：** 警察特考 108–115 年官方原題收錄，沿用 [PR #71](https://github.com/LeoKYChen/probation-study-desk/pull/71) 的獨立分支。其題數和 AI／程式核對不是人工逐題通過的證明。官方原題／改編題應明確區分，來源 URL、原科目、年度、題號及核對層級都須可追溯，且維持既有 426 題原 ID 與所有既有作答／匯入匯出相容。

## 2. 封存與拆出前的版本保全清單

| 開發資產 | 已確認需保留的 Git Ref／SHA | 現階段處理 |
| --- | --- | --- |
| 穩定 main | `archive/stability-baseline-20261023` → `d46ea4b219e6c8cb4fb38627662b4c79a424a932` | **已建立安全分支，不動原 main** |
| 知識圖譜 H | `test/knowledge-graph-20261020` → `0ef35c4e6c40dae09927f311056cd60f68e1a2e9`；另有 `fix/graph-professional-subjects-only-20261020` | 保留兩條原始 branch 和 `knowledge-graph-preview/`，暫不合併 |
| 法律檢索 J | `experiment/v27-mcp-stage3v` → `526f06ca13cca86fec24e5726c7aacc036a65ac0`；`feature/v2.7-legal-search` → `1b2f8f660992a4c876c0de38df015cf4c6aad681` | 25 條 MCP 實驗分支暫不刪除；另案盤點後才搬移 |
| 外觀 v2.6 N | `feature/v2.6-integration` → `04f2d382dbe2e493d64768a26d1a52a29c8a2801`；其餘 design / release 歷史線 | 舊版先保留精確歷史，不進新 main |
| Staresto G | `feature/staresto-v06-phase1-quality-gate` → `43e4df192aefd9f616249f1d7edd3052d4111866`；`feature/staresto-external-only-20261018` → `e3873cbf4cd5ac2b94ff290152202516fcb303cf` | #12／#38 暫停，既有資料與連結不刪，第三方著作權須另查 |
| JCIS M | `main` 凍結基準含 `jcis-demo/`；擬用 `LeoKYChen/High-Risk` 承接 | **尚未搬移**；先核對 Repo 私有性、敏感資訊、URL／資料契約與權限 |

記錄 SHA 是為確保歷史可追溯；**不表示以上所有功能都已完整 QA，也不是機密資料備份**。未搬移完畢不得宣稱「已獨立」。

## 3. 順序化安全整併

### P0｜鎖定基準（已啟動）
1. 保存上述 baseline branch、此凍結文件與 A–N 機器可讀契約。
2. 新增**不部署**的 CI：重要路徑完整性、週報與題庫鏡像一致、隱藏旗標維持；改動封存／暫停區域只提示需要人工核對。
3. `main` 現有保護規則禁止刪除／force push；正式強制 PR／必要 CI 規則須在確認 Actions 名稱穩定後單獨審核。

### P1｜清理與修復
1. [PR #74](https://github.com/LeoKYChen/probation-study-desk/pull/74) 保持獨立：驗證先前重複副本清理、Cloudflare 靜態發布、雙 AI 必需檔、PWA、ZIP、Safari。若 CI 未全通過不得合併。
2. **不要用 #74 舊版本覆蓋更新後的 main**；本凍結 PR 不搬動題庫／周報／網站程式，只提供審核規則。
3. 已在 main 的現行核心功能一律做維修，不重新命名或搬動儲存路徑；有持續使用的舊路徑先保留 alias / redirect / 相容資料，需有測試才能移除。

### P2｜唯一進行中的警察特考原題
1. PR #71 維持 Draft；來源、題目原文／核對方法／附件圖片、穩定 ID、跨科原名和 426 題相容性逐項驗證。
2. #71 與 #74 可能同時修改離線 manifest 與 Cloudflare build script，應吸納**兩邊必要資產**、重新測試，不可整檔覆蓋。
3. 未核題不出現在「官方已核對」集合；CI 綠燈只代表程式驗證，非來源逐題人工驗證。

### P3｜暫停與封存
1. F／G／K 暫停新開發，不關閉既有站內功能、不刪資料；#12、#38 可在附上保全 SHA 與恢復說明後以「暫緩」理由關閉 PR，保留分支以供恢復。
2. H／N 保留相關分支／現有預覽程式及提交，停止實驗版主線整合；待穩定後再由明確新決策決定是否重新啟用。
3. J／M 先檢核敏感資料、授權、環境變數、歷史設定、後端契約與 Cloudflare Pages／GitHub Pages 相依，再**複製驗收**至獨立 Repo；未完成前不刪主線 `jcis-demo/`，不移除任何歷史存檔。
4. 對 100+ 舊分支先確認是否由 workflows、部署或未結 PR 引用；快照、tag／sha、CI 留存，再分批結案。禁止用分支名稱自行判斷「已合併」。

## 4. 穩定版驗收門檻與完成定義

- **功能**：主頁六入口、專業科目／v2.5／書桌、每日模擬、英文作文、函授、週報、主動回憶、列印、離線、雙 AI 交接可使用。
- **資料**：舊 426 題穩定 ID／所有歷史作答／筆記／批改／JSON 匯入匯出相容；真實使用者紀錄不進 CI，只用合成樣本；不自動清空 localStorage、IndexedDB。
- **題庫品質**：逐題來源核對分級、不得捏造官方原題或標準評分、原題與改編分開。
- **發布**：分別驗收 GitHub Pages、Cloudflare 及 Chromium、WebKit／手機版、ZIP／PWA 離線、正式 URL；任何 cancelled/skipped 不能算通過。
- **還原**：確認 main 的 commit SHA、Cloudflare 既有部署回復方法、JSON 匯出；出錯以新的 revert PR 回復，不 force-reset main。
- **變更管理**：新增功能須先修改本決策 Issue 並經明確核准；其餘只允許安全維護、來源修正、固定週報與警察原題增補。

### 自動化契約
- `docs/stability-freeze-policy.json` 為 A–N 決策與必要資源清單。
- `python3 scripts/check-stability-contract.py` 驗證必要路徑／鏡像／隱藏狀態；`--base <commit>` 額外列出暫停與封存區域改動供人工審核，**不自動刪檔或部署**。
- `.github/workflows/stability-freeze-contract.yml` 為非部署型 PR／main 驗證工作，並執行既有 `verification/unified-integration.cjs`；仍需其他 CI 完整驗收。
