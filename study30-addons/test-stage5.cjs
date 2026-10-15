/* Stage 5 safety/regression tests. Never touch real study data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),a=require('node:assert/strict');
const root={addEventListener(){}},ctx={window:root,document:{readyState:'loading',addEventListener(){}},console,Date};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'weakness-priority.js'),'utf8'),ctx);
const recommend=root.Study30WeaknessPriority.recommend;
const today='2026-10-15';let pass=0;
function check(label,fn){fn();pass++;console.log('PASS '+pass+' '+label)}
function item(id,daysUntil,score,subject='心理學',issues=[],extra={}){
 return {id,daysUntil,score,subject,issues,topic:'測試｜'+id,canOpen:true,date:'2026-10-13',due:'2026-10-15',nextStep:'補充應用',...extra};
}
const rows=[
 {day:'2026-10-01',id:'a',subject:'心理學',score:25,issues:['理論或學者混淆']},
 {day:'2026-10-08',id:'a',subject:'心理學',score:35,issues:['理論或學者混淆']},
 {day:'2026-10-12',id:'b',subject:'心理學',score:78,issues:['理論或學者混淆']},
 {day:'2026-10-13',id:'c',subject:'刑法',score:52,issues:['案例涵攝薄弱']},
 {day:'2026-10-14',id:'d',subject:'犯罪學',score:99,issues:[]}
];
const due={all:[item('a',0,45),item('b',-2,76),item('c',0,51,'刑法'),item('d',2,99,'犯罪學') ]};
let r=recommend(due,rows,today,'心理學');
check('find 3 due not future',()=>a.equal(r.dueCount,3));
check('all 3 due can open',()=>a.equal(r.openableDue,3));
check('pick 3 by default',()=>a.equal(r.picks.length,3));
check('exclude future from recommendations',()=>a.ok(!r.picks.some(x=>x.id==='d')));
check('low score and repeated weaknesses can outrank slight overdue',()=>a.equal(r.picks[0].id,'a'));
check('low scoring appears before high, same urgency',()=>a.ok(r.picks.findIndex(x=>x.id==='a')<r.picks.findIndex(x=>x.id==='c')));
check('print reasons for each',()=>a.ok(r.picks.every(x=>x.reasons.length>=2)));
check('overdue reason exact',()=>a.ok(r.picks.find(x=>x.id==='b').reasons.some(x=>x.includes('逾期 2 天'))));
check('recurrent weaknesses remembered',()=>a.equal(r.fallback[0].count,3));
check('recurrent weakness is psychology',()=>a.equal(r.fallback[0].subject,'心理學'));
check('30-day history limited',()=>{
 let data=[...rows,{day:'2026-09-14',subject:'心理學',score:1,issues:['過期紀錄']}];
 a.ok(!recommend(due,data,today,'心理學').fallback.some(x=>x.issue==='過期紀錄'));
});
check('future-dated history excluded',()=>{
 const z=recommend(due,[...rows,{day:'2026-10-16',subject:'心理學',score:1,issues:['未來失分']}],today,'心理學');
 a.ok(!z.fallback.some(x=>x.issue==='未來失分'));
});
check('does not mutate review input',()=>a.equal(due.all[0].score,45));
check('does not mutate analytics history',()=>a.equal(rows[0].issues[0],'理論或學者混淆'));
check('no student data yields no recommendations',()=>a.equal(recommend({all:[]},[],today,'刑法').picks.length,0));
check('no history flag',()=>a.equal(recommend({all:[]},[],today,'刑法').hasHistory,false));
check('history with no weaknesses not fabricated',()=>a.equal(recommend({all:[]},[rows[4]],today,'刑法').fallback.length,0));
check('history with no due does not recommend future topic as due',()=>a.equal(recommend({all:[item('x',1,20)]},rows,today,'刑法').picks.length,0));
check('no due still highlights recorded weaknesses',()=>a.ok(recommend({all:[]},rows,today,'心理學').fallback.length>0));
check('missing canOpen excludes click candidate',()=>{
 const v=recommend({all:[item('a',0,21,'心理學',[],{canOpen:false})]},rows,today,'心理學');a.equal(v.dueCount,1);a.equal(v.openableDue,0);
});
check('limit one works',()=>a.equal(recommend(due,rows,today,'心理學',1).picks.length,1));
check('limit capped to five',()=>a.ok(recommend(due,rows,today,'心理學',999).picks.length<=5));
check('duplicate weakness in same assessment counted once',()=>{
 const v=recommend({all:[]},[{day:today,subject:'刑法',score:30,issues:['案例涵攝薄弱','案例涵攝薄弱']}],today,'刑法');
 a.equal(v.fallback[0].count,1);
});
check('invalid dates do not rank items',()=>a.equal(recommend(due,rows,'2026-13-33','心理學').picks.length,0));
check('skip nonnumeric daysUntil',()=>a.equal(recommend({all:[item('z',NaN,12)]},rows,today,'心理學').dueCount,0));
check('daily subject bonus in explanation',()=>a.ok(r.picks.find(x=>x.id==='a').reasons.includes('符合今日固定科目')));
check('different subject does not imply match',()=>a.ok(!r.picks.find(x=>x.id==='c').reasons.includes('符合今日固定科目')));
check('fallback sorted by descending frequency',()=>a.ok(r.fallback.every((x,i,s)=>i===0||s[i-1].count>=x.count)));
check('updated assessments refresh analytics without writing',()=>{
 const before=recommend({all:[item('z',0,95,'刑法')]},rows,today,'刑法');
 const after=recommend({all:[item('z',0,29,'刑法')]},rows,today,'刑法');
 a.ok(after.picks[0].priority>before.picks[0].priority);
});
check('older low score no longer dominates recent due',()=>{
 const futureOnly={all:[item('old',3,0),item('new',0,90)]};a.equal(recommend(futureOnly,rows,today,'刑法').picks[0].id,'new');
});
check('fallback is read-only text recommendation',()=>a.ok(r.fallback.every(x=>!('action' in x))));
check('priorities do not update review due dates',()=>a.equal(due.all[0].due,'2026-10-15'));
console.log('TOTAL '+pass+' stage5 automated regression tests: PASS');
