#!/usr/bin/env node
/* Regenerate JS representations from official JSON files; never edit generated bundles by hand. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const groups={
 daily:['daily-simulation/questions.json','daily-simulation/documents.json'],
 english:['common-subjects/daily/vocab.json','common-subjects/daily/grammar-1.json','common-subjects/daily/grammar-2.json','common-subjects/daily/grammar-3.json','common-subjects/daily/reading.json','common-subjects/daily/completion.json'],
 weekly:['juvenile-news/issues.json'],
 catalog:[]
};
const shards=path.join(root,'common-subjects/catalog/data');
function walk(dir){
 for(const d of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const abs=path.join(dir,d.name);
  if(d.isDirectory())walk(abs);
  else if(d.name.endsWith('.json'))groups.catalog.push(path.relative(root,abs).split(path.sep).join('/'));
 }
}
walk(shards);
const mode=process.argv[2]||'--check';
assert(['--write','--check'].includes(mode),'Choose --write or --check');
const outputDir=path.join(root,'file-data');
if(mode==='--write')fs.mkdirSync(outputDir,{recursive:true});
for(const [group,filenames] of Object.entries(groups)){
 const data=Object.create(null);
 for(const name of filenames){
  assert(fs.statSync(path.join(root,name)).isFile(),'Source JSON missing '+name);
  data[name]=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 }
 if(group==='daily'){
  const questions=data['daily-simulation/questions.json'].questions;
  assert(Array.isArray(questions)&&questions.length>=125,'Daily simulation unexpectedly lost original questions');
  assert.equal(new Set(questions.map(q=>q.id)).size,questions.length,'Daily simulation contains duplicate question IDs');
  assert(questions.every(q=>q.id&&typeof q.question==='string'&&q.question.trim()),'Daily simulation is missing question text or IDs');
  console.log('Source-locked daily questions:',questions.length);
 }
 if(group==='weekly')assert(data['juvenile-news/issues.json'].issues.length>0);
 const blob=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const script='/* GENERATED from committed JSON; do not hand-edit. */\n'+
  '(function(){if(typeof window.PSDRegisterFileData==="function")window.PSDRegisterFileData('+blob+');})();\n';
 const file=path.join(outputDir,group+'.generated.js');
 if(mode==='--write')fs.writeFileSync(file,script,'utf8');
 else assert(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===script,'Outdated ZIP JSON bridge: '+group+'; run node scripts/generate-file-data.cjs --write');
 console.log('PASS '+group+' '+filenames.length+' JSON sources, '+Buffer.byteLength(script)+' JS bytes');
}
