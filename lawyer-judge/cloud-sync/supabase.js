/* Public publishable key only. A real user JWT is required for every data RPC. */
export function validateConfig(config) {
  if(!config || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) throw Error('請填Supabase專案網址及Publishable key；不要填管理金鑰');
  return {url:config.url,key:config.key};
}
export class SupabaseTransport {
  constructor(config,session=null,{fetcher=(...args)=>globalThis.fetch(...args),onSession=()=>{}}={}) { this.config=validateConfig(config);this.session=session;this.fetcher=fetcher;this.onSession=onSession;this.refreshing=null; }
  async request(path,body,token) {
    const response=await this.fetcher(this.config.url+path,{method:'POST',headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(!response.ok) throw Error(response.status===401?'登入已失效，請重新登入；本機草稿仍保留':response.status===429?'請求過於頻繁，稍後重試':result.msg || result.message || result.error_description || '雲端服務暫時無法使用');
    return result;
  }
  sendCode(email) { return this.request('/auth/v1/otp',{email,create_user:true}); }
  async verify(email,token) {
    const session=await this.request('/auth/v1/verify',{email,token,type:'email'});
    this.setSession(session); return session;
  }
  setSession(session) {
    if(!session?.user?.id || !session.access_token || !session.refresh_token || !Number.isFinite(session.expires_in)) throw Error('登入服務回應不符');
    const previous=this.session?.user?.id;
    if(previous && previous!==session.user.id) throw Error('帳號已改變，請先登出再登入');
    this.session={...session,expires_at:Math.floor(Date.now()/1000)+session.expires_in}; this.onSession(this.session);
  }
  async token() {
    if(!this.session?.user?.id) throw Error('請先登入');
    if(this.session.expires_at<Date.now()/1000+60) {
      this.refreshing ||= this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token}).then(s=>this.setSession(s)).finally(()=>{this.refreshing=null;});
      await this.refreshing;
    }
    return this.session.access_token;
  }
  async push(op) { return this.request('/rest/v1/rpc/psd_sync_push',{p_operation:op},await this.token()); }
  async pull(cursor) { return this.request('/rest/v1/rpc/psd_sync_pull',{p_after:cursor},await this.token()); }
  async logout() {
    // Local logout must remain possible when offline; revoke remotely when available.
    try { if(this.session) await this.request('/auth/v1/logout',{},this.session.access_token); }
    finally {this.session=null;this.onSession(null);}
  }
}
