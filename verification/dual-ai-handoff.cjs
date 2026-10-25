'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const code=read('dual-ai-bridge.js');
new vm.Script(code,{filename:'dual-ai-bridge.js'});
const messages=[],alerts=[],timers=[],listeners={};
const popup={postMessage:(d,origin)=>messages.push({d,origin})};
const store=new Map();const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i]??null,get length(){return store.size;}};
let confirmations=0,opened='';
const win={
 crypto:require('node:crypto').webcrypto,
 localStorage,
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
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-handoff:'+token)).payload.documentText,'匿名題幹與答案');
 await listeners.message(event('return',token,undefined,undefined,'偽造回傳'));
 assert.equal(result,'','reject return until task acknowledged');
 await listeners.message(event('created'));
 await listeners.message(event('return',token,undefined,undefined,'兩家 AI 意見（尚待人工驗證）'));
 assert.equal(result,'兩家 AI 意見（尚待人工驗證）');
 assert.equal(messages.at(-1).d.kind,'saved');
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-ack:'+token)).ok,true);
 assert.ok(confirmations>=2,'explicit confirmation before transfer and writeback');
 assert.ok(!JSON.stringify([...store]).includes('API 金鑰'),'no API keys are saved in bridge handoff');
 const daily=read('daily-simulation/index.html'),desk=read('study-desk/index.html');
 assert.ok(daily.includes('id="openDualAI"')&&daily.includes('../dual-ai-bridge.js'));
 assert.ok(desk.includes('id="open-dual-ai"')&&desk.includes('../dual-ai-bridge.js'));
 assert.ok(read('daily-simulation/app.js').includes('hash(target.answer)!==context.answer'));
 assert.ok(read('study-desk/app.js').includes('r.id===revisionId&&globalThis.PSDDualAI.hash(r.text)===text'));
 // Concurrent messages must never create duplicate feedback entries.
 let finishSave,writeCount=0;
 const delayed=new Promise(resolve=>{finishSave=resolve;});
 assert.equal(win.PSDDualAI.start({payload:{title:'第二題',instruction:'檢查',documentText:'第二份答案'},onResult:async()=>{writeCount++;await delayed;}}),true);
 const secondToken=opened.split('#psd-bridge=')[1];
 await listeners.message(event('ready',secondToken));
 await listeners.message(event('created',secondToken));
 const firstWrite=listeners.message(event('return',secondToken,undefined,undefined,'評語一'));
 await listeners.message(event('return',secondToken,undefined,undefined,'評語一'));
 assert.equal(writeCount,1,'ignore concurrent duplicate return messages');
 finishSave();
 await firstWrite;
 await listeners.message(event('return',secondToken,undefined,undefined,'評語一'));
 assert.equal(writeCount,1,'ignore repeated return after acknowledgement');
 // iOS openerless tab: destination consumes the one-time handoff, then writes review via storage.
 let iosText='';
 assert.equal(win.PSDDualAI.start({payload:{title:'iOS 題目',instruction:'交叉檢查',documentText:'iPhone 上的完整答案'},onResult:async x=>{iosText=x;}}),true);
 const iosToken=opened.split('#psd-bridge=')[1];
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-handoff:'+iosToken)).payload.title,'iOS 題目');
 localStorage.removeItem('psd-dual-ai-handoff:'+iosToken);
 await listeners.storage({key:'psd-dual-ai-handoff:'+iosToken,newValue:null});
 const feedback={nonce:iosToken,createdAt:Date.now(),text:'iOS 工作臺六階段批改'};
 localStorage.setItem('psd-dual-ai-return:'+iosToken,JSON.stringify(feedback));
 await listeners.storage({key:'psd-dual-ai-return:'+iosToken,newValue:JSON.stringify(feedback)});
 assert.equal(iosText,'iOS 工作臺六階段批改');
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-ack:'+iosToken)).ok,true);
 assert.equal(localStorage.getItem('psd-dual-ai-return:'+iosToken),null,'successful return clears temporary feedback');
 // Reopened page: the original tab was reloaded or discarded, so only the stored pending record remains.
 assert.equal(win.PSDDualAI.start({payload:{title:'重開題目',instruction:'檢查',documentText:'答案'},onResult:async()=>{throw Error('old closure must not run');},resume:{scope:'daily-simulation',context:{id:'q1',answer:win.PSDDualAI.hash('答案')}}}),true);
 const lostToken=opened.split('#psd-bridge=')[1];
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-pending:'+lostToken)).context.id,'q1');
 localStorage.setItem('psd-dual-ai-return:'+lostToken,JSON.stringify({nonce:lostToken,createdAt:Date.now()-30*60*1000,text:'三十分鐘後才回傳的評語'}));
 const reopened={...win,setTimeout:fn=>{reopenedTimers.push(fn);return 1;},addEventListener:(type,fn)=>{reopenedListeners[type]=fn;}};
 const reopenedTimers=[],reopenedListeners={};
 vm.runInNewContext(code,{window:reopened,console});
 let recovered=null;
 reopened.PSDDualAI.resume('daily-simulation',async(context,text)=>{recovered={context,text};});
 for(const fn of reopenedTimers.splice(0))await fn();
 assert.equal(recovered,null,'another tab leaves the write-back to the original page while it is still open');
 const age=key=>{const p=JSON.parse(localStorage.getItem(key));p.aliveAt=Date.now()-60000;localStorage.setItem(key,JSON.stringify(p));};
 age('psd-dual-ai-pending:'+lostToken);
 await reopenedListeners.storage({key:'psd-dual-ai-return:'+lostToken,newValue:localStorage.getItem('psd-dual-ai-return:'+lostToken)});
 assert.deepEqual(JSON.parse(JSON.stringify(recovered)),{context:{id:'q1',answer:win.PSDDualAI.hash('答案')},text:'三十分鐘後才回傳的評語'},'reopened page writes the late review back');
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-ack:'+lostToken)).ok,true);
 assert.equal(localStorage.getItem('psd-dual-ai-pending:'+lostToken),null,'pending record cleared after write-back');
 assert.equal(localStorage.getItem('psd-dual-ai-return:'+lostToken),null);
 // A failed recovery reports back to the workbench instead of retrying forever.
 assert.equal(win.PSDDualAI.start({payload:{title:'已改答案',instruction:'檢查',documentText:'答案'},onResult:async()=>{},resume:{scope:'daily-simulation',context:{id:'q2'}}}),true);
 const changedToken=opened.split('#psd-bridge=')[1];
 localStorage.setItem('psd-dual-ai-return:'+changedToken,JSON.stringify({nonce:changedToken,createdAt:Date.now(),text:'評語'}));
 age('psd-dual-ai-pending:'+changedToken);
 reopened.PSDDualAI.resume('daily-simulation',async()=>{throw Error('題目或作答已變更');});
 for(const fn of reopenedTimers.splice(0))await fn();
 assert.equal(JSON.parse(localStorage.getItem('psd-dual-ai-ack:'+changedToken)).ok,false);
 assert.equal(localStorage.getItem('psd-dual-ai-pending:'+changedToken),null);
 assert.notEqual(win.PSDDualAI.hash('答案'),win.PSDDualAI.hash('答案 '),'hash detects edited answers');
  console.log('PASS: origin, popup nonce, source identity, user confirmation, result binding, and both practice entries');
})().catch(e=>{console.error(e);process.exitCode=1;});
