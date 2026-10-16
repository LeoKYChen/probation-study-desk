# v2.7 × MCP｜第 3 階段第十五輪（Stage 3o）PDF 視覺／文字雙重驗證報告

**驗收日期：2026-10-16（臺灣時間）**  
**獨立分支：`experiment/v27-mcp-stage3o`**  
**成功的 GitHub Actions：[Run #38877089435](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38877089435)**

## 一、總結論

**本輪新增 44 項合成 PDF 視覺／文字比對測試全部通過；加上前輪 40 項合成 PDF 及既有 228 項裁判服務安全回歸，合計 312／312 項，失敗 0。**

以上是**純合成檔案**與固定渲染器的研究原型驗收，不是合法取得的實際司法院 PDF 測試，更不是實際裁判全文、確定或現在仍公開的證明。

| 重要欄位 | 本輪結果 |
| --- | --- |
| `new_synthetic_visual_tests_passed` | **44** |
| `prior_synthetic_pdf_tests_passed` | **40** |
| `prior_node_regression_tests_passed` | **228** |
| `synthetic_tests_total_passed` | **312** |
| `real_official_pdfs_downloaded` | **0** |
| `real_official_pdf_fulltext_verified` | **false** |
| `real_pdf_visible_text_semantics_verified` | **false** |
| `ocr_verified` | **false** |
| `production_court_pdf_endpoint_enabled` | **false** |
| `stage3_accepted` | **false** |

**CI 驗收證據：** [#38877089435](https://github.com/LeoKYChen/probation-study-desk/actions/runs/38877089435) 顯示 Python `Ran 84 tests`、`OK`；Node.js 回歸 `tests 228`、`pass 228`、`fail 0`，報告 JSON 僅列出測試數目及真實 PDF 仍未驗收的布林狀態。

## 二、主要技術驗證

### 文字層與可視內容不同

| 合成測試 | 原有文字擷取是否可能看似正確 | 本輪雙重驗證 |
| --- | --- | --- |
| 白底白字，文字層仍存在 | 是 | 渲染畫面與正常參考不同，**review** |
| 白色方塊覆蓋原文字 | 是 | 渲染畫面不同，**review** |
| 整頁白色圖形覆蓋、頁面內容仍可被抽出 | 是 | 渲染畫面不同，**review** |
| 同樣的文字移動到其他位置 | 是 | 渲染畫面不同，**review** |
| 移除表格格線 | 是 | 渲染畫面不同，**review** |
| 表格 A／B 欄文字互換可視位置，但繪圖命令及抽出文字順序不變 | 是 | 渲染畫面不同，**review** |
| 改小 PDF crop box，裁切可見內容但文字層仍完整 | 是 | 可視頁面尺寸／像素不同，**review** |
| 只有合成點陣圖片的掃描 PDF | 沒有可信文字層 | 在文字閘門即 **review**，**沒有 OCR** |
| 逐頁文字、畫面與正常的合成參考均一致 | 是 | **synthetic_visual_and_text_passed** |

### 來源及參考文件安全

- 不存在獨立合成參考圖、參考頁數不一致、頁面尺寸不一致、影像雜湊格式無效，均不得通過；
- 合成案號、法院、裁判日期、頁碼及逐頁文字仍必須先通過上一輪 Stage3n 的精確核對；
- 先過 Stage3n 的 `pypdf` 文字比對，**再**用 PyMuPDF 1.26.7 固定渲染倍率（1.25）建立每頁像素 SHA-256，不能兩個步驟任意互換；
- 單頁及整份渲染像素設有限額，避免測試程式毫無節制產生巨大畫面；不過尚缺正式環境的每份檔案沙箱。
- 結果僅包含頁數、成功比較頁數及原因代碼；不保存原 PDF、PNG、像素、案號、正文或當事人資料。

## 三、最重要的已知盲點：參考影像必須真正獨立

本輪專門設了一項**反向測試**：

如果某份 PDF 的文字層與可見內容已不一致，例如採白字白底，但用**同一份有問題的 PDF 本身建立參考影像**，該 PDF 可以通過「和自己影像一致」的測試。

本輪程式會刻意把這類測試回報中的 `real_official_pdf_fulltext_verified`、`real_pdf_visible_text_semantics_verified`、`stage3_accepted` 維持 `false`。因此 **44 項測試全過不代表已解決真實 PDF 可視內容與文字語意的一切差異**。

正式版本至少需要：

1. 可信獨立於受測檔案、能證明與某個**合法取得且當下公開的官方版本**相符的頁面／文本參考；
2. 來源身分、有效公開及撤除／變更證據；
3. 對字型、頁面色彩、掃描 OCR、隱藏字、表格閱讀順序及跨 renderer 差異的分項驗證；
4. 真實 PDF 每次操作的限時、限記憶體、限網路及避免暫存資料落地的安全沙箱；
5. 依個資、業務資料、使用條款及保存週期進行真正的權限控管。

**任何僅由使用者輸入或被同一模型產生的「參考影像」都不可自動被視為獨立證據**。逐像素完全相同也只能表示在固定渲染條件下畫面相同，並不天然具有司法公文書真偽驗證能力。

## 四、測試及修改過程

本輪先在獨立的開發環境製作 44 項合成測試並全數通過，再新增專屬 GitHub Actions 重驗；結果：

- PDF 合成測試（Stage3n + Stage3o）：**84／84**。
- 既有安全回歸測試：**228／228**。
- CI 最終為 **Success**，不是僅有文件、規劃或本地自述。
- 本輪沒有新增實際司法 PDF 下載、網路來源查詢、上傳端點或對外 API；CI 檢查程式均未導入 HTTP 客戶端，亦未寫出 PDF 或 PNG。

## 五、交付檔案

- `experiments/v27-mcp-poc/stage3o_visual_gate.py`：兩階段驗證與像素參考比對。
- `experiments/v27-mcp-poc/test_stage3o_visual_gate.py`：44 項正反合成測試。
- `experiments/v27-mcp-poc/STAGE3O.md`：方法、驗收定義與限制。
- `experiments/v27-mcp-poc/STAGE3O_RESULT.md`：本報告。
- `.github/workflows/test-v27-mcp-stage3o.yml`：專用 CI 及先前安全回歸。

## 六、第 3 階段尚未完成的真實來源驗收

| 項目 | 現況 |
| --- | --- |
| 真實成人公開裁判 HTML 來源與文字擷取 | 前輪已分批驗收，本輪不重做 |
| 真實長篇 HTML（≥ 10,000 正規化字元） | 前輪 **2／2** 通過，本輪不重做 |
| PDF 安全／文字／視覺原型 | **合成 84／84 通過** |
| 真正合法取得的司法院 PDF 全文／逐頁可視性比對 | **0 件，未驗收** |
| PDF 文字層與**獨立可信**官方參考比對、OCR 與表格語意 | **未建立** |
| 裁判確定狀態及全部可能的上訴審級 | **未驗收** |
| 司法機關撤除、更新、離線快取與備份確實清除 | **未驗收** |
| 24 小時點擊當下仍公開的可信來源查核 | **未建立** |
| 第 3 階段整體驗收及正式站部署 | **未通過，未部署** |

**下一步優先決策：** 應先釐清是否有可合法、穩定取得的司法院 PDF 與真正獨立的官方參考版本，及個資／暫存／撤除處理條件，再決定是否進行極小量真實來源測試。否則在 v2.7 中 PDF 類型只能保留「來源存在，但全文未核實」；其他已通過的 HTML、法規及函釋功能不受影響。

## 七、隔離確認

本輪僅在 `experiment/v27-mcp-stage3o` 新增實驗 Python 程式、測試、文件及工作流程，沒有修改 `main`、v2.5、`development/v2.7/`、`services/v2.7-judgment/` 或 Cloudflare；也沒有引入需付費的服務、司法資料帳密或憑證。
