/*
 * Firebase Auth + Firestore adapter. Loaded ONLY after the user opts in.
 * Browser ESM CDN version is pinned; no bundler, payment SDK or Admin key.
 */
export function validateFirebaseConfig(value) {
 if(!value || typeof value!=='object')throw Error('請先設定 Firebase 專案');
 const fields=['apiKey','authDomain','projectId','appId'];
 for(const key of fields)if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>300)
  throw Error('Firebase 設定缺少 '+key);
 if(!/^[a-z0-9][a-z0-9-]{2,100}$/.test(value.projectId)
  || value.authDomain!==value.projectId+'.firebaseapp.com'
  || !/^AIza[0-9A-Za-z_-]{25,}$/.test(value.apiKey)
  || !/^[0-9]+:[^:]+:web:[0-9a-f]+$/i.test(value.appId))
  throw Error('Firebase 公開設定格式不符，請從 Firebase Console 複製 Web app config');
 return Object.fromEntries(fields.map(key=>[key,value[key].trim()]));
}
// Firestore IDs must not be "." or "..", nor contain slashes.
export function encodeDocumentId(key){
 if(typeof key!=='string'||!key||key.length>400)throw Error('同步資料鍵不符');
 return 'k~'+encodeURIComponent(key);
}
export function decodeDocumentId(id){
 if(typeof id!=='string'||!id.startsWith('k~'))throw Error('雲端文件識別碼格式不符');
 try{
  const key=decodeURIComponent(id.slice(2));
  if(encodeDocumentId(key)!==id)throw Error('雲端文件識別碼不是標準編碼');
  return key;
 }catch{throw Error('雲端文件識別碼編碼不符')}
}
// An adapter is tied to the original Google uid. A second tab may sign out
// or switch accounts while Firestore reads or CAS transactions are in flight.
export function assertCurrentUser(expectedUid,currentUser){
 if(typeof expectedUid!=='string'||!expectedUid||
    !currentUser||currentUser.uid!==expectedUid)
  throw Error('Google 帳號在同步期間已變更；請重新登入並重新預覽，原有答案不會自動上傳');
}
/**
 * A Firestore adapter fixed to one authenticated UID. Exported separately so
 * the entire read and transaction path can be tested without real credentials.
 * The browser never passes a UID from user-supplied form fields.
 */
// Bound per collection so one mistaken preview cannot unexpectedly consume the
// daily free Firestore document reads on an oversized account.
export const MAX_REMOTE_PREVIEW_DOCS=1000;
export function createUserScopedAdapter(fs,db,auth,type='modules'){
 if(!['modules','desk'].includes(type))throw Error('不支援的雲端資料區');
 const uid=auth?.currentUser?.uid;
 if(!uid)throw Error('請先登入 Google 帳號');
 const base=fs.collection(db,'users',uid,type);
 function assertOwner(){assertCurrentUser(uid,auth.currentUser)}
 function keyPath(key){return fs.doc(base,encodeDocumentId(key));}
 return {
  async readAll(){
   assertOwner();
   // Read at most 1001 documents to detect overflow, without silently
   // truncating the data or proceeding to an unsafe partial merge.
   const snap=await fs.getDocsFromServer(
    fs.query(base,fs.limit(MAX_REMOTE_PREVIEW_DOCS+1))
   );
   assertOwner();
   if(snap.docs.length>MAX_REMOTE_PREVIEW_DOCS)
    throw Error('雲端學習資料超過單次預覽上限 '+MAX_REMOTE_PREVIEW_DOCS+' 筆。已停止，請保留 JSON 備份並改用分批同步方案');
   const result=Object.create(null);
   for(const item of snap.docs){
    const key=decodeDocumentId(item.id);
    if(Object.prototype.hasOwnProperty.call(result,key))throw Error('雲端資料鍵重複');
    result[key]=item.data();
   }
   return result;
  },
  async compareAndSet(key,raw,expected){
   assertOwner();
   const ref=keyPath(key);
   const next=await fs.runTransaction(db,async transaction=>{
    assertOwner();
    const snap=await transaction.get(ref);
    assertOwner();
    const revision=snap.exists()?snap.data().revision:0;
    if(revision!==expected)throw Error('另一裝置已更新「'+key+'」，請重新預覽同步');
    const incremented=revision+1;
    assertOwner();
    transaction.set(ref,{revision:incremented,raw,updatedAt:fs.serverTimestamp()});
    return incremented;
   },{maxAttempts:2});
   assertOwner();
   return next;
  }
 };
}
const SDK='https://www.gstatic.com/firebasejs/12.19.0/';
let modules;
async function sdk() {
 if(!modules)modules=Promise.all([
  import(/* @vite-ignore */ SDK+'firebase-app.js'),
  import(/* @vite-ignore */ SDK+'firebase-auth.js'),
  import(/* @vite-ignore */ SDK+'firebase-firestore.js')
 ]).catch(error=>{modules=null;throw error;}); // Network recovery must allow retry.
 return modules;
}
export async function openFirebase(publicConfig){
 const cfg=validateFirebaseConfig(publicConfig),[apps,authLib,fs]=await sdk();
 const name='psd-'+cfg.projectId;
 const app=apps.getApps().find(a=>a.name===name)||apps.initializeApp(cfg,name);
 const auth=authLib.getAuth(app),db=fs.getFirestore(app);
 await auth.authStateReady();
 // Finish persistence setup during explicit SDK preparation, never inside
 // the user's subsequent popup click handler. Delays can lose Safari's
 // short-lived user-activation grant.
 await authLib.setPersistence(auth,authLib.browserLocalPersistence);
 async function login(){
  try {await authLib.signInWithPopup(auth,new authLib.GoogleAuthProvider());}
  catch(e){
   if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment',
      'auth/cancelled-popup-request'].includes(e.code))
    throw Error('此瀏覽器阻擋 Google 登入視窗。請改用桌面瀏覽器或設定同站登入後再測試 iPhone；暫不使用可能受 Safari 限制的跨網域重新導向');
   throw e;
  }
  return auth.currentUser;
 }
 const username=()=>auth.currentUser?.email||'';
 const user=()=>auth.currentUser;
 const signOut=()=>authLib.signOut(auth);
 function adapter(type='modules'){
  return createUserScopedAdapter(fs,db,auth,type);
 }
 return {login,signOut,user,username,adapter,projectId:cfg.projectId};
}
