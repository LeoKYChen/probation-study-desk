# v2.7 × MCP｜第 3 階段第十四輪（Stage 3n）PDF 安全及逐頁完整性驗收結果

**驗收日期：2026-10-16（臺灣時間）**  
**獨立分支：`experiment/v27-mcp-stage3n`**  
**最後成功的 GitHub Actions：[Run #38872625315](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38872625315)**

## 一、本輪結論

**離線合成 PDF 原型驗收：40／40 項通過、0 失敗。**

同一 CI 另跑既有 Stage3d、Stage3e、Stage3f、Stage3g 與私有裁判服務的 **228 項回歸測試，228／228 通過、0 失敗**；總計 **268／268 項測試通過**。

以上均是程式與合成案例的驗證，**沒有對司法院真實 PDF 執行全文下載或逐頁比對**。因此：

- `synthetic_pdf_unit_tests_passed = 40`
- `synthetic_pdf_unit_tests_failed = 0`
- `prior_regression_passed = 228 / 228`
- `real_official_pdfs_downloaded = 0`
- `real_official_pdf_fulltext_verified = false`
- `ocr_verified = false`
- `individual_judgment_url_approved = false`
- `stage3_accepted = false`

本輪**不可表述成「司法院 PDF 全文已驗收通過」**。

## 二、實際通過的防護測試

| 檢驗範圍 | 實測結果 |
| --- | --- |
| 合成單頁／三頁 PDF 全文逐頁對照 | 通過，需每頁預期文字完整對應 |
| 已比對頁數與 PDF 實際頁數不一致 | 正確保留 review |
| 當次缺少獨立逐頁參考 | 正確保留 review |
| 文字被改寫、末頁出現差異 | 不通過；即使前幾頁正確也不能算全文一致 |
| 第一頁假案號、法院、日期不符 | 不通過；合成案號後加尾碼亦不能混充同案 |
| PDF 頁序標記錯誤或重複 | 不通過 |
| 空白／無可提取文字（含影像掃描模擬） | review，不自動啟用 OCR |
| PDF 損毀、HTML 冒充 PDF、檔案容量超限 | 阻擋 |
| 已加密 PDF、嵌入附件／互動特徵 | 阻擋 |
| 頁數超限、單頁超長、參考頁格式錯誤 | 阻擋 |
| 使用真實案號、未授權／非公開假來源、錯誤網域 | 阻擋 |
| 成功的合成測試是否開啟真實裁判連結 | **始終不開啟** |

程式只輸出狀態、原因碼、頁數、成功比較頁數及是否通過合成測試的布林值，不輸出任何模擬文本或 PDF bytes。

## 三、開發期間曾發現並修正的問題

1. 第一批 CI 測試 [#38872482291](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38872482291) 未通過，測試夾具對超限 PDF 頁數的預期頁列表有設定錯誤，並發現第一頁案號採取「子字串包含」可能把帶額外尾碼的假案號視為相同。
2. 第二批 [#38872552684](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38872552684) 已修正測試夾具，但精確案號比對問題仍由負面測試正確揭露。
3. 正式修正：所有首頁識別、頁序均採**逐頁逐行的精確標記判斷**，不得僅比較前綴子字串；最終 [#38872625315](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38872625315) **40／40 PDF 合成測試與 228／228 既有回歸測試全部通過**。

這次保留了已揭露之偽陽性測試，未刪掉失敗情境，也未降低任何核對標準。

## 四、本輪新增檔案

- `experiments/v27-mcp-poc/stage3n_pdf_gate.py`：無網路、記憶體 PDF 閘門。
- `experiments/v27-mcp-poc/test_stage3n_pdf_gate.py`：完全人工合成 PDF 及 40 項正反測試；不使用真實裁判。
- `experiments/v27-mcp-poc/STAGE3N.md`：範圍、來源前提與限制。
- `experiments/v27-mcp-poc/STAGE3N_RESULT.md`：本報告。
- `.github/workflows/test-v27-mcp-stage3n.yml`：離線合成測試與既有安全回歸。

## 五、仍無法通過的項目

1. **真實 PDF 正文來源及使用授權**：未取得真實 PDF，未能確認從司法院哪一種正式合法管道取得及如何取得可回查的同版原始檔。
2. **獨立原文比對**：合成逐頁參考與合成 PDF 都由同一測試夾具產生；不是官方獨立提供的全文。不得據此宣稱真實裁判 OCR／PDF 抽取精準。
3. **中文長篇、直排、表格、附表、掃描圖文**：本輪以 ASCII 合成文本為主，未做真實中文 PDF 版面與影像層對照。即使 PDF 有文字層，也可能與讀者看到的影像呈現不同。
4. **惡意檔案執行資源防護**：雖限制 PDF bytes 與頁數，尚未導入每檔獨立受限程序、CPU／記憶體／解壓縮額度、不同 PDF 引擎互驗。不能把此原型當成開放任意上傳的正式安全沙箱。
5. **裁判確定及全部歷審鏈**：先前清單比對通過，仍不代表裁判已確定。
6. **持續公開、撤除、歷史快取、備份及日誌合規**：Stage3c/e 僅有合成模擬，真實環境尚未驗收。
7. **司法開放 API 授權與全年全天候查核**：未具備可信即時當下公開證據。

## 六、下一步建議

**先進行合成 PDF「可視版面與文字層不一致」的負面驗證**，必要時採兩種 PDF 工具獨立檢查頁面渲染與文字擷取差異，維持未確認即不核准全文的策略。對於掃描圖形、表格或直排 PDF，沒有可信來源及人工複核時不得依 OCR 片段直接判定官方全文一致。

另應先完成司法院真實 PDF 取得方式／使用規範／公務資料保護要求的法遵確認，才由使用者另外決定是否要進入最小量的正式來源測試。**此輪沒有做任何真實 PDF 下載，也沒有部署網站。**

## 七、網站與分支隔離

本輪只在 `experiment/v27-mcp-stage3n` 的 `experiments/v27-mcp-poc/` 及獨立 `.github/workflows/` 新增測試與文件。沒有修改 `main`、v2.5、原有 `development/v2.7/`、`services/v2.7-judgment/` 或 Cloudflare。原有合法公開裁判 HTML 擷取／法規及函釋成果保留不動。
