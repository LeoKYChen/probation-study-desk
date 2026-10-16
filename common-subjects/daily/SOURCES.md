# v0.4 題庫來源、使用條件與核對紀錄

本目錄為「116年觀護人共同科目英文基礎練習」的非商業個人學習模組，主要練習素材由 **staresto-create ZZSH** 所整理的學測正式試題提供。這不是司法特考實戰題庫。

## 使用與著作權

根據 staresto-create ZZSH 的網站聲明（由使用者於 2026-10-16 提供）：
- 正式學測、指考與大學聯考試題的著作權性質，依其所引《著作權法》第9條第1項第5款處理。
- 參考試卷、試辦考試與研究用試題不等同於正式考題，另須遵守大學入學考試中心基金會的使用條件；**本次沒有將這些額外類型的題目匯入站內**。
- staresto-create ZZSH 自行撰寫的解析、中譯、分類、標註與編排受著作權法保護，可供學生／老師於**非商業個人學習及課堂用途**使用與分享；轉載需註明原作者與出處，不得作商業用途或冒稱己作。

**這批資料不屬於本專案根目錄的 GPL 程式碼授權範圍**；請勿推定複製資料後可進行商業使用。採最小必要量收錄可驗證題目，所有站內題目皆帶來源網址、年份、題號與作者標示。若權利人希望調整收錄範圍，可透過本專案 GitHub Issue 反映。

## v0.4 首批收錄

| 本地檔案 | 來源及原站 | 本地題數 |
| --- | --- | ---: |
| `vocab.json` | [staresto-create/JCEE-vocab-questions](https://github.com/staresto-create/JCEE-vocab-questions) `gsat/data.js` 正式「學測」類 | 380 |
| `grammar-1.json` `grammar-2.json` `grammar-3.json` | [staresto-create/grammar-cloze-test](https://github.com/staresto-create/grammar-cloze-test) `q/g107…g115`，正式年度題 | 45 |
| `reading.json` | [staresto-create/reading-comprehension](https://github.com/staresto-create/reading-comprehension) `gsat/items.json` 及 `p/*.html` | 63題、16篇 |
| `completion.json` | [staresto-create/passage-completion](https://github.com/staresto-create/passage-completion) `gsat/items.json` 與 `gsat/passages.json` | 180題、18篇 |
| **總計** | 首批來源可核對的正式學測練習題（非原站全部題庫） | **668題、34篇文章** |

原站可能持續更新；本次使用的是建立資料檔時的內容快照，不宣稱題庫會自動同步原作者最新修改。單字、閱讀與文意選填檔案的來源 blob SHA 保存於 JSON 的 `meta`；文法來源逐題保留原站連結。

## 資料驗證

自動化測試 `node common-subjects/daily/test-v04.cjs`：
- 檢查所有題目 ID 不重複、題型和答案鍵一致、來源網址為作者 GitHub Pages 網站。
- 檢查閱讀及文意選填的篇章關聯存在，選項及答案完整。
- 僅收錄被歸類為正式學測的題目；排除需要額外圖片才能回答的題目。
- 驗證每日星期一至星期日的題單、正確率調級、字卡自評、錯題間隔及跨日記錄。

## 個人紀錄與隱私

- 使用全新 `localStorage` 鍵 `psd-staresto-daily-v04`，**完全不讀取、搬移、更新** v0.1–v0.3 的 `psd-common-subjects-v1`、舊80題、作文草稿，也不影響主站題庫和每日任務。
- 支援 v0.4 獨立 JSON 備份及還原。備份包含個人作答與學習行為，請勿上傳到公開 GitHub。
- 目前沒有外站登入、自動同步、付費 API 或完整 PWA 離線包；第一次開啟題庫需要網路。

作者來源：[staresto-create GitHub](https://github.com/staresto-create)｜[原題庫首頁](https://staresto-create.github.io/JCEE-vocab-questions/)。
