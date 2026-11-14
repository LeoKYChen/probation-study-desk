// 各頁在 320／390／768／1440 寬度下不得橫向捲動（含底部分頁列不遮蔽內容的基本檢查）。
'use strict';
const path=require('path'),http=require('http'),fs=require('fs');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..','..');
const pages=['index.html','practice/index.html','outline/index.html','official/index.html','review/index.html','professional/index.html','v2.5/index.html','daily-simulation/index.html','active-recall/index.html','mcq/index.html','common-subjects/index.html','study-desk/index.html','lectures/index.html','backup/index.html','print/index.html','offline/index.html'];
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
const b=await chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{});
const bad=[];
for(const w of [320,390,768,1440]){const c=await b.newContext({viewport:{width:w,height:800},serviceWorkers:'block'});const p=await c.newPage();
for(const rel of pages){await p.goto(`http://localhost:${port}/${rel}`,{waitUntil:'load'});await p.waitForTimeout(300);
const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
if(o.sw>o.cw+1)bad.push(`${rel} @${w}: scrollWidth ${o.sw} > ${o.cw}`);}
await c.close();}
await b.close();srv.close();
if(bad.length){console.error('FAIL 橫向溢出：\n'+bad.join('\n'));process.exit(1);}
console.log('PASS 16 頁 × 4 種寬度皆無橫向溢出');})();
