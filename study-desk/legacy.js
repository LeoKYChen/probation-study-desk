/* Explicit, read-only import. Never scans arbitrary storage or rewrites old keys. */
export async function legacyRecords(storage,origin) {
  const core=globalThis.PSDUnifiedBackup;let backup;
  if(globalThis.PSD_STUDY30_IDB_TEST===true){
    if(!globalThis.PSDLearningStorage||!globalThis.PSDStudy30MixedBackup)throw Error('缺少測試儲存服務，已停止匯入');
    const database=await globalThis.PSDLearningStorage.open();
    try{
      const managedKeys=['probation-study30-v251:v1',core.CONFLICT_KEY];
      if(globalThis.PSD_DAILY_IDB_TEST===true)managedKeys.push('probation-daily-github:records:v1','daily-reading-test:saved');
      if(globalThis.PSD_V25_IDB_TEST===true)managedKeys.push('probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2');
      if(globalThis.PSD_LECTURES_IDB_TEST===true)managedKeys.push('psd-lecture-planner-v1');
      if(globalThis.PSD_COMMON_IDB_TEST===true)managedKeys.push('psd-common-subjects-v1','psd-staresto-link-coach-v06','psd-staresto-daily-v04');
      backup=await globalThis.PSDStudy30MixedBackup.create({core,database,legacy:storage,origin,managedKeys}).collect();
    }finally{database.close();}
  }else if(globalThis.PSD_DAILY_IDB_TEST===true)throw Error('缺少完整測試儲存模式，已停止匯入');
  else backup=core.collect(storage,origin);
  const records={};
  for(const [key,raw] of Object.entries(backup.data)) {
    const value=JSON.parse(raw);
    const chunks=(key==='probation-study30-v251:v1')?Object.entries(value.sessions).map(([id,v])=>[id,v]):['probation-study-desk-v24','probation-study-desk-v3','probation-study-desk-v2','probation-daily-github:records:v1'].includes(key)?Object.entries(value):[['module',value]];
    for(const [oldId,data] of chunks) {
      const bytes=new TextEncoder().encode(JSON.stringify([origin,key,oldId,data]));
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      records['legacy/'+hash]={value:{kind:'legacy',origin,key,oldId,data},deleted:false};
    }
  }
  return records;
}

/* Only documented legacy fields are interpreted. Every raw snapshot remains intact. */
export function convertibleAttempts(snapshotId,snapshot,questions) {
 const {key,oldId,data}=snapshot,entries=[];
 if(key==='probation-study30-v251:v1'){
  for(const [id,draft] of Object.entries(data.essayDrafts||{})){
   if(!draft||typeof draft!=='object')continue;
   const answer=typeof draft.fullAnswer==='string'&&draft.fullAnswer.trim()?draft.fullAnswer:Array.isArray(draft.outline)?draft.outline.filter(x=>typeof x==='string').join('\n\n'):'';
   if(answer.trim())entries.push({id,answer,at:draft.updatedAt||data.updatedAt,mode:data.mode==='10'?'short':'full',body:data.essayCustomPrompts?.[id],feedback:typeof data.aiReviewTexts?.[id]==='string'?data.aiReviewTexts[id]:''});
  }
 }else if(['probation-study-desk-v24','probation-daily-github:records:v1'].includes(key)){
  const full=key==='probation-study-desk-v24'?data.issue:data.answer;
  const draft=data.essayDrafts&&typeof data.essayDrafts==='object'?Object.entries(data.essayDrafts).filter(([,v])=>typeof v==='string').map(([k,v])=>k+'：'+v).join('\n\n'):'';
  const answer=typeof full==='string'&&full.trim()?full:draft;
  if(answer.trim())entries.push({id:oldId,answer,at:data.updatedAt,mode:'full',feedback:typeof data.aiFeedback==='string'?data.aiFeedback:''});
 }
 return entries.map((entry,index)=>{
  const known=questions.find(q=>q.id===entry.id),at=typeof entry.at==='string'&&!Number.isNaN(Date.parse(entry.at))?entry.at:null;
  const question=known?structuredClone(known):{id:entry.id,title:'舊紀錄｜'+entry.id,subject:typeof data.subject==='string'?data.subject:'未分類',body:typeof entry.body==='string'&&entry.body.trim()?entry.body:'原題幹未能由紀錄辨識，請回原模組核對。原始快照仍保留於筆記區。',sourceLabel:'舊模組匯入，題源與題幹待本人核對'};
  const revision='legacy-original-'+index;
  const value={kind:'attempt',question,subject:question.subject,mode:entry.mode,minutes:entry.mode==='short'?10:30,answer:entry.answer,revisions:[{id:revision,text:entry.answer,at:at||'原紀錄日期不詳',kind:'imported'}],feedback:entry.feedback?[{id:'legacy-feedback-'+index,source:'舊模組匯入（來源未記載）',date:at?.slice(0,10)||'日期不詳',revision,text:entry.feedback,unverified:true}]:[],corrections:[],recalls:[],updatedAt:at||'1970-01-01T00:00:00.000Z',answeredAt:null,checkedAt:null,correctedAt:null,due:null,importedFrom:{snapshotId,origin:snapshot.origin,key,oldId,questionId:entry.id}};
  return {id:'attempt/'+snapshotId.replace('/','-')+'-'+index,value,deleted:false};
 });
}
