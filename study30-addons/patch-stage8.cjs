/* Repositions ONE current essay editor: daily notes in upper workspace, free practice below. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist';
function replaceOnce(file,before,after){
  const full=path.join(root,file),source=fs.readFileSync(full,'utf8');
  if(!source.includes(before)||source.split(before).length!==2)throw Error('Stage8 integration pattern missing or ambiguous: '+file+': '+before.slice(0,72));
  fs.writeFileSync(full,source.replace(before,after),'utf8');
}
replaceOnce('index.html',
 '<script src="./backup-import.js" defer></script>',
 '<script src="./backup-import.js" defer></script>\n  <script src="./daily-essay-workbench.js" defer></script>');
replaceOnce('index.html',
 '      <label class="answer-label" for="answer">我的練習紀錄 <span id="answerStatus" class="muted">輸入後自動保存於本機</span></label>\n      <textarea id="answer" rows="8" placeholder="不用寫完完整申論，先寫出自己的爭點、核心理論或法條以及分析。"></textarea>',
 `      <section class="daily-essay-panel" id="dailyEssayPanel" aria-labelledby="dailyEssayHeading">
        <h3 id="dailyEssayHeading">我的練習紀錄</h3>
        <p class="tiny muted">此處直接沿用下方「國考申論答題工作區」的四格草稿、完整答案及 Markdown 匯出。作答按題目獨立保存，切換自由練習科目不會覆蓋今日草稿。</p>
        <div id="dailyEssayWorkbenchSlot"></div>
        <div id="dailyEssayLocationHint" hidden><p class="tiny muted">申論編輯器目前正在下方自由練習其他科目。</p><button id="dailyEssayResume" type="button" class="secondary">切回今日題目作答</button></div>
        <details class="daily-quick-notes"><summary>原本的逐步驟速記（已保留，不會刪除）</summary>
          <label class="answer-label" for="answer">本步驟速記 <span id="answerStatus" class="muted">輸入後自動保存於本機</span></label>
          <textarea id="answer" rows="8" placeholder="不用寫完完整申論，先寫出自己的爭點、核心理論或法條以及分析。"></textarea>
        </details>
      </section>`);
replaceOnce('index.html',
 '      <details id="essayEditor" class="essay-editor">',
 '      <p id="essayWorkbenchLocationHint" class="tiny muted" hidden>「跟隨今日練習題」的申論草稿已移到上方「我的練習紀錄」。切換為其他科目，即可在此繼續自由練習。</p>\n      <div id="freeEssayWorkbenchSlot"></div>\n      <details id="essayEditor" class="essay-editor">');
fs.appendFileSync(path.join(root,'style.css'),`
/* Reuse existing essay editor in daily task (same DOM nodes, same storage). */
.daily-essay-panel{border:1px solid #b5cfc2;border-radius:12px;background:#f8faf8;margin:18px 0;padding:14px}
.daily-essay-panel>h3{font-weight:800;color:var(--green,#21463d);padding:6px 0;line-height:1.5;margin:0}
.daily-essay-panel>#dailyEssayWorkbenchSlot>.essay-editor{margin-top:12px;background:#fff}
.daily-quick-notes{border-top:1px solid var(--line,#dce4dc);margin-top:14px;padding-top:12px}
.daily-quick-notes>summary{color:var(--green,#21463d);font-weight:700;cursor:pointer}
.daily-quick-notes .answer-label{display:block;margin-top:12px}
.daily-quick-notes textarea{margin-top:8px;min-height:120px}
#dailyEssayLocationHint button{min-height:44px}
#essayWorkbenchLocationHint{margin:12px 0;padding:12px;border:1px dashed #b5cfc2;border-radius:10px;background:#f7faf7}
@media(max-width:680px){.daily-essay-panel{padding:12px}.daily-essay-panel .essay-editor{padding:10px}.daily-essay-panel .essay-outline{grid-template-columns:1fr}#dailyEssayResume{width:100%}}
`);
console.log('Stage8: original single essay editor can appear under daily practice record');