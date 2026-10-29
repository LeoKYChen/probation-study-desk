'use strict';
// Every source cited by a theory question in law-scoring/data.js must have a full reference in docs/theory-sources.json.
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
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exit(1);}
console.log('theory sources: '+used.size+' citations, all with full references');
