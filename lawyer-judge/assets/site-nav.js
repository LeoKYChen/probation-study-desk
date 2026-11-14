/* 全站共用導覽：今日、練習、書桌、複習、函授。
 * 用經典 script（不是 ES module），ZIP 直開（file://）也能用。路徑由本檔自己的網址推出，不寫死。
 * 各頁原本的簡易頁首（只有品牌與回首頁連結）會被隱藏，頁面內的功能按鈕不受影響。 */
(function(){
  'use strict';
  var script=document.currentScript;
  if(!script||document.querySelector('.site-nav'))return;
  var root=new URL('../',script.src).href; // 站台根目錄
  var path=location.href.slice(root.length).split(/[?#]/)[0];
  var seg=path.split('/')[0].replace(/\.html$/,'');
  var AREA={'':'today','index':'today','professional':'practice','v2.5':'practice','mcq':'practice','daily-simulation':'practice','active-recall':'practice','common-subjects':'practice','practice':'practice','study-desk':'desk','review':'review','official':'review','outline':'practice','lectures':'lectures'};
  var current=AREA[seg]||'';
  var ITEMS=[['today','今日',''],['practice','練習','practice/'],['desk','書桌','study-desk/'],['review','複習','review/'],['lectures','函授','lectures/']];
  function el(tag,attrs,text){var e=document.createElement(tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(text!=null)e.textContent=text;return e;}
  function build(){
    var header=el('header',{'class':'site-nav'});
    var inner=el('div',{'class':'site-nav-inner'});
    var brand=el('a',{'class':'site-nav-brand',href:root});
    brand.appendChild(el('span',{'class':'site-nav-mark','aria-hidden':'true'},'律'));
    brand.appendChild(el('b',{},'律司備考'));
    inner.appendChild(brand);
    var nav=el('nav',{'class':'site-nav-links','aria-label':'主要導覽'});
    ITEMS.forEach(function(it){
      var a=el('a',{href:root+it[2]},it[1]);
      if(it[0]===current)a.setAttribute('aria-current','page');
      nav.appendChild(a);
    });
    inner.appendChild(nav);
    var tools=el('div',{'class':'site-nav-tools'});
    tools.appendChild(el('span',{'class':'site-nav-saved',title:'學習紀錄存在這個瀏覽器，不會上傳'},'本機保存 ●'));
    var backup=el('a',{'class':'site-nav-backup',href:root+'backup/'},'備份');
    if(seg==='backup')backup.setAttribute('aria-current','page');
    tools.appendChild(backup);
    // 放在觀護人學習平臺的 lawyer-judge/ 之下時，提供回到申論評分參考的連結；獨立部署或 ZIP 直開時不顯示。
    if(location.protocol!=='file:'&&/\/lawyer-judge\/$/.test(new URL(root).pathname)){
      tools.appendChild(el('a',{'class':'site-nav-backup site-nav-host',href:root+'../law-scoring/'},'觀護人'));
      header.classList.add('site-nav-hosted');
    }
    inner.appendChild(tools);
    header.appendChild(inner);
    return header;
  }
  function init(){
    var body=document.body;
    body.classList.add('has-site-nav');
    var skip=body.querySelector('a.skip');
    var h=build();
    if(skip&&skip.nextSibling)body.insertBefore(h,skip.nextSibling);else body.insertBefore(h,body.firstChild);
  }
  if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
