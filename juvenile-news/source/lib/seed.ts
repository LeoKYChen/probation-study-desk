import type { Issue } from "./weekly";
export const firstIssue: Issue = {
  id: "2026-10-12-opening", date:"2026-10-12", periodStart:"2026-10-05", periodEnd:"2026-10-11",
  title:"從處遇品質到公平參與：少年司法的四個觀察", sourceConversation:"網站創刊期・重新編製", status:"reviewed",
  note:"本期於 2026-10-12 重新查讀公開來源編製，並非 10/09 或 10/11 對話週報的原文。收錄兩份近期官方報告、一份臺灣研究摘要，以及一項持續追蹤計畫。歷史週報全文尚待匯入。",
  trend:"三份近期資料與修復計畫共同提醒：制度品質須落到個別需求、可近性與可檢驗的執行結果。對臺灣的借鏡是把『有沒有提供服務』再問深一層：誰取得服務、誰被排除，以及介入是否符合少年與被害人的實際需要。此為本站跨資料分析，不代表原作者共同結論。",
  originalMarkdown:"",
  items:[{
    id:"calderdale-2026",title:"好的關係，還需要一致的風險評估與處遇計畫",category:"少年司法制度",tags:["跨機關協作","少年參與","處遇品質"],type:"官方督察報告",
    publishedDate:"2026-10-06",eventDate:null,dateNote:"現場督察於 2026 年 5 月進行；確切起訖日未確認。",author:"HM Inspectorate of Probation（英格蘭及威爾斯）",
    sourceTitle:"An inspection of youth justice work with children and victims in Calderdale",url:"https://hmiprobation.justiceinspectorates.gov.uk/document/an-inspection-of-youth-justice-work-with-children-and-victims-in-calderdale-2026/",
    summary:"Calderdale 少年司法服務整體被評為『需要改善』。督察肯定與少年建立信任、聽取意見、教育與就業支持及回應溝通需求的工作；但保護少年與社區安全的評估、規劃及跨機關資訊運用仍不一致。",
    significance:"少輔會考核與保護處分執行可分別觀察關係建立、少年參與及安全評估。良好服務關係不等於計畫已能回應新出現的風險；建議檢視資訊變動後是否重新評估、具體分工及追蹤。此為對臺灣實務的延伸分析。",
    followUp:"少年表達的需求與跨機關新資訊，是否真的改變處遇計畫，而不只留在紀錄中？",
    limitation:"單一地方服務督察，不能推論英國整體或臺灣服務品質；未分析資料附錄的個案數據。",legalNature:"英國官方督察報告，並非臺灣法規。",checkedAt:"2026-10-12",readingScope:"官方 HTML 報告前言、建議、參與及公平章節；另核對官方新聞稿。",isBackground:false
  },{
    id:"taiwan-substance-2026",title:"兒少菸酒防治：把早期介入接上物質使用服務",category:"少年毒品處遇",tags:["早期介入","菸酒防治","法制研究"],type:"官方研究摘要",
    publishedDate:null,eventDate:null,dateNote:"撰成時間為 115 年 10 月；官方頁面更新日為 2026-10-08，未確認首次發布日。",author:"蔡琮浩／立法院法制局",sourceTitle:"兒童及少年菸酒物質濫用防治相關法制問題探討",url:"https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=6586&pid=266411",
    summary:"研究摘要聚焦兒少菸酒使用及物質濫用防治，表示將研析世界衛生組織建議、各國立法與政策，並檢視臺灣規定提出法制建議。這份資料是問政與法案審查參考，不代表立法院意見或立場。",
    significance:"少年毒品處遇規劃可把預防與早期辨識放在醫療、心理及社區轉介的連續服務中。審查制度時，值得追問家庭與學校辨識到需求後，是否有可實際進入的服務；此為本站分析，尚非報告全文所提方案。",
    followUp:"取得全文後，逐項核對建議是健康支持、供應端管制，還是增加兒少責任，以及各方案的證據。",
    limitation:"僅讀官方摘要，未取得全文，不能宣稱已核對具體修法建議。不得把菸酒使用與後續毒品使用理解為必然因果。",legalNature:"立法院法制局專題研究，非法律、非修正草案通過或公布。",checkedAt:"2026-10-12",readingScope:"立法院官方專題研究摘要與日期欄位。",isBackground:false
  },{
    id:"wales-equity-2026",title:"轉向處遇的公平性：制度入口是否人人可近？",category:"CRC與國際規範",tags:["平等參與","轉向處遇","制度監測"],type:"官方年度報告",
    publishedDate:"2026-10-05",eventDate:null,dateNote:"報告涵蓋 2025 至 2026 年度的執行進展，並非單一事件。",author:"HM Prison and Probation Service／Criminal Justice Board for Wales",sourceTitle:"Criminal Justice Anti-Racism Action Plan for Wales Annual Report 2025 to 2026",url:"https://www.gov.uk/government/publications/criminal-justice-anti-racism-action-plan-for-wales-annual-report-2025-to-2026/criminal-justice-anti-racism-action-plan-for-wales-annual-report-2025-to-2026",
    summary:"威爾斯年度報告提出司法體系反種族歧視工作的進展與挑戰。其中關注少數族群進入庭外處理的機會、資料品質與社群參與，並規劃將相關研究建議轉為實務優先事項。",
    significance:"臺灣制度監測可檢查轉介、轉向處遇與支持服務的實際可近性。身分差異與語言或文化障礙是否影響入口，需要資料與當事人經驗共同檢驗，不能只看制度文字是否一體適用。此為延伸分析。",
    followUp:"制度有無蒐集足以辨識服務落差、又符合目的與隱私保障的資料，並讓少年參與改善？",
    limitation:"報告含成人及少年刑事司法內容，不宜全部直接套用少年制度；亦不等於反歧視措施已被證實具因果成效。",legalNature:"英國政策執行年度報告，非 CRC 一般性意見；對臺灣屬比較制度資料。",checkedAt:"2026-10-12",readingScope:"官方 HTML 年度報告：庭外處理、社群意見與下一年度重點。",isBackground:false
  },{
    id:"rj4all-pilot",title:"修復式司法的成效，如何兼顧自願與研究設計？",category:"修復式司法",tags:["自願參與","成效評估","直接與間接修復"],type:"研究計畫追蹤",
    publishedDate:null,eventDate:"2026-10-01",dateNote:"官方 FAQ 未標明發布日；記載自 2026-10-01 起進行首年新個案收案。另列為持續追蹤，非本週新作。",author:"Restorative Justice for All（RJ4All）",sourceTitle:"Restorative Justice in the YJS: The Evidence – Frequently Asked Questions",url:"https://rj4all.org/rj-yjs-faq/",
    summary:"英格蘭及威爾斯的試辦結合隨機對照試驗與執行過程評估，涵蓋直接及間接修復。FAQ 強調同意與隨時退出，並說明控制組若希望接受修復可退出試驗；計畫仍在進行，尚非成效結論。",
    significance:"修復式司法草案與委託研究可以同時關注程序品質、參與者感受及追蹤結果。自願退出不能成為不利評價，並須區分未參與、準備中與完成修復的個案；此為本站制度分析。",
    followUp:"在允許隨時退出及改選修復的前提下，研究如何交代流失、選擇偏差與不同修復形式？",
    limitation:"這是計畫 FAQ 與方法說明，未有試驗成效可供核對，不能用來宣稱修復必然降低再犯。",legalNature:"民間研究機構的試辦計畫，非臺灣法規或聯合國規範。",checkedAt:"2026-10-12",readingScope:"計畫官方 FAQ 的評估方式、同意退出及收案時間。",isBackground:true
  }]
};
