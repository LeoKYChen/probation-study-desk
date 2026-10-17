'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'.');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const hash=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,n))).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/V254_INTEGRATION_PROVENANCE.json'),'utf8'));
const layoutChanges=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/LAYOUT_REVIEW_CHANGES.json'),'utf8'));
const adjusted=new Map(layoutChanges.files.map(x=>[x.path,x]));
for(const row of layoutChanges.files){if(row.path.startsWith('professional/')&&provenance.integrated_sha256[path.basename(row.path)])assert.equal(row.base_sha256,provenance.integrated_sha256[path.basename(row.path)],'original integrated source '+row.path);assert.equal(hash(row.path),row.sha256,'reviewed layout file '+row.path);assert(row.reason,'layout change reason required');}
const expected=(name,original)=>adjusted.get('professional/'+name)?.sha256||original;
assert.equal(hash('legacy-home.html'),provenance.legacy_home_sha256,'original root page preserved byte for byte');
for(const [name,expected] of Object.entries(provenance.integrated_sha256))assert.equal(hash('professional/'+name),adjusted.get('professional/'+name)?.sha256||expected,name);
for(const file of provenance.files){
 if(!['index.html','sw.js'].includes(file.file))assert.equal(hash('professional/'+file.file),expected(file.file,file.sha256),'published v254 bytes: '+file.file);
}
const bank={};for(const name of ['source-main-questions.js','source-related-questions.js'])vm.runInNewContext(read('professional/'+name),{window:bank});
const rows=[...bank.QUESTION_BANK,...bank.RELATED_QUESTION_BANK];
assert.equal(rows.length,426);assert.equal(new Set(rows.map(q=>q.id)).size,426);
assert.equal(hash('professional/source-main-questions.js'),hash('v2.5/questions.js'));
assert.equal(hash('professional/source-related-questions.js'),hash('v2.5/related-questions.js'));
const home=read('index.html');assert.equal((home.match(/class="tile /g)||[]).length,5);
for(const target of ['./professional/','./common-subjects/','./daily-simulation/','./juvenile-news/','./legacy-home.html','./v2.5/'])assert(home.includes('href="'+target+'"'),target);
assert(home.includes('https://probation-legal-ai-test.pages.dev/'));
assert(home.includes("'psd-home-exam-countdown-v1'"));
assert(read('professional/app.js').includes("'probation-study30-v251:v1'"));
assert(!home.includes('localStorage.clear('));
const sw=read('professional/sw.js');assert(sw.includes('new URL(self.registration.scope).pathname'));
for(const name of JSON.parse(sw.match(/const ASSETS=(\[.*?\]);/)[1]))if(name!=='./')assert(fs.existsSync(path.join(root,'professional',name)),name);
console.log('PASS: original v254 source ledger retained; explicit layout deltas accounted for; 426 unique canonical questions, five entries and original storage keys retained.');
