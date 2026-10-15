/* Extend stage 3 generated static site; never read/write student localStorage. */
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist';
const html=path.join(root,'index.html'), css=path.join(root,'style.css');
let input=fs.readFileSync(html,'utf8');
if(input.includes('id="essayAnalyticsSummary"')){console.log('Stage4 already applied');process.exit(0);}
const script='<script src="./essay-review.js" defer></script>';
if(!input.includes(script))throw Error('Missing stage3 essay-review script; cannot install stage4');
input=input.replace(script,script+'\n  <script src="./essay-analytics.js" defer></script>');
const marker='<section class="history" aria-labelledby="historyTitle">';
if(!input.includes(marker))throw Error('Missing history section');
const panel=`<section class="essay-analytics-panel" aria-labelledby="essayAnalyticsHeading">
  <div class="section-head"><div><p class="eyebrow">ESSAY ANALYTICS · STAGE 4</p><h2 id="essayAnalyticsHeading">申論能力成長統計</h2></div><span class="insight-note">僅讀取本機自評紀錄</span></div>
  <p class="muted tiny">統計來自個人主觀自評，並非正式國考成績，也不代表不同題目難度相同。未完整評分的草稿不納入統計。</p>
  <div class="essay-analytics-filters"><label>時間範圍 <select id="essayAnalyticsDays"><option value="7">最近7天</option><option value="30" selected>最近30天</option><option value="all">全部紀錄</option></select></label><label>申論科目 <select id="essayAnalyticsSubject"><option value="all">全部科目</option><option>心理學</option><option>諮商與輔導</option><option>犯罪學</option><option>少年事件處理法</option><option>刑法</option><option>刑事訴訟法</option><option>保安處分執行法</option></select></label></div>
  <p id="essayAnalyticsSummary" class="essay-review-summary" role="status" aria-live="polite">讀取申論自評統計中…</p>
  <div class="essay-analytics-grid">
    <div><h3>各科自評概況</h3><div id="essayAnalyticsSubjects"></div><h3>同題跨日複習比較</h3><p id="essayAnalyticsNote" class="muted"></p></div>
    <div><h3>近期每日平均自評</h3><div id="essayAnalyticsTrend"></div></div>
    <div><h3>常見失分原因</h3><ol id="essayAnalyticsWeaknesses"></ol></div>
    <div><h3>自評較弱指標</h3><ol id="essayAnalyticsCriteria"></ol></div>
  </div>
</section>
    `;
input=input.replace(marker,panel+marker);
fs.writeFileSync(html,input);
fs.appendFileSync(css,`
/* v2.5.3 stage 4 analytics; simple phone-friendly charts, no third-party dependencies. */
.essay-analytics-panel{margin:22px 0;padding:22px;background:var(--paper,#fff);border:1px solid var(--line,#dce4dc);border-radius:18px;overflow:hidden}
.essay-analytics-filters{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0}.essay-analytics-filters label{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600}
.essay-analytics-filters select{border:1px solid #adbdb5;border-radius:10px;padding:9px;max-width:100%;background:#fff;color:#1c3029}
.essay-analytics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.essay-analytics-grid>div{min-width:0;background:rgba(200,215,203,.16);border-radius:12px;padding:15px}
.essay-analytics-line,.essay-trend-label{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:.9rem;margin:8px 0;overflow-wrap:anywhere}
.essay-trend-track{height:9px;border-radius:99px;background:#d7e5db;overflow:hidden}.essay-trend-bar{height:100%;background:#367c62;border-radius:99px}
.essay-analytics-grid ol{padding-left:23px}.essay-analytics-grid li{padding:4px 0;overflow-wrap:anywhere}
@media(max-width:680px){.essay-analytics-panel{padding:15px}.essay-analytics-grid{grid-template-columns:1fr;gap:12px}.essay-analytics-grid>div{padding:12px}.essay-analytics-filters{flex-direction:column;align-items:stretch}}
`);
console.log('Applied stage4 analytics panel');
