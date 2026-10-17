# 固定兩個正式入口及 Cloudflare 主站切換方案

狀態：準備及測試中。**本 PR 未合併前，不會切換 Cloudflare 主網址。**

## 不再要求使用者辨認一串測試網址

建議之後固定使用：

| 角色 | 網址 | 本次核查的現況 |
|---|---|---|
| GitHub 正式入口 | https://leokychen.github.io/probation-study-desk/ | 五入口新版首頁，main 已合併 PR #30 |
| 建議的 Cloudflare 正式入口 | https://probation-study30-test.pages.dev/ | Cloudflare 設定中的 production 主網址；仍是「今天，專心30分鐘」舊版 |
| 專用鏡像 | https://github-main-mirror.probation-study30-test.pages.dev/ | 已與 GitHub 同步，但它是專用分支別名，不等於主網址已切換 |

Cloudflare 主網址雖含 `test`，其正式／預覽角色由專案設定判定。本次唯讀 API 盤點已核對：專案 `probation-study30-test` 的 production branch 是 `main`，沒有其他自訂正式網域。

`home-preview-20261017`、`v254-unified-preview`、`unified-home-v254-20261017`、法律 AI 及其他網址保留原狀。不重新命名專案，不刪除任何部署。

## 切換前的確切版本與回復目標

- 唯讀盤點：[Actions 39026376392](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39026376392)。
- 現行 production deployment：`eb1113aa-5904-458f-ac97-1e2cb0cd9f67`。
- 固定程式網址：https://eb1113aa.probation-study30-test.pages.dev/ 。
- Cloudflare 記錄的來源 SHA：`d764a47271fab40ff27f3ba9ea5eb280ec1c45c1`。
- 現行首頁 SHA-256：`cc34a71a4ba8d9b13181f78d961007c3991f2912faa612a7fa7c69910ad0c133`。
- 主網址與固定部署首頁逐位元組相同，盤點過程只 GET 公開內容與專案資料，沒有部署、回復或修改設定。

正式執行前會再次核對上述身分及內容；若已變更，停止發布。未來若已由本套流程管理，則核對前一版 manifest 的 repository、source_commit、首頁雜湊與 Cloudflare 部署 commit，並擷取當時的回復 ID。

## 合併本 PR 將造成的變更（需明確批准）

1. Cloudflare 主網址首頁更新為五入口新版，專業練習由同站的 `/professional/` 進入，與 GitHub 使用同一份 main 程式。
2. GitHub 首頁的頁籤與頁尾移除已過時的「測試版」稱呼；保留五入口版面。版本清單的發布角色改為中性的 `github-main-static-site`，供正式站與鏡像共用。
3. 往後 main 的每次更新，先建置、檢查及測試，再發布至既定 Cloudflare production branch。準備分支 push 和 PR 事件只驗證，**絕不發布 production**。
4. 每次發布保存前一版部署身分；發布後核對全部網站檔案及版本清單，再用 Chromium 與 WebKit 在實際主網址驗證基本操作。
5. 若本次發布或發布後驗收失敗，只在確認現行壞版確為「本次 commit」時嘗試回復上一部署；拒絕撤銷其他人的較新部署。不清空 localStorage，不修改瀏覽器個人資料。

Cloudflare 官方提供既有 production deployment 的 rollback API；程式使用該端點，沒有刪除部署或重建專案的步驟：
https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/ 。

本 PR 不修改其他分支原有工作流程。未來維護以 main 為唯一來源，勿再手動從舊分支向 production 發布；發布前的身分檢查會攔下與已知原版或 main manifest 不符的正式版本。

## 作答資料相容性驗收

使用固定舊 production 的實際 17 個資源建立 fixture，SHA-256 記於 `verification/fixtures/cloudflare-before-sync/manifest.json`。其中 12 個檔案與現有 professional 資源完全相同，直接重用並驗證雜湊；不同的 5 個檔案獨立保留。

`verification/cloudflare-migration.cjs` 用合成資料實際操作舊版：保存速記、申論、歷史 session；同 origin 切到新首頁再進專業練習，要求原題目 ID、速記及完整答案接續。新增 AI 評語後重新載入；再模擬回復舊版並繼續保存，要求額外欄位與舊歷史不遺失，最後再切回新版確認資料仍在。

保留原鍵 `probation-study30-v251:v1`；不進行跨網站搬移或 JSON 備份開發。舊站的作答原本就在 Cloudflare 主 origin，更新後的 professional 位於同一 origin，所以不需要改鍵或跨域搬移。

此測試不代表已讀取或驗證使用者真實歷史資料。實際 iPhone／Safari 主畫面 App 與真實資料仍待實機確認。實際 Cloudflare rollback 尚未執行；已做防護邏輯的假 API 測試與舊程式的本機回復相容性測試。

## 限定範圍

只完成第 1 項版本統一與正式切換準備。使用者要調整的格式、JSON 跨裝置備份、列印／PDF、離線、ZIP 離線、v2.7 均留待後續；既有功能照常保留。
