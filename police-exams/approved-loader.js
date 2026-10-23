/* Shared safe loader. Existing question arrays and record IDs are not modified. */
(function (root) {
  'use strict';
  const validSubjects = new Set(['心理學','諮商與輔導','刑法與刑事訴訟法','犯罪學與犯罪預防']);
  const expected = {
    '心理學':'一般警察人員考試',
    '諮商與輔導':'一般警察人員考試',
    '刑法與刑事訴訟法':'一般警察人員考試',
    '犯罪學與犯罪預防':'警察人員考試'
  };
  // Stable IDs tie each original question to exactly one official year, paper, and number.
  // This protects persisted answers from being associated with a mislabelled import.
  const subjectSlugs = {
    '心理學':'psychology',
    '諮商與輔導':'counseling',
    '刑法與刑事訴訟法':'criminal_law_procedure',
    '犯罪學與犯罪預防':'criminology_prevention'
  };
  const candidate = Array.isArray(root.POLICE_ORIGINAL_QUESTION_BANK) ? root.POLICE_ORIGINAL_QUESTION_BANK : [];
  const currentIds = new Set([...(root.QUESTION_BANK||[]),...(root.RELATED_QUESTION_BANK||[])].map(q=>q.id));
  const seen = new Set();
  const seenPaperSlots = new Set();
  const accepted = [];
  const rejected = [];
  for (const q of candidate) {
    const reason =
      !q || typeof q !== 'object' ? 'record type' :
      !validSubjects.has(q.officialSubject) ? 'outside four subjects' :
      q.examName !== expected[q.officialSubject] ? 'exam mismatch' :
      !Number.isInteger(q.year) || q.year<108 || q.year>115 ? 'outside years' :
      !Number.isInteger(q.questionNo) || q.questionNo<1 ? 'invalid number' :
      q.id !== 'police-'+q.year+'-'+subjectSlugs[q.officialSubject]+'-'+q.questionNo ? 'ID does not match official paper slot' :
      q.examLevel !== '三等考試' || q.examType !== '犯罪防治人員預防組' ? 'exam class mismatch' :
      typeof q.body!=='string' || q.body.length<20 ? 'missing original body' :
      !Number.isInteger(q.officialPoints) || q.officialPoints<1 || q.officialPoints>100 ? 'invalid official points' :
      !q.sourceReview || typeof q.sourceReview.reviewer!=='string' || !q.sourceReview.reviewer.trim() || typeof q.sourceReview.reviewMethod!=='string' || !q.sourceReview.reviewMethod.trim() ? 'missing review provenance' :
      typeof q.sourceUrl!=='string' || !/^https:\/\/wwwq\.moex\.gov\.tw\/exam\/wHandExamQandA_File\.ashx\?/.test(q.sourceUrl) ? 'invalid official URL' :
      q.sourceKind!=='official-original' || q.verified!==true ? 'not source-verified' :
      !/^[0-9a-f]{64}$/.test(q.paperSha256||'') || !/^[0-9a-f]{64}$/.test(q.textSha256||'') ? 'missing evidence hash' :
      currentIds.has(q.id) || seen.has(q.id) ? 'duplicate ID' :
      seenPaperSlots.has(q.year+':'+q.officialSubject+':'+q.questionNo) ? 'duplicate official paper slot' : null;
    if(reason){rejected.push({id:q?.id||'(unknown)',reason});continue;}
    seen.add(q.id);
    seenPaperSlots.add(q.year+':'+q.officialSubject+':'+q.questionNo);
    // No rebuilding/replacing body. Original text is immutable input.
    accepted.push({...q,subject:q.officialSubject,examTypes:[q.examName+'三等犯罪防治人員預防組']});
  }
  root.PolicePastPaperIntegration={approved:accepted,rejected,yearRange:[108,115],subjects:[...validSubjects]};
  root.POLICE_ORIGINAL_QUESTION_BANK=accepted;
})(window);
