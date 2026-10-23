# 2026-10-23 Repository 清理稽核與第一批變更

> 追蹤：[Issue #73](https://github.com/LeoKYChen/probation-study-desk/issues/73)。本文件只說明版本庫，不涉及瀏覽器內的私人學習紀錄。

## 基準

- 專案：`LeoKYChen/probation-study-desk`。
- 清理前 `main` 提交：`816e6d9363bcced8b5a61a0f9541572bb1bad38f`。
- 2026-10-23 盤點：128 條分支、5 件未結 PR；主分支含 387 個 Git 追蹤檔案、66 個目錄；根目錄 30 個檔案、23 個目錄。
- 以 Git blob SHA 判斷有 23 組位元組相同的檔案，26 份額外副本，約 3,081,938 bytes。這不是「可直接刪除」的計數。
- `main` 的 `Protect Main Branch` ruleset 已啟用 `deletion` 與 `non_fast_forward`，但未設定必需 PR 審核及 CI 檢查；合併前應補足驗收。

## 第一批清理範圍（本 PR）

| 移除的根目錄檔案 | 保留的同內容原始位置 | Git blob SHA | 原因 |
| --- | --- | --- | --- |
| `index (1).html` | `juvenile-news/source/index.html` | `f23d2d92f947487d34ee541de61eb14011748e95` | 重複的週報 Vite 來源入口；網站根路徑使用自己的 `index.html` |
| `index-DWXubpQf.js` | `juvenile-news/assets/index-DWXubpQf.js` | `c54c7614c1e9a5fffe15949766891735d8d8f5eb` | 正式週報頁面只引用 `./assets/index-DWXubpQf.js` |
| `index-JfbeKn1C.css` | `juvenile-news/assets/index-JfbeKn1C.css` | `af460593122b843a279f16edb9de08207dc6a298` | 正式週報頁面只引用 `./assets/index-JfbeKn1C.css` |

這三項原始內容仍可經由清理前的 `main` SHA 還原。三者合計刪除 303,897 bytes 的工作樹重複內容；Git 歷史物件不會因此縮小，正式發布的其他檔案亦不應受影響。

## 本批刻意不處理

- `juvenile-news/issues.json` 與 `juvenile-news/source/public/issues.json`：週報的正式資料與原始碼鏡像；另有 `file-data/weekly.generated.js` 供檔案離線模式，應由 `scripts/weekly-sync.cjs` 一致產生，不得刪一留一。
- `questions.js`、`professional/source-main-questions.js`、`v2.5/questions.js`（及 related/yamol/shuati 副本）：不同子站的相對路徑、PWA 與 ZIP 離線可能依賴；待完成共用來源及回歸測試後處理。
- `v2.5/backup-io.js` 與 `v2.5/backup-io-direct.js`：雖然內容相同，但 HTML 與離線清單仍有引用；不以重複作為刪除依據。
- `verification/fixtures/`、`upload/`、`jcis-demo/`、`knowledge-graph-preview/`、`experiment/v27-*`：待確認歷史驗收、網址及分支獨有提交，不在本批清理。

## 稽核方法與驗收指令

新增不修改原始碼的 `scripts/audit-repository.py`。掃描 `git ls-files -z` 所列追蹤檔，依 SHA-256 計算位元組完全相同的組別、額外副本及體積；`--check-phase1` 只驗證本批三項已移除，並確認重要週報資產、週報資料同步對、題庫鏡像仍存在且一致。

```bash
python3 scripts/audit-repository.py --check-phase1
node scripts/weekly-sync.cjs --check
node --test verification/weekly-sync.test.cjs verification/weekly-import.test.cjs
node verification/unified-integration.cjs .
python3 scripts/build-cloudflare-main-mirror.py
python3 verification/check-cloudflare-release.py
```

還須在 PR 的 CI 與實際測試站驗證：GitHub Pages 首頁、`juvenile-news/`、`professional/`、`v2.5/`、備考書桌、JSON 匯入／匯出、離線資源及 Cloudflare 鏡像。以上命令是**待執行驗收清單**，不得將「已建立檔案」誤記為「遠端 CI 通過」。

## 後續清理優先順序

1. 比對 #71、#63 題庫來源及重疊功能；#42 先比對現有 `2026-10-18` 週報與來源，再決定關閉或挑選性修補；#38、#12 保持草稿待驗收。
2. 逐支計算 `main...分支` ahead/behind，分為已納入主線、待移植功能、實驗封存、備份保留；不直接刪除仍有獨有提交的分支。
3. 題庫導入穩定 ID、單一權威來源＋建置同步副本，不破壞 `file://`、PWA 與既有瀏覽器記錄。
4. 將正式網站、測試預覽與歷史快照明確分層；逐批縮減不再需要的根目錄檔案。

## 回復方式

若驗收發現錯誤，暫停合併此 PR，或從 `816e6d9363bcced8b5a61a0f9541572bb1bad38f` 還原三個檔案；不要強制重設 `main`，以 PR 方式復原即可。