/* v2.5.2a: local, read-only scheduling forecast. No storage writes, timers, or date mutation. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'probation-study30-v251:v1';
  const core = window.Study30Review;
  const planner = window.Study30Planner;
  const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const labels = {mastered:'能自行說明',partial:'還不完整',review:'需要再複習'};
  const scenarios = {
    review:{rating:'review',history:[[-0,'review']],interval:1},
    partial:{rating:'partial',history:[[0,'partial']],interval:3},
    first:{rating:'mastered',history:[[0,'mastered']],interval:7},
    second:{rating:'mastered',history:[[-7,'mastered'],[0,'mastered']],interval:14},
    third:{rating:'mastered',history:[[-21,'mastered'],[-14,'mastered'],[0,'mastered']],interval:30}
  };
  const demoQuestion=bank.find(q => q.examType === '觀護人' && q.subject === '心理學') ||
                     bank.find(q => String(q.examType || '').includes('觀護人')) || bank[0];
  function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  function today(){return planner.isoTaipei();}
  function demoSessions(anchor,scenario){const sessions={};for(const [offset,rating] of scenario.history){const day=core.addDays(anchor,offset);sessions[day]={questionId:String(demoQuestion.id),rating,finished:true};}return sessions;}
  function readOnlySessions(){try{const raw=localStorage.getItem(KEY);const parsed=JSON.parse(raw||'null');return parsed?.version===1&&parsed.sessions&&typeof parsed.sessions==='object'&&!Array.isArray(parsed.sessions)?parsed.sessions:{};}catch{return {};}}
  function eligible(r,sub){return sub.sunday || r.subject === sub.target || (r.subject==='刑事訴訟法與保安處分執行法'&&['刑事訴訟法','保安處分執行法'].includes(sub.target));}
  function recommendation(sessions,simulatedDate){const sub=planner.subjectFor(simulatedDate);const data=core.model(sessions,bank,simulatedDate);const match=data.due.find(r=>eligible(r,sub));return {sub,data,match};}
  function nextEligible(sessions,fromDate,id){for(let offset=1;offset<=7;offset++){
    const date=core.addDays(fromDate,offset),out=recommendation(sessions,date);
    if(out.match?.id === id)return {date,sub:out.sub};
  }return null;}
  let current=null;
  function jumpToNext(){
    if(!current?.jumpDate)return;
    const offset=core.dateIndex(current.jumpDate)-core.dateIndex(current.base);
    const select=$('simDays');
    if(!Array.from(select.options).some(o=>Number(o.value)===offset)){
      const opt=element('option',`${offset}天後（下次可推薦）`);opt.value=String(offset);select.append(opt);
    }
    select.value=String(offset);
    renderPreview();
  }
  function renderPreview(){
    if(!core||!planner){$('simOutput').textContent='尚未載入排程程式，請重新整理後再試。';return;}
    const base=today(),offset=Number($('simDays').value),date=core.addDays(base,offset);
    const demo=$('simSource').value==='demo';
    if(demo&&!demoQuestion){$('simOutput').textContent='考古題資料尚未載入，請檢查網路連線後重新整理。';return;}
    const scenario=scenarios[$('simCase').value];
    const sessions=demo?demoSessions(base,scenario):readOnlySessions();
    const {sub,data,match}=recommendation(sessions,date);
    current={base,date,offset,demo,scenario,sessions,data,match};
    $('simNext').textContent='';$('simRerateArea').hidden=!match;$('simNextEligible').hidden=true;
    const out=$('simOutput');out.replaceChildren();
    out.append(element('span',`日期：${date}（今天 +${offset} 天）｜星期${'日一二三四五六'[sub.day]}｜${sub.label}`,'sim-date'));
    if(demo){const item=data.all.find(r=>r.id===String(demoQuestion.id));
      out.append(element('p',`${labels[scenario.rating]}。${scenario.history.length} 次自評，最近一次為今天。規則應排 ${scenario.interval} 天後；計算結果：${item?.due || '無結果'}。`));
      if(item?.interval!==scenario.interval)out.append(element('p','⚠️ 示範規則與排程結果不一致，請勿將此結果視為通過。'));
    }else if(data.all.length===0){out.append(element('p','目前沒有可演算的已自評題目。可切換「範例資料」檢視，不必刪除或新增正式紀錄。'));}
    out.append(element('h4',`已到期 ${data.due.length} 題；尚未到期 ${data.upcoming.length} 題`));
    if(data.due.length){const ul=element('ul');for(const item of data.due.slice(0,6))ul.append(element('li',`${item.subject}｜${item.topic}（應於 ${item.due} 複習）`));out.append(ul);
      if(data.due.length>6)out.append(element('p',`另有 ${data.due.length-6} 題到期，僅列出前六題。`));
    }else{out.append(element('p','尚無到期題目。請選擇更遠的模擬日期。'));}
    if(match){out.append(element('p',`✅ 當天會優先推薦：${match.subject}｜${match.topic}（${sub.sunday?'週日跨科複習':'符合當日科目'}）。`));}
    else if(data.due.length){out.append(element('p',`⚠️ 有到期題，但當天安排「${sub.label}」，依現行科目輪替規則不會強制推薦其他科目。`));
      const candidate=data.due[0],next=nextEligible(sessions,date,candidate.id);
      if(next){current.jumpDate=next.date;$('simNextEligible').hidden=false;out.append(element('p',`最早到期題「${candidate.topic}」可能在 ${next.date}（${next.sub.label}）獲得推薦；若有其他更早到期題，實際推薦順序仍依排序規則。`));}
    }else out.append(element('p','因為沒有到期題，此時會照原本每週科目規劃選題。'));
    // A simulated re-answer can only be performed when a question is actually recommended on this simulated day.
  }
  function rerate(){
    if(!current?.match){$('simNext').textContent='目前沒有可模擬重答的推薦題。';return;}
    const {date,sessions,match}=current,rating=$('simRerate').value;
    const copy={...sessions,[date]:{questionId:match.id,rating,finished:true}};
    const updated=core.model(copy,bank,date).all.find(r=>r.id===match.id);
    if(!updated){$('simNext').textContent='演算失敗，未更新任何正式資料。';return;}
    $('simNext').textContent=`僅預覽：${date} 再答「${match.topic}」並選「${labels[rating]}」，下次為 ${updated.due}（${updated.interval} 天後）；正式紀錄完全不變。`;
  }
  function bind(){const host=$('reviewSimulator');if(!host)return;
    $('simSource').addEventListener('change',()=>{$('simCaseLabel').hidden=$('simSource').value!=='demo';renderPreview();});
    $('simCase').addEventListener('change',()=>{ // Jump to the case's own due day for simpler iPhone testing.
      $('simDays').value=String(scenarios[$('simCase').value].interval);renderPreview();
    });
    $('simDays').addEventListener('change',renderPreview);
    $('simPreview').addEventListener('click',renderPreview);
    $('simNextEligible').addEventListener('click',jumpToNext);
    $('simRetry').addEventListener('click',rerate);
    $('simDays').value='1';renderPreview();
  }
  window.Study30SpacingTest={scenarios,demoSessions,recommendation,eligible,readOnlySessions};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
