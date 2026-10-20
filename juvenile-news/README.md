# 少年司法週報｜獨立同步與發布

網站：https://leokychen.github.io/probation-study-desk/juvenile-news/

## 唯一資料來源

**只編輯 `juvenile-news/issues.json`。** 兩份衍生資料由程式自動產生，請勿個別改寫：

- `juvenile-news/source/public/issues.json`：未來重新編譯 Vite 原始碼時使用。
- `file-data/weekly.generated.js`：GitHub 原始碼 ZIP 以 `file://` 開啟時的離線週報。

現有 11 期舊稿必須保留。歷史文章原本標示 `sourceStatus: "unverified"`、`url: null` 或 `checkedAt: null` 者，維持「待查核」，不能自動補造來源。新期刊不可沿用既有期別 ID；期別需按日期由新到舊排列。

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

1. **提交 Pull Request：** 驗證週報內容、重建鏡像並列出差異，唯讀，不發布也不修改分支。
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
