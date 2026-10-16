# v0.6 Phase 1｜Staresto 品質驗收（獨立測試分支）

本階段已獲准依 v0.6 規格開始開發。**這份成果僅執行驗證，不發布題目、不修改 v0.4 每日英文、v0.5 只讀瀏覽器、國文作文、原創80題或任何 localStorage 紀錄。**

## 程式與產出

- `audit.py`：對照已鎖定日期的 Staresto 十個來源儲存庫與逐檔 SHA256，核對 v0.5 4,733 筆索引的原始資料，區分考試性質、答案與選項、篇章、媒體依賴、可能重複與授權標示。
- `test_audit.py`：確認所有資料與來源可對應、分類不會自動發布、舊668題的穩定 ID 不會意外合併。
- `deep_review.py`：對照原作者45題文法逐題頁、原站閱讀與文意選填來源，檢查166筆混合題對應41篇原始文章，並分析77組跨來源相同內容。
- `output/REPORT.md`：每輪可審核統計，來源題目與正式可發布題庫不得混淆。
- `output/candidates.json`：每筆紀錄的準入狀態、擋下原因、原始出處及來源版本。
- `output/duplicate-review.json`：跨來源完全相同題幹、選項與答案的疑似重複群；不同版本的參考試卷需要保留差異。
- `output/legacy-crosswalk.json`：原 v0.4 **668題** 與 v0.5 的 ID 對照候選，435題 EXACT，233題 VERIFIED_SOURCE（包含45題文法原始題號比對）；**未執行任何使用者作答移轉**。
- `output/DEEP_REVIEW.md`、`output/deep-review.json`：來源逐題證據與混合題多區塊文章的補充核驗。

## 驗收標準

題目即使通過自動結構檢查，亦只能標記「待內容及權利審核」，不得自動標記已正式發行。舊668題皆找到有來源支持的唯一 ID 對應，但完整內容與權利核准、瀏覽器學習紀錄移轉，仍屬未完成工作。不得因查核完成而擅自改寫作答紀錄。

目前 v0.6 不新增每日訓練題、也不動原有668題。第二輪已確認166筆混合題可對回原站41篇文章，v0.5 的「缺少篇章」屬格式辨識問題；此類題型仍未取得發布資格。下一輪須優先改善不同題型的原始篇章呈現，並逐題查核權利、答案及參考／試辦與正式來源的差異。

## 執行方式

GitHub Actions 會在獨立分支讀取凍結的 `data/staresto-full-catalog-20261016`，執行：

```bash
python staresto-v06/phase1/audit.py
python staresto-v06/phase1/test_audit.py
python staresto-v06/phase1/deep_review.py
```

需先在工作目錄提供唯讀 `staresto-intake/library` 快照，工作流程會自動完成。成果只提交回 `feature/staresto-v06-phase1-quality-gate`，不合併到正式 `main`。
