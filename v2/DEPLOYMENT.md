# 觀護人考古題練習臺2.0

此部署包已獲使用者同意，惟GitHub寫入回傳403，尚未發布。

部署目標：https://leokychen.github.io/probation-study-desk/v2/
原站1.0：https://leokychen.github.io/probation-study-desk/

只新增v2目錄，不改動原站四個檔案。首次於同一瀏覽器開啟時複製1.0紀錄，其後兩版獨立儲存。跨裝置或私人測試站請以JSON備份匯入。

全部426題保留。11科各10題，共110題附逐題試評。相似考點、單一考點練習、四項量表置下方、法規依現行法、來源日期及人工覆核提示保留。試評是文字線索涵蓋度，非官方配分或專家校準。

在v2目錄執行檢查：

```
node tests/legal-pilots.cjs
node tests/content-core.cjs
node tests/full-pilots.cjs
node tests/practice-preservation.cjs
```

重新取得GitHub儲存庫寫入授權後，以目前main最新樹為基礎，只新增v2檔案並檢查原站檔案SHA完全不變，再提交並確認Pages部署成功。請勿強制覆寫分支。
