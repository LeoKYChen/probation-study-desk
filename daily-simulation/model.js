(function(root){
 'use strict';
 const banned=new Set(['__proto__','prototype','constructor']);
 const safe=(v,d=0)=>d<=35&&(v===null||['string','boolean','number'].includes(typeof v)||(typeof v==='object'&&Object.entries(v).every(([k,x])=>!banned.has(k)&&safe(x,d+1))));
 const record=r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.answer==='string'&&r.answer.length<=100000&&typeof r.review==='boolean'&&typeof r.updatedAt==='string'&&(r.questionSnapshot===undefined||typeof r.questionSnapshot==='string');
 function records(r){if(!r||typeof r!=='object'||Array.isArray(r)||!safe(r)||Object.keys(r).length>3000||!Object.values(r).every(record))throw Error('每日模擬題紀錄格式不符');return r;}
 function dataset(d){if(!d||d.schemaVersion!==1||!Array.isArray(d.questions)||!d.questions.length||d.count!==d.questions.length||!safe(d))throw Error('題庫格式不符');const ids=new Set();for(const q of d.questions){if(!q||typeof q.id!=='string'||!q.id||ids.has(q.id)||!/^\d{4}-\d{2}-\d{2}$/.test(q.date)||!['subject','question'].every(k=>typeof q[k]==='string'&&q[k].trim())||!['issues','outline'].every(k=>typeof q[k]==='string')||!Array.isArray(q.theoryTable)||!q.theoryTable.every(r=>Array.isArray(r)&&r.length===4&&r.every(c=>typeof c==='string')))throw Error('題目或四欄表格式不符');ids.add(q.id);}return d;}
 function backup(d){if(!d||!safe(d)||JSON.stringify(d).length>4000000)throw Error('備份格式不符或超過4MB');if(d.schemaVersion!==1)throw Error('備份版本不相容');if(d.format==='probation-daily-github-records')return records(d.records);if(d.format==='probation-study-desk-sync')return records(d.daily);throw Error('請選擇每日模擬題備份或 v2.5 完整備份');}
 const signature=q=>JSON.stringify([q.question,q.issues,q.outline,q.theoryTable]);
 const subject=q=>q.subject.includes('跨科')?'跨科整合':q.subject.replace(/[（(].*$/,'').trim();
 const excerpt=s=>String(s||'').replace(/\s+/g,' ').trim();
 const title=q=>q.title||excerpt(q.question).slice(0,40)+(excerpt(q.question).length>40?'…':'');
 function filter(questions,records,saved,s){return questions.filter(q=>(!s.subject||subject(q)===s.subject)&&(!s.date||q.date===s.date)&&(!s.query||[q.question,q.issues,q.outline,q.sourceReference,JSON.stringify(q.theoryTable),q.subject].join(' ').toLowerCase().includes(s.query.toLowerCase()))&&(s.tab==='全部題目'||s.tab==='我的收藏'&&saved.includes(q.id)||s.tab==='已有作答'&&records[q.id]?.answer.trim()||s.tab==='待複習'&&records[q.id]?.review)).sort((a,b)=>s.sort==='oldest'?a.date.localeCompare(b.date)||a.id.localeCompare(b.id):b.date.localeCompare(a.date)||a.id.localeCompare(b.id));}
 root.PracticeModel={safe,record,records,dataset,backup,signature,subject,excerpt,title,filter};
})(typeof window==='undefined'?globalThis:window);
