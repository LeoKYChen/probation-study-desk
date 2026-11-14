# 題庫匯入指南

所有題庫都由 `scripts/import-questions.mjs` 寫入。**不要手動編輯題庫檔**：同一份題庫在 `questions.js`、`v2.5/questions.js`、`professional/source-main-questions.js` 有三份副本（相關題庫同理），腳本會同時寫入並重建主動回憶；測試會檢查三份是否一致。

腳本只檢查格式，**不會核對題目來源、法條或參考要點是否正確**。請只匯入你有權使用的題目。

## 〇、最快的做法：從 LawPlayer 下載試卷轉換

[LawPlayer](https://lawplayer.com/exam/lawyer) 收錄律師考試 91–115 年試題（資料來源考選部，標示政府資料開放授權），每份試卷頁面都能下載 `.txt`。

1. 在 LawPlayer 打開試卷頁，下載 `.txt`，全部放在同一個資料夾（例如 `下載/lawplayer/`）。
2. 轉換：

   ```bash
   node scripts/convert-lawplayer.mjs 下載/lawplayer -o lawplayer.json
   ```

   程式會逐檔列出結果；有「注意」的檔案請對照考選部原卷。程式會核對每份試卷的配分合計是否等於滿分，不符時代表漏題或切錯。
3. 匯入：

   ```bash
   node scripts/import-questions.mjs lawplayer.json --merge
   ```

轉換程式會處理 LawPlayer 下載檔的已知問題：

- 還原被拆錯的題號（LawPlayer 有時把參考法條裡的「二、」當成第 2 題開頭）。
- 刪除重複貼上的參考法條與殘句。
- 參考法條裡的「二、」「三、」等列舉款次不會被切成新題（新題開頭之後必須有配分，且中間沒有條號）。
- 題目開頭混入其他題的參考法條時，予以刪除並提醒。
- 合併 PDF 斷行，並把參考法條附在題目最後的「【參考法條】」段落。

**交付版本已內含 111–114 年第二試 96 題**（轉換結果在 `data/lawplayer/`）。已知缺漏：114 年海商法與海洋法（112 年憲法與行政法第 1 題已於 2026-11-10 由考選部原卷補入）；請由[考選部考畢試題查詢](https://wwwq.moex.gov.tw/exam/wFrmExamQandASearch.aspx)補上，用 `--merge` 匯入。

第二試試卷是合卷（例如「憲法與行政法」），題目會以合卷名稱匯入；專業科目練習臺在憲法日、行政法日都會抽到這類題目。

第一試選擇題會另存為 `lawplayer-stage1.json`。科目與卷別依 107 年起的配分推定：卷一（刑法 35、刑事訴訟法 25、法律倫理 15）、卷二（憲法 20、行政法 35、國際公法 10、國際私法 10）、卷三（民法 50、民事訴訟法 30）、卷四（公司法 15、保險法 10、票據法 10、證券交易法 10、強制執行法 10、法學英文 15）。以 `--mcq` 匯入（見下方「第一試選擇題」）。

**律師與司法官共用試題：** LawPlayer 的檔名標示「律師」。依 115 年考試的公告，司法官與律師考試除律師第二試選試科目外採同一試題（見[聯合新聞網報導](https://udn.com/news/story/7314/9431501)）；若要同時標成兩種考試，轉換時加上 `--exam 律師,司法官`。較早年度是否共用，請自行確認。

**著作權：** 考試試題依著作權法第 9 條第 1 項第 5 款不得為著作權標的，可以匯入；但其他網站的擬答、解析可能受著作權保護，不要整批複製。法源法學資料庫等付費資料庫請只供自己查閱。

## 一、自備題目（JSON／CSV）

```bash
node scripts/import-questions.mjs 題目.json            # 整份取代現有題庫（會覆蓋已內含的題目）
node scripts/import-questions.mjs 題目.json --merge    # 合併；相同 id 以新內容為準
node scripts/import-questions.mjs 題目.csv --dry-run   # 只檢查，不寫檔
node scripts/import-questions.mjs --empty              # 清空所有題庫（含每日模擬題）
```

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `body` | ✓ | 題目全文 |
| `subject` | ✓ | 單科名稱或第二試合卷名稱（憲法與行政法、民法與民事訴訟法、刑法與刑事訴訟法、公司法、保險法與證券交易法）。單科必須是下列之一：憲法、行政法、民法、民事訴訟法、刑法、刑事訴訟法、公司法、保險法、證券交易法、票據法、強制執行法、國際公法、國際私法、法律倫理、法學英文、國文、智慧財產法、勞動社會法、財稅法、海商法與海洋法 |
| `exam` |  | `律師`、`司法官` 或 `律師,司法官`（預設兩者；選試科目預設只有律師） |
| `year` |  | 民國年度，例如 `115` |
| `questionNo` |  | 題號 |
| `title` |  | 省略時自動產生 |
| `points` |  | 參考要點。JSON 用陣列；CSV 用 `\|` 分隔 |
| `direction` |  | 作答方向。格式同上 |
| `source`、`sourceUrl`、`guidanceNote` |  | 來源（`sourceUrl` 須為 https） |
| `bank` |  | `main`（預設）或 `related` |
| `id` |  | 省略時以「年度-科目-題號」產生；之後要更新同一題請固定 id |

**能判斷單科時請用單科名稱**，例如純民法題填 `民法`；腳本會自動補上合卷名稱（`subjectGroup`）。這樣週二練民法時不會抽到民事訴訟法的題目，弱點也不會算到另一科。題目同時涉及兩科時，才用合卷名稱。

**第一試選擇題請用 `--mcq`。** 申論題匯入遇到 `stage: 1` 會擋下並提示改用：

```
node scripts/convert-lawplayer.mjs 下載資料夾 -o lawplayer.json   # 產生 lawplayer-stage1.json
node scripts/import-questions.mjs --mcq lawplayer-stage1.json [--merge] [--dry-run]
```

`--mcq` 欄位：`id`、`year`、`questionNo`（或 `no`）、`subject`（須為第一試十四科之一）、`paper`（卷一～卷四）、`body`、`options`（4 個；CSV 以 `|` 分隔）、`answer`（A–D）、`status`（`ok`｜`multi`｜`incomplete`）、`acceptedAnswers`、`answerNote`、`sourceUrl`（須為 https）。`multi` 是官方更正為「均給分」的題目，`acceptedAnswers` 至少 2 個；`incomplete` 是原檔選項或正解殘缺的題目，不可有正解、不計分。`--empty` 會一併清空選擇題題庫。選擇題存放在 `mcq/bank.js`，紀錄存在瀏覽器的 `psd-mcq-v1`。

JSON 範例：

```json
[
  {
    "exam": "律師,司法官",
    "subject": "民法",
    "year": 115,
    "questionNo": 1,
    "title": "115 年民法第 1 題｜（自訂標題）",
    "body": "（題目全文）",
    "points": ["請求權基礎……", "抗辯……"],
    "direction": ["先列請求權人與相對人", "依序檢查請求權基礎"],
    "source": "考選部考畢試題",
    "sourceUrl": "https://wwwq.moex.gov.tw/..."
  }
]
```

CSV 範例（第一列為欄位名稱）：

```csv
exam,subject,year,questionNo,title,body,points
"律師,司法官",民法,115,1,自訂標題,"題目全文","要點一|要點二"
```

## 二、每日模擬題

```bash
node scripts/import-questions.mjs --daily 每日題.json [--merge] [--dry-run]
```

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `date` | ✓ | `YYYY-MM-DD` |
| `subject` | ✓ | 單科名稱（同上），跨科題填 `跨科整合` |
| `question` | ✓ | 題目全文（也接受 `body`） |
| `issues` |  | 爭點整理；JSON 可用陣列 |
| `outline` |  | 參考架構 |
| `theoryTable` |  | 四欄表 `[[欄1,欄2,欄3,欄4], ...]`，僅 JSON |
| `sourceReference`、`reviewStatus`（預設「待核對」）、`id` |  | |

匯入後腳本會自動重建 `file-data/daily.generated.js`（ZIP 直開離線模式用的資料）。

## 三、其他可以補充的內容（選用）

下列檔案的程式都保留，原觀護人資料已清空；依原格式補上律師、司法官的內容後即可啟用對應功能：

| 檔案 | 內容 | 啟用的功能 |
| --- | --- | --- |
| `v2.5/study-map-data.js` | 每科一筆 `{subject, source, text}`（Markdown） | 考科重點地圖 |
| `v2.5/rubrics.js`、`legal-pilots.js`、`full-pilots.js`、`pending-pilots-data.js` | 以題目 id 為鍵的逐題評分規則 | 考古題練習臺的系統初評 |
| `v2.5/all-topics.js`、`topic-rubrics.js`、`content-standards.js` | 主題與題目的對應、主題評分 | 依考點練習 |
| `daily-simulation/questions.json` 的 `templates` | 各科答題模板 | 每日模擬題的參考模板 |

這些都屬法律內容，**請附可查證的來源**，不要放入未經核對的參考答案或條號。

## 考選部評分要點（官方「評分要點與閱卷委員的話」）

考選部每年公布各科 PDF。把 PDF 依 `<年度>/<檔名>.pdf` 放在同一個資料夾後批次轉換（會整份重寫 `v2.5/official-points.js`）：

```
python3 scripts/extract-moex-points.py --batch <評分要點資料夾>
```

- 檔名依腳本內 `FILE_RULES` 對應科目（例如「刑法」「民一」「海商」「憲法與行政法」）。107 年只取律師卷與選試科目（題庫收的是律師卷）。
- PDF 的「第一題」對應題庫同年同科的第 1 題。例外寫在 `ID_OVERRIDES`：112 年憲法與行政法，題庫原有的 `lawplayer-112-constitutional-administrative-law-1` 其實是原卷第 2 題（LawPlayer 缺第 1 題），第 1 題另以 `moex-112-constitutional-administrative-law-1` 補入。
- 單檔加入：`python3 scripts/extract-moex-points.py <pdf> <年度> <科目> <題庫id前綴> --merge`。
- 轉完請跑 `node tests/unit/official-core.test.cjs`：它會檢查每題都對得上題庫、題號一致、文字沒有在切分時遺失。
- 目前收錄：107–114 年法律科目 185 題（外加 114 年海商法與海洋法 4 題的評分要點，題庫沒有題目，只在「閱卷委員的話」看得到）。
- 無法轉換：106 年 13 份是掃描圖檔，讀不到文字，且題庫從 107 年起。
- 段落由 PDF 版面推斷，偶有切分誤差（例如標題與第一句黏在一起），請以原文件為準。

逐點勾選的「點」不存在資料檔裡，由 `assets/official-points-core.js` 的 `items()` 依標題層級即時切出；常見錯誤類型定義在 `assets/commentary-themes.js`。
