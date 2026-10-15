/* v2.5.4 analytics panel: additive markup and styles only. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=process.argv[2]||'deploy-dist',html=path.join(base,'index.html');
let source=fs.readFileSync(html,'utf8');
const script='<script src="./daily-essay-workbench.js" defer></script>';
const section='<section class="history" aria-labelledby="historyTitle">';
if(!source.includes(script)||!source.includes(section))throw Error('Expected stable stage8 output');
if(source.includes('id="v254StudySummary"'))throw Error('Duplicate v2.5.4 panel');
source=source.replace(script,script+'\n  <script src="./v254-diagnostics.js" defer></script>');
const panel=[
'<section class="v254-panel" aria-labelledby="v254Heading">',
'  <div class="section-head"><div><p class="eyebrow">STUDY INSIGHTS · v2.5.4</p><h2 id="v254Heading">七科學習診斷與弱點追蹤</h2></div><span class="insight-note">僅分析現有426題</span></div>',
'  <p class="muted tiny">依每日題目自評、申論自評及原有間隔複習紀錄整理，不新增評分、不推測考試成績，也不更改每日題目或複習排程。</p>',
'  <div class="v254-filters">',
'    <label for="v254Days">練習紀錄期間</label>',
'    <select id="v254Days"><option value="7">最近7天</option><option value="30" selected>最近30天</option><option value="90">最近90天</option><option value="all">全部紀錄</option></select>',
'    <label for="v254Subject">檢視科目</label>',
'    <select id="v254Subject"><option value="all">全部七科</option><option>心理學</option><option>諮商與輔導</option><option>犯罪學</option><option>少年事件處理法</option><option>刑法</option><option>刑事訴訟法</option><option>保安處分執行法</option></select>',
'  </div>',
'  <p id="v254StudySummary" class="essay-review-summary" role="status" aria-live="polite">正在整理學習紀錄…</p>',
'  <div id="v254SubjectCards" class="v254-subject-grid"></div>',
'  <section class="v254-priority-section" aria-label="優先補強建議"><h3>依實際紀錄建議優先檢視</h3><ol id="v254Priorities"></ol></section>',
'  <p id="v254Disclaimer" class="muted tiny"></p>',
'</section>','    '
].join('\n');
source=source.replace(section,panel+section);
fs.writeFileSync(html,source,'utf8');
const css=[
'/* v2.5.4 study diagnostics: responsive and scoped. */',
'.v254-panel{margin:22px 0;padding:22px;border:1px solid var(--line,#dce4dc);border-radius:18px;background:var(--paper,#fff);overflow:hidden}',
'.v254-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}',
'.v254-filters label{font-weight:700}.v254-filters select{padding:9px;border-radius:10px;border:1px solid #aebfb6;color:#1d352e;background:#fff;max-width:100%}',
'.v254-subject-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}',
'.v254-subject-card{padding:15px;border:1px solid #d4e2d8;background:#f9fcf9;border-radius:12px;overflow-wrap:anywhere}',
'.v254-subject-card h3{margin:0 0 10px;font-size:1.05rem}',
'.v254-subject-card p{margin:7px 0;line-height:1.6;font-size:.93rem}',
'.v254-attention{color:#934b18;font-weight:700}',
'.v254-reasons ul,.v254-priority-section ol{padding-left:22px}',
'.v254-reasons li,.v254-priority-section li{margin:5px 0;overflow-wrap:anywhere}',
'.v254-priority-section{border-top:1px solid #d4e2d8;padding-top:15px}',
'@media(max-width:680px){.v254-panel{padding:15px}.v254-subject-grid{grid-template-columns:1fr}.v254-filters{display:grid;grid-template-columns:1fr}.v254-filters select{width:100%}}'
].join('\n');
fs.appendFileSync(path.join(base,'style.css'),'\n'+css+'\n','utf8');
console.log('Installed v2.5.4 read-only diagnostics');