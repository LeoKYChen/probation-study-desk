# v2.7 × MCP｜第 21 輪 Stage 3u：官方法律 XML 原始結構的有界探查

**日期：2026-10-17；獨立分支：`experiment/v27-mcp-stage3u`，從 `experiment/v27-mcp-stage3t` 延伸。**

## 一、原始來源及法遵範圍

來源為[政府資料開放平臺「中文法規_法律資料檔下載」第 18289 號資料集](https://data.gov.tw/dataset/18289)，提供機關法務部資訊處，標示 ZIP、XML 資源及政府資料開放授權條款第 1 版。

本輪僅嘗試查看該資料集**官方 XML 下載連結的 HTTP 中繼資料，若安全容許再查看最多 12 KiB 的 XML 開頭**：
`https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData=CF&DType=RAW_XML`

同資料集也有 `DType=XML` 的 ZIP 檔案選項。本輪不抓 ZIP、不解壓大型資料、不下載整份法律原始檔、不使用第三方鏡像，也不重測原有法規 20 項及函釋 21 筆。若來源要求身分驗證、反機器人驗證或不可存取，記錄 `review`，不會設法繞過。

### 非常重要的區別

第 20 輪查得的政府資料標準 `StatName`、`StatModifiedDate`、`StatEffectiveDate`、`StatArticles` 等是**標準英文名稱**。除非真的在官方 RAW_XML 回應看到特定實際節點，否則**不能聲稱 XML 的標籤確實就是同名**。即使本輪觀察到開頭元素，也只能代表部分 XML 結構樣本，不能據此推論整份資料的所有欄位與巢狀結構。

## 二、探查的嚴格上限

由 `stage3u/xml-prefix-probe.py` 執行。

- 僅允許**單一完全一致的法務部官方 HTTPS URL**，不得任意變更來源、附加 Token、參數或轉址。
- 必須先執行一次 HEAD：回傳 HTTP 200 並提供可信的 `Content-Length`，**整份檔案大小不超過 8 MiB**，才進行一次 GET。
- GET 帶有 HTTP `Range: bytes=0-12287`，且不論伺服器是否支援 Range，**最多只讀 12,288 bytes**，立即關閉串流。若伺服器忽略 Range，不將 HTTP 200 視為整份檔案已下載或完成驗證。
- 單一請求逾時 9 秒；禁止追蹤轉址、禁止外部代理、自動重試、登入、PDF 或官方司法案件查詢。
- 若是 ZIP、GZIP、HTML、JSON、DTD、XML ENTITY 或格式不明，不會解壓或解譯成已驗證 XML，直接 `review`。
- 使用無外部資源讀取的 Expat 串流解析器，只記錄**安全字元組成的淺層標籤名稱**，最多 20 個；不記錄欄位值、法條、法規名稱、識別碼、來源 URL 或完整 XML 內容。
- 即使前綴辨識成功，仍固定 `xml_document_complete=false`、`official_xml_schema_verified=false`、`actual_xml_field_values_verified=false`、`law_current_effect_verified=false`、`stage3_accepted=false`。
- 任何 HEAD 或 GET 失敗、大小未公布、內容過大，標示該項 `review`，不降低門檻。

## 三、四種可能的有限結果

1. `xml_prefix_structure_observed_only`：官方回應的開頭有限範圍內，可以辨識根元素、第一層元素及少量合法標籤名稱。**只證明該次部分結構可觀察**，不是整份 XML 驗收。
2. `official_dataset_too_large_or_empty`：檔案超過 8 MiB 或太短，不發出資料 GET。後續改查正式結構文件、XSD 或由官方提供的極小量合法範例。
3. `head_size_not_disclosed_no_get`／`official_head_unavailable_no_get`：無法安全判斷檔案大小或來源暫不可取得，不嘗試下載。
4. `review`（XML 格式問題）：官方資源回傳 ZIP、HTML、DTD、無法解析前綴或其他媒體型態，直接保留未驗。

以上任何結果均**不允許啟用正式法律資料服務**。最終報告會填入 CI 實測事實，不因 workflow 綠燈自行宣稱 XML 已成功讀取。

## 四、其他資料類型與部署隔離

既有 Stage1 法規 20／20 指定樣本、Stage2 函釋 17 件全文／4 件僅要旨、Stage3r 離線介面、Stage3s 來源契約及 Stage3t 官方欄位規格仍維持先前的有限驗收結論。本輪不變動相關原始程式、不修改 `development/v2.7/`、`services/v2.7-judgment/`、v2.5、`main` 或 Cloudflare。

**沒有 PDF 轉存、裁判書下載、未公開少年事件資料、官方登入憑證、付費服務或部署。**

## 五、下一輪準則

若能觀察開頭 XML 標籤，可將有限根元素與巢狀關係加入只讀參考，但必須另取合法且可信的完整官方版本或官方 XSD／樣例，才可逐欄對照、生效日期與修正公布日；若檔案過大或未公開完整結構，**直接保留未驗，不應循環增加大量合成測試取代缺少的官方資料**。
