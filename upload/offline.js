/* GPL-3.0-only. Shared mobile/desktop offline controls. */
(()=>{
  'use strict';
  const script=document.currentScript;
  if(!script||window.top!==window.self)return;
  const base=new URL('./',script.src);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='offline-entry';trigger.textContent='離線使用';
  (document.querySelector('.study-header nav')||document.querySelector('header nav')||document.body).append(trigger);
  const dialog=document.createElement('dialog');dialog.id='offline-dialog';dialog.setAttribute('aria-labelledby','offline-title');
  dialog.innerHTML=`<div class="offline-heading"><h2 id="offline-title">手機／電腦離線使用</h2><button type="button" data-close aria-label="關閉離線設定">×</button></div>
  <p data-status role="status" aria-live="polite">正在檢查離線資料…</p><progress hidden aria-label="下載進度"></progress>
  <p class="offline-detail">包含考古題、內建評分、342 題專題、主動回憶、晚間學習室及少年司法週報。外部連結與雲端 AI 需要網路。</p>
  <div class="offline-actions"><button type="button" data-download disabled>下載離線資料</button><button type="button" data-reload hidden>重新開啟更新內容</button><button type="button" data-install hidden>安裝到主畫面</button></div>
  <h3>iPhone 安裝步驟</h3><ol><li>用 Safari 開啟本站。</li><li>分享 →「加入主畫面」。若有「作為網頁 App 開啟」，請開啟。</li><li>從主畫面圖示開啟，按「下載離線資料」，等候完成。</li><li>開飛航模式，關閉再開啟圖示，確認能看題與作答。</li></ol>
  <p class="offline-detail">下載時保持此頁開啟。離線內容以最後完整下載為準；連線後可按「更新離線資料」，完成後重新開啟。離線模式的「更新題庫」只讀取已下載版本。</p>
  <p class="offline-detail">作答留在本裝置，不會跨裝置自動同步。請定期使用各練習區的匯出功能備份。清除網站資料可能移除作答與離線檔案。</p>`;
  document.body.append(dialog);
  const status=dialog.querySelector('[data-status]'),button=dialog.querySelector('[data-download]'),progress=dialog.querySelector('progress'),reload=dialog.querySelector('[data-reload]');
  let registration,snapshot=null,busy=false,installPrompt;
  function show(){trigger.textContent=snapshot?'離線已備妥':'離線使用';button.textContent=snapshot?'更新離線資料':'下載離線資料';status.textContent=snapshot?`已備妥 ${snapshot.count} 份檔案（${(snapshot.bytes/1048576).toFixed(1)} MB）。完整下載：${new Date(snapshot.downloadedAt).toLocaleString('zh-TW')}。${navigator.onLine?'目前可連線。':'目前離線，可使用已下載內容。'}`:'尚未完成離線下載，請先連線下載資料。';}
  function request(type,onProgress){return new Promise((resolve,reject)=>{
    const worker=registration?.active;if(!worker){reject(Error('離線功能尚未啟動，請重新整理後再試。'));return;}
    const channel=new MessageChannel();let timer;
    const close=()=>{clearTimeout(timer);channel.port1.close();};
    const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{close();reject(Error('下載中斷或逾時，請保持頁面開啟後重新下載。'));},60000);};
    channel.port1.onmessage=({data})=>{reset();if(data.type==='progress')onProgress?.(data);else{close();if(data.type==='error')reject(Error(data.message));else resolve(data.state);}};
    reset();worker.postMessage({type},[channel.port2]);
  });}
  trigger.onclick=async()=>{if(typeof dialog.showModal!=='function'){alert('請使用新版 Safari 或 Chrome。');return;}dialog.showModal();if(registration&&!busy){try{snapshot=await request('status');show();}catch(e){status.textContent=e.message;}}};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>trigger.focus());
  button.onclick=async()=>{
    if(busy)return;if(!navigator.onLine){status.textContent='目前離線，請連線後再下載或更新。';return;}
    busy=true;button.disabled=true;progress.hidden=false;reload.hidden=true;
    try{await navigator.storage?.persist?.().catch(()=>false);snapshot=await request('download',({completed,total})=>{progress.max=total;progress.value=completed;status.textContent=`下載中 ${completed} / ${total}，請保持此頁開啟…`;});show();reload.hidden=false;}
    catch(e){status.textContent=e.message+(snapshot?' 上一份完整離線資料仍保留。':' 尚未備妥離線使用。');}
    finally{busy=false;button.disabled=false;progress.hidden=true;}
  };
  reload.onclick=()=>location.reload();
  const install=dialog.querySelector('[data-install]');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;install.hidden=false;});
  install.onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;install.hidden=true;}};
  window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null;});
  for(const event of ['online','offline'])window.addEventListener(event,()=>{if(!busy&&registration)show();});
  if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='此瀏覽器無法啟用離線功能，請用 Safari 或 Chrome 開啟本站 HTTPS 網址。';return;}
  (async()=>{try{registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});registration=await navigator.serviceWorker.ready;snapshot=await request('status');show();button.disabled=false;}catch{status.textContent='離線功能未啟動。請連線後重新整理，確認未封鎖網站儲存空間。';}})();
})();
