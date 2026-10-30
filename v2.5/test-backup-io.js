/* Experimental UI only: use guarded IndexedDB transactions. */
(function(root){'use strict';if(root.PSD_V25_IDB_TEST!==true)return;
 const $=id=>document.getElementById(id),core=root.PSDUnifiedBackup,keys=['probation-study30-v251:v1',core.CONFLICT_KEY,'probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2','probation-daily-github:records:v1','daily-reading-test:saved'];
 if(root.PSD_LECTURES_IDB_TEST===true)keys.push('psd-lecture-planner-v1');if(root.PSD_COMMON_IDB_TEST===true)keys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
 let busy=false;
 function status(message){let el=$('backupIOStatus');if(!el){el=document.createElement('p');el.id='backupIOStatus';el.setAttribute('role','status');document.querySelector('.topbar').after(el);}el.textContent=message;}
 function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
 async function withSnapshot(fn){
  if(busy)throw Error('另一項資料操作正在執行');if(root.PSD_DAILY_IDB_TEST!==true)throw Error('每日題測試儲存未啟用，已停止操作');busy=true;let database;
  try{
   root.Practice25.flush();await root.Practice25.whenSaved();database=await root.PSDLearningStorage.open();
   const repository=await root.PSDV25Repository.open({database,legacy:localStorage,backup:root.Backup25});
   if(JSON.stringify(repository.read())!==JSON.stringify(root.Practice25.getRecords()))throw Error('考古題資料已在其他分頁更新，請重新整理後再試');
   const mixed=root.PSDStudy30MixedBackup.create({core,database,legacy:localStorage,origin:location.origin,managedKeys:keys});
   const snapshot=await mixed.snapshot();return await fn({mixed,snapshot,active:repository.read()});
  }finally{database?.close();busy=false;}
 }
 $('exportButton').addEventListener('click',e=>{e.stopImmediatePropagation();void withSnapshot(async({snapshot,active})=>{download(root.Backup25.create(active,JSON.parse(snapshot['probation-daily-github:records:v1']||'{}')),'test-v25-records.json');status('已要求下載考古題與每日題答案；收藏及分頁計時請使用各自的備份功能。');}).catch(err=>status('匯出失敗：'+err.message));},true);
 $('importFile').addEventListener('change',e=>{e.stopImmediatePropagation();void(async()=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>4*1024*1024)throw Error('檔案超過4MB');const raw=JSON.parse(await file.text());if(raw.format==='probation-daily-github-records'&&(Object.hasOwn(raw,'saved')||Object.hasOwn(raw,'timers')))throw Error('此檔含收藏或計時，請在每日模擬題頁匯入');const incoming=root.BackupIO25.normalize(raw);
 await withSnapshot(async({mixed,snapshot,active})=>{const plan=root.PSDV25Operations.importPlan({core,backup:root.Backup25,snapshot,incoming,active});download(await mixed.collect(),'test-v25-before-import.json');if(!confirm('請確認保護備份已保存並關閉其他編輯分頁。匯入時保留本機主要答案及不同版本，繼續？'))return;await mixed.apply(plan);status('匯入完成，正在重新載入；不同版本可至備份中心比較。');root.location.reload();});
 }catch(err){status('匯入未完成：'+err.message);}finally{e.target.value='';}})();},true);
 $('clearAllRecords').addEventListener('click',e=>{e.stopImmediatePropagation();void withSnapshot(async({mixed,snapshot})=>{const plan=root.PSDV25Operations.clearPlan({core,snapshot});if(!plan.count){status('目前沒有可清除的練習紀錄。');return;}download(await mixed.collect(),'test-v25-before-clear.json');if(!confirm('請確認保護備份已保存並關閉其他編輯分頁。清除考古題與每日題答案？原版本會留在衝突紀錄。'))return;await mixed.apply(plan);status('清除完成，正在重新載入。');root.location.reload();}).catch(err=>status('清除未完成：'+err.message));},true);
})(window);
