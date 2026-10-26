'use strict';
// `npm test`: every check that needs only Node.js (and Python for the stability contract), no browser or extra packages.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const NODE=[
  'scripts/check-duplicate-copies.cjs',
  'verification/dual-ai-handoff.cjs',
  'verification/check-daily-v254.cjs',
  'verification/offline-stage4-check.cjs',
  'verification/practice-context-checks.cjs',
  'verification/all-subject-pilots.cjs',
  'verification/study-desk-weakness.cjs',
  'verification/law-scoring.cjs',
  'lectures/test.cjs',
  'backup/test.cjs',
  'print/test.cjs',
  'common-subjects/test-v02.cjs',
  'common-subjects/test-staresto.cjs',
  'common-subjects/daily/test-v04.cjs',
  'common-subjects/english-assistant/test.cjs',
  'common-subjects/english-assistant/test-vocab.cjs',
  'knowledge-graph-preview/model.test.cjs',
  'knowledge-graph-preview/real-data.test.cjs'
];
const NODE_TEST=[
  'verification/weekly-sync.test.cjs',
  'verification/weekly-import.test.cjs',
  'verification/sync/core.test.mjs',
  'verification/sync/planning.test.mjs',
  'verification/sync/subjects.test.mjs',
  'police-exams/tools/approved-loader.test.cjs',
  'police-exams/tools/integration.test.cjs',
  'police-exams/tools/verify_official_pdf_hashes.test.cjs'
];
const runs=[
  ...NODE.map(f=>[process.execPath,[f]]),
  ...NODE_TEST.map(f=>[process.execPath,['--test',f]]),
  // Also guards the reviewed-layout ledger (docs/LAYOUT_REVIEW_CHANGES.json), which pins files such as sw.js.
  [process.execPath,['verification/unified-integration.cjs','.']],
  ['python3',['scripts/check-stability-contract.py']]
];
const failed=[];
for(const [cmd,args] of runs){
  const label=args.filter(a=>a!=='.'&&a!=='--test').pop();
  const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  if(r.status===0)console.log('PASS '+label);
  else{failed.push(label);console.log('FAIL '+label+'\n'+((r.stdout||'')+(r.stderr||'')||String(r.error)).trim().split('\n').slice(-20).join('\n'));}
}
console.log('\n'+(runs.length-failed.length)+'/'+runs.length+' checks passed. Browser tests (verification/*browser*, e2e-*) and verification/sync sql.test need extra packages; run them separately.');
if(failed.length)process.exit(1);
