# Staresto v0.6 — 連結式英文學習助手（第一階段測試版）

這是使用者 2026-10-17 確認的**簡化版**，只負責安排 Staresto 原站學習任務、手動記錄成績、避免本站重排相同練習。不是把 Staresto 上千筆題目複製進本站。

入口：`common-subjects/english-assistant/index.html`。目前僅在獨立測試分支，不更新正式首頁或正式 GitHub Pages。

## 第一階段完成項目

- 每日依臺北時間固定任務：每天單字（每組5題，挑至少6個不熟的字或搭配詞另記筆記），其他練習依星期安排。
- 已依原作者公開資料查核並建立 **335 組穩定任務 ID**：
  - 單字100組：依原站 `gsat/data.js` 真實題號產生 `#set-V...,...` 連結；正式學測、推薦甄選與補考**分別標示**。
  - 克漏字與文法86組：原站 `q/` 的真實題號與 `#set-G...,...` 指定練習連結。
  - 閱讀124篇：原站 `p/` 的真實文章識別碼、`#p=g115p1` 等互動練習連結。
  - 文意選填25篇：確認 `gsat/passages.json` 正式試題的年度與文章名稱；因**沒有核實整篇直達連結**，提供原站首頁及人工選取指示。
- 當日題單固定；已分配、已完成或按「已做過／找不到」排除的範圍，不再次作為新的任務分派。
- 手動登記完成及選填答對題數；儲存到獨立的 `psd-staresto-link-coach-v06` localStorage 鍵，提供 JSON **匯出**。
- 只連結原作者網站，不複製原題、解析或中譯，不讀取原站 cookies/成績、不執行外站腳本。

## 已確認的原站行為

依原作者公開儲存庫檔案查核：單字 `gsat/index.html`、文法 `grammar-cloze-test/index.html` 均有 `startFromSetHash` 解析題目 ID；閱讀 `reading-comprehension/index.html` 可解析 `#p=<文章ID>` 進入互動文章。這是**靜態原始碼核對，不等於已完成瀏覽器端操作測試**。

## 待驗收或後續擴充

1. 在實際瀏覽器、手機上確認 `#set` 與 `#p` 是否能正確開啟預期題目、計分及返回本站。
2. 文意選填手動篩選步驟，尤其整篇模式，需實機確認。
3. **跨版本去重尚不完整**：無法讀取 Staresto 外站練過哪些，也沒有自動移轉 v0.4 舊668題的作答紀錄；已經做過的範圍需按「換一份」，不能保證外站隨機題永不重複。
4. 每日六張獨立單字卡、個人不熟字庫與間隔複習屬第二階段；目前只有在原站選題及筆記的指引。
5. JSON 匯入、跨裝置資料移轉流程、趨勢統計屬第三階段；目前有匯出但沒有匯入。
6. 未對外部署預覽，不更新 `main` 或共同科目首頁，不影響舊英文、作文、原創80題及專業科目資料。

## 原始來源

- [Staresto 學測詞彙題庫](https://github.com/staresto-create/JCEE-vocab-questions/tree/main/gsat)：`data.js` 500筆（含學測、補考、推薦甄選），僅取題號與穩定 ID。
- [Staresto 學測克漏字](https://github.com/staresto-create/grammar-cloze-test/tree/main/q)：各年度逐題頁公開的 ID。
- [Staresto 閱讀](https://github.com/staresto-create/reading-comprehension/tree/main/p)：可互動選文的 `#p=` 識別碼。
- [Staresto 文意選填](https://github.com/staresto-create/passage-completion/blob/main/gsat/passages.json)：僅取正式考試年度與篇名。

## 測試

執行 `node common-subjects/english-assistant/test.cjs`，檢查 ID 不重複、年度分類、具體直達網址、完成後排除、每日題單固定、分數驗證及獨立儲存鍵；GitHub Actions 在 PR 執行。對原站的網頁互動仍須真人驗收。

此版與全站題庫品質審查 PR #12 **各自獨立**，不得未經驗收就合併。
