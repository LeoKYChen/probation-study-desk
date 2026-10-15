/* Stage7: install backup import UI after source+health patches, fail closed. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'deploy-dist';
function replaceOnce(file,before,after){
 const target=path.join(root,file),content=fs.readFileSync(target,'utf8');
 if(!content.includes(before))throw Error('Stage7 base changed, refusing patch: '+file+':'+before.slice(0,80));
 fs.writeFileSync(target,content.replace(before,after));
}
replaceOnce('index.html','<script src="./data-health.js" defer></script>',
 '<script src="./data-health.js" defer></script>\n  <script src="./backup-import.js" defer></script>');
const panel=`<section class="backup-import-panel" aria-labelledby="backupImportHeading">
  <h2 id="backupImportHeading">學習紀錄 JSON 匯入／還原</h2>
  <p class="muted">僅處理本測試站「每日30分鐘」的紀錄，不讀取或覆寫原本 v2.5 的資料。支援既有 v2.5.1～v2.5.3 的每日30分鐘 JSON 備份。</p>
  <label class="backup-import-label" for="importBackupFile">選擇先前匯出的 JSON 備份檔</label>
  <input type="file" id="importBackupFile" accept=".json,application/json">
  <fieldset class="backup-mode"><legend>資料處理方式</legend>
    <label><input type="radio" name="importMode" value="merge" checked> 合併（建議）：保留目前所有日期，只補入備份中不存在的日期；相同日期不覆蓋</label>
    <label><input type="radio" name="importMode" value="replace"> 完整還原：以備份取代所有現有日期（高風險）</label>
  </fieldset>
  <p id="importPreview" class="backup-import-preview">選擇檔案後可預覽備份日期、草稿及自評筆數。</p>
  <button type="button" id="downloadBeforeImport" class="secondary">先匯出目前紀錄（安全備份）</button>
  <label class="backup-import-agree"><input type="checkbox" id="importBackupConfirmed"> 我已確認目前紀錄的 JSON 備份已下載保存</label>
  <label for="importConfirm">若選「完整還原」，請輸入「完整還原」</label>
  <input type="text" id="importConfirm" placeholder="完整還原" autocomplete="off" spellcheck="false">
  <button type="button" id="importExecute" class="primary" disabled>執行匯入／還原</button>
  <p id="importStatus" class="muted tiny" role="status" aria-live="polite">尚未讀取備份。</p>
  <p class="muted tiny">提醒：只處理你在此裝置選擇的本機檔案，不會上傳至伺服器；實際匯入後會重新整理網頁。</p>
</section>
    `;
replaceOnce('index.html','<section class="history" aria-labelledby="historyTitle">',panel+'<section class="history" aria-labelledby="historyTitle">');
replaceOnce('app.js',
 'window.Study30App={essayContext,saveEssay,saveEssayManualQuestion,essayAssessmentContext,saveEssayAssessment,getEssayReviewData,openEssayReview};',
 'function prepareBackupRestore(){pause();}\n window.Study30App={essayContext,saveEssay,saveEssayManualQuestion,essayAssessmentContext,saveEssayAssessment,getEssayReviewData,openEssayReview,prepareBackupRestore};');
fs.appendFileSync(path.join(root,'style.css'),`
.backup-import-panel{margin:22px 0;padding:22px;border:1px solid var(--line,#dce4dc);border-radius:18px;background:var(--paper,#fff)}
.backup-import-panel input[type=file]{display:block;max-width:100%;margin:10px 0 16px}
.backup-import-panel input[type=text]{display:block;width:min(100%,350px);min-height:42px;margin:6px 0 12px;padding:8px;border:1px solid #afc3b7;border-radius:9px}
.backup-import-label{font-weight:700}.backup-mode{display:flex;flex-direction:column;gap:10px;border:1px solid #d3e2da;border-radius:12px;padding:14px;margin:10px 0}
.backup-import-agree{display:block;margin:16px 0;line-height:1.6}
.backup-import-preview{background:#ecf5ef;padding:12px;border-radius:10px;line-height:1.7;overflow-wrap:anywhere}
.backup-import-panel button{min-height:44px;margin:5px 7px 5px 0}
@media(max-width:680px){.backup-import-panel{padding:15px}.backup-import-panel button{width:100%}}
`);
console.log('Stage7 backup import UI installed');