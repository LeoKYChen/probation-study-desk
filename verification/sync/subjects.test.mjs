import test from 'node:test';
import assert from 'node:assert/strict';
import {SUBJECTS,isSupportedSubject,recommend} from '../../study-desk/domain.js';
import {emptyState} from '../../cloud-sync/core.js';
test('excluded subjects cannot be reintroduced by bank or imported preferences',()=>{
 const removed=['社會工作','國文','法學知識與英文'];
 for(const subject of removed){assert.equal(isSupportedSubject(subject),false);assert.equal(SUBJECTS.includes(subject),false);}
 assert.equal(isSupportedSubject('刑法'),true);
 const state=emptyState();
 for(const subject of removed)state.records['attempt/'+subject]={value:{kind:'attempt',subject,question:{id:subject},updatedAt:'2026-10-22',due:'2026-10-01',answer:'保留舊答案'}};
 const before=structuredClone(state);
 const preferences={subjects:Object.fromEntries(removed.map(s=>[s,{enabled:true,weight:1}])),learnedTopics:removed};
 const result=recommend(state,removed.map(s=>({id:s,subject:s,topicKey:s})),preferences);
 assert.equal(result.type,'empty');assert.deepEqual(result.audit.enabledSubjects,[]);
 assert.deepEqual(state,before);
});
