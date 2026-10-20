# v2.7 × MCP｜第 22 輪（Stage 3v）法規 XML「來源識別／格式版本」隔離

**執行日期：2026-10-20（臺灣時間）**  
**實驗分支：`experiment/v27-mcp-stage3v`，由 `experiment/v27-mcp-stage3u` 開出。**

## 一、新找到的「官方文件」證據（本輪和前 21 輪的實際差異）

法務部政府資料開放諮詢小組之公開簡報，出現一項對 XML 開發非常重要的描述：

> 兩者內容來源一致(均為「全國法規資料庫」)，故內容並無差異，僅XML標籤不同。

官方簡報：[法務部公開會議簡報](https://www.moj.gov.tw/media/30228/%E7%B0%A1%E5%A0%B1.pdf?mediaDL=true)（PDF 第 14 頁，文件顯示「113 年度政府資料開放諮詢小組」相關報告）。前頁內容是民眾詢問**英譯法規 XML**：全國法規資料庫網站與政府資料開放平臺 XML 為何結構不同。

**證據範圍必須收窄：** 此簡報直接證實的是「法務部曾在英譯法規的跨管道案例指出資料內容來源相同、XML 標籤不相同」，**並非**已實證「所有中文法規 XML 在 2026 年仍同樣採何種不同標籤」，更不是可直接建立完整中文法規 XML parser 的 XSD。

其他官方依據：

- [政府資料開放平臺資料集 18289：中文法規法律資料](https://data.gov.tw/dataset/18289)，有 XML 與 ZIP 資源，發布單位法務部資訊處。
- [政府資料標準平臺：法規中文欄位標準](https://schema.gov.tw/lists/96)，列 `StatName`、`StatModifiedDate`、`StatEffectiveDate`、`StatArticles` 等**概念與標準欄位名稱**。
- [法務部舊資料集之相關網址](https://www.moj.gov.tw/2204/2771/2773/112943/)曾列 `http://law.moj.gov.tw/PublicData/DevelopGuide.aspx`。本輪查找對應 HTTPS 的開發指南 URL，但**未取得足以逐欄解析的內容或 XSD**，不可把指南網址視為已下載的文件。
- 前輪 [Stage 3u](STAGE3U_RESULT.md) 的 GitHub Actions 僅作安全 HEAD，回應 `official_head_unavailable_no_get`；沒有下載 RAW_XML，**根元素與實際欄位均未查證**。

## 二、這次新增的是「不能混用」的防錯機制，而非臆測的 XML parser

程式：`stage3v/source-profile-gate.cjs`。

它將來源「用途」與實際解析器的信任層級分開處理：

| 來源 | 分類 | 可以代表什麼 | 不能代表什麼 |
| --- | --- | --- | --- |
| `sendlaw.moj.gov.tw` `DType=RAW_XML` | `open_data_law_raw_xml` | 官方公開資料的 XML 下載入口（路徑） | 尚未拿到 RAW_XML，本輪不能選定其根元素、逐條節點或正式 parser |
| `sendlaw.moj.gov.tw` `DType=XML` | `open_data_law_zip` | 官方資料集的封裝檔入口 | ZIP 不等於可解析的 RAW_XML，不自動解壓 |
| `law.moj.gov.tw/PublicData/DevelopGuide.aspx` | `law_site_export` | 早期官網列示的開發指引參考入口 | 非已核實的完整現行 XSD 或 RAW_XML 資源 |
| `schema.gov.tw/lists/96` | `government_law_data_standard` | 標準欄位概念及定義 | 不代表實際官方 RAW_XML 一定使用 `Stat*` 原始標籤 |
| `data.gov.tw/dataset/18289` | `dataset_listing` | 發布機關、資料集形式與頻率 | 不是本身可解析的 XML |
| 法務部官方簡報 | `source_format_difference_evidence` | **英譯法規跨發布管道** XML 標籤差異的官方歷史說明 | 不能認證中文法規現行 XML 內容、元素或一致性 |

所有來源 URL 都要**完整精確匹配**，任何 HTTP 降級、類似官方的假網域、夾帶 Token、任意改寫下載參數、偽造來源 ID 都拒絕；即使來源網址合法，也只表示**用途可辨識**，**不代表實際檔案已驗證**。

## 三、可執行函式與預期結果

- `classifyOfficialReference(sourceUrl)`：只返回上述**來源角色**；不下載、不開啟 API、不提供真實法條／個別裁判。
- `assessParserSelection({sourceUrl,claimedProfile,...})`：要求來源與聲稱的發布管道一致。即使正確選擇 `open_data_law_raw_xml`，仍回 `awaiting_authenticated_raw_xml_structure`，因 Stage 3u **沒有實際 XML 節點證據**，無權啟動正式 parser。使用者附加的 `verified=true`、`rootTag="StatName"` 等不具獨立證明力，不能繞過。
- `reconcileStandardAndSource(...)`：政府資料標準與實際 XML 的兩種角色不得合併。標準字典的 `StatName` 等可做對應候選，但 `currentRawXmlMappingVerified=false`。
- `syntheticTagRelationship(...)`：人工合成的 A／B 兩套**明顯不同的假標籤**，可做「不同資料格式不能混用」的隔離測試；即使 A 與 A 自行一致，也**不會**變成官方真實 XML 格式核對通過。
- `sourceStatus()`：匯總已有的官方文獻依據與尚未解決的真實 XML 證據缺口。

任何呼叫結果**一律**保留 `canSelectProductionXmlParser=false`、`canDeploy=false`、`currentLawInForceVerified=false`、`stage3Accepted=false`。

## 四、工程驗收與隔離限制

測試採 Node 24，分別驗證來源格式、精確來源識別、真實資料標準不自動變 XML 標籤、虛假已驗證旗標、錯誤資料家族、文字／日期效力未確認及與 Stage3q／Stage3t 安全阻擋互通。

**不再請 GitHub Actions 反覆打前輪不可取得的大型 RAW_XML URL。** 本輪的 CI 是**純離線**。GitHub Actions 結果通過代表以上**路由及來源邊界程式**完成測試，不代表官方原始 XSD 成功下載。

未修改 `main`、v2.5、`development/v2.7/`、`services/v2.7-judgment/`、Cloudflare，未使用真實司法帳密或非公開少年資料，未製作 PDF 轉存。

## 五、具體下一步

有三種合理選擇：

1. 若取得法務部正式中文法規 XML/XSD 或開發指南的**可驗證原始內容**，先核對它**究竟是網站資料流還是政府開放資料平臺流**；記錄實際 root／child tag、namespace、版本、日期型態及條文結構，才增加來源專屬 parser。
2. 若資料檔太大或端點不可取得，優先尋求官方小量 XML 範例或規格文件；不能用第三方資料鏡像偷代官方憑據。
3. 若上述來源仍不可用，避免無止境增加合成 XML 測試；繼續開發已完成抽樣驗收的**法規與函釋分級查詢介面及來源更新機制**，所有實際現行法問題仍需獨立核對。

**本輪是來源／格式隔離子階段，不是整體 Stage3 驗收放行；尚無任何完整中文法規 XML 現場解析證據。**
