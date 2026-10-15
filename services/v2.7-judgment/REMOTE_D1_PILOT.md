# v2.7.1c 第四輪｜Cloudflare D1 遠端「合成資料限定」測試

狀態：2026-10-15，**已準備GitHub Actions工作流程，但未真正建立遠端D1**。原因：現有Cloudflare Pages Token查詢D1時獲得 `Authentication error [code: 10000]`，可能缺少D1權限或帳戶範圍不符。

## 既有資源保護與使用範圍

- GitHub分支：`feature/v2.7-legal-search`；不改`main`或任何v2.5網站。
- 僅計畫建立兩個命名固定的遠端D1：
  - `probation-v271c-metadata-synth-20261015`（合成裁判中繼資料測試）
  - `probation-v271c-ledger-synth-20261015`（合成撤除墓碑測試）
- `provision-synthetic-d1.cjs`會先檢查Cloudflare帳戶的D1清單：若以上名稱已存在，**拒絕修改**；若帳戶已有9個以上D1，**拒絕新增兩個**。
- 指定只使用 `TEST_JID_SYNTHETIC_REMOTE_20261015` 測試碼，不得輸入真實案號、法院裁判、非公開少年資料、個資或API憑證。
- 絕不呼叫`wrangler d1 delete`或`time-travel restore`，亦不建立Worker、服務綁定、公開API，**不使用任何司法院帳號**。
- 此階段的遠端演練只檢查SQL表、存取封鎖及撤除墓碑；即使成功也**不能**宣稱真實裁判撤除或備份清除已通過驗收。

## 使用者下一個必要動作（尚未完成）

保留原本的 `CLOUDFLARE_API_TOKEN`（Pages部署專用），**另建立**僅供D1測試使用的 Cloudflare API Token：

1. 前往 https://dash.cloudflare.com/profile/api-tokens ，Create Token → Create Custom Token。
2. Token名可設 `probation-v271c-d1-test`。
3. Permissions：`Account` → `D1` → `Edit`；Resources：僅指定目前Cloudflare帳戶。
4. 複製Token後，**只在GitHub Actions Secrets頁面** https://github.com/LeoKYChen/probation-study-desk/settings/secrets/actions 新增名稱 `CLOUDFLARE_D1_API_TOKEN`，貼入其Secret值。
5. 不要將Token或Account ID發到聊天、GitHub commit、issue或網頁。
6. 確認帳戶維持免費額度及無不預期的付費計畫，再同意執行遠端建立流程。Cloudflare目前D1 Free方案每帳戶最多10個資料庫、單DB上限500MB、帳戶總儲存5GB，實際額度以帳戶頁面為準。

**注意：新增Secret不會自動建立D1**。需要一個明確的啟動事件；此工作流程設定為只有 GitHub Actions 的手動操作，或更新保留的 `START_REMOTE_SYNTHETIC.md` 時才會嘗試建立。該啟動檔案目前尚未建立。

## 已寫好但未執行遠端變更的檔案

- `.github/workflows/preflight-v271c-d1.yml`：只讀D1權限檢查；使用新增的`CLOUDFLARE_D1_API_TOKEN`，不會改Pages Token。
- `.github/workflows/provision-v271c-synthetic-d1.yml`：人工明確啟動後才執行，包含憑證檢查、Node24、Wrangler及專用合成資料庫初始化。
- `remote/provision-synthetic-d1.cjs`：嚴格限制DB命名、數量、權限與`V271C_CREATE_SYNTHETIC_D1_ONLY`確認旗標，且拒絕任何司法院真實API模式。
- `remote/metadata-synthetic-smoke.sql`、`remote/ledger-synthetic-smoke.sql`：只有合成測試表資料。
- `remote-provision-gate.test.cjs`：確認缺少確認旗標或憑證時完全不會接觸遠端Cloudflare，且檢查沒有刪除或還原命令。

## 官方技術來源

- Cloudflare D1指令（create、execute、list）：https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare API權限（Account／D1／Edit）：https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- D1免費方案限制：https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 Time Travel：https://developers.cloudflare.com/d1/reference/time-travel/

**仍未完成的關卡**：真實遠端D1權限驗證、兩個遠端D1建立、合成資料遠端測試、實際D1還原與撤除端到端測試、獨立簽章/版本見證服務、安全私有服務綁定及使用者對真實司法資料的另行授權。
