(function(root){'use strict';
  const PROTOCOL='psd-dual-ai-v1';
  const TARGET_URL='https://leokychen.github.io/multi-ai-review-desk/';
  const TARGET_ORIGIN='https://leokychen.github.io';
  let active=null;
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
  function start({payload,onResult}){
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
    root.setTimeout(()=>{if(active?.id===id&&!active.transferred&&root.localStorage.getItem(handoffKey)){root.localStorage.removeItem(handoffKey);active=null;root.alert('雙 AI 工作臺沒有完成題目交接。請重新操作；若仍失敗，可先用「一鍵複製 AI 批改」備份。');}},60000);
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
  root.addEventListener('storage',async event=>{
    const a=active;if(!a)return;
    if(event.key==='psd-dual-ai-handoff:'+a.id&&!event.newValue){a.transferred=true;return;}
    if(event.key!=='psd-dual-ai-return:'+a.id||!event.newValue)return;
    try{
      const d=JSON.parse(event.newValue);
      if(d.nonce!==a.id||typeof d.createdAt!=='number'||Math.abs(Date.now()-d.createdAt)>120000)return;
      a.transferred=true;
      await receiveReview(a,d.text);
    }catch{}
  });
  root.PSDDualAI={start};
})(window);
