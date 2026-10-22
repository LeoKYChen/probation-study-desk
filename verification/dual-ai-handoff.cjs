'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const code=read('dual-ai-bridge.js');
new vm.Script(code,{filename:'dual-ai-bridge.js'});
const messages=[],alerts=[],timers=[],listeners={};
const popup={postMessage:(d,origin)=>messages.push({d,origin})};
let confirmations=0,opened='';
const win={
 crypto:require('node:crypto').webcrypto,
 confirm:()=>{confirmations++;return true;},
 alert:m=>alerts.push(m),
 open:url=>{opened=url;return popup;},
 setTimeout:fn=>{timers.push(fn);return 1;},
 addEventListener:(type,fn)=>{listeners[type]=fn;}
};
vm.runInNewContext(code,{window:win,console});
let result='';
assert.equal(win.PSDDualAI.start({payload:{title:'申論',instruction:'查核考點',documentText:'匿名題幹與答案'},onResult:async x=>{result=x;}}),true);
const token=opened.split('#psd-bridge=')[1];
assert.match(token,/^[a-f0-9]{32}$/);
const event=(kind,nonce=token,origin='https://leokychen.github.io',source=popup,text)=>({data:{protocol:'psd-dual-ai-v1',kind,nonce,text},origin,source});
(async()=>{
 await listeners.message(event('ready',token,'https://evil.example'));
 await listeners.message(event('ready','wrong'));
 await listeners.message(event('ready',token,'https://leokychen.github.io',{}));
 assert.equal(messages.length,0,'reject spoofed origins, identifiers and senders');
 await listeners.message(event('ready'));
 assert.equal(messages.length,1,'trusted popup can receive data');
 assert.equal(messages[0].d.kind,'create');
 assert.equal(messages[0].d.payload.documentText,'匿名題幹與答案');
 await listeners.message(event('return',token,undefined,undefined,'偽造回傳'));
 assert.equal(result,'','reject return until task acknowledged');
 await listeners.message(event('created'));
 await listeners.message(event('return',token,undefined,undefined,'兩家 AI 意見（尚待人工驗證）'));
 assert.equal(result,'兩家 AI 意見（尚待人工驗證）');
 assert.equal(messages.at(-1).d.kind,'saved');
 assert.ok(confirmations>=2,'explicit confirmation before transfer and writeback');
 assert.ok(!code.includes('localStorage.setItem'),'API keys and backups remain out of bridge');
 const daily=read('daily-simulation/index.html'),desk=read('study-desk/index.html');
 assert.ok(daily.includes('id="openDualAI"')&&daily.includes('../dual-ai-bridge.js'));
 assert.ok(desk.includes('id="open-dual-ai"')&&desk.includes('../dual-ai-bridge.js'));
 assert.ok(read('daily-simulation/app.js').includes('target.answer!==savedAnswer'));
 assert.ok(read('study-desk/app.js').includes('r.id===revisionId&&r.text===sourceText'));
 // Concurrent messages must never create duplicate feedback entries.
 let finishSave,writeCount=0;
 const delayed=new Promise(resolve=>{finishSave=resolve;});
 assert.equal(win.PSDDualAI.start({payload:{title:'第二題',instruction:'檢查',documentText:'第二份答案'},onResult:async()=>{writeCount++;await delayed;}}),true);
 await listeners.message(event('ready'));
 await listeners.message(event('created'));
 const firstWrite=listeners.message(event('return',token,undefined,undefined,'評語一'));
 await listeners.message(event('return',token,undefined,undefined,'評語一'));
 assert.equal(writeCount,1,'ignore concurrent duplicate return messages');
 finishSave();
 await firstWrite;
 await listeners.message(event('return',token,undefined,undefined,'評語一'));
 assert.equal(writeCount,1,'ignore repeated return after acknowledgement');
 console.log('PASS: origin, popup nonce, source identity, user confirmation, result binding, and both practice entries');
})().catch(e=>{console.error(e);process.exitCode=1;});
