/* Stage6 deployment patch. Fails if upstream structure changes. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist';
function edit(filename,from,to){
 const p=path.join(root,filename),raw=fs.readFileSync(p,'utf8');
 if(!raw.includes(from))throw Error('Unsupported base file: '+filename+'; pattern '+from.slice(0,80));
 fs.writeFileSync(p,raw.replace(from,to),'utf8');
}
edit('index.html',
 '<script src="https://leokychen.github.io/probation-study-desk/v2.5/questions.js" defer></script>',
 '<script src="./source-main-questions.js" defer></script>\n  <script src="./source-related-questions.js" defer></script>\n  <script src="./question-sources.js" defer></script>');
edit('index.html',
 '<section class="daily-card" aria-labelledby="todayHeading">',
 '<p id="questionSourceSummary" class="question-source-summary" role="status" aria-live="polite">確認原站題庫載入狀態中…</p>\n    <section class="daily-card" aria-labelledby="todayHeading">');
edit('index.html',
 '<script src="./weakness-priority.js" defer></script>',
 '<script src="./weakness-priority.js" defer></script>\n  <script src="./data-health.js" defer></script>');
edit('index.html',
 '<section class="history" aria-labelledby="historyTitle">',
 '<section class="data-health-panel" aria-labelledby="dataHealthHeading"><h2 id="dataHealthHeading">學習紀錄健康檢查</h2><p class="muted tiny">本頁只讀取每日30分鐘模組在此瀏覽器的資料，不上傳、不修改原紀錄。重要資料請定期按下方「匯出本模組紀錄 JSON」備份。</p><p id="dataHealthSummary" role="status" aria-live="polite">檢查儲存狀態中…</p></section>\n    <section class="history" aria-labelledby="historyTitle">');
edit('app.js',
 "const BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];",
 "const BANK = Array.isArray(window.Study30QuestionSources?.all) ? window.Study30QuestionSources.all : [];");
edit('app.js',
 "const pool = target => BANK.filter(q=>examIsProbation(q)&&candidateSubject(q,target));",
 "const pool = target => BANK.filter(q=>candidateSubject(q,target));");
edit('app.js',
 "const commonPool = () => BANK.filter(q=>examIsProbation(q)&&/法學知識|英文|國文/.test(String(q.subject||'')));",
 "const commonPool = () => BANK.filter(q=>/法學知識|英文|國文/.test(String(q.subject||'')));");
edit('app.js',
 "$('subjectLabel').textContent=isCommon?'普通科目':sub.sunday?'週日錯題複習':'觀護人考畢試題';",
 "$('subjectLabel').textContent=isCommon?'普通科目':q?(q.examTypes?.join('／')||q.examType||'歷屆試題'):sub.sunday?'週日錯題複習':'原站考古題';");
edit('app.js',
 "'今天只讀這一科，題目從既有觀護人考古題庫選出。'",
 "'今天只讀這一科，題目依科目從原站426題考古題庫選出（含相關類科）。'");
fs.appendFileSync(path.join(root,'style.css'),
 '\n.question-source-summary{padding:14px 18px;border:1px solid #b7d2c5;border-radius:14px;background:#ecf5ef;color:#204436;line-height:1.7}\n.question-source-summary[data-complete="false"]{background:#fff6e6;border-color:#e5bd73;color:#684616}\n.data-health-panel{margin:22px 0;padding:20px 22px;border:1px solid var(--line,#dce4dc);background:var(--paper,#fff);border-radius:18px}\n.data-health-panel h2{font-size:1.25rem}\n.data-health-panel p{line-height:1.6}\n.data-health-panel [data-risk="warning"]{font-weight:700;color:#a45118}\n@media(max-width:680px){.question-source-summary{padding:12px}.data-health-panel{padding:15px}}\n','utf8');
console.log('Installed original source 426 + read-only record health check');