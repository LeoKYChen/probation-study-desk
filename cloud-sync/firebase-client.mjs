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
const SDK='https://www.gstatic.com/firebasejs/12.18.0/';
let modules;
async function sdk() {
 if(!modules)modules=Promise.all([
  import(/* @vite-ignore */ SDK+'firebase-app.js'),
  import(/* @vite-ignore */ SDK+'firebase-auth.js'),
  import(/* @vite-ignore */ SDK+'firebase-firestore.js')
 ]);
 return modules;
}
export async function openFirebase(publicConfig){
 const cfg=validateFirebaseConfig(publicConfig),[apps,authLib,fs]=await sdk();
 const name='psd-'+cfg.projectId;
 const app=apps.getApps().find(a=>a.name===name)||apps.initializeApp(cfg,name);
 const auth=authLib.getAuth(app),db=fs.getFirestore(app);
 await auth.authStateReady();
 async function login(){
  await authLib.setPersistence(auth,authLib.browserLocalPersistence);
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
  if(!['modules','desk'].includes(type))throw Error('不支援的雲端資料區');
  const u=auth.currentUser;
  if(!u)throw Error('請先登入 Google 帳號');
  const base=fs.collection(db,'users',u.uid,type);
  function keyPath(key){return fs.doc(base,encodeURIComponent(key));}
  return {
   async readAll(){
    const snap=await fs.getDocsFromServer(base);
    const result=Object.create(null);
    for(const item of snap.docs){
     let key;
     try{key=decodeURIComponent(item.id)}catch{continue}
     if(Object.prototype.hasOwnProperty.call(result,key))throw Error('雲端資料鍵重複');
     result[key]=item.data();
    }
    return result;
   },
   async compareAndSet(key,raw,expected){
    const ref=keyPath(key);
    return fs.runTransaction(db,async transaction=>{
     const snap=await transaction.get(ref);
     const revision=snap.exists()?snap.data().revision:0;
     if(revision!==expected)throw Error('另一裝置已更新「'+key+'」，請重新預覽同步');
     const next=revision+1;
     transaction.set(ref,{revision:next,raw,updatedAt:fs.serverTimestamp()});
     return next;
    },{maxAttempts:2});
   }
  };
 }
 return {login,signOut,user,username,adapter,projectId:cfg.projectId};
}
