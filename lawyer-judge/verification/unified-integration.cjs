'use strict';
/* 律司版整合契約。原觀護人站的位元組出處帳本（V254_INTEGRATION_PROVENANCE）只對原站有意義，已封存於 docs/archive-probation/；
 * 這裡改為檢查改版後仍須成立的跨模組契約。 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'.');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const hash=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,n))).digest('hex');

// 題庫三份副本必須逐位元一致（由 scripts/import-questions.mjs 同時寫入）
for(const group of [['questions.js','v2.5/questions.js','professional/source-main-questions.js'],['related-questions.js','v2.5/related-questions.js','professional/source-related-questions.js']])
 for(const file of group.slice(1))assert.equal(hash(file),hash(group[0]),file+' must equal '+group[0]);
const bank={};for(const name of ['source-main-questions.js','source-related-questions.js'])vm.runInNewContext(read('professional/'+name),{window:bank});
assert(Array.isArray(bank.QUESTION_BANK)&&Array.isArray(bank.RELATED_QUESTION_BANK),'question banks must be arrays');
const rows=[...bank.QUESTION_BANK,...bank.RELATED_QUESTION_BANK];
assert.equal(new Set(rows.map(q=>q.id)).size,rows.length,'question ids must be unique');
for(const q of rows){
 assert(typeof q.id==='string'&&q.id&&typeof q.body==='string'&&q.body.trim(),'question needs id and body');
 assert(Array.isArray(q.examTypes)&&q.examTypes.length&&q.examTypes.every(x=>['律師','司法官'].includes(x)),'examTypes must be 律師/司法官: '+q.id);
}
// 首頁：六個目錄式入口（四個站內、兩個外部），其餘入口由共用導覽（assets/site-nav.js）提供
const home=read('index.html');
assert.equal((home.match(/<ul class="index-grid home-index"[\s\S]*?<\/ul>/)||[''])[0].split('<li>').length-1,6,'home index lists six entries');
assert.equal((home.match(/class="external"/g)||[]).length,2,'two external entries');
for(const target of ['./mcq/','./professional/','./common-subjects/','./daily-simulation/','./lectures/','./legacy-home.html','./v2.5/']){
 assert(home.includes('href="'+target+'"'),target);
 assert(fs.existsSync(path.join(root,target.replace(/^\.\//,'')||'.')),'home link target exists: '+target);
}
assert(home.includes('https://leokychen.github.io/multi-ai-review-desk/'));assert(home.includes('雙 AI 協作工作臺'));
assert(home.includes('https://law.moj.gov.tw/'),'law database tile');
// 內部儲存鍵不得改名（改名會讓既有備份與模組互通失效）
assert(read('assets/home.js').includes("'psd-home-exam-countdown-v1'"));
assert(read('professional/app.js').includes("'probation-study30-v251:v1'"));
assert(!home.includes('localStorage.clear('));
// 專業科目離線快取清單中的檔案都必須存在
const sw=read('professional/sw.js');assert(sw.includes('new URL(self.registration.scope).pathname'));
for(const name of JSON.parse(sw.match(/const ASSETS=(\[.*?\]);/)[1]))if(name!=='./')assert(fs.existsSync(path.join(root,'professional',name)),name);
// 書桌的離線快取清單：只要有一個檔案不存在，cache.addAll 會讓整個 Service Worker 安裝失敗（離線書桌就壞了）
{const dsw=read('study-desk/sw.js');for(const name of JSON.parse(dsw.match(/const FILES=(\[.*?\]);/)[1].replace(/'/g,'"')))if(name!=='./')assert(fs.existsSync(path.join(root,'study-desk',name)),'study-desk/sw.js 列了不存在的檔案：'+name);}
// 已移除的觀護人專屬模組不得再被引用
for(const gone of ['juvenile-news/','police-exams/','dongdong-time/','jcis-demo/','knowledge-graph-preview/'])
 for(const page of ['index.html','legacy-home.html','professional/index.html','v2.5/index.html','study-desk/index.html','print/index.html','offline/index.html'])
  assert(!read(page).includes(gone),page+' still references removed module '+gone);
console.log('PASS: identical bank copies, '+rows.length+' unique questions (律師/司法官), seven home entries, stable storage keys, no links to removed modules.');
