'use strict';
/* No real student data; all checks read static deployed assets only. */
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||'deploy-dist',get=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=get('index.html'),js=get('clean-ui.js'),css=get('clean-ui.css');
let passed=0;function check(title,fn){fn();console.log('PASS',++passed,title);}
check('theme script follows v254 diagnostics',()=>a.ok(html.indexOf('src="./v254-diagnostics.js"')<html.indexOf('src="./clean-ui.js"')));
check('theme CSS linked',()=>a.ok(html.includes('href="./clean-ui.css"')));
check('no duplicated theme CSS',()=>a.equal((html.match(/href="\.\/clean-ui\.css"/g)||[]).length,1));
check('existing essay editor retained',()=>a.equal((html.match(/id="essayEditor"/g)||[]).length,1));
check('existing daily notes retained',()=>a.equal((html.match(/id="dailyEssayPanel"/g)||[]).length,1));
check('existing analysis remains',()=>a.ok(html.includes('id="v254StudySummary"')));
check('source count badge remains',()=>a.ok(html.includes('id="questionSourceSummary"')));
check('restore confirmation remains',()=>a.ok(html.includes('id="importConfirm"')));
check('JSON file picker remains',()=>a.ok(html.includes('id="importBackupFile"')));
check('does not use localStorage',()=>a.ok(!/localStorage\s*[.\[]|sessionStorage\s*[.\[]/.test(js)));
check('no network requests',()=>a.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket/.test(js)));
check('does not duplicate editor',()=>a.ok(!js.includes('cloneNode')));
check('no synthetic assessment values',()=>a.ok(!/\+12%|68%|60\/100/.test(js)));
check('no question or grade mutation',()=>a.ok(!/session\.questionId\s*=|\.rating\s*=/.test(js)));
check('navy and teal palette applied',()=>a.ok(css.includes('#214b75')&&css.includes('#208b90')));
check('single-column mobile breakpoint',()=>a.ok(css.includes('max-width:900px')&&css.includes('grid-template-columns:1fr')));
check('reduced motion preference',()=>a.ok(css.includes('prefers-reduced-motion')));
check('keyboard focus visible',()=>a.ok(css.includes('focus-visible')));
check('warning never hidden by stylesheet',()=>a.ok(!css.includes('.backup-import-panel{display:none')));
check('navigation targets real sections',()=>a.ok(js.includes('cleanDaily')&&js.includes('cleanInsights')&&js.includes('cleanBackup')));
check('same original editor panel moves',()=>a.ok(js.includes('essayCol.append(essay)')));
check('incomplete source counts highlighted',()=>a.ok(css.includes('#questionSourceSummary[data-complete="false"]')));
console.log('TOTAL',passed,'UI regression checks: PASS');