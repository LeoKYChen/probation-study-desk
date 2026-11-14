# 律司備考平臺｜Lawyer & Judge Study Desk

> 律師、司法官考試的開源自主學習網站。由 [觀護人學習平臺](https://github.com/LeoKYChen/probation-study-desk)（基準 commit `b0427d8`）直接改版：**功能與程式結構不變，只把科目、題庫、評分準則與 AI 提示詞換成律師、司法官考試。**

**專案性質：** 個人開發的學習輔助工具，不是考選部或司法院的官方網站。參考答案、AI 評語與自評分數都不是國家考試正式閱卷結果。科目與配分整理自補習班公開資料（115 年），**以考選部每年公告的應考須知為準**。

## 題庫

交付版本已匯入 **107–114 年律師第二試申論題 199 題**與 **107–115 年第一試選擇題 2,700 題**（考選部試題，由 [LawPlayer](https://lawplayer.com/exam/lawyer) 下載後以 `scripts/convert-lawplayer.mjs` 轉換）。申論涵蓋憲法與行政法、民法與民事訴訟法、刑法與刑事訴訟法、商事法、國文及五個選試科目；選擇題在 [選擇題練習](mcq/) 作答（依科目抽題、整卷計時模擬、錯題本、弱點統計）。已知缺漏：**112 年憲法與行政法第 2 題**、**114 年海商法與海洋法**、**107 年國文**（LawPlayer 沒有收錄），以及 **26 題**原檔選項或正解殘缺的選擇題（標為「不計分」）；請自行由考選部補上。考試別標「律師＋司法官」（選試科目僅律師）。選試科目預設為**智慧財產法**，列入專業科目練習臺週六的四週輪替。轉換前後的檔案保存在 `data/lawplayer/`。

本站不會自動產生考題。要新增或更新題目：

```bash
node scripts/convert-lawplayer.mjs 下載資料夾 -o lawplayer.json   # LawPlayer 試卷 .txt → 題庫格式
node scripts/import-questions.mjs lawplayer.json --merge         # 匯入
node scripts/import-questions.mjs 我的題目.json          # 第二試申論題（全站共用題庫）
node scripts/import-questions.mjs --daily 每日題.json     # 每日模擬題
node scripts/import-questions.mjs 我的題目.json --dry-run # 只檢查格式
```

欄位、範例與 [LawPlayer](https://lawplayer.com/exam/lawyer) 下載方式見 [題庫匯入指南](docs/QUESTION_IMPORT.md)。**手機使用**請看 [手機使用與部署](docs/DEPLOY_MOBILE.md)：zip 只能在電腦直接開啟，手機需要先上傳到 Cloudflare Pages 取得網址。匯入後重新整理頁面即可練習；若清空題庫，各頁面會顯示如何匯入。

## 主要功能

| 入口 | 可以做什麼 |
| --- | --- |
| [備考書桌](study-desk/) | 保存多次作答、評語、訂正與回想；七類弱點分類；依已學範圍與弱點選題 |
| [專業科目練習](professional/) | 每日 30 分鐘、四格申論草稿、各科評分準則自評、複習排程、AI 批改提示詞 |
| [考古題練習臺](v2.5/) | 依年度、科目、考試別選題；考點拆分、作答方向、系統初評 |
| [每日模擬題](daily-simulation/) | 分科選題、計時、四格草稿與 AI 批改 |
| [主動回憶](active-recall/) | 先回想再核對；另有 9 科作答方法練習（不需題庫） |
| [共同科目](common-subjects/) | 國文作文精修；英文為輔助練習 |
| [函授學習管理](lectures/) | 登錄堂次與進度，預覽 7／30／60／90 天計畫 |

其他：[完整 JSON 備份](backup/)、[列印／PDF](print/)、[離線使用](offline/)、首頁的[全國法規資料庫](https://law.moj.gov.tw/)捷徑與[雙 AI 協作工作臺（外部網站）](https://leokychen.github.io/multi-ai-review-desk/)。

### 每日排程（專業科目練習）

週一憲法與行政法（單週憲法、雙週行政法）、週二民法、週三民事訴訟法、週四刑法、週五刑事訴訟法、週六商事法（公司法、保險法、證券交易法輪替）、週日複習。

### 評分準則（自評用，非官方閱卷標準）

| 科目 | 評分面向 |
| --- | --- |
| 憲法、行政法 | 爭點辨識、規範與審查基準、涵攝、結論與救濟、結構表達 |
| 民法 | 請求權基礎與順序、構成要件、抗辯與例外、涵攝、結構表達 |
| 刑法 | 構成要件、違法性、有責性、未遂共犯競合、涵攝、結構表達 |
| 民訴、刑訴、強制執行法 | 程序爭點、法條與要件、證據或程序效果、涵攝、結構表達 |
| 公司法、保險法、證交法、票據法 | 爭點、法條與要件、實務見解、涵攝、結構表達 |
| 國文 | 立意取材、結構組織、文辭、字體標點、整體表現 |

## 部署前必讀：不要和觀護人站放在同一個網域

為了相容，本站沿用原專案的瀏覽器儲存鍵。瀏覽器以網域區分本機資料，如果部署在 `https://leokychen.github.io/<新儲存庫>/`，會和觀護人站（同為 `leokychen.github.io`）共用同一批紀錄，設定會互相覆蓋，清除紀錄也可能影響另一站。請部署到不同網域（例如 Cloudflare Pages），或先改用新的儲存鍵。詳見[決策 D7](docs/DECISIONS.md)。

## 介面與導覽

2026-10-25 起採「法律筆記本」視覺：紙色底、墨色字、法典紅強調，標題使用內建 Noto Serif TC（OFL，見 `assets/fonts/noto-serif-tc/OFL.txt`）。所有頁面共用 `assets/site-nav.js`（桌機頂部、手機 ≤760px 底部五區：今日／練習／複習／書桌／更多）與 `assets/study-theme.css`（設計代幣）。新增 [練習](practice/) 與 [複習](review/) 彙整頁。設計取捨見 [DECISIONS D16](docs/DECISIONS.md)。

## 評分要點與弱點分析（2026-11-10）

- [爭點骨架回想](outline/)：三分鐘只列爭點，對照考選部評分要點逐點勾選，依 1、3、7、14 天間隔複習。
- [失分清單與閱卷委員的話](official/)：勾「漏掉」的爭點集中列出；閱卷委員的話可依科目與關鍵字篩選；附收錄範圍表。
- [複習](review/)頁最上方的弱點地圖：合併選擇題正確率、評分要點命中率與申論自評，排出各科優先順序。
- 選擇題新增「不確定」標記、錯因、最常出錯的條文、過時題標記。
- 評分要點已收錄 107–114 年法律科目全部 185 題（考選部公布文件，使用者提供 PDF）；另有閱卷委員歷年常提的 9 類錯誤彙整。106 年為掃描檔、114 年海商法與海洋法題庫沒有題目，未能對應。加入其他年度見 [QUESTION_IMPORT](docs/QUESTION_IMPORT.md)。設計取捨見 [DECISIONS D18–D20](docs/DECISIONS.md)。

## 學習資料與隱私

網站不需註冊帳號，紀錄保存在目前瀏覽器（`localStorage`／`IndexedDB`），不會上傳。不同瀏覽器、裝置或網址之間不會自動同步，請定期從[備份中心](backup/)匯出 JSON。請勿輸入可識別個案、機密卷證、密碼或 API 金鑰。

## 開發與測試

純靜態 HTML／CSS／JavaScript，沒有建置步驟；本機預覽請用 HTTP 伺服器（備考書桌使用 ES modules，不能用 `file://` 開啟）：

```bash
python3 -m http.server 8080      # 開啟 http://localhost:8080/
npm --prefix verification/sync ci # 書桌測試依賴（一次即可）
node tests/run-all.cjs             # 全站測試；--quick 只跑第一段
```

測試總管會先在「交付版本」（含已匯入的題庫）上跑資料檢查、單元測試與 12 頁 × 11 種寬度的冒煙測試，再把專案複製到暫存目錄、匯入 `tests/fixtures` 的**虛構測試題**跑瀏覽器端完整流程，不會改動交付的題庫。CI 設定在 `.github/workflows/ci.yml`。

文件：

- [改版規格](docs/LAWYER_JUDGE_SPEC.md)：科目、排程、評分準則、提示詞的單一依據
- [需求與驗收條件](docs/REQUIREMENTS.md)
- [決策紀錄](docs/DECISIONS.md)：刪除、保留與例外的理由
- [測試計畫與結果](docs/TEST_PLAN.md)
- [題庫匯入指南](docs/QUESTION_IMPORT.md)
- [手機使用與部署](docs/DEPLOY_MOBILE.md)
- [原觀護人版文件封存](docs/archive-probation/)

## 授權

原創程式碼依 [LICENSE](LICENSE)（GPL-3.0-only）授權，沿用自觀護人學習平臺。政府試題、教材、Staresto 英文資料與第三方內容不因收錄於此而適用相同授權，匯入題目前請自行確認使用權。

---

維護者：[LeoKYChen](https://github.com/LeoKYChen) · 改版日期：2026-10-25
