'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {verify}=require('./verify_official_pdf_hashes.cjs');
const catalog=JSON.parse(fs.readFileSync('police-exams/catalog.json','utf8'));
const window={};
vm.runInNewContext(fs.readFileSync('police-exams/questions.approved.js','utf8'),{window});
const bank=window.POLICE_ORIGINAL_QUESTION_BANK;
const audit={expectedPaperSlots:32,processedSlots:32,papers:Object.entries(catalog.knownPaperUrls).map(([key,url])=>{
  const [year,slug]=key.split(':'),spec=catalog.subjects.find(s=>s.key===slug);
  const questions=bank.filter(q=>q.year===Number(year)&&q.officialSubject===spec.subject);
  return {year:Number(year),subject:spec.subject,examName:spec.examName,sourceUrl:url,
    status:'extracted_pending_review',pdfSha256:questions[0].paperSha256,questionCount:questions.length};
})};
const result=verify(audit);
assert.equal(result.verifiedPdfCount,32);
assert.equal(result.verifiedQuestionCount,127);
assert.equal(result.humanProofread,false);
const sub=verify({...audit,processedSlots:4,papers:audit.papers.filter(q=>q.year===114)},{year:114});
assert.equal(sub.verifiedQuestionCount,15);
const altered=(edit)=>{
  const duplicate=JSON.parse(JSON.stringify(audit));edit(duplicate);return duplicate;
};
assert.throws(()=>verify(altered(a=>a.papers[0].pdfSha256='a'.repeat(64))),/OFFICIAL PDF BYTES CHANGED/);
assert.throws(()=>verify(altered(a=>a.papers[0].sourceUrl='https://example.org/paper.pdf')),/official source URL changed/);
assert.throws(()=>verify(altered(a=>a.papers[0].status='fetch_or_extract_failed')),/unresolved/);
assert.throws(()=>verify(altered(a=>a.papers[0].questionCount=3)),/fresh PDF question count changed/);
assert.throws(()=>verify(altered(a=>a.papers.pop())),/source audit row count mismatch/);
console.log('PASS: 32 fresh-PDF fingerprints and negative change/error cases checked; no human sign-off inferred.');
