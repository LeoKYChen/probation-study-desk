/* Register the isolated offline preview after load. Does not change study storage or content. */
(function(){
  'use strict';
  const state={ready:false,assets:0,total:0};
  function show(message,kind){
    const el=document.getElementById('offlineStatus');
    if(!el)return;
    el.hidden=false;
    el.textContent=message;
    el.dataset.kind=kind;
    el.title='首次使用請保持連線，等待「離線資料已就緒」，再試飛航模式。練習與申論紀錄只儲存在此裝置與網址的瀏覽器資料中。';
  }
  function reflect(){
    if(!state.ready)return;
    show(navigator.onLine===false?
      '目前離線｜本機題庫已載入':
      '離線資料已就緒｜可試飛航模式','ready');
  }
  function check(worker){
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>{channel.port1.close();reject(new Error('檔案驗證逾時'));},12000);
      channel.port1.onmessage=event=>{
        clearTimeout(timer);channel.port1.close();
        resolve(event.data);
      };
      worker.postMessage({type:'OFFLINE_STATUS_CHECK'},[channel.port2]);
    });
  }
  async function register(){
    if(!('serviceWorker' in navigator)){
      show('此瀏覽器無法啟用離線模式｜請使用 Safari 或 Chrome','warning');
      return;
    }
    show('正在準備離線檔案…','loading');
    try{
      await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      const registration=await navigator.serviceWorker.ready;
      if(!registration.active)throw new Error('尚未啟動');
      const result=await check(registration.active);
      if(!result.ready)throw new Error('必要檔案不完整');
      state.ready=true;
      state.assets=result.assets;
      state.total=result.total;
      reflect();
    }catch(error){
      show('離線檔案尚未準備完成｜請連網後重新整理','warning');
      console.warn('Study30 offline preparation incomplete',error);
    }
  }
  window.addEventListener('online',reflect);
  window.addEventListener('offline',reflect);
  if(document.readyState==='complete')register();
  else window.addEventListener('load',register,{once:true});
})();