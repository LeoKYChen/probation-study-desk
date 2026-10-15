/* Add minimal interface assets on top of the already tested v2.5.4 build. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const dir=process.argv[2]||'deploy-dist',file=path.join(dir,'index.html');
let html=fs.readFileSync(file,'utf8');
const script='<script src="./v254-diagnostics.js" defer></script>';
if(!html.includes(script)||!html.includes('</head>')||html.includes('src="./clean-ui.js"'))
  throw Error('Missing v2.5.4 base, or UI patch already applied');
html=html.replace(script,script+'\n  <script src="./clean-ui.js" defer></script>');
html=html.replace('</head>','  <link rel="stylesheet" href="./clean-ui.css">\n</head>');
fs.writeFileSync(file,html,'utf8');
console.log('Added clean UI files after v2.5.4 diagnostics');