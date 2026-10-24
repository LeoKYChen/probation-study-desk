# 穩定版發布前驗收紀錄｜2026-10-23

> 追蹤：[穩定版 PR #78](https://github.com/LeoKYChen/probation-study-desk/pull/78) 與 [凍結 Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)。
> **歷史文件提示：** 下文多數內容是 2026-10-23 正式發布前的快照。`v2026.10.0` 已於當日建立 [GitHub Release](https://github.com/LeoKYChen/probation-study-desk/releases/tag/v2026.10.0)（固定 SHA `b924bd6e2ef12c18275e4fbf446e5ca1f7f643d1`）；請優先閱讀以下 2026-10-24 新驗收紀錄。舊檢核清單保留作歷史證據，不應再讀成當前發版狀態。

## 2026-10-24｜v2026.10.0 發布後使用者 iPhone 驗收更新

2026-10-24，使用者回報以下五項 iPhone 實機操作**全部通過**：

1. 首頁與選單正常；
2. 備考書桌可選題、儲存答案；
3. 考古題可顯示、練習；
4. 雙 AI 交接正常；
5. 少年司法週報可閱讀。

**驗收等級：使用者回報通過（5/5），非獨立完整 E2E 驗收。** 使用者尚未提供測試網站 URL、瀏覽器／iOS 版本、部署 SHA；2026-10-24 `main` 已有新的程式提交，不能因此斷言實測的是固定 `v2026.10.0` 的位元組版本。

詳情及未完成的 JSON 匯出還原、桌面／Safari、離線／列印、雙 AI 回傳防護、32 份官方原卷人工校對及雙網域部署核對，見 [本次驗收詳表](acceptance/v2026.10.0-iphone-2026-10-24.md)與 [Issue #72](https://github.com/LeoKYChen/probation-study-desk/issues/72)。**不將舊版「iPhone Safari 與電腦全功能」整項改標為通過**，維持剩餘待辦。

---

### 以下為 2026-10-23 發布前歷史紀錄

## 2026-10-23 最新狀態更新（後續於本文歷史快照）

> **本節優先於下方 PR 尚未合併的歷史敘述。** 舊驗收紀錄依原日期保留，不能直接拿舊版候選 SHA 的成功紀錄當作新主分支已驗收。

| 項目 | 目前可核實狀態 | 待補證據 |
| --- | --- | --- |
| 目前 `main` | 截至本次盤點，最新程式提交 [`a9191d342bca04b15a4237645d7533856078eb22`](https://github.com/LeoKYChen/probation-study-desk/commit/a9191d342bca04b15a4237645d7533856078eb22) | 正式發版前再次鎖定當時 `main` 的最新 SHA |
| A–N 功能凍結 | [PR #78](https://github.com/LeoKYChen/probation-study-desk/pull/78) 已合併；保留主要功能、停開新功能、保留歷史回復基準 | 實際手機與正式網址驗收 |
| 警察特考原題 | [PR #71](https://github.com/LeoKYChen/probation-study-desk/pull/71) 已合併；原 426 題不覆蓋，新增 127 題，v2.5／書桌合計 553 題 | [32 卷仍待人工校稿](../police-exams/reviews/OFFICIAL_32_PAPER_CHECKLIST.md)，不能宣稱全部人工驗證 |
| Cloudflare 部署 | [`sync-cloudflare-production.yml`](../.github/workflows/sync-cloudflare-production.yml) 已在 `main` 設定正式發布僅手動 `workflow_dispatch`＋`RELEASE` | 需確認 Actions 最新作業結果、正式 deployment SHA 與 rollback 對應 |
| GitHub Pages／Cloudflare | 沒有經本次直接現網核對可證明兩站完全一致的資料 | 以各站實際網址與 Actions／Cloudflare 控制臺分別驗證 |
| CI | 目前讀取最新 SHA 的 PR workflow runs 與 combined statuses 未回傳可用檢查結果；**不能據此推定成功或失敗** | 需至 [Actions](https://github.com/LeoKYChen/probation-study-desk/actions) 逐項核查最新 SHA 的執行紀錄 |
| GitHub Tag／Release | 目前無可靠清單可證實目標名稱未使用，且本次**未**建立 Tag 或 Release | 發版前開啟 [Tags](https://github.com/LeoKYChen/probation-study-desk/tags) 與 [Releases](https://github.com/LeoKYChen/probation-study-desk/releases) 人工比對 |

### 維護階段的發版決策

主要功能已進入**凍結與穩定維護階段**；可以準備版本說明，但**不應因程式功能大致完成就跳過發版門檻**。現階段僅執行必要修復、既有新聞更新與題源覆核，不重新啟用已暫停的雲端同步／實驗介面。

**尚未完成的發版必要關卡：**（1）最新 SHA 的完整 CI；（2）iPhone Safari 與電腦主要功能；（3）本人在各正式網域匯出 JSON 並確認非空，另用合成資料測試匯入；（4）GitHub Pages 與 Cloudflare 正式部署、資產與回復點；（5）Tags／Releases 名稱核對；（6）發版文字清楚披露警察 32 卷未完成人工核稿。**真人題源校稿不得因建立 GitHub Release 被勾為已完成**。

### 發布前最後原則

- 正式發布以核實過的 commit 為準；`a9191d…` 僅是此輪盤點到的 `main`，不是預先核定的發版標籤。
- GitHub Pages 可能因合併文件／程式而依既有管線更新；Cloudflare 須另外人工核准發布。**不得因已合併主分支，就認定 Cloudflare 已同步**。
- 保留 `archive/stability-baseline-20261023` 供程式碼回復；使用者私人 `localStorage`、`IndexedDB` 學習資料仍須自行匯出 JSON，Git tag 和 Release 無法取代。
- 若上述檢查未完成，保留 `[Unreleased]` 狀態並更新 [Issue #72](https://github.com/LeoKYChen/probation-study-desk/issues/72)；不要標成正式穩定 Release。

---

### 以下第 1–4 節為 PR #78 合併前的歷史驗收快照

## 1. 已確認基準與 CI 證據

| 項目 | 證據 | 結果 |
| --- | --- | --- |
| 正式 Git `main` | `d46ea4b219e6c8cb4fb38627662b4c79a424a932` | 凍結基準分支 `archive/stability-baseline-20261023` 已建立 |
| GitHub Pages 最新 main 部署工作 | [Run 39896356737](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39896356737) | success，指向上述 `main`；**外部即時網站互動仍待確認** |
| Cloudflare 最新 main 正式同步 | [Run 39896356808](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39896356808) | **cancelled**；在 `Install isolated acceptance browsers` 阶段達原工作 20 分鐘上限，後續 capture/publish/byte verification 均 skipped |
| Cloudflare 最近一次確認成功的 `main` 同步 | [Run 39783740980](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39783740980) | 2026-10-22 成功部署 `0d07acf25ad29b9b4681b92497493bf8687cbdf4`，有公開網址測試與復原紀錄；**不等於現在實際仍是此版本** |
| 凍結 PR #78 自動化基準 | [Run 39909376992](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39909376992) 等 11 個 CI | 基準 `8beb74a07b13e3a52f97fea520b6901f6538e1ed`：10 success，1 conditional skipped；瀏覽器／離線／備份／列印通過，**但正式 Cloudflare publish 在 PR 時按設計 skipped** |

## 2. 發布阻擋與防範措施

- 不能聲稱 Cloudflare 與 GitHub Pages 的**即時**正式內容已完全同步。外部網站請求在本次驗收環境中無法直接取得，須在正式發布前以實際網址和準確的 Cloudflare 部署資訊再次確認。
- 原本 `sync-cloudflare-production.yml` 對 `main` 每次 push 立即嘗試發布，可能在文件修改合併時意外觸發；此 PR 改為 **push／PR 做測試、真正 Cloudflare 發布須從 GitHub Actions 手動操作 `workflow_dispatch` 並輸入 `RELEASE`，且選用 `main` 分支**。驗證及 rollback 步驟沿用同一保護條件；不同分支或未輸入確認字串不得發布。
- 因主線曾多次在 apt／Playwright 安裝階段達到 20 分鐘逾時，發佈驗證 job 上限改為 **35 分鐘**；這只是容忍暫時慢速安裝，不能保證 CI 或發布一定成功。必要時仍應優化下載／快取策略。
- **注意：GitHub Pages 仍會依 GitHub 自身的 main 部署機制更新。** 即使 Cloudflare 改為人工觸發，合併 PR #78 本身仍可能使 GitHub Pages 發布新程式，因此實機、備份及回復確認**必須在合併前**完成。
- 新條件及逾時調整位於 PR #78，**未進入 main 之前不能對現有正式發布流程視為已生效**。

## 3. 上線前的人工驗收（尚未完成）

- [ ] 在平常使用的 **GitHub Pages** 網址和 **Cloudflare** 網址，分別進入個別模組／備份中心，匯出 JSON 並確認檔案存在、大小不是零。不同網址、不同 Safari／Chrome 裝置資料互不自動同步。
- [ ] 避免以原有真實資料直接覆寫：JSON `匯入預覽` 應在隔離測試環境或新的瀏覽器設定檔，以**合成資料**驗證；私人備份不要上傳 GitHub Issues、公開 PR 或工作階段記錄。
- [ ] 使用 iPhone Safari：首頁導覽、備考書桌四個分頁、題庫作答與舊紀錄、保存草稿→訂正→再次回想、雙 AI 題目確認、週報、列印、離線及手機版沒有水平溢出。
- [ ] 以測試環境確認 `dual-ai-bridge.js` 可讀、正式網頁沒有 404；與離線 manifest 靜態資源清單一致。
- [ ] 核對 Cloudflare `probation-study30-test` 專案目前正式 deployment 的 commit／時間及 rollback 目標，與 GitHub Pages 最新 SHA 分開記錄。
- [ ] 核對 GitHub `main` 的分支保護及必要 CI；當前 ruleset 僅禁止刪除與 non-fast-forward，並**未強制 PR／CI 檢查**；設定更嚴格規則前須先避免名稱錯誤造成主線永久無法合併。
- [ ] 使用者明確確認可發布後，才將 PR #78 合併進 `main`。合併可能觸發 GitHub Pages；檢查其發布結果，再考慮另行手動發布 Cloudflare。

## 4. 安全 Cloudflare 發布流程（僅待核准後執行）

1. 確認已合併的新版工作流程確實在 `main`，且 **PR／push 僅測試，沒有任何 publish step success**。
2. 在 GitHub **Actions → Synchronize approved Cloudflare production from GitHub main → Run workflow**，指定 `main`，在 `confirm_release` 欄輸入大寫 `RELEASE`。
3. 工作應先建置相同的靜態檔、通過 Chromium/WebKit 舊資料遷移與手機導覽測試，才擷取現網 deployment ID／首頁雜湊並檢查部署前未遭其他發布異動。
4. 發布後需比對正式站逐位元組和以合成紀錄執行 Chromium/WebKit 驗收。失敗時使用流程中的只對此部署有效的 rollback，並保留當次 recovery artifact。
5. 若失敗或遭取消，請先查看是否到達 `Publish only the approved main production branch` 步驟：**未執行 publish 不代表已更新；publish 之後若測試失敗則須確認 rollback 成功**。
6. 舊使用者本機 JSON 不會隨 GitHub Release／源碼 ZIP 上傳或自動還原。更新後先以原始紀錄檢查是否可繼續作答，勿清除 Safari／Chrome 網站資料。

**警察原題 PR #71 仍為 Draft，32 卷真人逐卷覆核尚未完成，不應與本次穩定版發布合併。**
