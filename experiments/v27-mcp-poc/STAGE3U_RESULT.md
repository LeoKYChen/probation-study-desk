# v2.7 × MCP｜第 21 輪 Stage 3u 官方法律 XML 結構探查與安全讀取驗收報告

**日期：2026-10-17（臺灣時間）**  
**獨立分支：`experiment/v27-mcp-stage3u`（基於 `experiment/v27-mcp-stage3t`）**  
**最終成功 CI：[Run #39002519434](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39002519434)**

## 一、結論（明確分開合成測試與真實官網結果）

| 項目 | 本輪結果 |
| --- | --- |
| XML 前綴掃描、防止惡意 XML、禁止不當下載的離線合成測試 | **38／38 通過、0 失敗** |
| 真實官方開放資料 XML 端點的 HEAD 查詢 | **已嘗試 1 次；無法取得有效回應** |
| 官方 HEAD HTTP 代碼 | **未取得（`null`）** |
| 官方資料集大小 | **未知（`null`）** |
| HTTP GET 或 Range 請求 | **0 次（未發出）** |
| 實際讀取 XML 前綴位元組數 | **0 bytes** |
| 實際確認官方 XML 根元素／子元素名稱 | **0 項** |
| 取得實際官方 XML 或 ZIP 的內容、法條、個案、個資 | **0 件** |
| 完整官方 XML 格式及真實欄位驗收 | **未通過** |
| v2.5、原有 v2.7、主分支、Cloudflare 修改／部署 | **0 件** |
| `stage3_accepted` | **false** |

**重要：本輪不能稱作已驗證實際 XML 標籤。** GitHub Actions 綠燈表示**安全處理邏輯測試通過，且遇到官網不明狀態時正確停止**，不是成功讀取了原始 XML。

## 二、直接查核的官方資料背景

來源為[政府資料開放平臺資料集 18289「中文法規_法律資料檔下載」](https://data.gov.tw/dataset/18289)，提供機關法務部資訊處，網站標示有 ZIP／XML 兩項下載資源，更新頻率列為每月，授權方式為政府資料開放授權條款第 1 版。網站列示的「法規名稱、最近異動、生效日期、沿革、編章節、條文」屬資料集欄位描述。

由資源連結可確認 XML 下載**地址形狀**為 `https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData=CF&DType=RAW_XML`，另有 `DType=XML` 的 ZIP 選項。**可見下載地址不等於已成功取得實檔**。

相關官方結構文件可參照 [「法制 > 法規 > 法規中文」政府資料標準](https://schema.gov.tw/lists/96)。標準有 `StatName`、`StatModifiedDate`、`StatEffectiveDate`、`StatArticles`、`ArticleNo`、`ArticleContent` 等名稱，但**未經官方 RAW_XML 真實回應核對之前，不得宣稱這些與 XML 原始節點名稱完全相同**。

另外其他政府網站可能也使用稱為 `LawName`、`Articles` 等相似欄位；這**不能**取代法務部本份資料集的原始 XML 結構證據，更不應靠猜測擬出正式解析器。

## 三、真實端點的有界查核

第 21 輪採用「先 HEAD，再依大小決定是否執行一次 Range GET」的保守流程。

本次 CI 的官方來源回報：

```json
{
  "status": "review",
  "reason": "official_head_unavailable_no_get",
  "head_code": null,
  "head_content_length": null,
  "range_get_code": null,
  "bytes_inspected": 0,
  "root_tag": null,
  "first_child_tag": null,
  "shallow_tag_names": [],
  "xml_prefix_structure_observed": false,
  "xml_document_complete": false,
  "stage3_accepted": false
}
```

此結果**只證明本次請求在執行環境中無法成功讀取回應**；不表示法務部故意禁止 HEAD、不表示服務已關閉、不表示一定需要會員，也不表示該下載地址違法或無效。本輪沒有嘗試繞過防護或重試大量請求。

已事先設定上限：只有 HEAD = HTTP 200 且可得檔案大小（最少 100 bytes、最多 8 MiB）才允許單次 GET；GET 最多讀取 12 KiB 開頭，禁止跟隨轉址。不論是否遇到 ZIP、HTML、DTD、外部實體、惡意結構都不會存下內容或推定成功。

## 四、測試過程與已修正問題

首批 CI [#39002450213](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39002450213) **失敗**：單元測試的 import 名稱 `xml_prefix_probe` 與實際 CLI 檔名 `xml-prefix-probe.py` 不一致，測試未能匯入，後續報告生成步驟正確拒絕標示完成。

修正方式：用 `importlib.util.spec_from_file_location` 明確載入同一份 CLI 程式作單元測試；不變更 XML 來源限制、失敗門檻或範圍。

最終 CI [#39002519434](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39002519434) **Success**，日誌顯示：

- `Ran 38 tests`
- `OK`
- 官方實際狀態為 `official_head_unavailable_no_get`；
- 最終記錄 `synthetic_xml_prefix_tests_passed=38`，`official_xml_full_document_verified=false`，`full_law_dataset_downloaded=false`。

**不能因第一批不通過就跳過單元測試**，也沒有重複取得既有 Stage1 的 20 件法規或 Stage2 的 21 件函釋。

## 五、驗收的工程安全功能

新增的 `stage3u/xml-prefix-probe.py` + `stage3u/test_xml_prefix_probe.py` 測試下列已實作條件：

1. 只接受資料集 18289 所列完全一致的法務部官方來源 URL。
2. HEAD 沒有確切大小、太大、無法取得或指向其他主機，**均不能繼續 GET**。
3. 讀取被限制為**最多 12,288 bytes**；伺服器不支援 Range 仍不得保存完整資料。
4. ZIP/GZIP/HTML、DTD、ENTITY、格式錯誤均不會視為官方合法 XML 結構。
5. XML 前綴處理只記錄有限**標籤名稱**，不輸出任何元素文字、欄位值、法條或個資；單一前綴只能稱 `xml_prefix_structure_observed_only`，不能當完整 XML 驗證。
6. 原始法規中的修正異動、生效、個別條文施行等**法律效力判定不因 XML 可解析就自動升級**。
7. 模擬官方 HEAD／GET 的單元測試確認：超限時不 GET、網址變更不跟隨、伺服器忽略 Range 時僅讀上限數量。

**此原型不是正式萬無一失的惡意 XML 沙箱；本輪沒有實際惡意來源全文壓力測試、完整 XML 解析、版本更新和即時效力查核。**

## 六、後續建議與是否通過

**本輪安全探查子項（38 項合成測試）通過；實際官方 XML 原始結構子項尚未通過；第 3 階段整體不通過。**

下次不建議反覆要求同一大檔、解壓全部法律資料或嘗試其他未經確認的第三方鏡像。應優先透過官方公布的**資料結構範本、XSD、開發指引**確認原始元素；如果找不到合法公開且足夠的規格，直接記為「官方實檔格式尚待核對」，先保留可用的 Stage1／Stage2 既有檢索成果與 Stage3r 來源分級 UI，不擅自接入正式網站。

## 七、檔案與隔離範圍

本輪新增：
- `experiments/v27-mcp-poc/stage3u/xml-prefix-probe.py`；
- `experiments/v27-mcp-poc/stage3u/test_xml_prefix_probe.py`；
- `experiments/v27-mcp-poc/STAGE3U.md`；
- `experiments/v27-mcp-poc/STAGE3U_RESULT.md`；
- `.github/workflows/test-v27-mcp-stage3u.yml`。

GitHub 分支 `experiment/v27-mcp-stage3u` 只處理上述實驗與專用 CI，**不修改、不合併、不部署** `main`、v2.5、`development/v2.7/`、`services/v2.7-judgment/` 或 Cloudflare；未下載任何裁判 PDF，也沒有使用司法或法務部登入帳密。
