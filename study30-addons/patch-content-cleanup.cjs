/* Confirmed PowerPoint slide 2-8 copy and interface requirements. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist';
const apply=(name,fn)=>{const file=path.join(root,name),old=fs.readFileSync(file,'utf8'),next=fn(old);if(old===next)throw Error('No change: '+name);fs.writeFileSync(file,next,'utf8');};
function swap(s,from,to,label){const n=s.split(from).length-1;if(n!==1)throw Error(label+': expected 1, found '+n);return s.replace(from,to);}
apply('index.html',s=>{
  s=swap(s,'v2.5.3 分科切換測試版</title>','v2.5.4 離線練習版</title>','title');
  s=s.replace(/分科切換(?:測試)?版/g,'');
  s=swap(s,'保留你已經有的考古題；不另外啟用英語或少年法提醒。','','slide2 hero');
  s=swap(s,'原本的逐步驟速記（已保留，不會刪除）','步驟速記','slide3 notes');
  s=swap(s,'模擬間隔複習到期（不更動學習紀錄）','間隔複習到期預覽','slide4 heading');
  s=swap(s,'測試資料來源','資料來源','slide4 label');
  s=swap(s,'獨立示範資料（建議先試）','範例資料','slide4 sample data');
  s=swap(s,'示範間隔','複習間隔','slide4 interval');
  s=swap(s,'模擬重答後的下次複習日','預覽重答後的下次複習日','slide4 button');
  s=swap(s,'<p class="tiny muted">這是規則演算測試，不會建立正式練習紀錄。平日只優先推薦當天科目的到期題；週日可跨科。到期不代表一定當天推薦，完整結果請看下方說明。</p>','','slide4 testing footnote');
  s=swap(s,'<div id="historyContent" class="history-content"></div>',
    '<div class="week-practice-bar"><button type="button" class="secondary" id="returnToday" hidden>返回今天</button><p id="weekPracticeHint" class="muted tiny" role="status" aria-live="polite">點選本週已過日期，可補做或接續該日練習；未到日期不可提前作答。</p></div><div id="historyContent" class="history-content"></div>','slide8 selector');
  s=swap(s,'<p class="tiny muted">僅使用獨立的 study30 本機紀錄，不讀寫或覆蓋 v2.5 原有作答。不同裝置不會自動同步，請定期匯出備份。</p>','','slide8 disclaimer');
  s=swap(s,'<footer>這是 v2.5.3 第二階段獨立測試模組，尚未併入正式入口。原站題庫與學習紀錄不受影響。</footer>','','slide8 footer');
  s=swap(s,'</head>','  <link rel="stylesheet" href="./content-cleanup.css">\n</head>','head stylesheet');
  s=swap(s,'</body>','  <script src="./content-ui.js" defer></script>\n</body>','footer script');
  return s;
});
apply('question-sources.js',s=>swap(s,
  '選題來源：原站 426 題（主要考古題 374＋相關類科 52）。依科目選題，保留題目原始考試類科；暫不納入尚待校正的 342 題預測題庫。',
  '選題來源：原站 426 題（主要考古題 374＋相關類科 52）。','healthy source summary'));
apply('review-simulator.js',s=>{
  for(const [from,to] of [
    ['模擬日期：','日期：'],
    ['示範情境：',''],
    ['獨立示範資料','範例資料'],
    ['可切換「範例資料」立即測試','可切換「範例資料」檢視'],
    ['僅模擬：','僅預覽：']
  ])s=s.replaceAll(from,to);
  return s;
});
fs.copyFileSync(path.join(__dirname,'content-ui.js'),path.join(root,'content-ui.js'));
fs.copyFileSync(path.join(__dirname,'content-cleanup.css'),path.join(root,'content-cleanup.css'));
console.log('Applied slide 2-8 text updates, with warning text preserved');
