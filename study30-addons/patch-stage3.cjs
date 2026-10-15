/* Apply independent essay review enhancement to v2.5.3 ZIP. */
const fs=require('node:fs'),path=require('node:path');
const dest=process.argv[2]||'deploy-dist';
function alter(file,before,after){
 const p=path.join(dest,file),original=fs.readFileSync(p,'utf8');
 if(!original.includes(before))throw Error('Unsupported study30 base: '+file+' :: '+before.slice(0,50));
 fs.writeFileSync(p,original.replace(before,after),'utf8');
}
alter('app.js',
 "if(selected==='today')return currentQuestion();\n    return pick(pool(selected),`${session.date}:subject-essay:${selected}`);",
 "if(selected==='today')return currentQuestion();\n    const requested=session.essayReviewTargetId;\n    if(requested&&!String(requested).startsWith('manual:')){const q=BANK.find(item=>item.id===requested);if(q&&candidateSubject(q,selected))return q;}\n    if(requested&&String(requested).startsWith('manual:'))return null;\n    return pick(pool(selected),`${session.date}:subject-essay:${selected}`);"
);
alter('app.js',"session.essayPracticeSubject=value;","session.essayReviewTargetId=null;\n    session.essayPracticeSubject=value;");
alter('app.js',
 "const id=q?.id||(selected==='today'?`unassigned:${session.date}:${session.phase}`:`manual:${session.date}:${selected}`);",
 "const id=q?.id||(session.essayReviewTargetId?.startsWith('manual:')?session.essayReviewTargetId:selected==='today'?`unassigned:${session.date}:${session.phase}`:`manual:${session.date}:${selected}`);");
alter('app.js',
 "manual:!q,customPrompt:String(session.essayCustomPrompts?.[id]||''),",
 "manual:!q,customPrompt:String(session.essayCustomPrompts?.[id]||Object.values(store.sessions).find(s=>typeof s?.essayCustomPrompts?.[id]==='string')?.essayCustomPrompts?.[id]||''),");
alter('app.js',
 "version:1,rubric:type,scores:{...data.scores},issues:data.issues.slice(),nextStep:data.nextStep,",
 "version:1,rubric:type,subject:ctx.subject,questionHeading:ctx.questionHeading,scores:{...data.scores},issues:data.issues.slice(),nextStep:data.nextStep,");
alter('app.js',
 "window.Study30App={essayContext,saveEssay,saveEssayManualQuestion,essayAssessmentContext,saveEssayAssessment};",
 `function getEssayReviewData(){return {sessions:structuredClone(store.sessions),bank:BANK,today:isoTaipei(),todaySubject:subjectFor(isoTaipei()).target};}
 function openEssayReview(id,subject){
   if(!ESSAY_SUBJECTS.includes(subject)||typeof id!=='string'||id.length>300)return false;
   const valid=Object.values(store.sessions).some(s=>s?.essayAssessments&&Object.prototype.hasOwnProperty.call(s.essayAssessments,id));
   if(!valid)return false;
   const q=BANK.find(q=>q.id===id);
   if(q&&!candidateSubject(q,subject))return false;
   if(!q&&(!id.startsWith('manual:')||!id.endsWith(':'+subject)))return false;
   session.essayPracticeSubject=subject;
   session.essayReviewTargetId=id;
   session.updatedAt=new Date().toISOString();persist();renderEssaySelection();
   window.dispatchEvent(new CustomEvent('study30:render'));
   return true;
 }
 window.Study30App={essayContext,saveEssay,saveEssayManualQuestion,essayAssessmentContext,saveEssayAssessment,getEssayReviewData,openEssayReview};`);
alter('essay-selfcheck.js',"resultDisplay(lastData,context());\n  }",
 "resultDisplay(lastData,context());\n    window.dispatchEvent(new CustomEvent('study30:essay-assessed'));\n  }");
alter('index.html','<script src="./essay-selfcheck.js" defer></script>',
 '<script src="./essay-selfcheck.js" defer></script>\n  <script src="./essay-review.js" defer></script>');
alter('index.html','    <section class="history" aria-labelledby="historyTitle">',
 `    <section class="essay-review-panel" aria-labelledby="essayReviewHeading">
      <div class="section-head"><div><p class="eyebrow">ESSAY REVIEW · STAGE 3</p><h2 id="essayReviewHeading">申論弱點連動複習</h2></div><span class="insight-note">不影響上方每日任務</span></div>
      <p class="muted">依已完成的申論自評自動排程：低於60分隔1天、60至79分或有待補強項目隔3天、80分以上且無待補強項目隔7天；連續於不同日期掌握，延長至14及30天。<strong>這是個人自評排程，不是國考成績。</strong></p>
      <p id="essayReviewSummary" class="essay-review-summary">讀取申論複習紀錄中…</p>
      <div class="review-columns"><div><h3>到期申論題</h3><div id="essayReviewDue" class="review-list"></div></div><div><h3>接下來的申論複習</h3><div id="essayReviewUpcoming" class="review-list"></div></div>
      <p id="essayReviewStatus" class="muted tiny" role="status" aria-live="polite">按「開啟這題申論複習」只會切換下方申論工作區；上方每日科目、題目、計時及原有間隔複習不變。</p>
    </section>
    <section class="history" aria-labelledby="historyTitle">`);
fs.appendFileSync(path.join(dest,'style.css'),
 `\n.essay-review-panel{margin:22px 0;padding:22px;background:var(--paper,#fff);border:1px solid var(--line,#dce4dc);border-radius:18px}
.essay-review-summary{font-weight:800;color:var(--green,#21463d);padding:10px 12px;background:#eaf3ed;border-radius:10px}
.essay-review-card{padding:13px;margin:9px 0;background:#fff;border:1px solid var(--line,#dde5df);border-radius:12px;overflow-wrap:anywhere}
.essay-review-head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.essay-review-card button{margin-top:8px;min-height:42px}
@media(max-width:680px){.essay-review-panel{padding:16px}.essay-review-card button{width:100%}}\n`);
console.log('Applied independent essay review enhancement');
