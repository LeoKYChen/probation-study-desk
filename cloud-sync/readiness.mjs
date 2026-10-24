/* Read-only prerequisite report: never writes browser storage, loads Firebase
 * SDK, touches an account, or sends any network request. A successful report
 * does NOT mean Google popup auth or Firestore Rules have been verified.
 */
export function checkReadiness(env){
 const values=[
  {key:'secure',name:'HTTPS 安全環境',
   ok:!!env?.isSecureContext,
   detail:'Google 登入與安全儲存需要 HTTPS 或其他瀏覽器認定的安全來源'},
  {key:'storage',name:'本機學習資料可讀取',
   ok:false,detail:'無法讀取這個網站的 localStorage；請檢查隱私設定'}
 ];
 try{
  // Read only: do NOT add temporary keys or inspect any saved answers.
  const n=env.localStorage.length;
  values[1].ok=Number.isSafeInteger(n)&&n>=0;
 }catch{}
 values.push(
  {key:'indexedDB',name:'備考書桌資料庫介面',
   ok:typeof env?.indexedDB?.open==='function',
   detail:'IndexedDB 必須可用；此項只檢查介面，不開啟或修改資料庫'},
  {key:'crypto',name:'SHA-256 指紋功能',
   ok:typeof env?.crypto?.subtle?.digest==='function'&&typeof env?.TextEncoder==='function',
   detail:'用於在預覽後發現本機答案是否又有修改'},
  {key:'online',name:'目前可連線',
   ok:env?.navigator?.onLine===true,
   detail:'目前離線時可以繼續本機作答，但不能預覽雲端或登入'}
 );
 return {
  checks:values,
  ready:values.every(v=>v.ok),
  // An API check can never guarantee popup permission, remote auth or access.
  authVerified:false,
  firestoreRulesVerified:false
 };
}
