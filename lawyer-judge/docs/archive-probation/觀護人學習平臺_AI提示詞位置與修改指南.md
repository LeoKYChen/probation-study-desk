# 觀護人學習平臺｜AI 提示詞位置與修改指南

> 文件日期：2026 年 10 月 23 日  
> 適用專案：`LeoKYChen/probation-study-desk`、`LeoKYChen/multi-ai-review-desk`  
> 用途：說明「一鍵複製 AI 批改」、「雙 AI 交叉審查」及個人自訂提示詞的原始碼位置與自行修改方式。

## 一、先說結論

**可以直接在 GitHub 修改原始提示詞，不需要重做網站。** 但需區分兩件事：

- **觀護人學習平臺**負責依考題、科目、作答內容組裝一鍵批改提示詞，並把雙 AI 審查任務送往外部工作臺。
- **雙 AI 協作工作臺**負責依「獨立分析 → 交叉審查 → 各自修訂」三階段組裝實際送給模型的提示詞。

因此，「一鍵批改」與「雙 AI 交互審查」不只有一個提示詞檔案；應依想變更的功能找到正確位置。

## 二、原始檔案位置總覽

| 功能 | GitHub 專案 | 檔案路徑 | 主要程式位置 |
|---|---|---|---|
| 一鍵複製 AI 批改（考古題） | `probation-study-desk` | `v2.5/ai-simple-review-v254.js` | `buildPrompt()`，約第 17 行起 |
| 送交雙 AI 的初始審查指令（考古題） | `probation-study-desk` | `v2.5/ai-simple-review-v254.js` | `buildDualReviewPayload()`，約第 89 行起 |
| 個人自訂 AI 批改規則 | `probation-study-desk` | `ai-prompt-customizer.js` | `effective()`、`save()`、`enhance()`、`mount()` |
| 每日 30 分鐘練習的 AI 批改 | `probation-study-desk` | `professional/ai-review-links-direction.js` | `prompt()`，約第 30 行起 |
| 晚間學習室／每日模擬題的一鍵批改 | `probation-study-desk` | `daily-simulation/app.js` | `promptFor()`，約第 113 行起 |
| 晚間學習室／每日模擬題的雙 AI 送審 | `probation-study-desk` | `daily-simulation/app.js` | 約第 192 行起的 `instruction` 組裝邏輯 |
| 雙 AI 三階段交互審查（真正的各階段規則） | `multi-ai-review-desk` | `docs/index.html` | `promptFor(t,s)`，約第 203 行起 |

> 行號依 2026 年 10 月 23 日查閱的 `main` 分支；日後程式更新可能使行號變動。建議以函式名稱搜尋定位。

## 三、可直接開啟的 GitHub 原始檔案

### （一）觀護人學習平臺

1. [一鍵批改與雙 AI 送審：`v2.5/ai-simple-review-v254.js`](https://github.com/LeoKYChen/probation-study-desk/blob/main/v2.5/ai-simple-review-v254.js)
2. [個人自訂規則：`ai-prompt-customizer.js`](https://github.com/LeoKYChen/probation-study-desk/blob/main/ai-prompt-customizer.js)
3. [每日 30 分鐘練習：`professional/ai-review-links-direction.js`](https://github.com/LeoKYChen/probation-study-desk/blob/main/professional/ai-review-links-direction.js)
4. [晚間學習室：`daily-simulation/app.js`](https://github.com/LeoKYChen/probation-study-desk/blob/main/daily-simulation/app.js)

### （二）雙 AI 協作工作臺

- [獨立專案：`LeoKYChen/multi-ai-review-desk`](https://github.com/LeoKYChen/multi-ai-review-desk)
- [三階段提示詞：`docs/index.html` 第 203 行附近](https://github.com/LeoKYChen/multi-ai-review-desk/blob/main/docs/index.html#L203-L211)

## 四、各個提示詞實際控制什麼？

### 1. 「一鍵複製 AI 批改」：`buildPrompt()`

檔案：`probation-study-desk/v2.5/ai-simple-review-v254.js`

- `mode === 'direction'`：僅診斷答題方向、四格草稿或大綱；不依完整申論的字數與論證完整度評分，也不給百分制分數。
- 其他情況：完整申論批改，依爭點掌握（30 分）、法規／理論（25 分）、涵攝論證（25 分）及結構表達（20 分）提供模擬評語。
- 題目資訊、題幹、參考考點、作答方向與考生答案，是由程式自動帶入，**不建議直接把特定題目的文字寫死在通用提示詞中**。

### 2. 「送交雙 AI 交叉審查」：`buildDualReviewPayload()`

檔案：`probation-study-desk/v2.5/ai-simple-review-v254.js`

主要生成：

- `title`：題目標題，例如年度、科目、題號。
- `instruction`：雙 AI 的共同交辦要求，包含各自審查、互評、修訂及來源查證限制。
- `documentText`：已組裝的一鍵批改內容，包含題幹與考生作答。

如只想修改「從考古題送出時的共同批改要求」，應優先檢查此函式中 `baseInstruction` 的文字。

### 3. 雙 AI 真正的三階段交互審查：`promptFor(t,s)`

檔案：`multi-ai-review-desk/docs/index.html`

其三階段為：

1. **第一階段：獨立分析（`independent`）**：兩位 AI 各自形成初稿，尚不得參考對方本回合答案。
2. **第二階段：交叉審查（`critique`）**：讀取雙方初稿，具體指出對方的事實、法規或理論錯誤、推論跳躍、遺漏考點、引用不足等，也應反省自己的初稿；不得為湊數而硬找錯誤。
3. **第三階段：各自修訂（`proposal`）**：逐項回應對方批評，說明採納、不採納或保留待查證，提出修訂稿並保留有根據的不同見解，最後交由使用者人工核定。

**要改「兩位 AI 如何互評、如何訂正、輸出哪些欄位」，核心修改位置就是這裡。**

### 4. 自訂提示詞：`ai-prompt-customizer.js`

此檔案控制網站內「自訂 AI 批改提示詞」的編輯、儲存、匯入／匯出及附加規則功能。其個人設定在**目前瀏覽器的本機儲存空間**中保存，不會直接改寫 GitHub 原始碼。

- 可依「完整申論／答題方向」及不同考科保存個人規則。
- 修改網站內的自訂規則，主要影響使用該瀏覽器時生成的提示詞。
- 可匯出 `AI批改提示詞設定.json` 備份。
- `enhance()` 是把個人規則附加到網站預設內容；它不是單純取代整個提示詞。

## 五、如何直接在 GitHub 修改？

1. **打開目標原始檔案連結**，確認自己已登入 GitHub 並有編輯權限。
2. **建議先建立新分支**，不要直接在正式 `main` 分支試驗大幅修改。
3. 在檔案頁面點擊鉛筆圖示 **Edit this file**。
4. 用瀏覽器搜尋功能尋找 `buildPrompt`、`buildDualReviewPayload` 或 `promptFor(t,s)`。
5. 只改需要調整的**提示詞字串**。避免刪除函式、括號、引號、反引號、變數插值（例如 `${t.title}`）或 `.join('\n\n')` 等程式邏輯。
6. 點擊 **Commit changes** 儲存，必要時建立 Pull Request。
7. 合併修改後，開啟相關網頁以同一題測試：一鍵複製、雙 AI 任務交接、三階段提示詞、回傳與評語儲存是否正常。
8. 若網站仍顯示舊版，先確認 GitHub Pages 是否已部署完成，再重新整理；若為已安裝的 PWA，還需留意瀏覽器快取。

> 修改提示詞文字通常比改動程式流程安全，但 JavaScript 語法若有錯誤，仍可能導致按鈕失效。建議每次修改都保留 Git commit 以便回復。

## 六、什麼情況應該改哪裡？

| 需求 | 建議操作 |
|---|---|
| 想讓每次批改更重視考古題出處、法條查證、示範段落 | 先在網站內「自訂 AI 批改提示詞」新增規則 |
| 想永久調整考古題的一鍵批改預設格式 | 修改 `v2.5/ai-simple-review-v254.js` 的 `buildPrompt()` |
| 想修改送出雙 AI 時的共同交辦要求 | 修改同檔 `buildDualReviewPayload()` 的 `baseInstruction` |
| 想讓雙 AI 在互評階段更嚴格逐項檢查錯誤 | 修改 `multi-ai-review-desk/docs/index.html` 的 `promptFor(t,s)` 中 `critique` 段落 |
| 想調整雙 AI 最終修訂、分歧與人工核定機制 | 修改同函式中的 `proposal` 段落 |
| 想調整每日模擬題，而非考古題的批改內容 | 修改 `daily-simulation/app.js` 中相應的提示詞邏輯 |

## 七、後續架構建議

目前提示詞分散在多個 JavaScript／HTML 檔案中。為使非資訊背景的使用者能長期自行維護，可以規劃下一版加入「提示詞管理」頁面：

- 分類呈現一鍵批改、答題方向、雙 AI 獨立審查、互評、修訂等模板。
- 可直接編輯繁體中文提示詞，保留固定變數及來源資料欄位。
- 支援預覽實際生成結果、版本比較及一鍵恢復預設。
- 可依不同考科配置批改要求，避免法律、心理學、犯罪學、社會工作等科目套用完全相同的評分細則。
- 變更先測試再套用，避免影響既有作答紀錄。

這是**建議的未來功能**，不代表目前網站已具備集中式的三階段提示詞管理後臺。

---

**總結：** 要直接改「一鍵批改」，請進入 `probation-study-desk/v2.5/ai-simple-review-v254.js`；要直接改「雙 AI 如何進行真正的交互審查」，請進入 `multi-ai-review-desk/docs/index.html` 的 `promptFor(t,s)`。
