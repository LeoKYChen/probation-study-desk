/* Patch the previous stage's packaged static site. Fail closed if markup changes. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist',html=path.join(root,'index.html'),css=path.join(root,'style.css');
let source=fs.readFileSync(html,'utf8');
if(source.includes('id="weaknessPriorityList"'))throw Error('Stage5 panel already exists; refuse duplicate injection');
const hook='<script src="./essay-analytics.js" defer></script>';
if(!source.includes(hook))throw Error('Missing stage4 script; cannot extend');
source=source.replace(hook,hook+'\n  <script src="./weakness-priority.js" defer></script>');
const marker='<section class="history" aria-labelledby="historyTitle">';
if(!source.includes(marker))throw Error('Missing history block; cannot install daily priority panel');
const panel=`<section class="weakness-priority-panel" aria-labelledby="weaknessPriorityHeading">
 <div class="section-head"><div><p class="eyebrow">REVIEW PRIORITIES · STAGE 5</p><h2 id="weaknessPriorityHeading">今日弱點優先建議</h2></div><span class="insight-note">依現有自評推算</span></div>
 <p class="muted tiny">優先考量到期、低分、同一失分原因重複出現與今日科目；不代表AI批改或國考正式評分。建議只供自主選題，不改動任何複習排程。</p>
 <p class="essay-review-summary" id="weaknessPrioritySummary" role="status" aria-live="polite">正在分析已保存的申論自評…</p>
 <div id="weaknessPriorityList" class="weakness-priority-list"></div>
 <div id="weaknessPriorityFallback" class="weakness-priority-fallback"></div>
 <p id="weaknessPriorityStatus" class="muted tiny" role="status" aria-live="polite"></p>
</section>\n    `;
source=source.replace(marker,panel+marker);
fs.writeFileSync(html,source,'utf8');
fs.appendFileSync(css,`
/* Stage 5 priorities: accessible on iPhone; styles scoped to new panel. */
.weakness-priority-panel{margin:22px 0;padding:22px;border:1px solid var(--line,#dce4dc);border-radius:18px;background:var(--paper,#fff)}
.weakness-priority-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px}
.weakness-priority-item{min-width:0;border:1px solid var(--line,#dce4dc);background:#f9fcf9;border-radius:12px;padding:14px;overflow-wrap:anywhere}
.weakness-priority-item h3{font-size:1rem;line-height:1.45;margin:0 0 10px}
.weakness-priority-item button{min-height:44px;margin-top:7px;max-width:100%}
.weakness-reasons{font-size:.92rem;line-height:1.55}
.weakness-priority-fallback{padding:12px 0}.weakness-priority-fallback h3{font-size:1rem}
.weakness-priority-fallback li{margin-bottom:6px;overflow-wrap:anywhere}
@media(max-width:680px){.weakness-priority-panel{padding:15px}.weakness-priority-list{grid-template-columns:1fr}.weakness-priority-item button{width:100%}}
`);
console.log('Applied stage5 weakness priority panel');
