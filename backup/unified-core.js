/* Unified manual backup: browser-only, no API, no network.
   Records are kept at their existing localStorage keys and never normalized
   without explicit import. Conflicting records are saved as alternate versions. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.PSDUnifiedBackup=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const FORMAT='psd-unified-learning-backup',SCHEMA=1,CONFLICT_KEY='psd-unified-backup-conflicts-v1';
 const MAX_FILE=20*1024*1024,MAX_ITEMS=5000,MAX_CONFLICTS=3500;
 const modules=[
  {key:'psd-ai-custom-rules-v1',name:'自訂AI批改提示詞',kind:'prompts'},
  {key:'probation-study30-v251:v1',name:'專業科目每日30分鐘',kind:'sessions'},
  {key:'probation-study-desk-v24',name:'考古題學習紀錄',kind:'records'},
  {key:'probation-study-desk-v3',name:'考古題練習臺（v2.5）',kind:'records'},
  {key:'probation-study-desk-v2',name:'舊版考古題 v2',kind:'records'},
  {key:'probation-daily-github:records:v1',name:'每日模擬題',kind:'records'},
  {key:'daily-reading-test:saved',name:'每日模擬題收藏',kind:'list'},
  {key:'psd-common-subjects-v1',name:'國文作文與原創英文',kind:'common'},
  {key:'psd-staresto-link-coach-v06',name:'英文 v0.6',kind:'english'},
  {key:'psd-staresto-daily-v04',name:'歷史英文 v0.4',kind:'oldenglish'},
  {key:'jj-bookmarks',name:'少年司法週報收藏',kind:'list'},
  {key:'jj-read',name:'少年司法週報已讀',kind:'list'},
  {key:'jj-font',name:'少年司法週報字級',kind:'font'},
  {key:'psd-home-exam-countdown-v1',name:'考試倒數設定',kind:'setting'},
  {key:'psd-lecture-planner-v1',name:'函授課程及排程',kind:'lectures'}
 ];
 const names=Object.fromEntries(modules.map(x=>[x.key,x]));
 const allowed=new Set([...modules.map(x=>x.key),CONFLICT_KEY]);
 const bad=new Set(['__proto__','prototype','constructor']);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function safe(x,depth=0){if(depth>45)return false;if(x===null||typeof x==='boolean'||typeof x==='string')return true;
  if(typeof x==='number')return Number.isFinite(x);
  if(Array.isArray(x))return x.length<=MAX_ITEMS&&x.every(v=>safe(v,depth+1));
  if(!isObj(x)||Object.keys(x).length>MAX_ITEMS)return false;
  return Object.entries(x).every(([k,v])=>!bad.has(k)&&k.length<260&&safe(v,depth+1));
 }
 function assert(x,message){if(!x)throw Error(message)}
 function parseValue(key,raw){
  const type=names[key]?.kind||'conflicts';
  let parsed;
  try{parsed=JSON.parse(raw)}catch{throw Error('「'+(names[key]?.name||'衝突版本')+'」的 JSON 無法讀取');}
  assert(safe(parsed),'「'+(names[key]?.name||'衝突版本')+'」存在不安全的資料');
  if(type==='prompts'){
   assert(isObj(parsed)&&parsed.format==='probation-ai-prompt-settings'&&parsed.schemaVersion===1&&Array.isArray(parsed.entries)&&parsed.entries.length<=80,'自訂提示詞格式不符');
   const ids=new Set();
   for(const entry of parsed.entries){
    assert(isObj(entry)&&['full','direction'].includes(entry.mode)&&typeof entry.subject==='string'&&entry.subject.length<=80&&typeof entry.text==='string'&&entry.text.trim().length>0&&entry.text.length<=6000,'自訂提示詞內容不符');
    const id=entry.mode+'::'+entry.subject;assert(!ids.has(id),'自訂提示詞範圍重複');ids.add(id);
   }
  }
  if(type==='records')assert(isObj(parsed),'題目紀錄必須為物件');
  if(type==='sessions')assert(isObj(parsed)&&parsed.version===1&&isObj(parsed.sessions),'專業科目紀錄格式不符');
  if(type==='common')assert(isObj(parsed)&&parsed.schema===key&&isObj(parsed.drafts)&&isObj(parsed.english),'作文紀錄格式不符');
  if(type==='english')assert(isObj(parsed)&&parsed.schema===key&&['days','completed','excluded','wordDays','wordProgress','customWords'].every(k=>parsed[k]===undefined||isObj(parsed[k])),'英文 v0.6 格式不符');
  if(type==='oldenglish')assert(isObj(parsed)&&parsed.schema==='psd-staresto-v04'&&isObj(parsed.days)&&isObj(parsed.progress)&&isObj(parsed.cards),'舊英文格式不符');
  if(type==='list')assert(Array.isArray(parsed)&&parsed.every(x=>typeof x==='string'&&x.length<300),'收藏或已讀清單格式不符');
  if(type==='font')assert(typeof parsed==='number'&&parsed>=10&&parsed<=40,'閱讀字級超出範圍');
  if(type==='setting')assert(isObj(parsed)&&(!own(parsed,'date')||typeof parsed.date==='string'),'考試倒數設定格式不符');
  if(type==='lectures'){
   assert(isObj(parsed)&&parsed.schema===1&&isObj(parsed.settings)&&Array.isArray(parsed.courses)&&Array.isArray(parsed.lessons)&&parsed.courses.length<=300&&parsed.lessons.length<=5000,'函授管理資料格式不符');
   const cids=new Set(),lids=new Set();
   for(const course of parsed.courses){assert(isObj(course)&&typeof course.id==='string'&&typeof course.name==='string'&&typeof course.subject==='string'&&!cids.has(course.id),'函授課程內容不正確');cids.add(course.id);}
   for(const lesson of parsed.lessons){assert(isObj(lesson)&&typeof lesson.id==='string'&&typeof lesson.courseId==='string'&&cids.has(lesson.courseId)&&!lids.has(lesson.id)&&Number.isInteger(lesson.durationMinutes)&&lesson.durationMinutes>0&&lesson.durationMinutes<=1440&&Number.isInteger(lesson.watchedMinutes)&&lesson.watchedMinutes>=0&&lesson.watchedMinutes<=lesson.durationMinutes,'函授堂次內容不正確');lids.add(lesson.id);}
  }
  if(type==='conflicts')assert(isObj(parsed)&&parsed.schema===CONFLICT_KEY&&Array.isArray(parsed.entries)&&parsed.entries.length<=MAX_CONFLICTS,'衝突版本保存格式不符');
  return parsed;
 }
 function storageSnapshot(storage){
  const data=Object.create(null);
  for(const key of allowed){const raw=storage.getItem(key);if(raw!==null)data[key]=raw;}
  return data;
 }
 function collect(storage,origin){
  const data=storageSnapshot(storage);
  const packageData={format:FORMAT,schemaVersion:SCHEMA,exportedAt:new Date().toISOString(),
   sourceOrigin:String(origin||''),data};
  for(const [key,value] of Object.entries(data)){if(key===CONFLICT_KEY)parseValue(key,value);else parseValue(key,value);}
  assert(JSON.stringify(packageData).length<=MAX_FILE,'完整備份超過20MB，請先分模組另行備份');
  return packageData;
 }
 function validate(bundle){
  assert(isObj(bundle)&&bundle.format===FORMAT&&bundle.schemaVersion===SCHEMA&&isObj(bundle.data),'請選擇「完整學習紀錄」JSON備份');
  assert(typeof bundle.exportedAt==='string'&&typeof bundle.sourceOrigin==='string','缺少備份日期或來源');
  assert(Object.keys(bundle.data).length<=allowed.size,'備份包含過多模組');
  for(const [k,v] of Object.entries(bundle.data)){
   assert(allowed.has(k),'備份包含未支援的儲存項目');
   assert(typeof v==='string'&&v.length<=MAX_FILE,'備份包含異常的資料');
   parseValue(k,v);
  }
  assert(JSON.stringify(bundle).length<=MAX_FILE,'完整備份超過20MB');
  return bundle;
 }
 function count(key,value){
  const type=names[key]?.kind;
  if(type==='sessions')return Object.keys(value.sessions).length;
  if(type==='common')return Object.keys(value.drafts).length;
  if(type==='english')return Object.keys(value.completed||{}).length+Object.keys(value.wordProgress||{}).length;
  if(type==='oldenglish')return Object.keys(value.progress).length;
  if(type==='list')return value.length;
  if(type==='records')return Object.keys(value).length;
  if(type==='lectures')return value.lessons.length;
  return 1;
 }
 function plan(current,bundle){
  validate(bundle);
  assert(isObj(current),'本機狀態不可讀');
  const changes=Object.create(null),stats=[],newConflicts=[];
  const beforeArchive=current[CONFLICT_KEY]?parseValue(CONFLICT_KEY,current[CONFLICT_KEY]):{schema:CONFLICT_KEY,entries:[]};
  const fromArchive=bundle.data[CONFLICT_KEY]?parseValue(CONFLICT_KEY,bundle.data[CONFLICT_KEY]):{schema:CONFLICT_KEY,entries:[]};
  const archive=copy(beforeArchive),seen=new Set(archive.entries.map(x=>JSON.stringify(x)));
  for(const row of fromArchive.entries)if(!seen.has(JSON.stringify(row))){archive.entries.push(copy(row));seen.add(JSON.stringify(row));}
  function conflict(key,path,mine,other){
   const record={key,path,existing:copy(mine),incoming:copy(other)};
   const encoded=JSON.stringify(record);
   // Do not create duplicate versions on repeated imports.
   if(!seen.has(encoded)){archive.entries.push(record);seen.add(encoded);newConflicts.push(record);}
  }
  function mapMerge(key,path,a,b){
   const output=copy(a);
   for(const [id,remote] of Object.entries(b)){
    if(!own(output,id)){output[id]=copy(remote);continue;}
    if(!equal(output[id],remote))conflict(key,path.concat(id),output[id],remote);
   }
   return output;
  }
  function mergeRecord(key,local,remote,kind){
   if(kind==='prompts'){
    const out=copy(local),have=new Map(out.entries.map(x=>[x.mode+'::'+x.subject,x]));
    for(const entry of remote.entries){
     const id=entry.mode+'::'+entry.subject;
     if(!have.has(id)){out.entries.push(copy(entry));have.set(id,entry);}
     else if(!equal(have.get(id),entry))conflict(key,['entries',id],have.get(id),entry);
    }
    assert(out.entries.length<=80,'合併後提示詞設定超過上限');return out;
   }
   if(kind==='font'||kind==='setting'){
    if(!equal(local,remote))conflict(key,[],local,remote);
    return local;
   }
   if(kind==='list')return [...new Set([...local,...remote])];
   if(kind==='lectures'){
    const out=copy(local);
    for(const section of ['courses','lessons']){
     const have=new Map(out[section].map(x=>[x.id,x]));
     for(const row of remote[section]){
      if(!have.has(row.id)){out[section].push(copy(row));have.set(row.id,row);}
      else if(!equal(have.get(row.id),row))conflict(key,[section,row.id],have.get(row.id),row);
     }
    }
    if(!equal(out.settings,remote.settings))conflict(key,['settings'],out.settings,remote.settings);
    if(!out.plan&&remote.plan)out.plan=copy(remote.plan);
    else if(remote.plan&&!equal(out.plan,remote.plan))conflict(key,['plan'],out.plan,remote.plan);
    return out;
   }
   if(kind==='records')return mapMerge(key,[],local,remote);
   if(kind==='sessions')return {...copy(local),sessions:mapMerge(key,['sessions'],local.sessions,remote.sessions)};
   if(kind==='common'||kind==='english'||kind==='oldenglish'){
    const out=copy(local);
    const sections=kind==='common'?['drafts','english','englishHistory','dailySelections','externalPractice']:
       kind==='english'?['days','completed','excluded','wordDays','wordProgress','customWords']:
       ['days','progress','cards','completedDays'];
    for(const section of sections)if(own(remote,section)){
     if(!own(out,section)){out[section]=copy(remote[section]);continue;}
     if(!isObj(out[section])||!isObj(remote[section])){if(!equal(out[section],remote[section]))conflict(key,[section],out[section],remote[section]);continue;}
     out[section]=mapMerge(key,[section],out[section],remote[section]);
    }
    for(const [p,v] of Object.entries(remote)){
     if(sections.includes(p))continue;
     if(!own(out,p))out[p]=copy(v);
     else if(!equal(out[p],v))conflict(key,[p],out[p],v);
    }
    return out;
   }
   throw Error('未支援的模組類型');
  }
  for(const row of modules){
   const key=row.key,hasInput=own(bundle.data,key),hasLocal=own(current,key);
   if(!hasInput){stats.push({key,name:row.name,status:'not-in-backup',added:0,conflicts:0});continue;}
   const imported=parseValue(key,bundle.data[key]);
   if(!hasLocal){changes[key]=bundle.data[key];stats.push({key,name:row.name,status:'new',added:count(key,imported),conflicts:0});continue;}
   const local=parseValue(key,current[key]);
   const countBefore=newConflicts.length;
   const mixed=mergeRecord(key,local,imported,row.kind);
   const added=Math.max(0,count(key,mixed)-count(key,local));
   const raw=JSON.stringify(mixed);
   if(raw!==current[key]&&!equal(mixed,local))changes[key]=raw;
   stats.push({key,name:row.name,status:added||newConflicts.length>countBefore?'merge':'unchanged',added,conflicts:newConflicts.length-countBefore});
  }
  assert(archive.entries.length<=MAX_CONFLICTS,'衝突版本數量超過上限，請先分開備份');
  if(archive.entries.length&&JSON.stringify(archive)!==current[CONFLICT_KEY])changes[CONFLICT_KEY]=JSON.stringify(archive);
  assert(Object.values(changes).reduce((n,x)=>n+x.length,0)<=MAX_FILE,'匯入資料量過大，請分模組還原');
  return {changes,stats,conflicts:newConflicts,archiveCount:archive.entries.length,baseline:copy(current)};
 }
 function apply(storage,action){
  assert(isObj(action)&&isObj(action.changes)&&isObj(action.baseline),'無效的匯入計畫');
  // A second open tab may have edited an answer after preview.
  const now=storageSnapshot(storage);
  for(const key of allowed)assert(now[key]===action.baseline[key],'資料在預覽後已有更新；請重新載入再操作');
  const done=[];
  try{
   for(const [key,raw] of Object.entries(action.changes)){
    assert(allowed.has(key)&&typeof raw==='string','非支援的儲存項目');
    parseValue(key,raw);
    done.push(key);storage.setItem(key,raw);
    assert(storage.getItem(key)===raw,'瀏覽器沒有保存成功');
   }
  }catch(error){
   let rolledBack=true;
   for(const key of done.reverse()){
    try{if(own(action.baseline,key))storage.setItem(key,action.baseline[key]);else storage.removeItem(key);}
    catch{rolledBack=false;}
   }
   throw Error((rolledBack?'已嘗試恢復匯入前狀態。':'部分資料可能未能恢復，請保留匯入前備份。')+' 原因：'+error.message);
  }
  return done.length;
 }

 // Clearing learning progress is deliberately distinct from a full site reset.
 const clearKinds=new Set(['sessions','records','common','english','oldenglish','list','lectures']);
 function previewClear(storage){
  const baseline=storageSnapshot(storage),changes=Object.create(null),items=[];
  for(const row of modules){
   if(!clearKinds.has(row.kind)||!own(baseline,row.key))continue;
   const value=parseValue(row.key,baseline[row.key]);
   let next=null;
   if(row.kind==='lectures'){
    if(!value.lessons.some(lesson=>lesson.watchedMinutes>0)&&!value.plan)continue;
    const v=copy(value);
    v.lessons=v.lessons.map(lesson=>({...lesson,watchedMinutes:0}));
    v.plan=null;
    next=JSON.stringify(v);
   }else if(row.kind==='common'){
    const v=copy(value);
    for(const section of ['drafts','english','englishHistory','dailySelections','externalPractice'])
     if(own(v,section))v[section]={};
    next=JSON.stringify(v);
   }else if(row.kind==='english'){
    const v=copy(value);
    for(const section of ['days','completed','wordDays','wordProgress'])
     if(own(v,section))v[section]={};
    next=JSON.stringify(v);
   }else if(row.kind==='oldenglish'){
    const v=copy(value);
    for(const section of ['days','progress','completedDays'])
     if(own(v,section))v[section]={};
    next=JSON.stringify(v);
   }
   if(next===baseline[row.key])continue;
   if(next!==null)parseValue(row.key,next);
   changes[row.key]=next;
   items.push({key:row.key,name:row.name,kind:row.kind});
  }
  if(own(baseline,CONFLICT_KEY)){
   parseValue(CONFLICT_KEY,baseline[CONFLICT_KEY]);
   changes[CONFLICT_KEY]=null;
   items.push({key:CONFLICT_KEY,name:'不同答案衝突版本',kind:'conflicts'});
  }
  return {baseline,changes,items};
 }
 function applyClear(storage,action){
  assert(isObj(action)&&isObj(action.changes)&&isObj(action.baseline),'清除計畫格式不符');
  const now=storageSnapshot(storage);
  for(const key of allowed)
   assert(now[key]===action.baseline[key],'清除前資料已變更，請重新檢查後再操作');
  const permitted=new Set(modules.filter(m=>clearKinds.has(m.kind)).map(m=>m.key));
  permitted.add(CONFLICT_KEY);
  const changed=[];
  try{
   for(const [key,raw] of Object.entries(action.changes)){
    assert(permitted.has(key)&&own(action.baseline,key),'清除範圍含不支援的項目');
    if(raw!==null){assert(typeof raw==='string','清除計畫格式不符');parseValue(key,raw);}
    changed.push(key);
    if(raw===null)storage.removeItem(key);
    else storage.setItem(key,raw);
    assert(storage.getItem(key)===raw,'瀏覽器未能完成清除');
   }
  }catch(e){
   let rolledBack=true;
   for(const key of changed.reverse()){
    try{storage.setItem(key,action.baseline[key]);}
    catch{rolledBack=false;}
   }
   throw Error((rolledBack?'已嘗試恢復清除前紀錄。':'部分資料可能無法恢復，請使用清除前備份。')+' 原因：'+e.message);
  }
  return changed.length;
 }
 return {FORMAT,SCHEMA,CONFLICT_KEY,modules,collect,validate,storageSnapshot,parseValue,plan,apply,previewClear,applyClear};
});
