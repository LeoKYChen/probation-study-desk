'use strict';
// Read-only release audit: compare freshly downloaded MOEX PDF byte hashes to
// approved records. Never changes official question bodies or marks human review.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const here=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(here,'catalog.json'),'utf8'));
const window={};
vm.runInNewContext(fs.readFileSync(path.join(here,'questions.approved.js'),'utf8'),{window});
const originals=window.POLICE_ORIGINAL_QUESTION_BANK;
const specs=new Map(catalog.subjects.map(s=>[s.key,s]));
const known=catalog.knownPaperUrls;
function verify(audit,{year=null}={}){
  assert(Number.isInteger(audit.expectedPaperSlots)&&audit.expectedPaperSlots===32,'catalogue total should remain 32');
  if(year!==null)assert(Number.isInteger(year)&&year>=108&&year<=115,'invalid year filter');
  const keys=Object.keys(known).filter(k=>year===null||Number(k.split(':')[0])===year);
  assert.equal(keys.length,year===null?32:4,'expected official paper slots missing');
  assert(Array.isArray(audit.papers),'source collection audit missing');
  assert.equal(audit.processedSlots,keys.length,'not all requested official papers were processed');
  assert.equal(audit.papers.length,keys.length,'source audit row count mismatch');
  const rows=new Map();
  for(const row of audit.papers){
    const subject=catalog.subjects.find(s=>s.subject===row.subject&&s.examName===row.examName);
    assert(subject,'source audit contains unknown exam/subject: '+JSON.stringify(row).slice(0,140));
    const key=row.year+':'+subject.key;
    assert(keys.includes(key),'unexpected source paper '+key);
    assert(!rows.has(key),'duplicate source paper '+key);
    rows.set(key,row);
  }
  const checked=[];
  for(const key of keys){
    const row=rows.get(key),url=known[key],spec=specs.get(key.split(':')[1]);
    assert(row,'missing download result for '+key);
    assert.equal(row.sourceUrl,url,'official source URL changed: '+key);
    assert(/^[0-9a-f]{64}$/.test(row.pdfSha256||''),'no valid freshly downloaded official PDF SHA256 for '+key);
    assert(['extracted_pending_review','manual_resolution_required'].includes(row.status),'PDF download/header/extraction unresolved: '+key+' ('+row.status+')');
    const questions=originals.filter(q=>q.year===row.year&&q.officialSubject===spec.subject);
    assert.equal(questions.length,key==='114:criminal_law_procedure'?3:4,'approved source question count mismatch: '+key);
    assert.equal(row.questionCount,questions.length,'fresh PDF question count changed: '+key);
    for(const q of questions){
      assert.equal(q.sourceUrl,url,'approved source URL mismatch: '+q.id);
      assert.equal(q.paperSha256,row.pdfSha256,'OFFICIAL PDF BYTES CHANGED: '+q.id+' (human investigation required)');
    }
    checked.push({paper:key,pdfSha256:row.pdfSha256,questions:questions.length,sourceStatus:row.status});
  }
  const count=checked.reduce((n,x)=>n+x.questions,0);
  assert.equal(count,year===null?127:(year===114?15:16),'published total source question count mismatch');
  return {result:'source_pdf_hashes_match',humanProofread:false,verifiedPdfCount:checked.length,verifiedQuestionCount:count,papers:checked};
}
if(require.main===module){
  const args=process.argv.slice(2),index=args.indexOf('--year');
  const year=index>=0?Number(args[index+1]):null;
  const filepath=path.resolve(args[0]||'police-exams/output/audit.json');
  const resultFile=path.join(path.dirname(filepath),'approved-source-hash-check.json');
  try{
    const audit=JSON.parse(fs.readFileSync(filepath,'utf8'));
    const report=verify(audit,{year});
    fs.writeFileSync(resultFile,JSON.stringify(report,null,2)+'\n');
    console.log('PASS: freshly downloaded official MOEX PDFs:',report.verifiedPdfCount,'papers /',report.verifiedQuestionCount,'questions; human proofreading still required.');
  }catch(error){
    fs.mkdirSync(path.dirname(resultFile),{recursive:true});
    fs.writeFileSync(resultFile,JSON.stringify({result:'blocked',humanProofread:false,reason:error.message},null,2)+'\n');
    console.error('BLOCK: official PDF source fingerprint audit failed:',error.message);
    process.exitCode=1;
  }
}
module.exports={verify};
