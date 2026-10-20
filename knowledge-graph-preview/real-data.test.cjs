'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const modelCtx={};modelCtx.globalThis=modelCtx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'graph-model.js'),'utf8'),modelCtx);
const G=modelCtx.KnowledgeGraphModel;
const dataCtx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(dir,'v2.5/study-map-data.js'),'utf8'),dataCtx);
vm.runInNewContext(fs.readFileSync(path.join(dir,'v2.5/questions.js'),'utf8'),dataCtx);
vm.runInNewContext(fs.readFileSync(path.join(dir,'v2.5/related-questions.js'),'utf8'),dataCtx);
const subjects=dataCtx.window.STUDY_MAP_DATA, bank=[...dataCtx.window.QUESTION_BANK,...dataCtx.window.RELATED_QUESTION_BANK];
test('real source file shapes and original subjects',()=>{
 assert(subjects.length>=10);
 assert(bank.length>=400);
 assert(subjects.some(s=>s.subject==='少年事件處理法'));
 assert(subjects.some(s=>s.subject==='保安處分執行法'));
});
test('real juvenile data renders topic and exact exercise links',()=>{
 const graph=G.buildGraph(subjects,bank,{subject:'少年事件處理法'});
 assert(graph.stats.topics>0);
 assert(graph.stats.questions>0);
 assert(graph.stats.matched>0,'at least one original juvenile exam question must match');
 for(const q of graph.nodes.filter(n=>n.type==='question'&&n.matched)){
   assert(bank.some(b=>b.id===q.rows[0].questionId),'no invented question ID');
 }
});
test('real criminal and correction subjects share only original question IDs',()=>{
 const graph=G.buildGraph(subjects,bank,{cross:true});
 assert.equal(graph.stats.subjects,4);
 for(const node of graph.nodes.filter(n=>n.type==='question'&&new Set(n.rows.map(r=>r.subject)).size>1)){
   assert(node.id.startsWith('question:'));
   const id=node.id.slice('question:'.length);
   assert(bank.some(q=>q.id===id),'shared link must be backed by an exact ID');
 }
});
