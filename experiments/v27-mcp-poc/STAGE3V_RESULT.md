# v2.7 × MCP｜第 22 輪（Stage 3v）法規 XML 發布來源／格式隔離驗收結果

**驗收日期：2026-10-20（臺灣時間）**  
**獨立分支：`experiment/v27-mcp-stage3v`，承接 `experiment/v27-mcp-stage3u`**  
**成功的 GitHub Actions：[Run #39383602239](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39383602239)**

## 一、完成結果

本輪新增**官方來源與 XML 來源家族的隔離判定**，避免工程師拿到一份「政府資料標準」或一份「全國法規資料庫開發指南」時，誤認為已知道另一個下載通路 XML 的實際節點。

| 檢核項目 | CI 實測 |
| --- | ---: |
| 本輪 Stage3v 來源判定、安全阻擋及文件邊界測試 | **65／65 通過，0 失敗** |
| 前輪 Stage3t 官方「欄位概念」保守映射回歸 | **49／49 通過，0 失敗** |
| **總合計** | **114／114 通過** |
| Stage3u 不可取得的法務部 RAW_XML 重新 HEAD／GET | **0 次，沒有反覆請求** |
| 官方完整 XSD 或真實中文法律 XML 標籤驗收 | **0 件／未通過** |
| 存取任何真實法條全文／個別裁判 PDF／未公開少年事件 | **0 件** |
| 更動原 `main`、v2.5、`development/v2.7/`、裁判服務 Worker、Cloudflare | **0 件** |
| 允許正式 XML parser、資料合併或部署 | **否** |

這個結果代表**研究程式的來源邊界安全檢查通過**；不能宣稱「政府中文法規 XML 正式格式已確認」或「現行法規資料全部完成驗收」。

## 二、本輪找到並正確限制適用範圍的官方文件

**法務部政府資料開放諮詢小組公開簡報**（[法務部 PDF，第 13–14 頁前後](https://www.moj.gov.tw/media/30228/%E7%B0%A1%E5%A0%B1.pdf?mediaDL=true)），在民眾詢問**英譯法規**相關資料源的情境中，表示全國法規資料庫網站和政府資料開放平臺的內容來自同一來源，但 **XML 標籤有所差異**。

因此本輪納入以下正確且有限的結論：

1. 法務部的**歷史英譯法規示例**證明不同發布管道可能提供不同 XML 標籤。
2. 不能自動類推至**現行的每一份中文法規 XML**；沒有看過實際標籤就不得宣稱已確認。
3. [政府資料標準平臺「法規中文」](https://schema.gov.tw/lists/96)的 `StatName`、`StatModifiedDate`、`StatEffectiveDate` 等，是政府資料**標準**的欄位名稱，不等於法務部 [資料集 18289](https://data.gov.tw/dataset/18289) 目前下載的 XML 檔**必然使用同名 tag**。
4. 先前 Stage3u 真實官方 HEAD 無法取得資料，**目前可確認的中文 RAW_XML 實際 XML 根／子元素仍然是零**。
5. 舊的開發指南參考網址 `law.moj.gov.tw/PublicData/DevelopGuide.aspx` 由法務部舊公開資料頁提及，但本輪**無法取得可查核的完整 XSD 或現行下載格式文件**；只將該 URL 登錄為**指引參考**。

## 三、實際新增的程式安全功能

`experiments/v27-mcp-poc/stage3v/source-profile-gate.cjs`：

- 分別辨識六類文件角色：RAW_XML 地址、ZIP 封裝檔、官網開發指南參考、政府資料標準、資料集清單與官方歷史簡報；
- 即使是官方合法網域，也**不得用網域名稱代替權威實際下載回應**；
- 不受任意填入的 `verified=true`、`rootTag="StatName"`、`officialSourceVerified=true` 或第三方網域影響；沒有實際來源憑據一律不選定正式 parser；
- **政府資料標準詞彙字典**與**XML 原始節點家族**是兩種不同資料類型，不能直接等同；
- 測試兩套特意設計、名稱完全不同的**人工合成 tag**，證明來源切換的阻擋邏輯；這兩套假 tag **沒有被冒充為法務部官方 XML 標籤**；
- 輸入錯誤來源、不相符的格式家族、不合法字串，不會直接回顯未經驗證的 URL 或敏感內容；
- 即使被呼叫者自行提供官方文件或憑證字串，`canSelectProductionXmlParser=false`、`canDeploy=false`、`stage3Accepted=false` 仍不變。

`experiments/v27-mcp-poc/stage3v/source-profile-gate.test.cjs`：**65 項**可執行測試，涵蓋官方來源角色、防惡意 URL、來源混淆、合成 tag 差異、假憑證、防上線及與 Stage3q／Stage3t 的正確銜接。

**注意**：不能把此原型當成「可信來源身分認證」或成熟的實際 XML parser。它目前只有**可信文件引用範圍**與「資料家族不混用」安全閘門。若未來有正式 XML／XSD，必須加入真實原始檔、命名空間、相同法條的獨立驗證、版本 ID、資料正確性及變更追蹤，才可進入正式資料服務。

## 四、CI 正式驗收證據

[GitHub Actions #39383602239](https://github.com/LeoKYChen/probation-study-desk/actions/runs/39383602239) 最終為 **Success**。日誌記載：

- 新增測試：`tests 65`、`pass 65`、`fail 0`。
- 前輪 Stage3t 回歸：`tests 49`、`pass 49`、`fail 0`。
- 測試文件對照明確限制：法務部簡報的差異案例是**英譯法規比較的歷史紀錄**，**不認證所有現行中文 XML**。
- 相對於 Stage3u 分支的差異只涉及本輪新建的實驗程式、測試、MD 文件與專屬 CI。沒有讀取新的真實官網法律資料或任何非公開少年事件。

## 五、下一輪：不建議一直重複增加抽象 XML 合成測試

經 Stage3t、3u、3v 三輪，本專案的正式來源不確定性已清楚可記錄。下一輪建議：

- **優先**進行法規、函釋的**來源版本狀態與更新失敗降級機制**，配合 Stage3r 既有畫面，向使用者清楚區分「抽樣驗證」、「歷史快照」、「目前來源更新失敗」、「未知效力」；避免在沒有新官方證據時永遠卡在假 XML tag 比對。
- 只有取得法務部可稽核的中文 XML 範例／XSD 或現行正式 API 來源規格，才回到真實 XML parser 研發；**不透過繞過管控、批量下載或第三方鏡像假冒官方資料**。
- 上述任何獨立功能研究都不等於正式網站上線許可，須另行完成資料來源法遵、實際內容忠實性、更新機制與資安測試。

## 六、檔案交付與正式環境隔離

本輪交付：

- `experiments/v27-mcp-poc/stage3v/source-profile-gate.cjs`
- `experiments/v27-mcp-poc/stage3v/source-profile-gate.test.cjs`
- `experiments/v27-mcp-poc/STAGE3V.md`
- `experiments/v27-mcp-poc/STAGE3V_RESULT.md`
- `.github/workflows/test-v27-mcp-stage3v.yml`

本輪**沒有新增 PDF 轉存或上傳**、沒有變更 `main`、v2.5 正式站、`development/v2.7/`、`services/v2.7-judgment/` 或 Cloudflare。第 22 輪來源格式隔離子測試通過，**第 3 階段整體仍未通過，也尚未正式部署**。
