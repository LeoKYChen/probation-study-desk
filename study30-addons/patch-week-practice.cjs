/* Enable safe backfill via existing week cells; do not change the storage schema. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),dir=process.argv[2]||'deploy-dist';
const file=path.join(dir,'app.js');let source=fs.readFileSync(file,'utf8');
function once(from,to,label){const n=source.split(from).length-1;if(n!==1)throw Error('Week-picker '+label+': expected once, got '+n);source=source.replace(from,to);}
once('let store=blank(),session=null,running=false,lastTickMs=0,canSave=true;',
  'let store=blank(),session=null,running=false,lastTickMs=0,canSave=true,selectedPracticeDate=null;','state');
const loader='function loadToday(){const today=isoTaipei();session=store.sessions[today];if(!session){session=newSession(today);store.sessions[today]=session;persist();}return today;}';
const extra=[
'  function selectWeekPractice(iso){',
'    const today=isoTaipei(),start=dayIndex(today)-((dayNumber(today)+6)%7),index=dayIndex(iso);',
"    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)||!Number.isFinite(index)||index<start||index>dayIndex(today)){say('只能補練本週已過日期。');return;}",
'    pause();',
'    selectedPracticeDate=iso===today?null:iso;',
'    if(!store.sessions[iso]){',
'      const created=newSession(iso),subject=subjectFor(iso);',
'      // Use a date-seeded past-paper question rather than future rating data.',
"      const target=subject.sunday?'心理學':subject.target;",
"      const fallback=pick(pool(target),iso+':'+(subject.sunday?'sunday':target));",
'      created.questionId=fallback?.id||created.questionId;',
'      store.sessions[iso]=created;persist();',
'    }',
'    session=store.sessions[iso];',
'    render();',
"    if(iso!==today)say('已切換至 '+iso+' 的練習。這一天的作答、草稿及自評會獨立保存。');",
"    $('todayHeading').scrollIntoView({block:'start',behavior:'smooth'});",
'  }'
].join('\n');
once(loader,loader+'\n'+extra,'add date selector');
const cell="cell=document.createElement('div');cell.className='day-cell'+(d===today?' today':'')+(s?.finished?' finished':'');";
const button=[
"cell=document.createElement('button');cell.type='button';",
"cell.className='day-cell'+(d===today?' today':'')+(s?.finished?' finished':'')+(session?.date===d?' selected':'');",
"cell.disabled=d>today;",
"cell.setAttribute('aria-pressed',String(session?.date===d));",
"cell.setAttribute('aria-label',d+' '+(s?.finished?'已完成':d>today?'尚未到來':'可進入練習'));",
"cell.addEventListener('click',()=>selectWeekPractice(d));"
].join('');
once(cell,button,'interactive week cells');
once("$('historyContent').append(cell);}\n   }",
  "$('historyContent').append(cell);}\n     $('returnToday').hidden=session?.date===today;\n     $('weekPracticeHint').textContent=session?.date===today?'點選本週已過日期，可補做或接續該日練習；未到日期不可提前作答。':'目前補練 '+session.date+'：進度、草稿及自評均按當天保存。';\n   }",
  'week action status');
once('function render(){const iso=isoTaipei();if(iso!==session.date){pause();loadToday();}',
     'function render(){const iso=isoTaipei();if(!selectedPracticeDate&&iso!==session.date){pause();loadToday();}',
     'avoid returning to today on backfill');
once('function openClearRecords(){',
     "function openClearRecords(){if(selectedPracticeDate){say('補練其他日期時不能清除紀錄，請先返回今天。');return;}",
     'protect destructive actions');
once("$('openClearRecords').addEventListener('click',openClearRecords);",
     "$('openClearRecords').addEventListener('click',openClearRecords);$('returnToday').addEventListener('click',()=>selectWeekPractice(isoTaipei()));",
     'return today binding');
once('if(session&&isoTaipei()!==session.date&&!running)render();',
     'if(session&&!selectedPracticeDate&&isoTaipei()!==session.date&&!running)render();',
     'suppress repeated historical auto reload');
fs.writeFileSync(file,source,'utf8');
console.log('Installed current-week practice: past or today only, saved sessions preserved, future disabled');
