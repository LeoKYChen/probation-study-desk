// 設計代幣的文字／背景對比（WCAG 2.2 AA：一般文字 4.5:1，大字與介面元件 3:1）。
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','..','assets','study-theme.css'),'utf8');
const token=name=>{const m=css.match(new RegExp('--'+name+':\\s*(#[0-9a-fA-F]{6})'));assert(m,'找不到代幣 --'+name);return m[1].toLowerCase();};
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const T={paper:token('paper'),surface:token('surface'),raised:token('raised'),sunken:token('sunken'),ink:token('ink'),muted:token('muted'),accent:token('accent'),accentDark:token('accent-dark'),ok:token('ok')};
const pairs=[
 ['墨黑字 / 紙底',T.ink,T.paper,4.5],['墨黑字 / 卡片',T.ink,T.surface,4.5],['墨黑字 / 稿紙',T.ink,T.raised,4.5],
 ['次要字 / 紙底',T.muted,T.paper,4.5],['次要字 / 卡片',T.muted,T.surface,4.5],['次要字 / 凹陷底',T.muted,T.sunken,4.5],
 ['法典紅字 / 紙底',T.accent,T.paper,4.5],['法典紅字 / 卡片',T.accent,T.surface,4.5],['法典紅字 / 凹陷底',T.accent,T.sunken,4.5],
 ['紙色字 / 法典紅按鈕',T.surface,T.accent,4.5],['紙色字 / 墨黑面板',T.paper,T.ink,4.5],['紙色字 / 深紅按鈕（懸停）',T.surface,T.accentDark,4.5],
 ['墨綠 / 紙底（狀態字）',T.ok,T.paper,4.5],
];
let bad=[];
for(const [name,fg,bg,min] of pairs){const r=ratio(fg,bg);if(r<min)bad.push(`${name} ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);}
assert.deepEqual(bad,[],'對比不足：\n'+bad.join('\n'));
// 深色面板上的輔助字（首頁倒數、複習頁到期面板）
for(const fg of ['#c9c1b3','#d9d1c3']){assert(ratio(fg,T.ink)>=4.5,fg+' / 墨黑面板 對比不足');}
console.log('PASS 設計代幣對比：'+pairs.length+' 組文字／背景皆達 WCAG AA（最低 '+Math.min(...pairs.map(p=>ratio(p[1],p[2]))).toFixed(2)+':1）');
