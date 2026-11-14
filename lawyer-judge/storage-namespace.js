/* GPL-3.0-only. 律司備考平臺｜紀錄分隔。
 *
 * 律司備考平臺放在觀護人學習平臺的 lawyer-judge/ 之下，兩邊同一個網址來源，
 * 瀏覽器的 localStorage／sessionStorage 也就是同一份。兩站有許多同名的紀錄鍵
 * （例如 probation-study-desk-v24、psd-mcq-v1），不分開的話會互相覆蓋。
 *
 * 本檔必須是每一頁第一支載入的程式。它讓律司這邊所有讀寫都落在「lj::」開頭的鍵，
 * 程式其餘部分與備份檔格式都不用改：備份檔裡仍是原本的鍵名，
 * 所以舊站（獨立網址）匯出的備份可以直接在這裡匯入。
 *
 * 處理 getItem／setItem／removeItem／key／length／clear，以及 window 上的 storage 事件：
 * 其他分頁改到律司的鍵時，事件裡的鍵名會還原成原本的名字；觀護人學習平臺的鍵則不會傳進來。
 * 律司的程式沒有用 localStorage.某鍵 這種直接屬性寫法
 * （verification/lawyer-judge-isolation.cjs 會檢查）。
 */
(function(){
  'use strict';
  var PREFIX='lj::';
  if(typeof Storage==='undefined'||window.__lsdeskStorageNamespace)return;
  var proto=Storage.prototype;
  var raw={get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key,
    length:Object.getOwnPropertyDescriptor(proto,'length').get};
  function own(store){
    var out=[],n=raw.length.call(store);
    for(var i=0;i<n;i++){var k=raw.key.call(store,i);if(k!==null&&k.indexOf(PREFIX)===0)out.push(k.slice(PREFIX.length));}
    return out;
  }
  proto.getItem=function(key){return raw.get.call(this,PREFIX+String(key));};
  proto.setItem=function(key,value){return raw.set.call(this,PREFIX+String(key),value);};
  proto.removeItem=function(key){return raw.remove.call(this,PREFIX+String(key));};
  proto.key=function(index){var keys=own(this);index=Number(index);return index>=0&&index<keys.length?keys[index]:null;};
  // clear() 只清律司自己的紀錄，不會碰觀護人學習平臺的資料。
  proto.clear=function(){var self=this;own(this).forEach(function(k){raw.remove.call(self,PREFIX+k);});};
  Object.defineProperty(proto,'length',{configurable:true,enumerable:true,get:function(){return own(this).length;}});
  // storage 事件：只轉交律司自己的鍵（去掉前綴），以及整個清空（key 為 null）的通知。
  var add=window.addEventListener,removeL=window.removeEventListener;
  var wrapped=typeof WeakMap==='function'?new WeakMap():null;
  function translate(event){
    if(event.key===null||event.key===undefined)return event;
    if(String(event.key).indexOf(PREFIX)!==0)return null;
    var key=String(event.key).slice(PREFIX.length);
    try{return new StorageEvent('storage',{key:key,oldValue:event.oldValue,newValue:event.newValue,url:event.url,storageArea:event.storageArea});}
    catch(e){return {type:'storage',key:key,oldValue:event.oldValue,newValue:event.newValue,url:event.url,storageArea:event.storageArea};}
  }
  window.addEventListener=function(type,listener,options){
    if(type!=='storage'||!listener||!wrapped)return add.call(this,type,listener,options);
    var proxy=wrapped.get(listener);
    if(!proxy){
      proxy=function(event){
        var mine=translate(event);if(!mine)return;
        return typeof listener==='function'?listener.call(this,mine):listener.handleEvent(mine);
      };
      wrapped.set(listener,proxy);
    }
    return add.call(this,type,proxy,options);
  };
  window.removeEventListener=function(type,listener,options){
    var proxy=type==='storage'&&listener&&wrapped?wrapped.get(listener):null;
    return removeL.call(this,type,proxy||listener,options);
  };
  window.__lsdeskStorageNamespace=PREFIX;
})();
