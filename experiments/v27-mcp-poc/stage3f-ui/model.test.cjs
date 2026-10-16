'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createDemoEngine, STATUS, PORTAL_URL, TICKET_LIFETIME_MS}=require('./model.js');
const A='SYNTHETIC_A',B='SYNTHETIC_B',C='SYNTHETIC_C',D='SYNTHETIC_D';
const NOW=Date.UTC(2026,9,16,2,0,0);
const rig=()=>{let ms=NOW;return {engine:createDemoEngine({now:()=>ms}),advance(n){ms+=n}}};
test('initial fixture includes exactly four synthetic cases',()=>{
  const r=rig().engine.list();assert.equal(r.length,4);assert.deepEqual(r.map(x=>x.id),[A,B,C,D]);
});
test('status definitions explicitly distinguish four source states',()=>{
  assert.deepEqual(Object.keys(STATUS),['confirmed','pending','withdrawn','unavailable']);
});
test('initial status totals equal synthetic fixtures',()=>{
  assert.deepEqual(rig().engine.summary(),{confirmed:1,pending:1,withdrawn:1,unavailable:1});
});
test('title always explicitly identifies synthetic case',()=>{
  assert.equal(rig().engine.list().every(x=>x.title.startsWith('合成案例')),true);
});
test('only enumerated demonstration topics can be searched',()=>{
  assert.throws(()=>rig().engine.list({topic:'某人身分資料'}),/Unsupported/);
});
test('only enumerated demonstration statuses can be filtered',()=>{
  assert.throws(()=>rig().engine.list({status:'effective_law'}),/Unsupported/);
});
test('topic filter returns known subset',()=>{
  assert.deepEqual(rig().engine.list({topic:'竊盜'}).map(x=>x.id),[A,D]);
});
test('status filter returns only matching case',()=>{
  assert.deepEqual(rig().engine.list({status:'withdrawn'}).map(x=>x.id),[C]);
});
test('topic and status filtering intersect',()=>{
  assert.deepEqual(rig().engine.list({topic:'竊盜',status:'confirmed'}).map(x=>x.id),[A]);
});
test('no match means empty demonstration list, not real court nonexistence',()=>{
  assert.deepEqual(rig().engine.list({topic:'詐欺',status:'withdrawn'}),[]);
});
test('pending case cannot issue link token',()=>{
  assert.equal(rig().engine.issue(B).ok,false);
});
test('withdrawn case cannot issue link token',()=>{
  assert.equal(rig().engine.issue(C).ok,false);
});
test('unavailable source cannot issue link token',()=>{
  assert.equal(rig().engine.issue(D).ok,false);
});
test('unknown identifier cannot issue a token',()=>{
  assert.equal(rig().engine.issue('TPSM,114,台抗,2605,20251231,1').ok,false);
});
test('confirmed synthetic case creates only demonstrative 60-second ticket',()=>{
  const r=rig().engine.issue(A);assert.equal(r.ok,true);assert.equal(r.ttlSeconds,60);
  assert.match(r.token,/^DEMO_ONCE_/);assert.equal(r.token.includes(A),false);
});
test('happy-path verification stays a demo, returns no individual URL',()=>{
  const e=rig().engine;const t=e.issue(A).token;const result=e.redeem(t,'still_public');
  assert.equal(result.status,'demo_reverified');assert.equal('href' in result,false);
});
test('same ticket cannot be used twice',()=>{
  const e=rig().engine;const t=e.issue(A).token;
  e.redeem(t,'still_public');assert.equal(e.redeem(t,'still_public').status,'blocked_replay');
});
test('ticket expired at exactly 60 seconds',()=>{
  const r=rig();const t=r.engine.issue(A).token;r.advance(TICKET_LIFETIME_MS);
  assert.equal(r.engine.redeem(t,'still_public').status,'blocked_expired');
});
test('ticket valid just before expiration',()=>{
  const r=rig();const t=r.engine.issue(A).token;r.advance(TICKET_LIFETIME_MS-1);
  assert.equal(r.engine.redeem(t,'still_public').status,'demo_reverified');
});
test('mock withdrawal blocks and updates synthetic status',()=>{
  const e=rig().engine;const t=e.issue(A).token;
  assert.equal(e.redeem(t,'withdrawn').status,'blocked_withdrawn');
  assert.equal(e.list().find(x=>x.id===A).status,'withdrawn');
  assert.equal(e.issue(A).ok,false);
});
test('official unavailable blocks without pretending record nonexistent',()=>{
  const e=rig().engine;const t=e.issue(A).token;
  assert.equal(e.redeem(t,'unavailable').status,'blocked_unavailable');
  assert.equal(e.list().find(x=>x.id===A).status,'unavailable');
});
test('unknown mock verification outcome fails closed',()=>{
  const e=rig().engine;const t=e.issue(A).token;
  assert.equal(e.redeem(t,'FORGED').status,'blocked_unavailable');
});
test('counter changes when mock withdrawn',()=>{
  const e=rig().engine;e.redeem(e.issue(A).token,'withdrawn');
  assert.deepEqual(e.summary(),{confirmed:0,pending:1,withdrawn:2,unavailable:1});
});
test('counter changes when official unavailable',()=>{
  const e=rig().engine;e.redeem(e.issue(A).token,'unavailable');
  assert.deepEqual(e.summary(),{confirmed:0,pending:1,withdrawn:1,unavailable:2});
});
test('reset restores fixtures and invalidates unused tickets',()=>{
  const e=rig().engine;const t=e.issue(A).token;
  e.reset();assert.equal(e.redeem(t,'still_public').status,'blocked_replay');
  assert.equal(e.list().find(x=>x.id===A).status,'confirmed');
});
test('reset restores after withdrawal too',()=>{
  const e=rig().engine;e.redeem(e.issue(A).token,'withdrawn');e.reset();
  assert.equal(e.list().find(x=>x.id===A).status,'confirmed');
});
test('model result objects and arrays cannot be mutated',()=>{
  const e=rig().engine;const rows=e.list();assert.equal(Object.isFrozen(rows),true);
  assert.equal(Object.isFrozen(rows[0]),true);assert.throws(()=>{rows[0].status='confirmed';},TypeError);
});
test('model exposes no full text, actual case URLs, or source API',()=>{
  const e=rig().engine;const s=JSON.stringify(e.list());
  for(const term of ['fullText','parties','judgment.judicial.gov.tw/FJUD/data.aspx','mcp-taiwan-legal-db'])
    assert.equal(s.includes(term),false,term);
  assert.equal(e.diagnostics().publicIndividualLinks,0);
  assert.equal(e.diagnostics().storedCourtTexts,0);
});
test('diagnostic panel does not expose tokens or case details',()=>{
  const e=rig().engine;const t=e.issue(A).token;const s=JSON.stringify(e.diagnostics());
  assert.equal(s.includes(t),false);assert.equal(s.includes(A),false);
});
test('official external link points exclusively to the general portal',()=>{
  assert.equal(PORTAL_URL,'https://judgment.judicial.gov.tw/FJUD/');
});
test('invalid fake clocks reject issuing instead of bypassing',()=>{
  const e=createDemoEngine({now:()=>Number.NaN});assert.throws(()=>e.issue(A),/Invalid demo clock/);
});
test('UI markup never includes actual case information or live API keys',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.ok(html.includes('純離線 · 模擬資料'));
  assert.equal(html.includes('data.aspx'),false);
  assert.equal(html.includes('JUDICIAL_API_USER'),false);
});
test('UI uses safe text insertion, no innerHTML, no HTTP request',()=>{
  const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
  assert.ok(app.includes('textContent'));
  for(const forbidden of ['innerHTML =','fetch(', 'localStorage','sessionStorage','XMLHttpRequest','new WebSocket'])
    assert.equal(app.includes(forbidden),false,forbidden);
});
test('CSP refuses all fetch/network API connections and frames',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('referrerpolicy="no-referrer"'));
});