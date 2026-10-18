/*
 * Isolated quality gate for the existing Google Apps Script daily question sync.
 * No Drive/GitHub APIs, no writes, no mutation of the published 132-question dataset.
 * This is an integration candidate; the live syncDailyResources source was not available.
 * V8 Google Apps Script compatible; also runnable in Node's vm for regression tests.
 */
var DailyQuestionQualityGate = (function () {
  'use strict';
  var VERSION = '1.0.0';
  var DAY_SUBJECTS = [
    '跨科整合', '犯罪學', '心理學', '諮商與輔導',
    '少年事件處理法', '刑事訴訟法與保安處分執行法', '刑法'
  ];
  var MODEL_SUBJECTS = DAY_SUBJECTS.slice(0);

  function plain(obj) { return JSON.parse(JSON.stringify(obj)); }
  function text(x) { return typeof x === 'string' ? x.trim() : ''; }
  function canonical(value) {
    return text(value)
      .replace(/^(?:【?(?:題目|改編題|改編題目|申論題|案例事實)[】]?[：:]?\s*)+/g, '')
      .replace(/[\s\u3000，。、！？?：:；;「」『』（）()［］\[\]{}\-—_]/g, '')
      .toLowerCase();
  }
  function scoresFrom(question) {
    var found=[], match, re=/(\d{1,2})\s*分/g;
    while ((match=re.exec(question)) !== null) found.push(Number(match[1]));
    return found;
  }
  function scoreIssue(question) {
    var scores=scoresFrom(question);
    if (!scores.length) return '缺少可辨識的 25 分配分';
    // If a 25-point total is supplied, discard that *one* total before adding
    // independent subquestions. Reject other conflicting totals.
    if (scores.length===1) return scores[0]===25 ? '' : '單題配分不是 25 分';
    var subs=scores.slice();
    var totalIndex=subs.indexOf(25);
    if(totalIndex!==-1) subs.splice(totalIndex,1);
    if(!subs.length) return '';
    var sum=subs.reduce(function(a,b){return a+b;},0);
    return sum===25 ? '' : '子題配分加總不是 25 分（檢測到 '+scores.join('+')+'）';
  }
  function normalDate(s) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text(s))) return false;
    var day=new Date(s+'T12:00:00Z');
    return !isNaN(day.getTime()) && day.toISOString().slice(0,10)===s;
  }
  function getDaySubject(date) {
    return DAY_SUBJECTS[new Date(date+'T12:00:00Z').getUTCDay()];
  }
  function shapeProblem(q) {
    if(!q||typeof q!=='object'||Array.isArray(q)) return '題目資料不是物件';
    if(!text(q.id)) return '缺少穩定題目 ID';
    if(!normalDate(q.date)) return '日期格式錯誤';
    if(!MODEL_SUBJECTS.includes(text(q.subject))) return '科目非固定標準名稱或混入其他文字';
    if(text(q.subject)!==getDaySubject(q.date)) return '科目與臺灣日期固定輪替不符';
    if(!text(q.question)||q.question.length<60) return '題幹過短、缺少完整獨立設問';
    if(!/(試問|請|說明|分析|如何|得否|是否|比較|論述|？|\?)/.test(q.question)) return '沒有可辨識的完整申論設問';
    if(/(?:將其深化為|改編後實例申論題題目|請依上述指示生成|四欄標準表格理論與個案處遇深度結合|^-\s*原題[：:]|^改編來源[：:])/m.test(q.question))
      return '題幹含編輯指示、原題或改編過程';
    var sc=scoreIssue(q.question);
    if(sc) return sc;
    if(!text(q.issues)||q.issues.length<20) return '核心爭點為空或不足';
    if(!text(q.outline)||q.outline.length<30) return '答題架構為空或不足';
    if(!Array.isArray(q.theoryTable)||q.theoryTable.length<2) return '缺少完整四欄理論及個案表';
    for(var i=0;i<q.theoryTable.length;i++){
      var row=q.theoryTable[i];
      if(!Array.isArray(row)||row.length!==4||row.some(function(cell){return typeof cell!=='string';}))
        return '理論與個案表非四欄文字';
    }
    var header=['理論／方法','理論／方法說明','核心概念','少年個案應用'];
    for(var h=0;h<4;h++)if(q.theoryTable[0][h].trim()!==header[h])return '理論與個案表標題不相容';
    if(!text(q.sourceReference))return '原試題出處欄位空白：應標明原創或經核實的改編來源';
    if(q.warnings!==undefined&&!Array.isArray(q.warnings))return 'warnings 欄位必須是陣列';
    var badWarnings=(q.warnings||[]).filter(function(w){
      return /(?:解析失敗|來源輪替科目未能唯一辨識|待分類|缺少獨立|缺少答題|來源科目未能直接確認)/.test(w);
    });
    if(badWarnings.length)return '來源解析尚有嚴重警告：'+badWarnings[0];
    return '';
  }
  function sourceNeedsReview(q){
    var src=text(q.sourceReference);
    if(/(?:改編自|摘自|歷屆|考古題|第\s*\d+\s*題)/.test(src)&&!/原創模擬題/.test(src)){
      if(!/https:\/\/(?:wwwq\.)?moex\.gov\.tw\/exam\/[\w-]*File\.ashx[^\s)]*/i.test(src))
        return '題源宣稱改編自官方考古題，但沒有原卷 PDF／原卷檔案連結；須人工核實';
    }
    return '';
  }
  function sourceKey(q){
    if(!q||!text(q.sourceDocumentId)||q.sourceQuestionIndex===undefined||
       q.sourceQuestionIndex===null||text(String(q.sourceQuestionIndex))==='')return '';
    return text(q.sourceDocumentId)+'#'+String(q.sourceQuestionIndex).trim();
  }
  function addIssue(target,q,index,code,description){
    target.push({index:index,id:text(q&&q.id),code:code,reason:description});
  }
  function inspect(published, incoming, options){
    var report={version:VERSION,canPublish:false,blocked:[],manualReview:[],unchanged:[],ready:[],proposedDataset:null};
    if(!published||published.schemaVersion!==1||!Array.isArray(published.questions)||
       !Number.isInteger(published.count)||published.count!==published.questions.length){
      addIssue(report.blocked,null,-1,'BASE_INVALID','既有題庫不完整，拒絕覆蓋');return report;
    }
    if(!Array.isArray(incoming)||!incoming.length){
      addIssue(report.blocked,null,-1,'IMPORT_EMPTY','本批沒有題目，不能以空陣列覆寫既有題庫');return report;
    }
    var idMap=Object.create(null),seenId=Object.create(null),seen=[];
    for(var k=0;k<published.questions.length;k++){
      var old=published.questions[k];
      if(!old||!text(old.id)||Object.prototype.hasOwnProperty.call(idMap,old.id)){
        addIssue(report.blocked,null,-1,'BASE_ID','原題庫有遺失或重複 ID，拒絕發布');return report;
      }
      idMap[old.id]=old;
      seen.push(old);
    }
    for(var i=0;i<incoming.length;i++){
      var q=incoming[i];
      if(!q||typeof q!=='object'||Array.isArray(q)){
        addIssue(report.blocked,q,i,'INVALID','輸入不是題目物件');continue;
      }
      var id=text(q.id);
      if(id&&seenId[id]){
        addIssue(report.blocked,q,i,'BATCH_ID_DUPLICATE','本批相同題目 ID 被送入多次');continue;
      }
      if(id)seenId[id]=true;
      if(id&&Object.prototype.hasOwnProperty.call(idMap,id)){
        if(JSON.stringify(idMap[id])===JSON.stringify(q)){
          report.unchanged.push({index:i,id:id,reason:'完全相同 ID 與內容，重跑不新增'});
        } else {
          addIssue(report.blocked,q,i,'EXISTING_ID_CONFLICT','既有 ID 內容改變；須人工審定版本，不可覆寫舊作答對應');
        }
        continue;
      }
      var bad=shapeProblem(q);
      if(bad){addIssue(report.blocked,q,i,'SHAPE_OR_CONTENT',bad);continue;}
      var fingerprint=canonical(q.question);
      var exact=null,close=null,sourceConflict=null;
      var importSourceKey=sourceKey(q);
      for(var j=0;j<seen.length;j++){
        var candidate=seen[j],existingFp=canonical(candidate.question);
        if(importSourceKey&&sourceKey(candidate)===importSourceKey){
          sourceConflict=candidate;
          if(fingerprint!==existingFp)break;
        }
        if(fingerprint&&fingerprint===existingFp){exact=candidate;break;}
        if(fingerprint.length>=150&&existingFp.length>=150&&
           fingerprint.slice(0,120)===existingFp.slice(0,120))close=candidate;
      }
      if(sourceConflict){
        addIssue(report.blocked,q,i,'SOURCE_SLOT_CONFLICT','同一來源文件段落已被不同 ID 收錄：'+sourceConflict.id);
        continue;
      }
      if(exact){
        addIssue(report.blocked,q,i,'EXACT_DUPLICATE','與已存在題目重複：'+exact.id);
        continue;
      }
      if(close){
        addIssue(report.manualReview,q,i,'NEAR_DUPLICATE','題首高度相似，可能同案不同版本：'+close.id);
        continue;
      }
      var sourceReview=sourceNeedsReview(q);
      if(sourceReview){
        addIssue(report.manualReview,q,i,'SOURCE_UNVERIFIED',sourceReview);
        continue;
      }
      report.ready.push(plain(q));
      seen.push(q); // also checks duplicates within the current batch
    }
    if(report.blocked.length||report.manualReview.length)return report;
    var next=plain(published);
    for(var z=0;z<report.ready.length;z++)next.questions.push(report.ready[z]);
    next.count=next.questions.length;
    if(options&&typeof options.updatedAt==='string')next.updatedAt=options.updatedAt;
    report.proposedDataset=next;
    report.canPublish=true;
    return report;
  }
  return {version:VERSION,inspect:inspect,canonical:canonical,scoreIssue:scoreIssue};
})();
