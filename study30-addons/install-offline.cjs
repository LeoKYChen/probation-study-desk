/* v2.5.4 offline installer: build a complete same-origin snapshot without touching app logic. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const dir=path.resolve(process.argv[2]||'deploy-dist'),htmlPath=path.join(dir,'index.html');
const required=['index.html','style.css','app.js','review-core.js','review-simulator.js','essay.js','essay-rubric-core.js','essay-selfcheck.js','source-main-questions.js','source-related-questions.js','question-sources.js','daily-essay-workbench.js','v254-diagnostics.js'];
for(const p of required){if(!fs.existsSync(path.join(dir,p)))throw Error('Offline prerequisite missing: '+p);}
let html=fs.readFileSync(htmlPath,'utf8');
if(html.includes('id="offlineStatus"')||html.includes('rel="manifest"'))throw Error('Offline installer applied twice');
if(!html.includes('</head>')||!html.includes('</body>'))throw Error('HTML head/body missing');

// The exercise must not require a live CDN after the page is cached.
const remoteScript=/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//ig;
if(remoteScript.test(html))throw Error('External script dependency would break airplane-mode exercise');

// PNG encoder uses built-in Node APIs, so CI needs no image processing packages.
const crcTable=Array.from({length:256},(_,n)=>{
  let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function crc(b){let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const kind=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([kind,data])));return Buffer.concat([size,kind,data,checksum]);}
function makeIcon(n){
  const raw=Buffer.alloc(n*(1+n*4));
  function paint(x,y,color){const p=y*(n*4+1)+1+x*4;raw[p]=color[0];raw[p+1]=color[1];raw[p+2]=color[2];raw[p+3]=255;}
  const navy=[33,75,117],teal=[32,139,144],light=[251,251,244],soft=[217,236,234];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const r=n*.20;const dx=Math.max(n*.10-x,0,x-n*.90),dy=Math.max(n*.10-y,0,y-n*.90);
    const background=Math.hypot(dx,dy)<=r?navy:[248,249,250];paint(x,y,background);
  }
  // Two open pages, teal spine, and small pale lines - a recognizable book icon.
  for(let y=Math.floor(n*.27);y<n*.74;y++)for(let x=Math.floor(n*.21);x<n*.79;x++){
    const l=x<n*.5,upper=y<n*.30+Math.abs(x/n-.5)*n*.045;
    if(upper)continue;
    const rightEdge=x>n*.76 && y>n*.69;
    if(rightEdge)continue;
    paint(x,y,l?light:soft);
  }
  for(let y=Math.floor(n*.26);y<n*.77;y++)for(let x=Math.floor(n*.485);x<Math.ceil(n*.515);x++)paint(x,y,teal);
  for(const y0 of [.39,.49,.59])for(let y=Math.floor(n*y0);y<Math.floor(n*(y0+.018));y++)
    for(let x=Math.floor(n*.27);x<Math.floor(n*.43);x++)paint(x,y,teal);
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(n,0);hdr.writeUInt32BE(n,4);hdr[8]=8;hdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(raw,9)),chunk('IEND',Buffer.alloc(0))]);
}
for(const n of [180,192,512])fs.writeFileSync(path.join(dir,'icon-'+n+'.png'),makeIcon(n));
const manifest={name:'觀護人練習臺｜每日30分鐘',short_name:'觀護人練習',description:'116年觀護人考試每日練習（離線預載）',id:'./',start_url:'./',scope:'./',display:'standalone',background_color:'#f7f9fa',theme_color:'#214b75',lang:'zh-TW',icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
fs.writeFileSync(path.join(dir,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
fs.copyFileSync(path.join(__dirname,'offline-control.js'),path.join(dir,'offline-control.js'));
fs.copyFileSync(path.join(__dirname,'offline.css'),path.join(dir,'offline.css'));
html=html.replace('</head>',[
'  <meta name="theme-color" content="#214b75">',
'  <meta name="apple-mobile-web-app-capable" content="yes">',
'  <meta name="apple-mobile-web-app-status-bar-style" content="default">',
'  <link rel="manifest" href="./manifest.webmanifest">',
'  <link rel="apple-touch-icon" href="./icon-180.png">',
'  <link rel="stylesheet" href="./offline.css">',
'</head>'].join('\n'));
html=html.replace('</body>',[
'  <div id="offlineStatus" class="offline-status" role="status" aria-live="polite" hidden></div>',
'  <script src="./offline-control.js" defer></script>',
'</body>'].join('\n'));
fs.writeFileSync(htmlPath,html);
// Assemble the exhaustive asset list from actual build output, not hard-coded guesses.
// Only files in this deployment are cached (so the 426-question sources are included).
const allowed=/\.(html|css|js|json|webmanifest|png|svg|ico|woff2?)$/i;
const inventory=fs.readdirSync(dir,{withFileTypes:true})
 .filter(e=>e.isFile()&&allowed.test(e.name)&&e.name!=='sw.js')
 .map(e=>e.name).sort();
if(!inventory.includes('source-main-questions.js')||!inventory.includes('source-related-questions.js'))throw Error('Original question data absent');
const digest=crypto.createHash('sha256');
for(const p of inventory){digest.update(p);digest.update(fs.readFileSync(path.join(dir,p)));}
const version=digest.digest('hex').slice(0,16);
const template=fs.readFileSync(path.join(__dirname,'service-worker.template.js'),'utf8');
if(!template.includes('__OFFLINE_ASSETS__')||!template.includes('__OFFLINE_VERSION__'))throw Error('Service worker template mismatch');
const sw=template.replace('__OFFLINE_ASSETS__',JSON.stringify(['./',...inventory.map(p=>'./'+p)]))
 .replace('__OFFLINE_VERSION__',version);
fs.writeFileSync(path.join(dir,'sw.js'),sw);
fs.writeFileSync(path.join(dir,'_headers'),'/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n/index.html\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n');
console.log('Offline package built: '+inventory.length+' static assets, cache version '+version+', with original question sources and iPhone icons');
