(function(root){
 'use strict';
 const banned=new Set(['__proto__','prototype','constructor']);
 const safe=(v,d=0)=>d<=35&&(v===null||['string','boolean','number'].includes(typeof v)||(typeof v==='object'&&Object.entries(v).every(([k,x])=>!banned.has(k)&&safe(x,d+1))));
 const record=r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.answer==='string'&&r.answer.length<=100000&&typeof r.review==='boolean'&&typeof r.updatedAt==='string'&&(r.questionSnapshot===undefined||typeof r.questionSnapshot==='string');
 function records(r){if(!r||typeof r!=='object'||Array.isArray(r)||!safe(r)||Object.keys(r).length>3000||!Object.values(r).every(record))throw Error('每日模擬題紀錄格式不符');return r;}
 function dataset(d){if(!d||d.schemaVersion!==1||!Array.isArray(d.questions)||!d.questions.length||d.count!==d.questions.length||!safe(d))throw Error('題庫格式不符');const ids=new Set();for(const q of d.questions){if(!q||typeof q.id!=='string'||!q.id||ids.has(q.id)||!/^\d{4}-\d{2}-\d{2}$/.test(q.date)||!['subject','question'].every(k=>typeof q[k]==='string'&&q[k].trim())||!['issues','outline'].every(k=>typeof q[k]==='string')||!Array.isArray(q.theoryTable)||!q.theoryTable.every(r=>Array.isArray(r)&&r.length===4&&r.every(c=>typeof c==='string')))throw Error('題目或四欄表格式不符');ids.add(q.id);}return d;}
 function backup(d){if(!d||!safe(d)||JSON.stringify(d).length>4000000)throw Error('備份格式不符或超過4MB');if(d.schemaVersion!==1)throw Error('備份版本不相容');if(d.format==='probation-daily-github-records')return records(d.records);if(d.format==='probation-study-desk-sync')return records(d.daily);throw Error('請選擇每日模擬題備份或 v2.5 完整備份');}
 const signature=q=>JSON.stringify([q.question,q.issues,q.outline,q.theoryTable]);
 const subjectNames=['少年事件處理法','保安處分執行法','刑事訴訟法','諮商與輔導','犯罪學','心理學','社會工作','刑法'];
 // 來源的科目欄可能混入整週輪替說明與考古題出處。分類只用明確的一行與受控科目名稱。
 function subject(q){
  const first=String(q.subject||'').replace(/\r/g,'').trim().split('\n')[0].trim();
  const fixed=first.match(/固定週[一二三四五六日天]\s*為[「『"]?(少年事件處理法|諮商與輔導|犯罪學|心理學|保安處分執行法|刑事訴訟法|刑法)/);
  if(fixed)return fixed[1];
  const line=first.replace(/^(?:輪替科目|考試科目|科目|考科)\s*[：:]\s*/,'').trim();
  if(!line||/^(?:待分類|未知)/.test(line))return '待分類';
  if(/跨科|跨領域|整合複盤|跨學科/.test(line))return '跨科整合';
  const found=subjectNames.filter(s=>line.includes(s));
  return found.length>1?'跨科整合':found[0]||'待分類';
 }
 // 只移除已確認為編輯指令的前言；不覆寫 questions.json 原文、題號或本機作答紀錄。
 function displayQuestion(q){
  let s=String(q.question||'').replace(/\r/g,'').trim();
  if(/^將(?:其|情境|原題)(?:深化|進一步)/.test(s)){
   const marker=s.match(/(?:^|\n)\s*(?:[一二三四五六七八九十0-9]+[、.．]\s*)?改編後實例申論題題目\s*\n?/);
   if(marker)s=s.slice(marker.index+marker[0].length).replace(/^\s*【改編模擬申論題】\s*\n?/,'').trim();
  }
  return s.replace(/^(?:題目|改編題目)\s*[：:]\s*/,'').replace(/^題目來源標示[：:][^\n]*\n+/,'').trim();
 }
 function needsContext(q){
  const s=displayQuestion(q).replace(/^\s*[（(][^）)]{0,45}[）)]\s*/,'').trim();
  return /^(?:依|就|根據)(?:上述|前述|上開|以上)(?:事實|案例|情境|個案)/.test(s);
 }
 const excerpt=s=>String(s||'').replace(/\s+/g,' ').trim();
 const title=q=>q.title||excerpt(displayQuestion(q)).slice(0,40)+(excerpt(displayQuestion(q)).length>40?'…':'');
 function filter(questions,records,saved,s){return questions.filter(q=>(!s.subject||subject(q)===s.subject)&&(!s.date||q.date===s.date)&&(!s.query||[q.question,q.issues,q.outline,q.sourceReference,JSON.stringify(q.theoryTable),q.subject].join(' ').toLowerCase().includes(s.query.toLowerCase()))&&(s.tab==='全部題目'||s.tab==='我的收藏'&&saved.includes(q.id)||s.tab==='已有作答'&&records[q.id]?.answer.trim()||s.tab==='待複習'&&records[q.id]?.review)).sort((a,b)=>s.sort==='oldest'?a.date.localeCompare(b.date)||a.id.localeCompare(b.id):b.date.localeCompare(a.date)||a.id.localeCompare(b.id));}
 root.PracticeModel={safe,record,records,dataset,backup,signature,subject,displayQuestion,needsContext,excerpt,title,filter};
})(typeof window==='undefined'?globalThis:window);
