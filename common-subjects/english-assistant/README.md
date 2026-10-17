# Staresto v0.6｜個人化英文學習助手

本版依使用者需求採用**原站練習、本站排課與保存紀錄**的輕量模式，不複製第三方考題、中文翻譯或解析，不重製大型英文題庫。以 116 年司法特考三等觀護人為目標，每天預計約 15–25 分鐘。

**入口：** `common-subjects/english-assistant/index.html`；共同科目站 `common-subjects/index.html` 的英文主要入口已指向新版。

## 已完成

- 每日固定從 Staresto 安排單字題，其他週課表為文法、閱讀、文意選填及弱項；已由原作者公開資料驗證並建立 **335 組穩定任務 ID**：單字100組、文法86組、閱讀124篇、文意選填25篇。
- 原站單字及克漏字支援 `#set-<逐題ID>` 深連結，閱讀支援 `#p=<文章ID>`。文意選填只有已驗證文章與年度，仍須原站手動選擇；不宣稱自動跳篇。
- 每日**6張新單字卡**、中文意思、詞性及本站自編英文例句；首批 **180 字（30 天）**。這些例句不是複製 Staresto 原文。
- 按「記住了／還不熟」安排間隔複習（1、3、7、14、30、60天進度）；如果昨天尚未完成，未學的字仍會保留。生字可加入個人字庫，之後優先排入。
- 當天任務固定；已安排、完成或手動排除的 Staresto 題目不會再當成新任務排入。特意複習的單字不算新字。
- 開啟外站練習 → 返回本站手動登記答對題數；外站資料、分數不會自動讀取。
- 使用 `psd-staresto-link-coach-v06` 獨立 localStorage 鍵儲存任務、單字及紀錄。提供 JSON 匯出及**合併式匯入**，匯入不主動刪除現有紀錄；沒有跨裝置即時同步。
- 原創80題完整留在 `common-subjects/index.html` 原題庫和 `psd-common-subjects-v1` 本機紀錄，但題目、成績和刪除入口都隱藏。v0.4 舊版 668 題頁面與紀錄不刪除；使用者尚未開始舊版練習，因此不需要歷史移轉。

## 重要限制

1. **首批僅180個自編單字，約30天**。用盡後不虛構新字；可加入個人生字，後續需擴充詞庫。
2. 不提供全自動讀取 Staresto 成績；同瀏覽器的不同網站也不能任意互讀彼此的學習紀錄。
3. 本站不承諾可以控制原站隨機抽題；請從本站指定連結作答。原作者將來更新網址或題目 ID 時可能需要重新檢查。
4. 不會讀取或匯入既有 v0.4 的668題作答紀錄。使用者已確認尚未做過舊題；如果日後有跨版本紀錄，仍要獨立核對。
5. 手動備份適合本機保存或跨裝置移轉，不應將含個人練習紀錄的備份上傳到公開 GitHub。

## 驗收

- `node common-subjects/english-assistant/test.cjs`：穩定題目 ID、無重複安排、完成登記、來源。
- `node common-subjects/english-assistant/test-vocab.cjs`：180字、每日六字、到期複習、個人字庫、合併匯入、原創80題隱藏。
- `node common-subjects/english-assistant/test-browser.cjs`：Playwright Chromium 實際開啟測試網頁，模擬單字翻牌、記憶評分、考題記分、重新整理、備份匯出／匯入、原創80題隱藏及資料隔離；須先安裝 Playwright Chromium。GitHub Actions 已設定自動執行。
- `common-subjects/test-v02.cjs`、`common-subjects/test-staresto.cjs`、`daily/test-v04.cjs` 及 `daily/test-ui-v04.cjs` 持續進行舊版回歸檢查。

## 原始網站

Staresto 的公開教育資料由作者 staresto-create ZZSH 製作。本站只存放練習位置連結與自編詞卡；原題目、翻譯、解析的權利不因本專案程式碼授權而轉移。

- https://staresto-create.github.io/JCEE-vocab-questions/gsat/
- https://staresto-create.github.io/grammar-cloze-test/
- https://staresto-create.github.io/reading-comprehension/
- https://staresto-create.github.io/passage-completion/

全站題庫品質審查 PR #12 是獨立工作，不能因本連結型助手通過驗收，就推定第三方4,733筆題庫已取得全內容利用權利。
