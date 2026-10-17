/* File-URL fallback for the original juvenile-news entry. Live HTTPS keeps its Vite app. */
(function(){
'use strict';
if(location.protocol!=='file:')return;
function show(){
 const root=document.getElementById('root');
 if(!root)return;
 const dataset=window.PSDFileData?.['juvenile-news/issues.json'];
 if(!dataset||!Array.isArray(dataset.issues)){
  root.textContent='離線週報資料未載入。請確認從完整 GitHub ZIP 解壓後，沒有移走 file-data 資料夾。';return;
 }
 const create=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
 document.body.style.cssText='margin:0;background:#f5f7f2;color:#213b32;font:16px/1.8 system-ui,"Noto Sans TC","PingFang TC",sans-serif';
 root.style.cssText='max-width:980px;margin:0 auto;padding:24px';
 const header=create('header'),back=create('a','← 返回學習首頁');
 back.href='../';back.style.cssText='color:#245b48';
 const title=create('h1','少年司法週報｜完整離線原稿');title.style.fontSize='clamp(23px,4vw,32px)';
 const caution=create('p','以下為 ZIP 內附的歷史週報資料。無法離線查證即時法規、來源頁面及新進展，使用前請重新連網核對。');
 header.append(back,title,caution);
 const chooser=create('div');
 const label=create('label','選擇期數：');
 const select=create('select');
 select.style.cssText='padding:9px;border-radius:8px;border:1px solid #a9bbaa;max-width:100%;font:inherit';
 dataset.issues.forEach((issue,i)=>{const opt=create('option',(issue.date||'')+'｜'+(issue.title||'週報'));opt.value=String(i);select.append(opt)});
 chooser.append(label,select);
 const article=create('article');article.style.cssText='border:1px solid #d6e4d7;border-radius:12px;background:white;padding:22px;margin-top:16px';
 function render(){
  article.replaceChildren();
  const issue=dataset.issues[Number(select.value)||0];
  article.append(create('h2',issue.title||'少年司法週報'));
  article.append(create('p',[issue.date,issue.periodStart,issue.periodEnd].filter(Boolean).join(' · ')));
  for(const [heading,body] of [['編者說明',issue.note],['趨勢觀察',issue.trend],['原始週報 Markdown',issue.originalMarkdown]]){
   if(!body)continue;article.append(create('h3',heading));
   const p=create('div',body);p.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';article.append(p);
  }
  for(const item of (issue.items||[])){
   const section=create('section');section.style.cssText='border-top:1px solid #e3e9e5;padding-top:12px;margin-top:16px';
   section.append(create('h3',item.title||'研究／政策內容'));
   for(const field of ['summary','analysis','practicalNote','commentary','originalMarkdown']){
    if(!item[field])continue;
    const p=create('p',item[field]);p.style.whiteSpace='pre-wrap';section.append(p);
   }
   article.append(section);
  }
 }
 select.addEventListener('change',render);
 root.replaceChildren(header,chooser,article);render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();