# 學科題出處核對與完整書目（申論評分參考）

核對日期：2026-10-29｜法規版本：全國法規資料庫 2026-10-16 版

## 範圍與做法

- 對象：`law-scoring/data.js` 的學科題（`kind: "theory"`），共 351 題、1,218 個得分點，出處欄（`articles`）共有 490 種不同的寫法。
- 每一種寫法都補上完整書目（作者、年份、書名或篇名、期刊卷期頁碼或出版者），並逐列對照得分點內容，確認出處與內容相符。
- 學科題中引用的法規以全國法規資料庫現行條文核對；少數不確定的學術文獻以出版商或官方網站查證（見文末「查證來源」）。
- **網站沒有任何更動**：`law-scoring/data.js`、頁面與離線清單都沒有修改。完整書目存在 `docs/theory-sources.json`（網站不讀取），本文件是給開發者看的核對報告。
- 另補上 OpenStax 教科書的對應章節（見「教科書出處：OpenStax」），資料在 `docs/theory-openstax.json`。
- 檢查程式 `verification/theory-sources.cjs` 會確認 `data.js` 每一個學科出處都在 `theory-sources.json` 中有對應書目；以後新增或修改出處時，`npm test` 會提醒補上。

## 結果摘要

| 狀態 | 筆數 | 意思 |
|---|---|---|
| 書目已確認 | 381 | 原引用正確，已補完整書目 |
| 原引用不完整，已補建議書目 | 35 | 原引用缺年份、版次或只有姓氏（例如「Andrews & Bonta」「Freud」「Comer, Abnormal Psychology」），已依內容補上建議書目，請對照講義使用的版本 |
| 原引用可能有誤，請核對 | 17 | 作者、年份或篇名與內容不完全相符，詳見下表與說明 |
| 法規或官方文件 | 57 | 法規條次已核對現行法；官方文件已補名稱與年份 |

## 優先處理：出處可能有誤的項目

以下是建議修正 `data.js` 出處字串的項目（目前沒有修改，等你確認）。

| 項目 | 問題 | 建議 |
|---|---|---|
| Beck (1979) | 《Cognitive Therapy of Depression》為四人合著 | 改為 Beck et al. (1979) |
| Dreikurs (1964) | 《Children: The Challenge》與 Soltz 合著 | 改為 Dreikurs & Soltz (1964) |
| Park & Burgess (1925) | 《The City》為三人合著 | 改為 Park, Burgess, & McKenzie (1925) |
| Friedman (1998) | 瘦素回顧文為 Friedman 與 Halaas 合著 | 改為 Friedman & Halaas (1998) |
| Campbell (2003) | 殺害親密伴侶風險因子研究為多人合著 | 改為 Campbell et al. (2003)；TIPVDA 另標我國出處 |
| Teyber & Holmes (2017) | 第 7 版作者為 Edward Teyber 與 Faith Holmes Teyber | 改為 Teyber & Teyber (2017) |
| Regoli & Hewitt (2001) | 查無 2001 年版（第 3 版 1997、第 4 版 2000） | 依講義版次修正年份 |
| Temoshok (1990) | C 型性格代表文獻為 1987 年或 1992 年 | 以講義核對後修正 |
| Christopher et al. (2016) | 2016 年文章刊於 Journal of Police and Criminal Psychology；隨機試驗是 2018 年 | 以講義核對篇名 |
| Gottfredson (1987) | 該年經典為 Gottfredson & Tonry 主編專書 | 確認作者後補全 |
| Lawton (1990) | 「環境主動假設」常引 Lawton (1989)；「環境順從假設」為 Lawton & Simon (1968) | 以講義核對 |
| Bandura (1977) | 1977 年有專書與自我效能論文兩份 | 以 1977a／1977b 區分 |
| WHO (2014) | 自殺題與殺人防治題引用的是兩份不同文件 | 分別標示文件名稱 |
| Prochaska & DiClemente (1982) | 原始模式只有四期，含準備期的五階段見 1992 年 | 五階段題並列 Prochaska, DiClemente, & Norcross (1992) |
| Linehan (1993) | TIPP 技巧為 2015 年第 2 版手冊新增 | police-114-counseling-4 第 1 列改引或並列 Linehan (2015) |
| Wolpe (1958) | 洪水法並非 Wolpe 提出 | police-109-counseling-4 第 4 列並列 Stampfl & Levis (1967) |
| Jeffery (1971) | 生物社會學習理論主要見 1977 年第 2 版與 1990 年專書 | 監獄官-114-犯罪學與再犯預測-1 第 1 列並列 |

### 出處與得分點內容不完全對應（不必改字串，可在 `devNote` 補充）

- **111-犯罪學-2 第 1 列**：「上下、端對端、並列整合」的分類出自 Hirschi (1979)，不是 Elliott, Ageton & Canter (1979)。
- **111-犯罪學-3 第 4 列**：「權威型教養」出自 Baumrind，不是 Colvin (2000)。
- **112-犯罪學-1 第 3 列**：圓形監獄的設計出自 Bentham (1791)，該列只引 Bentham (1789)。
- **108-心理學-3 第 4 列**：月暈效應（美即是好）另見 Dion, Berscheid, & Walster (1972)。
- **police-108-psychology-2 第 2 列**：B／13 歧義圖的情境效果研究是 Bruner & Minturn (1955)。
- **police-111-psychology-3 第 1 列**：以情境解釋自己的違規，較貼切的是行動者—觀察者偏誤 Jones & Nisbett (1971)。
- **114-諮商與輔導-3 第 2 列**：「性勒索」除刑法第 319 條之 3 外，另涉恐嚇取財（第 346 條）或強制、恐嚇（第 304、305 條）。
- **114-諮商與輔導-3 第 5 列**：刑法第 358 條是入侵電腦罪；「人肉搜索」的主要依據較宜引個人資料保護法第 41 條。
- **112-諮商與輔導-1 第 3 列**（已標示「請核對條次」）：協助探望母親可引監獄行刑法第 28 條（返家探視）。
- **監獄官-113-犯罪學與再犯預測-3 第 4 列**（已標示「請補充法源」）：個別處遇計畫為監獄行刑法第 11 條第 3 項。
- **監所管理員-109-犯罪學概要-3 第 3 列**（已標示「請核對條次」）：治療輔導可引性侵害犯罪防治法第 31 條。

### 已標示「請以講義核對」而本次已能確認的項目

- **110-諮商與輔導-2**：多元文化能力四要素依 Ratts et al. (2016)，為諮商師自我覺察、案主世界觀、諮商關係、諮商與倡議介入，與資料相符。
- **108-諮商與輔導-4**：BDI-II 手冊切截分數為 0–13、14–19、20–28、29–63（英文版手冊）。
- **110-犯罪學-3**：CoSA 於 1994 年起源於加拿大安大略省漢米爾頓的門諾教會，與資料相符。
- **113-諮商與輔導-1**：中輟生定義已核對現行辦法第 2 條，另包含「請假未獲准」的情形。
- **112-諮商與輔導-3**：自殺防治法媒體規範為第 16 條，通報為第 11 條。

### 其他建議

- 同一本書有多種寫法，建議統一：`Andrews & Bonta`／`Andrews & Bonta (2010)`；`Siegel, Criminology`／`Siegel (2018)`；`APA 測驗標準`／`AERA, APA, & NCME (2014)`；`Beccaria`／`Beccaria (1764)`；`Lombroso`／`Lombroso (1876)`；三種「輔導與諮商學會倫理守則」的寫法。
- 「社會心理學教材」「Freud」「Berg」「Rossi」「Garraud」等只寫姓氏或教材名稱的出處，建議補上年份。
- 部分教科書已有新版（DSM-5-TR 2022、Yalom & Leszcz 第 6 版 2020、Beck, J. S. 第 3 版 2020、Miller & Rollnick 第 3 版 2013），若講義採新版，引用年份應一併更新。

## 如何使用

1. 確認上面「優先處理」的建議後，可直接在 `law-scoring/data.js` 修改對應的 `articles` 字串，並在 `docs/theory-sources.json` 把該筆的 `cite` 一起改掉（否則 `npm test` 會提示缺書目）。
2. 對照講義確認某一列後，照原本的方式填 `devNote` 並把 `approved` 改為 `true`。
3. 若之後想讓網站顯示完整書目，可讓 `law-scoring/app.js` 讀取 `theory-sources.json`；這一步會更動網站，本次沒有做。

## 查證來源

- 全國法規資料庫（2026-10-16 版）：刑法、少年事件處理法、性別平等教育法、自殺防治法、監獄行刑法等條文。
- Teyber & Teyber (2017)：[Cengage 出版商頁面](https://www.cengage.com/c/interpersonal-process-in-therapy-an-integrative-model-7e-teyber-teyber/9781305271531/)
- Bucklen (2021)：[NIJ 出版品頁面](https://nij.ojp.gov/library/publications/desistance-focused-criminal-justice-practice)、[全文 PDF](https://www.ojp.gov/pdffiles1/nij/301501.pdf)
- Regoli & Hewitt 版次與差別壓迫理論：[Kingston, Regoli, & Hewitt (2003)](https://experts.colorado.edu/display/pubid_249209)、[Oklahoma State 期刊文章](https://ojs.library.okstate.edu/osu/index.php/FICS/article/view/1504)
- Christopher et al.：[Springer 全文 doi:10.1007/s11896-015-9161-x](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s11896-015-9161-x.pdf)
- Temoshok C 型性格：[Kirkus 書評（Temoshok & Dreher, 1992）](https://kirkusreviews.com/book-reviews/lydia-temoshok/the-type-c-connection)
- Lawton 環境假設：[PMC 回顧文](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12762927/)
- OpenStax 原始書稿：[osbooks-psychology](https://github.com/openstax/osbooks-psychology)、[osbooks-introduction-sociology](https://github.com/openstax/osbooks-introduction-sociology)、[osbooks-lifespan-development](https://github.com/openstax/osbooks-lifespan-development)（commit 記錄在 `docs/theory-openstax.json`）。
- 其餘書目依原始文獻的標準書目資料整理；標示「請核對」者仍建議以講義或原文確認。

## 教科書出處：OpenStax（2026-10-29 新增）

OpenStax 是 Rice University 的免費、經同儕審查的大學教科書。本次對照三本書，用 OpenStax 在 GitHub 公開的原始書稿逐節核對內容（openstax.org 網站本身在這個工作環境連不上）；章節網址依網站的命名規則產生，並以搜尋結果抽查與網站一致。

| 書名 | 作者 | 年份 | 授權 |
|---|---|---|---|
| [Psychology 2e](https://openstax.org/details/books/psychology-2e) | Spielman, R. M., Jenkins, W. J., & Lovett, M. D. | 2020 | CC BY-NC-SA 4.0 |
| [Introduction to Sociology 3e](https://openstax.org/details/books/introduction-sociology-3e) | Conerly, T. R., Holmes, K., & Tamang, A. L. | 2021 | CC BY-NC-SA 4.0 |
| [Lifespan Development](https://openstax.org/details/books/lifespan-development) | Riser, D. K., Spielman, R. M., & Biek, D. | 2024 | CC BY-NC-SA 4.0 |

**結果**：351 題中有 133 題找到對應章節（完整涵蓋 93 題、部分涵蓋 40 題），其餘 218 題 OpenStax 沒有涵蓋，主要是：諮商理論與技術（Yalom、焦點解決、敘事、動機式晤談、團體諮商）、犯罪學專論（RNR、日常活動理論、情境預防、CPTED、修復式司法、再犯預測）、心理測驗的計算與編製，以及臺灣法規題。

使用注意：
- 這三本是入門教科書，適合當作「教科書出處」或補充定義，不取代原始文獻。
- 「部分涵蓋」表示該節只談到題目的一部分，說明欄寫出缺少的內容。
- 內容為英文；美國的統計、制度與案例（例如 UCR、NCVS）不能直接套用到臺灣。
- 授權為 CC BY-NC-SA 4.0：引用或改寫須標示出處、不得商業使用、改作須以相同授權釋出。
- 完整資料（含每節確認出現的關鍵詞）在 `docs/theory-openstax.json`。

| 題目 | 對應章節 | 涵蓋 |
|---|---|---|
| 108-犯罪學-3｜Bedau 無被害者犯罪的特性與類型 | [Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 完整 |
| 108-犯罪學-4｜法律與社會學的犯罪概念及犯罪學研究目標 | [Sociology 3e 7.1 Deviance and Control](https://openstax.org/books/introduction-sociology-3e/pages/7-1-deviance-and-control)<br>[Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 完整 |
| 109-犯罪學-1｜以差別接觸理論說明孟母三遷與擇校 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 完整 |
| 109-犯罪學-2｜家庭因素與社會控制理論的少年犯罪預防 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 完整 |
| 110-犯罪學-1｜Quinney 犯罪的社會事實論 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋衝突理論概論（Marx、Mills），沒有 Quinney 的命題 |
| 110-犯罪學-2｜集體效能論與社區暴力犯罪 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋社會解組論，沒有集體效能 |
| 110-犯罪學-4｜反社會人格障礙與犯罪的關係 | [Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 完整 |
| 111-犯罪學-4｜幫派副文化理論與中立化理論對成年後繼續犯罪的解釋 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋中立化技術，沒有副文化理論 |
| 112-犯罪學-4｜精神障礙與人格障礙者的暴力犯罪成因與防治 | [Psychology 2e 15.8 Schizophrenia](https://openstax.org/books/psychology-2e/pages/15-8-schizophrenia)<br>[Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 部分：只涵蓋疾患本身，沒有暴力風險與防治 |
| 113-犯罪學-1｜Bandura 攻擊行為的激起因素 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling)<br>[Psychology 2e 12.6 Aggression](https://openstax.org/books/psychology-2e/pages/12-6-aggression) | 部分：只涵蓋 Bobo 實驗與攻擊的定義，沒有五項激起因素 |
| 113-犯罪學-4｜DSM-5 思覺失調症症狀及其與犯罪的關聯 | [Psychology 2e 15.8 Schizophrenia](https://openstax.org/books/psychology-2e/pages/15-8-schizophrenia) | 部分：只涵蓋症狀，沒有與犯罪的關聯 |
| 114-犯罪學-1｜社會結構學派與社會控制學派的少年犯罪解釋與對策 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 完整 |
| 114-犯罪學-4｜以生物心理社會模式詮釋少年藥物濫用與處遇 | [Psychology 2e 4.5 Substance Use and Abuse](https://openstax.org/books/psychology-2e/pages/4-5-substance-use-and-abuse)<br>[Psychology 2e 16.4 Substance-Related and Addictive Disorders: A Special Case](https://openstax.org/books/psychology-2e/pages/16-4-substance-related-and-addictive-disorders-a-special-case) | 部分：只涵蓋成癮機制，沒有少年處遇 |
| 108-心理學-1｜態度的組成成分：以抽菸為例 | [Psychology 2e 12.3 Attitudes and Persuasion](https://openstax.org/books/psychology-2e/pages/12-3-attitudes-and-persuasion) | 完整 |
| 108-心理學-2｜A 型、B 型與 C 型性格 | [Psychology 2e 14.3 Stress and Illness](https://openstax.org/books/psychology-2e/pages/14-3-stress-and-illness) | 部分：只涵蓋 A 型與 B 型，沒有 C 型性格 |
| 108-心理學-3｜人際吸引的意義與影響因素 | [Psychology 2e 12.7 Prosocial Behavior](https://openstax.org/books/psychology-2e/pages/12-7-prosocial-behavior) | 完整 |
| 109-心理學-1｜流體智力與晶體智力的差異、發展與職涯影響 | [Psychology 2e 7.4 What Are Intelligence and Creativity?](https://openstax.org/books/psychology-2e/pages/7-4-what-are-intelligence-and-creativity)<br>[Lifespan 15.3 Cognition and Memory in Late Adulthood](https://openstax.org/books/lifespan-development/pages/15-3-cognition-and-memory-in-late-adulthood) | 完整 |
| 109-心理學-2｜習得無助感與受虐婦女症候群 | [Psychology 2e 14.4 Regulation of Stress](https://openstax.org/books/psychology-2e/pages/14-4-regulation-of-stress) | 部分：只涵蓋習得無助，沒有受虐婦女症候群 |
| 109-心理學-3｜壓力與成癮的關聯及成癮的生理心理歷程 | [Psychology 2e 4.5 Substance Use and Abuse](https://openstax.org/books/psychology-2e/pages/4-5-substance-use-and-abuse)<br>[Psychology 2e 16.4 Substance-Related and Addictive Disorders: A Special Case](https://openstax.org/books/psychology-2e/pages/16-4-substance-related-and-addictive-disorders-a-special-case) | 完整 |
| 109-心理學-4｜選用憂鬱量表的信度與效度證據 | [Psychology 2e 2.3 Analyzing Findings](https://openstax.org/books/psychology-2e/pages/2-3-analyzing-findings) | 部分：研究方法層次的信效度，沒有量表選用的細節 |
| 110-心理學-1｜心智異常的定義、判斷標準與心理衡鑑方法 | [Psychology 2e 15.1 What Are Psychological Disorders?](https://openstax.org/books/psychology-2e/pages/15-1-what-are-psychological-disorders)<br>[Psychology 2e 11.9 Personality Assessment](https://openstax.org/books/psychology-2e/pages/11-9-personality-assessment) | 完整 |
| 110-心理學-2｜Beck 認知理論與 Seligman 歸因風格解釋憂鬱及認知治療 | [Psychology 2e 15.7 Depressive, Bipolar, and Related Disorders](https://openstax.org/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders)<br>[Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 部分：有 Beck 的憂鬱認知理論與認知治療，沒有 Seligman 歸因風格 |
| 110-心理學-3｜情緒的四個元素與運作特性 | [Psychology 2e 10.4 Emotion](https://openstax.org/books/psychology-2e/pages/10-4-emotion) | 完整 |
| 110-心理學-4｜Kohlberg 道德發展六階段 | [Psychology 2e 9.2 Lifespan Theories](https://openstax.org/books/psychology-2e/pages/9-2-lifespan-theories) | 完整 |
| 111-心理學-2｜體質壓力模型與心理異常成因 | [Psychology 2e 15.3 Perspectives on Psychological Disorders](https://openstax.org/books/psychology-2e/pages/15-3-perspectives-on-psychological-disorders) | 完整 |
| 111-心理學-3｜去個人化現象及其影響 | [Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 完整 |
| 111-心理學-4｜影響兒童智力發展的環境因素 | [Psychology 2e 7.6 The Source of Intelligence](https://openstax.org/books/psychology-2e/pages/7-6-the-source-of-intelligence)<br>[Lifespan 7.3 Intelligence in Middle Childhood](https://openstax.org/books/lifespan-development/pages/7-3-intelligence-in-middle-childhood) | 完整 |
| 113-心理學-1｜建構性記憶與目擊證詞的再建構 | [Psychology 2e 8.3 Problems with Memory](https://openstax.org/books/psychology-2e/pages/8-3-problems-with-memory) | 完整 |
| 113-心理學-2｜快思慢想與可得性捷思 | [Psychology 2e 7.3 Problem Solving](https://openstax.org/books/psychology-2e/pages/7-3-problem-solving) | 完整 |
| 113-心理學-3｜Sternberg 成功智力理論與 AI 世代青少年 | [Psychology 2e 7.4 What Are Intelligence and Creativity?](https://openstax.org/books/psychology-2e/pages/7-4-what-are-intelligence-and-creativity) | 完整 |
| 113-心理學-4｜Seligman 積極富能（PERMA）五向度與青少年心理健康 | [Psychology 2e 14.5 The Pursuit of Happiness](https://openstax.org/books/psychology-2e/pages/14-5-the-pursuit-of-happiness) | 部分：有正向心理學概述，沒有 PERMA 五向度 |
| 114-心理學-1｜信度與效度的概念，以及高信度低效度的問題 | [Psychology 2e 2.3 Analyzing Findings](https://openstax.org/books/psychology-2e/pages/2-3-analyzing-findings) | 完整 |
| 114-心理學-2｜團體決策更極端的心理歷程 | [Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 完整 |
| 114-心理學-3｜功能固著與突破固著的策略 | [Psychology 2e 7.3 Problem Solving](https://openstax.org/books/psychology-2e/pages/7-3-problem-solving) | 完整 |
| 114-心理學-4｜一般適應症候群與長期照顧壓力 | [Psychology 2e 14.1 What Is Stress?](https://openstax.org/books/psychology-2e/pages/14-1-what-is-stress) | 完整 |
| 115-心理學-1｜精神分析論與五大人格特質論的比較及司法心理意涵 | [Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective)<br>[Psychology 2e 11.7 Trait Theorists](https://openstax.org/books/psychology-2e/pages/11-7-trait-theorists) | 完整 |
| 115-心理學-3｜Elkind 個人神話與矯正不當認知 | [Lifespan 9.3 Cognition in Adolescence](https://openstax.org/books/lifespan-development/pages/9-3-cognition-in-adolescence) | 完整 |
| 115-心理學-4｜以三種發展理論分析科技媒體對青少年的影響與處遇 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling)<br>[Lifespan 1.4 Contexts and Settings of Development](https://openstax.org/books/lifespan-development/pages/1-4-contexts-and-settings-of-development)<br>[Psychology 2e 9.2 Lifespan Theories](https://openstax.org/books/psychology-2e/pages/9-2-lifespan-theories) | 完整 |
| 108-諮商與輔導-4｜大五人格測驗與貝克憂鬱量表 | [Psychology 2e 11.7 Trait Theorists](https://openstax.org/books/psychology-2e/pages/11-7-trait-theorists) | 部分：只涵蓋五大人格，沒有貝克憂鬱量表 |
| 109-諮商與輔導-1｜Freud 與存在主義的焦慮意義及處理 | [Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective) | 部分：只涵蓋 Freud 部分，沒有存在主義焦慮 |
| 109-諮商與輔導-2｜DSM-5 重鬱症的診斷標準 | [Psychology 2e 15.7 Depressive, Bipolar, and Related Disorders](https://openstax.org/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders) | 完整 |
| 109-諮商與輔導-3｜敘事治療與精神分析處理早期經驗的技術差異 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 部分：只涵蓋精神分析技術，沒有敘事治療 |
| 110-諮商與輔導-1｜心理動力與存在主義對覺察的觀點及比較 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 部分：只涵蓋心理動力部分，沒有存在主義 |
| 112-諮商與輔導-3｜網路霸凌的成因、行為、影響與處遇 | [Psychology 2e 12.6 Aggression](https://openstax.org/books/psychology-2e/pages/12-6-aggression) | 部分：只涵蓋網路霸凌定義，沒有處遇 |
| 113-諮商與輔導-4｜Adler 自卑與追求卓越的平衡 | [Psychology 2e 11.3 Neo-Freudians: Adler, Erikson, Jung, and Horney](https://openstax.org/books/psychology-2e/pages/11-3-neo-freudians-adler-erikson-jung-and-horney) | 完整 |
| 114-諮商與輔導-2｜Beck 四種認知扭曲與好鬥少年 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| 115-諮商與輔導-2｜Jung 分析心理學與曝險少年 | [Psychology 2e 11.3 Neo-Freudians: Adler, Erikson, Jung, and Horney](https://openstax.org/books/psychology-2e/pages/11-3-neo-freudians-adler-erikson-jung-and-horney) | 完整 |
| 監獄官-110-犯罪學與再犯預測-2｜偏差行為漏斗效應與無被害者犯罪特性 | [Sociology 3e 7.1 Deviance and Control](https://openstax.org/books/introduction-sociology-3e/pages/7-1-deviance-and-control)<br>[Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 部分：沒有漏斗效應 |
| 監獄官-111-犯罪學與再犯預測-2｜標籤理論與 Finckenauer 的 4D 策略 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋標籤理論，沒有 4D 策略 |
| 監獄官-114-犯罪學與再犯預測-2｜Bandura 與 Akers 學習理論差異及詐欺犯罪 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling)<br>[Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：沒有 Akers 差別增強理論 |
| 監獄官-114-犯罪學與再犯預測-3｜精神障礙者暴力犯罪成因與監護處分的預防學理 | [Psychology 2e 15.8 Schizophrenia](https://openstax.org/books/psychology-2e/pages/15-8-schizophrenia) | 部分：只涵蓋症狀，沒有暴力風險與監護處分 |
| 監獄官-108-諮商與矯正輔導-1｜Beck 認知三層次：以走私犯為例 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 部分：有 Beck 認知治療，沒有認知三層次 |
| 監獄官-108-諮商與矯正輔導-3｜酒精使用障礙症的症狀與戒斷反應 | [Psychology 2e 4.5 Substance Use and Abuse](https://openstax.org/books/psychology-2e/pages/4-5-substance-use-and-abuse) | 完整 |
| 監獄官-108-諮商與矯正輔導-4｜人格障礙症、行為規範障礙與反社會型人格障礙症 | [Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 完整 |
| 監獄官-111-諮商與矯正輔導-2｜行為規範障礙症狀與 Bowen 取向處遇 | [Lifespan 8.5 Atypical Development and Interventions in Middle Childhood](https://openstax.org/books/lifespan-development/pages/8-5-atypical-development-and-interventions-in-middle-childhood) | 部分：只涵蓋行為規範障礙，沒有 Bowen 取向 |
| 監獄官-113-諮商與矯正輔導-1｜三學派對抗拒的觀點與處理 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| 監獄官-113-諮商與矯正輔導-2｜暴力代間傳遞與介入技術 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 部分：只涵蓋社會學習，沒有 Bowen |
| 監獄官-114-諮商與矯正輔導-1｜Adler 學派在矯正機關的運用 | [Psychology 2e 11.3 Neo-Freudians: Adler, Erikson, Jung, and Horney](https://openstax.org/books/psychology-2e/pages/11-3-neo-freudians-adler-erikson-jung-and-horney) | 完整 |
| 監獄官-115-諮商與矯正輔導-1｜成癮團體中「你沒用過毒」的挑戰與移情 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| 監獄官-115-諮商與矯正輔導-4｜自傷自殺高風險判斷與系統合作 | [Psychology 2e 15.7 Depressive, Bipolar, and Related Disorders](https://openstax.org/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders) | 完整 |
| 薦任升等（矯正）-108-心理測驗-2｜離差智商轉換 Z、T 與 PR | [Psychology 2e 7.5 Measures of Intelligence](https://openstax.org/books/psychology-2e/pages/7-5-measures-of-intelligence) | 完整 |
| 薦任升等（矯正）-114-心理測驗-1｜信度與效度的理論差異 | [Psychology 2e 2.3 Analyzing Findings](https://openstax.org/books/psychology-2e/pages/2-3-analyzing-findings) | 完整 |
| 薦任升等（矯正）-108-犯罪學-2｜Hare 心理病態特徵與犯罪 | [Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 部分：有反社會人格障礙，沒有 Hare 心理病態檢核表 |
| 薦任升等（矯正）-110-犯罪學-1｜自我控制與標籤理論看監獄矯治失敗 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋標籤理論，沒有自我控制理論 |
| 薦任升等（矯正）-110-犯罪學-2｜制度性迷亂理論與投資詐騙被害 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋 Merton 緊張理論，沒有制度性迷亂理論 |
| 薦任升等（矯正）-114-犯罪學-2｜Bandura 攻擊學習與矯正管理 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 部分：只涵蓋觀察學習，沒有矯正管理 |
| 薦任升等（矯正）-108-諮商與輔導-2｜酒藥癮的耐受與戒斷及瑞士方案 | [Psychology 2e 4.5 Substance Use and Abuse](https://openstax.org/books/psychology-2e/pages/4-5-substance-use-and-abuse) | 部分：沒有瑞士海洛因方案 |
| 薦任升等（矯正）-110-諮商與輔導-2｜憤怒管理：認知治療或個人中心 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| 薦任升等（矯正）-112-諮商與輔導-2｜以 MBSR 與 MBCT 達成社會情緒學習 | [Psychology 2e 4.6 Other States of Consciousness](https://openstax.org/books/psychology-2e/pages/4-6-other-states-of-consciousness) | 部分：只涵蓋冥想，沒有 MBSR／MBCT 與社會情緒學習 |
| 薦任升等（矯正）-114-諮商與輔導-3｜Rogers 六項條件應用於霸凌受害者 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment)<br>[Psychology 2e 11.5 Humanistic Approaches](https://openstax.org/books/psychology-2e/pages/11-5-humanistic-approaches) | 完整 |
| 薦任升等（矯正）-114-諮商與輔導-4｜BPD 的替代模式分析與犯罪風險 | [Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 部分：有邊緣型人格障礙，沒有 DSM-5 替代模式 |
| police-108-psychology-1｜五個心理學名詞解釋 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling)<br>[Psychology 2e 10.4 Emotion](https://openstax.org/books/psychology-2e/pages/10-4-emotion)<br>[Psychology 2e 8.4 Ways to Enhance Memory](https://openstax.org/books/psychology-2e/pages/8-4-ways-to-enhance-memory)<br>[Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 完整 |
| police-108-psychology-2｜由上而下與由下而上歷程 | [Psychology 2e 5.1 Sensation versus Perception](https://openstax.org/books/psychology-2e/pages/5-1-sensation-versus-perception) | 完整 |
| police-108-psychology-3｜以處罰防止兒童不當行為 | [Psychology 2e 6.3 Operant Conditioning](https://openstax.org/books/psychology-2e/pages/6-3-operant-conditioning) | 完整 |
| police-109-psychology-1｜飢餓與飽足的腦部兩階段歷程 | [Psychology 2e 10.2 Hunger and Eating](https://openstax.org/books/psychology-2e/pages/10-2-hunger-and-eating) | 完整 |
| police-109-psychology-2｜Yerkes-Dodson 法則 | [Psychology 2e 10.1 Motivation](https://openstax.org/books/psychology-2e/pages/10-1-motivation) | 完整 |
| police-109-psychology-3｜自閉症類群障礙症的生理因素 | [Psychology 2e 15.10 Disorders in Childhood](https://openstax.org/books/psychology-2e/pages/15-10-disorders-in-childhood) | 完整 |
| police-109-psychology-4｜內在與外在動機對學習的影響 | [Psychology 2e 10.1 Motivation](https://openstax.org/books/psychology-2e/pages/10-1-motivation) | 完整 |
| police-110-psychology-1｜遺忘的原因 | [Psychology 2e 8.3 Problems with Memory](https://openstax.org/books/psychology-2e/pages/8-3-problems-with-memory) | 完整 |
| police-110-psychology-2｜團體迷思 | [Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 完整 |
| police-110-psychology-3｜五個名詞解釋（英文） | [Psychology 2e 8.1 How Memory Functions](https://openstax.org/books/psychology-2e/pages/8-1-how-memory-functions)<br>[Psychology 2e 15.8 Schizophrenia](https://openstax.org/books/psychology-2e/pages/15-8-schizophrenia)<br>[Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 完整 |
| police-110-psychology-4｜Freud 防衛機制 | [Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective) | 完整 |
| police-111-psychology-1｜壓力的反應取向與互動取向 | [Psychology 2e 14.1 What Is Stress?](https://openstax.org/books/psychology-2e/pages/14-1-what-is-stress) | 完整 |
| police-111-psychology-2｜記憶提取與目擊證詞 | [Psychology 2e 8.3 Problems with Memory](https://openstax.org/books/psychology-2e/pages/8-3-problems-with-memory) | 完整 |
| police-111-psychology-3｜用路人違規的心理歷程 | [Psychology 2e 12.1 What Is Social Psychology?](https://openstax.org/books/psychology-2e/pages/12-1-what-is-social-psychology)<br>[Psychology 2e 12.3 Attitudes and Persuasion](https://openstax.org/books/psychology-2e/pages/12-3-attitudes-and-persuasion)<br>[Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective) | 完整 |
| police-111-psychology-4｜詐騙集團的強制說服 | [Psychology 2e 12.3 Attitudes and Persuasion](https://openstax.org/books/psychology-2e/pages/12-3-attitudes-and-persuasion)<br>[Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 部分：有說服與順從的概念，沒有強制說服 |
| police-112-psychology-1｜旁觀者效應 | [Psychology 2e 12.6 Aggression](https://openstax.org/books/psychology-2e/pages/12-6-aggression) | 完整 |
| police-112-psychology-2｜認知評估與認知再評估 | [Psychology 2e 10.4 Emotion](https://openstax.org/books/psychology-2e/pages/10-4-emotion) | 完整 |
| police-112-psychology-3｜投射測驗 | [Psychology 2e 11.9 Personality Assessment](https://openstax.org/books/psychology-2e/pages/11-9-personality-assessment) | 完整 |
| police-112-psychology-4｜行為塑造 | [Psychology 2e 6.3 Operant Conditioning](https://openstax.org/books/psychology-2e/pages/6-3-operant-conditioning) | 完整 |
| police-113-psychology-1｜腳在門檻裡與以退為進 | [Psychology 2e 12.3 Attitudes and Persuasion](https://openstax.org/books/psychology-2e/pages/12-3-attitudes-and-persuasion) | 部分：只涵蓋腳在門檻裡，沒有以退為進 |
| police-113-psychology-2｜睡眠、藥物與毒品對意識的影響 | [Psychology 2e 4.3 Stages of Sleep](https://openstax.org/books/psychology-2e/pages/4-3-stages-of-sleep)<br>[Psychology 2e 4.5 Substance Use and Abuse](https://openstax.org/books/psychology-2e/pages/4-5-substance-use-and-abuse) | 完整 |
| police-113-psychology-3｜Maslow 需求階層與生活型態 | [Psychology 2e 10.1 Motivation](https://openstax.org/books/psychology-2e/pages/10-1-motivation) | 完整 |
| police-113-psychology-4｜以 Bandura 社會學習理論解釋犯罪 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 完整 |
| police-114-psychology-1｜成長、維持與失去的全人發展 | [Lifespan 16.5 Successful Social and Emotional Aging in Late Adulthood](https://openstax.org/books/lifespan-development/pages/16-5-successful-social-and-emotional-aging-in-late-adulthood)<br>[Sociology 3e 13.4 Theoretical Perspectives on Aging](https://openstax.org/books/introduction-sociology-3e/pages/13-4-theoretical-perspectives-on-aging) | 部分：有 SOC 選擇、最適化與補償，沒有成長、維持、失去調節三目標 |
| police-114-psychology-2｜猝睡症的主要症狀 | [Psychology 2e 4.4 Sleep Problems and Disorders](https://openstax.org/books/psychology-2e/pages/4-4-sleep-problems-and-disorders) | 完整 |
| police-115-psychology-1｜Bandura 自我效能與青少年 | [Psychology 2e 11.4 Learning Approaches](https://openstax.org/books/psychology-2e/pages/11-4-learning-approaches) | 完整 |
| police-115-psychology-2｜三大經典學習理論 | [Psychology 2e 6.2 Classical Conditioning](https://openstax.org/books/psychology-2e/pages/6-2-classical-conditioning)<br>[Psychology 2e 6.3 Operant Conditioning](https://openstax.org/books/psychology-2e/pages/6-3-operant-conditioning)<br>[Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 完整 |
| police-108-criminology_prevention-1｜人性觀如何影響四種犯罪學理論 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：沒有古典學派的理性享樂觀 |
| police-108-criminology_prevention-2｜Sampson 社區脈絡與暴力犯罪 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋社會解組論，沒有集體效能 |
| police-108-criminology_prevention-3｜差別接觸與差別增強理論比較 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：沒有 Akers 差別增強理論 |
| police-111-criminology_prevention-2｜中立化技術 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 完整 |
| police-112-criminology_prevention-1｜犯罪黑數 | [Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 完整 |
| police-112-criminology_prevention-2｜Merton 與 Agnew 的緊張理論與詐欺 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 部分：只涵蓋 Merton，沒有 Agnew 一般化緊張理論 |
| police-108-counseling-2｜Adler 學派 | [Psychology 2e 11.3 Neo-Freudians: Adler, Erikson, Jung, and Horney](https://openstax.org/books/psychology-2e/pages/11-3-neo-freudians-adler-erikson-jung-and-horney) | 完整 |
| police-109-counseling-1｜理情治療與行為治療比較 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| police-109-counseling-4｜五個諮商名詞解釋 | [Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment)<br>[Psychology 2e 11.3 Neo-Freudians: Adler, Erikson, Jung, and Horney](https://openstax.org/books/psychology-2e/pages/11-3-neo-freudians-adler-erikson-jung-and-horney) | 完整 |
| police-110-counseling-4｜自殺與危機因子及輔導防治 | [Psychology 2e 15.7 Depressive, Bipolar, and Related Disorders](https://openstax.org/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders) | 完整 |
| police-111-counseling-4｜國中生非自殺性自傷的輔導 | [Psychology 2e 15.7 Depressive, Bipolar, and Related Disorders](https://openstax.org/books/psychology-2e/pages/15-7-depressive-bipolar-and-related-disorders) | 完整 |
| police-112-counseling-2｜初顯成人愛情團體方案 | [Lifespan 11.1 Becoming an Adult](https://openstax.org/books/lifespan-development/pages/11-1-becoming-an-adult)<br>[Lifespan 10.4 Social Contexts in Adolescence](https://openstax.org/books/lifespan-development/pages/10-4-social-contexts-in-adolescence) | 完整 |
| police-114-counseling-2｜ASPD 的人格功能與病態特質 | [Psychology 2e 15.11 Personality Disorders](https://openstax.org/books/psychology-2e/pages/15-11-personality-disorders) | 部分：有反社會人格障礙，沒有 DSM-5 替代模式 |
| police-114-counseling-3｜警察人員八週正念減壓課程 | [Psychology 2e 4.6 Other States of Consciousness](https://openstax.org/books/psychology-2e/pages/4-6-other-states-of-consciousness) | 部分：只涵蓋冥想，沒有八週正念減壓課程 |
| 108-心理測驗員-心理學-1｜遺忘的因素與影響 | [Psychology 2e 8.3 Problems with Memory](https://openstax.org/books/psychology-2e/pages/8-3-problems-with-memory) | 完整 |
| 108-心理測驗員-心理學-2｜為什麼需要睡眠與睡眠不足的後果 | [Psychology 2e 4.2 Sleep and Why We Sleep](https://openstax.org/books/psychology-2e/pages/4-2-sleep-and-why-we-sleep) | 完整 |
| 108-心理測驗員-心理學-4｜退化、補償與合理化 | [Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective) | 完整 |
| 109-心理測驗員-心理學-1｜以內外在動機提高振興券使用 | [Psychology 2e 10.1 Motivation](https://openstax.org/books/psychology-2e/pages/10-1-motivation) | 完整 |
| 109-心理測驗員-心理學-2｜社會學習與認知行為理論輔導偏差學生 | [Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling)<br>[Psychology 2e 16.2 Types of Treatment](https://openstax.org/books/psychology-2e/pages/16-2-types-of-treatment) | 完整 |
| 109-心理測驗員-心理學-3｜災難後的 PTSD | [Psychology 2e 15.6 Trauma- and Stressor-Related Disorders](https://openstax.org/books/psychology-2e/pages/15-6-trauma-and-stressor-related-disorders) | 完整 |
| 109-心理測驗員-心理學-4｜增進記憶的方法 | [Psychology 2e 8.4 Ways to Enhance Memory](https://openstax.org/books/psychology-2e/pages/8-4-ways-to-enhance-memory) | 完整 |
| 110-心理測驗員-心理學-1｜認知因素在學習中的重要性 | [Psychology 2e 6.3 Operant Conditioning](https://openstax.org/books/psychology-2e/pages/6-3-operant-conditioning)<br>[Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 完整 |
| 110-心理測驗員-心理學-2｜知覺的認識與行動功能 | [Psychology 2e 5.6 Gestalt Principles of Perception](https://openstax.org/books/psychology-2e/pages/5-6-gestalt-principles-of-perception)<br>[Psychology 2e 6.4 Observational Learning (Modeling)](https://openstax.org/books/psychology-2e/pages/6-4-observational-learning-modeling) | 完整 |
| 110-心理測驗員-心理學-3｜自我調節與自我效能 | [Psychology 2e 11.4 Learning Approaches](https://openstax.org/books/psychology-2e/pages/11-4-learning-approaches) | 完整 |
| 110-心理測驗員-心理學-4｜團體決策為何常不佳 | [Psychology 2e 12.4 Conformity, Compliance, and Obedience](https://openstax.org/books/psychology-2e/pages/12-4-conformity-compliance-and-obedience) | 完整 |
| 113-家事調查官-心理測驗員-心理學-1｜Ainsworth 四種依附與依附創傷 | [Psychology 2e 9.3 Stages of Development](https://openstax.org/books/psychology-2e/pages/9-3-stages-of-development) | 完整 |
| 113-家事調查官-心理測驗員-心理學-4｜前額葉未成熟的青少年行為 | [Lifespan 9.4 Decision-Making and Risky Behaviors in Adolescence](https://openstax.org/books/lifespan-development/pages/9-4-decision-making-and-risky-behaviors-in-adolescence) | 完整 |
| 114-家事調查官-心理測驗員-心理學-4｜基本歸因謬誤與自利偏誤 | [Psychology 2e 12.1 What Is Social Psychology?](https://openstax.org/books/psychology-2e/pages/12-1-what-is-social-psychology) | 完整 |
| 115-家事調查官-心理測驗員-心理學-1｜MBTI 與大五人格的信效度 | [Psychology 2e 11.9 Personality Assessment](https://openstax.org/books/psychology-2e/pages/11-9-personality-assessment)<br>[Psychology 2e 11.7 Trait Theorists](https://openstax.org/books/psychology-2e/pages/11-7-trait-theorists) | 完整 |
| 115-家事調查官-心理測驗員-心理學-2｜遊戲化機制的動機分析 | [Psychology 2e 10.1 Motivation](https://openstax.org/books/psychology-2e/pages/10-1-motivation) | 完整 |
| 115-家事調查官-心理測驗員-心理學-3｜邊開車邊講電話的注意力問題 | [Psychology 2e 5.1 Sensation versus Perception](https://openstax.org/books/psychology-2e/pages/5-1-sensation-versus-perception) | 完整 |
| 監所管理員-108-犯罪學概要-3｜無被害者犯罪的犯罪化與除罪化 | [Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 完整 |
| 監所管理員-109-犯罪學概要-1｜自陳報告調查 | [Sociology 3e 7.3 Crime and the Law](https://openstax.org/books/introduction-sociology-3e/pages/7-3-crime-and-the-law) | 完整 |
| 監所管理員-109-犯罪學概要-2｜Freud 心理分析與犯罪學 | [Psychology 2e 11.2 Freud and the Psychodynamic Perspective](https://openstax.org/books/psychology-2e/pages/11-2-freud-and-the-psychodynamic-perspective) | 完整 |
| 監所管理員-111-犯罪學概要-2｜Hirschi 社會鍵與家庭 | [Sociology 3e 7.2 Theoretical Perspectives on Deviance and Crime](https://openstax.org/books/introduction-sociology-3e/pages/7-2-theoretical-perspectives-on-deviance-and-crime) | 完整 |

## 完整書目

### 原引用可能有誤，請核對（17 筆）

| 原引用 | 建議完整書目 | 說明 | 使用題目 |
|---|---|---|---|
| Bandura (1977) | Bandura, A. (1977a). Social learning theory. Englewood Cliffs, NJ: Prentice-Hall.／Bandura, A. (1977b). Self-efficacy: Toward a unifying theory of behavioral change. Psychological Review, 84(2), 191–215. | 1977 年有兩份常被引用的文獻：觀察學習四歷程出自專書 (1977a)，自我效能出自期刊論文 (1977b)，建議以 a、b 區分。 | 115-心理學-3、監獄官-114-犯罪學與再犯預測-2、監獄官-113-諮商與矯正輔導-2、薦任升等（矯正）-114-犯罪學-2、police-108-psychology-3、police-113-psychology-4、police-115-psychology-1、police-115-psychology-2、109-心理測驗員-心理學-2、110-心理測驗員-心理學-1 |
| Beck (1979) | Beck, A. T., Rush, A. J., Shaw, B. F., & Emery, G. (1979). Cognitive therapy of depression. New York: Guilford Press. | 此書為四位作者合著，應寫作 Beck et al. (1979)。 | 110-心理學-2 |
| Campbell (2003) | Campbell, J. C., Webster, D., Koziol-McLain, J., et al. (2003). Risk factors for femicide in abusive relationships: Results from a multisite case control study. American Journal of Public Health, 93(7), 1089–1097. | 此文為多位作者合著，應寫作 Campbell et al. (2003)；危險評估量表 DA 原始文獻為 Campbell (1986)。TIPVDA 為我國量表（王珮玲發展），請另以講義標示出處。 | 薦任升等（矯正）-108-犯罪學-4 |
| Christopher et al. (2016) | Christopher, M. S., Goerling, R. J., Rogers, B. S., Hunsinger, M., Baron, G., Bergman, A. L., & Zava, D. T. (2016). A pilot study evaluating the effectiveness of a mindfulness-based intervention on cortisol awakening response and health outcomes among law enforcement officers. Journal of Police and Criminal Psychology, 31(1), 15–28. doi:10.1007/s11896-015-9161-x | DOI 已確認屬此期刊；篇名與作者順序請再以期刊頁面核對。同團隊的隨機對照試驗為 Christopher et al. (2018), Psychiatry Research, 264, 104–115。 | police-114-counseling-3 |
| Dreikurs (1964) | Dreikurs, R., & Soltz, V. (1964). Children: The challenge. New York: Duell, Sloan and Pearce. | 此書為 Dreikurs 與 Soltz 合著，應寫作 Dreikurs & Soltz (1964)。 | 監獄官-115-諮商與矯正輔導-2 |
| Friedman (1998) | Friedman, J. M., & Halaas, J. L. (1998). Leptin and the regulation of body weight in mammals. Nature, 395(6704), 763–770. | 瘦素的經典回顧為 Friedman 與 Halaas 合著，應寫作 Friedman & Halaas (1998)；瘦素基因的發現見 Zhang et al. (1994), Nature, 372, 425–432。 | police-109-psychology-1 |
| Gottfredson (1987) | Gottfredson, D. M., & Tonry, M. (Eds.). (1987). Prediction and classification: Criminal justice decision making (Crime and Justice, Vol. 9). Chicago: University of Chicago Press. | 原引用只寫 Gottfredson (1987)；該年的再犯預測經典是 Gottfredson 與 Tonry 主編的專書，書中 Gottfredson, S. D., & Gottfredson, D. M. 另有專章。請確認講義所指作者。 | 監獄官-111-犯罪學與再犯預測-4、監獄官-112-犯罪學與再犯預測-1、監獄官-115-犯罪學與再犯預測-3 |
| Jeffery (1971) | Jeffery, C. R. (1971). Crime prevention through environmental design. Beverly Hills, CA: Sage. | CPTED 引此書正確；但「生物社會學習理論」主要見 1977 年第 2 版及 Jeffery (1990) Criminology: An interdisciplinary approach，引用生物社會學習理論時建議改引或並列。 | 監獄官-114-犯罪學與再犯預測-1、監所管理員-113-犯罪學概要-3 |
| Lawton (1990) | Lawton, M. P. (1990). Residential environment and self-directedness among older people. American Psychologist, 45(5), 638–640. | 「環境主動假設」較常引用 Lawton (1989), Environmental proactivity in older people, 收錄於 Bengtson & Schaie (Eds.), The course of later life；「環境順從假設」則為 Lawton & Simon (1968)。請以講義核對。 | police-114-psychology-4 |
| Linehan (1993) | Linehan, M. M. (1993). Cognitive-behavioral treatment of borderline personality disorder. New York: Guilford Press. | DEAR MAN、GIVE 出自 1993 年技巧手冊；TIPP 為 Linehan (2015) DBT skills training manual (2nd ed.) 新增，引用 TIPP 時請改引 2015 年版。 | 薦任升等（矯正）-114-諮商與輔導-4、police-111-counseling-4、police-114-counseling-4 |
| Park & Burgess (1925) | Park, R. E., Burgess, E. W., & McKenzie, R. D. (1925). The city. Chicago: University of Chicago Press. | 此書為三位作者合著，應寫作 Park, Burgess, & McKenzie (1925)。 | police-108-criminology_prevention-1 |
| Prochaska & DiClemente (1982) | Prochaska, J. O., & DiClemente, C. C. (1982). Transtheoretical therapy: Toward a more integrative model of change. Psychotherapy: Theory, Research & Practice, 19(3), 276–288. | 1982 年原始模式只有懼思、沉思、行動、維持四期；含「準備期」的五階段模式見 Prochaska, DiClemente, & Norcross (1992), American Psychologist, 47(9), 1102–1114，引用五階段時建議並列。 | 監獄官-109-諮商與矯正輔導-1、監獄官-113-諮商與矯正輔導-3 |
| Regoli & Hewitt (2001) | Regoli, R. M., & Hewitt, J. D. (2000). Delinquency in society (4th ed.). Boston: McGraw-Hill. | 查無 2001 年版；第 4 版為 2000 年、第 3 版為 1997 年。理論的期刊版另見 Kingston, Regoli, & Hewitt (2003), Critical Criminology, 11(3), 237–260。請依講義版次修正年份。 | police-113-criminology_prevention-2 |
| Temoshok (1990) | Temoshok, L. (1987). Personality, coping style, emotion and cancer: Towards an integrative model. Cancer Surveys, 6(3), 545–567. | C 型性格的代表文獻通常為 Temoshok (1987) 或 Temoshok & Dreher (1992) The Type C connection；1990 年的出處無法確認，請以講義核對。 | 108-心理學-2 |
| Teyber & Holmes (2017) | Teyber, E., & Teyber, F. H. (2017). Interpersonal process in therapy: An integrative model (7th ed.). Boston: Cengage Learning. | 經查第 7 版作者為 Edward Teyber 與 Faith Holmes Teyber（出版商頁面），一般寫作 Teyber & Teyber (2017)；題目中的「Holmes」即第二作者。 | 監獄官-111-諮商與矯正輔導-3 |
| WHO (2014) | World Health Organization. (2014). Preventing suicide: A global imperative. Geneva: WHO.／World Health Organization. (2014). Global status report on violence prevention 2014. Geneva: WHO. | WHO 2014 年有兩份文件：自殺題（police-110-counseling-4）應引《Preventing suicide》，殺人防治題（police-114-criminology_prevention-2）應引《Global status report on violence prevention》，建議分別標示。 | police-114-criminology_prevention-2、police-110-counseling-4 |
| Wolpe (1958) | Wolpe, J. (1958). Psychotherapy by reciprocal inhibition. Stanford, CA: Stanford University Press. | 系統減敏感法出自此書；洪水法並非 Wolpe 提出，可引 Stampfl & Levis (1967) 的內爆治療或 Marks (1972)。 | police-109-counseling-1、police-109-counseling-4 |

### 原引用不完整，已補建議書目（35 筆）

| 原引用 | 建議完整書目 | 說明 | 使用題目 |
|---|---|---|---|
| Andrews & Bonta | Andrews, D. A., & Bonta, J. (2010). The psychology of criminal conduct (5th ed.). New Providence, NJ: LexisNexis/Anderson. | 原引用未標年份；建議統一為第 5 版 (2010)，或改用 Bonta & Andrews (2024) 第 7 版。LSI-R 另見 Andrews & Bonta (1995) 手冊。 | 110-犯罪學-4、114-犯罪學-2、115-犯罪學-3、115-心理學-2、115-諮商與輔導-4、監獄官-108-犯罪學與再犯預測-4、監獄官-109-犯罪學與再犯預測-2、監獄官-109-犯罪學與再犯預測-4、監獄官-110-犯罪學與再犯預測-3、監獄官-111-犯罪學與再犯預測-4、監獄官-112-犯罪學與再犯預測-4、監獄官-113-犯罪學與再犯預測-3、監獄官-114-犯罪學與再犯預測-4 |
| APA 測驗標準 | American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). Standards for educational and psychological testing. Washington, DC: AERA. | 原引用為簡稱；與「AERA, APA, & NCME (2014)」為同一份文件，建議統一寫法。 | 108-心理學-4 |
| Beccaria | Beccaria, C. (1764). Dei delitti e delle pene. Livorno.（英譯 On Crimes and Punishments） | 原引用未標年份，建議統一為 Beccaria (1764)。 | 111-犯罪學-1 |
| Berg | De Jong, P., & Berg, I. K. (2013). Interviewing for solutions (4th ed.). Belmont, CA: Brooks/Cole. | 原引用只有姓氏；Insoo Kim Berg 常見引用另有 Berg & Miller (1992) Working with the problem drinker。 | 114-諮商與輔導-1 |
| Bonta & Andrews, The Psychology of Criminal Conduct（Routledge） | Bonta, J., & Andrews, D. A. (2017). The psychology of criminal conduct (6th ed.). New York: Routledge. | 原引用未標版次；Routledge 出版的是第 6 版 (2017) 與第 7 版 (2024)。 | 115-犯罪學-2 |
| CASEL | Collaborative for Academic, Social, and Emotional Learning. (2020). CASEL’s SEL framework: What are the core competence areas and where are they promoted? Chicago: CASEL. | 原引用未標年份；五大能力架構可引用 CASEL (2020) 官方架構說明。 | 薦任升等（矯正）-112-諮商與輔導-2 |
| Comer, Abnormal Psychology | Comer, R. J., & Comer, J. S. (2021). Abnormal psychology (11th ed.). New York: Worth. | 原引用未標年份與版次；請依講義使用的版本補上（例如第 9 版 2015、第 10 版 2018、第 11 版 2021）。 | 110-心理學-1 |
| Corey et al. | Corey, G., Corey, M. S., Corey, C., & Callanan, P. (2015). Issues and ethics in the helping professions (9th ed.). Stamford, CT: Cengage Learning. | 原引用未標書名與年份；依內容（反移情、督導、自我照顧）推定為此書，請以講義核對。 | 111-諮商與輔導-4、監獄官-115-諮商與矯正輔導-1 |
| Corey, Corey & Callanan | Corey, G., Corey, M. S., Corey, C., & Callanan, P. (2015). Issues and ethics in the helping professions (9th ed.). Stamford, CT: Cengage Learning. | 原引用未標年份；第 9 版起作者為四人，第 10 版 (2019) 作者為 Corey, Corey, & Corey。 | 111-諮商與輔導-4 |
| de Vries Robbé et al. | de Vries Robbé, M., de Vogel, V., & de Spa, E. (2011). Protective factors for violence risk in forensic psychiatric patients: A retrospective validation study of the SAPROF. International Journal of Forensic Mental Health, 10(3), 178–186. | 原引用未標年份；SAPROF 工具手冊為 de Vogel, de Ruiter, Bouman, & de Vries Robbé (2009/2012)。 | 115-犯罪學-3 |
| Dreikurs | Dreikurs, R. (1967). Psychodynamics, psychotherapy, and counseling: Collected papers. Chicago: Alfred Adler Institute. | 原引用未標年份；阿德勒治療四階段常引此書，錯誤目標則引 Dreikurs & Soltz (1964)。 | 113-諮商與輔導-4、監獄官-114-諮商與矯正輔導-1、police-108-counseling-2 |
| Ferri | Ferri, E. (1884). Sociologia criminale. Torino: Bocca.（英譯 Criminal Sociology, 1917） | 原引用未標年份。 | 監所管理員-108-犯罪學概要-2 |
| Freud | Freud, S. (1923). Das Ich und das Es. Wien: Internationaler Psychoanalytischer Verlag.（英譯 The Ego and the Id） | 原引用未標年份；依內容選擇：人格結構引 Freud (1923)、焦慮引 Freud (1926)、夢的解析引 Freud (1900)、潛抑與遺忘引 Freud (1915) Repression 或 (1901) 日常生活的心理病理學。 | 109-諮商與輔導-3、110-諮商與輔導-1、監獄官-111-諮商與矯正輔導-1、監獄官-113-諮商與矯正輔導-1、監獄官-115-諮商與矯正輔導-1、police-110-psychology-1、police-115-psychology-3、108-心理測驗員-心理學-1、監所管理員-109-犯罪學概要-2 |
| Garraud | Garraud, R. (1888–1894). Traité théorique et pratique du droit pénal français. Paris: Larose. | 原引用只有姓氏；新古典學派代表人物的列法請以講義核對。 | police-110-criminology_prevention-2 |
| Geldard & Geldard | Geldard, K., Geldard, D., & Foo, R. Y. (2016). Counselling adolescents: The proactive approach for young people (4th ed.). London: Sage. | 原引用未標年份與書名；依內容（青少年諮商、媒材運用）推定為此書。 | 111-諮商與輔導-2 |
| Gerrig & Zimbardo | Gerrig, R. J., & Zimbardo, P. G. (2010). Psychology and life (19th ed.). Boston: Allyn & Bacon. | 原引用未標年份與版次；請依講義版本補上。 | 110-心理學-3 |
| Gerrig & Zimbardo, Psychology and Life | Gerrig, R. J., & Zimbardo, P. G. (2010). Psychology and life (19th ed.). Boston: Allyn & Bacon. | 原引用未標年份與版次；請依講義版本補上。 | 110-心理學-3 |
| Lombroso | Lombroso, C. (1876). L’uomo delinquente. Milano: Hoepli. | 原引用未標年份，建議統一為 Lombroso (1876)。 | 112-犯罪學-1 |
| Moreno | Moreno, J. L. (1946). Psychodrama (Vol. 1). Beacon, NY: Beacon House. | 原引用未標年份。 | police-110-counseling-3 |
| Mosak & Maniacci | Mosak, H. H., & Maniacci, M. (1999). A primer of Adlerian psychology: The analytic-behavioral-cognitive psychology of Alfred Adler. Philadelphia: Brunner/Mazel. | 原引用未標年份與書名。 | 監獄官-114-諮商與矯正輔導-1、police-108-counseling-2 |
| Pranis | Pranis, K., Stuart, B., & Wedge, M. (2003). Peacemaking circles: From crime to community. St. Paul, MN: Living Justice Press. | 原引用只有姓氏。 | 監獄官-115-犯罪學與再犯預測-4 |
| Rossi | Rossi, P. (1829). Traité de droit pénal. Genève / Paris. | 原引用只有姓氏；新古典學派代表人物的列法請以講義核對。 | police-110-criminology_prevention-2 |
| Siegel, Criminology | Siegel, L. J. (2018). Criminology: Theories, patterns, and typologies (13th ed.). Boston: Cengage Learning. | 原引用未標年份與版次；建議與其他題目統一為 Siegel (2018)。 | 108-犯罪學-4 |
| Taxman et al. | Taxman, F. S., Pattavina, A., Caudy, M. S., Byrne, J., & Durso, J. (2013). The empirical basis for the RNR model with an updated RNR conceptual framework. In F. S. Taxman & A. Pattavina (Eds.), Simulation strategies to reduce recidivism (pp. 73–111). New York: Springer. | 原引用未標年份；RNR 模擬工具的出處請以講義核對。 | 監獄官-111-犯罪學與再犯預測-3 |
| UNODC | United Nations Office on Drugs and Crime. (2023). Global study on homicide 2023. Vienna: UNODC. | 原引用未標文件名稱與年份；官方統計可引 UNODC 犯罪趨勢調查 (UN-CTS) 或全球殺人研究報告，請依講義所指補上。 | police-111-criminology_prevention-1 |
| 台灣輔導與諮商學會倫理守則 | 台灣輔導與諮商學會（2023）。輔導與諮商專業倫理守則。 | 同上，建議統一寫法並以現行版本核對條次。 | 113-諮商與輔導-2 |
| 新世代反毒策略 | 行政院（2017）。新世代反毒策略行動綱領；行政院（2021）。新世代反毒策略行動綱領（第二期，110–113 年）。 | 原引用未標期別；作答時請標明引用第一期或第二期（或後續期別）。 | 監獄官-113-犯罪學與再犯預測-4 |
| 法務部修復式司法方案 | 法務部（2010 起）。修復式司法試行方案；法務部（2018）。推動修復式司法方案實施計畫。 | 原引用未標方案名稱與年份，請以講義核對。 | 監獄官-115-犯罪學與再犯預測-4 |
| 法務部矯正署家庭支持方案 | 法務部矯正署。收容人家庭支持服務相關方案。 | 原引用未標方案名稱與年份，請以講義核對。 | 監獄官-115-諮商與矯正輔導-3 |
| 社會心理學教材 | （未指明教材） | 原引用過於籠統；「人際吸引」的定義可引 Berscheid & Walster (1978) Interpersonal attraction (2nd ed.)，或填入講義使用的社會心理學教科書。 | 108-心理學-3 |
| 臺灣心理學會倫理守則 | 台灣心理學會（2013）。台灣心理學會心理學專業人員倫理準則。 | 原引用未標正式名稱與年份；請以學會公告的現行版本核對條次。 | 薦任升等（矯正）-108-心理測驗-4、薦任升等（矯正）-114-心理測驗-4 |
| 臺灣輔導與諮商學會倫理守則 | 台灣輔導與諮商學會（2023）。輔導與諮商專業倫理守則。 | 學會正式名稱為「台灣輔導與諮商學會」，守則名稱為「輔導與諮商專業倫理守則」，建議三種寫法統一；條次請以學會公告的現行版本核對。 | 薦任升等（矯正）-108-諮商與輔導-4、police-109-counseling-2、police-110-counseling-1 |
| 行政院性別平等會 | 行政院性別平等會。數位／網路性別暴力之定義與類型（官方說明）。 | 原引用未標文件名稱與日期；定義原文請以性平會網站公告核對。 | 114-諮商與輔導-3 |
| 輔導與諮商專業倫理守則 | 台灣輔導與諮商學會（2023）。輔導與諮商專業倫理守則。 | 原引用未標制定機關與年份；請以學會網站公告的現行版本核對條次。 | 110-諮商與輔導-3、111-諮商與輔導-3、112-諮商與輔導-1 |
| 郭生玉，心理與教育測驗 | 郭生玉（1985）。心理與教育測驗。臺北：精華書局。 | 原引用未標年份；此書版次與刷次多，請依手邊版本補上。 | 薦任升等（矯正）-108-心理測驗-1 |

### 法規與官方文件（57 筆）

| 原引用 | 核對結果 | 使用題目 |
|---|---|---|
| 個人資料保護法 | 名稱正確，現行有效 | 薦任升等（矯正）-108-心理測驗-4、薦任升等（矯正）-114-心理測驗-4 |
| 優生保健法第 9 條第 2 項 | 已核對現行法：未婚之未成年人施行人工流產，應得法定代理人或輔助人之同意。 | police-109-counseling-2 |
| 兒童及少年性剝削防制條例第 2 條 | 名稱正確，現行有效 | police-114-criminology_prevention-4 |
| 兒童及少年性剝削防制條例第 36 條、第 38 條、第 39 條 | 名稱正確，現行有效 | police-114-criminology_prevention-4 |
| 兒童及少年性剝削防制條例第 39 條第 1 項、第 2 項 | 已核對現行法：第 1 項支付對價持有、第 2 項無正當理由持有，均處刑罰。 | police-114-criminology_prevention-4 |
| 兒童及少年福利與權益保障法第 53 條 | 已核對現行法：教育人員等知悉應於 24 小時內通報。涉性侵害者另依性侵害犯罪防治法第 11 條通報。 | police-109-counseling-2 |
| 刑法第 1 條 | 名稱正確，現行有效 | 108-犯罪學-4 |
| 刑法第 161 條 | 已核對現行法：脫逃罪。 | 112-諮商與輔導-1 |
| 刑法第 18 條、第 19 條 | 名稱正確，現行有效 | police-110-criminology_prevention-2 |
| 刑法第 185 條之 3 | 名稱正確，現行有效 | police-111-criminology_prevention-4 |
| 刑法第 19 條 | 名稱正確，現行有效 | 113-犯罪學-4、監獄官-114-犯罪學與再犯預測-3 |
| 刑法第 227 條 | 名稱正確，現行有效 | 112-諮商與輔導-2、police-109-counseling-2 |
| 刑法第 319 條之 1 | 已核對現行法：未經同意攝錄性影像。 | 114-諮商與輔導-3 |
| 刑法第 319 條之 3 | 已核對現行法：未經同意散布性影像。114-諮商與輔導-3 第 2 列的「性勒索」（以散布相威脅換取金錢或影像）另涉恐嚇取財（第 346 條）或強制、恐嚇（第 304、305 條），建議並列。 | 114-諮商與輔導-3 |
| 刑法第 319 條之 4 | 已核對現行法：製作、散布不實性影像（深偽）。 | 114-諮商與輔導-3 |
| 刑法第 358 條 | 已核對現行法：本條為入侵電腦罪。114-諮商與輔導-3 第 5 列「人肉搜索與冒用身分」的主要依據較宜引個人資料保護法第 41 條；只有盜用帳號登入時才涉及本條。 | 114-諮商與輔導-3 |
| 刑法第 47 條 | 名稱正確，現行有效 | 薦任升等（矯正）-112-犯罪學-4 |
| 刑法第 57 條 | 名稱正確，現行有效 | police-110-criminology_prevention-2 |
| 刑法第 77 條 | 名稱正確，現行有效 | 監獄官-112-犯罪學與再犯預測-4 |
| 刑法第 77 條第 2 項 | 已核對現行法：第 2 款為重罪累犯於假釋期間等五年內再犯最輕本刑五年以上之罪者不適用假釋。 | 薦任升等（矯正）-112-犯罪學-4 |
| 刑法第 87 條 | 名稱正確，現行有效 | 112-犯罪學-4、113-犯罪學-4、監獄官-114-犯罪學與再犯預測-3 |
| 刑法第 87 條第 4 項 | 已核對現行法：執行或延長期間內應每年評估有無繼續執行之必要。 | 監獄官-114-犯罪學與再犯預測-3 |
| 刑法第 91 條之 1 | 名稱正確，現行有效 | 112-犯罪學-4 |
| 國民小學與國民中學未入學或中途輟學學生通報及復學輔導辦法第 2 條 | 已核對現行法：未經請假、請假未獲准或不明原因未到校連續達三日以上；轉學生三日內未完成報到。 | 113-諮商與輔導-1 |
| 學生輔導法 | 名稱正確，現行有效 | police-108-counseling-1、police-111-counseling-4、police-115-counseling-3、police-115-counseling-4 |
| 學生輔導法第 6 條 | 已核對現行法：發展性、介入性、處遇性三級輔導。 | police-108-counseling-1、109-心理測驗員-心理學-2 |
| 家庭暴力防治法 | 名稱正確，現行有效 | 110-諮商與輔導-2、police-114-criminology_prevention-2、police-115-counseling-4 |
| 少年事件處理法第 1 條 | 名稱正確，現行有效 | 115-犯罪學-4 |
| 少年事件處理法第 18 條 | 名稱正確，現行有效 | 監獄官-111-犯罪學與再犯預測-2 |
| 少年事件處理法第 18 條第 2 項至第 4 項 | 已核對現行法。 | 115-犯罪學-4 |
| 少年事件處理法第 18 條第 5 項 | 已核對現行法：少輔會結合福利、教育、心理、醫療等資源輔導。 | 113-諮商與輔導-1 |
| 少年事件處理法第 18 條第 5 項、第 6 項 | 已核對現行法。 | 115-犯罪學-4 |
| 少年事件處理法第 3 條第 1 項第 2 款 | 名稱正確，現行有效 | 115-犯罪學-4 |
| 少年事件處理法第 42 條 | 名稱正確，現行有效 | police-115-psychology-4 |
| 少年事件處理法第 42 條第 2 項第 1 款 | 已核對現行法：禁戒。 | 114-犯罪學-4 |
| 少年事件處理法第 42 條第 5 項 | 已核對現行法：得召開協調、諮詢或整合資源之相關會議。 | 111-諮商與輔導-2 |
| 少年事件處理法第 83 條之 1 | 名稱正確，現行有效 | 監獄官-111-犯罪學與再犯預測-2 |
| 少年輔導委員會設置及輔導實施辦法第 8 條 | 已核對現行法：受理後十四日內判斷並決定是否開案。 | 115-犯罪學-4 |
| 性侵害犯罪防治法 | 監所管理員-109-犯罪學概要-3「治療輔導」可引第 31 條（身心治療、輔導或教育）；通報義務為第 11 條。登記報到條次請另行核對。 | 監所管理員-109-犯罪學概要-3 |
| 性別平等工作法 | 名稱正確，現行有效 | 112-諮商與輔導-2 |
| 性別平等教育法 | 名稱正確，現行有效 | 112-諮商與輔導-2、監所管理員-109-犯罪學概要-3 |
| 性別平等教育法第 15 條 | 已核對現行法：學校應積極維護懷孕學生之受教權。 | police-109-counseling-2 |
| 性別平等教育法第 25 條 | 已核對現行法：第 1 項為告知權益、提供心理諮商輔導與保護措施，第 2 項為得委請醫師、心理師等專業人員。 | 110-諮商與輔導-3 |
| 性別平等教育法第 25 條第 1 項 | 已核對現行法。 | 112-諮商與輔導-2 |
| 性別平等教育法第 25 條第 2 項 | 已核對現行法；110-諮商與輔導-3 第 5 列「轉介外部專業人員」與本項相符。 | 110-諮商與輔導-3、112-諮商與輔導-2 |
| 性別平等教育法第 36 條 | 已核對現行法：受理後二個月內完成調查，必要時得延長二次、每次不逾一個月。 | 112-諮商與輔導-2 |
| 性騷擾防治法 | 名稱正確，現行有效 | 112-諮商與輔導-2、114-諮商與輔導-3 |
| 更生保護法 | 名稱正確，現行有效 | 監獄官-112-諮商與矯正輔導-4、薦任升等（矯正）-110-諮商與輔導-4、police-112-counseling-1 |
| 校園霸凌防制準則 | 名稱正確，現行有效 | 112-諮商與輔導-3 |
| 毒品危害防制條例 | 名稱正確，現行有效 | 監獄官-114-犯罪學與再犯預測-4、薦任升等（矯正）-108-諮商與輔導-2、police-112-counseling-3、113-家事調查官-心理測驗員-心理學-2 |
| 毒品危害防制條例第 2 條 | 已核對現行法；大麻列第二級毒品。 | police-113-criminology_prevention-4 |
| 毒品危害防制條例第 24 條 | 已核對現行法：附命完成戒癮治療之緩起訴（刑事訴訟法第 253 條之 2 第 1 項第 6 款）。 | 113-家事調查官-心理測驗員-心理學-2 |
| 犯罪被害人權益保障法 | 名稱正確，現行有效 | police-114-criminology_prevention-3、police-115-counseling-4 |
| 犯罪被害人權益保障法第 1 條 | 已核對現行法：保障權益、提供支持服務及經濟補助、修復傷害。 | police-114-criminology_prevention-3 |
| 監獄行刑法 | 112-諮商與輔導-1「協助探望母親」可引第 28 條（親屬喪亡或重大特殊事故得戒護返家探視）；監獄官-113-犯罪學與再犯預測-3 個別處遇計畫為第 11 條第 3 項（入監後三個月內訂定）。 | 112-諮商與輔導-1、監獄官-113-犯罪學與再犯預測-3、監獄官-115-諮商與矯正輔導-4、police-108-criminology_prevention-4 |
| 自殺防治法 | 112-諮商與輔導-3 媒體報導規範為第 16 條（已核對）；通報為第 11 條。 | 薦任升等（矯正）-112-諮商與輔導-3、police-110-counseling-4 |
| 自殺防治法第 11 條 | 已核對現行法：自殺防治通報系統，通報人身分應保密。 | police-110-counseling-4 |

### 書目已確認（381 筆）

- **Abramson, Seligman & Teasdale (1978)**：Abramson, L. Y., Seligman, M. E. P., & Teasdale, J. D. (1978). Learned helplessness in humans: Critique and reformulation. Journal of Abnormal Psychology, 87(1), 49–74.　*補充：「無望感」導致憂鬱的說法屬後續的無望理論：Abramson, Metalsky, & Alloy (1989), Psychological Review, 96(2), 358–372。*
- **Adler (1927)**：Adler, A. (1927). Menschenkenntnis. Leipzig: Hirzel.（英譯 Understanding Human Nature, 1927）
- **Adler (1938)**：Adler, A. (1938). Social interest: A challenge to mankind. London: Faber & Faber.（德文原著 Der Sinn des Lebens, 1933）
- **AERA, APA, & NCME (2014)**：American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). Standards for educational and psychological testing. Washington, DC: AERA.
- **Agnew (1992)**：Agnew, R. (1992). Foundation for a general strain theory of crime and delinquency. Criminology, 30(1), 47–87.　*補充：原文的緊張來源為三大類（未達正向目標、失去正向刺激、出現負向刺激）；「第四種來源」可能是講義的細分方式。*
- **Agnew (2006)**：Agnew, R. (2006). Pressured into crime: An overview of general strain theory. Los Angeles: Roxbury.
- **Agnew (2014)**：Agnew, R. (2014). Social concern and crime: Moving beyond the assumption of simple self-interest. Criminology, 52(1), 1–32.
- **Aichhorn (1925)**：Aichhorn, A. (1925). Verwahrloste Jugend. Wien: Internationaler Psychoanalytischer Verlag.（英譯 Wayward Youth, 1935）
- **Ainsworth et al. (1978)**：Ainsworth, M. D. S., Blehar, M. C., Waters, E., & Wall, S. (1978). Patterns of attachment: A psychological study of the strange situation. Hillsdale, NJ: Erlbaum.
- **Akers (1985)**：Akers, R. L. (1985). Deviant behavior: A social learning approach (3rd ed.). Belmont, CA: Wadsworth.　*補充：差別增強理論最早見 Burgess & Akers (1966), Social Problems, 14(2), 128–147。*
- **Aldao et al. (2010)**：Aldao, A., Nolen-Hoeksema, S., & Schweizer, S. (2010). Emotion-regulation strategies across psychopathology: A meta-analytic review. Clinical Psychology Review, 30(2), 217–237.
- **Alexander (2008)**：Alexander, B. K. (2008). The globalization of addiction: A study in poverty of the spirit. Oxford: Oxford University Press.　*補充：「老鼠樂園」實驗原始報告：Alexander, Coambs, & Hadaway (1978), Psychopharmacology, 58, 175–179。*
- **Anastasi & Urbina (1997)**：Anastasi, A., & Urbina, S. (1997). Psychological testing (7th ed.). Upper Saddle River, NJ: Prentice Hall.
- **Andrews & Bonta (2010)**：Andrews, D. A., & Bonta, J. (2010). The psychology of criminal conduct (5th ed.). New Providence, NJ: LexisNexis/Anderson.
- **Andrews, Bonta & Hoge (1990), Criminal Justice and Behavior, 17(1)**：Andrews, D. A., Bonta, J., & Hoge, R. D. (1990). Classification for effective rehabilitation: Rediscovering psychology. Criminal Justice and Behavior, 17(1), 19–52.
- **APA, DSM-5 (2013)**：American Psychiatric Association. (2013). Diagnostic and statistical manual of mental disorders (5th ed.). Arlington, VA: American Psychiatric Publishing.　*補充：現行版本為 DSM-5-TR (2022)；本平臺引用的診斷準則內容在 TR 版大致相同，作答時可註明版本。*
- **APA, DSM-5 (2013) Section III**：American Psychiatric Association. (2013). Alternative DSM-5 model for personality disorders. In Diagnostic and statistical manual of mental disorders (5th ed., Section III, pp. 761–781). Arlington, VA: American Psychiatric Publishing.
- **Arnett (2000)**：Arnett, J. J. (2000). Emerging adulthood: A theory of development from the late teens through the twenties. American Psychologist, 55(5), 469–480.
- **Asch (1956)**：Asch, S. E. (1956). Studies of independence and conformity: I. A minority of one against a unanimous majority. Psychological Monographs: General and Applied, 70(9), 1–70.
- **Athens (1997)**：Athens, L. H. (1997). Violent criminal acts and actors revisited. Urbana: University of Illinois Press.
- **Austin & Krisberg (1981)**：Austin, J., & Krisberg, B. (1981). Wider, stronger, and different nets: The dialectics of criminal justice reform. Journal of Research in Crime and Delinquency, 18(1), 165–196.
- **Babor et al. (2001)**：Babor, T. F., Higgins-Biddle, J. C., Saunders, J. B., & Monteiro, M. G. (2001). AUDIT: The Alcohol Use Disorders Identification Test—Guidelines for use in primary care (2nd ed.). Geneva: World Health Organization.
- **Baltes (1987)**：Baltes, P. B. (1987). Theoretical propositions of life-span developmental psychology: On the dynamics between growth and decline. Developmental Psychology, 23(5), 611–626.
- **Baltes (1997)**：Baltes, P. B. (1997). On the incomplete architecture of human ontogeny: Selection, optimization, and compensation as foundation of developmental theory. American Psychologist, 52(4), 366–380.
- **Baltes & Baltes (1990)**：Baltes, P. B., & Baltes, M. M. (1990). Psychological perspectives on successful aging: The model of selective optimization with compensation. In P. B. Baltes & M. M. Baltes (Eds.), Successful aging (pp. 1–34). Cambridge: Cambridge University Press.
- **Bandura (1973, 1977)**：Bandura, A. (1973). Aggression: A social learning analysis. Englewood Cliffs, NJ: Prentice-Hall.／Bandura, A. (1977). Social learning theory. Englewood Cliffs, NJ: Prentice-Hall.　*補充：攻擊的五項激起因素（示範、嫌惡經驗、誘因、指令控制、怪異象徵控制）出自 1973 年專書。*
- **Bandura (1973)**：Bandura, A. (1973). Aggression: A social learning analysis. Englewood Cliffs, NJ: Prentice-Hall.
- **Bandura (1977, 1986)**：Bandura, A. (1977). Social learning theory. Englewood Cliffs, NJ: Prentice-Hall.／Bandura, A. (1986). Social foundations of thought and action: A social cognitive theory. Englewood Cliffs, NJ: Prentice-Hall.
- **Bandura (1997)**：Bandura, A. (1997). Self-efficacy: The exercise of control. New York: W. H. Freeman.
- **Bandura (1999)**：Bandura, A. (1999). Moral disengagement in the perpetration of inhumanities. Personality and Social Psychology Review, 3(3), 193–209.
- **Barrick & Mount (1991)**：Barrick, M. R., & Mount, M. K. (1991). The Big Five personality dimensions and job performance: A meta-analysis. Personnel Psychology, 44(1), 1–26.
- **Bartholomew & Horowitz (1991)**：Bartholomew, K., & Horowitz, L. M. (1991). Attachment styles among young adults: A test of a four-category model. Journal of Personality and Social Psychology, 61(2), 226–244.
- **Bartlett (1932)**：Bartlett, F. C. (1932). Remembering: A study in experimental and social psychology. Cambridge: Cambridge University Press.
- **Batson (2009)**：Batson, C. D. (2009). These things called empathy: Eight related but distinct phenomena. In J. Decety & W. Ickes (Eds.), The social neuroscience of empathy (pp. 3–15). Cambridge, MA: MIT Press.
- **Beccaria (1764)**：Beccaria, C. (1764). Dei delitti e delle pene. Livorno.（英譯 On Crimes and Punishments）
- **Beck (1967, 1976)**：Beck, A. T. (1967). Depression: Clinical, experimental, and theoretical aspects. New York: Hoeber.／Beck, A. T. (1976). Cognitive therapy and the emotional disorders. New York: International Universities Press.
- **Beck (1976)**：Beck, A. T. (1976). Cognitive therapy and the emotional disorders. New York: International Universities Press.　*補充：「標籤化與錯誤標籤化」較完整的整理見 Beck, Rush, Shaw, & Emery (1979)。*
- **Beck et al. (1993)**：Beck, A. T., Wright, F. D., Newman, C. F., & Liese, B. S. (1993). Cognitive therapy of substance abuse. New York: Guilford Press.
- **Beck, J. S. (2011)**：Beck, J. S. (2011). Cognitive behavior therapy: Basics and beyond (2nd ed.). New York: Guilford Press.　*補充：已有第 3 版 (2020)。*
- **Beck, Steer & Brown (1996)**：Beck, A. T., Steer, R. A., & Brown, G. K. (1996). Manual for the Beck Depression Inventory–II. San Antonio, TX: Psychological Corporation.　*補充：BDI-II 手冊切截分數：0–13 極輕微、14–19 輕度、20–28 中度、29–63 重度；中文版常模請以中文版手冊為準。*
- **Becker (1963)**：Becker, H. S. (1963). Outsiders: Studies in the sociology of deviance. New York: Free Press.
- **Bedau (1974)**：Schur, E. M., & Bedau, H. A. (1974). Victimless crimes: Two sides of a controversy. Englewood Cliffs, NJ: Prentice-Hall.　*補充：Bedau 的論述收錄於與 Schur 合著的此書；四項特性的正式表述仍請以講義核對。*
- **Belsky & Pluess (2009)**：Belsky, J., & Pluess, M. (2009). Beyond diathesis stress: Differential susceptibility to environmental influences. Psychological Bulletin, 135(6), 885–908.
- **Bem (1972)**：Bem, D. J. (1972). Self-perception theory. Advances in Experimental Social Psychology, 6, 1–62.
- **Bentham (1789)**：Bentham, J. (1789). An introduction to the principles of morals and legislation. London: T. Payne.　*補充：圓形監獄的設計出自 Bentham (1791)，若內容提到圓形監獄宜一併引用。*
- **Bentham (1791)**：Bentham, J. (1791). Panopticon; or, the inspection-house. Dublin / London: T. Payne.
- **Biderman & Reiss (1967)**：Biderman, A. D., & Reiss, A. J., Jr. (1967). On exploring the "dark figure" of crime. The Annals of the American Academy of Political and Social Science, 374(1), 1–15.
- **Block (1977)**：Block, R. (1977). Violent crime: Environment, interaction, and death. Lexington, MA: Lexington Books.
- **Bonta & Andrews (2007)**：Bonta, J., & Andrews, D. A. (2007). Risk-need-responsivity model for offender assessment and rehabilitation (User Report 2007-06). Ottawa: Public Safety Canada.
- **Bonta & Andrews (2007), Risk-Need-Responsivity Model for Offender Assessment and Rehabilitation, Public Safety Canada User Report 2007-06**：Bonta, J., & Andrews, D. A. (2007). Risk-need-responsivity model for offender assessment and rehabilitation (User Report 2007-06). Ottawa: Public Safety Canada.
- **Bordin (1979)**：Bordin, E. S. (1979). The generalizability of the psychoanalytic concept of the working alliance. Psychotherapy: Theory, Research & Practice, 16(3), 252–260.
- **Borum (2011)**：Borum, R. (2011). Radicalization into violent extremism I: A review of social science theories. Journal of Strategic Security, 4(4), 7–36.
- **Bowen (1978)**：Bowen, M. (1978). Family therapy in clinical practice. New York: Jason Aronson.
- **Bower (1981)**：Bower, G. H. (1981). Mood and memory. American Psychologist, 36(2), 129–148.
- **Bowlby (1969)**：Bowlby, J. (1969). Attachment and loss: Vol. 1. Attachment. New York: Basic Books.
- **Bradley & Caldwell (1984)**：Bradley, R. H., & Caldwell, B. M. (1984). The relation of infants’ home environments to achievement test performance in first grade: A follow-up study. Child Development, 55(3), 803–809.　*補充：Bradley 與 Caldwell 同年另有 HOME 量表相關論文；若講義所指不同，請以講義為準。*
- **Braga et al. (2019)**：Braga, A. A., Turchan, B. S., Papachristos, A. V., & Hureau, D. M. (2019). Hot spots policing and crime reduction: An update of an ongoing systematic review and meta-analysis. Journal of Experimental Criminology, 15(3), 289–311.
- **Braithwaite (1989)**：Braithwaite, J. (1989). Crime, shame and reintegration. Cambridge: Cambridge University Press.
- **Brantingham & Brantingham (1993)**：Brantingham, P. L., & Brantingham, P. J. (1993). Environment, routine, and situation: Toward a pattern theory of crime. In R. V. Clarke & M. Felson (Eds.), Routine activity and rational choice (Advances in Criminological Theory, Vol. 5, pp. 259–294). New Brunswick, NJ: Transaction.
- **Brantingham & Faust (1976)**：Brantingham, P. J., & Faust, F. L. (1976). A conceptual model of crime prevention. Crime & Delinquency, 22(3), 284–296.
- **Broadbent (1958)**：Broadbent, D. E. (1958). Perception and communication. London: Pergamon Press.
- **Bronfenbrenner (1979)**：Bronfenbrenner, U. (1979). The ecology of human development: Experiments by nature and design. Cambridge, MA: Harvard University Press.
- **Bucklen (2021)**：Bucklen, K. B. (2021). Desistance-focused criminal justice practice (NCJ 301501). Washington, DC: National Institute of Justice.　*補充：已查證為 NIJ 2021 年 10 月白皮書：https://www.ojp.gov/pdffiles1/nij/301501.pdf*
- **Burgess (1928)**：Burgess, E. W. (1928). Factors determining success or failure on parole. In A. A. Bruce, A. J. Harno, E. W. Burgess, & J. Landesco, The workings of the indeterminate-sentence law and the parole system in Illinois (pp. 205–249). Springfield: Illinois State Board of Parole.
- **Burnstein & Vinokur (1977)**：Burnstein, E., & Vinokur, A. (1977). Persuasive argumentation and social comparison as determinants of attitude polarization. Journal of Experimental Social Psychology, 13(4), 315–332.
- **Bushman & Anderson (2001)**：Bushman, B. J., & Anderson, C. A. (2001). Is it time to pull the plug on the hostile versus instrumental aggression dichotomy? Psychological Review, 108(1), 273–279.
- **Byrne (1971)**：Byrne, D. (1971). The attraction paradigm. New York: Academic Press.
- **Cameron & turtle-song (2002)**：Cameron, S., & turtle-song, i. (2002). Learning to write case notes using the SOAP format. Journal of Counseling & Development, 80(3), 286–292.　*補充：第二作者姓名依原文以小寫書寫。*
- **Campbell & Fiske (1959)**：Campbell, D. T., & Fiske, D. W. (1959). Convergent and discriminant validation by the multitrait-multimethod matrix. Psychological Bulletin, 56(2), 81–105.
- **Cannon (1927)**：Cannon, W. B. (1927). The James-Lange theory of emotions: A critical examination and an alternative theory. The American Journal of Psychology, 39, 106–124.
- **Casey et al. (2008)**：Casey, B. J., Jones, R. M., & Hare, T. A. (2008). The adolescent brain. Annals of the New York Academy of Sciences, 1124, 111–126.
- **Cattell (1963)**：Cattell, R. B. (1963). Theory of fluid and crystallized intelligence: A critical experiment. Journal of Educational Psychology, 54(1), 1–22.
- **Cialdini (2001)**：Cialdini, R. B. (2001). Influence: Science and practice (4th ed.). Boston: Allyn & Bacon.
- **Cialdini et al. (1975)**：Cialdini, R. B., Vincent, J. E., Lewis, S. K., Catalan, J., Wheeler, D., & Darby, B. L. (1975). Reciprocal concessions procedure for inducing compliance: The door-in-the-face technique. Journal of Personality and Social Psychology, 31(2), 206–215.
- **Clarke (1997)**：Clarke, R. V. (Ed.). (1997). Situational crime prevention: Successful case studies (2nd ed.). Guilderland, NY: Harrow and Heston.
- **Clinard & Quinney (1973)**：Clinard, M. B., & Quinney, R. (1973). Criminal behavior systems: A typology (2nd ed.). New York: Holt, Rinehart and Winston.
- **Cloward & Ohlin (1960)**：Cloward, R. A., & Ohlin, L. E. (1960). Delinquency and opportunity: A theory of delinquent gangs. Glencoe, IL: Free Press.
- **Cohen (1955)**：Cohen, A. K. (1955). Delinquent boys: The culture of the gang. Glencoe, IL: Free Press.
- **Cohen & Felson (1979)**：Cohen, L. E., & Felson, M. (1979). Social change and crime rate trends: A routine activity approach. American Sociological Review, 44(4), 588–608.
- **Colvin (2000)**：Colvin, M. (2000). Crime and coercion: An integrated theory of chronic criminality. New York: St. Martin’s Press.　*補充：111-犯罪學-3 第 4 列「權威型教養」概念出自 Baumrind (1966/1971)，非 Colvin。*
- **Corey (2016)**：Corey, G. (2016). Theory and practice of group counseling (9th ed.). Boston: Cengage Learning.　*補充：團體諮商題引用此書；個別諮商理論題請改引 Corey (2017)。*
- **Corey (2017)**：Corey, G. (2017). Theory and practice of counseling and psychotherapy (10th ed.). Boston: Cengage Learning.
- **Corey et al. (2015)**：Corey, G., Corey, M. S., Corey, C., & Callanan, P. (2015). Issues and ethics in the helping professions (9th ed.). Stamford, CT: Cengage Learning.
- **Cornish (1994)**：Cornish, D. B. (1994). The procedural analysis of offending and its relevance for situational prevention. Crime Prevention Studies, 3, 151–196.
- **Cornish & Clarke (1986)**：Cornish, D. B., & Clarke, R. V. (Eds.). (1986). The reasoning criminal: Rational choice perspectives on offending. New York: Springer-Verlag.
- **Cornish & Clarke (2003)**：Cornish, D. B., & Clarke, R. V. (2003). Opportunities, precipitators and criminal decisions: A reply to Wortley’s critique of situational crime prevention. Crime Prevention Studies, 16, 41–96.　*補充：二十五項情境預防技術出自此文。*
- **Costa & McCrae (1992)**：Costa, P. T., Jr., & McCrae, R. R. (1992). Revised NEO Personality Inventory (NEO PI-R) and NEO Five-Factor Inventory (NEO-FFI) professional manual. Odessa, FL: Psychological Assessment Resources.
- **Courchesne et al. (2007)**：Courchesne, E., Pierce, K., Schumann, C. M., et al. (2007). Mapping early brain development in autism. Neuron, 56(2), 399–413.
- **Craik & Lockhart (1972)**：Craik, F. I. M., & Lockhart, R. S. (1972). Levels of processing: A framework for memory research. Journal of Verbal Learning and Verbal Behavior, 11(6), 671–684.
- **Cronbach (1951)**：Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. Psychometrika, 16(3), 297–334.
- **Cronbach (1990)**：Cronbach, L. J. (1990). Essentials of psychological testing (5th ed.). New York: Harper & Row.
- **Crowe (2000)**：Crowe, T. D. (2000). Crime prevention through environmental design (2nd ed.). Boston: Butterworth-Heinemann.
- **Dalton et al. (2007)**：Dalton, J. H., Elias, M. J., & Wandersman, A. (2007). Community psychology: Linking individuals and communities (2nd ed.). Belmont, CA: Thomson Wadsworth.
- **de Shazer (1985)**：de Shazer, S. (1985). Keys to solution in brief therapy. New York: W. W. Norton.
- **de Shazer (1988)**：de Shazer, S. (1988). Clues: Investigating solutions in brief therapy. New York: W. W. Norton.
- **Deci & Ryan (1985)**：Deci, E. L., & Ryan, R. M. (1985). Intrinsic motivation and self-determination in human behavior. New York: Plenum.
- **Deci et al. (1999)**：Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. Psychological Bulletin, 125(6), 627–668.　*補充：此統合分析主要結論是有形酬賞會削弱內在動機；用於「連勝與排行短期提升參與」時，宜說明其限制。*
- **DeVellis (2017)**：DeVellis, R. F. (2017). Scale development: Theory and applications (4th ed.). Thousand Oaks, CA: Sage.
- **Devlin (1965)**：Devlin, P. (1965). The enforcement of morals. London: Oxford University Press.
- **DiIulio (1987)**：DiIulio, J. J., Jr. (1987). Governing prisons: A comparative study of correctional management. New York: Free Press.
- **Dodge (1980)**：Dodge, K. A. (1980). Social cognition and children’s aggressive behavior. Child Development, 51(1), 162–170.
- **Douglas & Waksler (1982)**：Douglas, J. D., & Waksler, F. C. (1982). The sociology of deviance: An introduction. Boston: Little, Brown.　*補充：「漏斗效應」的具體表述請以講義核對。*
- **Duncker (1945)**：Duncker, K. (1945). On problem-solving. Psychological Monographs, 58(5), i–113.
- **Dutton (2006)**：Dutton, D. G. (2006). Rethinking domestic violence. Vancouver: UBC Press.
- **Ebbinghaus (1885)**：Ebbinghaus, H. (1885). Über das Gedächtnis. Leipzig: Duncker & Humblot.（英譯 Memory: A Contribution to Experimental Psychology, 1913）
- **Ebel (1979)**：Ebel, R. L. (1979). Essentials of educational measurement (3rd ed.). Englewood Cliffs, NJ: Prentice-Hall.　*補充：Ebel 的鑑別度標準：.40 以上非常優良、.30–.39 優良、.20–.29 尚可、.19 以下應刪除或修改。*
- **Egan (2014)**：Egan, G. (2014). The skilled helper: A problem-management and opportunity-development approach to helping (10th ed.). Belmont, CA: Brooks/Cole.
- **Ekman (1992)**：Ekman, P. (1992). An argument for basic emotions. Cognition and Emotion, 6(3–4), 169–200.
- **Elkind (1967)**：Elkind, D. (1967). Egocentrism in adolescence. Child Development, 38(4), 1025–1034.
- **Elliott, Ageton & Canter (1979)**：Elliott, D. S., Ageton, S. S., & Canter, R. J. (1979). An integrated theoretical perspective on delinquent behavior. Journal of Research in Crime and Delinquency, 16(1), 3–27.　*補充：「上下、端對端、並列」三種整合方式的分類出自 Hirschi (1979)。*
- **Ellis (1962)**：Ellis, A. (1962). Reason and emotion in psychotherapy. New York: Lyle Stuart.
- **Engel (1977)**：Engel, G. L. (1977). The need for a new medical model: A challenge for biomedicine. Science, 196(4286), 129–136.
- **Epperson et al. (1998)**：Epperson, D. L., Kaul, J. D., Huot, S. J., Hesselton, D., Alexander, W., & Goldman, R. (1998). Minnesota Sex Offender Screening Tool–Revised (MnSOST-R). St. Paul: Minnesota Department of Corrections.
- **Erikson (1968)**：Erikson, E. H. (1968). Identity: Youth and crisis. New York: W. W. Norton.
- **Exner (2003)**：Exner, J. E., Jr. (2003). The Rorschach: A comprehensive system: Vol. 1. Basic foundations and principles of interpretation (4th ed.). Hoboken, NJ: Wiley.
- **Eysenck (1988)**：Eysenck, H. J. (1988). Personality, stress and cancer: Prediction and prophylaxis. British Journal of Medical Psychology, 61(1), 57–75.
- **Farrell & Pease (1993)**：Farrell, G., & Pease, K. (1993). Once bitten, twice bitten: Repeat victimisation and its implications for crime prevention (Crime Prevention Unit Paper 46). London: Home Office.
- **Farrington (2003)**：Farrington, D. P. (2003). Developmental and life-course criminology: Key theoretical and empirical issues. Criminology, 41(2), 221–256.
- **Felitti et al. (1998)**：Felitti, V. J., Anda, R. F., Nordenberg, D., et al. (1998). Relationship of childhood abuse and household dysfunction to many of the leading causes of death in adults: The Adverse Childhood Experiences (ACE) Study. American Journal of Preventive Medicine, 14(4), 245–258.
- **Felson & Clarke (1998)**：Felson, M., & Clarke, R. V. (1998). Opportunity makes the thief: Practical theory for crime prevention (Police Research Series Paper 98). London: Home Office.
- **Festinger (1954)**：Festinger, L. (1954). A theory of social comparison processes. Human Relations, 7(2), 117–140.
- **Festinger (1957)**：Festinger, L. (1957). A theory of cognitive dissonance. Stanford, CA: Stanford University Press.
- **Festinger, Pepitone & Newcomb (1952)**：Festinger, L., Pepitone, A., & Newcomb, T. (1952). Some consequences of de-individuation in a group. Journal of Abnormal and Social Psychology, 47(2S), 382–389.
- **Festinger, Schachter & Back (1950)**：Festinger, L., Schachter, S., & Back, K. (1950). Social pressures in informal groups: A study of human factors in housing. New York: Harper.
- **Finckenauer (1984)**：Finckenauer, J. O. (1984). Juvenile delinquency and corrections: The gap between theory and practice. Orlando, FL: Academic Press.
- **Finkelhor & Asdigian (1996)**：Finkelhor, D., & Asdigian, N. L. (1996). Risk factors for youth victimization: Beyond a lifestyles/routine activities theory approach. Violence and Victims, 11(1), 3–19.
- **Fisher & Geiselman (1992)**：Fisher, R. P., & Geiselman, R. E. (1992). Memory-enhancing techniques for investigative interviewing: The cognitive interview. Springfield, IL: Charles C Thomas.
- **Fiske & Neuberg (1990)**：Fiske, S. T., & Neuberg, S. L. (1990). A continuum of impression formation, from category-based to individuating processes. Advances in Experimental Social Psychology, 23, 1–74.
- **Flynn (1987)**：Flynn, J. R. (1987). Massive IQ gains in 14 nations: What IQ tests really measure. Psychological Bulletin, 101(2), 171–191.
- **Fox & Levin (2003)**：Fox, J. A., & Levin, J. (2003). Mass murder: An analysis of extreme violence. Journal of Applied Psychoanalytic Studies, 5(1), 47–64.
- **Frank (1939)**：Frank, L. K. (1939). Projective methods for the study of personality. The Journal of Psychology, 8(2), 389–413.
- **Frankl (1946, 1969)**：Frankl, V. E. (1946). …trotzdem Ja zum Leben sagen: Ein Psychologe erlebt das Konzentrationslager. Wien: Jugend & Volk.／Frankl, V. E. (1969). The will to meaning. New York: World Publishing.
- **Frankl (1959)**：Frankl, V. E. (1959). From death-camp to existentialism. Boston: Beacon Press.（1962 年增訂版改名 Man’s Search for Meaning）
- **Frankl (1969)**：Frankl, V. E. (1969). The will to meaning: Foundations and applications of logotherapy. New York: World Publishing.
- **Fredrickson (2001)**：Fredrickson, B. L. (2001). The role of positive emotions in positive psychology: The broaden-and-build theory of positive emotions. American Psychologist, 56(3), 218–226.
- **Freedman & Fraser (1966)**：Freedman, J. L., & Fraser, S. C. (1966). Compliance without pressure: The foot-in-the-door technique. Journal of Personality and Social Psychology, 4(2), 195–202.
- **Freud (1923)**：Freud, S. (1923). Das Ich und das Es. Wien: Internationaler Psychoanalytischer Verlag.（英譯 The Ego and the Id）
- **Freud (1926)**：Freud, S. (1926). Hemmung, Symptom und Angst. Wien: Internationaler Psychoanalytischer Verlag.（英譯 Inhibitions, Symptoms and Anxiety）
- **Freud, A. (1936)**：Freud, A. (1936). Das Ich und die Abwehrmechanismen. Wien: Internationaler Psychoanalytischer Verlag.（英譯 The Ego and the Mechanisms of Defence, 1937）
- **Friedman & Rosenman (1974)**：Friedman, M., & Rosenman, R. H. (1974). Type A behavior and your heart. New York: Knopf.
- **Gendreau et al. (1996)**：Gendreau, P., Little, T., & Goggin, C. (1996). A meta-analysis of the predictors of adult offender recidivism: What works! Criminology, 34(4), 575–608.
- **Gendreau, Little & Goggin (1996)**：Gendreau, P., Little, T., & Goggin, C. (1996). A meta-analysis of the predictors of adult offender recidivism: What works! Criminology, 34(4), 575–608.
- **Gibson (1979)**：Gibson, J. J. (1979). The ecological approach to visual perception. Boston: Houghton Mifflin.
- **Gick & Holyoak (1980)**：Gick, M. L., & Holyoak, K. J. (1980). Analogical problem solving. Cognitive Psychology, 12(3), 306–355.
- **Glaser (1963)**：Glaser, R. (1963). Instructional technology and the measurement of learning outcomes: Some questions. American Psychologist, 18(8), 519–521.
- **Glasser (1998)**：Glasser, W. (1998). Choice theory: A new psychology of personal freedom. New York: HarperCollins.
- **Glueck & Glueck (1950)**：Glueck, S., & Glueck, E. (1950). Unraveling juvenile delinquency. New York: Commonwealth Fund.
- **Goldberg (1990, 1993)**：Goldberg, L. R. (1990). An alternative "description of personality": The Big-Five factor structure. Journal of Personality and Social Psychology, 59(6), 1216–1229.／Goldberg, L. R. (1993). The structure of phenotypic personality traits. American Psychologist, 48(1), 26–34.
- **Goldberg (1993)**：Goldberg, L. R. (1993). The structure of phenotypic personality traits. American Psychologist, 48(1), 26–34.
- **Goldstein (1985)**：Goldstein, P. J. (1985). The drugs/violence nexus: A tripartite conceptual framework. Journal of Drug Issues, 15(4), 493–506.
- **Goldstein (1990)**：Goldstein, H. (1990). Problem-oriented policing. New York: McGraw-Hill.　*補充：SARA 模式由 Eck & Spelman (1987) 提出。*
- **Gottfredson & Hirschi (1990)**：Gottfredson, M. R., & Hirschi, T. (1990). A general theory of crime. Stanford, CA: Stanford University Press.
- **Gross (1998)**：Gross, J. J. (1998). The emerging field of emotion regulation: An integrative review. Review of General Psychology, 2(3), 271–299.
- **Gross & John (2003)**：Gross, J. J., & John, O. P. (2003). Individual differences in two emotion regulation processes: Implications for affect, relationships, and well-being. Journal of Personality and Social Psychology, 85(2), 348–362.
- **Groth (1979)**：Groth, A. N. (1979). Men who rape: The psychology of the offender. New York: Plenum.
- **Hagan et al. (1987)**：Hagan, J., Simpson, J., & Gillis, A. R. (1987). Class in the household: A power-control theory of gender and delinquency. American Journal of Sociology, 92(4), 788–816.
- **Hammen (1991)**：Hammen, C. (1991). Generation of stress in the course of unipolar depression. Journal of Abnormal Psychology, 100(4), 555–561.
- **Hanson & Harris (2000)**：Hanson, R. K., & Harris, A. J. R. (2000). Where should we intervene? Dynamic predictors of sexual offense recidivism. Criminal Justice and Behavior, 27(1), 6–35.　*補充：SONAR 工具另見 Hanson & Harris (2001), Sexual Abuse, 13(2), 105–122。*
- **Hanson & Morton-Bourgon (2009)**：Hanson, R. K., & Morton-Bourgon, K. E. (2009). The accuracy of recidivism risk assessments for sexual offenders: A meta-analysis of 118 prediction studies. Psychological Assessment, 21(1), 1–21.
- **Hanson & Thornton (2000)**：Hanson, R. K., & Thornton, D. (2000). Improving risk assessments for sex offenders: A comparison of three actuarial scales. Law and Human Behavior, 24(1), 119–136.　*補充：現行修訂版 Static-99R 見 Helmus, Thornton, Hanson, & Babchishin (2012)。*
- **Hare (2003)**：Hare, R. D. (2003). The Hare Psychopathy Checklist–Revised (2nd ed.). Toronto: Multi-Health Systems.
- **Hart (1963)**：Hart, H. L. A. (1963). Law, liberty, and morality. Stanford, CA: Stanford University Press.
- **Hazan & Shaver (1987)**：Hazan, C., & Shaver, P. (1987). Romantic love conceptualized as an attachment process. Journal of Personality and Social Psychology, 52(3), 511–524.
- **Herman (1992)**：Herman, J. L. (1992). Trauma and recovery. New York: Basic Books.
- **Hill (2014)**：Hill, C. E. (2014). Helping skills: Facilitating exploration, insight, and action (4th ed.). Washington, DC: American Psychological Association.
- **Hindelang, Gottfredson & Garofalo (1978)**：Hindelang, M. J., Gottfredson, M. R., & Garofalo, J. (1978). Victims of personal crime: An empirical foundation for a theory of personal victimization. Cambridge, MA: Ballinger.
- **Hirschi (1969)**：Hirschi, T. (1969). Causes of delinquency. Berkeley: University of California Press.
- **Hirschi (1979)**：Hirschi, T. (1979). Separate and unequal is better. Journal of Research in Crime and Delinquency, 16(1), 34–38.
- **Hirschi & Gottfredson (1983)**：Hirschi, T., & Gottfredson, M. (1983). Age and the explanation of crime. American Journal of Sociology, 89(3), 552–584.
- **Holland (1997)**：Holland, J. L. (1997). Making vocational choices: A theory of vocational personalities and work environments (3rd ed.). Odessa, FL: Psychological Assessment Resources.
- **Holmes & Holmes (2010)**：Holmes, R. M., & Holmes, S. T. (2010). Serial murder (3rd ed.). Thousand Oaks, CA: Sage.
- **Holt & Bossler (2016)**：Holt, T. J., & Bossler, A. M. (2016). Cybercrime in progress: Theory and prevention of technology-enabled offenses. London: Routledge.
- **Holtfreter et al. (2008)**：Holtfreter, K., Reisig, M. D., & Pratt, T. C. (2008). Low self-control, routine activities, and fraud victimization. Criminology, 46(1), 189–220.
- **Horgan (2009)**：Horgan, J. (2009). Walking away from terrorism: Accounts of disengagement from radical and extremist movements. London: Routledge.
- **Horn & Cattell (1966)**：Horn, J. L., & Cattell, R. B. (1966). Refinement and test of the theory of fluid and crystallized general intelligences. Journal of Educational Psychology, 57(5), 253–270.
- **Horn & Cattell (1967)**：Horn, J. L., & Cattell, R. B. (1967). Age differences in fluid and crystallized intelligence. Acta Psychologica, 26, 107–129.
- **Jacobs et al. (2016)**：Jacobs, E. E., Schimmel, C. J., Masson, R. L., & Harvill, R. L. (2016). Group counseling: Strategies and skills (8th ed.). Boston: Cengage Learning.
- **Jaishankar (2008)**：Jaishankar, K. (2008). Space transition theory of cyber crimes. In F. Schmalleger & M. Pittaro (Eds.), Crimes of the Internet (pp. 283–301). Upper Saddle River, NJ: Prentice Hall.
- **Janis (1972)**：Janis, I. L. (1972). Victims of groupthink. Boston: Houghton Mifflin.
- **Jessor (1991)**：Jessor, R. (1991). Risk behavior in adolescence: A psychosocial framework for understanding and action. Journal of Adolescent Health, 12(8), 597–605.
- **Jessor & Jessor (1977)**：Jessor, R., & Jessor, S. L. (1977). Problem behavior and psychosocial development: A longitudinal study of youth. New York: Academic Press.
- **Jung (1959)**：Jung, C. G. (1959). The archetypes and the collective unconscious (Collected Works, Vol. 9, Pt. 1). Princeton, NJ: Princeton University Press.
- **Junger-Tas et al. (2010)**：Junger-Tas, J., Marshall, I. H., Enzmann, D., Killias, M., Steketee, M., & Gruszczynska, B. (Eds.). (2010). Juvenile delinquency in Europe and beyond: Results of the Second International Self-Report Delinquency Study. New York: Springer.
- **Kabat-Zinn (1990)**：Kabat-Zinn, J. (1990). Full catastrophe living: Using the wisdom of your body and mind to face stress, pain, and illness. New York: Delacorte.
- **Kahneman (1973)**：Kahneman, D. (1973). Attention and effort. Englewood Cliffs, NJ: Prentice-Hall.
- **Kahneman (2011)**：Kahneman, D. (2011). Thinking, fast and slow. New York: Farrar, Straus and Giroux.
- **Kahneman & Tversky (1979)**：Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. Econometrica, 47(2), 263–291.
- **Kalat (2016)**：Kalat, J. W. (2016). Biological psychology (12th ed.). Boston: Cengage Learning.
- **Kazdin (2001)**：Kazdin, A. E. (2001). Behavior modification in applied settings (6th ed.). Belmont, CA: Wadsworth.
- **Kelley (1967)**：Kelley, H. H. (1967). Attribution theory in social psychology. Nebraska Symposium on Motivation, 15, 192–238.　*補充：「以情境解釋自己的行為」較貼切的出處為行動者—觀察者偏誤：Jones & Nisbett (1971)。*
- **Kelly (1966)**：Kelly, J. G. (1966). Ecological constraints on mental health services. American Psychologist, 21(6), 535–539.
- **Kerr & Bowen (1988)**：Kerr, M. E., & Bowen, M. (1988). Family evaluation: An approach based on Bowen theory. New York: W. W. Norton.
- **Kitchener (1984)**：Kitchener, K. S. (1984). Intuition, critical evaluation and ethical principles: The foundation for ethical decisions in counseling psychology. The Counseling Psychologist, 12(3), 43–55.
- **Klerman et al. (1984)**：Klerman, G. L., Weissman, M. M., Rounsaville, B. J., & Chevron, E. S. (1984). Interpersonal psychotherapy of depression. New York: Basic Books.
- **Kohlberg (1969)**：Kohlberg, L. (1969). Stage and sequence: The cognitive-developmental approach to socialization. In D. A. Goslin (Ed.), Handbook of socialization theory and research (pp. 347–480). Chicago: Rand McNally.
- **Köhler (1925)**：Köhler, W. (1925). The mentality of apes (E. Winter, Trans.). London: Kegan Paul.（德文原著 1917）
- **Kohut (1977)**：Kohut, H. (1977). The restoration of the self. New York: International Universities Press.　*補充：「雙生自體客體」的完整論述見 Kohut (1984) How does analysis cure?*
- **Koob & Le Moal (2001)**：Koob, G. F., & Le Moal, M. (2001). Drug addiction, dysregulation of reward, and allostasis. Neuropsychopharmacology, 24(2), 97–129.
- **Kowalski et al. (2014)**：Kowalski, R. M., Giumetti, G. W., Schroeder, A. N., & Lattanner, M. R. (2014). Bullying in the digital age: A critical review and meta-analysis of cyberbullying research among youth. Psychological Bulletin, 140(4), 1073–1137.
- **Kraut et al. (1998)**：Kraut, R., Patterson, M., Lundmark, V., Kiesler, S., Mukophadhyay, T., & Scherlis, W. (1998). Internet paradox: A social technology that reduces social involvement and psychological well-being? American Psychologist, 53(9), 1017–1031.　*補充：同團隊的追蹤研究 Kraut et al. (2002) 發現負面效果已消失，作答時宜一併說明。*
- **Lab (2014)**：Lab, S. P. (2014). Crime prevention: Approaches, practices, and evaluations (8th ed.). Waltham, MA: Anderson.
- **Latané & Darley (1970)**：Latané, B., & Darley, J. M. (1970). The unresponsive bystander: Why doesn’t he help? New York: Appleton-Century-Crofts.
- **Latané et al. (1979)**：Latané, B., Williams, K., & Harkins, S. (1979). Many hands make light the work: The causes and consequences of social loafing. Journal of Personality and Social Psychology, 37(6), 822–832.
- **Laub & Sampson (2003)**：Laub, J. H., & Sampson, R. J. (2003). Shared beginnings, divergent lives: Delinquent boys to age 70. Cambridge, MA: Harvard University Press.
- **Laws (1989)**：Laws, D. R. (Ed.). (1989). Relapse prevention with sex offenders. New York: Guilford Press.
- **Lawton & Nahemow (1973)**：Lawton, M. P., & Nahemow, L. (1973). Ecology and the aging process. In C. Eisdorfer & M. P. Lawton (Eds.), The psychology of adult development and aging (pp. 619–674). Washington, DC: American Psychological Association.
- **Lazarus (1991)**：Lazarus, R. S. (1991). Emotion and adaptation. New York: Oxford University Press.
- **Lazarus & Folkman (1984)**：Lazarus, R. S., & Folkman, S. (1984). Stress, appraisal, and coping. New York: Springer.
- **Lemert (1951)**：Lemert, E. M. (1951). Social pathology: A systematic approach to the theory of sociopathic behavior. New York: McGraw-Hill.
- **Lepper et al. (1973)**：Lepper, M. R., Greene, D., & Nisbett, R. E. (1973). Undermining children’s intrinsic interest with extrinsic reward: A test of the "overjustification" hypothesis. Journal of Personality and Social Psychology, 28(1), 129–137.
- **Levine (2010)**：Levine, P. A. (2010). In an unspoken voice: How the body releases trauma and restores goodness. Berkeley, CA: North Atlantic Books.
- **Lewin (1935)**：Lewin, K. (1935). A dynamic theory of personality. New York: McGraw-Hill.
- **Lewin (1936)**：Lewin, K. (1936). Principles of topological psychology. New York: McGraw-Hill.　*補充：Lewin 的原公式為 B = f(P, E)；CB = f(P × E) 是犯罪學教材的延伸寫法。*
- **Lifton (1961)**：Lifton, R. J. (1961). Thought reform and the psychology of totalism: A study of "brainwashing" in China. New York: W. W. Norton.
- **Lipsey (2009)**：Lipsey, M. W. (2009). The primary factors that characterize effective interventions with juvenile offenders: A meta-analytic overview. Victims & Offenders, 4(2), 124–147.
- **Loeber et al. (1993)**：Loeber, R., Wung, P., Keenan, K., et al. (1993). Developmental pathways in disruptive child behavior. Development and Psychopathology, 5(1–2), 103–133.
- **Loftus (1979)**：Loftus, E. F. (1979). Eyewitness testimony. Cambridge, MA: Harvard University Press.
- **Loftus & Palmer (1974)**：Loftus, E. F., & Palmer, J. C. (1974). Reconstruction of automobile destruction: An example of the interaction between language and memory. Journal of Verbal Learning and Verbal Behavior, 13(5), 585–589.
- **Lombroso (1876)**：Lombroso, C. (1876). L’uomo delinquente. Milano: Hoepli.　*補充：完整的犯罪人分類（生來、精神病、偶發、激情）見後續版本及 Lombroso-Ferrero (1911)。*
- **Maguire & Raynor (2006)**：Maguire, M., & Raynor, P. (2006). How the resettlement of prisoners promotes desistance from crime: Or does it? Criminology & Criminal Justice, 6(1), 19–38.
- **Main & Solomon (1990)**：Main, M., & Solomon, J. (1990). Procedures for identifying infants as disorganized/disoriented during the Ainsworth Strange Situation. In M. T. Greenberg, D. Cicchetti, & E. M. Cummings (Eds.), Attachment in the preschool years (pp. 121–160). Chicago: University of Chicago Press.
- **Malchiodi (2005)**：Malchiodi, C. A. (Ed.). (2005). Expressive therapies. New York: Guilford Press.
- **Marlatt & Gordon (1985)**：Marlatt, G. A., & Gordon, J. R. (Eds.). (1985). Relapse prevention: Maintenance strategies in the treatment of addictive behaviors. New York: Guilford Press.
- **Marlowe (2012)**：Marlowe, D. B. (2012). Targeting the right participants for adult drug courts (Drug Court Practitioner Fact Sheet, 7(1)). Alexandria, VA: National Drug Court Institute.　*補充：RANT 工具由 Treatment Research Institute 發展；工具內容請以講義核對。*
- **Marshall et al. (2006)**：Marshall, W. L., Marshall, L. E., Serran, G. A., & Fernandez, Y. M. (2006). Treating sexual offenders: An integrated approach. New York: Routledge.
- **Martin & Pear (2015)**：Martin, G., & Pear, J. (2015). Behavior modification: What it is and how to do it (10th ed.). Boston: Pearson.
- **Maruna (2001)**：Maruna, S. (2001). Making good: How ex-convicts reform and rebuild their lives. Washington, DC: American Psychological Association.
- **Maslow (1954)**：Maslow, A. H. (1954). Motivation and personality. New York: Harper & Row.
- **Matza (1964)**：Matza, D. (1964). Delinquency and drift. New York: Wiley.
- **May (1953)**：May, R. (1953). Man’s search for himself. New York: W. W. Norton.
- **May (1977)**：May, R. (1977). The meaning of anxiety (Rev. ed.). New York: W. W. Norton.
- **McCauley & Moskalenko (2008)**：McCauley, C., & Moskalenko, S. (2008). Mechanisms of political radicalization: Pathways toward terrorism. Terrorism and Political Violence, 20(3), 415–433.
- **McCrae & Costa (1997)**：McCrae, R. R., & Costa, P. T., Jr. (1997). Personality trait structure as a human universal. American Psychologist, 52(5), 509–516.
- **McGeoch (1932)**：McGeoch, J. A. (1932). Forgetting and the law of disuse. Psychological Review, 39(4), 352–370.
- **Mednick et al. (1984)**：Mednick, S. A., Gabrielli, W. F., Jr., & Hutchings, B. (1984). Genetic influences in criminal convictions: Evidence from an adoption cohort. Science, 224(4651), 891–894.
- **Meichenbaum (1977)**：Meichenbaum, D. (1977). Cognitive-behavior modification: An integrative approach. New York: Plenum.
- **Meichenbaum (1985)**：Meichenbaum, D. (1985). Stress inoculation training. New York: Pergamon.
- **Merton (1938)**：Merton, R. K. (1938). Social structure and anomie. American Sociological Review, 3(5), 672–682.
- **Messick (1995)**：Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons’ responses and performances as scientific inquiry into score meaning. American Psychologist, 50(9), 741–749.
- **Messner & Rosenfeld (1994)**：Messner, S. F., & Rosenfeld, R. (1994). Crime and the American dream. Belmont, CA: Wadsworth.
- **Messner et al. (1989)**：Messner, S. F., Krohn, M. D., & Liska, A. E. (Eds.). (1989). Theoretical integration in the study of deviance and crime: Problems and prospects. Albany: State University of New York Press.
- **Messner, Krohn & Liska (1989)**：Messner, S. F., Krohn, M. D., & Liska, A. E. (Eds.). (1989). Theoretical integration in the study of deviance and crime: Problems and prospects. Albany: State University of New York Press.
- **Mill (1859)**：Mill, J. S. (1859). On liberty. London: John W. Parker and Son.
- **Miller (1956)**：Miller, G. A. (1956). The magical number seven, plus or minus two: Some limits on our capacity for processing information. Psychological Review, 63(2), 81–97.
- **Miller (1958)**：Miller, W. B. (1958). Lower class culture as a generating milieu of gang delinquency. Journal of Social Issues, 14(3), 5–19.
- **Miller & Rollnick (2002)**：Miller, W. R., & Rollnick, S. (2002). Motivational interviewing: Preparing people for change (2nd ed.). New York: Guilford Press.　*補充：第 3 版 (2013) 改以四歷程（投入、聚焦、喚起、計畫）架構，不再使用「與抗拒共舞」一詞；作答時可註明版本。*
- **Miller & Ross (1975)**：Miller, D. T., & Ross, M. (1975). Self-serving biases in the attribution of causality: Fact or fiction? Psychological Bulletin, 82(2), 213–225.
- **Moffitt (1993)**：Moffitt, T. E. (1993). Adolescence-limited and life-course-persistent antisocial behavior: A developmental taxonomy. Psychological Review, 100(4), 674–701.
- **Moffitt (2018)**：Moffitt, T. E. (2018). Male antisocial behaviour in adolescence and beyond. Nature Human Behaviour, 2(3), 177–186.
- **Monroe & Simons (1991)**：Monroe, S. M., & Simons, A. D. (1991). Diathesis-stress theories in the context of life stress research: Implications for the depressive disorders. Psychological Bulletin, 110(3), 406–425.
- **Morris & Peng (1994)**：Morris, M. W., & Peng, K. (1994). Culture and cause: American and Chinese attributions for social and physical events. Journal of Personality and Social Psychology, 67(6), 949–971.
- **Moscovici & Zavalloni (1969)**：Moscovici, S., & Zavalloni, M. (1969). The group as a polarizer of attitudes. Journal of Personality and Social Psychology, 12(2), 125–135.
- **Murray (1943)**：Murray, H. A. (1943). Thematic Apperception Test manual. Cambridge, MA: Harvard University Press.
- **Myers & Lamm (1976)**：Myers, D. G., & Lamm, H. (1976). The group polarization phenomenon. Psychological Bulletin, 83(4), 602–627.
- **Nagin (2013)**：Nagin, D. S. (2013). Deterrence in the twenty-first century. Crime and Justice, 42(1), 199–263.
- **Neff (2003)**：Neff, K. D. (2003). Self-compassion: An alternative conceptualization of a healthy attitude toward oneself. Self and Identity, 2(2), 85–101.
- **Neisser (1967)**：Neisser, U. (1967). Cognitive psychology. New York: Appleton-Century-Crofts.
- **Neisser et al. (1996)**：Neisser, U., Boodoo, G., Bouchard, T. J., Jr., et al. (1996). Intelligence: Knowns and unknowns. American Psychologist, 51(2), 77–101.
- **Newman (1972)**：Newman, O. (1972). Defensible space: Crime prevention through urban design. New York: Macmillan.
- **NIDA (2018)**：National Institute on Drug Abuse. (2018). Drugs, brains, and behavior: The science of addiction. Bethesda, MD: NIDA.　*補充：NIDA 網頁版會不定期更新，引用時可註明檢索日期。*
- **Nock (2010)**：Nock, M. K. (2010). Self-injury. Annual Review of Clinical Psychology, 6, 339–363.
- **Novaco (1975)**：Novaco, R. W. (1975). Anger control: The development and evaluation of an experimental treatment. Lexington, MA: Lexington Books.
- **Osborn (1953)**：Osborn, A. F. (1953). Applied imagination: Principles and procedures of creative thinking. New York: Scribner.
- **Pavlov (1927)**：Pavlov, I. P. (1927). Conditioned reflexes (G. V. Anrep, Trans.). London: Oxford University Press.
- **Pittenger (1993)**：Pittenger, D. J. (1993). The utility of the Myers-Briggs Type Indicator. Review of Educational Research, 63(4), 467–488.
- **Plomin (1990)**：Plomin, R. (1990). Nature and nurture: An introduction to human behavioral genetics. Pacific Grove, CA: Brooks/Cole.
- **Popham (1978)**：Popham, W. J. (1978). Criterion-referenced measurement. Englewood Cliffs, NJ: Prentice-Hall.
- **Premack (1959)**：Premack, D. (1959). Toward empirical behavior laws: I. Positive reinforcement. Psychological Review, 66(4), 219–233.
- **Quinney (1970)**：Quinney, R. (1970). The social reality of crime. Boston: Little, Brown.
- **Raine (2013)**：Raine, A. (2013). The anatomy of violence: The biological roots of crime. New York: Pantheon.
- **Ratcliffe (2016)**：Ratcliffe, J. H. (2016). Intelligence-led policing (2nd ed.). London: Routledge.
- **Ratts et al. (2016)**：Ratts, M. J., Singh, A. A., Nassar-McMillan, S., Butler, S. K., & McCullough, J. R. (2016). Multicultural and social justice counseling competencies: Guidelines for the counseling profession. Journal of Multicultural Counseling and Development, 44(1), 28–48.　*補充：四個發展領域：諮商師自我覺察、案主世界觀、諮商關係、諮商與倡議介入。*
- **Reicher, Spears & Postmes (1995)**：Reicher, S. D., Spears, R., & Postmes, T. (1995). A social identity model of deindividuation phenomena. European Review of Social Psychology, 6(1), 161–198.
- **Rizzolatti et al. (1996)**：Rizzolatti, G., Fadiga, L., Gallese, V., & Fogassi, L. (1996). Premotor cortex and the recognition of motor actions. Cognitive Brain Research, 3(2), 131–141.
- **Robinson & Berridge (1993)**：Robinson, T. E., & Berridge, K. C. (1993). The neural basis of drug craving: An incentive-sensitization theory of addiction. Brain Research Reviews, 18(3), 247–291.
- **Roediger & Karpicke (2006)**：Roediger, H. L., III, & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science, 17(3), 249–255.
- **Rogers (1957)**：Rogers, C. R. (1957). The necessary and sufficient conditions of therapeutic personality change. Journal of Consulting Psychology, 21(2), 95–103.
- **Rogers (1970)**：Rogers, C. R. (1970). Carl Rogers on encounter groups. New York: Harper & Row.
- **Room et al. (2010)**：Room, R., Fischer, B., Hall, W., Lenton, S., & Reuter, P. (2010). Cannabis policy: Moving beyond stalemate. Oxford: Oxford University Press.
- **Rorschach (1921)**：Rorschach, H. (1921). Psychodiagnostik. Bern: Bircher.
- **Rosenberg & Hovland (1960)**：Rosenberg, M. J., & Hovland, C. I. (1960). Cognitive, affective, and behavioral components of attitudes. In C. I. Hovland & M. J. Rosenberg (Eds.), Attitude organization and change (pp. 1–14). New Haven, CT: Yale University Press.
- **Ross (1977)**：Ross, L. (1977). The intuitive psychologist and his shortcomings: Distortions in the attribution process. Advances in Experimental Social Psychology, 10, 173–220.
- **Saleebey (1992)**：Saleebey, D. (Ed.). (1992). The strengths perspective in social work practice. New York: Longman.
- **SAMHSA (2014)**：Substance Abuse and Mental Health Services Administration. (2014). SAMHSA’s concept of trauma and guidance for a trauma-informed approach (HHS Publication No. SMA 14-4884). Rockville, MD: SAMHSA.
- **Sampson (1993)**：Sampson, R. J. (1993). The community context of violent victimization and offending. In W. J. Wilson (Ed.), Sociology and the public agenda (pp. 259–286). Newbury Park, CA: Sage.　*補充：請以講義核對所指篇章。*
- **Sampson & Laub (1993)**：Sampson, R. J., & Laub, J. H. (1993). Crime in the making: Pathways and turning points through life. Cambridge, MA: Harvard University Press.
- **Sampson et al. (1997)**：Sampson, R. J., Raudenbush, S. W., & Earls, F. (1997). Neighborhoods and violent crime: A multilevel study of collective efficacy. Science, 277(5328), 918–924.
- **Sampson, Raudenbush & Earls (1997)**：Sampson, R. J., Raudenbush, S. W., & Earls, F. (1997). Neighborhoods and violent crime: A multilevel study of collective efficacy. Science, 277(5328), 918–924.
- **Schacter (1987)**：Schacter, D. L. (1987). Implicit memory: History and current status. Journal of Experimental Psychology: Learning, Memory, and Cognition, 13(3), 501–518.
- **Schacter (2001)**：Schacter, D. L. (2001). The seven sins of memory: How the mind forgets and remembers. Boston: Houghton Mifflin.
- **Schein (1961)**：Schein, E. H. (1961). Coercive persuasion: A socio-psychological analysis of the "brainwashing" of American civilian prisoners by the Chinese communists. New York: W. W. Norton.
- **Schneider (1923)**：Schneider, K. (1923). Die psychopathischen Persönlichkeiten. Leipzig: Deuticke.
- **Schore (2001)**：Schore, A. N. (2001). The effects of early relational trauma on right brain development, affect regulation, and infant mental health. Infant Mental Health Journal, 22(1–2), 201–269.
- **Schur (1965)**：Schur, E. M. (1965). Crimes without victims: Deviant behavior and public policy. Englewood Cliffs, NJ: Prentice-Hall.
- **Schwarz & Clore (1983)**：Schwarz, N., & Clore, G. L. (1983). Mood, misattribution, and judgments of well-being: Informative and directive functions of affective states. Journal of Personality and Social Psychology, 45(3), 513–523.
- **Segal, Williams, & Teasdale (2002)**：Segal, Z. V., Williams, J. M. G., & Teasdale, J. D. (2002). Mindfulness-based cognitive therapy for depression: A new approach to preventing relapse. New York: Guilford Press.
- **Selfridge (1959)**：Selfridge, O. G. (1959). Pandemonium: A paradigm for learning. In Mechanisation of thought processes (pp. 511–529). London: H. M. Stationery Office.　*補充：B／13 歧義圖的情境效果經典研究為 Bruner & Minturn (1955)，舉此例時可並列。*
- **Seligman (1975)**：Seligman, M. E. P. (1975). Helplessness: On depression, development, and death. San Francisco: W. H. Freeman.
- **Seligman (2011)**：Seligman, M. E. P. (2011). Flourish: A visionary new understanding of happiness and well-being. New York: Free Press.
- **Seligman & Maier (1967)**：Seligman, M. E. P., & Maier, S. F. (1967). Failure to escape traumatic shock. Journal of Experimental Psychology, 74(1), 1–9.
- **Seligman et al. (2009)**：Seligman, M. E. P., Ernst, R. M., Gillham, J., Reivich, K., & Linkins, M. (2009). Positive education: Positive psychology and classroom interventions. Oxford Review of Education, 35(3), 293–311.
- **Sellin (1938)**：Sellin, T. (1938). Culture conflict and crime. New York: Social Science Research Council.
- **Selye (1956)**：Selye, H. (1956). The stress of life. New York: McGraw-Hill.
- **Shaw & McKay (1942)**：Shaw, C. R., & McKay, H. D. (1942). Juvenile delinquency and urban areas. Chicago: University of Chicago Press.
- **Sheldon (1949)**：Sheldon, W. H. (1949). Varieties of delinquent youth: An introduction to constitutional psychiatry. New York: Harper.
- **Sherman et al. (1989)**：Sherman, L. W., Gartin, P. R., & Buerger, M. E. (1989). Hot spots of predatory crime: Routine activities and the criminology of place. Criminology, 27(1), 27–56.
- **Shonkoff et al. (2012)**：Shonkoff, J. P., Garner, A. S., et al. (2012). The lifelong effects of early childhood adversity and toxic stress. Pediatrics, 129(1), e232–e246.
- **Short & Nye (1957)**：Short, J. F., Jr., & Nye, F. I. (1957). Reported behavior as a criterion of deviant behavior. Social Problems, 5(3), 207–213.
- **Siegel (2018)**：Siegel, L. J. (2018). Criminology: Theories, patterns, and typologies (13th ed.). Boston: Cengage Learning.
- **Simons & Chabris (1999)**：Simons, D. J., & Chabris, C. F. (1999). Gorillas in our midst: Sustained inattentional blindness for dynamic events. Perception, 28(9), 1059–1074.
- **Singer & Klimecki (2014)**：Singer, T., & Klimecki, O. M. (2014). Empathy and compassion. Current Biology, 24(18), R875–R878.
- **Skinner (1953)**：Skinner, B. F. (1953). Science and human behavior. New York: Macmillan.
- **Skogan (2006)**：Skogan, W. G. (2006). Police and community in Chicago: A tale of three cities. New York: Oxford University Press.
- **Smith et al. (2012)**：Smith, H. J., Pettigrew, T. F., Pippin, G. M., & Bialosiewicz, S. (2012). Relative deprivation: A theoretical and meta-analytic review. Personality and Social Psychology Review, 16(3), 203–232.
- **Sparks (1981)**：Sparks, R. F. (1981). Multiple victimization: Evidence, theory, and future research. Journal of Criminal Law and Criminology, 72(2), 762–778.
- **Sperry & Sperry (2012)**：Sperry, L., & Sperry, J. (2012). Case conceptualization: Mastering this competency with ease and confidence. New York: Routledge.
- **Squire (1987)**：Squire, L. R. (1987). Memory and brain. New York: Oxford University Press.
- **Stark (1987)**：Stark, R. (1987). Deviant places: A theory of the ecology of crime. Criminology, 25(4), 893–910.
- **Stasser & Titus (1985)**：Stasser, G., & Titus, W. (1985). Pooling of unshared information in group decision making: Biased information sampling during discussion. Journal of Personality and Social Psychology, 48(6), 1467–1478.
- **Steinberg (2008)**：Steinberg, L. (2008). A social neuroscience perspective on adolescent risk-taking. Developmental Review, 28(1), 78–106.
- **Sternberg (1985, 1997)**：Sternberg, R. J. (1985). Beyond IQ: A triarchic theory of human intelligence. New York: Cambridge University Press.／Sternberg, R. J. (1997). Successful intelligence. New York: Plume.
- **Sternberg (1997)**：Sternberg, R. J. (1997). Successful intelligence: How practical and creative intelligence determine success in life. New York: Plume.
- **Stoner (1961)**：Stoner, J. A. F. (1961). A comparison of individual and group decisions involving risk (Unpublished master’s thesis). Massachusetts Institute of Technology.
- **Strayer & Johnston (2001)**：Strayer, D. L., & Johnston, W. A. (2001). Driven to distraction: Dual-task studies of simulated driving and conversing on a cellular telephone. Psychological Science, 12(6), 462–466.
- **Sue et al. (1992)**：Sue, D. W., Arredondo, P., & McDavis, R. J. (1992). Multicultural counseling competencies and standards: A call to the profession. Journal of Counseling & Development, 70(4), 477–486.
- **Sue, Arredondo & McDavis (1992)**：Sue, D. W., Arredondo, P., & McDavis, R. J. (1992). Multicultural counseling competencies and standards: A call to the profession. Journal of Counseling & Development, 70(4), 477–486.
- **Suler (2004)**：Suler, J. (2004). The online disinhibition effect. CyberPsychology & Behavior, 7(3), 321–326.
- **Super (1980)**：Super, D. E. (1980). A life-span, life-space approach to career development. Journal of Vocational Behavior, 16(3), 282–298.
- **Sutherland (1939, 1947)**：Sutherland, E. H. (1939). Principles of criminology (3rd ed.). Philadelphia: Lippincott.／Sutherland, E. H. (1947). Principles of criminology (4th ed.). Philadelphia: Lippincott.
- **Sutherland (1947)**：Sutherland, E. H. (1947). Principles of criminology (4th ed.). Philadelphia: Lippincott.
- **Sykes & Matza (1957)**：Sykes, G. M., & Matza, D. (1957). Techniques of neutralization: A theory of delinquency. American Sociological Review, 22(6), 664–670.
- **Tarasoff v. Regents (1976)**：Tarasoff v. Regents of the University of California, 17 Cal. 3d 425, 551 P.2d 334 (Cal. 1976).
- **Thornberry et al. (1993)**：Thornberry, T. P., Krohn, M. D., Lizotte, A. J., & Chard-Wierschem, D. (1993). The role of juvenile gangs in facilitating delinquent behavior. Journal of Research in Crime and Delinquency, 30(1), 55–87.
- **Thrasher (1927)**：Thrasher, F. M. (1927). The gang: A study of 1,313 gangs in Chicago. Chicago: University of Chicago Press.
- **Tittle (1995)**：Tittle, C. R. (1995). Control balance: Toward a general theory of deviance. Boulder, CO: Westview.
- **Tolman (1948)**：Tolman, E. C. (1948). Cognitive maps in rats and men. Psychological Review, 55(4), 189–208.
- **Trotter (2015)**：Trotter, C. (2015). Working with involuntary clients: A guide to practice (3rd ed.). London: Routledge.
- **Tulving (1974)**：Tulving, E. (1974). Cue-dependent forgetting. American Scientist, 62(1), 74–82.　*補充：編碼特定原則另見 Tulving & Thomson (1973)；舌尖現象見 Brown & McNeill (1966)。*
- **Tversky & Kahneman (1973)**：Tversky, A., & Kahneman, D. (1973). Availability: A heuristic for judging frequency and probability. Cognitive Psychology, 5(2), 207–232.
- **Uchtenhagen (2011)**：Uchtenhagen, A. (2011). Heroin maintenance treatment: From idea to research to practice. Drug and Alcohol Review, 30(2), 130–137.
- **Vaillant (1977)**：Vaillant, G. E. (1977). Adaptation to life. Boston: Little, Brown.
- **van Dijk et al. (2007)**：van Dijk, J., van Kesteren, J., & Smit, P. (2007). Criminal victimisation in international perspective: Key findings from the 2004–2005 ICVS and EU ICS. The Hague: WODC.
- **Vandenberg & Lance (2000)**：Vandenberg, R. J., & Lance, C. E. (2000). A review and synthesis of the measurement invariance literature: Suggestions, practices, and recommendations for organizational research. Organizational Research Methods, 3(1), 4–70.
- **Vogel et al. (2014)**：Vogel, E. A., Rose, J. P., Roberts, L. R., & Eckles, K. (2014). Social comparison, social media, and self-esteem. Psychology of Popular Media Culture, 3(4), 206–222.
- **Wahba & Bridwell (1976)**：Wahba, M. A., & Bridwell, L. G. (1976). Maslow reconsidered: A review of research on the need hierarchy theory. Organizational Behavior and Human Performance, 15(2), 212–240.
- **Walker (1979)**：Walker, L. E. (1979). The battered woman. New York: Harper & Row.　*補充：「受虐婦女症候群」一詞的完整論述見 Walker (1984) The battered woman syndrome，可並列。*
- **Walker (2017)**：Walker, M. (2017). Why we sleep: Unlocking the power of sleep and dreams. New York: Scribner.　*補充：膠淋巴系統的原始研究為 Xie et al. (2013), Science, 342(6156), 373–377。*
- **Wallas (1926)**：Wallas, G. (1926). The art of thought. London: Jonathan Cape.
- **Walster et al. (1966)**：Walster, E., Aronson, V., Abrahams, D., & Rottman, L. (1966). Importance of physical attractiveness in dating behavior. Journal of Personality and Social Psychology, 4(5), 508–516.　*補充：「美即是好」的月暈效應另見 Dion, Berscheid, & Walster (1972)。*
- **Walters (1990)**：Walters, G. D. (1990). The criminal lifestyle: Patterns of serious criminal conduct. Newbury Park, CA: Sage.
- **Ward & Beech (2006)**：Ward, T., & Beech, A. (2006). An integrated theory of sexual offending. Aggression and Violent Behavior, 11(1), 44–63.
- **Ward & Brown (2004)**：Ward, T., & Brown, M. (2004). The good lives model and conceptual issues in offender rehabilitation. Psychology, Crime & Law, 10(3), 243–257.
- **Ward & Stewart (2003)**：Ward, T., & Stewart, C. A. (2003). Criminogenic needs and human needs: A theoretical model. Psychology, Crime & Law, 9(2), 125–143.　*補充：「避免目標與趨近目標」的再犯預防觀點另見 Mann, Webster, Schofield, & Marshall (2004)。*
- **Warren (1970)**：Warren, R. M. (1970). Perceptual restoration of missing speech sounds. Science, 167(3917), 392–393.
- **Watzlawick et al. (1974)**：Watzlawick, P., Weakland, J. H., & Fisch, R. (1974). Change: Principles of problem formation and problem resolution. New York: W. W. Norton.
- **Webb (2012)**：Webb, J. (2012). Running on empty: Overcome your childhood emotional neglect. New York: Morgan James.
- **Weisburd (2015)**：Weisburd, D. (2015). The law of crime concentration and the criminology of place. Criminology, 53(2), 133–157.
- **Wells et al. (1998)**：Wells, G. L., Small, M., Penrod, S., et al. (1998). Eyewitness identification procedures: Recommendations for lineups and photospreads. Law and Human Behavior, 22(6), 603–647.
- **Wertheimer (1923)**：Wertheimer, M. (1923). Untersuchungen zur Lehre von der Gestalt II. Psychologische Forschung, 4, 301–350.
- **White (2007)**：White, M. (2007). Maps of narrative practice. New York: W. W. Norton.
- **White & Epston (1990)**：White, M., & Epston, D. (1990). Narrative means to therapeutic ends. New York: W. W. Norton.　*補充：「不知道的姿態」較常引用 Anderson & Goolishian (1992)。*
- **WHO (2007)**：World Health Organization & International Association for Suicide Prevention. (2007). Preventing suicide in jails and prisons. Geneva: WHO.
- **WHO (2016)**：World Health Organization. (2016). The health and social effects of nonmedical cannabis use. Geneva: WHO.
- **WHO, ICD-11 (2019)**：World Health Organization. (2019). International classification of diseases (11th rev.). Geneva: WHO.（2022 年 1 月 1 日生效）
- **Wickens (2002)**：Wickens, C. D. (2002). Multiple resources and performance prediction. Theoretical Issues in Ergonomics Science, 3(2), 159–177.
- **Wilson et al. (2007)**：Wilson, R. J., Picheca, J. E., & Prinzo, M. (2007). Evaluating the effectiveness of professionally-facilitated volunteerism in the community-based management of high-risk sexual offenders: Part two. The Howard Journal of Criminal Justice, 46(4), 327–337.
- **Wilson, Picheca & Prinzo (2007)**：Wilson, R. J., Picheca, J. E., & Prinzo, M. (2007). Evaluating the effectiveness of professionally-facilitated volunteerism in the community-based management of high-risk sexual offenders: Part one. The Howard Journal of Criminal Justice, 46(3), 289–302.　*補充：CoSA 於 1994 年起源於加拿大安大略省漢米爾頓的門諾教會。*
- **Wolfe et al. (2009)**：Wolfe, D. A., Crooks, C., Jaffe, P., et al. (2009). A school-based program to prevent adolescent dating violence: A cluster randomized trial. Archives of Pediatrics & Adolescent Medicine, 163(8), 692–699.
- **Wolfgang (1958)**：Wolfgang, M. E. (1958). Patterns in criminal homicide. Philadelphia: University of Pennsylvania Press.
- **Wolfgang, Figlio, & Sellin (1972)**：Wolfgang, M. E., Figlio, R. M., & Sellin, T. (1972). Delinquency in a birth cohort. Chicago: University of Chicago Press.
- **Wubbolding (2000)**：Wubbolding, R. E. (2000). Reality therapy for the 21st century. Philadelphia: Brunner-Routledge.
- **Yalom (1980)**：Yalom, I. D. (1980). Existential psychotherapy. New York: Basic Books.
- **Yalom & Leszcz (2005)**：Yalom, I. D., & Leszcz, M. (2005). The theory and practice of group psychotherapy (5th ed.). New York: Basic Books.　*補充：已有第 6 版 (2020)。*
- **Yerkes & Dodson (1908)**：Yerkes, R. M., & Dodson, J. D. (1908). The relation of strength of stimulus to rapidity of habit-formation. Journal of Comparative Neurology and Psychology, 18(5), 459–482.
- **Zajonc (1968)**：Zajonc, R. B. (1968). Attitudinal effects of mere exposure. Journal of Personality and Social Psychology, 9(2, Pt. 2), 1–27.
- **Zehr (1990)**：Zehr, H. (1990). Changing lenses: A new focus for crime and justice. Scottdale, PA: Herald Press.
- **Zimbardo (1969)**：Zimbardo, P. G. (1969). The human choice: Individuation, reason, and order versus deindividuation, impulse, and chaos. Nebraska Symposium on Motivation, 17, 237–307.
- **Zimmerman (2000)**：Zimmerman, B. J. (2000). Attaining self-regulation: A social cognitive perspective. In M. Boekaerts, P. R. Pintrich, & M. Zeidner (Eds.), Handbook of self-regulation (pp. 13–39). San Diego: Academic Press.
- **Zubin & Spring (1977)**：Zubin, J., & Spring, B. (1977). Vulnerability: A new view of schizophrenia. Journal of Abnormal Psychology, 86(2), 103–126.
- **司法改革國是會議總結報告**：總統府司法改革國是會議籌備委員會（2017）。司法改革國是會議總結報告。
- **釋字第 664 號**：司法院大法官釋字第 664 號解釋（2009 年 7 月 31 日）。
