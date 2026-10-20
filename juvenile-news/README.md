# 少年司法週報｜獨立同步與發布

網站：https://leokychen.github.io/probation-study-desk/juvenile-news/

## 唯一資料來源

**唯一主檔仍是 `juvenile-news/issues.json`。** 與每日模擬題一樣，採用「JSON 主檔 → 資料驗證 → 既有 GitHub 發布」方式；週報僅多一道單期併入歷史清單的處理。兩份衍生資料由程式自動產生，請勿個別改寫：

- `juvenile-news/source/public/issues.json`：未來重新編譯 Vite 原始碼時使用。
- `file-data/weekly.generated.js`：GitHub 原始碼 ZIP 以 `file://` 開啟時的離線週報。

目前已收錄 12 期（最新為 2026-10-18），歷史舊稿必須保留。歷史文章原本標示 `sourceStatus: "unverified"`、`url: null` 或 `checkedAt: null` 者，維持「待查核」，不能自動補造來源。新期刊不可沿用既有期別 ID；期別需按日期由新到舊排列。

## 新增每週一期：沿用既有同步與發布

週報 AI 產出的單期 JSON 可保留既有 `{"issue": {...}}` 格式，不必自行改寫整包網站資料；也接受單一 issue 物件，或僅有一筆資料的 `{"issues":[...]}`。

在已下載的 GitHub 專案根目錄，使用 Node.js 24：

```bash
# 先預覽合併結果；不修改任何檔案
node scripts/weekly-import.cjs --input /path/to/new-weekly.json --check

# 確認後才寫入：主檔 + 既有的兩份同步檔
node scripts/weekly-import.cjs --input /path/to/new-weekly.json --write

# 沿用原有的驗證流程
node scripts/weekly-sync.cjs --check
node --test verification/weekly-sync.test.cjs verification/weekly-import.test.cjs
```

程式會依日期排列新期別，保留全部舊期，阻擋重複日期、衝突 ID、重複文章 ID，以及已收錄期別的無意覆寫；完全相同的一期再次匯入則安全跳過。舊期若需訂正，必須另以明確審核的修訂方式處理，不能透過匯入器偷偷覆蓋。

**本工具不會主動尋找 ChatGPT 對話或 Google Drive 文件，也不會自行推送新週報。** 使用者或 AI 助理需提供新一期 JSON 並將上述產物提交 GitHub PR；PR 通過驗證、經人工確認合併到 `main` 後，才由原有 GitHub Pages 與 Cloudflare 工作流程發布。來源標為 `verified` 僅代表輸入資料的查核註記；格式通過不等於重新獨立核實原始研究。

## 同步方式

將本 repo 下載或 clone 後，使用 Node.js 24：

```bash
node scripts/weekly-sync.cjs --write
node scripts/weekly-sync.cjs --check
node --test verification/weekly-sync.test.cjs
```

這些指令僅處理週報的主檔、兩個鏡像及驗證，不編譯、不覆蓋題庫或 AI 批改。若要檢查過去的期別有無被意外刪除，可在 Git 專案中執行 `node scripts/weekly-sync.cjs --check --base HEAD^`。

## GitHub 自動化

`.github/workflows/juvenile-weekly-release.yml` 與其他發布工作流程相互獨立：

1. **提交 Pull Request：** 使用原本的週報驗證流程，同時測試新增的單期匯入器；僅驗證與列出差異，不直接發布。
2. **合併到 main：** 自動比對上一版，阻擋不小心刪掉歷史期數；僅在有差異時提交兩份衍生資料，不觸碰其他區域。
3. **發布驗證：** GitHub Pages 原有 main 發布機制不變；新工作流程獨立輪詢公開 `issues.json`，直到其 SHA-256 與本次 GitHub 主檔一致，否則顯示失敗。
4. **手動重試：** GitHub Actions 中選擇「Juvenile weekly independent sync and publication verification」→ Run workflow（main）即可補跑同步及驗證。

注意：**GitHub Actions 使用預設 `GITHUB_TOKEN` 自動提交的檔案不會再觸發另一輪 Pages 發布。** 因此最佳流程是在原本的 Pull Request 內同時包含三份同步後的週報檔案，再合併 main；新的 Action 提供遺漏鏡像時的補救，但不可將其視為重新部署站點的替代品。公開頁面以 `juvenile-news/issues.json` 為準；離線 ZIP 須以 repo 最新版內容為準。

## 完成檢核

- GitHub Actions `validate` 與 `synchronize` 均顯示成功。
- 公開網址 `juvenile-news/issues.json` 已通過本次資料雜湊驗證。
- 網站可顯示最新一期及全部舊期；歷史待查核來源不得誤標為已確認。
- Cloudflare 正式站仍由專案既有的 `sync-cloudflare-production.yml` 發布，不由週報流程私自改動部署設定。

介面：週次查閱、分類、搜尋、來源及實務分析、收藏、已讀、字級調整和 Markdown 下載。使用者個人的收藏與閱讀紀錄只保存在瀏覽器。本專案原始碼依 repository LICENSE 的 GPL-3.0-only 授權。
