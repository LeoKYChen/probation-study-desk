# v2.7 × mcp-taiwan-legal-db｜第 0 階段隔離測試

## 目的（不改正式站）

確認第三方 MCP 工具可以在獨立的 GitHub Actions 臨時環境中安裝、啟動、列出工具，並透過 MCP `stdio` 介面取得一筆公開法條。

- **自有程式位置**：`experiments/v27-mcp-poc/`，不改 `development/v2.7/`、`v2.5/`、主分支或現有 Cloudflare Pages 部署。
- **隔離分支**：`experiment/v27-mcp-stage0`。
- **上游原始碼**：`lawchat-oss/mcp-taiwan-legal-db`，固定於 commit `ef677ad63c3206fc211a083fad8b1d9ef5015222`（對應上游宣告 1.8.2）。不自動更新第三方程式版本。
- **執行方式**：本分支 push 觸發 `.github/workflows/test-v27-mcp-stage0.yml`；GitHub-hosted runner 執行，無需使用者自己安裝 Python。
- **法律資料**：只查詢公開的《少年事件處理法》第 3 條之 1；不存取少年裁判、非公開案件、個資或私人研究紀錄。
- **秘密資料**：workflow 不讀取任何 GitHub/Cloudflare Secrets，不部署 Cloudflare、不寫入正式資料庫。

## 驗收關卡

| 項目 | 測試方法 | 通過標準 |
| --- | --- | --- |
| 0A 安裝 | 下載固定 commit，pip 安裝到臨時 Python 執行環境 | 安裝成功，記錄版本/commit |
| 0B 工具註冊 | 執行 `mcp.list_tools()` | 註冊工具數為 26，且包含 6 個必要法律檢索工具 |
| 0C MCP 通訊 | Python MCP client 使用 stdio 初始化子程序並列出工具 | 工具可透過標準 MCP 介面存取 |
| 0D 公開法條查詢 | `query_regulation(law_name="少年事件處理法", article_no="3-1")` | 回應不是 MCP error，且包含「少年事件處理法」「通譯」；正式法條全文仍須後續第 1 階段比對官方來源 |
| 0E 安全隔離 | 檢查本次 commit 的差異、工作流程權限 | 不部署、不使用憑證、不修改 v2.7 或 v2.5 正式程式 |

**判定**：0A–0E 全部通過才可標為第 0 階段驗收通過；任何一項失敗都是「待修正」，不得誤認為 MCP 已整合上線。第 0 階段只證明可執行，不證明法條完整正確、穩定性、資料授權或實際部署可行。

## 查詢失敗時的處理

先查看 Actions 的 `smoke` 工作日誌與 `v27-mcp-stage0-results` 結果。常見原因可能是上游套件安裝失敗、MCP SDK 不相容、Python 子程序無法啟動、官方網站封鎖或逾時。先確認是環境問題還是資料問題，再調整下一輪，不得直接跳過測試。

此文件是工作計畫與驗收標準；**是否通過必須以該分支 GitHub Actions 的實際結果為準**。
