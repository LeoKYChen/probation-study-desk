/* file:// ZIP compatibility; never run on HTTPS or change saved records. */
(function(){
'use strict';
if(location.protocol!=='file:')return;
const nativeFetch=window.fetch.bind(window),data=Object.create(null);
window.PSDFileData=data;
window.PSDRegisterFileData=function(items){
 if(!items||typeof items!=='object')throw Error('Offline dataset missing');
 for(const [key,value] of Object.entries(items)){
  if(!/^[a-zA-Z0-9_.\/-]+\.json$/.test(key)||key.includes('..'))throw Error('Unexpected offline dataset key: '+key);
  data[key]=value;
 }
};
window.fetch=function(input,options){
 let url;
 try{url=new URL(typeof input==='string'?input:input.url,location.href);}
 catch(e){return Promise.reject(e);}
 if(url.protocol==='file:'){
  const found=Object.keys(data).find(key=>url.pathname.endsWith('/'+key));
  if(found)return Promise.resolve(new Response(JSON.stringify(data[found]),{status:200,headers:{'content-type':'application/json; charset=utf-8'}}));
  return Promise.reject(new TypeError('此項資料尚未支援 ZIP 離線載入：'+url.pathname));
 }
 return Promise.reject(new TypeError('目前為完全離線 ZIP，已阻止網路要求：'+url.href));
};
// Browsers do not necessarily resolve file:// directory paths to index.html.
document.addEventListener('click',function(ev){
 const link=ev.target.closest?.('a[href]');
 if(!link||ev.defaultPrevented||ev.button!==0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey||link.hasAttribute('download'))return;
 let u;
 try{u=new URL(link.href,location.href);}catch{return;}
 if(u.protocol==='http:'||u.protocol==='https:'){
  ev.preventDefault();
  window.alert('此處是 ZIP 完全離線模式。雲端 AI、來源連結與即時更新必須連網，請在線上正式網站開啟。');
  return;
 }
 if(u.protocol!=='file:')return;
 if(u.pathname.endsWith('/')){ev.preventDefault();u.pathname+='index.html';location.assign(u.href);}
},true);
// Do not trust long-term file:// localStorage across browsers, even if writes succeed.
function warn(){
 if(document.getElementById('psd-file-warning'))return;
 const p=document.createElement('aside');
 p.id='psd-file-warning';p.setAttribute('role','status');
 p.style.cssText='position:relative;z-index:1000;background:#fff0cc;color:#423212;border-bottom:2px solid #bc9141;padding:10px 16px;font:14px/1.6 system-ui,sans-serif;text-align:center';
 p.textContent='ZIP 直開離線模式：瀏覽器可能清除 file:// 本機紀錄。請定期使用「學習紀錄備份」下載 JSON；雲端 AI、外部連結及即時更新無法離線運作。';
 document.body.prepend(p);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warn,{once:true});else warn();
})();
