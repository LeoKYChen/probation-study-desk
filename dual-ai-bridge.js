(function(root){'use strict';
  const PROTOCOL='psd-dual-ai-v1';
  const TARGET_URL='https://leokychen.github.io/multi-ai-review-desk/';
  const TARGET_ORIGIN='https://leokychen.github.io';
  // A finished review may be written back up to a week later, e.g. after iOS Safari discarded the practice tab.
  const RETURN_MAX_AGE=7*24*60*60*1000,PENDING_PREFIX='psd-dual-ai-pending:',ALIVE_MS=20000;
  let active=null;
  const resumers={},recovering=new Set();
  const fail=message=>{throw Error(message);};
  function validPayload(value){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('資料格式無效');
    for(const [key,max] of [['title',180],['instruction',20000],['documentText',50000]]){
      if(typeof value[key]!=='string'||value[key].length>max||(key!=='documentText'&&!value[key].trim()))fail('雙 AI 交接內容超過限制或缺少 '+key);
    }
    return {title:value.title,instruction:value.instruction,documentText:value.documentText};
  }
  function nonce(){
    if(!root.crypto?.getRandomValues)fail('此瀏覽器無法安全產生交接識別碼，請改用 HTTPS 網址');
    return Array.from(root.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  }
  // Small, stable fingerprint so a pending record can verify the answer without storing it twice.
  function hash(text){
    let h1=0xdeadbeef,h2=0x41c6ce57;const s=String(text);
    for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
    h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
    h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
    return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)+':'+s.length;
  }
  function clearPending(id){try{root.localStorage.removeItem(PENDING_PREFIX+id);}catch{}}
  function start({payload,onResult,resume}){
    if(typeof onResult!=='function')fail('沒有設定回寫目標');
    const safe=validPayload(payload);
    if(active&&!active.finished&&!root.confirm('已有一項尚未回傳的雙 AI 任務。改為送出新的題目後，舊視窗將無法自動回寫。確定繼續？'))return false;
    if(!root.confirm('本次準備送審：\n'+safe.title+'\n\n請確認這就是目前正在練習的題目。工作臺會儲存題幹與答案於瀏覽器，實際呼叫模型時資料會傳給你選擇的 AI 服務。確認送出？'))return false;
    const id=nonce();
    const handoffKey='psd-dual-ai-handoff:'+id;
    try{root.localStorage.setItem(handoffKey,JSON.stringify({nonce:id,payload:safe,createdAt:Date.now()}));}
    catch(e){fail('無法暫存跨頁交接資料。請確認瀏覽器允許本機儲存，或改用手動複製批改指令。');}
    const popup=root.open(TARGET_URL+'#psd-bridge='+id,'_blank');
    if(!popup){root.localStorage.removeItem(handoffKey);fail('瀏覽器阻擋新視窗，請允許彈出視窗後再試');}
    active={id,popup,payload:safe,onResult,finished:false,transferred:false,pending:false};
    // Remember which record the review belongs to, so a reopened page can still write it back. While this
    // page stays open it refreshes aliveAt, so other tabs leave the write-back to it.
    if(resume&&typeof resume.scope==='string'){
      const record={nonce:id,scope:resume.scope,context:resume.context??null,title:safe.title,createdAt:Date.now()};
      const beat=()=>{if(active?.id!==id||active.finished){root.clearInterval?.(timer);return;}try{if(root.localStorage.getItem(PENDING_PREFIX+id)||!record.aliveAt){record.aliveAt=Date.now();root.localStorage.setItem(PENDING_PREFIX+id,JSON.stringify(record));}}catch{}};
      const timer=root.setInterval?.(beat,ALIVE_MS/2);
      beat();
    }
    root.setTimeout(()=>{if(active?.id===id&&!active.transferred&&root.localStorage.getItem(handoffKey)){root.localStorage.removeItem(handoffKey);clearPending(id);active=null;root.alert('雙 AI 工作臺沒有完成題目交接。請重新操作；若仍失敗，可先用「一鍵複製 AI 批改」備份。');}},60000);
    return true;
  }
  async function receiveReview(a,text){
    if(!a||!a.transferred||a.finished||a.pending||typeof text!=='string'||!text.trim()||text.length>100000)return;
    try{
      if(!root.confirm('是否將雙 AI 審查意見寫回原始練習紀錄？既有答案及舊評語會保留。'))return;
      a.pending=true;
      await a.onResult(text);
      a.finished=true;
      if(a.popup&&!a.popup.closed)a.popup.postMessage({protocol:PROTOCOL,kind:'saved',nonce:a.id},TARGET_ORIGIN);
      root.localStorage.setItem('psd-dual-ai-ack:'+a.id,JSON.stringify({nonce:a.id,ok:true,createdAt:Date.now()}));
      root.localStorage.removeItem('psd-dual-ai-return:'+a.id);
      clearPending(a.id);
    }catch(e){
      a.pending=false;
      const message=String(e?.message||e).slice(0,180);
      if(a.popup&&!a.popup.closed)a.popup.postMessage({protocol:PROTOCOL,kind:'save-error',nonce:a.id,message},TARGET_ORIGIN);
      root.localStorage.setItem('psd-dual-ai-ack:'+a.id,JSON.stringify({nonce:a.id,ok:false,message,createdAt:Date.now()}));
    }
  }
  root.addEventListener('message',async event=>{
    const a=active,d=event.data;
    if(!a||event.origin!==TARGET_ORIGIN||event.source!==a.popup||!d||d.protocol!==PROTOCOL||d.nonce!==a.id)return;
    if(d.kind==='ready'&&!a.transferred){
      a.popup.postMessage({protocol:PROTOCOL,kind:'create',nonce:a.id,payload:a.payload},TARGET_ORIGIN);
    }else if(d.kind==='created'){a.transferred=true;root.localStorage.removeItem('psd-dual-ai-handoff:'+a.id);}
    else if(d.kind==='save-error'&&!a.transferred){root.alert('雙 AI 工作臺無法建立任務：'+String(d.message||'儲存失敗').slice(0,160));active=null;}
    else if(d.kind==='return')await receiveReview(a,d.text);
  });
  // Reviews returned while the original page was closed or reloaded: offer to write them back now.
  async function recover(p,text){
    if(recovering.has(p.nonce))return;recovering.add(p.nonce);
    const cleanup=()=>{clearPending(p.nonce);try{root.localStorage.removeItem('psd-dual-ai-return:'+p.nonce);}catch{}};
    const ack=(ok,message)=>{try{root.localStorage.setItem('psd-dual-ai-ack:'+p.nonce,JSON.stringify({nonce:p.nonce,ok,...(message?{message}:{}),createdAt:Date.now()}));}catch{}};
    try{
      if(!root.confirm('「'+p.title+'」的雙 AI 審查意見已完成，但送出時的練習頁已關閉或重新整理。\n\n是否現在寫回原練習紀錄？既有答案及舊評語會保留。')){
        if(root.confirm('要捨棄這份回傳嗎？\n\n選「取消」會保留，下次開啟本頁時再詢問；工作臺中的任務不受影響，仍可匯出 MD。'))cleanup();
        return;
      }
      // Another tab may have written it back while this dialog was open.
      if(!root.localStorage.getItem(PENDING_PREFIX+p.nonce))return;
      await resumers[p.scope](p.context,text);
      ack(true);cleanup();
    }catch(e){
      const message=String(e?.message||e).slice(0,180);
      ack(false,message);cleanup();
      root.alert('雙 AI 意見未寫回：'+message);
    }finally{recovering.delete(p.nonce);}
  }
  async function checkPending(){
    let keys=[];
    try{for(let i=0;i<root.localStorage.length;i++){const k=root.localStorage.key(i);if(k&&k.startsWith(PENDING_PREFIX))keys.push(k);}}catch{return;}
    for(const key of keys){
      try{
        const p=JSON.parse(root.localStorage.getItem(key)||'null'),id=key.slice(PENDING_PREFIX.length);
        if(!p||p.nonce!==id||typeof p.createdAt!=='number'||Date.now()-p.createdAt>RETURN_MAX_AGE){clearPending(id);continue;}
        if(!resumers[p.scope]||(active&&active.id===id&&!active.finished)||Date.now()-(p.aliveAt||0)<ALIVE_MS)continue;
        const raw=root.localStorage.getItem('psd-dual-ai-return:'+id);if(!raw)continue;
        const d=JSON.parse(raw);
        if(d.nonce!==id||typeof d.text!=='string'||!d.text.trim()||d.text.length>100000)continue;
        await recover(p,d.text);
      }catch{}
    }
  }
  function resume(scope,handler){
    if(typeof scope!=='string'||typeof handler!=='function')fail('回寫設定無效');
    resumers[scope]=handler;
    root.setTimeout(checkPending,0);
  }
  root.addEventListener('storage',async event=>{
    if(event.key?.startsWith('psd-dual-ai-return:')&&event.newValue&&event.key!=='psd-dual-ai-return:'+active?.id){await checkPending();return;}
    const a=active;if(!a)return;
    if(event.key==='psd-dual-ai-handoff:'+a.id&&!event.newValue){a.transferred=true;return;}
    if(event.key!=='psd-dual-ai-return:'+a.id||!event.newValue)return;
    try{
      const d=JSON.parse(event.newValue);
      if(d.nonce!==a.id||typeof d.createdAt!=='number'||Math.abs(Date.now()-d.createdAt)>RETURN_MAX_AGE)return;
      a.transferred=true;
      await receiveReview(a,d.text);
    }catch{}
  });
  root.addEventListener('pageshow',event=>{if(event.persisted)checkPending();});
  root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.visibilityState==='visible')checkPending();});
  root.PSDDualAI={start,resume,hash};
})(window);
