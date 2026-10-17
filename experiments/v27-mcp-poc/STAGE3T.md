# v2.7 × MCP｜第二十輪 Stage 3t 官方原始欄位核對與安全轉換規格

**日期：2026-10-17；分支：`experiment/v27-mcp-stage3t`，沿用 `experiment/v27-mcp-stage3s` 成果。**

## 一、官方資料能證明什麼、不能證明什麼

### A. 法務部法規資料

原始參考：[政府資料標準平臺「法制／法規／法規中文」](https://schema.gov.tw/lists/96)、[法務部資訊處「中文法規_法律資料檔下載」](https://data.gov.tw/dataset/18289)。

官方**政府資料標準**有以下英文欄位，為本輪可追溯的名稱：

| 官方標準欄位 | 官方定義（摘要） | 本輪內部研究欄位與限制 |
| --- | --- | --- |
| `StatName` | 法規名稱 | `title`，仍是未查證的來源候選 |
| `StatURL` | 機關法規網站該法規連結 | 限定 `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=...` 形狀，不證明真的拿到官方內容 |
| `StatModifiedDate` | **法規最近一次異動日期** | `latestChangeCandidate`，**不能冒充修正公布日** |
| `StatEffectiveDate` | **法規生效日期** | `statuteEffectiveMetadataCandidate`，**不能推論指定條文的施行日** |
| `StatAbandonNote` | 廢止註記，已廢止值為「廢」 | `listedRepealed` 僅是標準資料註記候選，尚未經當下官方查證 |
| `StatContentType` | 01 逐條型、02 單篇型 | 不混淆兩種內容結構 |
| `StatContent` | 單篇型文字，逐條型為空 | 只檢查合成結構，**不寫入正式資料庫** |
| `StatArticles` | 逐條型條文集合，單篇型為空 | 原型最多檢查 12 筆合成欄位 |
| `ArticleType` | C 編章節、A 一般條文 | 不把編章節錯誤當成一條完整條文 |
| `ArticleNo` | 條號，如 15-1 | 只有一般條文才驗證 |
| `ArticleContent` | 條文內容 | 只做結構驗證，不在輸出保存文字 |

**關鍵差異：** 政府資料標準的英文欄位並不能直接證明下載 XML 內的 XML tag 就是 `StatName`、`StatEffectiveDate` 等。本輪尚未成功獨立下載並檢查官方 XML 原始資料檔及原始樹結構，故 `exactOfficialXmlTagNamesValidatedFromDownload=false`。未來接入時要逐一核對真正 XML/JSON 節點和資料型態，不能憑欄位名稱編造 API 格式。

官方資料集另標示：**提供機關法務部資訊處，XML／ZIP 資料資源，更新頻率每月，免費，政府資料開放授權條款第 1 版**。這些是資料集發布平台的說明，不代表使用當日全庫已最新、每條法規都立即施行，也不保證下載端點永遠可用。

中央法規標準法第 12 至 15 條等規範同樣顯示，施行日期與效力起算並非一律等同公布日。法律個別條文的施行、特別條款與過渡規定，必須有其自身足夠來源，不能用全法資料標準的一個日期欄推估。

### B. 法務部行政函釋資料

官網公開來源： [法務部主管法規查詢系統一筆一般行政函釋的友善列印頁](https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id=FE315630&media=print&type=e)。官方公開頁面可辨識的欄位文字有**「發文單位」「發文字號」「發文日期」「要旨」**；該頁可見本文中的「主旨」「說明」段落，但**頁面出現這些詞本身，不等於所有公文版本及附件均已獨立驗證完整**。

本輪只建立「假設已從官方頁面可信獨立抽取各欄位」的**合成來源資料模型**。不把 HTML 上的任一 `主旨` 關鍵字視為可認證全文，亦不把站方摘要轉換為官方要旨。

- `issuingAgencyCandidate`、`issueNumberCandidate`、`issuedOnCandidate` 對應上述可見欄位；民國日期只支援已辨識的「民國 XXX 年 XX 月 XX 日」格式，其他格式維持不確定。
- 有 `officialAbstractCandidate` 的合成輸入，也只列為 **candidate**；**不呈現全文、要旨原文或官網深連結**，避免來源欠權威。
- `fullTextTier="unavailable"`、`interpretationLegalEffect="unknown"`；需另行驗證函釋完整性及現行法律效力。
- 原 Stage2 **17 件官網全文、4 件僅要旨**的歷史驗收成果，**本輪不重新核對**，不將例示 FE315630 誤當 21 件既有個案之一。

## 二、原型的實際執行範圍

- `stage3t/official-field-mapper.cjs`：利用上述有官方標準／頁面支持的欄位與資料型態，寫入純離線的候選正規化流程。**只有 `synthetic:true` 人工測試輸入**可進入；沒有可操作的真實官方資料寫入端點。
- `stage3t/official-field-mapper.test.cjs`：針對日期、網址精確來源、單篇／逐條、條號、要旨與全文不可混用、目前效力不推論等測試；與既有 Stage3s、Stage3q 的結果隔離。
- `stage3t/public-label-probe.py`：限定從司法院**以外**兩個已知**一般公開**網頁做純讀取、有限 HTML 可見欄位檢查（中央法規標準法公開網頁；另一份與既有函釋 21 件不同的一般公開行政函釋）。只保留 HTTP 狀態及欄位「有無」的計數，**不保留頁面全文、條文、函釋、文號、網址或摘要於 CI JSON**。任何 403、逾時、反機器人保護或欄位缺漏都回報 review，不稱已核對原文或曾確認現行效力。

上述公開網頁讀取**不是** XML 下載、非正式 API 認證，也沒有對舊有 20／21 個樣本重新查詢。

## 三、正式站導入仍需獨立驗收

完整路徑應是「**官方真實 XML/網頁欄位可核實 → 正確版本/資料來源 → 依資料型態安全映射 → 完整原文獨立比對 → 現行施行/函釋效力查核 → 另經正式 UI 與安全驗收**」。

缺任何一環只允許 `schema_candidate_unverified`，不能因 `StatEffectiveDate` 恰有日期就宣稱個別條文已施行，不能拿修正異動日當公布日，也不能看見「主旨」或「說明」就宣稱完整函釋原文。

**本輪零正式寫入：** `main`、v2.5、`development/v2.7/`、`services/v2.7-judgment/`、Cloudflare 皆保持不變。不登入會員、儲存機敏司法資料、讀取非公開少年事件、擷取裁判 PDF 或製作 PDF 轉存功能。正式 `stage3_accepted=false` 保持阻擋。
