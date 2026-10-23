# 穩定版發布前驗收紀錄｜2026-10-23

> 追蹤：[穩定版 PR #78](https://github.com/LeoKYChen/probation-study-desk/pull/78) 與 [凍結 Issue #77](https://github.com/LeoKYChen/probation-study-desk/issues/77)。
> **本文件是發布候選驗收紀錄，不是已正式發布的聲明。**

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
