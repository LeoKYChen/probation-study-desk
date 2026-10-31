'use strict';
// Every source cited by a theory question in law-scoring/data.js must have a full reference in docs/theory-sources.json,
// and docs/theory-openstax.json must account for every theory question.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'law-scoring/data.js'),'utf8'),sandbox);
const list=JSON.parse(fs.readFileSync(path.join(root,'docs/theory-sources.json'),'utf8'));
const known=new Set(list.sources.map(s=>s.cite));
const statuses=new Set(Object.keys(list.statusLabels));
const errors=[];
if(known.size!==list.sources.length)errors.push('duplicate cite entries in docs/theory-sources.json');
for(const s of list.sources){
  if(!s.ref)errors.push('missing ref: '+s.cite);
  if(!statuses.has(s.status))errors.push('unknown status "'+s.status+'": '+s.cite);
}
const used=new Set();
for(const q of sandbox.window.LawScoringData.questions.filter(q=>q.kind==='theory'))
  for(const r of q.rows)for(const a of r.articles){
    used.add(a);
    if(!known.has(a))errors.push('no reference for "'+a+'" ('+q.id+')');
  }
for(const c of known)if(!used.has(c))errors.push('unused entry: '+c);
// docs/theory-openstax.json: textbook sections mapped to theory questions.
const ox=JSON.parse(fs.readFileSync(path.join(root,'docs/theory-openstax.json'),'utf8'));
const theoryIds=new Set(sandbox.window.LawScoringData.questions.filter(q=>q.kind==='theory').map(q=>q.id));
const mapped=new Set();
for(const q of ox.questions){
  if(!theoryIds.has(q.id))errors.push('openstax: unknown question '+q.id);
  if(mapped.has(q.id))errors.push('openstax: duplicate question '+q.id);
  mapped.add(q.id);
  if(q.coverage!=='full'&&q.coverage!=='partial')errors.push('openstax: bad coverage for '+q.id);
  if(q.coverage==='partial'&&!q.note)errors.push('openstax: partial without note for '+q.id);
  if(!q.sections.length)errors.push('openstax: no sections for '+q.id);
  for(const s of q.sections){
    if(!ox.books[s.book])errors.push('openstax: unknown book "'+s.book+'" ('+q.id+')');
    if(!/^https:\/\/openstax\.org\/books\/[a-z0-9-]+\/pages\/[a-z0-9-]+$/.test(s.url))errors.push('openstax: bad url '+s.url);
    if(!s.matchedTerms||!s.matchedTerms.length)errors.push('openstax: no matched terms for '+q.id+' '+s.section);
  }
}
for(const id of ox.uncovered){if(mapped.has(id)||!theoryIds.has(id))errors.push('openstax: bad uncovered id '+id);mapped.add(id);}
if(mapped.size!==theoryIds.size)errors.push('openstax: '+(theoryIds.size-mapped.size)+' theory questions are neither mapped nor listed as uncovered');
// docs/theory-public-sources.json (optional until written): public full-text sources checked against the original document.
const pubPath=path.join(root,'docs/theory-public-sources.json');
let pub=null;
if(fs.existsSync(pubPath)){
  pub=JSON.parse(fs.readFileSync(pubPath,'utf8'));
  const seen=new Set();
  for(const q of pub.questions){
    if(!theoryIds.has(q.id))errors.push('public: unknown question '+q.id);
    if(seen.has(q.id))errors.push('public: duplicate question '+q.id);
    seen.add(q.id);
    if(q.coverage!=='full'&&q.coverage!=='partial')errors.push('public: bad coverage for '+q.id);
    if(q.coverage==='partial'&&!q.note)errors.push('public: partial without note for '+q.id);
    if(!q.sources||!q.sources.length)errors.push('public: no sources for '+q.id);
    for(const s of q.sources||[]){
      if(!/^https:\/\/\S+$/.test(s.url||''))errors.push('public: bad url for '+q.id+': '+s.url);
      if(!s.matchedTerms||!s.matchedTerms.length)errors.push('public: no matched terms for '+q.id+' '+s.url);
    }
  }
  for(const id of pub.uncovered||[]){if(seen.has(id)||!theoryIds.has(id))errors.push('public: bad uncovered id '+id);seen.add(id);}
  // Every theory question that OpenStax does not cover must be either covered here or listed as uncovered.
  for(const id of ox.uncovered)if(!seen.has(id))errors.push('public: '+id+' is neither covered nor listed as uncovered');
  // Each source must point at the document it names.
  for(const q of pub.questions)for(const s of q.sources||[])
    if(!pub.documents[s.doc])errors.push('public: unknown document "'+s.doc+'" ('+q.id+')');
    else if(pub.documents[s.doc].url&&s.url!==pub.documents[s.doc].url)errors.push('public: url differs from document "'+s.doc+'" ('+q.id+')');
}
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exit(1);}
console.log('theory sources: '+used.size+' citations, all with full references; OpenStax sections for '+ox.questions.length+' questions'+(pub?'; public sources for '+pub.questions.length:''));
