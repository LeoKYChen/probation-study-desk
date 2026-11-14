/* 專業科目每日安排（首頁用）。規則與 professional/ 的 subjectFor 相同：
 * 週一憲法與行政法隔週交替、週二民法、週三民事訴訟法、週四刑法、週五刑事訴訟法、
 * 週六在公司法、保險法、證券交易法與選試科目之間四週一輪、週日綜合複習。
 * 週數自 2026-10-12（週一）起算。tests/unit/schedule.test.cjs 比對兩邊結果。 */
(function(root){
  'use strict';
  const ELECTIVE='智慧財產法'; // 選試科目；改選別時，與 professional/ 的 ELECTIVE 一起改
  const NAMES=['','憲法與行政法','民法','民事訴訟法','刑法','刑事訴訟法','商事法'];
  const dow=iso=>new Date(iso+'T12:00:00+08:00').getUTCDay();
  const week=iso=>Math.floor((Date.parse(iso+'T00:00:00Z')-Date.UTC(2026,9,12))/(7*86400000));
  function subjectFor(iso){
    const d=dow(iso);
    if(d===0)return {day:d,label:'綜合複習＋共同科目',target:'複習',sunday:true};
    const wk=((week(iso)%6)+6)%6;
    if(d===1)return {day:d,label:'憲法與行政法',target:wk%2===1?'憲法':'行政法',sunday:false};
    if(d===6){const alt=['公司法','保險法','證券交易法',ELECTIVE][((week(iso)%4)+4)%4];return {day:d,label:alt===ELECTIVE?'選試科目（'+alt+'）':'商事法（'+alt+'）',target:alt,sunday:false};}
    return {day:d,label:NAMES[d],target:NAMES[d],sunday:false};
  }
  root.StudySchedule={subjectFor,ELECTIVE};
})(typeof window!=='undefined'?window:this);
