'use strict';
// These question banks and link tables are served from several paths; every copy must stay byte-identical.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const GROUPS=[
  ['v2.5/questions.js','questions.js','professional/source-main-questions.js'],
  ['v2.5/related-questions.js','related-questions.js','professional/source-related-questions.js'],
  ['v2.5/yamol-links.js','yamol-links.js','professional/study30-yamol-links.js'],
  ['v2.5/yamol-ui.js','yamol-ui.js'],
  ['v2.5/shuati-links.js','professional/study30-shuati-links.js']
];
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
let failed=false;
for(const [source,...copies] of GROUPS){
  const expected=digest(source);
  for(const copy of copies){
    if(!fs.existsSync(path.join(root,copy)))continue;
    if(digest(copy)!==expected){failed=true;console.error('MISMATCH: '+copy+' differs from '+source+'; copy the updated source over it.');}
  }
}
if(failed)process.exit(1);
console.log('PASS duplicate copies: '+GROUPS.length+' groups byte-identical');
