/* Isolated test cases; the 132 legacy questions are treated as read-only data. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('integrations/apps-script/daily-quality-gate.gs','utf8');
const ctx={};
vm.runInNewContext(source,ctx,{filename:'daily-quality-gate.gs',timeout:4000});
const G=ctx.DailyQuestionQualityGate;
assert(G&&typeof G.inspect==='function');
const initial=JSON.parse(fs.readFileSync('daily-simulation/questions.json','utf8'));
const pristine=JSON.stringify(initial);
const p=s=>JSON.parse(JSON.stringify(s));
function newItem(id='qa-new-criminology-20261019'){
 return {
  id:id,date:'2026-10-19',subject:'犯罪學',
  question:'申論題（25 分）。16 歲少年甲因父母長期衝突、學校缺席及同儕鼓勵，曾參與數次竊盜。法院調查發現，少年甲仍願返校，但認為同儕肯定很重要。請以差別接觸理論及社會控制理論比較本案偏差行為的可能成因，並提出能由少年保護官執行的非機構式處遇方案，說明理論適用的限制。請結合具體事實，不得將相關性當成必然因果。',
  issues:'差別接觸理論之學習機制；社會控制理論之依附與承諾；個案事實涵攝與處遇建議。',
  outline:'一、界定理論不同問題意識。二、連結親職、同儕及就學事實。三、提出分階段介入與成效評估。四、說明理論限制。',
  theoryTable:[
    ['理論／方法','理論／方法說明','核心概念','少年個案應用'],
    ['差別接觸理論','在不同親密關係的互動中學習守法與違法的定義，但並不意味接觸必然導致犯罪。','頻率、持久性、優先性、強度','調查甲與同儕間的互動並連結正向支持']
  ],
  sourceReference:'原創模擬題；考古題出處待核對',reviewStatus:'待核對',warnings:[]
 };
}
const test=(label,f)=>{f();console.log('PASS '+label)};
test('original 132 legacy questions not forced through new-item rules',()=>{
 assert.equal(initial.count,132);
 assert.equal(G.inspect(initial,[newItem()]).canPublish,true);
});
test('valid new question appended without touching any of 132 legacy records',()=>{
 const good=G.inspect(initial,[newItem()],{updatedAt:'2026-10-18T12:00:00.000Z'});
 assert.equal(good.canPublish,true);
 assert.equal(good.ready.length,1);
 assert.equal(good.proposedDataset.count,133);
 assert.equal(good.proposedDataset.questions.at(-1).id,'qa-new-criminology-20261019');
 assert.deepEqual(good.proposedDataset.questions.slice(0,132),initial.questions);
 assert.equal(good.proposedDataset.updatedAt,'2026-10-18T12:00:00.000Z');
});
test('unchanged replay remains idempotent',()=>{
 const good=G.inspect(initial,[p(initial.questions[12])]);
 assert.equal(good.canPublish,true);
 assert.equal(good.unchanged.length,1);
 assert.equal(good.proposedDataset.count,132);
});
test('same ID changed content fails without proposed publication',()=>{
 const changed=p(initial.questions[12]);changed.question+='這是惡意覆寫';
 const result=G.inspect(initial,[changed]);
 assert.equal(result.canPublish,false);
 assert(result.blocked.some(x=>x.code==='EXISTING_ID_CONFLICT'));
 assert.equal(result.proposedDataset,null);
});
test('subject contains line break or imported source is blocked',()=>{
 const s=newItem();s.subject+='\n原試題出處：原創';
 const result=G.inspect(initial,[s]);
 assert.equal(result.canPublish,false);
 assert(result.blocked.some(x=>x.reason.includes('科目非固定')));
});
test('wrong weekday subject is blocked',()=>{
 const s=newItem();s.subject='心理學';
 assert(G.inspect(initial,[s]).blocked.some(x=>x.reason.includes('固定輪替')));
});
test('editorial instruction leakage blocked',()=>{
 const s=newItem();s.question='將其深化為一題：'+s.question;
 assert(G.inspect(initial,[s]).blocked.some(x=>x.reason.includes('編輯')));
});
test('empty issues, outline, four-column table are blocked separately',()=>{
 const s=newItem();s.issues='';
 const o=newItem();o.outline='';
 const t=newItem();t.theoryTable=[t.theoryTable[0]];
 for(const q of [s,o,t])assert.equal(G.inspect(initial,[q]).canPublish,false);
});
test('subquestion scores summing 30 are blocked even with parent 25',()=>{
 const s=newItem();s.question+='（一）背景判斷（15分）（二）處遇策略（15分）';
 const r=G.inspect(initial,[s]);
 assert(r.blocked.some(x=>x.reason.includes('加總不是 25 分')));
});
test('25-point total plus 10, 8, 7 subquestions accepted',()=>{
 const s=newItem();s.question+='（一）理論（10 分）（二）涵攝（8 分）（三）處遇（7 分）';
 assert.equal(G.inspect(initial,[s]).canPublish,true);
});
test('legacy corpus exact duplicate is blocked even when new ID differs',()=>{
 const s=newItem('qa-forged-duplicate');const existing=initial.questions[0];
 s.question=existing.question;
 assert(G.inspect(initial,[s]).blocked.some(x=>x.code==='EXACT_DUPLICATE'));
});
test('near-duplicate with identical case first 120 characters requires manual review',()=>{
 const s=newItem('qa-forged-near-duplicate');const existing=initial.questions[0];
 s.question=existing.question+'請另外比較另一種學理。';
 const r=G.inspect(initial,[s]);
 assert.equal(r.canPublish,false);
 assert(r.manualReview.some(x=>x.code==='NEAR_DUPLICATE'));
});
test('multiple new question IDs cannot repeat in same batch',()=>{
 const a=newItem(),b=p(a);
 b.question+='不同補充敘述';
 assert(G.inspect(initial,[a,b]).blocked.some(x=>x.code==='BATCH_ID_DUPLICATE'));
});
test('two new independent IDs with identical stems blocked as exact duplicate',()=>{
 const a=newItem(),b=newItem('qa-other-id');
 assert(G.inspect(initial,[a,b]).blocked.some(x=>x.code==='EXACT_DUPLICATE'));
});
test('source claiming a real original exam without original PDF needs human review',()=>{
 const s=newItem();s.sourceReference='改編自 115 年司法特考觀護人犯罪學第2題，待核對';
 const r=G.inspect(initial,[s]);
 assert.equal(r.canPublish,false);
 assert(r.manualReview.some(x=>x.code==='SOURCE_UNVERIFIED'));
});
test('failed batch does not permit partial publication',()=>{
 const good=newItem(),bad=newItem('qa-bad');
 bad.outline='';
 const result=G.inspect(initial,[good,bad]);
 assert.equal(result.canPublish,false);
 assert.equal(result.ready.length,1);
 assert.equal(result.proposedDataset,null);
});
test('empty parse result cannot empty published dataset',()=>{
 const result=G.inspect(initial,[]);
 assert.equal(result.canPublish,false);
 assert(result.blocked.some(x=>x.code==='IMPORT_EMPTY'));
});
test('malformed existing dataset rejected without unsafe write',()=>{
 const bad=p(initial);bad.count=0;
 assert.equal(G.inspect(bad,[newItem()]).canPublish,false);
});
test('script never mutates caller datasets',()=>{
 const s=newItem(),textBefore=JSON.stringify(s);
 G.inspect(initial,[s]);G.inspect(initial,[s,s]);
 assert.equal(JSON.stringify(s),textBefore);
 assert.equal(JSON.stringify(initial),pristine);
});
test('same source document section under different IDs blocked',()=>{
 const one=newItem('qa-source-one');one.sourceDocumentId='synthetic-google-doc-id';one.sourceQuestionIndex=1;
 const two=newItem('qa-source-two');two.sourceDocumentId='synthetic-google-doc-id';two.sourceQuestionIndex=1;
 two.question+='額外內容';
 const r=G.inspect(initial,[one,two]);
 assert(r.blocked.some(x=>x.code==='SOURCE_SLOT_CONFLICT'));
 assert.equal(r.proposedDataset,null);
});
test('different sections in same source document may contain different questions',()=>{
 const one=newItem('qa-section-one');one.sourceDocumentId='synthetic-google-doc-id';one.sourceQuestionIndex=1;
 const two=newItem('qa-section-two');two.sourceDocumentId='synthetic-google-doc-id';two.sourceQuestionIndex=2;
 two.question='申論題（25分）。少年乙於家庭關係緊張時有逃學及社交退縮情形，曾多次依循同儕建議參與網路詐騙活動。請使用一般緊張理論與標籤理論，分析可能的偏差學習與情緒因應機制，並提出少年保護官應如何評估與設計社區處遇，避免將個案行為直接等同人格特質。';
 const r=G.inspect(initial,[one,two]);
 assert.equal(r.canPublish,true);
 assert.equal(r.ready.length,2);
});
test('malformed warnings field blocks safely without thrown exception',()=>{
 const bad=newItem('qa-bad-warnings');bad.warnings='待分類';
 const r=G.inspect(initial,[bad]);
 assert.equal(r.canPublish,false);
 assert(r.blocked.some(x=>x.reason.includes('warnings')));
});
console.log('PASS all daily import quality gate regression tests (22 cases)');
